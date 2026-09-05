import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prismaClient';
import bcrypt from 'bcryptjs';
import {
  createRefreshTokenValue,
  generateAccessToken,
  generateRefreshToken,
  getRefreshTokenFamilyPrefix,
  parseRefreshTokenMetadata,
} from '../utils/jwt.utils';
import { notifyAdminsOfNewRequest, createNotification } from '../utils/notification.utils';
import catchAsync from '../utils/catchAsync';
import {
  AppError,
  AuthenticationError,
  ConflictError,
  NotFoundError,
  AuthorizationError,
} from '../utils/appError';
import logger from '../utils/logger';
import { verifyTOTP } from '../utils/twoFactor.utils';
import { EnrollmentService } from '../services/enrollment.service';
import { lockUserSessionState, revokeAllUserSessions } from '../services/session.service';
import { assertPasswordStrength } from '../utils/passwordPolicy';

export interface RegisterRequestBody {
  email: string;
  password?: string;
  role?: string;
  firstName: string;
  lastName: string;
  departmentId?: string | number;
  studentId?: string;
  year?: string | number;
  phone?: string;
}

export interface LoginRequestBody {
  email?: string;
  password?: string;
  totpToken?: string;
}

export interface RejectRequestBody {
  reason: string;
}

// Helper to resolve refresh cookie SameSite attribute
const getRefreshCookieSameSite = (): 'strict' | 'lax' | 'none' => {
  const envSameSite = process.env.REFRESH_COOKIE_SAMESITE?.toLowerCase().trim();
  if (envSameSite === 'strict' || envSameSite === 'lax' || envSameSite === 'none') {
    return envSameSite;
  }
  const isProd = process.env.NODE_ENV === 'production';
  // Default to 'none' in production for cross-site deployment topology, 'lax' in development
  return isProd ? 'none' : 'lax';
};

// Helper to set cookies
const setAuthCookies = (res: Response, accessToken: string, refreshToken: string): void => {
  const isProd = process.env.NODE_ENV === 'production';
  const sameSite = getRefreshCookieSameSite();
  const isSecure = isProd || sameSite === 'none';

  res.cookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure: isSecure,
    sameSite,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    path: '/',
  });
};

export const register = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const {
    email,
    password,
    role: requestedRole,
    firstName,
    lastName,
    departmentId,
    studentId,
    year,
    phone,
  } = req.body as RegisterRequestBody;
  assertPasswordStrength(password);
  const role = 'STUDENT';
  if (requestedRole && requestedRole !== 'STUDENT') {
    return next(
      new AppError(
        'Only student registration is available. Faculty accounts are created by administrators.',
        400
      )
    );
  }

  const parsedDeptId =
    departmentId !== undefined && departmentId !== ''
      ? parseInt(departmentId as string, 10)
      : null;
  if (parsedDeptId !== null && isNaN(parsedDeptId)) {
    return res.status(400).json({ message: 'Invalid departmentId: must be a number' });
  }

  const genericRegistrationResponse = () =>
    res.status(202).json({
      success: true,
      message:
        'If the submitted information is eligible, the application will be reviewed.',
    });

  const [hashedPassword, existingUser, existingStudent, existingRequest] =
    await Promise.all([
      bcrypt.hash(password as string, 10),
      prisma.user.findUnique({ where: { email }, select: { id: true } }),
      studentId
        ? prisma.student.findUnique({
            where: { studentId },
            select: { id: true },
          })
        : Promise.resolve(null),
      prisma.registrationRequest.findUnique({
        where: { email },
        select: { id: true, status: true },
      }),
    ]);

  if (existingUser || existingStudent || existingRequest) {
    logger.info('[AUTH] Registration submission matched existing state', {
      email,
      existingUser: Boolean(existingUser),
      existingStudent: Boolean(existingStudent),
      requestStatus: existingRequest?.status,
    });
    return genericRegistrationResponse();
  }

  let request;
  try {
    request = await prisma.registrationRequest.create({
      data: {
        email,
        password: hashedPassword,
        role,
        firstName,
        lastName,
        studentId: role === 'STUDENT' ? studentId : null,
        year: role === 'STUDENT' ? (year ? parseInt(year as string, 10) : 1) : null,
        departmentId: parsedDeptId,
        phone: phone?.trim() || null,
      },
    });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      logger.info('[AUTH] Registration submission lost a uniqueness race', {
        email,
        target: error?.meta?.target,
      });
      return genericRegistrationResponse();
    }
    throw error;
  }

  if (request.departmentId) {
    await notifyAdminsOfNewRequest({
      role: request.role,
      firstName: request.firstName,
      lastName: request.lastName,
      departmentId: request.departmentId,
    });
  }

  return genericRegistrationResponse();
});

