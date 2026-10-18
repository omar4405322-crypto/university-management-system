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
import { normalizeSlotType } from '../utils/slotType.utils';
import { AppError, AuthorizationError } from '../utils/appError';

export {
  createSchedule,
  updateSchedule,
  deleteSchedule,
  archiveSchedule,
  restoreSchedule,
} from './schedulesMutation.controller';
export { syncGridToMaster } from './schedulesSync.controller';
export { checkScheduleConflict } from './schedulesConflict.controller';

const VALID_DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

function parsePositiveInt(val: unknown, name: string): number | undefined {
  if (val === undefined || val === null || val === '') return undefined;
  const num = Number(val);
  if (!Number.isSafeInteger(num) || num <= 0) {
    throw new AppError(`Invalid ${name}: must be a positive integer`, 400);
  }
  return num;
}

const getSlotTypePrismaCondition = (type: 'LECTURE' | 'LAB') => {
  return type === 'LAB' ? { in: ['LAB', 'SECTION'] } : 'LECTURE';
};

export const getWeeklyTimetable = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const {
      departmentId,
      collegeId,
      courseId,
      doctorId,
      teachingAssistantId,
      roomId,
      termId,
      year,
      semester,
      timetableId,
      slotType,
      dayOfWeek,
      page: pageParam,
      limit: limitParam,
    } = req.query as Record<string, string>;
    const { user } = req;

    let normalizedSlotType: 'LECTURE' | 'LAB' | undefined = undefined;
    if (slotType !== undefined && slotType !== '') {
      const upper = String(slotType).trim().toUpperCase();
      if (upper !== 'LECTURE' && upper !== 'LAB') {
        throw new AppError('Invalid slotType: must be LECTURE or LAB', 400);
      }
      normalizedSlotType = upper;
    }

    let normalizedDayOfWeek: string | undefined = undefined;
    if (dayOfWeek !== undefined && dayOfWeek !== '') {
      const upper = String(dayOfWeek).trim().toUpperCase();
      if (!VALID_DAYS.includes(upper)) {
        throw new AppError(
          'Invalid dayOfWeek: must be one of SUNDAY, MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY',
          400
        );
      }
      normalizedDayOfWeek = upper;
    }

    const parsedDeptId = parsePositiveInt(departmentId, 'departmentId');
    const parsedCollegeId = parsePositiveInt(collegeId, 'collegeId');
    const parsedCourseId = parsePositiveInt(courseId, 'courseId');
    const parsedDoctorId = parsePositiveInt(doctorId, 'doctorId');
    const parsedRoomId = parsePositiveInt(roomId, 'roomId');
    const parsedTermId = parsePositiveInt(termId, 'termId');
    const parsedYear = parsePositiveInt(year, 'year');
    const parsedSemester = parsePositiveInt(semester, 'semester');
    const parsedTimetableId = parsePositiveInt(timetableId, 'timetableId');
    const rawTAId = teachingAssistantId !== undefined && teachingAssistantId !== '' ? String(teachingAssistantId).trim() : undefined;

    const parsedPage = Number(pageParam);
    const parsedLimit = Number(limitParam);
    const page = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const limit = Number.isSafeInteger(parsedLimit) && parsedLimit > 0
      ? Math.min(parsedLimit, 100)
      : 20;
    const skip = (page - 1) * limit;
    const take = limit;

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
      },
      timetable: {
        select: { id: true, status: true, title: true }
      }
    };

    if (user!.role === 'STUDENT') {
      const student = await prisma.student.findUnique({
        where: { userId: user!.id },
        select: {
          id: true,
          groupId: true,
          departmentId: true,
          year: true,
          department: { select: { id: true, collegeId: true } },
        },
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

      // OD-34 scope checks for STUDENT
      if (parsedDeptId !== undefined && student.departmentId && parsedDeptId !== student.departmentId) {
        throw new AuthorizationError('Cannot access schedules outside your department');
      }
      if (parsedCollegeId !== undefined && student.department?.collegeId && parsedCollegeId !== student.department.collegeId) {
        throw new AuthorizationError('Cannot access schedules outside your college');
      }
      if (parsedYear !== undefined && parsedYear !== student.year) {
        throw new AuthorizationError('Cannot access schedules outside your academic year');
      }

      const enrollments = await prisma.enrollment.findMany({
        where: { studentId: student.id, status: 'ENROLLED' },
        select: { courseId: true },
      });
      const enrolledCourseIds = enrollments.map((e) => e.courseId);

      if (parsedCourseId !== undefined && !enrolledCourseIds.includes(parsedCourseId)) {
        throw new AuthorizationError('Cannot access schedules for non-enrolled courses');
      }

      if (parsedDoctorId !== undefined) {
        const doctorTeaches = await prisma.scheduleSlot.findFirst({
          where: {
            doctorId: parsedDoctorId,
            courseId: { in: enrolledCourseIds },
            timetable: { status: 'PUBLISHED' },
          },
          select: { id: true },
        });
        if (!doctorTeaches) {
          throw new AuthorizationError('Doctor does not teach any of your enrolled courses');
        }
      }

      if (rawTAId !== undefined) {
        const taTeaches = await prisma.scheduleSlot.findFirst({
          where: {
            teachingAssistantId: rawTAId,
            courseId: { in: enrolledCourseIds },
            timetable: { status: 'PUBLISHED' },
          },
          select: { id: true },
        });
        if (!taTeaches) {
          throw new AuthorizationError('Teaching assistant does not teach any of your enrolled courses');
        }
      }

      // Build semester/year constraints scoped to the student's own profile
      const studentYearFilter = student.year;
      const baseCourseFilter: any = { departmentId: student.departmentId, year: studentYearFilter };
      if (parsedSemester !== undefined) baseCourseFilter.semester = parsedSemester;

      const enrolledCourseFilter: any = { id: { in: enrolledCourseIds }, isPublished: true };
      if (parsedSemester !== undefined) enrolledCourseFilter.semester = parsedSemester;

      let groupCondition: any;
      if (student.groupId) {
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

        groupCondition = {
          OR: [
            { groupId: { in: groupIds }, course: { isPublished: true } },
            { groupId: null, course: { ...baseCourseFilter, isPublished: true } },
            { groupId: null, course: enrolledCourseFilter },
          ],
        };
      } else {
        groupCondition = {
          OR: [
            { course: { ...baseCourseFilter, isPublished: true } },
            { course: enrolledCourseFilter },
          ],
        };
      }

      whereClause = {
        AND: [
          { timetable: { status: 'PUBLISHED' } },
          groupCondition,
        ],
      };

      if (normalizedSlotType) {
        whereClause.AND.push({ slotType: getSlotTypePrismaCondition(normalizedSlotType) });
      }
      if (normalizedDayOfWeek) {
        whereClause.AND.push({ dayOfWeek: normalizedDayOfWeek });
      }
      if (parsedCourseId) {
        whereClause.AND.push({ courseId: parsedCourseId });
      }
      if (parsedDoctorId) {
        whereClause.AND.push({ doctorId: parsedDoctorId });
      }
      if (rawTAId) {
        whereClause.AND.push({ teachingAssistantId: rawTAId });
      }

      Object.defineProperty(whereClause, '__studentScopedFiltersApplied', { value: true, enumerable: false });
    } else if (user!.role === 'DOCTOR') {
      const doctor = await prisma.doctor.findUnique({
        where: { userId: user!.id },
        select: { id: true, departmentId: true, department: { select: { collegeId: true } } },
      });
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

      // OD-34 scope checks for DOCTOR
      if (parsedDoctorId !== undefined && parsedDoctorId !== doctor.id) {
        throw new AuthorizationError('Cannot access schedules for another doctor');
      }

      const doctorSlots = await prisma.scheduleSlot.findMany({
        where: { doctorId: doctor.id, timetable: { status: 'PUBLISHED' } },
        select: { courseId: true, teachingAssistantId: true, course: { select: { year: true } } },
      });
      const doctorCourseIds = new Set(doctorSlots.map((s) => s.courseId));
      const doctorCourseYears = new Set(
        doctorSlots.map((s) => s.course?.year).filter((y): y is number => typeof y === 'number')
      );
      const doctorTAIds = new Set(doctorSlots.map((s) => s.teachingAssistantId).filter(Boolean));

      if (parsedCourseId !== undefined && !doctorCourseIds.has(parsedCourseId)) {
        throw new AuthorizationError('Cannot access schedules for a course you do not teach');
      }
      if (parsedYear !== undefined && !doctorCourseYears.has(parsedYear)) {
        throw new AuthorizationError('Cannot access schedules for a year with no assigned courses');
      }
      if (rawTAId !== undefined && !doctorTAIds.has(rawTAId)) {
        throw new AuthorizationError('Cannot access schedules for another teaching assistant');
      }
      if (parsedDeptId !== undefined && doctor.departmentId && parsedDeptId !== doctor.departmentId) {
        throw new AuthorizationError('Cannot access schedules outside your department');
      }
      if (parsedCollegeId !== undefined && doctor.department?.collegeId && parsedCollegeId !== doctor.department.collegeId) {
        throw new AuthorizationError('Cannot access schedules outside your college');
      }

      whereClause = {
        doctorId: doctor.id,
        timetable: { status: 'PUBLISHED' },
      };

      if (parsedCourseId) whereClause.courseId = parsedCourseId;
      if (parsedYear) whereClause.course = { ...(whereClause.course || {}), year: parsedYear };
      if (parsedSemester) whereClause.course = { ...(whereClause.course || {}), semester: parsedSemester };
      if (normalizedSlotType) {
        whereClause.slotType = getSlotTypePrismaCondition(normalizedSlotType);
      }
      if (normalizedDayOfWeek) whereClause.dayOfWeek = normalizedDayOfWeek;
      if (rawTAId) whereClause.teachingAssistantId = rawTAId;
    } else if (user!.role === 'TEACHING_ASSISTANT') {
      const ta = await prisma.teachingAssistant.findUnique({
        where: { userId: user!.id },
        select: { id: true, departmentId: true, department: { select: { collegeId: true } } },
      });
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

      // OD-34 scope checks for TEACHING_ASSISTANT
      if (rawTAId !== undefined && rawTAId !== String(ta.id)) {
        throw new AuthorizationError('Cannot access schedules for another teaching assistant');
      }

      const assignedSlots = await prisma.scheduleSlot.findMany({
        where: { teachingAssistantId: ta.id, timetable: { status: 'PUBLISHED' } },
        select: { courseId: true, doctorId: true, course: { select: { year: true } } },
      });
      const assignedCourseIds = new Set(assignedSlots.map((s) => s.courseId));
      const assignedDoctorIds = new Set(assignedSlots.map((s) => s.doctorId).filter(Boolean));
      const taCourseYears = new Set(
        assignedSlots.map((s) => s.course?.year).filter((y): y is number => typeof y === 'number')
      );

      if (parsedCourseId !== undefined && !assignedCourseIds.has(parsedCourseId)) {
        throw new AuthorizationError('Cannot access schedules for unassigned course');
      }
      if (parsedYear !== undefined && !taCourseYears.has(parsedYear)) {
        throw new AuthorizationError('Cannot access schedules for a year with no assigned courses');
      }
      if (parsedDoctorId !== undefined && !assignedDoctorIds.has(parsedDoctorId)) {
        throw new AuthorizationError('Cannot access schedules for another doctor');
      }
      if (parsedDeptId !== undefined && ta.departmentId && parsedDeptId !== ta.departmentId) {
        throw new AuthorizationError('Cannot access schedules outside your department');
      }
      if (parsedCollegeId !== undefined && ta.department?.collegeId && parsedCollegeId !== ta.department.collegeId) {
        throw new AuthorizationError('Cannot access schedules outside your college');
      }

      whereClause = {
        teachingAssistantId: ta.id,
        timetable: { status: 'PUBLISHED' },
      };

      if (parsedCourseId) whereClause.courseId = parsedCourseId;
      if (normalizedSlotType) {
        whereClause.slotType = getSlotTypePrismaCondition(normalizedSlotType);
      }
      if (normalizedDayOfWeek) whereClause.dayOfWeek = normalizedDayOfWeek;
      if (parsedDoctorId) whereClause.doctorId = parsedDoctorId;
      if (parsedYear) whereClause.course = { ...(whereClause.course || {}), year: parsedYear };
      if (parsedSemester) whereClause.course = { ...(whereClause.course || {}), semester: parsedSemester };
    } else if (user!.role === 'DEPARTMENT_ADMIN') {
      const managedDeptId = user!.managedDepartmentId || user!.departmentId;
      if (!managedDeptId) {
        throw new AuthorizationError('Department admin has no assigned department');
      }

      if (parsedDeptId !== undefined && parsedDeptId !== managedDeptId) {
        throw new AuthorizationError('Cannot access schedules for another department');
      }

      if (parsedCollegeId !== undefined) {
        const deptRecord = await prisma.department.findUnique({
          where: { id: managedDeptId },
          select: { collegeId: true },
        });
        if (deptRecord?.collegeId && parsedCollegeId !== deptRecord.collegeId) {
          throw new AuthorizationError('Cannot access schedules outside your department college');
        }
      }

      if (parsedDoctorId !== undefined) {
        const docInDept = await prisma.doctor.findFirst({
          where: { id: parsedDoctorId, departmentId: managedDeptId },
          select: { id: true },
        });
        if (!docInDept) {
          throw new AuthorizationError('Doctor does not belong to your department');
        }
      }

      if (rawTAId !== undefined) {
        const taInDept = await prisma.teachingAssistant.findFirst({
          where: { id: rawTAId, departmentId: managedDeptId },
          select: { id: true },
        });
        if (!taInDept) {
          throw new AuthorizationError('Teaching assistant does not belong to your department');
        }
      }

      if (parsedCourseId !== undefined) {
        const courseInDept = await prisma.course.findFirst({
          where: { id: parsedCourseId, departmentId: managedDeptId },
          select: { id: true },
        });
        if (!courseInDept) {
          throw new AuthorizationError('Course does not belong to your department');
        }
      }

      whereClause = {
        course: { departmentId: managedDeptId },
      };

      if (parsedDoctorId) whereClause.doctorId = parsedDoctorId;
      if (rawTAId) whereClause.teachingAssistantId = rawTAId;
      if (parsedCourseId) whereClause.courseId = parsedCourseId;
      if (parsedYear) whereClause.course.year = parsedYear;
      if (parsedSemester) whereClause.course.semester = parsedSemester;
      if (parsedRoomId) whereClause.roomId = parsedRoomId;
      if (parsedTermId) whereClause.termId = parsedTermId;
      if (normalizedSlotType) {
        whereClause.slotType = getSlotTypePrismaCondition(normalizedSlotType);
      }
      if (normalizedDayOfWeek) whereClause.dayOfWeek = normalizedDayOfWeek;
    } else if (user!.role === 'COLLEGE_ADMIN') {
      const managedCollegeId = user!.managedCollegeId || user!.collegeId;
      if (!managedCollegeId) {
        throw new AuthorizationError('College admin has no assigned college');
      }

      if (parsedCollegeId !== undefined && parsedCollegeId !== managedCollegeId) {
        throw new AuthorizationError('Cannot access schedules for another college');
      }

      if (parsedDeptId !== undefined) {
        const deptInCol = await prisma.department.findFirst({
          where: { id: parsedDeptId, collegeId: managedCollegeId },
          select: { id: true },
        });
        if (!deptInCol) {
          throw new AuthorizationError('Department does not belong to your college');
        }
      }

      if (parsedDoctorId !== undefined) {
        const docInCol = await prisma.doctor.findFirst({
          where: { id: parsedDoctorId, department: { collegeId: managedCollegeId } },
          select: { id: true },
        });
        if (!docInCol) {
          throw new AuthorizationError('Doctor does not belong to your college');
        }
      }

      if (rawTAId !== undefined) {
        const taInCol = await prisma.teachingAssistant.findFirst({
          where: { id: rawTAId, department: { collegeId: managedCollegeId } },
          select: { id: true },
        });
        if (!taInCol) {
          throw new AuthorizationError('Teaching assistant does not belong to your college');
        }
      }

      if (parsedCourseId !== undefined) {
        const courseInCol = await prisma.course.findFirst({
          where: { id: parsedCourseId, department: { collegeId: managedCollegeId } },
          select: { id: true },
        });
        if (!courseInCol) {
          throw new AuthorizationError('Course does not belong to your college');
        }
      }

      whereClause = {
        course: {
          department: { collegeId: managedCollegeId },
          ...(parsedDeptId ? { departmentId: parsedDeptId } : {}),
        },
      };

      if (parsedDoctorId) whereClause.doctorId = parsedDoctorId;
      if (rawTAId) whereClause.teachingAssistantId = rawTAId;
      if (parsedCourseId) whereClause.courseId = parsedCourseId;
      if (parsedYear) whereClause.course.year = parsedYear;
      if (parsedSemester) whereClause.course.semester = parsedSemester;
      if (parsedRoomId) whereClause.roomId = parsedRoomId;
      if (parsedTermId) whereClause.termId = parsedTermId;
      if (normalizedSlotType) {
        whereClause.slotType = getSlotTypePrismaCondition(normalizedSlotType);
      }
      if (normalizedDayOfWeek) whereClause.dayOfWeek = normalizedDayOfWeek;
    } else {
      // SUPER_ADMIN (or legacy/unscoped)
      const scopeWhere: any = getScopeWhere(req.user!, 'course');
      whereClause = {};
      if (parsedDoctorId) {
        whereClause.doctorId = parsedDoctorId;
      }
      if (rawTAId) {
        whereClause.teachingAssistantId = rawTAId;
      }
      if (parsedRoomId) {
        whereClause.roomId = parsedRoomId;
      }
      if (parsedTermId) {
        whereClause.termId = parsedTermId;
      }
      if (parsedDeptId) {
        whereClause.course = { departmentId: parsedDeptId };
      } else if (parsedCollegeId) {
        whereClause.course = { department: { collegeId: parsedCollegeId } };
      }
      if (scopeWhere && Object.keys(scopeWhere).length > 0) {
        whereClause.course = { ...whereClause.course, ...scopeWhere };
      }
      if (parsedCourseId) whereClause.courseId = parsedCourseId;
      if (parsedYear) whereClause.course = { ...(whereClause.course || {}), year: parsedYear };
      if (parsedSemester) whereClause.course = { ...(whereClause.course || {}), semester: parsedSemester };
      if (normalizedSlotType) {
        whereClause.slotType = getSlotTypePrismaCondition(normalizedSlotType);
      }
      if (normalizedDayOfWeek) whereClause.dayOfWeek = normalizedDayOfWeek;
    }

    if (parsedTimetableId) {
      whereClause.timetableId = parsedTimetableId;
    }
    if (parsedRoomId && whereClause.roomId === undefined) {
      whereClause.roomId = parsedRoomId;
    }
    if (parsedTermId && whereClause.termId === undefined) {
      whereClause.termId = parsedTermId;
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
      const normalizedSlotType = normalizeSlotType(slot.slotType);
      if (slot.overrides && slot.overrides.length > 0) {
        const override = slot.overrides[0];
        return {
          ...slot,
          slotType: normalizedSlotType,
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
      return {
        ...slot,
        slotType: normalizedSlotType,
      };
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
export const getAllSchedules = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    res.set('Deprecation', 'true');
    res.set('Link', '</api/schedules/week>; rel="successor-version"');
    return getWeeklyTimetable(req, res, next);
  }
);
