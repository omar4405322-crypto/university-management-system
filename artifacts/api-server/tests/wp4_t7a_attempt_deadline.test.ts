import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import prisma from '../src/utils/prismaClient';
import app from '../src/app';
import { generateAccessToken } from '../src/utils/jwt.utils';
import { calculateAttemptDeadlineMs, calculateAttemptEndsAt } from '../src/utils/examTiming.utils';
import { buildExamWindow, msUntilOpenWindowPossible, CAIRO_TZ } from './wp4_exam_window_helper';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

let sharedServer: http.Server | null = null;
let sharedBaseUrl: string = '';

async function getTestBaseUrl(): Promise<string> {
  if (sharedServer) return sharedBaseUrl;
  sharedServer = http.createServer(app);
  await new Promise<void>((resolve) => {
    sharedServer!.listen(0, '127.0.0.1', () => {
      const addr = sharedServer!.address() as any;
      sharedBaseUrl = `http://127.0.0.1:${addr.port}/api`;
      resolve();
    });
  });
  sharedServer.unref();
  return sharedBaseUrl;
}

test.after(async () => {
  if (sharedServer) {
    if (typeof (sharedServer as any).closeAllConnections === 'function') {
      (sharedServer as any).closeAllConnections();
    }
    await new Promise<void>((resolve) => sharedServer!.close(() => resolve()));
  }
});

function makeSuffix(testName: string): string {
  const rand = Math.floor(Math.random() * 1000000);
  const time = Date.now().toString().slice(-6);
  return `${testName}_${time}_${rand}`;
}

const passwordHash = '$2b$10$dummyhashedpasswordforisolatedtestsuitesonly0000';

interface FixtureContext {
  college: any;
  dept: any;
  termCurrent: any;
  course: any;
  slot: any;
  docUser: any;
  docDoctor: any;
  docToken: string;
  studentUser: any;
  student: any;
  studentToken: string;
  enrollment: any;
  cleanup: () => Promise<void>;
}

