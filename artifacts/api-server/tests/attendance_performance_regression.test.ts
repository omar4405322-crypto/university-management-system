import assert from 'node:assert/strict';
import prisma from '../src/utils/prismaClient';
import attendanceEngine from '../src/attendance/attendance.engine';
import { AttendanceService } from '../src/services/attendance.service';

async function testBulkAttendanceUsesBoundedConcurrency() {
  const originalCourseFindFirst = prisma.course.findFirst;
  const originalRecordAttendance = attendanceEngine.recordAttendance;
  const originalDatabaseUrl = process.env.DATABASE_URL;
  let active = 0;
  let maximumActive = 0;

  try {
    process.env.DATABASE_URL =
      'postgresql://test:test@localhost:5432/test?connection_limit=4';
    (prisma.course.findFirst as any) = async () => ({ id: 91 });
    attendanceEngine.recordAttendance = async (options: any) => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise((resolve) => setTimeout(resolve, 1));
      active -= 1;
      return {
        attendance: { id: options.payload.studentId },
        isNew: true,
      } as any;
    };

    const records = Array.from({ length: 500 }, (_, index) => ({
      studentId: index + 1,
      status: 'PRESENT' as const,
    }));
    const result = await attendanceEngine.recordBulkManual(records, {
      userId: 1,
      courseId: 91,
      actor: { role: 'SUPER_ADMIN' },
    });

    assert.equal(maximumActive, 2, 'connection_limit=4 should reserve two pool slots');
    assert.ok(result.every((row) => row.success), 'all successful writes must keep their success envelope');
    assert.deepEqual(
      result.map((row) => row.success ? row.attendance?.id : undefined),
      records.map((row) => row.studentId),
      'bounded chunks must preserve input/result order'
    );
  } finally {
    prisma.course.findFirst = originalCourseFindFirst;
    attendanceEngine.recordAttendance = originalRecordAttendance;
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
  }
}

async function testRecalculationQueueCoalescesClassWideChanges() {
  const engine = attendanceEngine as any;
  const originalBatchRecalculation = engine.recalculateAbsenceBatch;
  const batches: Array<Array<{ studentId: number; courseId: number }>> = [];

  try {
    engine.recalculateAbsenceBatch = async (
      keys: Array<{ studentId: number; courseId: number }>
    ) => {
      batches.push(keys);
    };

    const queued = Array.from({ length: 500 }, (_, index) => ({
      studentId: index + 1,
      courseId: 77,
    })).flatMap((key) => [
      engine.queueAbsenceRecalculation(key.studentId, key.courseId),
      engine.queueAbsenceRecalculation(key.studentId, key.courseId),
    ]);
    await Promise.all(queued);

    assert.equal(batches.length, 5, '500 keys should be bounded to five aggregate batches');
    assert.ok(batches.every((batch) => batch.length <= 100));
    assert.equal(
      batches.reduce((total, batch) => total + batch.length, 0),
      500,
      'duplicate student/course keys should coalesce'
    );
  } finally {
    engine.recalculateAbsenceBatch = originalBatchRecalculation;
  }
}

