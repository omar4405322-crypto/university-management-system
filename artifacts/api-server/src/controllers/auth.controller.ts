import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import prisma from '../utils/prismaClient';
import bcrypt from 'bcryptjs';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt.utils';
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

// Helper to set cookies
const setAuthCookies = (res: Response, accessToken: string, refreshToken: string): void => {
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
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
  const role = 'STUDENT';
  if (requestedRole && requestedRole !== 'STUDENT') {
    return next(
      new AppError(
        'Only student registration is available. Faculty accounts are created by administrators.',
        400
      )
    );
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return next(new ConflictError('Email already registered'));
  }

  if (role === 'STUDENT' && studentId) {
    const existingStudent = await prisma.student.findUnique({ where: { studentId } });
    if (existingStudent) {
      return next(new ConflictError('Student ID already exists'));
    }
  }

  const existingRequest = await prisma.registrationRequest.findUnique({ where: { email } });
  if (existingRequest) {
    return next(new ConflictError('Registration request already pending'));
  }

  const hashedPassword = await bcrypt.hash(password as string, 10);

  const parsedDeptId =
    departmentId !== undefined && departmentId !== ''
      ? parseInt(departmentId as string, 10)
      : null;
  if (parsedDeptId !== null && isNaN(parsedDeptId)) {
    return res.status(400).json({ message: 'Invalid departmentId: must be a number' });
  }

  const request = await prisma.registrationRequest.create({
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

  if (request.departmentId) {
    await notifyAdminsOfNewRequest({
      role: request.role,
      firstName: request.firstName,
      lastName: request.lastName,
      departmentId: request.departmentId,
    });
  }

  res.status(201).json({
    success: true,
    message: 'Your application is under review. You will be notified upon acceptance.',
    data: { status: 'PENDING', requestId: request.id },
  });
});

export const login = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const email = String(req.body.email || '')
    .trim()
    .toLowerCase();
  const { password } = req.body as LoginRequestBody;

  logger.info(`[AUTH] Login attempt for email: ${email}`);

  const registrationRequest = await prisma.registrationRequest.findUnique({
    where: { email },
  });

  if (registrationRequest?.status === 'PENDING') {
    return next(new AuthenticationError('Your application is under review.'));
  }

  if (registrationRequest?.status === 'REJECTED') {
    return next(new AuthenticationError('Your registration request was rejected.'));
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      student: true,
      doctor: true,
      managedCollege: { select: { id: true, name: true, nameAr: true } },
    },
  });

  logger.debug(`[AUTH] User search result: ${user ? 'Found' : 'Not Found'}`);

  if (!user || !(await bcrypt.compare(password as string, user.password))) {
    logger.warn(`[AUTH] Invalid login attempt for: ${email}`);
    return next(new AuthenticationError('Invalid email or password'));
  }

  if (user.isActive === false) {
    logger.warn(`[AUTH] Login attempt for deactivated user: ${email}`);
    return next(new AuthenticationError('Your account has been deactivated. Please contact support.'));
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
    const isValid = verifyTOTP(user.twoFactorSecret as string, totpToken);
    if (!isValid) {
      logger.warn(`[AUTH] Invalid 2FA token for: ${email}`);
      return next(new AuthenticationError('Invalid 2FA code'));
    }
  }

  logger.info(`[AUTH] Generating tokens for user: ${user.id}`);
  const accessToken = generateAccessToken(user.id, user.tokenVersion);
  const refreshToken = await generateRefreshToken(user.id);

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

// Map to track recently rotated refresh tokens to avoid multi-tab logout races
const rotatedTokens = new Map<string, { userId: number; tokenVersion: number; rotatedAt: number; user?: Record<string, any> }>();

// Periodically clean up expired keys (keep for 30s)
setInterval(() => {
  const now = Date.now();
  for (const [token, data] of rotatedTokens.entries()) {
    if (now - data.rotatedAt > 30000) {
      rotatedTokens.delete(token);
    }
  }
}, 30000);

class ConcurrentRotationError extends Error {
  public userId: number;
  public tokenVersion: number;
  constructor(userId: number, tokenVersion: number) {
    super('Concurrent rotation');
    this.userId = userId;
    this.tokenVersion = tokenVersion;
  }
}

