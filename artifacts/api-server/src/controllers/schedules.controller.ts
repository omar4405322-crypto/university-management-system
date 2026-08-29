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
        const enrolledCourseFilter: any = { id: { in: enrolledCourseIds }, isPublished: true };
        if (filterSemester !== undefined) enrolledCourseFilter.semester = filterSemester;

        whereClause = {
          AND: [
            {
              OR: [
                { timetable: { status: 'PUBLISHED' } },
                { timetableId: null },
              ],
            },
            {
              OR: [
                // Slots assigned to this student's group (or parent groups)
                { groupId: { in: groupIds }, course: { isPublished: true } },
                // Department-wide slots (no group) matching student's year (+ semester if filtered)
                { groupId: null, course: { ...baseCourseFilter, isPublished: true } },
                // Slots for explicitly enrolled courses (no group) with optional semester
                { groupId: null, course: enrolledCourseFilter },
              ],
            },
          ],
        };
      } else {
        // Student has no group — show all slots for their department/year and enrolled courses
        const enrolledCourseFilter: any = { id: { in: enrolledCourseIds }, isPublished: true };
        if (filterSemester !== undefined) enrolledCourseFilter.semester = filterSemester;

        whereClause = {
          AND: [
            {
              OR: [
                { timetable: { status: 'PUBLISHED' } },
                { timetableId: null },
              ],
            },
            {
              OR: [
                { course: { ...baseCourseFilter, isPublished: true } },
                { course: enrolledCourseFilter },
              ],
            },
          ],
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

    // 1. Pre-fetch Timetable (single lookup)
    let timetableId: number | null = null;
    if (parsedDeptId && academicYear && semester) {
      const timetable = await prisma.timetable.findFirst({
        where: {
          departmentId: parsedDeptId,
          academicYear: parseInt(academicYear),
          semester: parseInt(semester),
        },
        select: { id: true },
      });
      if (timetable) timetableId = timetable.id;
    }

    // 2. Pre-fetch Courses for the department (or all courses if unscoped)
    const deptFilter = parsedDeptId ? { departmentId: parsedDeptId } : {};
    const allCourses = await prisma.course.findMany({
      where: deptFilter,
      select: { id: true, name: true, courseCode: true, departmentId: true },
    });

    // 3. Pre-fetch Staff (Doctors) in a single query, and group by departmentId in memory for slot-scoped matching
    const globalDoctors = await prisma.doctor.findMany({
      select: { id: true, firstName: true, lastName: true, departmentId: true },
    });
    const doctorsByDept = new Map<number, typeof globalDoctors>();
    for (const doc of globalDoctors) {
      if (doc.departmentId) {
        let list = doctorsByDept.get(doc.departmentId);
        if (!list) {
          list = [];
          doctorsByDept.set(doc.departmentId, list);
        }
        list.push(doc);
      }
    }

    // 4. Pre-fetch Existing ScheduleSlots for matched courses
    const allCourseIds = allCourses.map(c => c.id);
    const existingSlots = allCourseIds.length > 0
      ? await prisma.scheduleSlot.findMany({
          where: {
            courseId: { in: allCourseIds },
            ...(timetableId ? { timetableId } : {}),
          },
          select: {
            id: true,
            courseId: true,
            dayOfWeek: true,
            startTime: true,
            endTime: true,
            room: true,
            slotType: true,
            doctorId: true,
            timetableId: true,
          },
        })
      : [];

    const existingSlotMap = new Map<string, typeof existingSlots[0]>();
    for (const s of existingSlots) {
      const key = `${s.courseId}-${s.dayOfWeek.toUpperCase()}-${s.startTime}`;
      existingSlotMap.set(key, s);
    }

    // In-memory Course matcher
    const matchCourse = (rawName: string) => {
      const trimmed = rawName.trim().toLowerCase();
      const exact = allCourses.filter(
        c => c.name.toLowerCase() === trimmed || c.courseCode.toLowerCase() === trimmed
      );
      if (exact.length === 1) return { course: exact[0], isAmbiguous: false, matchCount: 1 };
      if (exact.length > 1) return { course: null, isAmbiguous: true, matchCount: exact.length };

      const contains = allCourses.filter(
        c => c.name.toLowerCase().includes(trimmed) || c.courseCode.toLowerCase().includes(trimmed)
      );
      if (contains.length === 1) return { course: contains[0], isAmbiguous: false, matchCount: 1 };
      if (contains.length > 1) return { course: null, isAmbiguous: true, matchCount: contains.length };

      return { course: null, isAmbiguous: false, matchCount: 0 };
    };

    // In-memory Doctor matcher
    const matchDoctor = (rawName: string, effectiveDeptId?: number | null): StaffResolveResult<number> => {
      const cleanName = rawName
        .trim()
        .replace(/^(د\.|دكتور\s+|dr\.|dr\s+|أ\.د\.|prof\.|prof\s+)\s*/i, '')
        .trim();
      const parts = cleanName.split(/\s+/).filter(Boolean).map(p => p.toLowerCase());
      if (parts.length === 0) return { id: null, isAmbiguous: false, matchCount: 0 };

      const filterDocs = (docs: typeof globalDoctors, mode: 'exact' | 'contains') => {
        return docs.filter(doc => {
          const f = (doc.firstName || '').toLowerCase();
          const l = (doc.lastName || '').toLowerCase();
          if (parts.length >= 2) {
            const targetFirst = parts[0];
            const targetLast = parts[parts.length - 1];
            return mode === 'exact'
              ? f === targetFirst && l === targetLast
              : f.includes(targetFirst) && l.includes(targetLast);
          } else {
            const target = parts[0];
            return mode === 'exact'
              ? f === target || l === target
              : f.includes(target) || l.includes(target);
          }
        });
      };

      const scopedDoctors = effectiveDeptId ? doctorsByDept.get(effectiveDeptId) || [] : globalDoctors;

      let candidates = filterDocs(scopedDoctors, 'exact');
      if (candidates.length === 1) return { id: candidates[0].id, isAmbiguous: false, matchCount: 1 };
      if (candidates.length > 1) return { id: null, isAmbiguous: true, matchCount: candidates.length };

      candidates = filterDocs(scopedDoctors, 'contains');
      if (candidates.length === 1) return { id: candidates[0].id, isAmbiguous: false, matchCount: 1 };
      if (candidates.length > 1) return { id: null, isAmbiguous: true, matchCount: candidates.length };

      if (effectiveDeptId) {
        candidates = filterDocs(globalDoctors, 'exact');
        if (candidates.length === 1) return { id: candidates[0].id, isAmbiguous: false, matchCount: 1 };
        if (candidates.length > 1) return { id: null, isAmbiguous: true, matchCount: candidates.length };

        candidates = filterDocs(globalDoctors, 'contains');
        if (candidates.length === 1) return { id: candidates[0].id, isAmbiguous: false, matchCount: 1 };
        if (candidates.length > 1) return { id: null, isAmbiguous: true, matchCount: candidates.length };
      }

      return { id: null, isAmbiguous: false, matchCount: 0 };
    };

    let syncedCount = 0;
    let skippedCount = 0;
    const skippedSlots: Array<{ courseName: string; reason: string }> = [];

    const updatesToRun: Array<{ where: { id: number }; data: any }> = [];
    const createsToRun: any[] = [];

    for (const slot of slots) {
      const { day, startTime, endTime, courseName, instructor, room, slotType } = slot;
      if (!courseName || typeof courseName !== 'string') continue;

      const trimmedName = courseName.trim();
      const courseMatch = matchCourse(trimmedName);

      if (courseMatch.isAmbiguous) {
        skippedCount++;
        skippedSlots.push({
          courseName: trimmedName,
          reason: `AMBIGUOUS_COURSE_MATCH: ${courseMatch.matchCount} candidate courses matched '${trimmedName}'`,
        });
        continue;
      }

      const course = courseMatch.course;
      if (!course) {
        skippedCount++;
        skippedSlots.push({
          courseName: trimmedName,
          reason: `COURSE_NOT_FOUND: No course matching '${trimmedName}'`,
        });
        continue;
      }

      let doctorId: number | null = null;
      if (instructor) {
        const effectiveDeptId = parsedDeptId || course.departmentId;
        const docResolve = matchDoctor(instructor, effectiveDeptId);
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

      const normalizedDay = (day || 'MONDAY').toUpperCase();
      const normalizedStartTime = startTime || '09:00';
      const slotKey = `${course.id}-${normalizedDay}-${normalizedStartTime}`;
      const existingSlot = existingSlotMap.get(slotKey);

      if (existingSlot) {
        existingSlotMap.delete(slotKey);
        updatesToRun.push({
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
        createsToRun.push({
          courseId: course.id,
          groupId: null,
          doctorId,
          timetableId,
          slotType: slotType || 'LECTURE',
          dayOfWeek: normalizedDay,
          startTime: normalizedStartTime,
          endTime: endTime || '11:00',
          room: room || 'Main Hall',
        });
      }
      syncedCount++;
    }

    // 5. Batch database execution
    if (updatesToRun.length > 0 || createsToRun.length > 0) {
      await prisma.$transaction([
        ...updatesToRun.map(u => prisma.scheduleSlot.update(u)),
        ...(createsToRun.length > 0 ? [prisma.scheduleSlot.createMany({ data: createsToRun })] : []),
      ]);
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
      groupId,
      excludeSlotId,
    } = req.body;

    if (!dayOfWeek || !startTime || !endTime) {
      return res.json({ success: true, hasConflict: false, conflicts: [] });
    }

    // Derive effective departmentId from payload, course, or authenticated user
    let effectiveDeptId: number | null = departmentId ? Number(departmentId) : null;
    let resolvedCourseId: number | null = courseId ? Number(courseId) : null;

    if (!resolvedCourseId && courseName) {
      const c = await prisma.course.findFirst({
        where: { name: { equals: String(courseName).trim(), mode: 'insensitive' } },
        select: { id: true, departmentId: true },
      });
      if (c) {
        resolvedCourseId = c.id;
        if (!effectiveDeptId && c.departmentId) effectiveDeptId = c.departmentId;
      }
    } else if (resolvedCourseId && !effectiveDeptId) {
      const c = await prisma.course.findUnique({
        where: { id: resolvedCourseId },
        select: { departmentId: true },
      });
      if (c?.departmentId) effectiveDeptId = c.departmentId;
    }

    if (!effectiveDeptId && (req as any).user?.departmentId) {
      effectiveDeptId = (req as any).user.departmentId;
    }

    // Disambiguation checks for name-based lookup
    const initialConflicts: any[] = [];

    let targetDoctorId: number | null = doctorId ? Number(doctorId) : null;
    if (!targetDoctorId && doctorName) {
      const docResolve = await resolveDoctorByName(doctorName, effectiveDeptId);
      if (docResolve.isAmbiguous) {
        initialConflicts.push({
          type: 'AMBIGUOUS_DOCTOR',
          messageAr: `يوجد أكثر من عضو هيئة تدريس يطابق الاسم (${doctorName}). يرجى اختيار المحاضر من القائمة أو عبر المعرّف (Doctor ID) لتفادي الالتباس.`,
          messageEn: `Multiple faculty members match the name (${doctorName}). Please select the instructor from the list or use their numeric ID to disambiguate.`,
        });
      } else if (docResolve.id) {
        targetDoctorId = docResolve.id;
      }
    }

    let targetTaId: string | null = teachingAssistantId ? String(teachingAssistantId) : null;
    if (!targetTaId && taName) {
      const taResolve = await resolveTaByName(taName, effectiveDeptId);
      if (taResolve.isAmbiguous) {
        initialConflicts.push({
          type: 'AMBIGUOUS_TA',
          messageAr: `يوجد أكثر من معيد/مدرس مساعد يطابق الاسم (${taName}). يرجى اختيار المعيد من القائمة أو عبر المعرّف (TA ID) لتفادي الالتباس.`,
          messageEn: `Multiple teaching assistants match the name (${taName}). Please select the TA from the list or use their ID to disambiguate.`,
        });
      } else if (taResolve.id) {
        targetTaId = taResolve.id;
      }
    }

    const serviceConflicts = await TimetableService.findConflicts({
      dayOfWeek,
      startTime,
      endTime,
      room,
      doctorId: targetDoctorId,
      teachingAssistantId: targetTaId,
      courseId: resolvedCourseId,
      departmentId: effectiveDeptId,
      academicYear: academicYear ? Number(academicYear) : null,
      semester: semester ? Number(semester) : null,
      groupId: groupId ? Number(groupId) : null,
      excludeSlotId: excludeSlotId ? Number(excludeSlotId) : undefined,
    });

    const allConflicts = [...initialConflicts, ...serviceConflicts];

    return res.json({
      success: true,
      hasConflict: allConflicts.length > 0,
      conflicts: allConflicts,
    });
  }
);
