import assert from 'node:assert/strict';
import prisma from '../src/utils/prismaClient';
import { getAdminStats } from '../src/controllers/dashboard.controller';
import { getGeneralAnalytics } from '../src/controllers/analytics.controller';
import { AuthorizationError } from '../src/utils/appError';
import { getAdministrativeAnalyticsScopes } from '../src/utils/administrativeAnalyticsScope.utils';

async function invokeController(
  controller: any,
  request: Record<string, unknown>
): Promise<{ error?: unknown; body?: any }> {
  return new Promise((resolve) => {
    const response: any = {
      status: () => response,
      json: (body: any) => resolve({ body }),
    };
    controller(request, response, (error?: unknown) => resolve({ error }));
  });
}

async function runAdministrativeAnalyticsScopeSecurityTests() {
  assert.equal(getAdministrativeAnalyticsScopes({ role: 'ADMIN', collegeId: 4 }), null);
  assert.equal(
    getAdministrativeAnalyticsScopes({ role: 'COLLEGE_ADMIN', managedCollegeId: null }),
    null
  );
  assert.equal(
    getAdministrativeAnalyticsScopes({ role: 'DEPARTMENT_ADMIN', departmentId: 7 }),
    null
  );
  assert.equal(getAdministrativeAnalyticsScopes({ role: 'DOCTOR', doctor: { id: 1 } }), null);

  const legacyAdminScopes = getAdministrativeAnalyticsScopes({
    role: 'ADMIN',
    managedCollegeId: 4,
  });
  assert.equal(legacyAdminScopes?.cacheScope, 'college:4');
  assert.deepEqual(legacyAdminScopes?.payment, {
    student: { department: { collegeId: 4 } },
  });
  assert.deepEqual(legacyAdminScopes?.exam, {
    course: { department: { collegeId: 4 } },
  });
  assert.deepEqual(legacyAdminScopes?.user, {
    OR: [
      { collegeId: 4 },
      { managedCollegeId: 4 },
      { department: { collegeId: 4 } },
      { student: { department: { collegeId: 4 } } },
      { doctor: { department: { collegeId: 4 } } },
      { teachingAssistant: { department: { collegeId: 4 } } },
    ],
  });

  const analyticsDelegates: Array<[any, string]> = [
    [prisma.college, 'findMany'],
    [prisma.payment, 'groupBy'],
    [prisma.student, 'groupBy'],
    [prisma.department, 'findMany'],
    [prisma.student, 'findMany'],
    [prisma.exam, 'groupBy'],
    [prisma.attendance, 'groupBy'],
  ];
  const analyticsOriginals = analyticsDelegates.map(([delegate, method]) => delegate[method]);
  const analyticsQueries: any[] = [];

  try {
    analyticsDelegates.forEach(([delegate, method]) => {
      delegate[method] = async (args: any) => {
        analyticsQueries.push({ method, args });
        return [];
      };
    });

    const denied = await invokeController(getGeneralAnalytics, {
      user: { role: 'ADMIN', managedCollegeId: null },
      query: {},
    });
    assert.ok(denied.error instanceof AuthorizationError);
    assert.equal(analyticsQueries.length, 0);

    const result = await invokeController(getGeneralAnalytics, {
      user: { role: 'ADMIN', managedCollegeId: 4 },
      query: { departmentId: '7' },
    });
    assert.equal(result.error, undefined);
    assert.equal(analyticsQueries.length, 7);
    assert.deepEqual(analyticsQueries[0].args.where, { id: 4 });
    assert.deepEqual(analyticsQueries[0].args.select.departments.where, {
      AND: [{ collegeId: 4 }, { id: 7 }],
    });
    assert.deepEqual(analyticsQueries[1].args.where.AND.slice(1), [
      { student: { department: { collegeId: 4 } } },
      { student: { departmentId: 7 } },
    ]);
    assert.deepEqual(analyticsQueries[2].args.where, {
      AND: [{ department: { collegeId: 4 } }, { departmentId: 7 }],
    });
    assert.deepEqual(analyticsQueries[3].args.where, {
      AND: [{ collegeId: 4 }, { id: 7 }],
    });
    assert.deepEqual(analyticsQueries[5].args.where, {
      AND: [
        { course: { department: { collegeId: 4 } } },
        { course: { departmentId: 7 } },
      ],
    });
    assert.deepEqual(analyticsQueries[6].args.where.AND.slice(0, 2), [
      { course: { department: { collegeId: 4 } } },
      { course: { departmentId: 7 } },
    ]);
  } finally {
    analyticsDelegates.forEach(([delegate, method], index) => {
      delegate[method] = analyticsOriginals[index];
    });
  }

  const dashboardDelegates: Array<[any, string]> = [
    [prisma.college, 'count'],
    [prisma.student, 'count'],
    [prisma.doctor, 'count'],
    [prisma.course, 'count'],
    [prisma.department, 'count'],
    [prisma.payment, 'count'],
    [prisma.user, 'count'],
    [prisma.studentSuccessMetric, 'count'],
    [prisma.payment, 'groupBy'],
    [prisma.student, 'findMany'],
    [prisma.payment, 'findMany'],
    [prisma.exam, 'findMany'],
    [prisma.scheduleSlot, 'findMany'],
    [prisma.student, 'groupBy'],
    [prisma.college, 'findMany'],
  ];
  const dashboardOriginals = dashboardDelegates.map(([delegate, method]) => delegate[method]);
  const dashboardQueries: Array<{ delegate: any; method: string; args: any }> = [];

  try {
    dashboardDelegates.forEach(([delegate, method]) => {
      delegate[method] = async (args: any) => {
        dashboardQueries.push({ delegate, method, args });
        return method === 'count' ? 0 : [];
      };
    });

    const dashboardResult = await invokeController(getAdminStats, {
      user: { role: 'DEPARTMENT_ADMIN', managedDepartmentId: 7 },
    });
    assert.equal(dashboardResult.error, undefined);

    const collegeQueries = dashboardQueries.filter((query) => query.delegate === prisma.college);
    assert.deepEqual(collegeQueries[0].args.where, { departments: { some: { id: 7 } } });
    assert.deepEqual(collegeQueries[1].args.where, { departments: { some: { id: 7 } } });
    assert.deepEqual(collegeQueries[1].args.select.departments.where, { id: 7 });

    const userCounts = dashboardQueries.filter(
      (query) => query.delegate === prisma.user && query.method === 'count'
    );
    assert.deepEqual(userCounts[0].args.where.AND[1], {
      OR: [
        { departmentId: 7 },
        { managedDepartmentId: 7 },
        { student: { departmentId: 7 } },
        { doctor: { departmentId: 7 } },
        { teachingAssistant: { departmentId: 7 } },
      ],
    });
    assert.deepEqual(userCounts[1].args.where, {
      AND: [{ role: 'SUPER_ADMIN' }, { id: -1 }],
    });

    const examQuery = dashboardQueries.find(
      (query) => query.delegate === prisma.exam && query.method === 'findMany'
    );
    assert.deepEqual(examQuery.args.where.AND[1], { course: { departmentId: 7 } });
  } finally {
    dashboardDelegates.forEach(([delegate, method], index) => {
      delegate[method] = dashboardOriginals[index];
    });
  }
}

await runAdministrativeAnalyticsScopeSecurityTests();
console.log('Administrative analytics scope security checks passed');
