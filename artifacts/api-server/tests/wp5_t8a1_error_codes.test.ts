import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../src/utils/prismaClient';
import { generateAccessToken } from '../src/utils/jwt.utils';
import app from '../src/app';
import globalErrorHandler from '../src/middleware/error.middleware';
import { ALLOWED_TASK_EXTENSIONS } from '../src/middleware/taskSubmissionUpload.middleware';
import { stopSimilarityRuntime } from '../src/services/similarity/similarityRuntime';

const PAST_DUE_DATE = new Date('2020-01-01T00:00:00.000Z');
const FUTURE_DUE_DATE = new Date('2099-01-01T00:00:00.000Z');

const VALID_PDF_BYTES = Buffer.from(
  '%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n',
  'utf8'
);

const VALID_PDF_BYTES_ALT = Buffer.from(
  '%PDF-1.4\n2 0 obj\n<< /Type /Pages >>\nendobj\ntrailer\n<< /Root 2 0 R >>\n%%EOF\n',
  'utf8'
);

async function withIsolatedServer(
  expressApp: express.Express,
  run: (baseUrl: string) => Promise<void>
): Promise<void> {
  const srv = http.createServer(expressApp);
  await new Promise<void>((resolve) => srv.listen(0, '127.0.0.1', resolve));
  const addr = srv.address() as { port: number };
  try {
    await run(`http://127.0.0.1:${addr.port}`);
  } finally {
    await new Promise<void>((resolve, reject) =>
      srv.close((err) => (err ? reject(err) : resolve()))
    );
  }
}

test('REGRESSION GUARD: non-AppError with P2002 or ENOENT produces no code key in response body', async () => {
  const savedNodeEnv = process.env.NODE_ENV;
  const savedConsoleError = console.error;
  console.error = () => {};

  try {
    const guardApp = express();
    guardApp.get('/p2002', () => {
      const err: Error & { code?: string; meta?: { target?: string[] } } = new Error(
        'Unique constraint failed on the fields: (`email`)'
      );
      err.code = 'P2002';
      err.meta = { target: ['email'] };
      throw err;
    });
    guardApp.get('/enoent', () => {
      const err: Error & { code?: string } = new Error(
        'ENOENT: no such file or directory'
      );
      err.code = 'ENOENT';
      throw err;
    });
    guardApp.get('/enoent-operational', () => {
      const err: Error & {
        code?: string;
        isOperational?: boolean;
        statusCode?: number;
      } = new Error('ENOENT: operational non-AppError');
      err.code = 'ENOENT';
      err.isOperational = true;
      err.statusCode = 400;
      throw err;
    });
    guardApp.use(globalErrorHandler);

    // Production mode (sendErrorProd)
    process.env.NODE_ENV = 'production';
    await withIsolatedServer(guardApp, async (baseUrl) => {
      const resP2002 = await fetch(`${baseUrl}/p2002`);
      assert.equal(resP2002.status, 409);
      const bodyP2002 = (await resP2002.json()) as Record<string, unknown>;
      assert.equal(Object.prototype.hasOwnProperty.call(bodyP2002, 'code'), false);

      const resEnoent = await fetch(`${baseUrl}/enoent`);
      assert.equal(resEnoent.status, 500);
      const bodyEnoent = (await resEnoent.json()) as Record<string, unknown>;
      assert.equal(Object.prototype.hasOwnProperty.call(bodyEnoent, 'code'), false);

      const resEnoentOp = await fetch(`${baseUrl}/enoent-operational`);
      assert.equal(resEnoentOp.status, 400);
      const bodyEnoentOp = (await resEnoentOp.json()) as Record<string, unknown>;
      assert.equal(Object.prototype.hasOwnProperty.call(bodyEnoentOp, 'code'), false);
    });

    // Development mode (sendErrorDev)
    process.env.NODE_ENV = 'development';
    await withIsolatedServer(guardApp, async (baseUrl) => {
      const resP2002 = await fetch(`${baseUrl}/p2002`);
      assert.equal(resP2002.status, 500);
      const bodyP2002 = (await resP2002.json()) as Record<string, unknown>;
      assert.equal(Object.prototype.hasOwnProperty.call(bodyP2002, 'code'), false);

      const resEnoent = await fetch(`${baseUrl}/enoent`);
      assert.equal(resEnoent.status, 500);
      const bodyEnoent = (await resEnoent.json()) as Record<string, unknown>;
      assert.equal(Object.prototype.hasOwnProperty.call(bodyEnoent, 'code'), false);
    });
  } finally {
    process.env.NODE_ENV = savedNodeEnv;
    console.error = savedConsoleError;
  }
});