export const login = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const email = String(req.body.email || '')
    .trim()
    .toLowerCase();
  const { password } = req.body as LoginRequestBody;

  logger.info(`[AUTH] Login attempt for email: ${email}`);

  const [registrationRequest, user] = await Promise.all([
    prisma.registrationRequest.findUnique({
      where: { email },
      select: { status: true },
    }),
    prisma.user.findUnique({
      where: { email },
      include: {
        student: true,
        doctor: true,
        managedCollege: { select: { id: true, name: true, nameAr: true } },
      },
    }),
  ]);

  logger.debug(`[AUTH] User search result: ${user ? 'Found' : 'Not Found'}`);

  const dummyPasswordHash =
    '$2b$10$OpeBBdb/21NC.p5Zrli5vOWHt7XNakKQXMMjPI/PNi5BeQM2VNOea';
  const passwordMatches = await bcrypt.compare(
    password as string,
    user?.password || dummyPasswordHash
  );
  const requestBlocksLogin =
    registrationRequest?.status === 'PENDING' ||
    registrationRequest?.status === 'REJECTED';
  if (!user || !passwordMatches || user.isActive === false || requestBlocksLogin) {
    const denialState = requestBlocksLogin
      ? `registration_${registrationRequest!.status.toLowerCase()}`
      : !user
        ? 'user_not_found'
        : !passwordMatches
          ? 'password_mismatch'
          : 'account_deactivated';
    logger.warn(`[AUTH] Login denied (${denialState}) for: ${email}`);
    return next(new AuthenticationError('Invalid email or password'));
  }

  const require2FA = process.env.REQUIRE_2FA !== 'false';
  if (require2FA && user.twoFactorEnabled) {
    logger.info(`[AUTH] 2FA required for: ${email}`);
    const { totpToken } = req.body;
    if (!totpToken) {
      return res.status(200).json({
        success: true,
        requires2FA: true,
        message: 'Please enter your 2FA code',
      });
    }
    const isValid = await verifyTOTP(
      user.twoFactorSecret as string,
      totpToken,
      user.id
    );
    if (!isValid) {
      logger.warn(`[AUTH] Invalid 2FA token for: ${email}`);
      return next(new AuthenticationError('Invalid 2FA code'));
    }
  }

  logger.info(`[AUTH] Generating tokens for user: ${user.id}`);
  const accessToken = generateAccessToken(user.id, user.tokenVersion);
  const refreshToken = await generateRefreshToken(user.id, user.tokenVersion);

  logger.info(`[AUTH] Setting cookies and sending response for: ${email}`);
  setAuthCookies(res, accessToken, refreshToken);

  res.json({
    success: true,
    data: {
      accessToken, // Returned in body for memory storage
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        twoFactorEnabled: user.twoFactorEnabled,
        profile: user.student || user.doctor || null,
        managedCollege: user.managedCollege || null,
        managedCollegeId: user.managedCollegeId || null,
        managedCollegeName: user.managedCollege?.name || user.managedCollege?.nameAr || null,
      },
    },
  });
});

const LEGACY_ROTATED_TOKEN_MARKER = new Date(0);