async function testGroupedRecalculationPreservesExemptionWindows() {
  const originals = {
    enrollmentFindMany: prisma.enrollment.findMany,
    scheduleSlotFindMany: prisma.scheduleSlot.findMany,
    attendanceFindMany: prisma.attendance.findMany,
    policyFindMany: prisma.absenceThresholdPolicy.findMany,
    enrollmentUpdateMany: prisma.enrollment.updateMany,
    notificationCreate: prisma.notification.create,
    transaction: prisma.$transaction,
  };
  const exemptionStart = new Date('2026-09-02T00:00:00.000Z');
  const exemptionEnd = new Date('2026-09-03T23:59:59.999Z');
  let attendanceWhere: any;
  let updatedStatus: string | undefined;

  try {
    (prisma.enrollment.findMany as any) = async () => [
      {
        id: 99,
        studentId: 44,
        courseId: 22,
        semester: 1,
        academicYear: 2026,
        status: 'ENROLLED',
        enrolledAt: new Date('2026-01-01T00:00:00.000Z'),
        customAbsenceThreshold: 40,
        exemptionPeriods: [{ startDate: exemptionStart, endDate: exemptionEnd }],
        student: { userId: 440, groupId: null },
        course: { name: 'Networks', departmentId: 4 },
      },
    ];
    (prisma.scheduleSlot.findMany as any) = async () => [];
    (prisma.attendance.findMany as any) = async (args: any) => {
      attendanceWhere = args.where;
      return [
        { id: 1, studentId: 44, courseId: 22, semester: 1, academicYear: 2026, sessionId: null, status: 'PRESENT', remarks: null, date: new Date('2026-09-01T00:00:00.000Z') },
        { id: 2, studentId: 44, courseId: 22, semester: 1, academicYear: 2026, sessionId: null, status: 'ABSENT', remarks: null, date: new Date('2026-09-04T00:00:00.000Z') },
        { id: 3, studentId: 44, courseId: 22, semester: 1, academicYear: 2026, sessionId: null, status: 'PENDING_REVIEW', remarks: null, date: new Date('2026-09-05T00:00:00.000Z') },
      ];
    };
    (prisma.absenceThresholdPolicy.findMany as any) = async () => [];
    (prisma.enrollment.updateMany as any) = async (args: any) => {
      updatedStatus = args.data.status;
      return { count: 1 };
    };
    (prisma as any).$transaction = async (callback: any) => callback({
      enrollment: { updateMany: prisma.enrollment.updateMany },
      auditLog: { create: async () => ({ id: 1 }) },
    });
    (prisma.notification.create as any) = async (args: any) => args.data;

    await attendanceEngine.recalculateAbsence(44, 22);

    assert.deepEqual(attendanceWhere.OR[0].NOT, {
      OR: [{ date: { gte: exemptionStart, lte: exemptionEnd } }],
    });
    assert.equal(
      updatedStatus,
      'BLOCKED',
      'PENDING_REVIEW remains excluded from the grouped denominator'
    );
  } finally {
    prisma.enrollment.findMany = originals.enrollmentFindMany;
    prisma.scheduleSlot.findMany = originals.scheduleSlotFindMany;
    prisma.attendance.findMany = originals.attendanceFindMany;
    prisma.absenceThresholdPolicy.findMany = originals.policyFindMany;
    prisma.enrollment.updateMany = originals.enrollmentUpdateMany;
    prisma.notification.create = originals.notificationCreate;
    prisma.$transaction = originals.transaction;
  }
}

