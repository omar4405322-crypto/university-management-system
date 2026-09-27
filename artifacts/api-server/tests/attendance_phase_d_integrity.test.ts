import assert from 'node:assert/strict';
import prisma from '../src/utils/prismaClient';
import attendanceEngine from '../src/attendance/attendance.engine';
import { recordAttendanceManual } from '../src/controllers/attendance.controller';
import { AttendanceService } from '../src/services/attendance.service';
import { closeExpiredAttendanceSessions } from '../src/utils/cron';

async function testSessionIdentityAndAttemptBinding() {
  const engine = attendanceEngine as any;
  const originals = {
    getDriver: engine.getDriver,
    postProcess: engine.postProcessAsync,
    session: prisma.attendanceSession.findUnique,
    enrollment: prisma.enrollment.findUnique,
    transaction: prisma.$transaction,
  };
  const created: any[] = [];
  try {
    engine.getDriver = () => ({
      buildIntent: async (payload: any) => ({
        studentId: 44,
        method: 'GPS',
        sessionId: payload.sessionId,
        courseId: 22,
        scheduleSlotId: payload.sessionId + 100,
        status: 'PRESENT',
        date: new Date('2026-02-01T10:00:00.000Z'),
      }),
    });
    engine.postProcessAsync = async () => {};
    (prisma.attendanceSession.findUnique as any) = async (args: any) => ({
      id: args.where.id,
      isActive: true,
      createdAt: new Date('2026-02-01T10:00:00.000Z'),
      scheduleSlot: {
        id: args.where.id + 100,
        courseId: 22,
        timetable: { semester: 1 },
        course: { semester: 1 },
      },
    });
    (prisma.enrollment.findUnique as any) = async (args: any) => {
      assert.deepEqual(
        args.where.studentId_courseId_semester_academicYear,
        { studentId: 44, courseId: 22, semester: 1, academicYear: 2026 }
      );
      return { status: 'ENROLLED', semester: 1, academicYear: 2026 };
    };
    (prisma as any).$transaction = async (callback: any) => callback({
      attendance: {
        findUnique: async () => null,
        findMany: async () => [],
        findFirst: async () => {
          throw new Error('session writes must not use course/date fallback');
        },
        create: async ({ data }: any) => {
          created.push(data);
          return { id: created.length, status: data.status, createdAt: new Date() };
        },
        update: async () => {
          throw new Error('distinct sessions must create distinct rows');
        },
      },
      scheduleSlot: { findUnique: async () => null },
    });

    await engine.recordAttendance({ method: 'GPS', payload: { sessionId: 1 }, ctx: {} });
    await engine.recordAttendance({ method: 'GPS', payload: { sessionId: 2 }, ctx: {} });
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.deepEqual(created.map((row) => row.session.connect.id), [1, 2]);
    assert.ok(created.every((row) => row.semester === 1 && row.academicYear === 2026));
    console.log('Findings 11/12: exact attempt fields and independent same-day session identities');
  } finally {
    engine.getDriver = originals.getDriver;
    engine.postProcessAsync = originals.postProcess;
    prisma.attendanceSession.findUnique = originals.session;
    prisma.enrollment.findUnique = originals.enrollment;
    (prisma as any).$transaction = originals.transaction;
  }
}

