import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import prisma from '../src/utils/prismaClient';
import app from '../src/app';
import { generateAccessToken } from '../src/utils/jwt.utils';

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
  collegeId: number;
  deptId: number;
  courseId: number;
  docUserId: number;
  docDoctorId: number;
  docToken: string;
  studentUserId: number;
  studentId: number;
  studentToken: string;
  slotId: number;
  enrollmentId: number;
  cleanup: () => Promise<void>;
}

async function setupTestContext(suffix: string): Promise<FixtureContext> {
  const createdIds: {
    college?: number;
    department?: number;
    course?: number;
    docUser?: number;
    docDoctor?: number;
    studentUser?: number;
    student?: number;
    slot?: number;
    enrollment?: number;
  } = {};

  const cleanup = async () => {
    try {
      if (createdIds.course) {
        await prisma.quizSubmission.deleteMany({ where: { quiz: { courseId: createdIds.course } } });
        await prisma.question.deleteMany({ where: { quiz: { courseId: createdIds.course } } });
        await prisma.quiz.deleteMany({ where: { courseId: createdIds.course } });
        await prisma.enrollment.deleteMany({ where: { courseId: createdIds.course } });
      }
      if (createdIds.slot) {
        await prisma.scheduleSlot.deleteMany({ where: { id: createdIds.slot } });
      }
      if (createdIds.course) {
        await prisma.course.deleteMany({ where: { id: createdIds.course } });
      }
      if (createdIds.docDoctor) {
        await prisma.doctor.deleteMany({ where: { id: createdIds.docDoctor } });
      }
      if (createdIds.student) {
        await prisma.student.deleteMany({ where: { id: createdIds.student } });
      }
      if (createdIds.docUser || createdIds.studentUser) {
        const userIds = [createdIds.docUser, createdIds.studentUser].filter(Boolean) as number[];
        await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      }
      if (createdIds.department) {
        await prisma.department.deleteMany({ where: { id: createdIds.department } });
      }
      if (createdIds.college) {
        await prisma.college.deleteMany({ where: { id: createdIds.college } });
      }
    } catch {
      // Best effort cleanup
    }
  };

  try {
    const college = await prisma.college.create({ data: { name: `Col_${suffix}` } });
    createdIds.college = college.id;

    const dept = await prisma.department.create({ data: { name: `Dept_${suffix}`, collegeId: college.id } });
    createdIds.department = dept.id;

    const termCurrent = await prisma.academicTerm.findFirstOrThrow({ where: { isCurrent: true } });

    const course = await prisma.course.create({
      data: { name: `Course_${suffix}`, courseCode: `C_${suffix}`, departmentId: dept.id, credits: 3 },
    });
    createdIds.course = course.id;

    const docUser = await prisma.user.create({
      data: { email: `doc_${suffix}@uni.edu`, password: passwordHash, role: 'DOCTOR', departmentId: dept.id },
    });
    createdIds.docUser = docUser.id;

    const docDoctor = await prisma.doctor.create({
      data: { userId: docUser.id, departmentId: dept.id, doctorId: `DOC_${suffix}`, firstName: 'Doc', lastName: 'T8b' },
    });
    createdIds.docDoctor = docDoctor.id;

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
    createdIds.slot = slot.id;

    const studentUser = await prisma.user.create({
      data: { email: `stu_${suffix}@uni.edu`, password: passwordHash, role: 'STUDENT', departmentId: dept.id },
    });
    createdIds.studentUser = studentUser.id;

    const student = await prisma.student.create({
      data: { userId: studentUser.id, departmentId: dept.id, studentId: `ST_${suffix}`, firstName: 'Stu', lastName: 'T8b', year: 1 },
    });
    createdIds.student = student.id;

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
    createdIds.enrollment = enrollment.id;

    return {
      collegeId: college.id,
      deptId: dept.id,
      courseId: course.id,
      docUserId: docUser.id,
      docDoctorId: docDoctor.id,
      docToken,
      studentUserId: studentUser.id,
      studentId: student.id,
      studentToken,
      slotId: slot.id,
      enrollmentId: enrollment.id,
      cleanup,
    };
  } catch (err) {
    await cleanup();
    throw err;
  }
}

