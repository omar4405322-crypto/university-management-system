import { AttendanceMethod, AttendanceStatus, Prisma } from '@prisma/client';
import { fromZonedTime } from 'date-fns-tz';
import prisma from '../utils/prismaClient';
import { AppError, AuthorizationError, NotFoundError } from '../utils/appError';
import { getScopeWhere } from '../utils/scope.utils';
import attendanceEngine, { BulkManualRecord } from '../attendance/attendance.engine';
import { DriverValidationContext } from '../attendance/drivers/IAttendanceDriver';
import {
  getAttendanceAuditCourseWhere,
  getFlagOverrideAttendanceWhere,
} from '../utils/attendanceAuditScope.utils';
import { isAdminMutationScopeConfigured } from '../utils/adminMutationScope.utils';
import crypto from 'crypto';
import { encrypt } from '../utils/encryption.utils';

const ATTENDANCE_TIME_ZONE = 'Africa/Cairo';
const DEFAULT_ATTENDANCE_PAGE_SIZE = 20;
const MAX_ATTENDANCE_PAGE_SIZE = 100;
const STAFF_WARNING_EXPORT_LIMIT = 10_000;

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

type StaffWarningStage =
  | 'BLOCKED'
  | 'FINAL_WARNING'
  | 'FIRST_WARNING'
  | 'SAFE';

type StaffWarningOptions = {
  courseId?: number;
  year?: number;
  warningStage?: StaffWarningStage;
  search?: string;
  date?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
};

type StaffWarningSqlRow = {
  enrollmentId: number;
  warningStage: StaffWarningStage;
  absencePercent: number;
  maxAbsencePercent: number;
  total: number;
  present: number;
  late: number;
  absent: number;
  excused: number;
  pendingReview: number;
};

