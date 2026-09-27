import assert from 'node:assert/strict';
import prisma from '../src/utils/prismaClient';
import { AttendanceService } from '../src/services/attendance.service';

const originals = {
  courseFindMany: prisma.course.findMany,
  enrollmentFindMany: prisma.enrollment.findMany,
  slotFindMany: prisma.scheduleSlot.findMany,
  sessionFindMany: prisma.attendanceSession.findMany,
  attendanceFindMany: prisma.attendance.findMany,
  policyFindMany: prisma.absenceThresholdPolicy.findMany,
};

const enrollmentRow = (id: number, firstName = 'Student') => ({
  id,
  studentId: id,
  courseId: 7,
  semester: 1,
  academicYear: 2026,
  status: 'ENROLLED',
  enrolledAt: new Date('2026-01-01T00:00:00.000Z'),
  customAbsenceThreshold: null,
  student: {
    id,
    groupId: null,
    studentId: `S${id}`,
    firstName,
    lastName: String(id),
    year: 2,
    department: null,
    user: { email: `s${id}@example.test` },
  },
  course: {
    id: 7,
    courseCode: 'C7',
    name: 'Course 7',
    credits: 3,
    year: 2,
    semester: 1,
    departmentId: 4,
  },
  exemptionPeriods: [],
});

let capturedEnrollmentWhere: any;
let rows: ReturnType<typeof enrollmentRow>[] = [];

function installSharedMocks() {
  (prisma.course.findMany as any) = async (args: any) =>
    args?.select?.id && Object.keys(args.select).length === 1
      ? [{ id: 7 }]
      : [{ id: 7, courseCode: 'C7', name: 'Course 7', year: 2, semester: 1 }];
  (prisma.enrollment.findMany as any) = async (args: any) => {
    if (args.where.id?.in) {
      const requested = new Set(args.where.id.in);
      return rows.filter((row) => requested.has(row.id));
    }
    capturedEnrollmentWhere = args.where;
    return rows;
  };
  (prisma.scheduleSlot.findMany as any) = async () => [];
  (prisma.attendanceSession.findMany as any) = async () => [];
  (prisma.attendance.findMany as any) = async () => rows.flatMap((row) => [
    {
      id: row.id * 10,
      studentId: row.studentId,
      courseId: 7,
      semester: 1,
      academicYear: 2026,
      sessionId: null,
      status: 'ABSENT',
      remarks: null,
      date: new Date('2026-09-10T00:00:00.000Z'),
    },
    ...Array.from({ length: 4 }, (_, index) => ({
      id: row.id * 10 + index + 1,
      studentId: row.studentId,
      courseId: 7,
      semester: 1,
      academicYear: 2026,
      sessionId: null,
      status: 'PRESENT',
      remarks: null,
      date: new Date(`2026-09-${String(index + 11).padStart(2, '0')}T00:00:00.000Z`),
    })),
  ]);
  (prisma.absenceThresholdPolicy.findMany as any) = async () => [
    { id: 1, courseId: null, departmentId: null, maxAbsencePercent: 25 },
  ];
}

async function testSearchFiltersBeforeCalculationAndPagination() {
  rows = [enrollmentRow(201, 'Needle')];
  const result = await AttendanceService.getStaffAbsenceWarnings(
    { role: 'SUPER_ADMIN', id: 1 },
    { page: 1, limit: 20, search: 'Needle' } as any
  );
  assert.equal(capturedEnrollmentWhere.OR[0].student.studentId, 'Needle');
  assert.equal(capturedEnrollmentWhere.OR[1].course.courseCode, 'Needle');
  assert.equal(
    capturedEnrollmentWhere.OR[2].student.firstName.contains,
    'Needle'
  );
  assert.equal(result.warningRecords[0]?.enrollmentId, 201);
  assert.equal(result.pagination.total, 1);
}

async function testExportReturnsMoreThanFirstPageWithFilters() {
  rows = Array.from({ length: 145 }, (_, index) => enrollmentRow(index + 1));
  const result = await AttendanceService.exportStaffAbsenceWarnings(
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
  assert.deepEqual(capturedEnrollmentWhere.courseId.in, [7]);
  assert.equal(capturedEnrollmentWhere.student.year, 2);
  assert.equal(result.records.length, 145);
  assert.equal(result.total, 145);
  assert.equal(result.capped, false);
  assert.equal(result.limit, 10_000);
}

try {
  installSharedMocks();
  await testSearchFiltersBeforeCalculationAndPagination();
  await testExportReturnsMoreThanFirstPageWithFilters();
  console.log('Attendance warning search/export checks passed');
} finally {
  prisma.course.findMany = originals.courseFindMany;
  prisma.enrollment.findMany = originals.enrollmentFindMany;
  prisma.scheduleSlot.findMany = originals.slotFindMany;
  prisma.attendanceSession.findMany = originals.sessionFindMany;
  prisma.attendance.findMany = originals.attendanceFindMany;
  prisma.absenceThresholdPolicy.findMany = originals.policyFindMany;
}