test('T-8b: Legacy Quiz Creation Retirement Integration Test', async () => {
  const baseUrl = await getTestBaseUrl();
  const suffix = makeSuffix('t8b_quiz_retire');
  const ctx = await setupTestContext(suffix);

  try {
    // 1. Initial count check
    const initialQuizCount = await prisma.quiz.count();
    const initialQuestionCount = await prisma.question.count();
    const initialNotificationCount = await prisma.notification.count();

    // 2. Doctor POST with a fully valid legacy body
    const validBody = {
      title: `Legacy Quiz ${suffix}`,
      description: 'Legacy quiz creation attempt',
      courseId: ctx.courseId,
      duration: 20,
      questions: [
        {
          text: 'What is 2 + 2?',
          optionA: '1',
          optionB: '2',
          optionC: '4',
          optionD: '5',
          correct: 'C',
          points: 5,
        },
      ],
    };

    const resValid = await fetch(`${baseUrl}/quizzes`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ctx.docToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(validBody),
    });

    const bodyValid = await resValid.json();
    assert.equal(resValid.status, 410, 'Doctor POST with valid legacy body must return 410 Gone');
    assert.match(
      bodyValid.message,
      /^QUIZ_LEGACY_CREATION_RETIRED:/,
      'Error message must start with QUIZ_LEGACY_CREATION_RETIRED:'
    );
    assert.match(
      bodyValid.message,
      /POST \/api\/exams/,
      'Error message must direct caller to POST /api/exams'
    );
    assert.match(
      bodyValid.message,
      /QUIZ/,
      'Error message must mention exam type QUIZ'
    );

    // Assert counts unchanged
    const afterValidQuizCount = await prisma.quiz.count();
    const afterValidQuestionCount = await prisma.question.count();
    const afterValidNotificationCount = await prisma.notification.count();
    assert.equal(afterValidQuizCount, initialQuizCount, 'Quiz count must be unchanged');
    assert.equal(afterValidQuestionCount, initialQuestionCount, 'Question count must be unchanged');
    assert.equal(afterValidNotificationCount, initialNotificationCount, 'Notification count must be unchanged');

    // 3. Doctor POST with an INVALID body -> also 410 (proves 410 precedes validation)
    const invalidBody = {
      // Missing title, courseId, duration, questions
    };

    const resInvalid = await fetch(`${baseUrl}/quizzes`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ctx.docToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(invalidBody),
    });

    const bodyInvalid = await resInvalid.json();
    assert.equal(resInvalid.status, 410, 'Doctor POST with invalid body must return 410 before validation');
    assert.match(
      bodyInvalid.message,
      /^QUIZ_LEGACY_CREATION_RETIRED:/,
      'Invalid body must also return QUIZ_LEGACY_CREATION_RETIRED: prefix'
    );

    // Assert counts still unchanged
    const afterInvalidQuizCount = await prisma.quiz.count();
    const afterInvalidQuestionCount = await prisma.question.count();
    const afterInvalidNotificationCount = await prisma.notification.count();
    assert.equal(afterInvalidQuizCount, initialQuizCount, 'Quiz count must remain unchanged after invalid body');
    assert.equal(afterInvalidQuestionCount, initialQuestionCount, 'Question count must remain unchanged');
    assert.equal(afterInvalidNotificationCount, initialNotificationCount, 'Notification count must remain unchanged');

    // 4. Student POST -> 403
    const resStudent = await fetch(`${baseUrl}/quizzes`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ctx.studentToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(validBody),
    });
    assert.equal(resStudent.status, 403, 'Student POST /quizzes must return 403 Forbidden');

    // 5. Unauthenticated POST (no token) -> 401
    const resNoToken = await fetch(`${baseUrl}/quizzes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(validBody),
    });
    assert.equal(resNoToken.status, 401, 'Unauthenticated POST /quizzes must return 401 Unauthorized');

    // 6. Doctor GET /api/quizzes -> still 200
    const resGet = await fetch(`${baseUrl}/quizzes`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${ctx.docToken}`,
      },
    });
    assert.equal(resGet.status, 200, 'Doctor GET /quizzes must remain 200 OK');
    const bodyGet = await resGet.json();
    assert.equal(bodyGet.success, true, 'GET /quizzes response must succeed');
  } finally {
    await ctx.cleanup();
  }
});