export const refresh = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { refresh_token } = req.cookies;

  if (!refresh_token) {
    return next(new AuthenticationError('Refresh token missing'));
  }

  const metadata = parseRefreshTokenMetadata(refresh_token);
  const result = await prisma.$transaction(async (tx) => {
    const findToken = () =>
      tx.refreshToken.findUnique({
        where: { token: refresh_token },
        include: {
          user: {
            include: {
              student: true,
              doctor: true,
              managedCollege: { select: { id: true, name: true, nameAr: true } },
            },
          },
        },
      });

    let tokenDoc;
    if (metadata) {
      await lockUserSessionState(tx, metadata.userId);
      tokenDoc = await findToken();
    } else {
      tokenDoc = await findToken();
      if (tokenDoc) {
        await lockUserSessionState(tx, tokenDoc.userId);
        tokenDoc = await findToken();
      }
    }

    if (!tokenDoc) {
      if (metadata) {
        await tx.refreshToken.deleteMany({
          where: {
            userId: metadata.userId,
            token: { startsWith: getRefreshTokenFamilyPrefix(metadata) },
          },
        });
      }
      return { kind: 'missing' as const };
    }

    if (tokenDoc.expiresAt.getTime() === LEGACY_ROTATED_TOKEN_MARKER.getTime()) {
      await tx.refreshToken.deleteMany({ where: { userId: tokenDoc.userId } });
      return { kind: 'reused' as const, userId: tokenDoc.userId };
    }

    if (tokenDoc.expiresAt < new Date()) {
      await tx.refreshToken.deleteMany({ where: { id: tokenDoc.id } });
      return { kind: 'invalid' as const };
    }

    if (tokenDoc.user.isActive === false) {
      await tx.refreshToken.deleteMany({ where: { userId: tokenDoc.userId } });
      return { kind: 'invalid' as const };
    }

    if (
      metadata &&
      (metadata.userId !== tokenDoc.userId || metadata.tokenVersion !== tokenDoc.user.tokenVersion)
    ) {
      await tx.refreshToken.deleteMany({
        where: {
          userId: metadata.userId,
          token: { startsWith: getRefreshTokenFamilyPrefix(metadata) },
        },
      });
      return { kind: 'invalid' as const };
    }

    const familyId = metadata?.familyId;
    const claimedToken = metadata
      ? await tx.refreshToken.deleteMany({
          where: { id: tokenDoc.id, token: refresh_token },
        })
      : await tx.refreshToken.updateMany({
          where: { id: tokenDoc.id, expiresAt: tokenDoc.expiresAt },
          data: { expiresAt: LEGACY_ROTATED_TOKEN_MARKER },
        });

    if (claimedToken.count !== 1) {
      if (metadata) {
        await tx.refreshToken.deleteMany({
          where: {
            userId: metadata.userId,
            token: { startsWith: getRefreshTokenFamilyPrefix(metadata) },
          },
        });
      } else {
        await tx.refreshToken.deleteMany({ where: { userId: tokenDoc.userId } });
      }
      return { kind: 'reused' as const, userId: tokenDoc.userId };
    }

    const newRefreshToken = createRefreshTokenValue(
      tokenDoc.user.id,
      tokenDoc.user.tokenVersion,
      familyId
    );
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await tx.refreshToken.create({
      data: {
        token: newRefreshToken,
        userId: tokenDoc.user.id,
        expiresAt,
      },
    });

    const accessToken = generateAccessToken(tokenDoc.user.id, tokenDoc.user.tokenVersion);
    const { password: _password, twoFactorSecret: _secret, ...safeUser } = tokenDoc.user;
    const userData = { ...safeUser, twoFactorEnabled: tokenDoc.user.twoFactorEnabled };

    return { kind: 'success' as const, accessToken, newRefreshToken, user: userData };
  });

  if (result.kind !== 'success') {
    if (result.kind === 'reused' || (result.kind === 'missing' && metadata)) {
      const replayUserId = result.kind === 'reused' ? result.userId : metadata!.userId;
      logger.warn(`[AUTH] Refresh token reuse detected for user: ${replayUserId}. Session family revoked.`);
    }
    return next(new AuthenticationError('Invalid or expired refresh token'));
  }

  setAuthCookies(res, result.accessToken, result.newRefreshToken);

  return res.json({
    success: true,
    data: { accessToken: result.accessToken, user: result.user },
  });
});

export const logout = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  if (req.user?.id) {
    await revokeAllUserSessions(req.user.id);
  }

  const isProd = process.env.NODE_ENV === 'production';
  const sameSite = getRefreshCookieSameSite();
  const isSecure = isProd || sameSite === 'none';

  res.clearCookie('refresh_token', {
    path: '/',
    httpOnly: true,
    secure: isSecure,
    sameSite,
  });
  res.json({ success: true, message: 'Logged out successfully' });
});

export const getMe = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    include: {
      student: true,
      doctor: true,
      managedCollege: { select: { id: true, name: true, nameAr: true } },
    },
  });

  if (!user) {
    return next(new NotFoundError('User no longer exists'));
  }

  type SafeUser = Omit<typeof user, 'password' | 'twoFactorSecret'>;
  const { password: _password, twoFactorSecret: _secret, ...safeUser } = user;

  res.json({
    success: true,
    data: {
      ...safeUser,
      twoFactorEnabled: user.twoFactorEnabled,
    },
  });
});

