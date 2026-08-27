import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prismaClient';
import { auditLog } from '../utils/audit.utils';
import { getScopeWhere } from '../utils/scope.utils';
import catchAsync from '../utils/catchAsync';
import { NotFoundError, AuthorizationError, AppError, ConflictError, ValidationError } from '../utils/appError';
import { TimetableService } from '../services/timetable.service';
import { Prisma } from '@prisma/client';

export const getWeeklyTimetable = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { departmentId, collegeId, year, semester, timetableId, doctorId, teachingAssistantId } = req.query as Record<string, string>;
    const { user } = req;

    const filterYear = year ? parseInt(year) : undefined;
    const filterSemester = semester ? parseInt(semester) : undefined;

    let scheduleSlots: any[] = [];
    let whereClause: any = {};

    const includeRelations = {
      course: {
        select: {
          id: true,
          name: true,
          courseCode: true,
          year: true,
          semester: true,
          department: {
            select: {
              id: true,
              name: true,
              college: { select: { id: true, name: true } }
            }
          }
        }
      },
      doctor: {
        select: { id: true, firstName: true, lastName: true, user: { select: { email: true, role: true } } }
      },
      group: {
        select: { id: true, name: true }
      },
      teachingAssistant: {
        select: { id: true, firstName: true, lastName: true, employeeId: true, user: { select: { email: true, role: true } } }
      },
      overrides: {
        where: {
          startDate: { lte: new Date() },
          endDate: { gte: new Date() }
        },
        include: {
          doctor: { select: { id: true, firstName: true, lastName: true, user: { select: { email: true, role: true } } } },
          teachingAssistant: { select: { id: true, firstName: true, lastName: true, employeeId: true, user: { select: { email: true, role: true } } } }
        }
      }
    };

    if (user!.role === 'STUDENT') {
      const student = await prisma.student.findUnique({
        where: { userId: user!.id },
        select: { id: true, groupId: true, departmentId: true, year: true },
      });

      if (!student) {
        return res.json({ success: true, data: [] });
      }

      const enrollments = await prisma.enrollment.findMany({
        where: { studentId: student.id, status: 'ENROLLED' },
        select: { courseId: true }
      });
      const enrolledCourseIds = enrollments.map(e => e.courseId);

      // Build semester/year constraints scoped to the student's own profile
      // (filterYear/filterSemester are admin/external overrides, not used for students)
      const studentYearFilter = student.year;
      const baseCourseFilter: any = { departmentId: student.departmentId, year: studentYearFilter };
      if (filterSemester !== undefined) baseCourseFilter.semester = filterSemester;

      if (student.groupId) {
        // Get all ancestor group IDs (the student's group + all parents)
        const groupIds: number[] = [];
        let currentGroupId: number | null = student.groupId;
        while (currentGroupId) {
          groupIds.push(currentGroupId);
          const group: any = await prisma.studentGroup.findUnique({
            where: { id: currentGroupId },
            select: { parentGroupId: true }
          });
          currentGroupId = group?.parentGroupId ?? null;
        }

        // Build enrolled course filter (with optional semester)
        const enrolledCourseFilter: any = { id: { in: enrolledCourseIds } };
        if (filterSemester !== undefined) enrolledCourseFilter.semester = filterSemester;

        whereClause = {
          OR: [
            // Slots assigned to this student's group (or parent groups)
            { groupId: { in: groupIds } },
            // Department-wide slots (no group) matching student's year (+ semester if filtered)
            { groupId: null, course: { ...baseCourseFilter } },
            // Slots for explicitly enrolled courses (no group) with optional semester
            { groupId: null, course: enrolledCourseFilter },
          ]
        };
      } else {
        // Student has no group — show all slots for their department/year and enrolled courses
        const enrolledCourseFilter: any = { id: { in: enrolledCourseIds } };
        if (filterSemester !== undefined) enrolledCourseFilter.semester = filterSemester;

        whereClause = {
          OR: [
            { course: { ...baseCourseFilter } },
            { course: enrolledCourseFilter },
          ]
        };
      }
      // Prevent year/semester from being re-applied below for students (already baked in above)
      Object.defineProperty(whereClause, '__studentScopedFiltersApplied', { value: true, enumerable: false });
    } else if (user!.role === 'DOCTOR') {
      const doctor = await prisma.doctor.findUnique({ where: { userId: user!.id } });
      if (!doctor) return res.json({ success: true, data: [] });
      whereClause = { doctorId: doctor.id };
    } else if (user!.role === 'TEACHING_ASSISTANT') {
      const ta = await prisma.teachingAssistant.findUnique({ where: { userId: user!.id } });
      if (!ta) return res.json({ success: true, data: [] });
      whereClause = { teachingAssistantId: ta.id };
    } else {
      // Admin roles
      const scopeWhere: any = getScopeWhere(req.user!, 'course');
      whereClause = {};
      if (doctorId) {
        whereClause.doctorId = parseInt(doctorId);
      } else if (teachingAssistantId) {
        whereClause.teachingAssistantId = teachingAssistantId;
      }
      if (departmentId) {
        whereClause.course = { departmentId: parseInt(departmentId) };
      } else if (collegeId) {
        whereClause.course = { department: { collegeId: parseInt(collegeId) } };
      }
      if (scopeWhere && Object.keys(scopeWhere).length > 0) {
        whereClause.course = { ...whereClause.course, ...scopeWhere };
      }
    }

    // Apply year and semester filters for ADMIN roles only
    // (Students already have year/semester baked into their OR clause above)
    if (!whereClause.__studentScopedFiltersApplied && (filterYear !== undefined || filterSemester !== undefined)) {
      whereClause.course = whereClause.course || {};
      if (filterYear !== undefined) whereClause.course.year = filterYear;
      if (filterSemester !== undefined) whereClause.course.semester = filterSemester;
    }

    if (timetableId) {
      whereClause.timetableId = parseInt(timetableId);
    }

    scheduleSlots = await prisma.scheduleSlot.findMany({
      where: whereClause,
      include: includeRelations
    });

    const finalSlots = scheduleSlots.map((slot: any) => {
      if (slot.overrides && slot.overrides.length > 0) {
        const override = slot.overrides[0];
        return {
          ...slot,
          isTemporarilyModified: true,
          overrideReason: override.reason,
          room: override.room || slot.room,
          dayOfWeek: override.dayOfWeek || slot.dayOfWeek,
          startTime: override.startTime || slot.startTime,
          endTime: override.endTime || slot.endTime,
          doctor: override.doctor || slot.doctor,
          teachingAssistant: override.teachingAssistant || slot.teachingAssistant
        };
      }
      return slot;
    });

    return res.json({ success: true, data: finalSlots });
  }
);