export const refresh = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { refresh_token } = req.cookies;

  if (!refresh_token) {
    return next(new AuthenticationError('Refresh token missing'));
  }

  // Check if the token was rotated recently (within 15 seconds) by a concurrent request
  const rotatedInfo = rotatedTokens.get(refresh_token);
  if (rotatedInfo && Date.now() - rotatedInfo.rotatedAt < 15000) {
    logger.info(`[AUTH] Recently rotated token used (within 15s) for user: ${rotatedInfo.userId}. Returning fresh access token.`);
    const accessToken = generateAccessToken(rotatedInfo.userId, rotatedInfo.tokenVersion);
    return res.json({
      success: true,
      data: { accessToken, user: rotatedInfo.user },
    });
  }

  let userId: number | undefined;
  let tokenVersion: number | undefined;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const tokenDoc = await tx.refreshToken.findUnique({
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

      if (!tokenDoc) {
        const doubleCheckRotated = rotatedTokens.get(refresh_token);
        if (doubleCheckRotated && Date.now() - doubleCheckRotated.rotatedAt < 15000) {
          throw new ConcurrentRotationError(doubleCheckRotated.userId, doubleCheckRotated.tokenVersion);
        }
        throw new AuthenticationError('Invalid or expired refresh token');
      }

      if (tokenDoc.expiresAt < new Date()) {
        await tx.refreshToken.delete({ where: { id: tokenDoc.id } });
        throw new AuthenticationError('Invalid or expired refresh token');
      }

      userId = tokenDoc.user.id;
      tokenVersion = tokenDoc.user.tokenVersion;

      // Delete the old token
      await tx.refreshToken.delete({ where: { id: tokenDoc.id } });

      // Generate new refresh token
      const newRefreshToken = crypto.randomBytes(40).toString('hex');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30); // 30 days
      
      await tx.refreshToken.create({
        data: {
          token: newRefreshToken,
          userId: tokenDoc.user.id,
          expiresAt,
        },
      });

      const accessToken = generateAccessToken(tokenDoc.user.id, tokenDoc.user.tokenVersion);

      // Strip sensitive fields (matches getMe shape exactly)
      const { password: _password, twoFactorSecret: _secret, ...safeUser } = tokenDoc.user;
      const userData = { ...safeUser, twoFactorEnabled: tokenDoc.user.twoFactorEnabled };

      return { accessToken, newRefreshToken, user: userData };
    });

    // Successfully rotated - add to rotatedTokens map for concurrent protection
    if (userId !== undefined) {
      rotatedTokens.set(refresh_token, {
        userId,
        tokenVersion: tokenVersion || 0,
        rotatedAt: Date.now(),
        user: result.user,
      });
    }

    setAuthCookies(res, result.accessToken, result.newRefreshToken);

    return res.json({
      success: true,
      data: { accessToken: result.accessToken, user: result.user },
    });
  } catch (error: any) {
    if (error instanceof ConcurrentRotationError) {
      logger.info(`[AUTH] Concurrent refresh lookup detected for user: ${error.userId}. Returning fresh access token.`);
      const accessToken = generateAccessToken(error.userId, error.tokenVersion);
      const cachedInfo = rotatedTokens.get(refresh_token);
      return res.json({
        success: true,
        data: { accessToken, user: cachedInfo?.user },
      });
    }

    // If the record was not found during deletion (P2025), it means a concurrent request
    // already deleted and rotated this token.
    if (error.code === 'P2025' && userId !== undefined) {
      logger.info(`[AUTH] Concurrent refresh deletion detected for user: ${userId}. Returning fresh access token.`);
      
      rotatedTokens.set(refresh_token, {
        userId,
        tokenVersion: tokenVersion || 0,
        rotatedAt: Date.now(),
      });

      const accessToken = generateAccessToken(userId, tokenVersion || 0);
      return res.json({
        success: true,
        data: { accessToken, user: undefined },
      });
    }

    // Otherwise, propagate the error (e.g. 401 AuthenticationError)
    return next(error);
  }
});

export const logout = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { refresh_token } = req.cookies;
  if (refresh_token) {
    await prisma.refreshToken.deleteMany({ where: { token: refresh_token } });
  }

  // Increment tokenVersion to invalidate all access tokens for this user
  if (req.user?.id) {
    await prisma.user.update({
      where: { id: req.user.id },
      data: { tokenVersion: { increment: 1 } },
    });
  }

  const isProd = process.env.NODE_ENV === 'production';
  res.clearCookie('refresh_token', {
    path: '/',
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
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
    include: { department: { include: { college: true } } },
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

      if (request.role === 'STUDENT') {
        await tx.student.create({
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

      return user;
    });

    await createNotification({
      userId: result.id,
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

