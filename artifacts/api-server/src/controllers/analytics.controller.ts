import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prismaClient';
import catchAsync from '../utils/catchAsync';
import { AuthorizationError, ValidationError } from '../utils/appError';
import { getAdministrativeAnalyticsScopes } from '../utils/administrativeAnalyticsScope.utils';
import { Prisma } from '@prisma/client';
import { getCache, setCache } from '../utils/redis.utils';

export const ANALYTICS_CACHE_TTL_SECONDS = 60;

interface AnalyticsCacheAdapter {
  get: (key: string) => Promise<any | null>;
  set: (key: string, value: unknown, ttlSeconds: number) => Promise<void>;
}

export async function withAnalyticsCache<T>(
  key: string,
  load: () => Promise<T>,
  cache: AnalyticsCacheAdapter = { get: getCache, set: setCache }
): Promise<T> {
  const cached = await cache.get(key);
  if (cached !== null) return cached as T;

  const value = await load();
  await cache.set(key, value, ANALYTICS_CACHE_TTL_SECONDS);
  return value;
}

export const getGeneralAnalytics = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { departmentId, startDate, endDate } = req.query;
    const scopes = getAdministrativeAnalyticsScopes(req.user);
    if (!scopes) {
      return next(new AuthorizationError('Access denied: Administrative scope is not configured'));
    }

    const requestedDepartmentId = departmentId
      ? parseInt(departmentId as string, 10)
      : undefined;
    if (
      requestedDepartmentId !== undefined &&
      (!Number.isInteger(requestedDepartmentId) || requestedDepartmentId <= 0)
    ) {
      return next(new ValidationError('Invalid departmentId'));
    }

    const dateFilter: any = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.gte = new Date(startDate as string);
      if (endDate) dateFilter.createdAt.lte = new Date(endDate as string);
    }

    const departmentFilter = requestedDepartmentId ? { id: requestedDepartmentId } : {};
    const studentDepartmentFilter = requestedDepartmentId
      ? { departmentId: requestedDepartmentId }
      : {};
    const relatedDepartmentFilter = requestedDepartmentId
      ? { course: { departmentId: requestedDepartmentId } }
      : {};

    const cacheKey = [
      'dashboard:analytics',
      scopes.cacheScope,
      `department:${requestedDepartmentId ?? 'all'}`,
      `start:${String(startDate || 'default')}`,
      `end:${String(endDate || 'default')}`,
    ].join(':');

    const data = await withAnalyticsCache(cacheKey, async () => {
      const now = new Date();
      const defaultTrendStart = new Date(now);
      defaultTrendStart.setFullYear(defaultTrendStart.getFullYear() - 1);
      const trendStart = startDate ? new Date(startDate as string) : defaultTrendStart;
      const trendEnd = endDate ? new Date(endDate as string) : now;
      const monthlyConditions: Prisma.Sql[] = [
        Prisma.sql`s."enrolledAt" >= ${trendStart}`,
        Prisma.sql`s."enrolledAt" <= ${trendEnd}`,
      ];

      if (scopes.cacheScope.startsWith('college:')) {
        const scopedCollegeId = Number(scopes.cacheScope.split(':')[1]);
        monthlyConditions.push(
          Prisma.sql`s."departmentId" IN (
            SELECT d."id" FROM "Department" d WHERE d."collegeId" = ${scopedCollegeId}
          )`
        );
      } else if (scopes.cacheScope.startsWith('department:')) {
        const scopedDepartmentId = Number(scopes.cacheScope.split(':')[1]);
        monthlyConditions.push(Prisma.sql`s."departmentId" = ${scopedDepartmentId}`);
      }
      if (requestedDepartmentId !== undefined) {
        monthlyConditions.push(Prisma.sql`s."departmentId" = ${requestedDepartmentId}`);
      }

    const [
      enrollmentByCollege,
      financialOverview,
      studentYearDistribution,
      departmentStats,
      monthlyEnrollment,
      examStats,
      attendanceOverview,
    ] = await Promise.all([
      // 1. Enrollment by College
      prisma.college.findMany({
        where: scopes.college,
        select: {
          name: true,
          departments: {
            where: { AND: [scopes.department, departmentFilter] },
            select: {
              _count: {
                select: { students: true },
              },
            },
          },
        },
      }),

      // 2. Financial Overview
      prisma.payment.groupBy({
        by: ['status'],
        _sum: { amount: true },
        _count: { _all: true },
        where: {
          AND: [
            dateFilter,
            scopes.payment,
            requestedDepartmentId
              ? { student: { departmentId: requestedDepartmentId } }
              : {},
          ],
        },
      }),

      // 3. Student distribution by year
      prisma.student.groupBy({
        by: ['year'],
        _count: { _all: true },
        where: { AND: [scopes.student, studentDepartmentFilter] },
      }),

      // 4. Department Stats
      prisma.department.findMany({
        where: { AND: [scopes.department, departmentFilter] },
        select: {
          name: true,
          _count: {
            select: { students: true, doctors: true, courses: true },
          },
        },
      }),

      // 5. Monthly Enrollment Trends, aggregated before leaving PostgreSQL
      prisma.$queryRaw<Array<{ month: Date; count: bigint | number }>>(Prisma.sql`
        SELECT DATE_TRUNC('month', s."enrolledAt") AS "month",
               COUNT(*)::bigint AS "count"
        FROM "Student" s
        WHERE ${Prisma.join(monthlyConditions, ' AND ')}
        GROUP BY DATE_TRUNC('month', s."enrolledAt")
        ORDER BY "month" ASC
      `),

      // 6. Exam Statistics
      prisma.exam.groupBy({
        by: ['type'],
        _count: { _all: true },
        where: { AND: [scopes.exam, relatedDepartmentFilter] },
      }),

      // 7. Attendance Overview
      prisma.attendance.groupBy({
        by: ['status'],
        _count: { _all: true },
        where: {
          AND: [
            { course: scopes.course },
            relatedDepartmentFilter,
            {
              date: {
                gte: new Date(new Date().setDate(new Date().getDate() - 30)),
              },
            },
          ],
        },
      }),
    ]);

    // Process Enrollment by College
    const collegeData = enrollmentByCollege.map((college: any) => ({
      name: college.name,
      students: college.departments.reduce(
        (sum: number, dept: any) => sum + dept._count.students,
        0
      ),
    }));

    // Process Monthly Enrollment
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
      const trendData = monthlyEnrollment.reduce((acc: Record<string, number>, row) => {
        const month = months[new Date(row.month).getMonth()];
        acc[month] = (acc[month] || 0) + Number(row.count);
        return acc;
      }, {});

      const trendArray = months.map((month) => ({
        name: month,
        count: trendData[month] || 0,
      }));

      return {
        collegeDistribution: collegeData,
        finance: financialOverview,
        yearDistribution: studentYearDistribution,
        departmentStats,
        enrollmentTrends: trendArray,
        examStats,
        attendanceOverview,
      };
    });

    res.json({ success: true, data });
  }
);
