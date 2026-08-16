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
    const { departmentId, year, semester, timetableId, doctorId, teachingAssistantId } = req.query as Record<string, string>;
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
    } else if (doctorId) {
      whereClause = { doctorId: parseInt(doctorId) };
    } else if (teachingAssistantId) {
      whereClause = { teachingAssistantId: teachingAssistantId };
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
      whereClause = {};
      if (departmentId) {
        whereClause.course = { departmentId: parseInt(departmentId) };
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

    const course = await prisma.course.findUnique({ where: { id: parseInt(courseId as string) } });
    if (!course) return next(new NotFoundError('Course not found'));

    const parsedDoctorId = doctorId ? parseInt(doctorId as string) : null;
    const parsedGroupId = groupId ? parseInt(groupId as string) : null;

    if (req.user!.role === 'DOCTOR') {
      const myDoctor = await prisma.doctor.findUnique({ where: { userId: req.user!.id } });
      if (!myDoctor || (parsedDoctorId && parsedDoctorId !== myDoctor.id)) {
        return next(new AuthorizationError('You can only schedule classes for yourself'));
      }
    }
    if (req.user!.role === 'TEACHING_ASSISTANT' && teachingAssistantId !== req.user!.teachingAssistant?.id) {
      return next(new AuthorizationError('You can only schedule classes assigned to you'));
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
      include: { course: true }
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
    }
    if (req.user!.role === 'TEACHING_ASSISTANT') {
      if (existing.teachingAssistantId !== req.user!.teachingAssistant?.id) {
        return next(new AuthorizationError('You can only modify slots assigned to you'));
      }
      if (newTeachingAssistantId !== req.user!.teachingAssistant?.id) {
        return next(new AuthorizationError('You cannot reassign to another TA'));
      }
    }

    let targetTimetableId = existing.timetableId;

    if (courseId && newCourseId !== existing.courseId) {
      const course = await prisma.course.findUnique({ where: { id: newCourseId } });
      if (!course) return next(new NotFoundError('Course not found'));

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
    });
    if (!existing) return next(new NotFoundError('ScheduleSlot not found'));

    if (req.user!.role === 'DOCTOR') {
      const myDoctor = await prisma.doctor.findUnique({ where: { userId: req.user!.id } });
      if (!myDoctor || existing.doctorId !== myDoctor.id) {
        return next(new AuthorizationError('You can only delete slots for your own sections'));
      }
    }
    if (req.user!.role === 'TEACHING_ASSISTANT' && existing.teachingAssistantId !== req.user!.teachingAssistant?.id) {
      return next(new AuthorizationError('You can only delete slots assigned to you'));
    }

    await prisma.scheduleSlot.delete({ where: { id: slotId } });
    auditLog('DELETE_SCHEDULE', 'ScheduleSlot', req.params.id as string, req);
    res.json({ success: true, message: 'ScheduleSlot deleted' });
  }
);

export const syncGridToMaster = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { collegeId, departmentId, academicYear, semester, slots } = req.body;

    if (!slots || !Array.isArray(slots)) {
      return next(new ValidationError('Slots array is required for synchronization'));
    }

    let syncedCount = 0;
    let skippedCount = 0;
    const skippedSlots: Array<{ courseName: string; reason: string }> = [];

    const parsedDeptId = departmentId ? parseInt(departmentId) : undefined;

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
        const parts = instructor.split(' ');
        const doctor = await prisma.doctor.findFirst({
          where: {
            OR: [
              { firstName: { contains: parts[0], mode: 'insensitive' } },
              { lastName: { contains: parts[parts.length - 1], mode: 'insensitive' } },
            ],
          },
        });
        if (doctor) doctorId = doctor.id;
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
      type: 'ROOM_OCCUPIED' | 'DOCTOR_BUSY' | 'TA_BUSY' | 'BATCH_OVERLAP' | 'DUPLICATE_COURSE';
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
      const parts = doctorName.trim().split(' ');
      const foundDoctor = await prisma.doctor.findFirst({
        where: {
          OR: [
            { firstName: { contains: parts[0], mode: 'insensitive' } },
            { lastName: { contains: parts[parts.length - 1], mode: 'insensitive' } },
          ],
        },
      });
      if (foundDoctor) targetDoctorId = foundDoctor.id;
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
      const parts = taName.trim().split(' ');
      const foundTa = await prisma.teachingAssistant.findFirst({
        where: {
          OR: [
            { firstName: { contains: parts[0], mode: 'insensitive' } },
            { lastName: { contains: parts[parts.length - 1], mode: 'insensitive' } },
          ],
        },
      });
      if (foundTa) targetTaId = foundTa.id;
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