async function setupTestContext(suffix: string): Promise<FixtureContext> {
  const created = {
    collegeIds: [] as number[],
    departmentIds: [] as number[],
    courseIds: [] as number[],
    slotIds: [] as number[],
    doctorIds: [] as number[],
    studentIds: [] as number[],
    userIds: [] as number[],
    enrollmentIds: [] as number[],
  };

  const cleanup = async () => {
    if (created.courseIds.length > 0) {
      await prisma.courseGradeEntry.deleteMany({ where: { enrollment: { courseId: { in: created.courseIds } } } });
      await prisma.courseGradeComponent.deleteMany({ where: { structure: { courseId: { in: created.courseIds } } } });
      await prisma.courseGradeStructure.deleteMany({ where: { courseId: { in: created.courseIds } } });
      await prisma.examViolation.deleteMany({ where: { submission: { exam: { courseId: { in: created.courseIds } } } } });
      await prisma.examSubmission.deleteMany({ where: { exam: { courseId: { in: created.courseIds } } } });
      await prisma.examQuestion.deleteMany({ where: { exam: { courseId: { in: created.courseIds } } } });
      await prisma.exam.deleteMany({ where: { courseId: { in: created.courseIds } } });
      await prisma.enrollment.deleteMany({ where: { courseId: { in: created.courseIds } } });
    }
    if (created.slotIds.length > 0) {
      await prisma.scheduleSlot.deleteMany({ where: { id: { in: created.slotIds } } });
    }
    if (created.courseIds.length > 0) {
      await prisma.course.deleteMany({ where: { id: { in: created.courseIds } } });
    }
    if (created.doctorIds.length > 0) {
      await prisma.doctor.deleteMany({ where: { id: { in: created.doctorIds } } });
    }
    if (created.studentIds.length > 0) {
      await prisma.student.deleteMany({ where: { id: { in: created.studentIds } } });
    }
    if (created.userIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: created.userIds } } });
    }
    if (created.departmentIds.length > 0) {
      await prisma.department.deleteMany({ where: { id: { in: created.departmentIds } } });
    }
    if (created.collegeIds.length > 0) {
      await prisma.college.deleteMany({ where: { id: { in: created.collegeIds } } });
    }
  };

  try {
    const college = await prisma.college.create({
      data: { name: `Col_${suffix}` },
    });
    created.collegeIds.push(college.id);

    const dept = await prisma.department.create({
      data: { name: `Dept_${suffix}`, collegeId: college.id },
    });
    created.departmentIds.push(dept.id);

    const termCurrent = await prisma.academicTerm.findFirstOrThrow({ where: { isCurrent: true } });

    const course = await prisma.course.create({
      data: { name: `Course_${suffix}`, courseCode: `C_${suffix}`, departmentId: dept.id, credits: 3 },
    });
    created.courseIds.push(course.id);

    const docUser = await prisma.user.create({
      data: { email: `doc_${suffix}@uni.edu`, password: passwordHash, role: 'DOCTOR', departmentId: dept.id },
    });
    created.userIds.push(docUser.id);
    const docDoctor = await prisma.doctor.create({
      data: { userId: docUser.id, departmentId: dept.id, doctorId: `DOC_${suffix}`, firstName: 'Doc', lastName: 'T7a' },
    });
    created.doctorIds.push(docDoctor.id);
    const docToken = generateAccessToken(docUser.id, docUser.tokenVersion);

    const slot = await prisma.scheduleSlot.create({
      data: {
        courseId: course.id,
        doctorId: docDoctor.id,
        termId: termCurrent.id,
        dayOfWeek: 'Monday',
        startTime: '08:00',
        endTime: '10:00',
        slotType: 'LECTURE',
      },
    });
    created.slotIds.push(slot.id);

    const studentUser = await prisma.user.create({
      data: { email: `stu_${suffix}@uni.edu`, password: passwordHash, role: 'STUDENT', departmentId: dept.id },
    });
    created.userIds.push(studentUser.id);
    const student = await prisma.student.create({
      data: { userId: studentUser.id, departmentId: dept.id, studentId: `ST_${suffix}`, firstName: 'Stu', lastName: 'T7a', year: 1 },
    });
    created.studentIds.push(student.id);
    const studentToken = generateAccessToken(studentUser.id, studentUser.tokenVersion);

    const enrollment = await prisma.enrollment.create({
      data: {
        studentId: student.id,
        courseId: course.id,
        semester: 1,
        academicYear: 2026,
        termId: termCurrent.id,
        status: 'ENROLLED',
      },
    });
    created.enrollmentIds.push(enrollment.id);

    return { college, dept, termCurrent, course, slot, docUser, docDoctor, docToken, studentUser, student, studentToken, enrollment, cleanup };
  } catch (err) {
    await cleanup();
    throw err;
  }
}

