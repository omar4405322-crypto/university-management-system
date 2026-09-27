/**
 * schedulesSync.controller.ts
 *
 * Handles the bulk timetable grid → master schedule sync operation.
 * Performs in-memory course/staff resolution against pre-fetched department
 * data then batch-upserts ScheduleSlots.
 */

import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prismaClient';
import { Prisma } from '@prisma/client';
import { auditLog } from '../utils/audit.utils';
import {
  getEffectiveActiveDoctorWhere,
  getEffectiveActiveTeachingAssistantWhere,
  getScopeWhere,
} from '../utils/scope.utils';
import catchAsync from '../utils/catchAsync';
import { AuthorizationError, ValidationError } from '../utils/appError';
import { MAX_SCHEDULE_SYNC_SLOTS } from '../utils/requestLimits';
import { StaffResolveResult } from './schedulesStaffResolver';

// ── In-memory staff matchers (work on pre-fetched dept arrays) ────────────────

type DeptDoctor = { id: number; firstName: string | null; lastName: string | null; departmentId: number | null };
type DeptTa = { id: string; firstName: string | null; lastName: string | null; departmentId: number | null };

function buildDoctorMatcher(departmentDoctors: DeptDoctor[]) {
  return function matchDoctor(rawName: string): StaffResolveResult<number> {
    const cleanName = rawName
      .trim()
      .replace(/^(د\.|دكتور\s+|dr\.|dr\s+|أ\.د\.|prof\.|prof\s+)\s*/i, '')
      .trim();
    const parts = cleanName.split(/\s+/).filter(Boolean).map((p) => p.toLowerCase());
    if (parts.length === 0) return { id: null, isAmbiguous: false, matchCount: 0 };

    const filterDocs = (docs: DeptDoctor[], mode: 'exact' | 'contains') =>
      docs.filter((doc) => {
        const f = (doc.firstName || '').toLowerCase();
        const l = (doc.lastName || '').toLowerCase();
        if (parts.length >= 2) {
          const tf = parts[0];
          const tl = parts[parts.length - 1];
          return mode === 'exact' ? f === tf && l === tl : f.includes(tf) && l.includes(tl);
        }
        const t = parts[0];
        return mode === 'exact' ? f === t || l === t : f.includes(t) || l.includes(t);
      });

    let candidates = filterDocs(departmentDoctors, 'exact');
    if (candidates.length === 1) return { id: candidates[0].id, isAmbiguous: false, matchCount: 1 };
    if (candidates.length > 1) return { id: null, isAmbiguous: true, matchCount: candidates.length };

    candidates = filterDocs(departmentDoctors, 'contains');
    if (candidates.length === 1) return { id: candidates[0].id, isAmbiguous: false, matchCount: 1 };
    if (candidates.length > 1) return { id: null, isAmbiguous: true, matchCount: candidates.length };

    return { id: null, isAmbiguous: false, matchCount: 0 };
  };
}

function buildTaMatcher(departmentTas: DeptTa[]) {
  return function matchTeachingAssistant(rawName: string): StaffResolveResult<string> {
    const cleanName = rawName
      .trim()
      .replace(/^(م\.|مهندس\s+|eng\.|eng\s+|ta\.|ta\s+|معيد\s+)\s*/i, '')
      .trim();
    const parts = cleanName.split(/\s+/).filter(Boolean).map((p) => p.toLowerCase());
    if (parts.length === 0) return { id: null, isAmbiguous: false, matchCount: 0 };

    const filter = (mode: 'exact' | 'contains') =>
      departmentTas.filter((ta) => {
        const f = (ta.firstName || '').toLowerCase();
        const l = (ta.lastName || '').toLowerCase();
        if (parts.length >= 2) {
          const tf = parts[0];
          const tl = parts[parts.length - 1];
          return mode === 'exact' ? f === tf && l === tl : f.includes(tf) && l.includes(tl);
        }
        const t = parts[0];
        return mode === 'exact' ? f === t || l === t : f.includes(t) || l.includes(t);
      });

    let candidates = filter('exact');
    if (candidates.length === 1) return { id: candidates[0].id, isAmbiguous: false, matchCount: 1 };
    if (candidates.length > 1) return { id: null, isAmbiguous: true, matchCount: candidates.length };

    candidates = filter('contains');
    if (candidates.length === 1) return { id: candidates[0].id, isAmbiguous: false, matchCount: 1 };
    if (candidates.length > 1) return { id: null, isAmbiguous: true, matchCount: candidates.length };

    return { id: null, isAmbiguous: false, matchCount: 0 };
  };
}

// ── Handler ───────────────────────────────────────────────────────────────────