test('WP5-T8a1: Stable machine-readable error codes on WP-5 task, upload, integrity, and similarity HTTP paths', async (t) => {
  const SUFFIX = `t8a1_${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;
  let server: http.Server | null = null;
  let baseUrl = '';

  const uploadsTaskDir = path.resolve(process.cwd(), 'uploads/tasks');
  if (!fs.existsSync(uploadsTaskDir)) {
    fs.mkdirSync(uploadsTaskDir, { recursive: true });
  }

  const tracked = {
    createdDiskFiles: [] as string[],
    flagIds: [] as string[],
    submissionIds: [] as number[],
    taskIds: [] as number[],
    enrollmentIds: [] as number[],
    slotIds: [] as number[],
    studentIds: [] as number[],
    doctorIds: [] as number[],
    courseIds: [] as number[],
    userIds: [] as number[],
    departmentIds: [] as number[],
    collegeIds: [] as number[],
  };

  async function uploadTaskFile(
    token: string,
    taskId: number,
    fileBuffer: Buffer,
    filename: string,
    contentType: string = 'application/pdf'
  ) {
    const filesBefore = new Set(fs.readdirSync(uploadsTaskDir));
    const formData = new FormData();
    formData.append('file', new Blob([fileBuffer], { type: contentType }), filename);

    const res = await fetch(`${baseUrl}/tasks/${taskId}/submit`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    const body: any = await res.json().catch(() => null);

    const filesAfter = fs.readdirSync(uploadsTaskDir);
    for (const f of filesAfter) {
      if (!filesBefore.has(f)) {
        tracked.createdDiskFiles.push(path.join(uploadsTaskDir, f));
      }
    }

    if (body?.data?.id && typeof body.data.id === 'number') {
      tracked.submissionIds.push(body.data.id);
    }

    return { status: res.status, body };
  }

  try {
    server = http.createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
    const addr = server.address() as { port: number };
    baseUrl = `http://127.0.0.1:${addr.port}/api`;

    const college = await prisma.college.create({
      data: { name: `Col_${SUFFIX}` },
    });
    tracked.collegeIds.push(college.id);

    const dept = await prisma.department.create({
      data: { name: `Dept_${SUFFIX}`, collegeId: college.id },
    });
    tracked.departmentIds.push(dept.id);

    async function makeUser(role: string) {
      const passwordHash = await bcrypt.hash(crypto.randomUUID(), 4);
      const uniqueTag = crypto.randomUUID().replace(/-/g, '').slice(0, 10);
      const user = await prisma.user.create({
        data: {
          email: `${role.toLowerCase()}_${uniqueTag}@test.unicore`,
          password: passwordHash,
          role: role as any,
          departmentId: dept.id,
          collegeId: college.id,
          isActive: true,
        },
      });
      tracked.userIds.push(user.id);
      return user;
    }

    const superAdminUser = await makeUser('SUPER_ADMIN');
    const superAdminToken = generateAccessToken(
      superAdminUser.id,
      superAdminUser.tokenVersion
    );

    const docUser = await makeUser('DOCTOR');
    const doctor = await prisma.doctor.create({
      data: {
        userId: docUser.id,
        firstName: 'Dr',
        lastName: SUFFIX,
        doctorId: `DOC_${SUFFIX}`,
        departmentId: dept.id,
      },
    });
    tracked.doctorIds.push(doctor.id);
    const doctorToken = generateAccessToken(docUser.id, docUser.tokenVersion);

    const course = await prisma.course.create({
      data: {
        name: `Course_${SUFFIX}`,
        courseCode: `C_${SUFFIX}`,
        departmentId: dept.id,
        credits: 3,
        isPublished: true,
      },
    });
    tracked.courseIds.push(course.id);

    const slot = await prisma.scheduleSlot.create({
      data: {
        courseId: course.id,
        doctorId: doctor.id,
        dayOfWeek: 'Monday',
        startTime: '08:00',
        endTime: '10:00',
        slotType: 'LECTURE',
        isArchived: false,
      },
    });
    tracked.slotIds.push(slot.id);

    async function makeStudent(index: number) {
      const u = await makeUser('STUDENT');
      const s = await prisma.student.create({
        data: {
          userId: u.id,
          departmentId: dept.id,
          studentId: `STU_${index}_${SUFFIX}`,
          firstName: `Student${index}`,
          lastName: SUFFIX,
          year: 1,
        },
      });
      tracked.studentIds.push(s.id);
      const enr = await prisma.enrollment.create({
        data: {
          studentId: s.id,
          courseId: course.id,
          semester: 1,
          academicYear: 2026,
          status: 'ENROLLED',
        },
      });
      tracked.enrollmentIds.push(enr.id);
      const token = generateAccessToken(u.id, u.tokenVersion);
      return { user: u, student: s, enrollment: enr, token };
    }

    const studentA = await makeStudent(1);
    const studentB = await makeStudent(2);

    async function makeTask(label: string, dueDate: Date) {
      const task = await prisma.task.create({
        data: {
          title: `${label}_${SUFFIX}`,
          description: 'WP5-T8a1 error code test task',
          courseId: course.id,
          doctorId: doctor.id,
          academicYear: 2026,
          semester: 1,
          dueDate,
          maxScore: 100,
        },
      });
      tracked.taskIds.push(task.id);
      return task;
    }

    await t.test('DUPLICATE_SUBMISSION returns 409 with code and unchanged message', async () => {
      const task = await makeTask('DupTask', FUTURE_DUE_DATE);
      const resA = await uploadTaskFile(
        studentA.token,
        task.id,
        VALID_PDF_BYTES,
        'original.pdf'
      );
      assert.equal(resA.status, 201);

      const resB = await uploadTaskFile(
        studentB.token,
        task.id,
        VALID_PDF_BYTES,
        'copy.pdf'
      );
      assert.equal(resB.status, 409);
      assert.equal(resB.body?.success, false);
      assert.equal(resB.body?.code, 'DUPLICATE_SUBMISSION');
      assert.equal(
        resB.body?.message,
        'This file cannot be accepted because an identical submission already exists for this assignment. Please submit your own original work.'
      );
    });

    await t.test('TASK_DEADLINE_PASSED returns 409 with code and unchanged message', async () => {
      const pastTask = await makeTask('PastTask', PAST_DUE_DATE);
      const res = await uploadTaskFile(
        studentA.token,
        pastTask.id,
        VALID_PDF_BYTES,
        'late.pdf'
      );
      assert.equal(res.status, 409);
      assert.equal(res.body?.code, 'TASK_DEADLINE_PASSED');
      assert.equal(
        res.body?.message,
        'The deadline for this task has passed. Submission is not allowed.'
      );
    });

    await t.test('TASK_ALREADY_GRADED returns 409 with code and unchanged message', async () => {
      const task = await makeTask('GradedTask', FUTURE_DUE_DATE);
      const submitRes = await uploadTaskFile(
        studentA.token,
        task.id,
        VALID_PDF_BYTES,
        'graded_orig.pdf'
      );
      assert.equal(submitRes.status, 201);
      const subId = submitRes.body?.data?.id;
      const submittedAt = submitRes.body?.data?.submittedAt;
      assert.ok(subId && submittedAt);

      const gradeRes = await fetch(
        `${baseUrl}/tasks/${task.id}/submissions/${subId}/grade`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${doctorToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            score: 88,
            feedback: 'Well done',
            expectedSubmittedAt: submittedAt,
          }),
        }
      );
      assert.equal(gradeRes.status, 200);

      const resubmitRes = await uploadTaskFile(
        studentA.token,
        task.id,
        VALID_PDF_BYTES_ALT,
        'graded_retry.pdf'
      );
      assert.equal(resubmitRes.status, 409);
      assert.equal(resubmitRes.body?.code, 'TASK_ALREADY_GRADED');
      assert.equal(
        resubmitRes.body?.message,
        'This task submission has already been graded and cannot be resubmitted.'
      );
    });

    await t.test('TASK_GRADE_STALE_REVISION returns 409 with code and unchanged message', async () => {
      const task = await makeTask('StaleGradeTask', FUTURE_DUE_DATE);
      const submitRes = await uploadTaskFile(
        studentA.token,
        task.id,
        VALID_PDF_BYTES,
        'stale_target.pdf'
      );
      assert.equal(submitRes.status, 201);
      const subId = submitRes.body?.data?.id;
      assert.ok(subId);

      const gradeRes = await fetch(
        `${baseUrl}/tasks/${task.id}/submissions/${subId}/grade`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${doctorToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            score: 90,
            feedback: 'Attempt with stale revision',
            expectedSubmittedAt: '2024-01-01T00:00:00.000Z',
          }),
        }
      );
      assert.equal(gradeRes.status, 409);
      const body: any = await gradeRes.json();
      assert.equal(body?.code, 'TASK_GRADE_STALE_REVISION');
      assert.equal(
        body?.message,
        'The task submission changed while it was being graded. Reload the latest revision and retry.'
      );
    });

    await t.test('UPLOAD_EXTENSION_NOT_ALLOWED returns 400 with code and unchanged message', async () => {
      const task = await makeTask('BadExtTask', FUTURE_DUE_DATE);
      const res = await uploadTaskFile(
        studentA.token,
        task.id,
        Buffer.from('plain payload', 'utf8'),
        'disallowed.xyz',
        'application/octet-stream'
      );
      assert.equal(res.status, 400);
      assert.equal(res.body?.code, 'UPLOAD_EXTENSION_NOT_ALLOWED');
      assert.equal(
        res.body?.message,
        `File extension .xyz is not allowed. Allowed extensions: ${Array.from(ALLOWED_TASK_EXTENSIONS).join(', ')}`
      );
    });

    await t.test('INTEGRITY_POLICY_INVALID returns 422 with code and unchanged message', async () => {
      const res = await fetch(`${baseUrl}/submission-integrity/policy`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${superAdminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ similarityThreshold: 2 }),
      });
      assert.equal(res.status, 422);
      const body: any = await res.json();
      assert.equal(body?.code, 'INTEGRITY_POLICY_INVALID');
      assert.equal(
        body?.message,
        'similarityThreshold must be greater than 0 and less than or equal to 1'
      );
    });

    await t.test('SIMILARITY_FLAG_ALREADY_DECIDED returns 409 with code and unchanged message', async () => {
      const task = await makeTask('SimFlagTask', FUTURE_DUE_DATE);

      const subA = await prisma.taskSubmission.create({
        data: {
          taskId: task.id,
          studentId: studentA.student.id,
          enrollmentId: studentA.enrollment.id,
          fileName: 'alice.pdf',
          fileHash: `hash_a_${SUFFIX}`,
        },
      });
      tracked.submissionIds.push(subA.id);

      const subB = await prisma.taskSubmission.create({
        data: {
          taskId: task.id,
          studentId: studentB.student.id,
          enrollmentId: studentB.enrollment.id,
          fileName: 'bob.pdf',
          fileHash: `hash_b_${SUFFIX}`,
        },
      });
      tracked.submissionIds.push(subB.id);

      const [firstSub, secondSub] = subA.id < subB.id ? [subA, subB] : [subB, subA];

      const flag = await prisma.submissionSimilarityFlag.create({
        data: {
          taskId: task.id,
          submissionAId: firstSub.id,
          submissionBId: secondSub.id,
          fileHashA: firstSub.fileHash!,
          fileHashB: secondSub.fileHash!,
          similarityScore: 0.91,
          thresholdUsed: 0.8,
          status: 'CONFIRMED',
          reviewedById: docUser.id,
          reviewedAt: new Date('2025-01-01T00:00:00.000Z'),
        },
      });
      tracked.flagIds.push(flag.id);

      const res = await fetch(
        `${baseUrl}/tasks/${task.id}/similarity-flags/${flag.id}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${doctorToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ decision: 'DISMISSED' }),
        }
      );
      assert.equal(res.status, 409);
      const body: any = await res.json();
      assert.equal(body?.code, 'SIMILARITY_FLAG_ALREADY_DECIDED');
      assert.equal(body?.message, 'Similarity flag has already been decided');
    });
  } finally {
    await stopSimilarityRuntime();

    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
    }

    for (const f of tracked.createdDiskFiles) {
      try {
        if (fs.existsSync(f)) fs.unlinkSync(f);
      } catch {
        // Ignore cleanup failure for files already removed on resubmit
      }
    }

    if (tracked.flagIds.length > 0) {
      await prisma.submissionSimilarityFlag
        .deleteMany({ where: { id: { in: tracked.flagIds } } })
        .catch(() => {});
    }
    if (tracked.taskIds.length > 0) {
      await prisma.submissionSimilarityFlag
        .deleteMany({ where: { taskId: { in: tracked.taskIds } } })
        .catch(() => {});
    }
    if (tracked.submissionIds.length > 0) {
      await prisma.taskSubmissionFingerprint
        .deleteMany({ where: { submissionId: { in: tracked.submissionIds } } })
        .catch(() => {});
      await prisma.taskSubmission
        .deleteMany({ where: { id: { in: tracked.submissionIds } } })
        .catch(() => {});
    }
    if (tracked.taskIds.length > 0) {
      await prisma.task
        .deleteMany({ where: { id: { in: tracked.taskIds } } })
        .catch(() => {});
    }
    if (tracked.enrollmentIds.length > 0) {
      await prisma.enrollment
        .deleteMany({ where: { id: { in: tracked.enrollmentIds } } })
        .catch(() => {});
    }
    if (tracked.slotIds.length > 0) {
      await prisma.scheduleSlot
        .deleteMany({ where: { id: { in: tracked.slotIds } } })
        .catch(() => {});
    }
    if (tracked.studentIds.length > 0) {
      await prisma.student
        .deleteMany({ where: { id: { in: tracked.studentIds } } })
        .catch(() => {});
    }
    if (tracked.doctorIds.length > 0) {
      await prisma.doctor
        .deleteMany({ where: { id: { in: tracked.doctorIds } } })
        .catch(() => {});
    }
    if (tracked.courseIds.length > 0) {
      await prisma.course
        .deleteMany({ where: { id: { in: tracked.courseIds } } })
        .catch(() => {});
    }
    if (tracked.userIds.length > 0) {
      await prisma.user
        .deleteMany({ where: { id: { in: tracked.userIds } } })
        .catch(() => {});
    }
    if (tracked.departmentIds.length > 0) {
      await prisma.department
        .deleteMany({ where: { id: { in: tracked.departmentIds } } })
        .catch(() => {});
    }
    if (tracked.collegeIds.length > 0) {
      await prisma.college
        .deleteMany({ where: { id: { in: tracked.collegeIds } } })
        .catch(() => {});
    }
  }
});