test('WP-4 T-7a: attemptEndsAt and serverNow on start and my-submission (absent after submit, no shuffleSeed)', async () => {
  const ctx = await setupTestContext(makeSuffix('t7a_deadline'));
  const baseUrl = await getTestBaseUrl();

  try {
    await new Promise((resolve) => setTimeout(resolve, msUntilOpenWindowPossible(new Date())));
    const windowFixture = buildExamWindow(new Date(), 'open');
    const exam = await prisma.exam.create({
      data: {
        title: 'T-7a Timed Quiz',
        courseId: ctx.course.id,
        termId: ctx.termCurrent.id,
        type: 'QUIZ',
        durationMinutes: 45,
        academicYear: 2026,
        semester: 1,
        date: windowFixture.date,
        startTime: windowFixture.startTime,
        endTime: windowFixture.endTime,
      },
    });

    const q = await prisma.examQuestion.create({
      data: {
        examId: exam.id,
        text: 'What is 2+2?',
        type: 'MCQ',
        optionA: '3',
        optionB: '4',
        optionC: '5',
        optionD: '6',
        correctAnswer: 'B',
        points: 5,
        order: 1,
      },
    });

    const stuHeaders = {
      Authorization: `Bearer ${ctx.studentToken}`,
      'Content-Type': 'application/json',
    };

    // 1. POST /start
    const resStart = await fetch(`${baseUrl}/exams/${exam.id}/start`, {
      method: 'POST',
      headers: stuHeaders,
    });
    assert.strictEqual(resStart.status, 201);
    const bodyStart = await resStart.json();
    assert.strictEqual(bodyStart.success, true);

    // Verify fields present on start
    assert.ok(bodyStart.data.attemptEndsAt, 'attemptEndsAt must be returned on start');
    assert.ok(bodyStart.data.serverNow, 'serverNow must be returned on start');
    assert.strictEqual(bodyStart.data.shuffleSeed, undefined, 'shuffleSeed must never be leaked');

    // Verify attemptEndsAt matches canonical helper calculation
    const expectedEndsAt = calculateAttemptEndsAt(exam, bodyStart.data.startedAt);
    assert.strictEqual(
      bodyStart.data.attemptEndsAt,
      expectedEndsAt,
      `attemptEndsAt must match canonical helper value: expected ${expectedEndsAt}, got ${bodyStart.data.attemptEndsAt}`
    );

    // Verify serverNow is a valid ISO timestamp within a reasonable range (±10s of now)
    const serverNowMs = new Date(bodyStart.data.serverNow).getTime();
    assert.ok(!isNaN(serverNowMs), 'serverNow must be a valid ISO string');
    assert.ok(Math.abs(Date.now() - serverNowMs) < 10000, 'serverNow must be current server time');

    // 2. GET /my-submission while PENDING
    const resPending = await fetch(`${baseUrl}/exams/${exam.id}/my-submission`, {
      headers: stuHeaders,
    });
    assert.strictEqual(resPending.status, 200);
    const bodyPending = await resPending.json();
    assert.strictEqual(bodyPending.success, true);
    assert.strictEqual(bodyPending.data.status, 'PENDING');
    assert.ok(bodyPending.data.attemptEndsAt, 'attemptEndsAt must be returned while PENDING');
    assert.ok(bodyPending.data.serverNow, 'serverNow must be returned while PENDING');
    assert.strictEqual(bodyPending.data.attemptEndsAt, expectedEndsAt);
    assert.strictEqual(bodyPending.data.shuffleSeed, undefined, 'shuffleSeed must never be leaked');

    // 3. POST /submit
    const resSubmit = await fetch(`${baseUrl}/exams/${exam.id}/submit`, {
      method: 'POST',
      headers: stuHeaders,
      body: JSON.stringify({ answers: { [q.id.toString()]: 'B' } }),
    });
    assert.strictEqual(resSubmit.status, 200);
    const bodySubmit = await resSubmit.json();
    assert.strictEqual(bodySubmit.success, true);
    assert.strictEqual(bodySubmit.data.status, 'GRADED');
    assert.strictEqual(bodySubmit.data.attemptEndsAt, undefined, 'attemptEndsAt must be absent after submit');
    assert.strictEqual(bodySubmit.data.serverNow, undefined, 'serverNow must be absent after submit');
    assert.strictEqual(bodySubmit.data.shuffleSeed, undefined);

    // 4. GET /my-submission after completion
    const resCompleted = await fetch(`${baseUrl}/exams/${exam.id}/my-submission`, {
      headers: stuHeaders,
    });
    assert.strictEqual(resCompleted.status, 200);
    const bodyCompleted = await resCompleted.json();
    assert.strictEqual(bodyCompleted.success, true);
    assert.strictEqual(bodyCompleted.data.status, 'GRADED');
    assert.strictEqual(bodyCompleted.data.attemptEndsAt, undefined, 'attemptEndsAt must be absent once completed');
    assert.strictEqual(bodyCompleted.data.serverNow, undefined, 'serverNow must be absent once completed');
    assert.strictEqual(bodyCompleted.data.shuffleSeed, undefined);
  } finally {
    await ctx.cleanup();
  }
});