async function testBlockedHistoryRemainsVisible() {
  const originals = {
    studentFindFirst: prisma.student.findFirst,
    studentFindUnique: prisma.student.findUnique,
    slots: prisma.scheduleSlot.findMany,
    sessions: prisma.attendanceSession.findMany,
    attendance: prisma.attendance.findMany,
    count: prisma.attendance.count,
  };
  const evidence = {
    id: 7,
    studentId: 44,
    courseId: 22,
    semester: 1,
    academicYear: 2026,
    sessionId: null,
    status: 'ABSENT',
    remarks: null,
    date: new Date('2026-02-01T00:00:00.000Z'),
    course: { name: 'Networks', courseCode: 'CS22' },
  };
  try {
    (prisma.student.findFirst as any) = async () => ({ id: 44 });
    (prisma.student.findUnique as any) = async () => ({
      id: 44,
      groupId: null,
      enrollments: [{
        id: 99,
        studentId: 44,
        courseId: 22,
        semester: 1,
        academicYear: 2026,
        status: 'BLOCKED',
        enrolledAt: new Date('2026-01-01T00:00:00.000Z'),
        exemptionPeriods: [],
      }],
    });
    (prisma.scheduleSlot.findMany as any) = async () => [];
    (prisma.attendanceSession.findMany as any) = async () => [];
    (prisma.attendance.findMany as any) = async (args: any) =>
      args.select ? [evidence] : [evidence];
    (prisma.attendance.count as any) = async () => 1;

    const result = await AttendanceService.getStudentAttendance(
      { id: 1, role: 'SUPER_ADMIN' },
      44,
      22
    );
    assert.equal(result.data[0].id, 7);
    assert.equal(result.stats.ABSENT, 1);
    console.log('Finding 15: blocked-attempt attendance evidence remains visible');
  } finally {
    prisma.student.findFirst = originals.studentFindFirst;
    prisma.student.findUnique = originals.studentFindUnique;
    prisma.scheduleSlot.findMany = originals.slots;
    prisma.attendanceSession.findMany = originals.sessions;
    prisma.attendance.findMany = originals.attendance;
    prisma.attendance.count = originals.count;
  }
}

async function testSessionClosureTriggersAttemptRecalculation() {
  const originals = {
    sessions: prisma.attendanceSession.findMany,
    update: prisma.attendanceSession.updateMany,
    queue: attendanceEngine.queueCourseAttemptRecalculation,
  };
  const queued: any[] = [];
  try {
    (prisma.attendanceSession.findMany as any) = async () => [{
      id: 10,
      createdAt: new Date('2026-02-01T10:00:00.000Z'),
      scheduleSlot: {
        courseId: 22,
        timetable: { semester: 1 },
        course: { semester: 1 },
      },
    }];
    (prisma.attendanceSession.updateMany as any) = async (args: any) => {
      assert.equal(args.where.isActive, true);
      return { count: 1 };
    };
    attendanceEngine.queueCourseAttemptRecalculation = async (...args: any[]) => {
      queued.push(args);
    };
    assert.equal(await closeExpiredAttendanceSessions(), 1);
    assert.deepEqual(queued, [[22, 1, 2026]]);
    console.log('Finding 10: closing a session triggers attempt-specific enforcement');
  } finally {
    prisma.attendanceSession.findMany = originals.sessions;
    prisma.attendanceSession.updateMany = originals.update;
    attendanceEngine.queueCourseAttemptRecalculation = originals.queue;
  }
}

async function testBulkDatePassThrough() {
  const original = AttendanceService.recordBulkManual;
  let capturedContext: any;
  try {
    AttendanceService.recordBulkManual = async (_records: any, context: any) => {
      capturedContext = context;
      return [{ studentId: 44, success: true, attendance: null }];
    };
    await new Promise<void>((resolve, reject) => {
      recordAttendanceManual(
        {
          body: {
            courseId: 22,
            semester: 1,
            academicYear: 2026,
            date: '2026-02-01T10:30:00.000Z',
            records: [{ studentId: 44, status: 'PRESENT' }],
          },
          user: { id: 1, role: 'SUPER_ADMIN' },
          socket: {},
        } as any,
        { status: () => ({ json: () => resolve() }) } as any,
        reject
      );
    });
    assert.equal(capturedContext.date, '2026-02-01T10:30:00.000Z');
    assert.equal(capturedContext.academicYear, 2026);
    console.log('Finding 19: bulk controller preserves staff-supplied date and attempt');
  } finally {
    AttendanceService.recordBulkManual = original;
  }
}

await testSessionIdentityAndAttemptBinding();
await testBlockedHistoryRemainsVisible();
await testSessionClosureTriggersAttemptRecalculation();
await testBulkDatePassThrough();
console.log('Attendance Phase D integrity checks passed');
