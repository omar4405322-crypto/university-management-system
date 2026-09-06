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
    assert.deepEqual(
      result.map((row) => row.id),
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

async function testStudentWarningsUseFixedQueryCount() {
  const originals = {
    studentFindUnique: prisma.student.findUnique,
    scheduleSlotFindMany: prisma.scheduleSlot.findMany,
    attendanceSessionFindMany: prisma.attendanceSession.findMany,
    attendanceGroupBy: prisma.attendance.groupBy,
    attendanceFindMany: prisma.attendance.findMany,
    attendanceCount: prisma.attendance.count,
    policyFindMany: prisma.absenceThresholdPolicy.findMany,
    notificationFindMany: prisma.notification.findMany,
  };
  const calls = {
    student: 0,
    slots: 0,
    sessions: 0,
    groupedAttendance: 0,
    attendanceRows: 0,
    attendanceCount: 0,
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
            status: 'ENROLLED',
            customAbsenceThreshold: null,
            course: { id: 11, courseCode: 'C11', name: 'Course 11', departmentId: 4 },
            exemptionPeriods: [],
          },
          {
            id: 2,
            studentId: 51,
            courseId: 12,
            status: 'ENROLLED',
            customAbsenceThreshold: null,
            course: { id: 12, courseCode: 'C12', name: 'Course 12', departmentId: 4 },
            exemptionPeriods: [],
          },
        ],
      };
    };
    (prisma.scheduleSlot.findMany as any) = async () => {
      calls.slots += 1;
      return [
        { id: 101, courseId: 11 },
        { id: 102, courseId: 12 },
      ];
    };
    (prisma.attendanceSession.findMany as any) = async () => {
      calls.sessions += 1;
      return [
        { id: 201, scheduleSlotId: 101 },
        { id: 202, scheduleSlotId: 101 },
        { id: 203, scheduleSlotId: 102 },
      ];
    };
    (prisma.attendance.groupBy as any) = async (args: any) => {
      calls.groupedAttendance += 1;
      if (args.where.sessionId === null) {
        return [{ courseId: 11, status: 'EXCUSED', _count: { _all: 1 } }];
      }
      return [
        { sessionId: 201, status: 'PRESENT', _count: { _all: 1 } },
        { sessionId: 202, status: 'ABSENT', _count: { _all: 1 } },
        { sessionId: 203, status: 'LATE', _count: { _all: 1 } },
      ];
    };
    (prisma.attendance.findMany as any) = async () => {
      calls.attendanceRows += 1;
      return [];
    };
    (prisma.attendance.count as any) = async () => {
      calls.attendanceCount += 1;
      return 0;
    };
    (prisma.absenceThresholdPolicy.findMany as any) = async () => {
      calls.policies += 1;
      return [{ courseId: null, departmentId: null, maxAbsencePercent: 25 }];
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
      slots: 1,
      sessions: 1,
      groupedAttendance: 2,
      attendanceRows: 0,
      attendanceCount: 0,
      policies: 1,
      notifications: 1,
    });
  } finally {
    prisma.student.findUnique = originals.studentFindUnique;
    prisma.scheduleSlot.findMany = originals.scheduleSlotFindMany;
    prisma.attendanceSession.findMany = originals.attendanceSessionFindMany;
    prisma.attendance.groupBy = originals.attendanceGroupBy;
    prisma.attendance.findMany = originals.attendanceFindMany;
    prisma.attendance.count = originals.attendanceCount;
    prisma.absenceThresholdPolicy.findMany = originals.policyFindMany;
    prisma.notification.findMany = originals.notificationFindMany;
  }
}

await testBulkAttendanceUsesBoundedConcurrency();
await testRecalculationQueueCoalescesClassWideChanges();
await testStudentWarningsUseFixedQueryCount();
console.log('Attendance performance regression checks passed');
