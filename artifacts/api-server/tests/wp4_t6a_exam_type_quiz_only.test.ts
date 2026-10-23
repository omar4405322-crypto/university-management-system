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

function makeSuffix(testName: string): string {
  const rand = Math.floor(Math.random() * 1000000);
  const time = Date.now().toString().slice(-6);
  return `${testName}_${time}_${rand}`;
}

const passwordHash = '$2b$10$dummyhashedpasswordforisolatedtestsuitesonly0000';

interface TestContext {
  collegeId: number;
  departmentId: number;
  courseId: number;
  superAdminId: number;
  superAdminToken: string;
  cleanUp: () => Promise<void>;
}

async function setupTestContext(suffix: string): Promise<TestContext> {
  const college = await prisma.college.create({
    data: { name: `Col_${suffix}` },
  });
  const department = await prisma.department.create({
    data: { name: `Dept_${suffix}`, collegeId: college.id },
  });
  const course = await prisma.course.create({
    data: {
      name: `Course_${suffix}`,
      courseCode: `C_${suffix.slice(0, 10).toUpperCase()}`,
      departmentId: department.id,
      year: 1,
      semester: 1,
    },
  });

  const superAdmin = await prisma.user.create({
    data: {
      email: `sadmin_${suffix}@uni.edu`,
      password: passwordHash,
      role: 'SUPER_ADMIN',
    },
  });
  const superAdminToken = generateAccessToken(superAdmin.id, superAdmin.tokenVersion);

  const cleanUp = async () => {
    await prisma.notification.deleteMany({
      where: { userId: superAdmin.id },
    });
    await prisma.auditLog.deleteMany({
      where: { userId: superAdmin.id },
    });
    const exams = await prisma.exam.findMany({
      where: { courseId: course.id },
      select: { id: true },
    });
    const examIds = exams.map((e) => e.id);
    if (examIds.length > 0) {
      await prisma.auditLog.deleteMany({
        where: { entity: 'Exam', entityId: { in: examIds.map(String) } },
      });
      await prisma.examQuestion.deleteMany({
        where: { examId: { in: examIds } },
      });
      await prisma.examSubmission.deleteMany({
        where: { examId: { in: examIds } },
      });
      await prisma.exam.deleteMany({
        where: { id: { in: examIds } },
      });
    }
    await prisma.course.delete({ where: { id: course.id } });
    await prisma.user.delete({ where: { id: superAdmin.id } });
    await prisma.department.delete({ where: { id: department.id } });
    await prisma.college.delete({ where: { id: college.id } });
  };

  return {
    collegeId: college.id,
    departmentId: department.id,
    courseId: course.id,
    superAdminId: superAdmin.id,
    superAdminToken,
    cleanUp,
  };
}

function getFutureIsoDate(): string {
  const futureDate = new Date();
  futureDate.setMonth(futureDate.getMonth() + 2);
  return futureDate.toISOString();
}

const rejectedInputs: Array<{ label: string; value: any }> = [
  { label: 'MIDTERM', value: 'MIDTERM' },
  { label: 'FINAL', value: 'FINAL' },
  { label: 'lowercase quiz', value: 'quiz' },
  { label: 'QUIZ with padding spaces', value: ' QUIZ ' },
  { label: 'unknown string', value: 'PRACTICAL_EXAM' },
  { label: 'null', value: null },
  { label: 'number', value: 123 },
  { label: 'array', value: ['QUIZ'] },
  { label: 'object', value: { type: 'QUIZ' } },
];

