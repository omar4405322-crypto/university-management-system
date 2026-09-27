import assert from 'node:assert/strict';
import prisma from '../src/utils/prismaClient';
import { AttendanceService } from '../src/services/attendance.service';
import { AttendanceSessionService } from '../src/services/attendance-session.service';

const original = {
  courseFindFirst: prisma.course.findFirst,
  courseFindMany: prisma.course.findMany,
  studentFindUnique: prisma.student.findUnique,
  enrollmentFindMany: prisma.enrollment.findMany,
  attendanceFindMany: prisma.attendance.findMany,
  attendanceCount: prisma.attendance.count,
  attendanceGroupBy: prisma.attendance.groupBy,
  sessionFindMany: prisma.attendanceSession.findMany,
  sessionCount: prisma.attendanceSession.count,
  slotFindUnique: prisma.scheduleSlot.findUnique,
  slotFindMany: prisma.scheduleSlot.findMany,
  policyFindMany: prisma.absenceThresholdPolicy.findMany,
  queryRaw: prisma.$queryRaw,
};

async function testCourseAttendanceIsBoundedAndFiltered() {
  let capturedFind: any;
  let capturedGroupBy: any;

  (prisma.course.findFirst as any) = async () => ({ id: 7 });
  (prisma.attendance.findMany as any) = async (args: any) => {
    capturedFind = args;
    return [];
  };
  (prisma.attendance.count as any) = async () => 245;
  (prisma.attendance.groupBy as any) = async (args: any) => {
    capturedGroupBy = args;
    return [{ status: 'PRESENT', _count: { _all: 200 } }];
  };

  const result = await AttendanceService.getCourseAttendance(
    { role: 'SUPER_ADMIN', id: 1 },
    7,
    {
      startDate: '2026-09-01',
      endDate: '2026-09-30',
      semester: 1,
      academicYear: 2026,
    } as any
  );

  assert.equal(capturedFind.take, 20);
  assert.equal(capturedFind.skip, 0);
  assert.equal(capturedFind.where.semester, 1);
  assert.equal(capturedFind.where.academicYear, 2026);
  assert.ok(capturedFind.where.date.gte instanceof Date);
  assert.ok(capturedFind.where.date.lt instanceof Date);
  assert.deepEqual(capturedGroupBy.where, capturedFind.where);
  assert.equal((result as any).pagination.total, 245);
  assert.equal((result as any).stats.PRESENT, 200);
}

async function testMyAttendancePagesRowsAndAggregatesSeparately() {
  let capturedSessionFind: any;
  const capturedSessionCounts: any[] = [];
  let capturedAttendanceFind: any;
  let capturedAttendanceGroupBy: any;
  let capturedEnrollmentWhere: any;

  (prisma.student.findUnique as any) = async (args: any) => {
    capturedEnrollmentWhere = args.select.enrollments.where;
    return {
      id: 44,
      groupId: 9,
      enrollments: [
        {
          id: 88,
          courseId: 7,
          semester: 1,
          academicYear: 2026,
          exemptionPeriods: [
            {
              startDate: new Date('2026-09-10T00:00:00.000Z'),
              endDate: new Date('2026-09-11T23:59:59.999Z'),
            },
          ],
        },
      ],
    };
  };
  (prisma.attendanceSession.findMany as any) = async (args: any) => {
    capturedSessionFind = args;
    return [];
  };
  (prisma.attendanceSession.count as any) = async (args: any) => {
    capturedSessionCounts.push(args);
    return 320;
  };
  (prisma.attendance.findMany as any) = async (args: any) => {
    capturedAttendanceFind = args;
    return [];
  };
  (prisma.attendance.groupBy as any) = async (args: any) => {
    capturedAttendanceGroupBy = args;
    return [
      { status: 'PRESENT', _count: { _all: 200 } },
      { status: 'LATE', _count: { _all: 40 } },
      { status: 'EXCUSED', _count: { _all: 20 } },
      { status: 'PENDING_REVIEW', _count: { _all: 10 } },
    ];
  };

  const result = await AttendanceService.getMyAttendance(440, {
    courseId: 7,
    page: 2,
    limit: 1_000,
    startDate: '2026-09-01',
    endDate: '2026-09-30',
    semester: 1,
    academicYear: 2026,
  } as any);

  assert.equal(capturedSessionFind.take, 100);
  assert.equal(capturedSessionFind.skip, 100);
  assert.deepEqual(capturedEnrollmentWhere, {
    status: 'ENROLLED',
    courseId: 7,
    semester: 1,
    academicYear: 2026,
  });
  assert.deepEqual(capturedSessionCounts[0].where, capturedSessionFind.where);
  assert.equal(capturedSessionFind.where.OR[0].NOT, undefined);
  assert.ok(capturedSessionCounts[1].where.OR[0].NOT);
  assert.deepEqual(capturedAttendanceFind.where.sessionId, { in: [] });
  assert.equal(capturedAttendanceGroupBy.where.studentId, 44);
  assert.ok(capturedAttendanceGroupBy.where.session.is.OR[0].NOT);
  assert.equal((result as any).pagination.total, 320);
  assert.equal((result as any).stats.PRESENT, 200);
  assert.equal((result as any).stats.ABSENT, 50);
  assert.equal((result as any).stats.attendancePercentage, 75.9);
}

