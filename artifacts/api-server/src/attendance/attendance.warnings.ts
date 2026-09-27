import { Prisma } from '@prisma/client';
import { fromZonedTime } from 'date-fns-tz';
import prisma from '../utils/prismaClient';
import { AppError } from '../utils/appError';
import { getScopeWhere } from '../utils/scope.utils';
import {
  calculateAttendanceAttempts,
  selectAbsenceThreshold,
} from './attendance.calculation';

export const ATTENDANCE_TIME_ZONE = 'Africa/Cairo';
export const DEFAULT_ATTENDANCE_PAGE_SIZE = 20;
export const MAX_ATTENDANCE_PAGE_SIZE = 100;
export const STAFF_WARNING_EXPORT_LIMIT = 10_000;

export type StaffWarningStage =
  | 'BLOCKED'
  | 'FINAL_WARNING'
  | 'FIRST_WARNING'
  | 'SAFE';

export type StaffWarningOptions = {
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

export type StaffWarningSqlRow = {
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

export type StaffWarningQueryRow = {
  totalMonitored: number;
  blockedCount: number;
  finalWarningCount: number;
  firstWarningCount: number;
  safeCount: number;
  pageRows: StaffWarningSqlRow[];
};

export const normalizePagination = (page?: number, limit?: number) => {
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

export const nextDateOnly = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return next.toISOString().slice(0, 10);
};

export const cairoBoundary = (value: string, endExclusive: boolean) => {
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

export const buildDateWhere = (
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

export class AttendanceWarningService {
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

    const departmentIds = Array.from(
      new Set(
        student.enrollments
          .map((enrollment) => enrollment.course.departmentId)
          .filter((departmentId): departmentId is number => departmentId !== null)
      )
    );

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
    const [calculations, policies, notifications] =
      await Promise.all([
        calculateAttendanceAttempts(
          student.enrollments.map((enrollment) => ({
            id: enrollment.id,
            studentId: student.id,
            courseId: enrollment.courseId,
            semester: enrollment.semester,
            academicYear: enrollment.academicYear,
            groupId: student.groupId,
            enrolledAt: enrollment.enrolledAt,
            exemptionPeriods: enrollment.exemptionPeriods,
          })),
          {
            dateWhere: buildDateWhere(
              options.date,
              options.startDate,
              options.endDate
            ),
          }
        ),
        prisma.absenceThresholdPolicy.findMany({
          where: {
            OR: [
              { courseId: { in: student.enrollments.map((item) => item.courseId) } },
              ...(departmentIds.length > 0
                ? [{ departmentId: { in: departmentIds }, courseId: null }]
                : []),
              { departmentId: null, courseId: null },
            ],
          },
          select: {
            id: true,
            courseId: true,
            departmentId: true,
            maxAbsencePercent: true,
          },
        }),
        prisma.notification.findMany({
          where: notificationWhere,
          orderBy: { createdAt: 'desc' },
          take: 20,
        }),
      ]);

    const coursesData = student.enrollments.map((enrollment) => {
      const calculation = calculations.get(enrollment.id);
      const absencePercent = calculation
        ? Math.round(calculation.absencePercent * 10) / 10
        : 0;
      const maxAbsencePercent = selectAbsenceThreshold(
        {
          courseId: enrollment.courseId,
          departmentId: enrollment.course.departmentId,
          customAbsenceThreshold: enrollment.customAbsenceThreshold,
        },
        policies
      );

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
        totalSessions: calculation?.total ?? 0,
        present: calculation?.present ?? 0,
        late: calculation?.late ?? 0,
        absent: calculation?.absent ?? 0,
        excused: calculation?.excused ?? 0,
        pendingReview: calculation?.pendingReview ?? 0,
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

    const normalizedSearch = options.search?.trim().slice(0, 200);
    const enrollmentWhere: Prisma.EnrollmentWhereInput = {
      courseId: { in: options.courseId ? [options.courseId] : courseIds },
      status: { in: ['ENROLLED', 'BLOCKED'] },
      ...(options.year !== undefined && { student: { year: options.year } }),
      ...(normalizedSearch && {
        OR: [
          { student: { studentId: normalizedSearch } },
          { course: { courseCode: normalizedSearch } },
          { student: { firstName: { contains: normalizedSearch, mode: 'insensitive' } } },
          { student: { lastName: { contains: normalizedSearch, mode: 'insensitive' } } },
          { student: { user: { email: { equals: normalizedSearch, mode: 'insensitive' } } } },
          { course: { name: { contains: normalizedSearch, mode: 'insensitive' } } },
        ],
      }),
    };
    const [enrollments, coursesList] = await Promise.all([
      prisma.enrollment.findMany({
        where: enrollmentWhere,
        select: {
          id: true,
          studentId: true,
          courseId: true,
          semester: true,
          academicYear: true,
          status: true,
          enrolledAt: true,
          customAbsenceThreshold: true,
          student: {
            select: {
              groupId: true,
            },
          },
          course: {
            select: {
              departmentId: true,
            },
          },
          exemptionPeriods: {
            select: {
              startDate: true,
              endDate: true,
            },
          },
        },
        orderBy: { id: 'asc' },
      }),
      paginationOverride?.includeCoursesList === false
        ? Promise.resolve([])
        : prisma.course.findMany({
            where: {
              id: { in: courseIds },
              enrollments: { some: { status: { in: ['ENROLLED', 'BLOCKED'] } } },
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
    const departmentIds = Array.from(
      new Set(
        enrollments
          .map((enrollment) => enrollment.course.departmentId)
          .filter((id): id is number => id !== null)
      )
    );
    const [calculations, policies] = await Promise.all([
      calculateAttendanceAttempts(
        enrollments.map((enrollment) => ({
          id: enrollment.id,
          studentId: enrollment.studentId,
          courseId: enrollment.courseId,
          semester: enrollment.semester,
          academicYear: enrollment.academicYear,
          groupId: enrollment.student.groupId,
          enrolledAt: enrollment.enrolledAt,
          exemptionPeriods: enrollment.exemptionPeriods,
        })),
        {
          dateWhere: buildDateWhere(options.date, options.startDate, options.endDate),
        }
      ),
      prisma.absenceThresholdPolicy.findMany({
        where: {
          OR: [
            { courseId: { in: enrollments.map((enrollment) => enrollment.courseId) } },
            ...(departmentIds.length > 0
              ? [{ departmentId: { in: departmentIds }, courseId: null }]
              : []),
            { departmentId: null, courseId: null },
          ],
        },
        select: {
          id: true,
          courseId: true,
          departmentId: true,
          maxAbsencePercent: true,
        },
      }),
    ]);
    const warningMetrics = enrollments.map((enrollment) => {
      const calculation = calculations.get(enrollment.id);
      const absencePercent = calculation
        ? Math.round(calculation.absencePercent * 10) / 10
        : 0;
      const maxAbsencePercent = selectAbsenceThreshold(
        {
          courseId: enrollment.courseId,
          departmentId: enrollment.course.departmentId,
          customAbsenceThreshold: enrollment.customAbsenceThreshold,
        },
        policies
      );
      const warningStage: StaffWarningStage =
        enrollment.status === 'BLOCKED' || absencePercent >= maxAbsencePercent
          ? 'BLOCKED'
          : absencePercent >= Math.max(0, maxAbsencePercent - 5)
            ? 'FINAL_WARNING'
            : absencePercent >= 10
              ? 'FIRST_WARNING'
              : 'SAFE';
      return {
        enrollmentId: enrollment.id,
        warningStage,
        absencePercent,
        maxAbsencePercent,
        totalSessions: calculation?.total ?? 0,
        present: calculation?.present ?? 0,
        late: calculation?.late ?? 0,
        absent: calculation?.absent ?? 0,
        excused: calculation?.excused ?? 0,
        pendingReview: calculation?.pendingReview ?? 0,
      };
    });
    const blockedCount = warningMetrics.filter((row) => row.warningStage === 'BLOCKED').length;
    const finalWarningCount = warningMetrics.filter((row) => row.warningStage === 'FINAL_WARNING').length;
    const firstWarningCount = warningMetrics.filter((row) => row.warningStage === 'FIRST_WARNING').length;
    const safeCount = warningMetrics.filter((row) => row.warningStage === 'SAFE').length;
    const totalMonitored = warningMetrics.length;
    const filteredRecords = options.warningStage
      ? warningMetrics.filter((row) => row.warningStage === options.warningStage)
      : warningMetrics;
    const pageMetrics = filteredRecords.slice(skip, skip + limit);
    const filteredTotal = filteredRecords.length;
    const pageEnrollments = pageMetrics.length > 0
      ? await prisma.enrollment.findMany({
          where: { id: { in: pageMetrics.map((row) => row.enrollmentId) } },
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
                    college: { select: { id: true, name: true, nameAr: true } },
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
      pageEnrollments.map((enrollment) => [enrollment.id, enrollment])
    );
    const warningRecords = pageMetrics.flatMap((metrics) => {
      const enrollment = enrollmentById.get(metrics.enrollmentId);
      if (!enrollment) return [];
      return [{
        ...metrics,
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
}

export default AttendanceWarningService;
