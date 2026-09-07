import assert from 'node:assert/strict';
import prisma from '../src/utils/prismaClient';
import { AttendanceService } from '../src/services/attendance.service';

const originals = {
  courseFindMany: prisma.course.findMany,
  enrollmentFindMany: prisma.enrollment.findMany,
  queryRaw: prisma.$queryRaw,
};

const sqlRow = (enrollmentId: number) => ({
  enrollmentId,
  warningStage: 'FINAL_WARNING',
  absencePercent: 20,
  maxAbsencePercent: 25,
  total: 10,
  present: 7,
  late: 2,
  absent: 1,
  excused: 0,
  pendingReview: 0,
});

const enrollmentRow = (id: number) => ({
  id,
  studentId: id,
  courseId: 7,
  status: 'ENROLLED',
  student: {
    id,
    studentId: `S${id}`,
    firstName: id === 201 ? 'Needle' : 'Student',
    lastName: String(id),
    year: 2,
    department: null,
    user: { email: `s${id}@example.test` },
  },
  course: {
    id: 7,
    courseCode: 'C7',
    name: 'Course 7',
    year: 2,
    semester: 1,
  },
  exemptionPeriods: [],
});

const installSharedMocks = () => {
  (prisma.course.findMany as any) = async (args: any) => {
    if (args?.select?.id && Object.keys(args.select).length === 1) {
      return [{ id: 7 }];
    }
    return [{ id: 7, courseCode: 'C7', name: 'Course 7', year: 2, semester: 1 }];
  };
  (prisma.enrollment.findMany as any) = async (args: any) =>
    args.where.id.in.map(enrollmentRow);
};

async function testSearchFiltersTheFullScopeBeforePagination() {
  let capturedQuery: any;
  installSharedMocks();
  (prisma as any).$queryRaw = async (query: any) => {
    capturedQuery = query;
    return [{
      totalMonitored: 1,
      blockedCount: 0,
      finalWarningCount: 1,
      firstWarningCount: 0,
      safeCount: 0,
      pageRows: [sqlRow(201)],
    }];
  };

  const result = await AttendanceService.getStaffAbsenceWarnings(
    { role: 'SUPER_ADMIN', id: 1 },
    { page: 1, limit: 20, search: 'Needle' } as any
  );

  const sql = capturedQuery.strings.join('?');
  assert.match(sql, /ILIKE/);
  assert.ok(
    capturedQuery.values.some((value: unknown) =>
      String(value).toLowerCase().includes('needle')
    )
  );
  assert.ok(sql.indexOf('ILIKE') < sql.lastIndexOf('LIMIT'));
  assert.equal(result.warningRecords[0]?.enrollmentId, 201);
  assert.equal(result.pagination.total, 1);
}

async function testExportReturnsMoreThanTheFirstPageWithFilters() {
  let capturedQuery: any;
  installSharedMocks();
  (prisma as any).$queryRaw = async (query: any) => {
    capturedQuery = query;
    return [{
      totalMonitored: 145,
      blockedCount: 0,
      finalWarningCount: 145,
      firstWarningCount: 0,
      safeCount: 0,
      pageRows: Array.from({ length: 145 }, (_, index) => sqlRow(index + 1)),
    }];
  };

  const result = await (AttendanceService as any).exportStaffAbsenceWarnings(
    { role: 'SUPER_ADMIN', id: 1 },
    {
      courseId: 7,
      year: 2,
      warningStage: 'FINAL_WARNING',
      search: 'Student',
      startDate: '2026-09-01',
      endDate: '2026-09-30',
    }
  );

  assert.equal(result.records.length, 145);
  assert.equal(result.total, 145);
  assert.equal(result.capped, false);
  assert.equal(result.limit, 10_000);
  assert.ok(capturedQuery.values.includes(7));
  assert.ok(capturedQuery.values.includes(2));
  assert.ok(capturedQuery.values.includes('FINAL_WARNING'));
  assert.ok(capturedQuery.values.includes(10_000));
  assert.equal(
    capturedQuery.values.filter((value: unknown) => value instanceof Date).length,
    2
  );
  assert.ok(
    capturedQuery.values.some((value: unknown) =>
      String(value).toLowerCase().includes('student')
    )
  );
}

const failures: unknown[] = [];
try {
  for (const test of [
    testSearchFiltersTheFullScopeBeforePagination,
    testExportReturnsMoreThanTheFirstPageWithFilters,
  ]) {
    try {
      await test();
    } catch (error) {
      failures.push(error);
    }
  }
} finally {
  prisma.course.findMany = originals.courseFindMany;
  prisma.enrollment.findMany = originals.enrollmentFindMany;
  (prisma as any).$queryRaw = originals.queryRaw;
}

if (failures.length > 0) {
  throw new AggregateError(failures, 'Attendance warning search/export regressions failed');
}

console.log('Attendance warning search/export checks passed');
