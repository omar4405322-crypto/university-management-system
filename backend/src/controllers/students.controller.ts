// FIXED: Student active status via bio flag + stats/toggle endpoints - Phase 2
import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prismaClient.js';
import { auditLog } from '../utils/audit.utils.js';
import catchAsync from '../utils/catchAsync.js';
import { AppError, NotFoundError } from '../utils/appError.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { invalidateCache } from '../utils/redis.utils.js';
import { getScopeWhere } from '../utils/scope.utils.js';

const mapStudentStatus = (student: any) => ({
  ...student,
  status: student.isActive ? 'active' : 'inactive',
});

/**
 * @desc    Get all students with advanced filtering, sorting and pagination
 * @route   GET /api/students
 * @access  Private (Admin)
 */
export const getAllStudents = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { 
    search = '', 
    page = 1, 
    limit = 10, 
    sortBy = 'enrolledAt', 
    sortOrder = 'desc',
    year,
    departmentId,
    gender
  } = req.query as Record<string, string>;

  const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
  const take = parseInt(limit as string);

  // Sorting whitelist
  const STUDENT_SORT_FIELDS = ['enrolledAt', 'firstName', 'lastName', 'year', 'studentId']; 
  const safeSortBy = STUDENT_SORT_FIELDS.includes(sortBy) ? sortBy : 'enrolledAt'; 
  const safeSortOrder = ['asc', 'desc'].includes(sortOrder) ? sortOrder : 'desc'; 

  // 1. Role-based scoping
  const scopeWhere: any = getScopeWhere(req.user!, 'student');

  // 2. Advanced Filtering
  const where: any = {
    ...scopeWhere,
    ...(year && { year: parseInt(year as string) }),
    ...(departmentId && { departmentId: parseInt(departmentId as string) }),
    ...(gender && { gender }),
    ...(search && {
      OR: [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { studentId: { contains: search, mode: 'insensitive' } },
        { user: { email: { contains: search, mode: 'insensitive' } } }
      ],
    }),
  };

  // 3. Optimized parallel execution
  const [students, filteredTotal] = await Promise.all([
    prisma.student.findMany({
      where,
      include: {
        user: {
          select: {
            email: true,
            profilePicture: true,
          },
        },
        department: {
          select: { name: true, college: { select: { name: true } } }
        }
      },
      skip,
      take,
      orderBy: { [safeSortBy]: safeSortOrder },
    }),
    prisma.student.count({ where })
  ]);

  const activeWhere = {
    ...scopeWhere,
    isActive: true,
  };
  const inactiveWhere = { ...scopeWhere, isActive: false };

  const [statsTotal, active, pending, inactive] = await Promise.all([
    prisma.student.count({ where: scopeWhere }),
    prisma.student.count({ where: activeWhere }),
    prisma.registrationRequest.count({
      where: {
        status: 'PENDING',
        ...(scopeWhere.departmentId && { departmentId: scopeWhere.departmentId }),
        ...(scopeWhere.department && { department: scopeWhere.department }),
      },
    }),
    prisma.student.count({ where: inactiveWhere }),
  ]);

  res.json({
    success: true,
    data: {
      students: students.map(mapStudentStatus),
      pagination: {
        total: filteredTotal,
        page: parseInt(page as string),
        limit: take,
        totalPages: Math.ceil(filteredTotal / take),
      },
      stats: {
        total: statsTotal,
        active,
        pending,
        inactive,
      },
      totalPages: Math.ceil(filteredTotal / take),
    },
  });
});

/**
 * @desc    Toggle student active/inactive status
 * @route   PATCH /api/students/:id/status
 * @access  Private (Admin)
 */
export const toggleStudentStatus = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const id = parseInt(req.params.id as string, 10);
  const student = await prisma.student.findUnique({ where: { id } });

  if (!student) {
    return next(new NotFoundError('Student not found'));
  }

  const makeInactive = student.isActive;
  const updated = await prisma.student.update({
    where: { id },
    data: {
      isActive: !makeInactive,
    },
    include: {
      user: { select: { email: true, profilePicture: true } },
      department: { select: { name: true, college: { select: { name: true } } } },
    },
  });

  auditLog('TOGGLE_STUDENT_STATUS', 'Student', req.params.id as string, req);
  res.json({
    success: true,
    data: mapStudentStatus(updated),
    message: makeInactive ? 'Student deactivated' : 'Student activated',
  });
});

/**
 * @desc    Get student by ID
 * @route   GET /api/students/:id
 * @access  Private (Admin)
 */
export const getStudentById = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const student = await prisma.student.findUnique({
    where: { id: parseInt(req.params.id as string) },
    include: {
      user: {
        select: {
          email: true,
          role: true,
          profilePicture: true,
        },
      },
      department: {
        include: { college: true }
      },
      courses: {
        select: { id: true, name: true, courseCode: true }
      },
      payments: {
        orderBy: { createdAt: 'desc' },
        take: 5
      }
    },
  });

  if (!student) {
    return next(new NotFoundError('Student record not found'));
  }

  res.json({
    success: true,
    data: mapStudentStatus(student),
  });
});