async function testSlotSessionHistoryIsBoundedAndFiltered() {
  let capturedFind: any;
  let capturedCount: any;

  (prisma.scheduleSlot.findUnique as any) = async () => ({
    id: 202,
    courseId: 7,
    timetable: { academicYear: 2026, semester: 1 },
  });
  (prisma.attendanceSession.findMany as any) = async (args: any) => {
    capturedFind = args;
    return [];
  };
  (prisma.attendanceSession.count as any) = async (args: any) => {
    capturedCount = args;
    return 180;
  };

  const result = await AttendanceSessionService.getSlotSessions(
    { role: 'SUPER_ADMIN', id: 1 },
    202,
    {
      page: 3,
      startDate: '2026-01-01',
      endDate: '2026-06-30',
      semester: 1,
      academicYear: 2026,
    } as any
  );

  assert.equal(capturedFind.take, 20);
  assert.equal(capturedFind.skip, 40);
  assert.ok(capturedFind.where.createdAt.gte instanceof Date);
  assert.ok(capturedFind.where.createdAt.lt instanceof Date);
  assert.deepEqual(capturedFind.where.scheduleSlot, {
    timetable: { is: { semester: 1, academicYear: 2026 } },
  });
  assert.deepEqual(capturedCount.where, capturedFind.where);
  assert.equal((result as any).pagination.total, 180);
}

async function testStaffWarningsUseBatchedSharedCalculation() {
  let enrollmentRowsRequested = 0;
  let pageDetailRowsRequested = 0;
  let attendanceReads = 0;

  (prisma.course.findMany as any) = async (args: any) => {
    if (args?.select?.id && Object.keys(args.select).length === 1) {
      return [{ id: 7 }];
    }
    return [{ id: 7, courseCode: 'C7', name: 'Course 7', year: 2, semester: 1 }];
  };
  (prisma.enrollment.findMany as any) = async (args: any) => {
    if (args.where.id?.in) {
      pageDetailRowsRequested = args.where.id.in.length;
      return args.where.id.in.map((id: number) => ({
        id,
        status: 'ENROLLED',
        student: {
          id,
          studentId: `S${id}`,
          firstName: 'Student',
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
      }));
    }
    assert.deepEqual(args.where.courseId.in, [7]);
    enrollmentRowsRequested = 50;
    return Array.from({ length: 50 }, (_, index) => ({
      id: index + 1,
      studentId: index + 1,
      courseId: 7,
      semester: 1,
      academicYear: 2026,
      enrolledAt: new Date('2026-01-01T00:00:00.000Z'),
      customAbsenceThreshold: null,
      status: 'ENROLLED',
      student: {
        id: index + 1,
        groupId: null,
        studentId: `S${index + 1}`,
        firstName: 'Student',
        lastName: String(index + 1),
        year: 2,
        department: null,
        user: { email: `s${index + 1}@example.test` },
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
    }));
  };
  (prisma.scheduleSlot.findMany as any) = async () => [];
  (prisma.attendance.findMany as any) = async () => {
    attendanceReads += 1;
    return Array.from({ length: 50 }, (_, index) => ({
      id: index + 1,
      studentId: index + 1,
      courseId: 7,
      semester: 1,
      academicYear: 2026,
      sessionId: null,
      status: 'LATE',
      remarks: null,
      date: new Date('2026-02-01T00:00:00.000Z'),
    }));
  };
  (prisma.absenceThresholdPolicy.findMany as any) = async () => [
    { id: 1, courseId: null, departmentId: null, maxAbsencePercent: 55 },
  ];

  const result = await AttendanceService.getStaffAbsenceWarnings(
    { role: 'SUPER_ADMIN', id: 1 },
    { page: 2, limit: 25, courseId: 7, year: 2, warningStage: 'FINAL_WARNING' } as any
  );

  assert.equal(enrollmentRowsRequested, 50);
  assert.equal(pageDetailRowsRequested, 25);
  assert.equal(attendanceReads, 1);
  assert.equal(result.warningRecords.length, 25);
  assert.equal((result as any).pagination.total, 50);
  assert.equal(result.summary.totalMonitored, 50);
  assert.equal(result.summary.finalWarningCount, 50);
}

try {
  await testCourseAttendanceIsBoundedAndFiltered();
  await testMyAttendancePagesRowsAndAggregatesSeparately();
  await testSlotSessionHistoryIsBoundedAndFiltered();
  await testStaffWarningsUseBatchedSharedCalculation();
  console.log('Attendance pagination performance checks passed');
} finally {
  prisma.course.findFirst = original.courseFindFirst;
  prisma.course.findMany = original.courseFindMany;
  prisma.student.findUnique = original.studentFindUnique;
  prisma.enrollment.findMany = original.enrollmentFindMany;
  prisma.attendance.findMany = original.attendanceFindMany;
  prisma.attendance.count = original.attendanceCount;
  prisma.attendance.groupBy = original.attendanceGroupBy;
  prisma.attendanceSession.findMany = original.sessionFindMany;
  prisma.attendanceSession.count = original.sessionCount;
  prisma.scheduleSlot.findUnique = original.slotFindUnique;
  prisma.scheduleSlot.findMany = original.slotFindMany;
  prisma.absenceThresholdPolicy.findMany = original.policyFindMany;
  (prisma as any).$queryRaw = original.queryRaw;
}
