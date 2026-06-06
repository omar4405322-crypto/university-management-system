const prisma = require('../utils/prismaClient');
const bcrypt = require('bcryptjs');
const { generateAccessToken, generateRefreshToken } = require('../utils/jwt.utils');
const { notifyAdminsOfNewRequest, createNotification } = require('../utils/notification.utils');
const catchAsync = require('../utils/catchAsync');
const { AppError, AuthenticationError, ConflictError, NotFoundError } = require('../utils/appError');

// Helper to set cookies
const setAuthCookies = (res, accessToken, refreshToken) => {
  // Access token in cookie for now (or could be returned in body for memory storage)
  // User input requested access token in memory, but for a scalable start we'll keep it in cookie 
  // or return in body. Let's return access token in body and refresh in cookie.
  
  res.cookie('refresh_token', refreshToken, { 
    httpOnly: true, 
    secure: process.env.NODE_ENV === 'production', 
    sameSite: 'strict', 
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    path: '/api/auth/refresh' // Only send to refresh endpoint
  });
};

const register = catchAsync(async (req, res, next) => {
  const { email, password, role: requestedRole, firstName, lastName, departmentId, studentId, year, phone } = req.body;
  const role = 'STUDENT';
  if (requestedRole && requestedRole !== 'STUDENT') {
    return next(new AppError('Only student registration is available. Faculty accounts are created by administrators.', 400));
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

  const hashedPassword = await bcrypt.hash(password, 10);

  const request = await prisma.registrationRequest.create({
    data: {
      email,
      password: hashedPassword,
      role,
      firstName,
      lastName,
      studentId: role === 'STUDENT' ? studentId : null,
      year: role === 'STUDENT' ? (year ? parseInt(year) : 1) : null,
      departmentId: departmentId ? parseInt(departmentId) : null,
      phone: phone?.trim() || null,
    }
  });

  if (request.departmentId) {
    await notifyAdminsOfNewRequest({
      role: request.role,
      firstName: request.firstName,
      lastName: request.lastName,
      departmentId: request.departmentId
    });
  }

  res.status(201).json({
    success: true,
    message: 'Your application is under review. You will be notified upon acceptance.',
    data: { status: 'PENDING', requestId: request.id },
  });
});

const login = catchAsync(async (req, res, next) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const { password } = req.body;

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
    include: { student: true, doctor: true },
  });

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return next(new AuthenticationError('Invalid email or password'));
  }

  if (user.twoFactorEnabled) { 
    const { totpToken } = req.body;
    if (!totpToken) { 
      return res.status(200).json({ 
        success: true, 
        requires2FA: true, 
        message: 'Please enter your 2FA code', 
      }); 
    } 
    const { verifyTOTP } = require('../utils/twoFactor.utils'); 
    const isValid = verifyTOTP(user.twoFactorSecret, totpToken); 
    if (!isValid) return next(new AuthenticationError('Invalid 2FA code')); 
  } 

  const accessToken = generateAccessToken(user.id, user.tokenVersion);
  const refreshToken = await generateRefreshToken(user.id);

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
      },
    },
  });
});

const refresh = catchAsync(async (req, res, next) => {
  const { refresh_token } = req.cookies;

  if (!refresh_token) {
    return next(new AuthenticationError('Refresh token missing'));
  }

  const tokenDoc = await prisma.refreshToken.findUnique({
    where: { token: refresh_token },
    include: { user: true }
  });

  if (!tokenDoc || tokenDoc.expiresAt < new Date()) {
    if (tokenDoc) await prisma.refreshToken.delete({ where: { id: tokenDoc.id } });
    return next(new AuthenticationError('Invalid or expired refresh token'));
  }

  const accessToken = generateAccessToken(tokenDoc.user.id, tokenDoc.user.tokenVersion);
  
  res.json({
    success: true,
    data: { accessToken }
  });
});

const logout = catchAsync(async (req, res, next) => { 
  const { refresh_token } = req.cookies;
  if (refresh_token) {
    await prisma.refreshToken.deleteMany({ where: { token: refresh_token } });
  }

  res.clearCookie('refresh_token', { path: '/api/auth/refresh' }); 
  res.json({ success: true, message: 'Logged out successfully' }); 
}); 

const getMe = catchAsync(async (req, res, next) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: { student: true, doctor: true }
  });

  if (!user) {
    return next(new NotFoundError('User no longer exists'));
  }

  const { password: _password, twoFactorSecret: _secret, ...safeUser } = user;

  res.json({
    success: true,
    data: {
      ...safeUser,
      twoFactorEnabled: user.twoFactorEnabled,
    },
  });
});

const getRequests = catchAsync(async (req, res, next) => {
  const { user } = req;
  const { status } = req.query;
  let where = {};
  if (status && status !== 'ALL') {
    where.status = status;
  }

  if (user.role === 'COLLEGE_ADMIN') {
    const admin = await prisma.user.findUnique({
      where: { id: user.id },
      include: { doctor: true }
    });
    if (admin.doctor && admin.doctor.departmentId) {
      const dept = await prisma.department.findUnique({
        where: { id: admin.doctor.departmentId }
      });
      where.department = { collegeId: dept.collegeId };
    }
  } else if (user.role === 'DEPARTMENT_ADMIN') {
    const admin = await prisma.user.findUnique({
      where: { id: user.id },
      include: { doctor: true }
    });
    if (admin.doctor) {
      where.departmentId = admin.doctor.departmentId;
    }
  }

  const requests = await prisma.registrationRequest.findMany({
    where,
    include: { department: { include: { college: true } } },
    orderBy: { createdAt: 'desc' }
  });

  res.json({ success: true, data: requests });
});

const approveRequest = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const request = await prisma.registrationRequest.findUnique({
    where: { id: parseInt(id) }
  });

  if (!request) {
    return next(new NotFoundError('Request not found'));
  }

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: request.email,
        password: request.password,
        role: request.role,
        departmentId: request.departmentId
      }
    });

    if (request.role === 'STUDENT') {
      await tx.student.create({
        data: {
          userId: user.id,
          firstName: request.firstName,
          lastName: request.lastName,
          studentId: request.studentId,
          year: request.year || 1,
          departmentId: request.departmentId,
          phone: request.phone || null,
        }
      });
    } else if (request.role === 'DOCTOR') {
      await tx.doctor.create({
        data: {
          userId: user.id,
          firstName: request.firstName,
          lastName: request.lastName,
          departmentId: request.departmentId
        }
      });
    }

    await tx.registrationRequest.update({
      where: { id: parseInt(id) },
      data: { status: 'APPROVED' }
    });

    return user;
  });

  await createNotification({
    userId: result.id,
    title: 'Registration Approved',
    message: 'Your registration request has been accepted.',
  });

  res.json({ success: true, message: 'Request approved successfully' });
});

const rejectRequest = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { reason } = req.body;

  await prisma.registrationRequest.update({
    where: { id: parseInt(id) },
    data: { status: 'REJECTED', rejectionReason: reason }
  });

  res.json({ success: true, message: 'Request rejected' });
});

module.exports = {
  register,
  login,
  refresh,
  logout,
  getMe,
  getRequests,
  approveRequest,
  rejectRequest,
};