for (const item of rejectedInputs) {
  test(`WP-4 T-6a: POST /api/exams rejects [${item.label}] with 422`, async () => {
    const baseUrl = await getTestBaseUrl();
    const suffix = makeSuffix(`post_${item.label.replace(/\s+/g, '_')}`);
    const ctx = await setupTestContext(suffix);

    try {
      const initialCount = await prisma.exam.count({ where: { courseId: ctx.courseId } });

      const res = await fetch(`${baseUrl}/exams`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ctx.superAdminToken}`,
        },
        body: JSON.stringify({
          courseId: ctx.courseId,
          title: `Exam_${item.label}`,
          date: getFutureIsoDate(),
          startTime: '09:00',
          endTime: '11:00',
          room: 'Hall 101',
          type: item.value,
        }),
      });

      const body = await res.json().catch(() => ({}));
      assert.equal(
        res.status,
        422,
        `Expected 422 for input [${item.label}] on POST /api/exams, got ${res.status}: ${JSON.stringify(body)}`
      );

      const afterCount = await prisma.exam.count({ where: { courseId: ctx.courseId } });
      assert.equal(
        afterCount,
        initialCount,
        `Row was written for invalid input [${item.label}]: before=${initialCount}, after=${afterCount}`
      );
    } finally {
      await ctx.cleanUp();
    }
  });
}

test('WP-4 T-6a: POST /api/exams omitted type creates a QUIZ row', async () => {
  const baseUrl = await getTestBaseUrl();
  const suffix = makeSuffix('post_omit');
  const ctx = await setupTestContext(suffix);

  try {
    const initialCount = await prisma.exam.count({ where: { courseId: ctx.courseId } });

    const res = await fetch(`${baseUrl}/exams`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ctx.superAdminToken}`,
      },
      body: JSON.stringify({
        courseId: ctx.courseId,
        title: `Exam_OmittedType_${suffix}`,
        date: getFutureIsoDate(),
        startTime: '10:00',
        endTime: '12:00',
        room: 'Hall 102',
      }),
    });

    const body = (await res.json()) as any;
    assert.equal(res.status, 201, `Expected 201 for omitted type on POST /api/exams, got ${res.status}`);
    assert.equal(body.success, true);
    assert.equal(body.data.type, 'QUIZ', 'Expected omitted type to create a QUIZ row');

    const afterCount = await prisma.exam.count({ where: { courseId: ctx.courseId } });
    assert.equal(afterCount, initialCount + 1, 'Expected exactly one row to be written for omitted type');

    const createdExam = await prisma.exam.findFirst({ where: { courseId: ctx.courseId } });
    assert.equal(createdExam?.type, 'QUIZ', 'Expected database exam row to have type QUIZ');
  } finally {
    await ctx.cleanUp();
  }
});

