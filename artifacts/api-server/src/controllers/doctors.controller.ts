// FIXED: Live stats endpoint for doctors dashboard cards - Phase 2
import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prismaClient';
import { auditLog } from '../utils/audit.utils';
import bcrypt from 'bcryptjs';

import catchAsync from '../utils/catchAsync';
import { AppError, NotFoundError, AuthorizationError } from '../utils/appError';

import { getScopeWhere } from '../utils/scope.utils';

function assertDoctorScope(
  doctor: { departmentId?: number | null; department?: { collegeId: number } | null },
  user: { role: string; managedCollegeId?: number | null; managedDepartmentId?: number | null }
): boolean {
  if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') return true;
  if (user.role === 'COLLEGE_ADMIN') {
    return doctor.department?.collegeId === user.managedCollegeId;
  }
  if (user.role === 'DEPARTMENT_ADMIN') {
    return doctor.departmentId === user.managedDepartmentId;
  }
  return false;
}

export const getDoctorStats = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const scopeWhere: any = getScopeWhere(req.user!);
    const courseWhere: any = {};
    if (req.user!.role === 'ADMIN' && req.user!.managedCollegeId) {
      courseWhere.department = { collegeId: req.user!.managedCollegeId };
    } else if (req.user!.role === 'COLLEGE_ADMIN') {
      courseWhere.department = { collegeId: req.user!.managedCollegeId };
    } else if (req.user!.role === 'DEPARTMENT_ADMIN') {
      courseWhere.departmentId = req.user!.managedDepartmentId;
    }

    const [totalFaculty, activeProfessors, totalCourses, researchProjects] = await Promise.all([
      prisma.doctor.count({ where: scopeWhere }),
      prisma.doctor.count({
        where: { ...scopeWhere, courses: { some: {} } },
      }),
      prisma.course.count({ where: courseWhere }),
      prisma.task.count({
        where: Object.keys(scopeWhere).length ? { doctor: scopeWhere } : {},
      }),
    ]);

    res.json({
      success: true,
      data: {
        totalFaculty,
        activeProfessors,
        totalCourses,
        researchProjects,
      },
    });
  }
);

export const getSuggestedDoctors = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { courseId } = req.query;
  if (!courseId) {
    return next(new AppError('courseId is required', 400));
  }

  const course = await prisma.course.findUnique({
    where: { id: parseInt(courseId as string) },
    include: { department: true },
  });

  if (!course) {
    return next(new NotFoundError('Course not found'));
  }

  const scopeWhere: any = getScopeWhere(req.user!);

  const allDoctors = await prisma.doctor.findMany({
    where: scopeWhere,
    include: {
      user: {
        select: {
          email: true,
          role: true,
        },
      },
      department: {
        include: { college: true },
      },
      scheduleSlots: {
        where: { courseId: course.id },
      },
    },
  });

  const suggested = allDoctors.map((doc) => {
    let tier = 4;
    let reason = 'Other';

    if (doc.scheduleSlots.length > 0) {
      tier = 1;
      reason = 'Previously Taught';
    } else if (doc.departmentId === course.departmentId) {
      tier = 2;
      reason = 'Same Department';
    } else if (doc.department?.collegeId && course.department?.collegeId && doc.department.collegeId === course.department.collegeId) {
      tier = 3;
      reason = 'Same College';
    }

    return {
      ...doc,
      tier,
      reason,
    };
  });

  suggested.sort((a, b) => a.tier - b.tier);

  res.json({
    success: true,
    data: suggested,
  });
});

export const getAllDoctors = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { search = '', page = 1, limit = 10 } = req.query as Record<string, string>;
  const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
  const take = parseInt(limit as string);

  const scopeWhere: any = getScopeWhere(req.user!);

  const where: any = {
    ...scopeWhere,
    ...(search
      ? {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { doctorId: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [doctors, total] = await Promise.all([
    prisma.doctor.findMany({
      where,
      include: {
        user: {
          select: {
            email: true,
            role: true,
          },
        },
        department: {
          include: { college: true },
        },
        _count: {
          select: { scheduleSlots: true },
        },
      },
      skip,
      take,
      orderBy: { id: 'desc' },
    }),
    prisma.doctor.count({ where }),
  ]);

  res.json({
    success: true,
    data: {
      doctors,
      total,
      page: parseInt(page as string),
      totalPages: Math.ceil(total / take),
    },
  });
});

export const getDoctorById = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const doctor = await prisma.doctor.findUnique({
    where: { id: parseInt(req.params.id as string) },
    include: {
      user: {
        select: {
          email: true,
          role: true,
        },
      },
      department: {
        include: { college: true },
      },
      scheduleSlots: true,
    },
  });

  if (!doctor) {
    return next(new NotFoundError('Doctor not found'));
  }

  if (!assertDoctorScope(doctor, req.user!)) {
    return res.status(403).json({ message: 'Access denied: doctor belongs to a different scope' });
  }

  res.json({ success: true, data: doctor });
});

