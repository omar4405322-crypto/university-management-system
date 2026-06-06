const prisma = require('../utils/prismaClient');
const bcrypt = require('bcryptjs');
const { generateToken } = require('../utils/jwt.utils');
const { notifyAdminsOfNewRequest, createNotification } = require('../utils/notification.utils');
const catchAsync = require('../utils/catchAsync');
const { AppError, AuthenticationError, ConflictError, NotFoundError } = require('../utils/appError');

// FIXED: Public registration is student-only, pending approval, login blocked until approved - Phase 3
const register = catchAsync(async (req, res, next) => {
  const { email, password, role: requestedRole, firstName, lastName, departmentId, studentId, year, phone } = req.body;
  const role = 'STUDENT';
  if (requestedRole && requestedRole !== 'STUDENT') {
    return next(new AppError('Only student registration is available. Faculty accounts are created by administrators.', 400));
  }

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return next(new ConflictError('Email already registered'));
  }

  // Check if studentId already exists if it's a student
  if (role === 'STUDENT' && studentId) {
    const existingStudent = await prisma.student.findUnique({ where: { studentId } });
    if (existingStudent) {
      return next(new ConflictError('Student ID already exists'));
    }
  }

  // Check if request already exists
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

  // Notify relevant admins
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
    return next(
      new AuthenticationError(
        'Your application is under review. You will be notified upon acceptance.'
      )
    );
  }

  if (registrationRequest?.status === 'REJECTED') {
    return next(
      new AuthenticationError(
        'Your registration request was rejected. Please contact the administration office.'
      )
    );
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: { student: true, doctor: true },
  });

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return next(new AuthenticationError('Invalid email or password'));
  }

  const token = generateToken(user.id);

  res.json({
    success: true,
    data: {
      token,
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

const getMe = catchAsync(async (req, res, next) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: { student: true, doctor: true }
  });

  if (!user) {
    return next(new NotFoundError('User no longer exists'));
  }

  const { password: _password, ...safeUser } = user;

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

  // Scope filtering
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

  // Transaction to create user and profile
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
          doctorId: `DOC-${Date.now()}`, // Generate a temporary doctor ID
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
    message: 'Your registration request has been accepted. You can now sign in to the university portal.',
    type: 'success',
  });

  res.json({ success: true, message: 'Request approved successfully', data: result });
});

const rejectRequest = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const request = await prisma.registrationRequest.findUnique({
    where: { id: parseInt(id) },
  });

  if (!request) {
    return next(new NotFoundError('Request not found'));
  }

  await prisma.registrationRequest.update({
    where: { id: parseInt(id) },
    data: { status: 'REJECTED' },
  });

  res.json({
    success: true,
    message: 'Request rejected',
    data: {
      email: request.email,
      notified: false,
      note: 'Applicant will see rejection message if they attempt to log in.',
    },
  });
});

module.exports = {
  register,
  login,
  getMe,
  getRequests,
  approveRequest,
  rejectRequest
};