type StaffWarningQueryRow = {
  totalMonitored: number;
  blockedCount: number;
  finalWarningCount: number;
  firstWarningCount: number;
  safeCount: number;
  pageRows: StaffWarningSqlRow[];
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
    user: any,
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
      data: attendance.map((record: any) => ({
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
    user: any,
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
    const enrollmentWhere: any = { status: 'ENROLLED' };
    if (Object.keys(courseScope).length > 0) {
      enrollmentWhere.course = courseScope;
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        enrollments: {
          where: enrollmentWhere,
          select: { courseId: true },
        },
      },
    });

    const enrolledCourseIds =
      student?.enrollments.map((e) => e.courseId) || [];

    // ENROLLED-Only Scope Guard:
    // If a specific courseId is requested, verify that the student has an active ENROLLED status.
    // If the student is not enrolled (or has WITHDRAWN), return early with empty stats rather than fabricating numbers.
    if (courseId && !enrolledCourseIds.includes(courseId)) {
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

    // Explicitly scope "All Courses" (courseId is undefined) strictly to ENROLLED courses.
    if (!courseId && enrolledCourseIds.length === 0) {
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

    const targetCourseFilter = courseId
      ? courseId
      : { in: enrolledCourseIds };

    const slots = await prisma.scheduleSlot.findMany({
      where: {
        courseId: targetCourseFilter,
        OR: [{ groupId: student?.groupId }, { groupId: null }],
      },
      select: { id: true },
    });
    const slotIds = slots.map((s) => s.id);

    const sessions = await prisma.attendanceSession.findMany({
      where: { scheduleSlotId: { in: slotIds } },
      select: { id: true },
    });
    const totalHeldSessions = sessions.length;
    const sessionIds = sessions.map((s) => s.id);

    const [sessionAttendances, standaloneAttendances, paginatedAttendance, recordCount] =
      await Promise.all([
        prisma.attendance.findMany({
          where: {
            studentId,
            sessionId: { in: sessionIds },
          },
          select: { status: true },
        }),
        prisma.attendance.findMany({
          where: {
            studentId,
            courseId: targetCourseFilter,
            sessionId: null,
          },
          select: { status: true },
        }),
        // Intentionally scope paginated raw records and count to targetCourseFilter
        // (single requested enrolled course or all currently ENROLLED courses).
        // This ensures the All Courses aggregate path never leaks historical records
        // from courses that the student has withdrawn from or is not actively enrolled in.
        prisma.attendance.findMany({
          where: {
            studentId,
            courseId: targetCourseFilter,
          },
          include: {
            course: { select: { name: true, courseCode: true } },
          },
          orderBy: { date: 'desc' },
          skip,
          take: limit,
        }),
        prisma.attendance.count({
          where: {
            studentId,
            courseId: targetCourseFilter,
          },
        }),
      ]);

    let present = 0;
    let late = 0;
    let excused = 0;
    let explicitAbsent = 0;
    let pendingReview = 0;

    sessionAttendances.forEach((a: any) => {
      if (a.status === 'PRESENT') present++;
      else if (a.status === 'LATE') late++;
      else if (a.status === 'EXCUSED') excused++;
      else if (a.status === 'ABSENT') explicitAbsent++;
      else if (a.status === 'PENDING_REVIEW') pendingReview++;
    });

    standaloneAttendances.forEach((a: any) => {
      if (a.status === 'PRESENT') present++;
      else if (a.status === 'LATE') late++;
      else if (a.status === 'EXCUSED') excused++;
      else if (a.status === 'ABSENT') explicitAbsent++;
      else if (a.status === 'PENDING_REVIEW') pendingReview++;
    });

    // Unattended held sessions without an explicit record are counted as ABSENT
    const recordedSessionCount = sessionAttendances.length;
    const unrecordedAbsent = Math.max(0, totalHeldSessions - recordedSessionCount);
    const totalAbsent = explicitAbsent + unrecordedAbsent;
    const totalSessions = totalHeldSessions + standaloneAttendances.length;

    const effectiveTotal = totalSessions - excused - pendingReview;
    const percentage =
      effectiveTotal > 0
        ? ((present + late * 0.5) / effectiveTotal) * 100
        : 0;

    const stats = {
      total: totalSessions,
      PRESENT: present,
      ABSENT: totalAbsent,
      LATE: late,
      EXCUSED: excused,
      PENDING_REVIEW: pendingReview,
      percentage: Math.round(percentage * 100) / 100,
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

  static async getMyCourses(user: any) {
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

    const mapCourseSlots = (courseList: any[]) =>
      courseList.map((c: any) => ({
        ...c,
        scheduleSlots: c.scheduleSlots?.map((slot: any) => ({
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

      const enrolledCourseIds = enrollments.map((e: any) => e.courseId);

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
        where: { teachingAssistantId: myTA.id },
        select: { courseId: true },
      });

      const courseIds = Array.from(
        new Set(slots.map((s: any) => s.courseId))
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
        where: { doctorId: myDoctor.id },
        select: { courseId: true },
      });

      const courseIds = Array.from(
        new Set(slots.map((s: any) => s.courseId))
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

  static async getMySlots(user: any) {
    const userRole = user.role;

    const selectFields = {
      course: { select: { id: true, name: true, courseCode: true } },
      group: { select: { id: true, name: true } },
      doctor: { select: { firstName: true, lastName: true } },
      teachingAssistant: { select: { firstName: true, lastName: true } },
    };
    const orderBy: any = [
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
      const courseScope: any = getScopeWhere(user, 'course');
      const where: any =
        courseScope && Object.keys(courseScope).length > 0
          ? { course: courseScope }
          : {};
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
    attendances.forEach((a: any) => attendanceMap.set(a.sessionId, a));

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

  static async getAttendanceSummary(user: any, courseId: number) {
    const courseScope: any = getScopeWhere(user, 'course');
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
    const stats: any = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0, PENDING_REVIEW: 0 };
    statsData.forEach((item) => (stats[item.status] = item._count));
    return stats;
  }

  static async getAttendanceRecords(
    user: any,
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

    const where: any = {};

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

    const courseScope: any = getScopeWhere(user, 'course');
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

    const mappedData = attendance.map((record: any) => ({
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

  static async unblockEnrollment(user: any, enrollmentId: number) {
    const enrollment = await prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: { course: true, student: true },
    });

    if (!enrollment) {
      throw new NotFoundError('Enrollment not found');
    }

    const courseScope: any = getScopeWhere(user, 'course');
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

  static async getAuditDuplicateDevices(user: any) {
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
    user: any,
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

    const nextStatus = attendanceRecord.pendingApprovedStatus || 'PRESENT';

    const updated = await prisma.attendance.updateMany({
      where: accessWhere,
      data: {
        status: nextStatus,
        pendingApprovedStatus: null,
        locationFlagged: false,
        overriddenBy: user.email,
        overrideNote: note,
      },
    });
    if (updated.count !== 1) {
      throw new AuthorizationError('Attendance record left your authorized scope');
    }

    await attendanceEngine.recalculateAbsence(
      attendanceRecord.studentId,
      attendanceRecord.courseId
    );

    return prisma.attendance.findUnique({ where: { id: attendanceId } });
  }

  static async rejectFlaggedRecord(
    user: any,
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

    const updated = await prisma.attendance.updateMany({
      where: accessWhere,
      data: {
        status: 'ABSENT',
        pendingApprovedStatus: null,
        locationFlagged: false,
        overriddenBy: user.email,
        overrideNote: note || 'Rejected',
      },
    });
    if (updated.count !== 1) {
      throw new AuthorizationError('Attendance record left your authorized scope');
    }

    await attendanceEngine.recalculateAbsence(
      attendanceRecord.studentId,
      attendanceRecord.courseId
    );

    return prisma.attendance.findUnique({ where: { id: attendanceId } });
  }

  static async getMyAbsenceWarnings(
    user: any,
    options: StaffWarningOptions = {}
  ) {
    if (user.role !== 'STUDENT') {
      return this.getStaffAbsenceWarnings(user, options);
    }

    const student = await prisma.student.findUnique({
      where: { userId: user.id },
      include: {
        enrollments: {
          where: {
            status: { in: ['ENROLLED', 'BLOCKED'] },
          },
          include: {
            course: {
              select: {
                id: true,
                courseCode: true,
                name: true,
                departmentId: true,
              },
            },
            exemptionPeriods: {
              select: {
                id: true,
                startDate: true,
                endDate: true,
                reason: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });

    if (!student) {
      return {
        isStaff: false,
        courses: [],
        notifications: [],
      };
    }

    const activeCourseIds = student.enrollments
      .filter((enrollment) => enrollment.status === 'ENROLLED')
      .map((enrollment) => enrollment.courseId);
    const departmentIds = Array.from(
      new Set(
        student.enrollments
          .map((enrollment) => enrollment.course.departmentId)
          .filter((departmentId): departmentId is number => departmentId !== null)
      )
    );

    const slots = await prisma.scheduleSlot.findMany({
      where: {
        courseId: { in: activeCourseIds },
        OR: [{ groupId: student.groupId }, { groupId: null }],
      },
      select: { id: true, courseId: true },
    });
    const slotToCourse = new Map(slots.map((slot) => [slot.id, slot.courseId]));

    const sessions = await prisma.attendanceSession.findMany({
      where: { scheduleSlotId: { in: slots.map((slot) => slot.id) } },
      select: { id: true, scheduleSlotId: true },
    });
    const sessionToCourse = new Map<number, number>();
    const heldSessionsByCourse = new Map<number, number>();
    for (const session of sessions) {
      const sessionCourseId = slotToCourse.get(session.scheduleSlotId!);
      if (sessionCourseId === undefined) continue;
      sessionToCourse.set(session.id, sessionCourseId);
      heldSessionsByCourse.set(
        sessionCourseId,
        (heldSessionsByCourse.get(sessionCourseId) ?? 0) + 1
      );
    }

    const notificationWhere = {
      userId: user.id,
      OR: [
        { title: { contains: 'Enrollment', mode: 'insensitive' as const } },
        { title: { contains: 'Absence', mode: 'insensitive' as const } },
        { title: { contains: 'حرمان', mode: 'insensitive' as const } },
        { title: { contains: 'غياب', mode: 'insensitive' as const } },
        { title: { contains: 'إنذار', mode: 'insensitive' as const } },
        { message: { contains: 'absence', mode: 'insensitive' as const } },
        { message: { contains: 'غياب', mode: 'insensitive' as const } },
        { message: { contains: 'blocked', mode: 'insensitive' as const } },
        { message: { contains: 'restored', mode: 'insensitive' as const } },
      ],
    };
    const [sessionGroups, standaloneGroups, policies, notifications] =
      await Promise.all([
        prisma.attendance.groupBy({
          by: ['sessionId', 'status'],
          where: {
            studentId: student.id,
            sessionId: { in: sessions.map((session) => session.id) },
          },
          _count: { _all: true },
        }),
        prisma.attendance.groupBy({
          by: ['courseId', 'status'],
          where: {
            studentId: student.id,
            courseId: { in: activeCourseIds },
            sessionId: null,
          },
          _count: { _all: true },
        }),
        prisma.absenceThresholdPolicy.findMany({
          where: {
            OR: [
              { courseId: { in: student.enrollments.map((item) => item.courseId) } },
              ...(departmentIds.length > 0
                ? [{ departmentId: { in: departmentIds } }]
                : []),
              { departmentId: null, courseId: null },
            ],
          },
        }),
        prisma.notification.findMany({
          where: notificationWhere,
          orderBy: { createdAt: 'desc' },
          take: 20,
        }),
      ]);

    type WarningStats = {
      PRESENT: number;
      ABSENT: number;
      LATE: number;
      EXCUSED: number;
      PENDING_REVIEW: number;
      recordedSessions: number;
      standalone: number;
    };
    const emptyStats = (): WarningStats => ({
      PRESENT: 0,
      ABSENT: 0,
      LATE: 0,
      EXCUSED: 0,
      PENDING_REVIEW: 0,
      recordedSessions: 0,
      standalone: 0,
    });
    const statsByCourse = new Map<number, WarningStats>();
    const getStats = (courseId: number) => {
      const existing = statsByCourse.get(courseId);
      if (existing) return existing;
      const created = emptyStats();
      statsByCourse.set(courseId, created);
      return created;
    };

    for (const group of sessionGroups) {
      if (group.sessionId === null) continue;
      const sessionCourseId = sessionToCourse.get(group.sessionId);
      if (sessionCourseId === undefined) continue;
      const stats = getStats(sessionCourseId);
      stats[group.status] += group._count._all;
      stats.recordedSessions += group._count._all;
    }
    for (const group of standaloneGroups) {
      const stats = getStats(group.courseId);
      stats[group.status] += group._count._all;
      stats.standalone += group._count._all;
    }

    const coursesData = student.enrollments.map((enrollment) => {
      const stats = statsByCourse.get(enrollment.courseId) ?? emptyStats();
      const totalHeldSessions = heldSessionsByCourse.get(enrollment.courseId) ?? 0;
      const unrecordedAbsent = Math.max(
        0,
        totalHeldSessions - stats.recordedSessions
      );
      const absent = stats.ABSENT + unrecordedAbsent;
      const totalSessions = totalHeldSessions + stats.standalone;
      const activeTotal =
        totalSessions - stats.EXCUSED - stats.PENDING_REVIEW;
      const absencePercent =
        activeTotal > 0
          ? Math.round(((absent + stats.LATE * 0.5) / activeTotal) * 1000) / 10
          : 0;

      let maxAbsencePercent = enrollment.customAbsenceThreshold ?? 25.0;
      if (
        enrollment.customAbsenceThreshold === null ||
        enrollment.customAbsenceThreshold === undefined
      ) {
        const policy =
          policies.find((candidate) => candidate.courseId === enrollment.courseId) ||
          policies.find(
            (candidate) =>
              candidate.departmentId === enrollment.course.departmentId
          ) ||
          policies.find(
            (candidate) =>
              candidate.courseId === null && candidate.departmentId === null
          );
        if (policy) maxAbsencePercent = policy.maxAbsencePercent;
      }

      const isBlocked = enrollment.status === 'BLOCKED';
      const isExceeding = absencePercent >= maxAbsencePercent;
      const isNearLimit =
        !isExceeding && absencePercent >= Math.max(0, maxAbsencePercent - 5);

      return {
        enrollmentId: enrollment.id,
        courseId: enrollment.course.id,
        courseCode: enrollment.course.courseCode,
        courseName: enrollment.course.name,
        status: enrollment.status,
        isBlocked,
        absencePercent,
        maxAbsencePercent,
        isExceeding,
        isNearLimit,
        totalSessions,
        present: stats.PRESENT,
        late: stats.LATE,
        absent,
        excused: stats.EXCUSED,
        pendingReview: stats.PENDING_REVIEW,
        exemptionPeriods: enrollment.exemptionPeriods,
      };
    });

    return {
      isStaff: false,
      courses: coursesData,
      notifications,
    };
  }

  static async getStaffAbsenceWarnings(
    user: any,
    options: StaffWarningOptions = {},
    paginationOverride?: {
      page: number;
      limit: number;
      skip: number;
      includeCoursesList?: boolean;
    }
  ) {
    const { page, limit, skip } = paginationOverride ??
      normalizePagination(options.page, options.limit);
    const validWarningStages = new Set<StaffWarningStage>([
      'BLOCKED',
      'FINAL_WARNING',
      'FIRST_WARNING',
      'SAFE',
    ]);
    if (
      options.warningStage &&
      !validWarningStages.has(options.warningStage)
    ) {
      throw new AppError('Invalid warning stage', 400);
    }

    const userRole = user.role;
    let courseIds: number[] = [];

    if (['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'].includes(userRole)) {
      const courseScope = getScopeWhere(user, 'course');
      const courses = await prisma.course.findMany({
        where: courseScope,
        select: { id: true },
      });
      courseIds = courses.map((c) => c.id);
    } else if (userRole === 'DOCTOR') {
      const courseScope = getScopeWhere(user, 'course');
      const courses = await prisma.course.findMany({
        where: courseScope,
        select: { id: true },
      });
      courseIds = courses.map((c) => c.id);
    } else if (userRole === 'TEACHING_ASSISTANT') {
      const ta = await prisma.teachingAssistant.findUnique({ where: { userId: user.id } });
      if (ta) {
        const slots = await prisma.scheduleSlot.findMany({
          where: { teachingAssistantId: ta.id },
          select: { courseId: true },
        });
        courseIds = Array.from(new Set(slots.map((s) => s.courseId)));
        if (courseIds.length === 0 && ta.departmentId) {
          const deptCourses = await prisma.course.findMany({
            where: { departmentId: ta.departmentId },
            select: { id: true },
          });
          courseIds = deptCourses.map((c) => c.id);
        }
      }
    }

    if (courseIds.length === 0) {
      return {
        isStaff: true,
        summary: {
          totalMonitored: 0,
          blockedCount: 0,
          finalWarningCount: 0,
          firstWarningCount: 0,
          safeCount: 0,
        },
        warningRecords: [],
        coursesList: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
      };
    }

    if (options.courseId && !courseIds.includes(options.courseId)) {
      return {
        isStaff: true,
        summary: {
          totalMonitored: 0,
          blockedCount: 0,
          finalWarningCount: 0,
          firstWarningCount: 0,
          safeCount: 0,
        },
        warningRecords: [],
        coursesList: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
      };
    }

    const baseSql = buildStaffWarningSql(courseIds, options);
    const warningStageFilter = options.warningStage
      ? Prisma.sql`WHERE warning_stage = ${options.warningStage}`
      : Prisma.empty;

    const [warningQueryRows, coursesList] = await Promise.all([
      prisma.$queryRaw<StaffWarningQueryRow[]>(Prisma.sql`
        ${baseSql}
        , summary_counts AS (
          SELECT warning_stage, COUNT(*)::int AS count
          FROM warning_rows
          GROUP BY warning_stage
        )
        SELECT
          COALESCE(SUM(summary_counts.count), 0)::int AS "totalMonitored",
          COALESCE(MAX(summary_counts.count) FILTER (
            WHERE summary_counts.warning_stage = 'BLOCKED'
          ), 0)::int AS "blockedCount",
          COALESCE(MAX(summary_counts.count) FILTER (
            WHERE summary_counts.warning_stage = 'FINAL_WARNING'
          ), 0)::int AS "finalWarningCount",
          COALESCE(MAX(summary_counts.count) FILTER (
            WHERE summary_counts.warning_stage = 'FIRST_WARNING'
          ), 0)::int AS "firstWarningCount",
          COALESCE(MAX(summary_counts.count) FILTER (
            WHERE summary_counts.warning_stage = 'SAFE'
          ), 0)::int AS "safeCount",
          COALESCE((
            SELECT JSONB_AGG(JSONB_BUILD_OBJECT(
              'enrollmentId', page.enrollment_id,
              'warningStage', page.warning_stage,
              'absencePercent', page.absence_percent,
              'maxAbsencePercent', page.max_absence_percent,
              'total', page.total,
              'present', page.present,
              'late', page.late,
              'absent', page.absent,
              'excused', page.excused,
              'pendingReview', page.pending_review
            ) ORDER BY page.enrollment_id)
            FROM (
              SELECT *
              FROM warning_rows
              ${warningStageFilter}
              ORDER BY enrollment_id ASC
              LIMIT ${limit}
              OFFSET ${skip}
            ) page
          ), '[]'::jsonb) AS "pageRows"
        FROM summary_counts
      `),
      paginationOverride?.includeCoursesList === false
        ? Promise.resolve([])
        : prisma.course.findMany({
            where: {
              id: { in: courseIds },
              enrollments: {
                some: { status: { in: ['ENROLLED', 'BLOCKED'] } },
              },
            },
            select: {
              id: true,
              courseCode: true,
              name: true,
              year: true,
              semester: true,
            },
            orderBy: [{ courseCode: 'asc' }, { id: 'asc' }],
          }),
    ]);

    const warningQuery = warningQueryRows[0] ?? {
      totalMonitored: 0,
      blockedCount: 0,
      finalWarningCount: 0,
      firstWarningCount: 0,
      safeCount: 0,
      pageRows: [],
    };
    const blockedCount = Number(warningQuery.blockedCount);
    const finalWarningCount = Number(warningQuery.finalWarningCount);
    const firstWarningCount = Number(warningQuery.firstWarningCount);
    const safeCount = Number(warningQuery.safeCount);
    const totalMonitored = Number(warningQuery.totalMonitored);
    const filteredTotal = options.warningStage
      ? {
          BLOCKED: blockedCount,
          FINAL_WARNING: finalWarningCount,
          FIRST_WARNING: firstWarningCount,
          SAFE: safeCount,
        }[options.warningStage]
      : totalMonitored;
    const pageRows = warningQuery.pageRows ?? [];

    const enrollmentIds = pageRows.map((row) => Number(row.enrollmentId));
    const enrollments = enrollmentIds.length > 0
      ? await prisma.enrollment.findMany({
          where: { id: { in: enrollmentIds } },
          include: {
            student: {
              select: {
                id: true,
                studentId: true,
                firstName: true,
                lastName: true,
                year: true,
                department: {
                  select: {
                    id: true,
                    name: true,
                    nameAr: true,
                    college: {
                      select: { id: true, name: true, nameAr: true },
                    },
                  },
                },
                user: { select: { email: true } },
              },
            },
            course: {
              select: {
                id: true,
                courseCode: true,
                name: true,
                credits: true,
                year: true,
                semester: true,
                departmentId: true,
              },
            },
            exemptionPeriods: {
              select: {
                id: true,
                startDate: true,
                endDate: true,
                reason: true,
                createdAt: true,
              },
            },
          },
        })
      : [];
    const enrollmentById = new Map(
      enrollments.map((enrollment) => [enrollment.id, enrollment])
    );
    const warningRecords = pageRows.flatMap((row) => {
      const enrollment = enrollmentById.get(Number(row.enrollmentId));
      if (!enrollment) return [];

      return [{
        enrollmentId: enrollment.id,
        studentId: enrollment.student.id,
        studentCode: enrollment.student.studentId,
        studentName: `${enrollment.student.firstName} ${enrollment.student.lastName}`.trim(),
        studentEmail: enrollment.student.user?.email,
        studentYear: enrollment.student.year || enrollment.course.year || 1,
        departmentName: enrollment.student.department?.name,
        departmentNameAr: enrollment.student.department?.nameAr,
        collegeName: enrollment.student.department?.college?.name,
        collegeNameAr: enrollment.student.department?.college?.nameAr,
        courseId: enrollment.course.id,
        courseCode: enrollment.course.courseCode,
        courseName: enrollment.course.name,
        courseYear: enrollment.course.year,
        courseSemester: enrollment.course.semester,
        status: enrollment.status,
        warningStage: row.warningStage,
        absencePercent: Number(row.absencePercent),
        maxAbsencePercent: Number(row.maxAbsencePercent),
        totalSessions: Number(row.total),
        present: Number(row.present),
        late: Number(row.late),
        absent: Number(row.absent),
        excused: Number(row.excused),
        pendingReview: Number(row.pendingReview),
        exemptionPeriods: enrollment.exemptionPeriods || [],
      }];
    });

    return {
      isStaff: true,
      summary: {
        totalMonitored,
        blockedCount,
        finalWarningCount,
        firstWarningCount,
        safeCount,
      },
      warningRecords,
      coursesList,
      pagination: {
        page,
        limit,
        total: filteredTotal,
        totalPages: Math.ceil(filteredTotal / limit),
      },
    };
  }

  static async exportStaffAbsenceWarnings(
    user: any,
    options: Omit<StaffWarningOptions, 'page' | 'limit'> = {}
  ) {
    const result = await this.getStaffAbsenceWarnings(
      user,
      options,
      {
        page: 1,
        limit: STAFF_WARNING_EXPORT_LIMIT,
        skip: 0,
        includeCoursesList: false,
      }
    );

    return {
      records: result.warningRecords,
      total: result.pagination.total,
      capped: result.pagination.total > STAFF_WARNING_EXPORT_LIMIT,
      limit: STAFF_WARNING_EXPORT_LIMIT,
    };
  }

  /**
   * Provisions a new RFID hardware device.
   * Generates a 32-byte cryptographic signing key server-side, encrypts it
   * at rest using AES-256-GCM, and returns the raw plaintext key exactly once
   * for flashing into device firmware.
   */
  static async provisionRfidDevice(data: { roomId: string; label?: string }) {
    const roomId = data.roomId?.trim();
    if (!roomId) {
      throw new AppError('Room ID (device identifier) is required', 400);
    }

    const existing = await prisma.rfidDevice.findUnique({
      where: { roomId },
    });
    if (existing) {
      throw new AppError(`An RFID device is already provisioned for room: ${roomId}`, 409);
    }

    // Generate 32-byte (256-bit) cryptographically strong signing key
    const signingKey = crypto.randomBytes(32).toString('hex');
    const signingKeyEncrypted = encrypt(signingKey);

    const device = await prisma.rfidDevice.create({
      data: {
        roomId,
        label: data.label?.trim() || null,
        signingKeyEncrypted,
        isActive: true,
      },
      select: {
        id: true,
        roomId: true,
        label: true,
        isActive: true,
        createdAt: true,
      },
    });

    return {
      ...device,
      signingKey, // Returned exactly once in provisioning response!
      warning:
        'Store this signing key securely and flash it directly into device firmware. The plaintext key is encrypted at rest and cannot be retrieved again.',
    };
  }

  /**
   * Lists provisioned RFID devices (never exposes signing keys).
   */
  static async listRfidDevices() {
    return prisma.rfidDevice.findMany({
      select: {
        id: true,
        roomId: true,
        label: true,
        isActive: true,
        lastSeenAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}

export { AttendanceService };
export default AttendanceService;
