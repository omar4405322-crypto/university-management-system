import { AttendanceMethod, AttendanceStatus, Prisma } from '@prisma/client';
import { fromZonedTime } from 'date-fns-tz';
import prisma from '../utils/prismaClient';
import {
  AppError,
  AuthorizationError,
  ConflictError,
  NotFoundError,
} from '../utils/appError';
import { getScopeWhere } from '../utils/scope.utils';
import type { AuthActor } from '../types/auth.types';
import attendanceEngine, { BulkManualRecord } from '../attendance/attendance.engine';
import { DriverValidationContext } from '../attendance/drivers/IAttendanceDriver';
import {
  getAttendanceAuditCourseWhere,
  getFlagOverrideAttendanceWhere,
} from '../utils/attendanceAuditScope.utils';
import { isAdminMutationScopeConfigured } from '../utils/adminMutationScope.utils';
import crypto from 'crypto';
import { encrypt } from '../utils/encryption.utils';
import {
  calculateAttendanceAttempts,
  combineAttendanceCalculations,
  selectAbsenceThreshold,
} from '../attendance/attendance.calculation';

import { AttendanceDeviceService } from '../attendance/attendance.devices';
import {
  AttendanceWarningService,
  StaffWarningStage,
  StaffWarningOptions,
  StaffWarningSqlRow,
  StaffWarningQueryRow,
  ATTENDANCE_TIME_ZONE,
  DEFAULT_ATTENDANCE_PAGE_SIZE,
  MAX_ATTENDANCE_PAGE_SIZE,
  STAFF_WARNING_EXPORT_LIMIT,
} from '../attendance/attendance.warnings';

export type {
  StaffWarningStage,
  StaffWarningOptions,
  StaffWarningSqlRow,
  StaffWarningQueryRow,
};

type AttendanceHistoryOptions = {
  date?: string;
  startDate?: string;
  endDate?: string;
  semester?: number;
  academicYear?: number;
  page?: number;
  limit?: number;
};

type MyAttendanceOptions = AttendanceHistoryOptions & {
  courseId?: number;
};

const normalizePagination = (page?: number, limit?: number) => {
  const normalizedPage = Number.isFinite(page) && Number(page) > 0
    ? Math.floor(Number(page))
    : 1;
  const normalizedLimit = Number.isFinite(limit) && Number(limit) > 0
    ? Math.min(Math.floor(Number(limit)), MAX_ATTENDANCE_PAGE_SIZE)
    : DEFAULT_ATTENDANCE_PAGE_SIZE;

  return {
    page: normalizedPage,
    limit: normalizedLimit,
    skip: (normalizedPage - 1) * normalizedLimit,
  };
};

const nextDateOnly = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return next.toISOString().slice(0, 10);
};

const cairoBoundary = (value: string, endExclusive: boolean) => {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const input = dateOnly && endExclusive ? nextDateOnly(value) : value;
  const parsed = dateOnly
    ? fromZonedTime(`${input}T00:00:00`, ATTENDANCE_TIME_ZONE)
    : new Date(input);

  if (Number.isNaN(parsed.getTime())) {
    throw new AppError(`Invalid attendance date: ${value}`, 400);
  }
  return parsed;
};

const buildDateWhere = (
  date?: string,
  startDate?: string,
  endDate?: string
): Prisma.DateTimeFilter | undefined => {
  if (date) {
    return {
      gte: cairoBoundary(date, false),
      lt: cairoBoundary(date, true),
    };
  }

  if (!startDate && !endDate) return undefined;

  const range: Prisma.DateTimeFilter = {};
  if (startDate) range.gte = cairoBoundary(startDate, false);
  if (endDate) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      range.lt = cairoBoundary(endDate, true);
    } else {
      range.lte = cairoBoundary(endDate, false);
    }
  }
  return range;
};

const emptyAttendanceStats = () => ({
  PRESENT: 0,
  ABSENT: 0,
  LATE: 0,
  EXCUSED: 0,
  PENDING_REVIEW: 0,
  total: 0,
  attendancePercentage: 0,
});

