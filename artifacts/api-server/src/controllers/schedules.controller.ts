/**
 * schedules.controller.ts
 *
 * Public barrel for schedule controllers.
 *
 * Responsibilities retained here:
 *   - getWeeklyTimetable / getAllSchedules  (read-only list with role-based scoping)
 *
 * Responsibilities delegated to sub-controllers:
 *   - CRUD / lifecycle  → schedulesMutation.controller.ts
 *   - Bulk grid sync    → schedulesSync.controller.ts
 *   - Conflict check    → schedulesConflict.controller.ts
 *
 * Re-exporting from sub-controllers keeps the router and tests unchanged.
 */

import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prismaClient';
import { getScopeWhere } from '../utils/scope.utils';
import catchAsync from '../utils/catchAsync';

export {
  createSchedule,
  updateSchedule,
  deleteSchedule,
  archiveSchedule,
  restoreSchedule,
} from './schedulesMutation.controller';
export { syncGridToMaster } from './schedulesSync.controller';
export { checkScheduleConflict } from './schedulesConflict.controller';

export const getWeeklyTimetable = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const {
      departmentId,
      collegeId,
      year,
      semester,
      timetableId,
      doctorId,
      teachingAssistantId,
      page: pageParam,
      limit: limitParam,
    } = req.query as Record<string, string>;
    const { user } = req;

    const parsedPage = Number(pageParam);
    const parsedLimit = Number(limitParam);
    const page = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const limit = Number.isSafeInteger(parsedLimit) && parsedLimit > 0
      ? Math.min(parsedLimit, 100)
      : 20;
    const skip = (page - 1) * limit;
    const take = limit;

    const filterYear = year ? parseInt(year) : undefined;
    const filterSemester = semester ? parseInt(semester) : undefined;

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
        return res.json({
          success: true,
          data: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 1,
          },
        });
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
        // Fetch all department groups in a single batch read to avoid point reads per ancestry level
        const deptGroups = student.departmentId
          ? await prisma.studentGroup.findMany({
              where: { departmentId: student.departmentId },
              select: { id: true, parentGroupId: true },
            })
          : [];
        const groupParentMap = new Map<number, number | null>();
        for (const g of deptGroups) {
          groupParentMap.set(g.id, g.parentGroupId);
        }

        const groupIds: number[] = [];
        let currentGroupId: number | null = student.groupId;
        while (currentGroupId) {
          groupIds.push(currentGroupId);
          currentGroupId = groupParentMap.get(currentGroupId) ?? null;
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
      if (!doctor) {
        return res.json({
          success: true,
          data: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 1,
          },
        });
      }
      whereClause = { doctorId: doctor.id };
    } else if (user!.role === 'TEACHING_ASSISTANT') {
      const ta = await prisma.teachingAssistant.findUnique({ where: { userId: user!.id } });
      if (!ta) {
        return res.json({
          success: true,
          data: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 1,
          },
        });
      }
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

    const [scheduleSlots, total] = await Promise.all([
      prisma.scheduleSlot.findMany({
        where: whereClause,
        include: includeRelations,
        skip,
        take,
      }),
      prisma.scheduleSlot.count({ where: whereClause }),
    ]);

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

    return res.json({
      success: true,
      data: finalSlots,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  }
);

export const getAllSchedules = getWeeklyTimetable; // Aliasing