export const getRequests = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { user } = req;
  const { status } = req.query;
  const where: any = {};
  if (status && status !== 'ALL') {
    where.status = status;
  }

  if (user!.role === 'COLLEGE_ADMIN') {
    const collegeId = user!.managedCollegeId ?? user!.collegeId;
    if (!collegeId) {
      return next(new AuthorizationError('College admin not configured'));
    }
    where.department = { collegeId };
  } else if (user!.role === 'DEPARTMENT_ADMIN') {
    const departmentId = user!.managedDepartmentId ?? user!.departmentId;
    if (!departmentId) {
      return next(new AuthorizationError('Department admin not configured'));
    }
    where.departmentId = departmentId;
  }

  const requests = await prisma.registrationRequest.findMany({
    where,
    select: {
      id: true,
      email: true,
      role: true,
      firstName: true,
      lastName: true,
      studentId: true,
      year: true,
      phone: true,
      departmentId: true,
      status: true,
      rejectionReason: true,
      createdAt: true,
      department: {
        select: {
          id: true,
          name: true,
          nameAr: true,
          collegeId: true,
          createdAt: true,
          college: {
            select: {
              id: true,
              name: true,
              nameAr: true,
              description: true,
              descriptionAr: true,
              createdAt: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ success: true, data: requests });
});

export const approveRequest = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const request = await prisma.registrationRequest.findUnique({
      where: { id: parseInt(id as string) },
      include: { department: { select: { collegeId: true } } },
    });

    if (!request) {
      return next(new NotFoundError('Request not found'));
    }

    if (
      req.user!.role === 'COLLEGE_ADMIN' &&
      req.user!.managedCollegeId !== request.department?.collegeId
    ) {
      return res.status(403).json({ message: 'Access denied: request belongs to a different college' });
    }
    if (
      req.user!.role === 'DEPARTMENT_ADMIN' &&
      req.user!.managedDepartmentId !== request.departmentId
    ) {
      return res.status(403).json({ message: 'Access denied: request belongs to a different department' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: request.email,
          password: request.password,
          role: request.role as any,
          departmentId: request.departmentId,
        },
      });

      let studentId: number | null = null;

      if (request.role === 'STUDENT') {
        const student = await tx.student.create({
          data: {
            userId: user.id,
            firstName: request.firstName,
            lastName: request.lastName,
            studentId: request.studentId as string,
            year: request.year || 1,
            departmentId: request.departmentId,
            phone: request.phone || null,
          },
        });
        studentId = student.id;
      } else if (request.role === 'DOCTOR') {
        await tx.doctor.create({
          data: {
            userId: user.id,
            firstName: request.firstName,
            lastName: request.lastName,
            departmentId: request.departmentId,
          },
        });
      }

      await tx.registrationRequest.update({
        where: { id: parseInt(id as string) },
        data: { status: 'APPROVED' },
      });

      return { user, studentId };
    });

    if (result.studentId) {
      try {
        await EnrollmentService.autoEnrollStudent(result.studentId);
      } catch (enrollErr) {
        console.warn('Could not auto-enroll student on request approval:', enrollErr);
      }
    }

    await createNotification({
      userId: result.user.id,
      title: 'Registration Approved',
      message: 'Your registration request has been accepted.',
    });

    res.json({ success: true, message: 'Request approved successfully' });
  }
);

export const rejectRequest = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const { reason } = (req.body || {}) as RejectRequestBody;

  const request = await prisma.registrationRequest.findUnique({
    where: { id: parseInt(id as string) },
    include: { department: { select: { collegeId: true } } },
  });

  if (!request) {
    return next(new NotFoundError('Request not found'));
  }

  if (
    req.user!.role === 'COLLEGE_ADMIN' &&
    req.user!.managedCollegeId !== request.department?.collegeId
  ) {
    return res.status(403).json({ message: 'Access denied: request belongs to a different college' });
  }
  if (
    req.user!.role === 'DEPARTMENT_ADMIN' &&
    req.user!.managedDepartmentId !== request.departmentId
  ) {
    return res.status(403).json({ message: 'Access denied: request belongs to a different department' });
  }

  await prisma.registrationRequest.update({
    where: { id: parseInt(id as string) },
    data: { status: 'REJECTED', rejectionReason: reason },
  });

  res.json({ success: true, message: 'Request rejected' });
});

export const deleteRequest = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;

  const request = await prisma.registrationRequest.findUnique({
    where: { id: parseInt(id as string) },
    include: { department: { select: { collegeId: true } } },
  });

  if (!request) {
    return next(new NotFoundError('Request not found'));
  }

  if (
    req.user!.role === 'COLLEGE_ADMIN' &&
    req.user!.managedCollegeId !== request.department?.collegeId
  ) {
    return res.status(403).json({ message: 'Access denied: request belongs to a different college' });
  }
  if (
    req.user!.role === 'DEPARTMENT_ADMIN' &&
    req.user!.managedDepartmentId !== request.departmentId
  ) {
    return res.status(403).json({ message: 'Access denied: request belongs to a different department' });
  }

  await prisma.registrationRequest.delete({
    where: { id: parseInt(id as string) },
  });

  res.json({ success: true, message: 'Request deleted successfully' });
});