test('WP-4 T-7a pure: calculateAttemptDeadlineMs and calculateAttemptEndsAt with window tighter, duration tighter, equal', () => {
  const fixedDate = fromZonedTime('2026-10-20 00:00:00', CAIRO_TZ);
  const startedAt = fromZonedTime('2026-10-20 10:00:00', CAIRO_TZ);
  const startedAtMs = startedAt.getTime();

  // 1. Window tighter than duration:
  // Window ends at 10:30 Cairo (30 min after start), duration is 60 min (would end at 11:00)
  const windowTighterExam = {
    date: fixedDate,
    endTime: '10:30',
    durationMinutes: 60,
  };
  const expectedWindowEndMs = fromZonedTime('2026-10-20 10:30:00', CAIRO_TZ).getTime();
  const windowTighterDeadline = calculateAttemptDeadlineMs(windowTighterExam, startedAt);
  const windowTighterEndsAt = calculateAttemptEndsAt(windowTighterExam, startedAt);

  assert.strictEqual(windowTighterDeadline, expectedWindowEndMs);
  assert.strictEqual(windowTighterEndsAt, new Date(expectedWindowEndMs).toISOString());
  assert.ok(windowTighterDeadline < startedAtMs + 60 * 60 * 1000);

  // 2. Duration tighter than window:
  // Window ends at 12:00 Cairo (2 hours after start), duration is 30 min (ends at 10:30)
  const durationTighterExam = {
    date: fixedDate,
    endTime: '12:00',
    durationMinutes: 30,
  };
  const expectedDurationEndMs = startedAtMs + 30 * 60 * 1000;
  const durationTighterDeadline = calculateAttemptDeadlineMs(durationTighterExam, startedAt);
  const durationTighterEndsAt = calculateAttemptEndsAt(durationTighterExam, startedAt);

  assert.strictEqual(durationTighterDeadline, expectedDurationEndMs);
  assert.strictEqual(durationTighterEndsAt, new Date(expectedDurationEndMs).toISOString());
  assert.ok(durationTighterDeadline < fromZonedTime('2026-10-20 12:00:00', CAIRO_TZ).getTime());

  // 3. Window equal to duration:
  // Window ends at 11:00 Cairo (60 min after start), duration is 60 min
  const equalExam = {
    date: fixedDate,
    endTime: '11:00',
    durationMinutes: 60,
  };
  const expectedEqualMs = fromZonedTime('2026-10-20 11:00:00', CAIRO_TZ).getTime();
  const equalDeadline = calculateAttemptDeadlineMs(equalExam, startedAt);
  const equalEndsAt = calculateAttemptEndsAt(equalExam, startedAt);

  assert.strictEqual(equalDeadline, expectedEqualMs);
  assert.strictEqual(equalEndsAt, new Date(expectedEqualMs).toISOString());
});

test('WP-4 T-7a pure: calculateAttemptDeadlineMs and calculateAttemptEndsAt with null endTime and null durationMinutes (120 min default)', () => {
  const fixedDate = fromZonedTime('2026-10-20 00:00:00', CAIRO_TZ);
  const startedAt = fromZonedTime('2026-10-20 10:00:00', CAIRO_TZ);
  const startedAtMs = startedAt.getTime();

  // 4. Null endTime (falls back to startedAt + durationMinutes):
  const nullEndTimeExam = {
    date: fixedDate,
    endTime: null,
    durationMinutes: 45,
  };
  const expectedNullEndMs = startedAtMs + 45 * 60 * 1000;
  const nullEndDeadline = calculateAttemptDeadlineMs(nullEndTimeExam, startedAt);
  const nullEndEndsAt = calculateAttemptEndsAt(nullEndTimeExam, startedAt);

  assert.strictEqual(nullEndDeadline, expectedNullEndMs);
  assert.strictEqual(nullEndEndsAt, new Date(expectedNullEndMs).toISOString());

  // 5. Null durationMinutes (falls back to 120 minutes):
  // With window far in future (15:00), 120 min duration ends at 12:00
  const nullDurationExam = {
    date: fixedDate,
    endTime: '15:00',
    durationMinutes: null,
  };
  const expectedDefault120Ms = startedAtMs + 120 * 60 * 1000;
  const nullDurationDeadline = calculateAttemptDeadlineMs(nullDurationExam, startedAt);
  const nullDurationEndsAt = calculateAttemptEndsAt(nullDurationExam, startedAt);

  assert.strictEqual(nullDurationDeadline, expectedDefault120Ms);
  assert.strictEqual(nullDurationEndsAt, new Date(expectedDefault120Ms).toISOString());
});