export const createDoctor = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  let { email, password, firstName, lastName, doctorId, phone, specialty, departmentId } = req.body;

  // Enforce scope
  if (req.user!.role === 'ADMIN' && req.user!.managedCollegeId) {
    if (departmentId) {
      const dept = await prisma.department.findUnique({
        where: { id: parseInt(departmentId as string) },
      });
      if (!dept || dept.collegeId !== req.user!.managedCollegeId) {
        return next(new AuthorizationError('Invalid department for your college'));
      }
    }
  } else if (req.user!.role === 'DEPARTMENT_ADMIN') {
    departmentId = req.user!.managedDepartmentId;
  } else if (req.user!.role === 'COLLEGE_ADMIN') {
    if (departmentId) {
      const dept = await prisma.department.findUnique({
        where: { id: parseInt(departmentId as string) },
      });
      if (!dept || dept.collegeId !== req.user!.managedCollegeId) {
        return next(new AuthorizationError('Invalid department for your college'));
      }
    }
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return next(new AppError('Email already exists', 400));
  }

  const existingDoctor = await prisma.doctor.findUnique({ where: { doctorId } });
  if (existingDoctor) {
    return next(new AppError('Doctor ID already exists', 400));
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const result = await prisma.$transaction(async (tx: any) => {
    const user = await tx.user.create({
      data: {
        email,
        password: hashedPassword,
        role: 'DOCTOR',
      },
    });

    const doctor = await tx.doctor.create({
      data: {
        userId: user.id,
        firstName,
        lastName,
        doctorId,
        phone,
        specialty,
        departmentId:
          departmentId !== undefined && departmentId !== ''
            ? parseInt(departmentId as string)
            : null,
      },
      include: {
        user: {
          select: {
            email: true,
            role: true,
          },
        },
        department: true,
      },
    });

    return doctor;
  });

  res.status(201).json({ success: true, data: result });
});

export const updateDoctor = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { firstName, lastName, phone, specialty, departmentId } = req.body;
  const id = parseInt(req.params.id as string);

  // Find doctor first to check scope
  const doctor = await prisma.doctor.findUnique({
    where: { id },
    include: { department: true },
  });

  if (!doctor) {
    return next(new NotFoundError('Doctor not found'));
  }

  if (!assertDoctorScope(doctor, req.user!)) {
    return res.status(403).json({ message: 'Access denied: doctor belongs to a different scope' });
  }

  // If changing department, check scope for new department
  if (departmentId) {
    if (req.user!.role === 'ADMIN' && req.user!.managedCollegeId) {
      const newDept = await prisma.department.findUnique({
        where: { id: parseInt(departmentId as string) },
      });
      if (!newDept || newDept.collegeId !== req.user!.managedCollegeId) {
        return next(new AuthorizationError('Invalid department for your college'));
      }
    } else if (
      req.user!.role === 'DEPARTMENT_ADMIN' &&
      parseInt(departmentId as string) !== req.user!.managedDepartmentId
    ) {
      return next(new AuthorizationError('Cannot move doctor to another department'));
    } else if (req.user!.role === 'COLLEGE_ADMIN') {
      const newDept = await prisma.department.findUnique({
        where: { id: parseInt(departmentId as string) },
      });
      if (!newDept || newDept.collegeId !== req.user!.managedCollegeId) {
        return next(new AuthorizationError('Invalid department for your college'));
      }
    }
  }

  const updatedDoctor = await prisma.doctor.update({
    where: { id },
    data: {
      firstName,
      lastName,
      phone,
      specialty,
      departmentId:
        departmentId !== undefined && departmentId !== ''
          ? parseInt(departmentId as string)
          : undefined,
    },
    include: {
      user: {
        select: {
          email: true,
          role: true,
        },
      },
      department: true,
    },
  });

  res.json({ success: true, data: updatedDoctor });
});

export const deleteDoctor = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const id = parseInt(req.params.id as string);
  const doctor = await prisma.doctor.findUnique({
    where: { id },
    include: { department: true, scheduleSlots: true, quizzes: true, tasks: true },
  });

  if (!doctor) {
    return next(new NotFoundError('Doctor not found'));
  }

  if (!assertDoctorScope(doctor, req.user!)) {
    return res.status(403).json({ message: 'Access denied: doctor belongs to a different scope' });
  }

  let blockingItems = [];
  if (doctor.scheduleSlots && doctor.scheduleSlots.length > 0) {
    blockingItems.push(`${doctor.scheduleSlots.length} active schedule slots`);
  }
  if (doctor.quizzes && doctor.quizzes.length > 0) {
    blockingItems.push(`${doctor.quizzes.length} active quizzes`);
  }
  if (doctor.tasks && doctor.tasks.length > 0) {
    blockingItems.push(`${doctor.tasks.length} active tasks`);
  }

  if (blockingItems.length > 0) {
    return next(new AppError(`Cannot delete doctor: This doctor has ${blockingItems.join(' and ')}. Reassign them before deletion.`, 400));
  }

  await prisma.$transaction(async (tx: any) => {


    await tx.doctor.delete({ where: { id: doctor.id } });
    await tx.user.delete({ where: { id: doctor.userId } });
  });

  auditLog('DELETE_DOCTOR', 'Doctor', req.params.id as string, req);
  res.json({ success: true, message: 'Doctor deleted' });
});

export const resetDoctorPassword = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return next(new AppError('Password must be at least 6 characters', 400));
    }

    const doctor = await prisma.doctor.findUnique({
      where: { id: parseInt(id as string) },
      include: {
        user: true,
        department: { select: { collegeId: true } },
      },
    });

    if (!doctor) {
      return next(new NotFoundError('Doctor not found'));
    }

    if (!assertDoctorScope(doctor, req.user!)) {
      return res.status(403).json({ message: 'Access denied: doctor belongs to a different scope' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: doctor.userId },
      data: { password: hashedPassword },
    });

    auditLog('RESET_DOCTOR_PASSWORD', 'Doctor', req.params.id as string, req);
    res.json({
      success: true,
      message: `Password reset successfully for ${doctor.firstName} ${doctor.lastName}`,
    });
  }
);
