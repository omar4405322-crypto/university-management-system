import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prismaClient';
import { auditLog } from '../utils/audit.utils';
import bcrypt from 'bcryptjs';

import catchAsync from '../utils/catchAsync';
import { AppError, NotFoundError, AuthorizationError, ValidationError } from '../utils/appError';
import { getScopeWhere } from '../utils/scope.utils';
import {
  getAdminMutationScopeWhere,
  getAdminMutationTargetWhere,
} from '../utils/adminMutationScope.utils';
import { TimetableService } from '../services/timetable.service';
import { replacePasswordAndRevokeAllUserSessions } from '../services/session.service';
import { assertPasswordStrength } from '../utils/passwordPolicy';

function assertTAScope(
  ta: {
    departmentId?: number | null;
    department?: { collegeId?: number | null } | null;
    scheduleSlots?: any[];
  },
  user: { role: string; managedCollegeId?: number | null; managedDepartmentId?: number | null }
): boolean {
  if (user.role === 'SUPER_ADMIN') return true;
  if (user.role === 'ADMIN') {
    if (!user.managedCollegeId) return false;
    if (ta.department?.collegeId === user.managedCollegeId) return true;
    if (ta.scheduleSlots?.some((s: any) => s.course?.department?.collegeId === user.managedCollegeId)) return true;
    return false;
  }
  if (user.role === 'COLLEGE_ADMIN') {
    if (ta.department?.collegeId === user.managedCollegeId) return true;
    if (ta.scheduleSlots?.some((s: any) => s.course?.department?.collegeId === user.managedCollegeId)) return true;
    return false;
  }
  if (user.role === 'DEPARTMENT_ADMIN') {
    if (ta.departmentId === user.managedDepartmentId) return true;
    if (ta.scheduleSlots?.some((s: any) => s.course?.departmentId === user.managedDepartmentId)) return true;
    return false;
  }
  return false;
}

export const getTAStats = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const scopeWhere: any = getScopeWhere(req.user!, 'teachingAssistant');

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

  const scopeWhere = getScopeWhere(req.user!, 'teachingAssistant');

  const queryFilters: any[] = [];
  if (status) {
    queryFilters.push({ status });
  }
  if (departmentId) {
    queryFilters.push({ departmentId: parseInt(departmentId, 10) });
  }
  if (search) {
    queryFilters.push({
      OR: [
        { employeeId: { contains: search, mode: 'insensitive' } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
        { specialization: { contains: search, mode: 'insensitive' } },
      ],
    });
  }

  const where = {
    AND: [
      scopeWhere,
      ...queryFilters,
    ],
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
      scheduleSlots: {
        include: {
          course: {
            include: {
              department: { include: { college: true } },
              _count: { select: { enrollments: true, scheduleSlots: true } }
            }
          }
        }
      }
    },
  });

  if (!ta) {
    return next(new NotFoundError('Teaching Assistant not found'));
  }

  if (!assertTAScope(ta, req.user!)) {
    return res.status(403).json({ message: 'Access denied' });
  }

  // Extract unique courses from schedule slots
  const courseMap = new Map<number, any>();
  ta.scheduleSlots.forEach((slot: any) => {
    if (slot.course && !courseMap.has(slot.course.id)) {
      courseMap.set(slot.course.id, {
        ...slot.course,
        studentCount: slot.course._count?.enrollments || 0,
        totalScheduledSlots: slot.course._count?.scheduleSlots || 0,
      });
    }
  });
  const taughtCourses = Array.from(courseMap.values());

  res.json({ success: true, data: { ...ta, taughtCourses } });
});