async function testStudentWarningsUseFixedQueryCount() {
  const originals = {
    studentFindUnique: prisma.student.findUnique,
    studentGroupFindMany: prisma.studentGroup.findMany,
    scheduleSlotFindMany: prisma.scheduleSlot.findMany,
    attendanceSessionFindMany: prisma.attendanceSession.findMany,
    attendanceFindMany: prisma.attendance.findMany,
    policyFindMany: prisma.absenceThresholdPolicy.findMany,
    notificationFindMany: prisma.notification.findMany,
  };
  const calls = {
    student: 0,
    groups: 0,
    slots: 0,
    sessions: 0,
    attendanceRows: 0,
    policies: 0,
    notifications: 0,
  };

  try {
    (prisma.student.findUnique as any) = async () => {
      calls.student += 1;
      return {
        id: 51,
        userId: 501,
        groupId: 9,
        enrollments: [
          {
            id: 1,
            studentId: 51,
            courseId: 11,
            semester: 1,
            academicYear: 2026,
            enrolledAt: new Date('2026-01-01T00:00:00.000Z'),
            status: 'ENROLLED',
            customAbsenceThreshold: null,
            course: { id: 11, courseCode: 'C11', name: 'Course 11', departmentId: 4 },
            exemptionPeriods: [],
          },
          {
            id: 2,
            studentId: 51,
            courseId: 12,
            semester: 1,
            academicYear: 2026,
            enrolledAt: new Date('2026-01-01T00:00:00.000Z'),
            status: 'ENROLLED',
            customAbsenceThreshold: null,
            course: { id: 12, courseCode: 'C12', name: 'Course 12', departmentId: 4 },
            exemptionPeriods: [],
          },
        ],
      };
    };
    (prisma.studentGroup.findMany as any) = async () => {
      calls.groups += 1;
      return [{ id: 9, parentGroupId: null }];
    };
    (prisma.scheduleSlot.findMany as any) = async () => {
      calls.slots += 1;
      return [
        { id: 101, courseId: 11, groupId: 9, timetable: { semester: 1 }, course: { semester: 1 } },
        { id: 102, courseId: 12, groupId: 9, timetable: { semester: 1 }, course: { semester: 1 } },
      ];
    };
    (prisma.attendanceSession.findMany as any) = async () => {
      calls.sessions += 1;
      return [
        { id: 201, scheduleSlotId: 101, createdAt: new Date('2026-02-01T00:00:00.000Z') },
        { id: 202, scheduleSlotId: 101, createdAt: new Date('2026-02-02T00:00:00.000Z') },
        { id: 203, scheduleSlotId: 102, createdAt: new Date('2026-02-03T00:00:00.000Z') },
      ];
    };
    (prisma.attendance.findMany as any) = async () => {
      calls.attendanceRows += 1;
      return [
        { id: 1, studentId: 51, courseId: 11, semester: 1, academicYear: 2026, sessionId: 201, status: 'PRESENT', remarks: null, date: new Date('2026-02-01T00:00:00.000Z') },
        { id: 2, studentId: 51, courseId: 12, semester: 1, academicYear: 2026, sessionId: 203, status: 'LATE', remarks: null, date: new Date('2026-02-03T00:00:00.000Z') },
        { id: 3, studentId: 51, courseId: 11, semester: 1, academicYear: 2026, sessionId: null, status: 'EXCUSED', remarks: null, date: new Date('2026-02-04T00:00:00.000Z') },
      ];
    };
    (prisma.absenceThresholdPolicy.findMany as any) = async () => {
      calls.policies += 1;
      return [{ id: 1, courseId: null, departmentId: null, maxAbsencePercent: 25 }];
    };
    (prisma.notification.findMany as any) = async () => {
      calls.notifications += 1;
      return [];
    };

    const result = await AttendanceService.getMyAbsenceWarnings({
      id: 501,
      role: 'STUDENT',
    });

    assert.equal(result.courses.length, 2);
    assert.deepEqual(
      result.courses.map((course) => ({
        courseId: course.courseId,
        totalSessions: course.totalSessions,
        present: course.present,
        late: course.late,
        absent: course.absent,
        excused: course.excused,
        absencePercent: course.absencePercent,
      })),
      [
        {
          courseId: 11,
          totalSessions: 3,
          present: 1,
          late: 0,
          absent: 1,
          excused: 1,
          absencePercent: 50,
        },
        {
          courseId: 12,
          totalSessions: 1,
          present: 0,
          late: 1,
          absent: 0,
          excused: 0,
          absencePercent: 50,
        },
      ]
    );
    assert.deepEqual(calls, {
      student: 1,
      groups: 1,
      slots: 1,
      sessions: 1,
      attendanceRows: 1,
      policies: 1,
      notifications: 1,
    });
  } finally {
    prisma.student.findUnique = originals.studentFindUnique;
    prisma.studentGroup.findMany = originals.studentGroupFindMany;
    prisma.scheduleSlot.findMany = originals.scheduleSlotFindMany;
    prisma.attendanceSession.findMany = originals.attendanceSessionFindMany;
    prisma.attendance.findMany = originals.attendanceFindMany;
    prisma.absenceThresholdPolicy.findMany = originals.policyFindMany;
    prisma.notification.findMany = originals.notificationFindMany;
  }
}

await testBulkAttendanceUsesBoundedConcurrency();
await testRecalculationQueueCoalescesClassWideChanges();
await testGroupedRecalculationPreservesExemptionWindows();
await testStudentWarningsUseFixedQueryCount();
console.log('Attendance performance regression checks passed');
