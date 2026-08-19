// FIXED: Student active status via bio flag + stats/toggle endpoints - Phase 2
import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prismaClient';
import { auditLog } from '../utils/audit.utils';
import catchAsync from '../utils/catchAsync';
import { AppError, NotFoundError, AuthorizationError } from '../utils/appError';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { invalidateCache } from '../utils/redis.utils';
import { getScopeWhere } from '../utils/scope.utils';
import { StudentGroupsService } from '../services/studentGroups.service';
import { AttendanceService } from '../services/attendance.service';
import { calculateStudentGpa } from '../utils/gpa.utils';

const mapStudentStatus = (student: any) => ({
  ...student,
  status: student.isActive ? 'active' : 'inactive',
});

function assertStudentScope(
  student: { departmentId: number | null; department?: { collegeId: number } | null },
  user: { role: string; managedCollegeId?: number | null; managedDepartmentId?: number | null }
): boolean {
  if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') return true;
  if (user.role === 'COLLEGE_ADMIN') {
    return student.department?.collegeId === user.managedCollegeId;
  }
  if (user.role === 'DEPARTMENT_ADMIN') {
    return student.departmentId === user.managedDepartmentId;
  }
  return false;
}

/**
 * @desc    Get all students with advanced filtering, sorting and pagination
 * @route   GET /api/students
 * @access  Private (Admin)
 */
export const getAllStudents = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const {
      search = '',
      page = 1,
      limit = 10,
      sortBy = 'enrolledAt',
      sortOrder = 'desc',
      year,
      departmentId,
      groupId,
      status,
      letter,
      gender,
    } = req.query as Record<string, string>;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    // Sorting whitelist
    const STUDENT_SORT_FIELDS = ['enrolledAt', 'firstName', 'lastName', 'year', 'studentId'];
    const safeSortBy = STUDENT_SORT_FIELDS.includes(sortBy) ? sortBy : 'enrolledAt';
    const safeSortOrder = ['asc', 'desc'].includes(sortOrder) ? (sortOrder as 'asc' | 'desc') : 'desc';

    // 1. Role-based scoping
    const scopeWhere: any = getScopeWhere(req.user!, 'student');

    // 2. Advanced Filtering
    const where: any = {
      ...scopeWhere,
      ...(year !== undefined && year !== '' && { year: parseInt(year as string) }),
      ...(departmentId !== undefined &&
        departmentId !== '' && { departmentId: parseInt(departmentId as string) }),
      ...(groupId !== undefined &&
        groupId !== '' &&
        (groupId === 'unassigned'
          ? { groupId: null }
          : { groupId: parseInt(groupId as string) })),
      ...(status === 'active' && { isActive: true }),
      ...(status === 'inactive' && { isActive: false }),
      ...(status === 'suspended' && { status: 'suspended' }),
      ...(gender && { gender }),
      ...(letter && {
        OR: [
          { firstName: { startsWith: letter, mode: 'insensitive' } },
          { lastName: { startsWith: letter, mode: 'insensitive' } },
        ],
      }),
      ...(search && {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { studentId: { contains: search, mode: 'insensitive' } },
          { user: { email: { contains: search, mode: 'insensitive' } } },
        ],
      }),
    };

    // Sort definition (multi-field for firstName/lastName)
    const orderBy =
      safeSortBy === 'firstName'
        ? [{ firstName: safeSortOrder }, { lastName: safeSortOrder }]
        : safeSortBy === 'lastName'
        ? [{ lastName: safeSortOrder }, { firstName: safeSortOrder }]
        : { [safeSortBy]: safeSortOrder };

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
            select: { id: true, name: true, nameAr: true, college: { select: { id: true, name: true, nameAr: true } } },
          },
          group: {
            include: { parentGroup: true },
          },
        },
        skip,
        take,
        orderBy,
      }),
      prisma.student.count({ where }),
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
  }
);

/**
 * @desc    Toggle student active/inactive status
 * @route   PATCH /api/students/:id/status
 * @access  Private (Admin)
 */