export const assignTACourse = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const taId = req.params.id as string;
  const { courseId, dayOfWeek, startTime, endTime, room, slotType } = req.body;

  if (!courseId) return next(new ValidationError('courseId is required'));

  const parsedCourseId = Number(courseId);
  if (!Number.isSafeInteger(parsedCourseId) || parsedCourseId <= 0) {
    return next(new ValidationError('courseId must be a positive integer'));
  }

  const ta = await prisma.teachingAssistant.findFirst({
    where: getAdminMutationTargetWhere(req.user!, 'teachingAssistant', taId),
    include: { department: true }
  });
  if (!ta) return next(new AuthorizationError('Teaching assistant is outside your managed scope'));

  const course = await prisma.course.findFirst({
    where: getAdminMutationTargetWhere(req.user!, 'course', parsedCourseId),
    include: { department: true }
  });
  if (!course) return next(new AuthorizationError('Course is outside your managed scope'));

  const existingSlot = await prisma.scheduleSlot.findFirst({
    where: { teachingAssistantId: taId, courseId: course.id }
  });

  const targetDay = (dayOfWeek || existingSlot?.dayOfWeek || 'MONDAY').toUpperCase();
  const targetStart = startTime || existingSlot?.startTime || '12:00';
  const targetEnd = endTime || existingSlot?.endTime || '14:00';
  const targetRoom = room !== undefined ? (room ? String(room).trim() : null) : (existingSlot?.room || null);
  const targetType = slotType || existingSlot?.slotType || 'TUTORIAL';

  // Check conflicts across university
  await TimetableService.checkConflicts({
    dayOfWeek: targetDay,
    startTime: targetStart,
    endTime: targetEnd,
    room: targetRoom,
    courseId: course.id,
    teachingAssistantId: taId,
    excludeSlotId: existingSlot?.id,
  });

  if (existingSlot) {
    await prisma.scheduleSlot.update({
      where: { id: existingSlot.id },
      data: {
        dayOfWeek: targetDay,
        startTime: targetStart,
        endTime: targetEnd,
        room: targetRoom,
        slotType: targetType,
      }
    });
  } else {
    let timetableId: number | undefined;
    if (course.departmentId) {
      const foundTb = await prisma.timetable.findFirst({
        where: {
          departmentId: course.departmentId,
          academicYear: course.year,
          semester: course.semester,
        }
      });
      if (foundTb) timetableId = foundTb.id;
    }

    await prisma.scheduleSlot.create({
      data: {
        courseId: course.id,
        teachingAssistantId: taId,
        slotType: targetType,
        dayOfWeek: targetDay,
        startTime: targetStart,
        endTime: targetEnd,
        room: targetRoom,
        timetableId,
      }
    });
  }

  auditLog('ASSIGN_TA_COURSE', 'TeachingAssistant', String(taId), req);

  res.json({
    success: true,
    message: `Successfully assigned ${ta.firstName || ''} ${ta.lastName || ''} to ${course.name} (${course.courseCode})`,
  });
});

export const unassignTACourse = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const taId = req.params.id as string;
  const courseId = Number(req.params.courseId);

  if (!taId || !Number.isSafeInteger(courseId) || courseId <= 0) {
    return next(new ValidationError('Teaching assistant and course IDs are required'));
  }

  const [teachingAssistant, course] = await Promise.all([
    prisma.teachingAssistant.findFirst({
      where: getAdminMutationTargetWhere(req.user!, 'teachingAssistant', taId),
      select: { id: true },
    }),
    prisma.course.findFirst({
      where: getAdminMutationTargetWhere(req.user!, 'course', courseId),
      select: { id: true },
    }),
  ]);

  if (!teachingAssistant || !course) {
    return next(new AuthorizationError('Teaching assistant or course is outside your managed scope'));
  }

  const deleted = await prisma.scheduleSlot.deleteMany({
    where: {
      teachingAssistantId: taId,
      courseId,
      teachingAssistant: {
        is: getAdminMutationScopeWhere(req.user!, 'teachingAssistant'),
      },
      course: { is: getAdminMutationScopeWhere(req.user!, 'course') },
    }
  });

  auditLog('UNASSIGN_TA_COURSE', 'TeachingAssistant', String(taId), req);

  res.json({
    success: true,
    message: `Removed ${deleted.count} assignments for course`,
  });
});

export const createTeachingAssistant = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  let { email, password, employeeId, specialization, departmentId, status, firstName, lastName } = req.body;
  assertPasswordStrength(password);

  // Enforce scope
  if (req.user!.role === 'ADMIN') {
    if (!req.user!.managedCollegeId) {
      return next(new AuthorizationError('Access denied: Unscoped admin cannot create teaching assistants'));
    }
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
    if (req.user!.role === 'ADMIN') {
      if (!req.user!.managedCollegeId) {
        return next(new AuthorizationError('Access denied: Unscoped admin cannot update teaching assistants'));
      }
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

  assertPasswordStrength(newPassword);

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

  await replacePasswordAndRevokeAllUserSessions(ta.userId, hashedPassword);

  auditLog('RESET_TEACHING_ASSISTANT_PASSWORD', 'TeachingAssistant', id, req);
  res.json({
    success: true,
    message: `Password reset successfully for TA ${ta.employeeId}`,
  });
});