const summarizeAttendanceGroups = (
  groups: Array<{ status: AttendanceStatus; _count: { _all: number } }>,
  totalOverride?: number
) => {
  const stats = emptyAttendanceStats();
  for (const group of groups) {
    stats[group.status] = group._count._all;
  }

  const recordedTotal =
    stats.PRESENT +
    stats.ABSENT +
    stats.LATE +
    stats.EXCUSED +
    stats.PENDING_REVIEW;
  stats.total = totalOverride ?? recordedTotal;
  if (totalOverride !== undefined && totalOverride > recordedTotal) {
    stats.ABSENT += totalOverride - recordedTotal;
  }

  const activeTotal = stats.total - stats.EXCUSED - stats.PENDING_REVIEW;
  stats.attendancePercentage = activeTotal > 0
    ? Math.round(((stats.PRESENT + stats.LATE * 0.5) / activeTotal) * 1000) / 10
    : 0;

  return stats;
};

const buildStaffWarningSql = (
  courseIds: number[],
  options: StaffWarningOptions
) => {
  const courseFilter = options.courseId
    ? Prisma.sql`AND e."courseId" = ${options.courseId}`
    : Prisma.empty;
  const yearFilter = options.year
    ? Prisma.sql`AND s."year" = ${options.year}`
    : Prisma.empty;
  const normalizedSearch = options.search?.trim().slice(0, 200);
  const escapedSearch = normalizedSearch?.replace(/[\\%_]/g, '\\$&');
  const searchPattern = escapedSearch ? `%${escapedSearch}%` : undefined;
  const searchFilter = searchPattern
    ? Prisma.sql`AND (
        CONCAT_WS(' ', s."firstName", s."lastName") ILIKE ${searchPattern} ESCAPE '\\'
        OR s."studentId" ILIKE ${searchPattern} ESCAPE '\\'
        OR u.email ILIKE ${searchPattern} ESCAPE '\\'
        OR c."courseCode" ILIKE ${searchPattern} ESCAPE '\\'
        OR c.name ILIKE ${searchPattern} ESCAPE '\\'
      )`
    : Prisma.empty;
  const dateWhere = buildDateWhere(
    options.date,
    options.startDate,
    options.endDate
  );
  const attendanceDateConditions: Prisma.Sql[] = [];
  if (dateWhere?.gte) {
    attendanceDateConditions.push(
      Prisma.sql`AND a.date >= ${dateWhere.gte as Date}`
    );
  }
  if (dateWhere?.gt) {
    attendanceDateConditions.push(
      Prisma.sql`AND a.date > ${dateWhere.gt as Date}`
    );
  }
  if (dateWhere?.lte) {
    attendanceDateConditions.push(
      Prisma.sql`AND a.date <= ${dateWhere.lte as Date}`
    );
  }
  if (dateWhere?.lt) {
    attendanceDateConditions.push(
      Prisma.sql`AND a.date < ${dateWhere.lt as Date}`
    );
  }
  const attendanceDateFilter = attendanceDateConditions.length > 0
    ? Prisma.join(attendanceDateConditions, ' ')
    : Prisma.empty;

  return Prisma.sql`
    WITH scoped_enrollments AS (
      SELECT
        e.id AS enrollment_id,
        e."studentId" AS student_id,
        e."courseId" AS course_id,
        e.status::text AS enrollment_status,
        COALESCE(
          e."customAbsenceThreshold",
          (
            SELECT p."maxAbsencePercent"
            FROM "AbsenceThresholdPolicy" p
            WHERE p."courseId" = e."courseId"
            ORDER BY p.id
            LIMIT 1
          ),
          (
            SELECT p."maxAbsencePercent"
            FROM "AbsenceThresholdPolicy" p
            WHERE p."courseId" IS NULL
              AND p."departmentId" = c."departmentId"
            ORDER BY p.id
            LIMIT 1
          ),
          (
            SELECT p."maxAbsencePercent"
            FROM "AbsenceThresholdPolicy" p
            WHERE p."courseId" IS NULL
              AND p."departmentId" IS NULL
            ORDER BY p.id
            LIMIT 1
          ),
          25.0
        )::double precision AS max_absence_percent
      FROM "Enrollment" e
      JOIN "Student" s ON s.id = e."studentId"
      JOIN "Course" c ON c.id = e."courseId"
      JOIN "User" u ON u.id = s."userId"
      WHERE e."courseId" IN (${Prisma.join(courseIds)})
        AND e.status::text IN ('ENROLLED', 'BLOCKED')
        ${courseFilter}
        ${yearFilter}
        ${searchFilter}
    ),
    attendance_counts AS (
      SELECT
        se.enrollment_id,
        COUNT(a.id)::int AS total,
        COUNT(a.id) FILTER (WHERE a.status::text = 'PRESENT')::int AS present,
        COUNT(a.id) FILTER (WHERE a.status::text = 'LATE')::int AS late,
        COUNT(a.id) FILTER (WHERE a.status::text = 'ABSENT')::int AS absent,
        COUNT(a.id) FILTER (WHERE a.status::text = 'EXCUSED')::int AS excused,
        COUNT(a.id) FILTER (WHERE a.status::text = 'PENDING_REVIEW')::int AS pending_review
      FROM scoped_enrollments se
      LEFT JOIN "Attendance" a
        ON a."studentId" = se.student_id
       AND a."courseId" = se.course_id
       ${attendanceDateFilter}
       AND NOT EXISTS (
         SELECT 1
         FROM "AbsenceExemptionPeriod" exemption
         WHERE exemption."enrollmentId" = se.enrollment_id
           AND a.date BETWEEN exemption."startDate" AND exemption."endDate"
       )
      GROUP BY se.enrollment_id
    ),
    warning_metrics AS (
      SELECT
        se.enrollment_id,
        se.enrollment_status,
        se.max_absence_percent,
        counts.total,
        counts.present,
        counts.late,
        counts.absent,
        counts.excused,
        counts.pending_review,
        CASE
          WHEN counts.total - counts.excused - counts.pending_review > 0 THEN
            ROUND((
              ((counts.absent + counts.late * 0.5) /
                (counts.total - counts.excused - counts.pending_review)) * 100
            )::numeric, 1)::double precision
          ELSE 0::double precision
        END AS absence_percent
      FROM scoped_enrollments se
      JOIN attendance_counts counts ON counts.enrollment_id = se.enrollment_id
    ),
    warning_rows AS (
      SELECT
        metrics.*,
        CASE
          WHEN metrics.enrollment_status = 'BLOCKED'
            OR metrics.absence_percent >= metrics.max_absence_percent
            THEN 'BLOCKED'
          WHEN metrics.absence_percent >= GREATEST(0, metrics.max_absence_percent - 5)
            THEN 'FINAL_WARNING'
          WHEN metrics.absence_percent >= 10
            THEN 'FIRST_WARNING'
          ELSE 'SAFE'
        END AS warning_stage
      FROM warning_metrics metrics
    )
  `;
};