export const syncGridToMaster = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { departmentId, academicYear, semester, slots } = req.body;

    if (!Array.isArray(slots) || slots.length === 0 || slots.length > MAX_SCHEDULE_SYNC_SLOTS) {
      return next(
        new ValidationError(`Slots must contain between 1 and ${MAX_SCHEDULE_SYNC_SLOTS} items`)
      );
    }

    const parsedDeptId = Number(departmentId);
    if (!Number.isSafeInteger(parsedDeptId) || parsedDeptId <= 0) {
      return next(new ValidationError('departmentId must be a positive integer'));
    }

    // Enforce Admin Scope
    const deptScope = getScopeWhere(req.user!, 'department') as Record<string, unknown>;
    if (deptScope && Object.keys(deptScope).length) {
      if (deptScope['id'] && parsedDeptId !== deptScope['id']) {
        return next(new AuthorizationError('Access denied'));
      }
      if (deptScope['collegeId']) {
        const dept = await prisma.department.findUnique({
          where: { id: parsedDeptId },
          select: { collegeId: true },
        });
        if (!dept || dept.collegeId !== deptScope['collegeId']) {
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

    // 2. Pre-fetch courses for the selected department
    const allCourses = await prisma.course.findMany({
      where: { departmentId: parsedDeptId },
      select: { id: true, name: true, courseCode: true, departmentId: true },
    });

    // 3. Pre-fetch staff in the selected department
    const departmentDoctors = await prisma.doctor.findMany({
      where: getEffectiveActiveDoctorWhere({ departmentId: parsedDeptId }),
      select: { id: true, firstName: true, lastName: true, departmentId: true },
    });
    const departmentTeachingAssistants = await prisma.teachingAssistant.findMany({
      where: getEffectiveActiveTeachingAssistantWhere({ departmentId: parsedDeptId }),
      select: { id: true, firstName: true, lastName: true, departmentId: true },
    });

    // 4. Pre-fetch existing ScheduleSlots for matched courses
    const allCourseIds = allCourses.map((c) => c.id);
    const existingSlots =
      allCourseIds.length > 0
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

    const existingSlotMap = new Map<string, (typeof existingSlots)[0]>();
    for (const s of existingSlots) {
      const key = `${s.courseId}-${s.dayOfWeek.toUpperCase()}-${s.startTime}`;
      existingSlotMap.set(key, s);
    }

    // In-memory matchers
    const matchCourse = (rawName: string) => {
      const trimmed = rawName.trim().toLowerCase();
      const exact = allCourses.filter(
        (c) => c.name.toLowerCase() === trimmed || c.courseCode.toLowerCase() === trimmed
      );
      if (exact.length === 1) return { course: exact[0], isAmbiguous: false, matchCount: 1 };
      if (exact.length > 1) return { course: null, isAmbiguous: true, matchCount: exact.length };

      const contains = allCourses.filter(
        (c) => c.name.toLowerCase().includes(trimmed) || c.courseCode.toLowerCase().includes(trimmed)
      );
      if (contains.length === 1) return { course: contains[0], isAmbiguous: false, matchCount: 1 };
      if (contains.length > 1) return { course: null, isAmbiguous: true, matchCount: contains.length };

      return { course: null, isAmbiguous: false, matchCount: 0 };
    };

    const matchDoctor = buildDoctorMatcher(departmentDoctors);
    const matchTeachingAssistant = buildTaMatcher(departmentTeachingAssistants);

    let syncedCount = 0;
    let skippedCount = 0;
    const skippedSlots: Array<{ courseName: string; reason: string }> = [];

    const updatesToRun: Array<{ where: { id: number }; data: Prisma.ScheduleSlotUpdateInput }> = [];
    const createsToRun: Prisma.ScheduleSlotCreateManyInput[] = [];

    for (const slot of slots as Array<Record<string, unknown>>) {
      const {
        day,
        startTime,
        endTime,
        courseName,
        courseId,
        instructor,
        doctorId: suppliedDoctorId,
        teachingAssistantId: suppliedTeachingAssistantId,
        room,
        slotType,
      } = slot;

      if (!courseName || typeof courseName !== 'string') continue;

      const trimmedName = courseName.trim();
      const courseMatch = courseId
        ? {
            course: allCourses.find((c) => c.id === Number(courseId)) ?? null,
            isAmbiguous: false,
            matchCount: 0,
          }
        : matchCourse(trimmedName);

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
          reason: courseId
            ? `COURSE_ID_NOT_IN_SCOPE: Course ID '${courseId}' is not in the selected department`
            : `COURSE_NOT_FOUND: No scoped course matching '${trimmedName}'`,
        });
        continue;
      }

      let doctorId: number | null = null;
      let teachingAssistantId: string | null = null;
      const effectiveSlotType = String(slotType || 'LECTURE').toUpperCase();
      const usesTeachingAssistant = effectiveSlotType === 'LAB' || effectiveSlotType === 'SECTION';

      if (usesTeachingAssistant) {
        if (suppliedTeachingAssistantId) {
          const scopedTa = departmentTeachingAssistants.find(
            (ta) => ta.id === String(suppliedTeachingAssistantId)
          );
          if (!scopedTa) {
            skippedCount++;
            skippedSlots.push({
              courseName: trimmedName,
              reason: `INSTRUCTOR_ID_NOT_IN_SCOPE: Teaching assistant ID '${suppliedTeachingAssistantId}' is not in the selected department`,
            });
            continue;
          }
          teachingAssistantId = scopedTa.id;
        } else if (instructor && typeof instructor === 'string') {
          const taResolve = matchTeachingAssistant(instructor);
          if (taResolve.isAmbiguous) {
            skippedCount++;
            skippedSlots.push({
              courseName: trimmedName,
              reason: `AMBIGUOUS_INSTRUCTOR_MATCH: ${taResolve.matchCount} teaching assistants matched '${instructor}'`,
            });
            continue;
          }
          if (taResolve.id) {
            teachingAssistantId = taResolve.id;
          } else {
            skippedCount++;
            skippedSlots.push({
              courseName: trimmedName,
              reason: `INSTRUCTOR_NOT_FOUND: No scoped teaching assistant matching '${instructor}'`,
            });
            continue;
          }
        }
      } else {
        if (suppliedDoctorId) {
          const scopedDoctor = departmentDoctors.find((doc) => doc.id === Number(suppliedDoctorId));
          if (!scopedDoctor) {
            skippedCount++;
            skippedSlots.push({
              courseName: trimmedName,
              reason: `INSTRUCTOR_ID_NOT_IN_SCOPE: Doctor ID '${suppliedDoctorId}' is not in the selected department`,
            });
            continue;
          }
          doctorId = scopedDoctor.id;
        } else if (instructor && typeof instructor === 'string') {
          const docResolve = matchDoctor(instructor);
          if (docResolve.isAmbiguous) {
            skippedCount++;
            skippedSlots.push({
              courseName: trimmedName,
              reason: `AMBIGUOUS_INSTRUCTOR_MATCH: ${docResolve.matchCount} instructors matched '${instructor}'`,
            });
            continue;
          }
          if (docResolve.id) {
            doctorId = docResolve.id;
          } else {
            skippedCount++;
            skippedSlots.push({
              courseName: trimmedName,
              reason: `INSTRUCTOR_NOT_FOUND: No scoped instructor matching '${instructor}'`,
            });
            continue;
          }
        }
      }

      const normalizedDay = (typeof day === 'string' ? day : 'MONDAY').toUpperCase();
      const normalizedStartTime = typeof startTime === 'string' ? startTime : '09:00';
      const slotKey = `${course.id}-${normalizedDay}-${normalizedStartTime}`;
      const existingSlot = existingSlotMap.get(slotKey);

      if (existingSlot) {
        existingSlotMap.delete(slotKey);
        updatesToRun.push({
          where: { id: existingSlot.id },
          data: {
            endTime: typeof endTime === 'string' ? endTime : '11:00',
            room: room !== undefined ? (room ? String(room).trim() : null) : existingSlot.room,
            slotType: effectiveSlotType || existingSlot.slotType,
            ...(doctorId ? { doctor: { connect: { id: doctorId } }, teachingAssistantId: null } : {}),
            ...(teachingAssistantId ? { teachingAssistantId, doctorId: null } : {}),
            ...(timetableId ? { timetableId } : {}),
          } as Prisma.ScheduleSlotUpdateInput,
        });
      } else if (doctorId || teachingAssistantId) {
        createsToRun.push({
          courseId: course.id,
          groupId: null,
          doctorId,
          teachingAssistantId,
          timetableId,
          slotType: effectiveSlotType,
          dayOfWeek: normalizedDay,
          startTime: normalizedStartTime,
          endTime: typeof endTime === 'string' ? endTime : '11:00',
          room: room ? String(room).trim() : null,
        } as Prisma.ScheduleSlotCreateManyInput);
      } else {
        skippedCount++;
        skippedSlots.push({
          courseName: trimmedName,
          reason: 'INSTRUCTOR_REQUIRED: A stable instructor ID or unique scoped name is required for a new slot',
        });
        continue;
      }
      syncedCount++;
    }

    // 5. Batch database execution
    if (updatesToRun.length > 0 || createsToRun.length > 0) {
      await prisma.$transaction([
        ...updatesToRun.map((u) =>
          prisma.scheduleSlot.update({ where: u.where, data: u.data })
        ),
        ...(createsToRun.length > 0
          ? [prisma.scheduleSlot.createMany({ data: createsToRun })]
          : []),
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
