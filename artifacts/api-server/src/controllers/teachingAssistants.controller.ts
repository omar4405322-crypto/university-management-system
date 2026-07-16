import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prismaClient';
import { auditLog } from '../utils/audit.utils';
import bcrypt from 'bcryptjs';

import catchAsync from '../utils/catchAsync';
import { AppError, NotFoundError, AuthorizationError } from '../utils/appError';
import { getScopeWhere } from '../utils/scope.utils';

function assertTAScope(
  ta: { departmentId?: number | null; department?: { collegeId: number } | null },
  user: { role: string; managedCollegeId?: number | null; managedDepartmentId?: number | null }
): boolean {
  if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') return true;
  if (user.role === 'COLLEGE_ADMIN') {
    return ta.department?.collegeId === user.managedCollegeId;
  }
  if (user.role === 'DEPARTMENT_ADMIN') {
    return ta.departmentId === user.managedDepartmentId;
  }
  return false;
}

export const getTAStats = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const scopeWhere: any = getScopeWhere(req.user!);

  const [totalTAs, activeTAs, onLeaveTAs] = await Promise.all([
    prisma.teachingAssistant.count({ where: scopeWhere }),
    prisma.teachingAssistant.count({ where: { ...scopeWhere, status: 'ACTIVE' } }),
    prisma.teachingAssistant.count({ where: { ...scopeWhere, status: 'ON_LEAVE' } }),
  ]);

  res.json({
    success: true,
    data: {
      totalTAs,
      activeTAs,
      onLeaveTAs,
    },
  });
});

export const getSuggestedTeachingAssistants = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
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

  const allTAs = await prisma.teachingAssistant.findMany({
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

  const suggested = allTAs.map((ta) => {
    let tier = 4;
    let reason = 'Other';

    if (ta.scheduleSlots.length > 0) {
      tier = 1;
      reason = 'Previously Taught';
    } else if (ta.departmentId === course.departmentId) {
      tier = 2;
      reason = 'Same Department';
    } else if (ta.department?.collegeId && course.department?.collegeId && ta.department.collegeId === course.department.collegeId) {
      tier = 3;
      reason = 'Same College';
    }

    return {
      ...ta,
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

export const getAllTeachingAssistants = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { search = '', page = 1, limit = 10, departmentId, status } = req.query as Record<string, string>;
  const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
  const take = parseInt(limit as string);

  const scopeWhere: any = getScopeWhere(req.user!);

  const where: any = {
    ...scopeWhere,
    ...(status ? { status } : {}),
    ...(departmentId ? { departmentId: parseInt(departmentId) } : {}),
    ...(search
      ? {
          OR: [
            { employeeId: { contains: search, mode: 'insensitive' } },
            { user: { email: { contains: search, mode: 'insensitive' } } },
            { specialization: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [teachingAssistants, total] = await Promise.all([
    prisma.teachingAssistant.findMany({
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
      },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.teachingAssistant.count({ where }),
  ]);

  res.json({
    success: true,
    data: {
      teachingAssistants,
      total,
      page: parseInt(page as string),
      totalPages: Math.ceil(total / take),
    },
  });
});

export const getTeachingAssistantById = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const ta = await prisma.teachingAssistant.findUnique({
    where: { id: (req.params.id as string) },
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
    },
  });

  if (!ta) {
    return next(new NotFoundError('Teaching Assistant not found'));
  }

  if (!assertTAScope(ta, req.user!)) {
    return res.status(403).json({ message: 'Access denied' });
  }

  res.json({ success: true, data: ta });
});

export const createTeachingAssistant = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  let { email, password, employeeId, specialization, departmentId, status, firstName, lastName } = req.body;

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

  const existingTA = await prisma.teachingAssistant.findUnique({ where: { employeeId } });
  if (existingTA) {
    return next(new AppError('Employee ID already exists', 400));
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const result = await prisma.$transaction(async (tx: any) => {
    const user = await tx.user.create({
      data: {
        email,
        password: hashedPassword,
        role: 'TEACHING_ASSISTANT',
      },
    });

    const ta = await tx.teachingAssistant.create({
      data: {
        userId: user.id,
        firstName: firstName || 'TA',
        lastName: lastName || 'Staff',
        employeeId,
        specialization,
        status: status || 'ACTIVE',
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

    return ta;
  });

  res.status(201).json({ success: true, data: result });
});

export const updateTeachingAssistant = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { specialization, status, departmentId, firstName, lastName } = req.body;
  const id = (req.params.id as string);

  const ta = await prisma.teachingAssistant.findUnique({
    where: { id },
    include: { department: true },
  });

  if (!ta) {
    return next(new NotFoundError('Teaching Assistant not found'));
  }

  if (!assertTAScope(ta, req.user!)) {
    return res.status(403).json({ message: 'Access denied' });
  }

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
      return next(new AuthorizationError('Cannot move TA to another department'));
    } else if (req.user!.role === 'COLLEGE_ADMIN') {
      const newDept = await prisma.department.findUnique({
        where: { id: parseInt(departmentId as string) },
      });
      if (!newDept || newDept.collegeId !== req.user!.managedCollegeId) {
        return next(new AuthorizationError('Invalid department for your college'));
      }
    }
  }

  const updatedTA = await prisma.teachingAssistant.update({
    where: { id },
    data: {
      firstName,
      lastName,
      specialization,
      status,
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

  res.json({ success: true, data: updatedTA });
});

export const deleteTeachingAssistant = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const id = (req.params.id as string);
  const ta = await prisma.teachingAssistant.findUnique({
    where: { id },
    include: { department: true },
  });

  if (!ta) {
    return next(new NotFoundError('Teaching Assistant not found'));
  }

  if (!assertTAScope(ta, req.user!)) {
    return res.status(403).json({ message: 'Access denied' });
  }

  await prisma.$transaction(async (tx: any) => {
    await tx.teachingAssistant.delete({ where: { id: ta.id } });
    await tx.user.delete({ where: { id: ta.userId } });
  });

  auditLog('DELETE_TEACHING_ASSISTANT', 'TeachingAssistant', id, req);
  res.json({ success: true, message: 'Teaching Assistant deleted' });
});

export const resetTeachingAssistantPassword = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params as { id: string };
  const { newPassword } = req.body;

  if (!newPassword || newPassword.length < 6) {
    return next(new AppError('Password must be at least 6 characters', 400));
  }

  const ta = await prisma.teachingAssistant.findUnique({
    where: { id },
    include: {
      user: true,
      department: { select: { collegeId: true } },
    },
  });

  if (!ta) {
    return next(new NotFoundError('Teaching Assistant not found'));
  }

  if (!assertTAScope(ta, req.user!)) {
    return res.status(403).json({ message: 'Access denied' });
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: { id: ta.userId },
    data: { password: hashedPassword },
  });

  auditLog('RESET_TEACHING_ASSISTANT_PASSWORD', 'TeachingAssistant', id, req);
  res.json({
    success: true,
    message: `Password reset successfully for TA ${ta.employeeId}`,
  });
});