/**
 * @desc    Create new student
 * @route   POST /api/students
 * @access  Private (Admin)
 */
export const createStudent = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { email, password, collegeId: _collegeId, ...studentData } = req.body;
  
  const isAutoGenerated = !password;
  const tempPassword = isAutoGenerated ? crypto.randomBytes(12).toString('base64url') : password;
  const hashedPassword = await bcrypt.hash(tempPassword, 10);

  const newStudent = await prisma.$transaction(async (tx: any) => {
    const user = await tx.user.create({
      data: {
        email,
        password: hashedPassword,
        role: 'STUDENT',
      },
    });

    return tx.student.create({
      data: {
        ...studentData,
        userId: user.id,
        departmentId: parseInt(studentData.departmentId),
        year: parseInt(studentData.year),
      },
    });
  });

  await invalidateCache('dashboard:*');

  res.status(201).json({
    success: true,
    data: newStudent,
    ...(isAutoGenerated && { 
      temporaryPassword: tempPassword, 
      notice: 'Share this password with the student. They should change it on first login.' 
    })
  });
});

/**
 * @desc    Update student
 * @route   PUT /api/students/:id
 * @access  Private (Admin)
 */
export const updateStudent = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const { email, ...updateData } = req.body;

  const student = await prisma.student.findUnique({
    where: { id: parseInt(id as string) },
    select: { userId: true }
  });

  if (!student) {
    return next(new NotFoundError('Student not found'));
  }

  const updatedStudent = await prisma.$transaction(async (tx: any) => {
    if (email) {
      await tx.user.update({
        where: { id: student.userId },
        data: { email }
      });
    }

    return tx.student.update({
      where: { id: parseInt(id as string) },
      data: {
        ...updateData,
        departmentId: updateData.departmentId ? parseInt(updateData.departmentId) : undefined,
        year: updateData.year ? parseInt(updateData.year) : undefined,
      },
    });
  });

  res.json({
    success: true,
    data: updatedStudent,
  });
});

/**
 * @desc    Delete student
 * @route   DELETE /api/students/:id
 * @access  Private (Admin)
 */
export const deleteStudent = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  
  const student = await prisma.student.findUnique({
    where: { id: parseInt(id as string) },
    select: { userId: true }
  });

  if (!student) {
    return next(new NotFoundError('Student not found'));
  }

  await prisma.$transaction(async (tx: any) => { 
    // Delete in order: many-to-many first, then direct relations, then student, then user 
    await tx.student.update({ 
      where: { id: parseInt(id as string) }, 
      data: { 
        enrollments: { deleteMany: {} } 
      }
    }); // Clear M2M 
    
    await tx.attendance.deleteMany({ where: { studentId: parseInt(id as string) } }); 
    await tx.payment.deleteMany({ where: { studentId: parseInt(id as string) } }); 
    await tx.quizSubmission.deleteMany({ where: { studentId: parseInt(id as string) } }); 
    await tx.taskSubmission.deleteMany({ where: { studentId: parseInt(id as string) } }); 
    
    const successMetric = await tx.studentSuccessMetric.findUnique({ 
      where: { studentId: parseInt(id as string) } 
    });
    if (successMetric) { 
      await tx.studentSuccessMetric.delete({ where: { studentId: parseInt(id as string) } }); 
    } 
    
    await tx.student.delete({ where: { id: parseInt(id as string) } }); 
    await tx.user.delete({ where: { id: student.userId } }); 
  }); 

  await invalidateCache('dashboard:*');

  auditLog('DELETE_STUDENT', 'Student', req.params.id as string, req);
  res.json({
    success: true,
    message: 'Student and associated user account deleted'
  });
});

/**
 * @desc    Reset student password
 * @route   PATCH /api/students/:id/reset-password
 * @access  Private (Admin)
 */
export const resetStudentPassword = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const { password } = req.body;

  const student = await prisma.student.findUnique({
    where: { id: parseInt(id as string) },
    select: { userId: true }
  });

  if (!student) {
    return next(new NotFoundError('Student not found'));
  }

  const isAutoGenerated = !password;
  const newPassword = isAutoGenerated ? crypto.randomBytes(12).toString('base64url') : password;
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: { id: student.userId },
    data: {
      password: hashedPassword,
      tokenVersion: { increment: 1 }
    }
  });

  auditLog('RESET_STUDENT_PASSWORD', 'Student', req.params.id as string, req);
  res.json({
    success: true,
    message: 'Password reset successfully',
    ...(isAutoGenerated && { temporaryPassword: newPassword })
  });
});