class AttendanceService {
  static async recordByMethod(
    method: AttendanceMethod,
    payload: Record<string, any>,
    ctx: DriverValidationContext
  ) {
    return attendanceEngine.recordAttendance({ method, payload, ctx });
  }

  static async recordBulkManual(
    records: BulkManualRecord[],
    ctx: DriverValidationContext & { sessionId?: number; courseId?: number }
  ) {
    return attendanceEngine.recordBulkManual(records, ctx);
  }

  static async getCourseAttendance(
    user: AuthActor,
    courseId: number,
    dateOrOptions?: string | AttendanceHistoryOptions
  ) {
    const options: AttendanceHistoryOptions =
      typeof dateOrOptions === 'string'
        ? { date: dateOrOptions }
        : dateOrOptions ?? {};
    const { page, limit, skip } = normalizePagination(options.page, options.limit);
    const where: Prisma.AttendanceWhereInput = { courseId };

    const courseScope = getScopeWhere(user, 'course');
    const course = await prisma.course.findFirst({
      where: { AND: [{ id: courseId }, courseScope] },
      include: { department: true },
    });
    if (!course) {
      throw new AuthorizationError(
        'Access denied: You are not authorized for this course.'
      );
    }

    const dateWhere = buildDateWhere(
      options.date,
      options.startDate,
      options.endDate
    );
    if (dateWhere) where.date = dateWhere;
    if (options.semester) where.semester = options.semester;
    if (options.academicYear) where.academicYear = options.academicYear;

    const [attendance, total, groups] = await Promise.all([
      prisma.attendance.findMany({
        where,
        include: {
          student: {
            select: {
              id: true,
              studentId: true,
              firstName: true,
              lastName: true,
              group: { select: { id: true, name: true } },
            },
          },
          recordedBy: {
            select: {
              id: true,
              role: true,
              doctor: { select: { firstName: true, lastName: true } },
              teachingAssistant: {
                select: { firstName: true, lastName: true },
              },
            },
          },
        },
        orderBy: [{ date: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
      }),
      prisma.attendance.count({ where }),
      prisma.attendance.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
      }),
    ]);

    return {
      data: attendance.map((record) => ({
        ...record,
        recordedBy: record.recordedBy
          ? {
              id: record.recordedBy.id,
              role: record.recordedBy.role,
              firstName:
                record.recordedBy.doctor?.firstName ||
                record.recordedBy.teachingAssistant?.firstName ||
                'Admin',
              lastName:
                record.recordedBy.doctor?.lastName ||
                record.recordedBy.teachingAssistant?.lastName ||
                'User',
            }
          : null,
        group: record.student.group || null,
        recordedAt: record.createdAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats: summarizeAttendanceGroups(groups),
    };
  }

  static async getStudentAttendance(
    user: AuthActor,
    studentId: number,
    courseId?: number,
    page: number = 1,
    limit: number = 20
  ) {
    if (user.role === 'STUDENT') {
      const myStudent = await prisma.student.findUnique({
        where: { userId: user.id },
        select: { id: true },
      });
      if (!myStudent || myStudent.id !== studentId) {
        throw new AuthorizationError(
          'You can only view your own attendance records.'
        );
      }
    } else {
      const studentScope = getScopeWhere(user, 'student');
      const studentRecord = await prisma.student.findFirst({
        where: { AND: [{ id: studentId }, studentScope] },
      });
      if (!studentRecord) {
        throw new AuthorizationError('Access denied or Student not found');
      }
    }

    const skip = (page - 1) * limit;

    const courseScope = getScopeWhere(user, 'course');
    const enrollmentWhere: Prisma.EnrollmentWhereInput = {
      status: { in: ['ENROLLED', 'BLOCKED'] },
      ...(courseId !== undefined && { courseId }),
    };
    if (Object.keys(courseScope).length > 0) {
      enrollmentWhere.course = courseScope;
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        groupId: true,
        enrollments: {
          where: enrollmentWhere,
          select: {
            id: true,
            studentId: true,
            courseId: true,
            semester: true,
            academicYear: true,
            enrolledAt: true,
            exemptionPeriods: {
              select: { startDate: true, endDate: true },
            },
          },
        },
      },
    });

    const attempts = student?.enrollments ?? [];
    if (!student || attempts.length === 0) {
      return {
        data: [],
        pagination: {
          total: 0,
          page,
          totalPages: 0,
        },
        stats: {
          total: 0,
          PRESENT: 0,
          ABSENT: 0,
          LATE: 0,
          EXCUSED: 0,
          PENDING_REVIEW: 0,
          percentage: 0,
        },
      };
    }

    const standaloneAttemptClauses: Prisma.AttendanceWhereInput[] = attempts.map(
      (attempt) => ({
        studentId,
        courseId: attempt.courseId,
        semester: attempt.semester,
        academicYear: attempt.academicYear,
        sessionId: null,
      })
    );
    const calculations = await calculateAttendanceAttempts(
      attempts.map((attempt) => ({
        ...attempt,
        groupId: student.groupId,
      }))
    );
    const requiredSessionIds = Array.from(
      new Set(
        [...calculations.values()].flatMap((calculation) =>
          calculation.sessions.map((session) => session.sessionId)
        )
      )
    );
    const recordClauses: Prisma.AttendanceWhereInput[] = [
      ...standaloneAttemptClauses,
      ...(requiredSessionIds.length > 0
        ? [{ studentId, sessionId: { in: requiredSessionIds } }]
        : []),
    ];
    const [paginatedAttendance, recordCount] = await Promise.all([
      prisma.attendance.findMany({
        where: { OR: recordClauses },
        include: {
          course: { select: { name: true, courseCode: true } },
        },
        orderBy: { date: 'desc' },
        skip,
        take: limit,
      }),
      prisma.attendance.count({ where: { OR: recordClauses } }),
    ]);
    const calculation = combineAttendanceCalculations(
      attempts.flatMap((attempt) => {
        const value = calculations.get(attempt.id);
        return value ? [value] : [];
      })
    );

    const stats = {
      total: calculation.total,
      PRESENT: calculation.present,
      ABSENT: calculation.absent,
      LATE: calculation.late,
      EXCUSED: calculation.excused,
      PENDING_REVIEW: calculation.pendingReview,
      percentage: Math.round(calculation.attendancePercentage * 100) / 100,
    };

    return {
      data: paginatedAttendance,
      pagination: {
        total: recordCount,
        page,
        totalPages: Math.ceil(recordCount / limit),
      },
      stats,
    };
  }

  static async getMyCourses(user: AuthActor) {
    const userRole = user.role;

    const courseSelect = {
      id: true,
      name: true,
      courseCode: true,
      credits: true,
      year: true,
      semester: true,
      departmentId: true,
      department: {
        select: {
          id: true,
          name: true,
          nameAr: true,
          collegeId: true,
          college: {
            select: {
              id: true,
              name: true,
              nameAr: true,
            },
          },
        },
      },
      scheduleSlots: {
        where: { isArchived: false },
        select: {
          id: true,
          dayOfWeek: true,
          startTime: true,
          endTime: true,
          slotType: true,
          groupId: true,
          group: {
            select: {
              id: true,
              name: true,
              year: true,
            },
          },
        },
      },
      _count: {
        select: {
          enrollments: true,
          scheduleSlots: true,
        },
      },
    };

    const mapCourseSlots = (courseList: Array<Record<string, unknown>>) =>
  courseList.map((c) => ({
        ...c,
        scheduleSlots: (c['scheduleSlots'] as Array<Record<string, unknown>> | undefined)?.map((slot) => ({
          ...slot,
          studentGroupId: slot.groupId,
          studentGroup: slot.group,
        })),
      }));

    if (
      ['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'].includes(
        userRole
      )
    ) {
      const courseScope = getScopeWhere(user, 'course');
      const courses = await prisma.course.findMany({
        where: courseScope,
        select: courseSelect,
      });
      return mapCourseSlots(courses);
    }

    if (userRole === 'STUDENT') {
      const myStudent = await prisma.student.findUnique({
        where: { userId: user.id },
      });
      if (!myStudent) return [];

      // A student must only see courses for which they have an active ENROLLED status.
      // Withdrawn courses or un-enrolled department courses must NEVER be returned as active course chips.
      const enrollments = await prisma.enrollment.findMany({
        where: { studentId: myStudent.id, status: 'ENROLLED' },
        select: { courseId: true },
      });

      const enrolledCourseIds = enrollments.map((e) => e.courseId);

      if (enrolledCourseIds.length === 0) {
        return [];
      }

      const courses = await prisma.course.findMany({
        where: { id: { in: enrolledCourseIds } },
        select: courseSelect,
      });
      return mapCourseSlots(courses);
    }

    if (userRole === 'TEACHING_ASSISTANT') {
      const myTA = await prisma.teachingAssistant.findUnique({
        where: { userId: user.id },
      });
      if (!myTA) return [];

      const slots = await prisma.scheduleSlot.findMany({
        where: { teachingAssistantId: myTA.id, isArchived: false },
        select: { courseId: true },
      });

      const courseIds = Array.from(
        new Set(slots.map((s) => s.courseId))
      );
      let courses = await prisma.course.findMany({
        where: { id: { in: courseIds } },
        select: courseSelect,
      });

      if (courses.length === 0 && myTA.departmentId) {
        courses = await prisma.course.findMany({
          where: { departmentId: myTA.departmentId },
          select: courseSelect,
        });
      }

      return mapCourseSlots(courses);
    }

    if (userRole === 'DOCTOR') {
      const myDoctor = await prisma.doctor.findUnique({
        where: { userId: user.id },
      });
      if (!myDoctor) return [];

      const slots = await prisma.scheduleSlot.findMany({
        where: { doctorId: myDoctor.id, isArchived: false },
        select: { courseId: true },
      });

      const courseIds = Array.from(
        new Set(slots.map((s) => s.courseId))
      );
      let courses = await prisma.course.findMany({
        where: { id: { in: courseIds } },
        select: courseSelect,
      });

      if (courses.length === 0 && myDoctor.departmentId) {
        courses = await prisma.course.findMany({
          where: { departmentId: myDoctor.departmentId },
          select: courseSelect,
        });
      }

      return mapCourseSlots(courses);
    }

    return [];
  }

  static async getMySlots(user: AuthActor) {
    const userRole = user.role;

    const selectFields = {
      course: { select: { id: true, name: true, courseCode: true } },
      group: { select: { id: true, name: true } },
      doctor: { select: { firstName: true, lastName: true } },
      teachingAssistant: { select: { firstName: true, lastName: true } },
    };
    const orderBy: Prisma.ScheduleSlotOrderByWithRelationInput[] = [
      { dayOfWeek: 'asc' },
      { startTime: 'asc' },
    ];

    const staffRoles = new Set([
      'SUPER_ADMIN',
      'ADMIN',
      'COLLEGE_ADMIN',
      'DEPARTMENT_ADMIN',
      'DOCTOR',
      'TEACHING_ASSISTANT',
    ]);
    if (staffRoles.has(userRole)) {
      const courseScope = getScopeWhere(user, 'course') as Record<string, unknown>;
    const where: Prisma.ScheduleSlotWhereInput =
        courseScope && Object.keys(courseScope).length > 0
          ? { course: courseScope, isArchived: false }
          : { isArchived: false };
      return prisma.scheduleSlot.findMany({
        where,
        include: selectFields,
        orderBy,
      });
    }

    return [];
  }

  static async getMyAttendance(
    userId: number,
    courseIdOrOptions?: number | MyAttendanceOptions
  ) {
    const options: MyAttendanceOptions =
      typeof courseIdOrOptions === 'number'
        ? { courseId: courseIdOrOptions }
        : courseIdOrOptions ?? {};
    const { page, limit, skip } = normalizePagination(options.page, options.limit);
    const emptyResult = () => ({
      data: [],
      pagination: { page, limit, total: 0, totalPages: 0 },
      stats: emptyAttendanceStats(),
    });

    const enrollmentWhere: Prisma.EnrollmentWhereInput = {
      status: 'ENROLLED',
    };
    if (options.courseId) enrollmentWhere.courseId = options.courseId;
    if (options.semester) enrollmentWhere.semester = options.semester;
    if (options.academicYear) {
      enrollmentWhere.academicYear = options.academicYear;
    }

    const student = await prisma.student.findUnique({
      where: { userId },
      select: {
        id: true,
        groupId: true,
        enrollments: {
          where: enrollmentWhere,
          select: {
            id: true,
            courseId: true,
            semester: true,
            academicYear: true,
            exemptionPeriods: {
              select: { startDate: true, endDate: true },
            },
          },
        },
      },
    });
    if (!student) {
      throw new AuthorizationError('Student profile not found.');
    }

    if (student.enrollments.length === 0) return emptyResult();

    const dateWhere = buildDateWhere(
      options.date,
      options.startDate,
      options.endDate
    );
    const courseScopes: Prisma.AttendanceSessionWhereInput[] =
      student.enrollments.map((enrollment) => ({
        scheduleSlot: {
          courseId: enrollment.courseId,
          OR: [{ groupId: student.groupId }, { groupId: null }],
        },
      }));
    const aggregateCourseScopes: Prisma.AttendanceSessionWhereInput[] =
      student.enrollments.map((enrollment) => ({
        scheduleSlot: {
          courseId: enrollment.courseId,
          OR: [{ groupId: student.groupId }, { groupId: null }],
        },
        ...(enrollment.exemptionPeriods.length > 0 && {
          NOT: {
            OR: enrollment.exemptionPeriods.map((period) => ({
              createdAt: { gte: period.startDate, lte: period.endDate },
            })),
          },
        }),
      }));
    const sessionWhere: Prisma.AttendanceSessionWhereInput = {
      OR: courseScopes,
      ...(dateWhere && { createdAt: dateWhere }),
    };
    const aggregateSessionWhere: Prisma.AttendanceSessionWhereInput = {
      OR: aggregateCourseScopes,
      ...(dateWhere && { createdAt: dateWhere }),
    };

    const [sessions, total, aggregateTotal, aggregateGroups] = await Promise.all([
      prisma.attendanceSession.findMany({
        where: sessionWhere,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: { scheduleSlot: { include: { course: true } } },
        skip,
        take: limit,
      }),
      prisma.attendanceSession.count({ where: sessionWhere }),
      prisma.attendanceSession.count({ where: aggregateSessionWhere }),
      prisma.attendance.groupBy({
        by: ['status'],
        where: {
          studentId: student.id,
          session: { is: aggregateSessionWhere },
        },
        _count: { _all: true },
      }),
    ]);

    const attendances = await prisma.attendance.findMany({
      where: {
        studentId: student.id,
        sessionId: { in: sessions.map((session) => session.id) },
      },
      select: {
        sessionId: true,
        status: true,
        remarks: true,
      },
    });

    const attendanceMap = new Map();
    attendances.forEach((a) => attendanceMap.set(a.sessionId, a));

    return {
      data: sessions.map((session) => {
        const record = attendanceMap.get(session.id);
        return {
          sessionId: session.id,
          date: session.createdAt,
          course: session.scheduleSlot.course,
          status: record ? record.status : 'ABSENT',
          remarks: record ? record.remarks : null,
        };
      }),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats: summarizeAttendanceGroups(aggregateGroups, aggregateTotal),
    };
  }

  static async getAttendanceSummary(user: AuthActor, courseId: number) {
    const courseScope = getScopeWhere(user, 'course') as Record<string, unknown>;
    const course = await prisma.course.findFirst({
      where: { AND: [{ id: courseId }, courseScope] },
    });
    if (!course) {
      throw new AuthorizationError(
        'Access denied: You are not authorized for this course.'
      );
    }

    const statsData = await prisma.attendance.groupBy({
      by: ['status'],
      where: { courseId },
      _count: true,
    });
    const stats: Record<string, number> = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0, PENDING_REVIEW: 0 };
    statsData.forEach((item) => (stats[item.status] = item._count));
    return stats;
  }