export const getAllSchedules = getWeeklyTimetable; // Aliasing

export const createSchedule = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { courseId, doctorId, groupId, slotType, dayOfWeek, startTime, endTime, room, teachingAssistantId, timetableId } = req.body;

    if (!courseId) return next(new ValidationError('courseId is required'));

    const course = await prisma.course.findUnique({
      where: { id: parseInt(courseId as string) },
      include: { department: true }
    });
    if (!course) return next(new NotFoundError('Course not found'));

    const parsedDoctorId = doctorId ? parseInt(doctorId as string) : null;
    const parsedGroupId = groupId ? parseInt(groupId as string) : null;

    if (req.user!.role === 'DOCTOR') {
      const myDoctor = await prisma.doctor.findUnique({ where: { userId: req.user!.id } });
      if (!myDoctor || (parsedDoctorId && parsedDoctorId !== myDoctor.id)) {
        return next(new AuthorizationError('You can only schedule classes for yourself'));
      }
    } else if (req.user!.role === 'TEACHING_ASSISTANT') {
      if (teachingAssistantId !== req.user!.teachingAssistant?.id) {
        return next(new AuthorizationError('You can only schedule classes assigned to you'));
      }
    } else {
      const deptScope: any = getScopeWhere(req.user!, 'department');
      if (deptScope && Object.keys(deptScope).length) {
        if (deptScope.collegeId && course.department?.collegeId !== deptScope.collegeId)
          return next(new AuthorizationError('Access denied'));
        if (deptScope.id && course.departmentId !== deptScope.id)
          return next(new AuthorizationError('Access denied'));
      }
    }

    if (timetableId) {
      const timetable = await prisma.timetable.findUnique({ where: { id: parseInt(timetableId as string) } });
      if (!timetable) return next(new NotFoundError('Timetable not found'));
      if (timetable.departmentId !== course.departmentId ||
        timetable.academicYear !== course.year ||
        timetable.semester !== course.semester) {
        return next(new ValidationError('Timetable scope does not match Course scope'));
      }
    }

    let effectiveTimetableId: number | undefined = timetableId ? parseInt(timetableId as string) : undefined;
    if (!effectiveTimetableId) {
      const foundTb = await prisma.timetable.findFirst({
        where: {
          departmentId: course.departmentId!,
          academicYear: course.year,
          semester: course.semester,
        }
      });
      if (foundTb) effectiveTimetableId = foundTb.id;
    }

    let scheduleSlot;
    try {
      scheduleSlot = await prisma.$transaction(async (tx) => {
        await TimetableService.checkConflicts({
          dayOfWeek,
          startTime,
          endTime,
          room,
          courseId: parseInt(courseId as string),
          doctorId: parsedDoctorId,
          groupId: parsedGroupId,
          teachingAssistantId,
        }, tx);

        return tx.scheduleSlot.create({
          data: {
            courseId: parseInt(courseId as string),
            doctorId: parsedDoctorId,
            groupId: parsedGroupId,
            slotType: slotType || 'LECTURE',
            dayOfWeek,
            startTime,
            endTime,
            room,
            teachingAssistantId,

            timetableId: effectiveTimetableId
          },
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (err: any) {
      if (err?.code === 'P2034') {
        return next(new ConflictError('Scheduling conflict: another booking was committed simultaneously. Please retry.'));
      }
      throw err;
    }

    res.status(201).json({ success: true, data: scheduleSlot });
  }
);

export const updateSchedule = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { dayOfWeek, startTime, endTime, room, teachingAssistantId, courseId, doctorId, groupId, slotType } = req.body;
    const slotId = parseInt(req.params.id as string);

    const existing = await prisma.scheduleSlot.findUnique({
      where: { id: slotId },
      include: { course: { include: { department: true } } }
    });
    if (!existing) return next(new NotFoundError('ScheduleSlot not found'));

    const newCourseId = courseId ? parseInt(courseId as string) : existing.courseId;
    const newDoctorId = doctorId !== undefined ? (doctorId ? parseInt(doctorId as string) : null) : existing.doctorId;
    const newGroupId = groupId !== undefined ? (groupId ? parseInt(groupId as string) : null) : existing.groupId;
    const newTeachingAssistantId = teachingAssistantId !== undefined ? teachingAssistantId : existing.teachingAssistantId;

    if (req.user!.role === 'DOCTOR') {
      const myDoctor = await prisma.doctor.findUnique({ where: { userId: req.user!.id } });
      if (!myDoctor || existing.doctorId !== myDoctor.id) {
        return next(new AuthorizationError('You can only modify slots for your own sections'));
      }
    } else if (req.user!.role === 'TEACHING_ASSISTANT') {
      if (existing.teachingAssistantId !== req.user!.teachingAssistant?.id) {
        return next(new AuthorizationError('You can only modify slots assigned to you'));
      }
      if (newTeachingAssistantId !== req.user!.teachingAssistant?.id) {
        return next(new AuthorizationError('You cannot reassign to another TA'));
      }
    } else {
      const deptScope: any = getScopeWhere(req.user!, 'department');
      if (deptScope && Object.keys(deptScope).length) {
        if (deptScope.collegeId && existing.course?.department?.collegeId !== deptScope.collegeId)
          return next(new AuthorizationError('Access denied'));
        if (deptScope.id && existing.course?.departmentId !== deptScope.id)
          return next(new AuthorizationError('Access denied'));
      }
    }

    let targetTimetableId = existing.timetableId;

    if (courseId && newCourseId !== existing.courseId) {
      const course = await prisma.course.findUnique({
        where: { id: newCourseId },
        include: { department: true }
      });
      if (!course) return next(new NotFoundError('Course not found'));

      const deptScope: any = getScopeWhere(req.user!, 'department');
      if (deptScope && Object.keys(deptScope).length) {
        if (deptScope.collegeId && course.department?.collegeId !== deptScope.collegeId)
          return next(new AuthorizationError('Access denied'));
        if (deptScope.id && course.departmentId !== deptScope.id)
          return next(new AuthorizationError('Access denied'));
      }

      const foundTb = await prisma.timetable.findFirst({
        where: {
          departmentId: course.departmentId!,
          academicYear: course.year,
          semester: course.semester,
        }
      });
      targetTimetableId = foundTb ? foundTb.id : null;
    } else if (!targetTimetableId && existing.course) {
      const foundTb = await prisma.timetable.findFirst({
        where: {
          departmentId: existing.course.departmentId!,
          academicYear: existing.course.year,
          semester: existing.course.semester,
        }
      });
      if (foundTb) targetTimetableId = foundTb.id;
    }

    const scheduleSlot = await prisma.$transaction(async (tx) => {
      await TimetableService.checkConflicts({
        dayOfWeek: dayOfWeek || existing.dayOfWeek,
        startTime: startTime || existing.startTime,
        endTime: endTime || existing.endTime,
        room: room !== undefined ? room : existing.room,
        courseId: newCourseId,
        doctorId: newDoctorId,
        groupId: newGroupId,
        teachingAssistantId: newTeachingAssistantId,
        excludeSlotId: slotId,
      }, tx);

      return tx.scheduleSlot.update({
        where: { id: slotId },
        data: {
          dayOfWeek,
          startTime,
          endTime,
          room,
          teachingAssistantId,

          courseId: newCourseId,
          doctorId: newDoctorId,
          groupId: newGroupId,
          slotType: slotType || undefined,
          timetableId: targetTimetableId,
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    res.json({ success: true, data: scheduleSlot });
  }
);

export const deleteSchedule = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const slotId = parseInt(req.params.id as string);
    const existing = await prisma.scheduleSlot.findUnique({
      where: { id: slotId },
      include: { course: { include: { department: true } } }
    });
    if (!existing) return next(new NotFoundError('ScheduleSlot not found'));

    if (req.user!.role === 'DOCTOR') {
      const myDoctor = await prisma.doctor.findUnique({ where: { userId: req.user!.id } });
      if (!myDoctor || existing.doctorId !== myDoctor.id) {
        return next(new AuthorizationError('You can only delete slots for your own sections'));
      }
    } else if (req.user!.role === 'TEACHING_ASSISTANT') {
      if (existing.teachingAssistantId !== req.user!.teachingAssistant?.id) {
        return next(new AuthorizationError('You can only delete slots assigned to you'));
      }
    } else {
      const deptScope: any = getScopeWhere(req.user!, 'department');
      if (deptScope && Object.keys(deptScope).length) {
        if (deptScope.collegeId && existing.course?.department?.collegeId !== deptScope.collegeId)
          return next(new AuthorizationError('Access denied'));
        if (deptScope.id && existing.course?.departmentId !== deptScope.id)
          return next(new AuthorizationError('Access denied'));
      }
    }

    await prisma.scheduleSlot.delete({ where: { id: slotId } });
    auditLog('DELETE_SCHEDULE', 'ScheduleSlot', req.params.id as string, req);
    res.json({ success: true, message: 'ScheduleSlot deleted' });
  }
);

interface StaffResolveResult<T> {
  id: T | null;
  isAmbiguous: boolean;
  matchCount: number;
}

async function resolveDoctorByName(
  rawName: string,
  departmentId?: number | null
): Promise<StaffResolveResult<number>> {
  const cleanName = rawName
    .trim()
    .replace(/^(د\.|أ\.د\.|دكتور\s+|dr\.|dr\s+|prof\.|prof\s+)\s*/i, '')
    .trim();
  const parts = cleanName.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { id: null, isAmbiguous: false, matchCount: 0 };

  const deptFilter = departmentId ? { departmentId: Number(departmentId) } : {};

  // Step 1: Scoped Exact Match
  const exactWhere = parts.length >= 2
    ? {
        firstName: { equals: parts[0], mode: 'insensitive' as const },
        lastName: { equals: parts[parts.length - 1], mode: 'insensitive' as const },
        ...deptFilter,
      }
    : {
        OR: [
          { firstName: { equals: parts[0], mode: 'insensitive' as const } },
          { lastName: { equals: parts[0], mode: 'insensitive' as const } },
        ],
        ...deptFilter,
      };

  let candidates = await prisma.doctor.findMany({ where: exactWhere });

  if (candidates.length === 1) {
    return { id: candidates[0].id, isAmbiguous: false, matchCount: 1 };
  }
  if (candidates.length > 1) {
    return { id: null, isAmbiguous: true, matchCount: candidates.length };
  }

  // Step 2: Scoped Contains Match
  const containsWhere = parts.length >= 2
    ? {
        firstName: { contains: parts[0], mode: 'insensitive' as const },
        lastName: { contains: parts[parts.length - 1], mode: 'insensitive' as const },
        ...deptFilter,
      }
    : {
        OR: [
          { firstName: { contains: parts[0], mode: 'insensitive' as const } },
          { lastName: { contains: parts[0], mode: 'insensitive' as const } },
        ],
        ...deptFilter,
      };

  candidates = await prisma.doctor.findMany({ where: containsWhere });

  if (candidates.length === 1) {
    return { id: candidates[0].id, isAmbiguous: false, matchCount: 1 };
  }
  if (candidates.length > 1) {
    return { id: null, isAmbiguous: true, matchCount: candidates.length };
  }

  // Step 3: Unscoped Fallback (if departmentId was provided but 0 matches found in dept)
  if (departmentId) {
    const exactUnscoped = parts.length >= 2
      ? {
          firstName: { equals: parts[0], mode: 'insensitive' as const },
          lastName: { equals: parts[parts.length - 1], mode: 'insensitive' as const },
        }
      : {
          OR: [
            { firstName: { equals: parts[0], mode: 'insensitive' as const } },
            { lastName: { equals: parts[0], mode: 'insensitive' as const } },
          ],
        };

    candidates = await prisma.doctor.findMany({ where: exactUnscoped });
    if (candidates.length === 1) {
      return { id: candidates[0].id, isAmbiguous: false, matchCount: 1 };
    }
    if (candidates.length > 1) {
      return { id: null, isAmbiguous: true, matchCount: candidates.length };
    }

    const containsUnscoped = parts.length >= 2
      ? {
          firstName: { contains: parts[0], mode: 'insensitive' as const },
          lastName: { contains: parts[parts.length - 1], mode: 'insensitive' as const },
        }
      : {
          OR: [
            { firstName: { contains: parts[0], mode: 'insensitive' as const } },
            { lastName: { contains: parts[0], mode: 'insensitive' as const } },
          ],
        };

    candidates = await prisma.doctor.findMany({ where: containsUnscoped });
    if (candidates.length === 1) {
      return { id: candidates[0].id, isAmbiguous: false, matchCount: 1 };
    }
    if (candidates.length > 1) {
      return { id: null, isAmbiguous: true, matchCount: candidates.length };
    }
  }

  return { id: null, isAmbiguous: false, matchCount: 0 };
}

async function resolveTaByName(
  rawName: string,
  departmentId?: number | null
): Promise<StaffResolveResult<string>> {
  const cleanName = rawName
    .trim()
    .replace(/^(م\.|مهندس\s+|eng\.|eng\s+|ta\.|ta\s+|معيد\s+)\s*/i, '')
    .trim();
  const parts = cleanName.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { id: null, isAmbiguous: false, matchCount: 0 };

  const deptFilter = departmentId ? { departmentId: Number(departmentId) } : {};

  // Step 1: Scoped Exact Match
  const exactWhere = parts.length >= 2
    ? {
        firstName: { equals: parts[0], mode: 'insensitive' as const },
        lastName: { equals: parts[parts.length - 1], mode: 'insensitive' as const },
        ...deptFilter,
      }
    : {
        OR: [
          { firstName: { equals: parts[0], mode: 'insensitive' as const } },
          { lastName: { equals: parts[0], mode: 'insensitive' as const } },
        ],
        ...deptFilter,
      };

  let candidates = await prisma.teachingAssistant.findMany({ where: exactWhere });

  if (candidates.length === 1) {
    return { id: candidates[0].id, isAmbiguous: false, matchCount: 1 };
  }
  if (candidates.length > 1) {
    return { id: null, isAmbiguous: true, matchCount: candidates.length };
  }

  // Step 2: Scoped Contains Match
  const containsWhere = parts.length >= 2
    ? {
        firstName: { contains: parts[0], mode: 'insensitive' as const },
        lastName: { contains: parts[parts.length - 1], mode: 'insensitive' as const },
        ...deptFilter,
      }
    : {
        OR: [
          { firstName: { contains: parts[0], mode: 'insensitive' as const } },
          { lastName: { contains: parts[0], mode: 'insensitive' as const } },
        ],
        ...deptFilter,
      };

  candidates = await prisma.teachingAssistant.findMany({ where: containsWhere });

  if (candidates.length === 1) {
    return { id: candidates[0].id, isAmbiguous: false, matchCount: 1 };
  }
  if (candidates.length > 1) {
    return { id: null, isAmbiguous: true, matchCount: candidates.length };
  }

  // Step 3: Unscoped Fallback
  if (departmentId) {
    const exactUnscoped = parts.length >= 2
      ? {
          firstName: { equals: parts[0], mode: 'insensitive' as const },
          lastName: { equals: parts[parts.length - 1], mode: 'insensitive' as const },
        }
      : {
          OR: [
            { firstName: { equals: parts[0], mode: 'insensitive' as const } },
            { lastName: { equals: parts[0], mode: 'insensitive' as const } },
          ],
        };

    candidates = await prisma.teachingAssistant.findMany({ where: exactUnscoped });
    if (candidates.length === 1) {
      return { id: candidates[0].id, isAmbiguous: false, matchCount: 1 };
    }
    if (candidates.length > 1) {
      return { id: null, isAmbiguous: true, matchCount: candidates.length };
    }

    const containsUnscoped = parts.length >= 2
      ? {
          firstName: { contains: parts[0], mode: 'insensitive' as const },
          lastName: { contains: parts[parts.length - 1], mode: 'insensitive' as const },
        }
      : {
          OR: [
            { firstName: { contains: parts[0], mode: 'insensitive' as const } },
            { lastName: { contains: parts[0], mode: 'insensitive' as const } },
          ],
        };

    candidates = await prisma.teachingAssistant.findMany({ where: containsUnscoped });
    if (candidates.length === 1) {
      return { id: candidates[0].id, isAmbiguous: false, matchCount: 1 };
    }
    if (candidates.length > 1) {
      return { id: null, isAmbiguous: true, matchCount: candidates.length };
    }
  }

  return { id: null, isAmbiguous: false, matchCount: 0 };
}

export const syncGridToMaster = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { departmentId, academicYear, semester, slots } = req.body;

    if (!Array.isArray(slots)) {
      return next(new ValidationError('Slots array is required for synchronization'));
    }

    const parsedDeptId = departmentId ? parseInt(departmentId) : undefined;

    // Enforce Admin Scope
    const deptScope: any = getScopeWhere(req.user!, 'department');
    if (deptScope && Object.keys(deptScope).length) {
      if (!parsedDeptId) {
        return next(new AuthorizationError('Access denied'));
      }
      if (deptScope.id && parsedDeptId !== deptScope.id) {
        return next(new AuthorizationError('Access denied'));
      }
      if (deptScope.collegeId) {
        const dept = await prisma.department.findUnique({
          where: { id: parsedDeptId },
          select: { collegeId: true },
        });
        if (!dept || dept.collegeId !== deptScope.collegeId) {
          return next(new AuthorizationError('Access denied'));
        }
      }
    }

    let syncedCount = 0;
    let skippedCount = 0;
    const skippedSlots: Array<{ courseName: string; reason: string }> = [];

    for (const slot of slots) {
      const { day, startTime, endTime, courseName, instructor, room, slotType } = slot;
      if (!courseName || typeof courseName !== 'string') continue;

      const trimmedName = courseName.trim();
      const deptFilter = parsedDeptId ? { departmentId: parsedDeptId } : {};

      // 1. Exact match lookup (name or courseCode)
      let course = await prisma.course.findFirst({
        where: {
          OR: [
            { name: { equals: trimmedName, mode: 'insensitive' } },
            { courseCode: { equals: trimmedName, mode: 'insensitive' } },
          ],
          ...deptFilter,
        },
      });

      // 2. Contains fallback with ambiguity guard if no exact match found
      if (!course) {
        const candidateCourses = await prisma.course.findMany({
          where: {
            OR: [
              { name: { contains: trimmedName, mode: 'insensitive' } },
              { courseCode: { contains: trimmedName, mode: 'insensitive' } },
            ],
            ...deptFilter,
          },
        });

        if (candidateCourses.length === 1) {
          course = candidateCourses[0];
        } else if (candidateCourses.length > 1) {
          skippedCount++;
          skippedSlots.push({
            courseName: trimmedName,
            reason: `AMBIGUOUS_COURSE_MATCH: ${candidateCourses.length} candidate courses matched '${trimmedName}'`,
          });
          continue;
        } else {
          skippedCount++;
          skippedSlots.push({
            courseName: trimmedName,
            reason: `COURSE_NOT_FOUND: No course matching '${trimmedName}'`,
          });
          continue;
        }
      }

      let doctorId: number | null = null;
      if (instructor) {
        const docResolve = await resolveDoctorByName(instructor, parsedDeptId || course.departmentId);
        if (docResolve.isAmbiguous) {
          skippedCount++;
          skippedSlots.push({
            courseName: trimmedName,
            reason: `AMBIGUOUS_INSTRUCTOR_MATCH: ${docResolve.matchCount} instructors matched '${instructor}'`,
          });
          continue;
        } else if (docResolve.id) {
          doctorId = docResolve.id;
        }
      }

      let timetableId: number | null = null;
      if (parsedDeptId && academicYear && semester) {
        const timetable = await prisma.timetable.findFirst({
          where: {
            departmentId: parsedDeptId,
            academicYear: parseInt(academicYear),
            semester: parseInt(semester)
          }
        });
        if (timetable) timetableId = timetable.id;
      }

      const existingSlot = await prisma.scheduleSlot.findFirst({
        where: {
          courseId: course.id,
          dayOfWeek: (day || 'MONDAY').toUpperCase(),
          startTime: startTime || '09:00',
        },
      });

      if (existingSlot) {
        await prisma.scheduleSlot.update({
          where: { id: existingSlot.id },
          data: {
            endTime: endTime || '11:00',
            room: room || existingSlot.room,
            slotType: slotType || existingSlot.slotType,
            ...(doctorId ? { doctorId } : {}),
            ...(timetableId ? { timetableId } : {}),
          },
        });
      } else if (doctorId) {
        await prisma.scheduleSlot.create({
          data: {
            courseId: course.id,
            groupId: null,
            doctorId,
            timetableId,
            slotType: slotType || 'LECTURE',
            dayOfWeek: (day || 'MONDAY').toUpperCase(),
            startTime: startTime || '09:00',
            endTime: endTime || '11:00',
            room: room || 'Main Hall',
          },
        });
      }
      syncedCount++;
    }

    auditLog('SYNC_GRID_TO_MASTER', 'ScheduleSlot', '0', req);

    res.json({
      success: true,
      message: `Successfully synced ${syncedCount} slots to Master Schedule${skippedCount > 0 ? ` (${skippedCount} skipped)` : ''}`,
      data: { syncedCount, skippedCount, skippedSlots },
    });
  }
);

export const checkScheduleConflict = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const {
      dayOfWeek,
      startTime,
      endTime,
      room,
      doctorName,
      doctorId,
      teachingAssistantId,
      taName,
      courseName,
      courseId,
      departmentId,
      academicYear,
      semester,
      excludeSlotId,
    } = req.body;

    if (!dayOfWeek || !startTime || !endTime) {
      return res.json({ success: true, hasConflict: false, conflicts: [] });
    }

    const dayUpper = dayOfWeek.toUpperCase();
    const conflicts: Array<{
      type: 'ROOM_OCCUPIED' | 'DOCTOR_BUSY' | 'TA_BUSY' | 'BATCH_OVERLAP' | 'DUPLICATE_COURSE' | 'AMBIGUOUS_DOCTOR' | 'AMBIGUOUS_TA';
      messageAr: string;
      messageEn: string;
      conflictingSlot?: any;
    }> = [];

    const timeOverlap = {
      OR: [
        { AND: [{ startTime: { lte: startTime } }, { endTime: { gt: startTime } }] },
        { AND: [{ startTime: { lt: endTime } }, { endTime: { gte: endTime } }] },
        { AND: [{ startTime: { gte: startTime } }, { endTime: { lte: endTime } }] },
      ],
    };

    const excludeCondition = excludeSlotId ? { id: { not: Number(excludeSlotId) } } : {};

    // Derive effective departmentId from payload, course, or authenticated user
    let effectiveDeptId: number | null = departmentId ? Number(departmentId) : null;
    if (!effectiveDeptId && courseId) {
      const c = await prisma.course.findUnique({
        where: { id: Number(courseId) },
        select: { departmentId: true },
      });
      if (c?.departmentId) effectiveDeptId = c.departmentId;
    }
    if (!effectiveDeptId && courseName) {
      const c = await prisma.course.findFirst({
        where: { name: { equals: String(courseName).trim(), mode: 'insensitive' } },
        select: { departmentId: true },
      });
      if (c?.departmentId) effectiveDeptId = c.departmentId;
    }
    if (!effectiveDeptId && (req as any).user?.departmentId) {
      effectiveDeptId = (req as any).user.departmentId;
    }

    // 1. Check Room Conflict
    if (room && room.trim() !== '') {
      const trimmedRoom = room.trim();
      const roomSlot = await prisma.scheduleSlot.findFirst({
        where: {
          dayOfWeek: dayUpper,
          room: { equals: trimmedRoom, mode: 'insensitive' },
          ...timeOverlap,
          ...excludeCondition,
        },
        include: {
          course: {
            select: { name: true, courseCode: true, department: { select: { name: true } } },
          },
          doctor: { select: { firstName: true, lastName: true } },
        },
      });

      if (roomSlot) {
        const courseStr = roomSlot.course?.name || 'مادة أخرى';
        const deptStr = roomSlot.course?.department?.name || '';
        const docStr = roomSlot.doctor
          ? `د. ${roomSlot.doctor.firstName} ${roomSlot.doctor.lastName}`
          : '';
        conflicts.push({
          type: 'ROOM_OCCUPIED',
          messageAr: `القاعة/المعمل (${trimmedRoom}) محجوزة بالفعل لمادة (${courseStr}) ${deptStr ? `بقسم ${deptStr}` : ''} ${docStr ? `مع ${docStr}` : ''} في الفترة (${roomSlot.startTime} - ${roomSlot.endTime}).`,
          messageEn: `Room/Lab (${trimmedRoom}) is already booked for (${courseStr}) ${deptStr ? `[${deptStr}]` : ''} at (${roomSlot.startTime} - ${roomSlot.endTime}).`,
          conflictingSlot: {
            courseName: courseStr,
            doctorName: docStr,
            departmentName: deptStr,
            time: `${roomSlot.startTime} - ${roomSlot.endTime}`,
            room: trimmedRoom,
          },
        });
      }
    }

    // 2. Check Doctor Conflict
    let targetDoctorId: number | null = doctorId ? Number(doctorId) : null;
    if (!targetDoctorId && doctorName) {
      const docResolve = await resolveDoctorByName(doctorName, effectiveDeptId);
      if (docResolve.isAmbiguous) {
        conflicts.push({
          type: 'AMBIGUOUS_DOCTOR',
          messageAr: `يوجد أكثر من عضو هيئة تدريس يطابق الاسم (${doctorName}). يرجى اختيار المحاضر من القائمة أو عبر المعرّف (Doctor ID) لتفادي الالتباس.`,
          messageEn: `Multiple faculty members match the name (${doctorName}). Please select the instructor from the list or use their numeric ID to disambiguate.`,
        });
      } else if (docResolve.id) {
        targetDoctorId = docResolve.id;
      }
    }

    if (targetDoctorId) {
      const docSlot = await prisma.scheduleSlot.findFirst({
        where: {
          dayOfWeek: dayUpper,
          doctorId: targetDoctorId,
          ...timeOverlap,
          ...excludeCondition,
        },
        include: {
          course: {
            select: { name: true, courseCode: true, department: { select: { name: true } } },
          },
          doctor: { select: { firstName: true, lastName: true } },
        },
      });

      if (docSlot) {
        const docNameStr = docSlot.doctor
          ? `د. ${docSlot.doctor.firstName} ${docSlot.doctor.lastName}`
          : doctorName || 'المحاضر';
        const courseStr = docSlot.course?.name || 'مادة أخرى';
        const deptStr = docSlot.course?.department?.name || '';
        conflicts.push({
          type: 'DOCTOR_BUSY',
          messageAr: `المحاضر (${docNameStr}) لديه محاضرة أخرى (${courseStr}) ${deptStr ? `بقسم ${deptStr}` : ''} بقاعة (${docSlot.room || 'غير محددة'}) في نفس الوقت (${docSlot.startTime} - ${docSlot.endTime}).`,
          messageEn: `Instructor (${docNameStr}) is already teaching (${courseStr}) in room (${docSlot.room || 'N/A'}) at (${docSlot.startTime} - ${docSlot.endTime}).`,
          conflictingSlot: {
            courseName: courseStr,
            doctorName: docNameStr,
            departmentName: deptStr,
            time: `${docSlot.startTime} - ${docSlot.endTime}`,
            room: docSlot.room,
          },
        });
      }
    }

    // 3. Check Teaching Assistant Conflict
    let targetTaId: string | null = teachingAssistantId ? String(teachingAssistantId) : null;
    if (!targetTaId && taName) {
      const taResolve = await resolveTaByName(taName, effectiveDeptId);
      if (taResolve.isAmbiguous) {
        conflicts.push({
          type: 'AMBIGUOUS_TA',
          messageAr: `يوجد أكثر من معيد/مدرس مساعد يطابق الاسم (${taName}). يرجى اختيار المعيد من القائمة أو عبر المعرّف (TA ID) لتفادي الالتباس.`,
          messageEn: `Multiple teaching assistants match the name (${taName}). Please select the TA from the list or use their ID to disambiguate.`,
        });
      } else if (taResolve.id) {
        targetTaId = taResolve.id;
      }
    }

    if (targetTaId) {
      const taSlot = await prisma.scheduleSlot.findFirst({
        where: {
          dayOfWeek: dayUpper,
          teachingAssistantId: targetTaId,
          ...timeOverlap,
          ...excludeCondition,
        },
        include: {
          course: {
            select: { name: true, department: { select: { name: true } } },
          },
          teachingAssistant: { select: { firstName: true, lastName: true } },
        },
      });

      if (taSlot) {
        const taNameStr = taSlot.teachingAssistant
          ? `م. ${taSlot.teachingAssistant.firstName} ${taSlot.teachingAssistant.lastName}`
          : taName || 'المعيد';
        const courseStr = taSlot.course?.name || 'سكشن آخر';
        conflicts.push({
          type: 'TA_BUSY',
          messageAr: `المعيد (${taNameStr}) لديه سكشن آخر (${courseStr}) في بقاعة (${taSlot.room || 'غير محددة'}) في نفس الفترة (${taSlot.startTime} - ${taSlot.endTime}).`,
          messageEn: `Teaching Assistant (${taNameStr}) is already assigned to (${courseStr}) at (${taSlot.startTime} - ${taSlot.endTime}).`,
          conflictingSlot: {
            courseName: courseStr,
            doctorName: taNameStr,
            time: `${taSlot.startTime} - ${taSlot.endTime}`,
            room: taSlot.room,
          },
        });
      }
    }

    // 4. Check Batch/Department Overlap
    if (departmentId && academicYear && semester) {
      const batchSlot = await prisma.scheduleSlot.findFirst({
        where: {
          dayOfWeek: dayUpper,
          ...timeOverlap,
          ...excludeCondition,
          course: {
            departmentId: Number(departmentId),
            year: Number(academicYear),
            semester: Number(semester),
          },
        },
        include: {
          course: { select: { name: true, courseCode: true } },
          doctor: { select: { firstName: true, lastName: true } },
        },
      });

      if (batchSlot) {
        const existingCourse = batchSlot.course?.name || 'مادة أخرى';
        conflicts.push({
          type: 'BATCH_OVERLAP',
          messageAr: `توجد بالفعل مادة أخرى (${existingCourse}) مجدولة لنفس السنة والقسم في هذه الفترة الزمنية (${batchSlot.startTime} - ${batchSlot.endTime}).`,
          messageEn: `Another course (${existingCourse}) is already scheduled for this batch in this time slot (${batchSlot.startTime} - ${batchSlot.endTime}).`,
          conflictingSlot: {
            courseName: existingCourse,
            time: `${batchSlot.startTime} - ${batchSlot.endTime}`,
            room: batchSlot.room,
          },
        });
      }
    }

    return res.json({
      success: true,
      hasConflict: conflicts.length > 0,
      conflicts,
    });
  }
);