test('WP-4 T-6a: POST /api/exams valid QUIZ succeeds with 201 and creates QUIZ row', async () => {
  const baseUrl = await getTestBaseUrl();
  const suffix = makeSuffix('post_quiz');
  const ctx = await setupTestContext(suffix);

  try {
    const initialCount = await prisma.exam.count({ where: { courseId: ctx.courseId } });

    const res = await fetch(`${baseUrl}/exams`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ctx.superAdminToken}`,
      },
      body: JSON.stringify({
        courseId: ctx.courseId,
        title: `Exam_ValidQuiz_${suffix}`,
        date: getFutureIsoDate(),
        startTime: '13:00',
        endTime: '15:00',
        room: 'Lab 201',
        type: 'QUIZ',
      }),
    });

    const body = (await res.json()) as any;
    assert.equal(res.status, 201, `Expected 201 for valid QUIZ on POST /api/exams, got ${res.status}`);
    assert.equal(body.success, true);
    assert.equal(body.data.type, 'QUIZ', 'Expected created exam to have type QUIZ');

    const afterCount = await prisma.exam.count({ where: { courseId: ctx.courseId } });
    assert.equal(afterCount, initialCount + 1);
  } finally {
    await ctx.cleanUp();
  }
});

for (const item of rejectedInputs) {
  test(`WP-4 T-6a: PUT /api/exams/:id rejects [${item.label}] with 422`, async () => {
    const baseUrl = await getTestBaseUrl();
    const suffix = makeSuffix(`put_${item.label.replace(/\s+/g, '_')}`);
    const ctx = await setupTestContext(suffix);

    try {
      const exam = await prisma.exam.create({
        data: {
          courseId: ctx.courseId,
          academicYear: 2026,
          semester: 1,
          title: `Exam_ForPut_${suffix}`,
          date: new Date(getFutureIsoDate()),
          startTime: '09:00',
          endTime: '11:00',
          room: 'Hall 303',
          type: 'QUIZ',
        },
      });

      const beforeExam = await prisma.exam.findUniqueOrThrow({ where: { id: exam.id } });

      const putRes = await fetch(`${baseUrl}/exams/${exam.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ctx.superAdminToken}`,
        },
        body: JSON.stringify({
          type: item.value,
        }),
      });

      const putBody = await putRes.json().catch(() => ({}));
      assert.equal(
        putRes.status,
        422,
        `Expected 422 for input [${item.label}] on PUT /api/exams/:id, got ${putRes.status}: ${JSON.stringify(putBody)}`
      );

      const afterExam = await prisma.exam.findUniqueOrThrow({ where: { id: exam.id } });
      assert.equal(
        afterExam.type,
        beforeExam.type,
        `Exam type was modified on rejected input [${item.label}]: before=${beforeExam.type}, after=${afterExam.type}`
      );
    } finally {
      await ctx.cleanUp();
    }
  });
}

test('WP-4 T-6a: PUT /api/exams/:id omitted type leaves existing type unchanged today', async () => {
  const baseUrl = await getTestBaseUrl();
  const suffix = makeSuffix('put_omit');
  const ctx = await setupTestContext(suffix);

  try {
    const exam = await prisma.exam.create({
      data: {
        courseId: ctx.courseId,
        academicYear: 2026,
        semester: 1,
        title: `Exam_PutOmit_${suffix}`,
        date: new Date(getFutureIsoDate()),
        startTime: '09:00',
        endTime: '11:00',
        room: 'Hall Original',
        type: 'QUIZ',
      },
    });

    const beforeExam = await prisma.exam.findUniqueOrThrow({ where: { id: exam.id } });

    const putRes = await fetch(`${baseUrl}/exams/${exam.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ctx.superAdminToken}`,
      },
      body: JSON.stringify({
        room: 'Hall Updated',
      }),
    });

    const putBody = (await putRes.json()) as any;
    assert.equal(putRes.status, 200, `Expected 200 for omitted type on PUT /api/exams/:id, got ${putRes.status}`);
    assert.equal(putBody.success, true);
    assert.equal(putBody.data.room, 'Hall Updated');
    assert.equal(putBody.data.type, beforeExam.type);

    const afterExam = await prisma.exam.findUniqueOrThrow({ where: { id: exam.id } });
    assert.equal(afterExam.type, beforeExam.type);
    assert.equal(afterExam.room, 'Hall Updated');
  } finally {
    await ctx.cleanUp();
  }
});

test('WP-4 T-6a: PUT /api/exams/:id valid QUIZ type succeeds with 200', async () => {
  const baseUrl = await getTestBaseUrl();
  const suffix = makeSuffix('put_quiz');
  const ctx = await setupTestContext(suffix);

  try {
    const exam = await prisma.exam.create({
      data: {
        courseId: ctx.courseId,
        academicYear: 2026,
        semester: 1,
        title: `Exam_PutQuiz_${suffix}`,
        date: new Date(getFutureIsoDate()),
        startTime: '09:00',
        endTime: '11:00',
        room: 'Hall 404',
        type: 'MIDTERM',
      },
    });

    const putRes = await fetch(`${baseUrl}/exams/${exam.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ctx.superAdminToken}`,
      },
      body: JSON.stringify({
        type: 'QUIZ',
      }),
    });

    const putBody = (await putRes.json()) as any;
    assert.equal(putRes.status, 200, `Expected 200 for QUIZ on PUT /api/exams/:id, got ${putRes.status}`);
    assert.equal(putBody.success, true);
    assert.equal(putBody.data.type, 'QUIZ');

    const afterExam = await prisma.exam.findUniqueOrThrow({ where: { id: exam.id } });
    assert.equal(afterExam.type, 'QUIZ');
  } finally {
    await ctx.cleanUp();
  }
});

test.after(async () => {
  if (sharedServer) {
    await new Promise<void>((resolve) => sharedServer!.close(() => resolve()));
    sharedServer = null;
  }
});