  static async getAttendanceRecords(
    user: AuthActor,
    options: {
      courseId?: number;
      date?: string;
      departmentId?: number;
      collegeId?: number;
      page?: number;
      limit?: number;
    }
  ) {
    const {
      courseId,
      date,
      departmentId,
      collegeId,
      page = 1,
      limit = 50,
    } = options;

    const where: Prisma.AttendanceWhereInput = {};

    if (courseId) where.courseId = courseId;
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      where.date = { gte: startOfDay, lte: endOfDay };
    }

    if (departmentId) {
      where.course = { departmentId };
    } else if (collegeId) {
      where.course = { department: { collegeId } };
    }

    const courseScope = getScopeWhere(user, 'course') as Record<string, unknown>;
    if (courseScope && Object.keys(courseScope).length) {
      if (where.course) {
        where.course = { AND: [where.course, courseScope] };
      } else {
        where.course = courseScope;
      }
    }

    const skip = (page - 1) * limit;

    const [attendance, total] = await Promise.all([
      prisma.attendance.findMany({
        where,
        include: {
          student: {
            select: {
              id: true,
              studentId: true,
              firstName: true,
              lastName: true,
              group: { select: { id: true, name: true } },
            },
          },
          course: { select: { name: true, courseCode: true } },
          recordedBy: {
            select: {
              id: true,
              role: true,
              doctor: { select: { firstName: true, lastName: true } },
              teachingAssistant: {
                select: { firstName: true, lastName: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.attendance.count({ where }),
    ]);

      const mappedData = attendance.map((record) => ({
      ...record,
      recordedBy: record.recordedBy
        ? {
            id: record.recordedBy.id,
            role: record.recordedBy.role,
            firstName:
              record.recordedBy.doctor?.firstName ||
              record.recordedBy.teachingAssistant?.firstName ||
              'Admin',
            lastName:
              record.recordedBy.doctor?.lastName ||
              record.recordedBy.teachingAssistant?.lastName ||
              'User',
          }
        : null,
      group: record.student.group || null,
      recordedAt: record.createdAt,
    }));

    return {
      data: mappedData,
      pagination: {
        total,
        page,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async unblockEnrollment(user: AuthActor, enrollmentId: number) {
    const enrollment = await prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: { course: true, student: true },
    });

    if (!enrollment) {
      throw new NotFoundError('Enrollment not found');
    }

    const courseScope = getScopeWhere(user, 'course') as Record<string, unknown>;
    if (courseScope && Object.keys(courseScope).length) {
      const courseCheck = await prisma.course.findFirst({
        where: { AND: [{ id: enrollment.courseId }, courseScope] },
      });
      if (!courseCheck) {
        throw new AuthorizationError(
          'Access denied: You are not authorized for this course.'
        );
      }
    }

    if (enrollment.status !== 'BLOCKED') {
      return { message: 'Enrollment is not blocked' };
    }

    await prisma.enrollment.update({
      where: { id: enrollment.id },
      data: { status: 'ENROLLED' },
    });

    return { message: 'Student unblocked successfully' };
  }

  static async getAuditDuplicateDevices(user: AuthActor) {
    if (!isAdminMutationScopeConfigured(user)) {
      throw new AuthorizationError('Managed scope is required for device audit');
    }

    const deviceStudentPairs = await prisma.attendance.groupBy({
      by: ['deviceId', 'studentId'],
      where: {
        deviceId: { not: null },
        course: getAttendanceAuditCourseWhere(user),
      },
    });

    const studentIdsByDevice = new Map<string, Set<number>>();
    for (const pair of deviceStudentPairs) {
      if (!pair.deviceId) continue;
      const studentIds = studentIdsByDevice.get(pair.deviceId) ?? new Set<number>();
      studentIds.add(pair.studentId);
      studentIdsByDevice.set(pair.deviceId, studentIds);
    }

    const duplicates = [...studentIdsByDevice.entries()].filter(
      ([, studentIds]) => studentIds.size > 1
    );
    if (duplicates.length === 0) {
      return [];
    }

    const duplicateStudentIds = [
      ...new Set(duplicates.flatMap(([, studentIds]) => [...studentIds])),
    ];
    const students = await prisma.student.findMany({
      where: { id: { in: duplicateStudentIds } },
      select: {
        id: true,
        studentId: true,
        firstName: true,
        lastName: true,
        user: { select: { email: true } },
      },
    });
    const studentsById = new Map(students.map(student => [student.id, student]));

    return duplicates.map(([deviceId, studentIds]) => ({
      deviceId,
      studentCount: studentIds.size,
      students: [...studentIds]
        .map(studentId => studentsById.get(studentId))
        .filter(Boolean),
    }));
  }

  static async overrideFlaggedRecord(
    user: AuthActor,
    attendanceId: number,
    note?: string
  ) {
    const accessWhere = getFlagOverrideAttendanceWhere(user, attendanceId);
    const attendanceRecord = await prisma.attendance.findFirst({
      where: accessWhere,
    });

    if (!attendanceRecord) {
      throw new NotFoundError('Record not found');
    }
    if (
      attendanceRecord.status !== 'PENDING_REVIEW' ||
      !attendanceRecord.locationFlagged
    ) {
      throw new ConflictError('Attendance record has already been resolved');
    }

    const nextStatus = attendanceRecord.pendingApprovedStatus || 'PRESENT';

    const updated = await prisma.attendance.updateMany({
      where: {
        AND: [
          accessWhere,
          { status: 'PENDING_REVIEW', locationFlagged: true },
        ],
      },
      data: {
        status: nextStatus,
        pendingApprovedStatus: null,
        locationFlagged: false,
        overriddenBy: user.email,
        overrideNote: note,
      },
    });
    if (updated.count !== 1) {
      throw new ConflictError('Attendance record was resolved concurrently');
    }

    await attendanceEngine.recalculateAbsence(
      attendanceRecord.studentId,
      attendanceRecord.courseId,
      attendanceRecord.semester,
      attendanceRecord.academicYear
    );

    return prisma.attendance.findUnique({ where: { id: attendanceId } });
  }

  static async rejectFlaggedRecord(
    user: AuthActor,
    attendanceId: number,
    note?: string
  ) {
    const accessWhere = getFlagOverrideAttendanceWhere(user, attendanceId);
    const attendanceRecord = await prisma.attendance.findFirst({
      where: accessWhere,
    });

    if (!attendanceRecord) {
      throw new NotFoundError('Record not found');
    }
    if (
      attendanceRecord.status !== 'PENDING_REVIEW' ||
      !attendanceRecord.locationFlagged
    ) {
      throw new ConflictError('Attendance record has already been resolved');
    }

    const updated = await prisma.attendance.updateMany({
      where: {
        AND: [
          accessWhere,
          { status: 'PENDING_REVIEW', locationFlagged: true },
        ],
      },
      data: {
        status: 'ABSENT',
        pendingApprovedStatus: null,
        locationFlagged: false,
        overriddenBy: user.email,
        overrideNote: note || 'Rejected',
      },
    });
    if (updated.count !== 1) {
      throw new ConflictError('Attendance record was resolved concurrently');
    }

    await attendanceEngine.recalculateAbsence(
      attendanceRecord.studentId,
      attendanceRecord.courseId,
      attendanceRecord.semester,
      attendanceRecord.academicYear
    );

    return prisma.attendance.findUnique({ where: { id: attendanceId } });
  }

  static async getMyAbsenceWarnings(
    user: AuthActor,
    options: StaffWarningOptions = {}
  ) {
    return AttendanceWarningService.getMyAbsenceWarnings(user, options);
  }

  static async getStaffAbsenceWarnings(
    user: AuthActor,
    options: StaffWarningOptions = {},
    paginationOverride?: {
      page: number;
      limit: number;
      skip: number;
      includeCoursesList?: boolean;
    }
  ) {
    return AttendanceWarningService.getStaffAbsenceWarnings(
      user,
      options,
      paginationOverride
    );
  }

  static async exportStaffAbsenceWarnings(
    user: AuthActor,
    options: Omit<StaffWarningOptions, 'page' | 'limit'> = {}
  ) {
    return AttendanceWarningService.exportStaffAbsenceWarnings(user, options);
  }

  static async provisionRfidDevice(data: { roomId: string; label?: string }) {
    return AttendanceDeviceService.provisionRfidDevice(data);
  }

  static async listRfidDevices() {
    return AttendanceDeviceService.listRfidDevices();
  }
}

export { AttendanceService };
export default AttendanceService;