export const toggleStudentStatus = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const id = parseInt(req.params.id as string, 10);
    const student = await prisma.student.findUnique({
      where: { id },
      include: { department: { select: { collegeId: true } } },
    });

    if (!student) {
      return next(new NotFoundError('Student not found'));
    }

    if (!assertStudentScope(student, req.user!)) {
      return res.status(403).json({ message: 'Access denied: student belongs to a different scope' });
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

    if (updated.isActive) {
      await StudentGroupsService.assignStudentToGroup(updated);
    }

    auditLog('TOGGLE_STUDENT_STATUS', 'Student', req.params.id as string, req);
    res.json({
      success: true,
      data: mapStudentStatus(updated),
      message: makeInactive ? 'Student deactivated' : 'Student activated',
    });
  }
);

/**
 * @desc    Get student by ID
 * @route   GET /api/students/:id
 * @access  Private (Admin)
 */
export const getStudentById = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
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
          include: { college: true },
        },
        group: {
          include: { parentGroup: true },
        },
        enrollments: {
          select: {
            course: {
              select: { id: true, name: true, courseCode: true },
            },
          },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!student) {
      return next(new NotFoundError('Student record not found'));
    }

    if (!assertStudentScope(student, req.user!)) {
      return res.status(403).json({ message: 'Access denied: student belongs to a different scope' });
    }

    res.json({
      success: true,
      data: mapStudentStatus(student),
    });
  }
);

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

  await StudentGroupsService.assignStudentToGroup(newStudent);

  await invalidateCache('dashboard:*');

  res.status(201).json({
    success: true,
    data: newStudent,
    ...(isAutoGenerated && {
      temporaryPassword: tempPassword,
      notice: 'Share this password with the student. They should change it on first login.',
    }),
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
    select: { userId: true, departmentId: true, department: { select: { collegeId: true } } },
  });

  if (!student) {
    return next(new NotFoundError('Student not found'));
  }

  if (!assertStudentScope(student, req.user!)) {
    return res.status(403).json({ message: 'Access denied: student belongs to a different scope' });
  }

  const updatedStudent = await prisma.$transaction(async (tx: any) => {
    if (email) {
      await tx.user.update({
        where: { id: student.userId },
        data: { email },
      });
    }

    return tx.student.update({
      where: { id: parseInt(id as string) },
      data: {
        ...updateData,
        departmentId:
          updateData.departmentId !== undefined && updateData.departmentId !== ''
            ? parseInt(updateData.departmentId)
            : undefined,
        year:
          updateData.year !== undefined && updateData.year !== ''
            ? parseInt(updateData.year)
            : undefined,
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
    select: { userId: true, departmentId: true, department: { select: { collegeId: true } } },
  });

  if (!student) {
    return next(new NotFoundError('Student not found'));
  }

  if (!assertStudentScope(student, req.user!)) {
    return res.status(403).json({ message: 'Access denied: student belongs to a different scope' });
  }

  await prisma.$transaction(async (tx: any) => {
    // Delete in order: many-to-many first, then direct relations, then student, then user
    await tx.student.update({
      where: { id: parseInt(id as string) },
      data: {
        enrollments: { deleteMany: {} },
      },
    }); // Clear M2M

    await tx.attendance.deleteMany({ where: { studentId: parseInt(id as string) } });
    await tx.payment.deleteMany({ where: { studentId: parseInt(id as string) } });
    await tx.quizSubmission.deleteMany({ where: { studentId: parseInt(id as string) } });
    await tx.taskSubmission.deleteMany({ where: { studentId: parseInt(id as string) } });

    const successMetric = await tx.studentSuccessMetric.findUnique({
      where: { studentId: parseInt(id as string) },
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
    message: 'Student and associated user account deleted',
  });
});

/**
 * @desc    Reset student password
 * @route   PATCH /api/students/:id/reset-password
 * @access  Private (Admin)
 */
export const resetStudentPassword = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { password, newPassword: bodyNewPassword } = req.body;
    const providedPassword = bodyNewPassword || password;

    const student = await prisma.student.findUnique({
      where: { id: parseInt(id as string) },
      select: {
        id: true,
        userId: true,
        firstName: true,
        lastName: true,
        departmentId: true,
        department: { select: { collegeId: true } },
      },
    });

    if (!student) {
      return next(new NotFoundError('Student not found'));
    }

    if (!assertStudentScope(student, req.user!)) {
      return res.status(403).json({ message: 'Access denied: student belongs to a different scope' });
    }

    const isAutoGenerated = !providedPassword;
    const finalPassword = isAutoGenerated ? crypto.randomBytes(12).toString('base64url') : providedPassword;
    const hashedPassword = await bcrypt.hash(finalPassword, 10);

    await prisma.user.update({
      where: { id: student.userId },
      data: {
        password: hashedPassword,
        tokenVersion: { increment: 1 },
      },
    });

    auditLog('RESET_STUDENT_PASSWORD', 'Student', req.params.id as string, req);
    res.json({
      success: true,
      message: `Password reset successfully for ${student.firstName} ${student.lastName}`,
      ...(isAutoGenerated && { temporaryPassword: finalPassword }),
    });
  }
);

/**
 * @route   GET /api/students/:id/statistics
 * @desc    Get consolidated student statistics (attendance, academics, projects)
 * @access  Private (STUDENT for self, DOCTOR/ADMIN for scoped students)
 */
export const getStudentStatistics = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const user = req.user!;

    let numericStudentId: number;

    if (id === 'me') {
      if (user.role !== 'STUDENT') {
        throw new AuthorizationError('The "me" parameter is only available for student accounts');
      }
      const student = await prisma.student.findUnique({
        where: { userId: user.id },
        select: { id: true },
      });
      if (!student) {
        throw new NotFoundError('Student profile not found');
      }
      numericStudentId = student.id;
    } else {
      numericStudentId = parseInt(id as string, 10);
      if (isNaN(numericStudentId)) {
        throw new AppError('Invalid student ID format', 400);
      }
    }

    // Single-record scope authorization check
    if (user.role === 'STUDENT') {
      const myStudent = await prisma.student.findUnique({
        where: { userId: user.id },
        select: { id: true },
      });
      if (!myStudent || myStudent.id !== numericStudentId) {
        throw new AuthorizationError('Access denied: You can only view your own statistics');
      }
    } else {
      // DOCTOR / ADMIN / SUPER_ADMIN scope check
      const studentScope = getScopeWhere(user, 'student');
      const studentRecord = await prisma.student.findFirst({
        where: {
          AND: [
            { id: numericStudentId },
            studentScope,
          ],
        },
      });
      if (!studentRecord) {
        throw new AuthorizationError('Access denied: You are not authorized to view this student\'s statistics');
      }
    }

    // Re-use AttendanceService.getStudentAttendance to ensure single source of truth for formula & metrics
    const [attendanceData, gpaData, studentProfile] = await Promise.all([
      AttendanceService.getStudentAttendance(
        user,
        numericStudentId,
        undefined,
        1,
        1000
      ),
      calculateStudentGpa(numericStudentId),
      prisma.student.findUnique({
        where: { id: numericStudentId },
        select: {
          id: true,
          studentId: true,
          firstName: true,
          lastName: true,
          year: true,
          department: { select: { id: true, name: true, nameAr: true } },
          user: { select: { email: true, profilePicture: true } },
        },
      }),
    ]);

    return res.json({
      success: true,
      data: {
        student: studentProfile,
        attendance: {
          rate: attendanceData.stats.percentage,
          totalSessions: attendanceData.stats.total,
          present: attendanceData.stats.PRESENT,
          late: attendanceData.stats.LATE,
          absent: attendanceData.stats.ABSENT,
          excused: attendanceData.stats.EXCUSED,
        },
        academics: {
          cumulativeGpa: gpaData.cumulativeGpa,
          gpaString: gpaData.gpaString,
          totalCreditsEarned: gpaData.totalCreditsEarned,
          totalCreditsAttempted: gpaData.totalCreditsAttempted,
          totalPoints: gpaData.totalPoints,
          coursesCount: gpaData.coursesCount,
          courses: gpaData.courses,
        },
        projects: null,
      },
    });
  }
);
