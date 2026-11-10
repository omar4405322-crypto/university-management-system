import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import prisma from '../src/utils/prismaClient';
import { generateAccessToken } from '../src/utils/jwt.utils';
import app from '../src/app';
import { getSimilarityRuntime } from '../src/services/similarity/similarityRuntime';

// Texts >= 100 chars and >= 15 words
const TEXT_BASE_STUDENT_1 =
  'This is an original comprehensive university assignment submission discussing distributed database systems and fault tolerance mechanisms in modern high availability computing environments.';
const TEXT_BASE_STUDENT_2_NEAR =
  'This is an original comprehensive university assignment submission discussing distributed database systems and fault tolerance mechanisms in modern high availability computing environments and cloud.';
const TEXT_RESUBMIT =
  'This is an entirely updated revision of the submission with substantially different content exploring architectural trade-offs in distributed transaction consistency models across regions.';

test('WP5-T6b3b2: Submit Path Similarity Wiring Integration Suite', async (t) => {
  const SUFFIX = `t6b3b2_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  let server: http.Server | null = null;
  let baseUrl = '';

  const uploadsTaskDir = path.resolve(process.cwd(), 'uploads/tasks');
  if (!fs.existsSync(uploadsTaskDir)) {
    fs.mkdirSync(uploadsTaskDir, { recursive: true });
  }

  const tracked = {
    createdDiskFiles: [] as string[],
    submissionIds: [] as number[],
    flagIds: [] as number[],
    taskIds: [] as number[],
    slotIds: [] as number[],
    enrollmentIds: [] as number[],
    studentIds: [] as number[],
    doctorIds: [] as number[],
    courseIds: [] as number[],
    userIds: [] as number[],
    departmentIds: [] as number[],
    collegeIds: [] as number[],
  };

  try {
    server = http.createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
    const addr = server.address() as any;
    baseUrl = `http://127.0.0.1:${addr.port}/api`;

    // 1. College & Department
    const college = await prisma.college.create({
      data: { name: `Col_${SUFFIX}` },
    });
    tracked.collegeIds.push(college.id);

    const dept = await prisma.department.create({
      data: { name: `Dept_${SUFFIX}`, collegeId: college.id },
    });
    tracked.departmentIds.push(dept.id);

    // User creator helper (random password hash, no literal passwords)
    async function createTestUser(role: string) {
      const passwordHash = await bcrypt.hash(crypto.randomUUID() + '!Aa1', 4);
      const user = await prisma.user.create({
        data: {
          email: `${role.toLowerCase()}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}@test.unicore`,
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

    // 2. Doctor
    const doctorUser = await createTestUser('DOCTOR');
    const doctor = await prisma.doctor.create({
      data: {
        userId: doctorUser.id,
        firstName: 'Doctor',
        lastName: SUFFIX,
        departmentId: dept.id,
      },
    });
    tracked.doctorIds.push(doctor.id);

    // 3. Students
    const studentUser1 = await createTestUser('STUDENT');
    const student1 = await prisma.student.create({
      data: {
        userId: studentUser1.id,
        studentId: `STU1_${SUFFIX}`,
        firstName: 'Student1',
        lastName: SUFFIX,
        departmentId: dept.id,
        year: 1,
      },
    });
    tracked.studentIds.push(student1.id);
    const studentToken1 = generateAccessToken(studentUser1.id);

    const studentUser2 = await createTestUser('STUDENT');
    const student2 = await prisma.student.create({
      data: {
        userId: studentUser2.id,
        studentId: `STU2_${SUFFIX}`,
        firstName: 'Student2',
        lastName: SUFFIX,
        departmentId: dept.id,
        year: 1,
      },
    });
    tracked.studentIds.push(student2.id);
    const studentToken2 = generateAccessToken(studentUser2.id);

    // 4. Course
    const course = await prisma.course.create({
      data: {
        name: `Course_${SUFFIX}`,
        courseCode: `C_${SUFFIX.slice(0, 10).toUpperCase()}`,
        departmentId: dept.id,
        credits: 3,
        year: 1,
        semester: 1,
        isPublished: true,
      },
    });
    tracked.courseIds.push(course.id);

    // Active schedule slot
    const slot = await prisma.scheduleSlot.create({
      data: {
        courseId: course.id,
        doctorId: doctor.id,
        slotType: 'LECTURE',
        dayOfWeek: 'MONDAY',
        startTime: '08:00',
        endTime: '10:00',
        isArchived: false,
      },
    });
    tracked.slotIds.push(slot.id);

    // Enrollments
    const enroll1 = await prisma.enrollment.create({
      data: {
        studentId: student1.id,
        courseId: course.id,
        semester: 1,
        academicYear: 2026,
        status: 'ENROLLED',
      },
    });
    tracked.enrollmentIds.push(enroll1.id);

    const enroll2 = await prisma.enrollment.create({
      data: {
        studentId: student2.id,
        courseId: course.id,
        semester: 1,
        academicYear: 2026,
        status: 'ENROLLED',
      },
    });
    tracked.enrollmentIds.push(enroll2.id);

    // 5. Active Task
    const activeTask = await prisma.task.create({
      data: {
        title: `Task_${SUFFIX}`,
        description: 'Assignment description',
        courseId: course.id,
        doctorId: doctor.id,
        academicYear: 2026,
        semester: 1,
        dueDate: new Date(Date.now() + 86400000), // tomorrow
        maxScore: 100,
      },
    });
    tracked.taskIds.push(activeTask.id);

    // Past due Task
    const pastDueTask = await prisma.task.create({
      data: {
        title: `PastDue_${SUFFIX}`,
        description: 'Past due assignment',
        courseId: course.id,
        doctorId: doctor.id,
        academicYear: 2026,
        semester: 1,
        dueDate: new Date(Date.now() - 86400000), // yesterday
        maxScore: 100,
      },
    });
    tracked.taskIds.push(pastDueTask.id);

    // Submission policy fixture (with similarityThreshold: 0.50)
    await prisma.submissionIntegrityPolicy.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        exactDuplicateBlock: true,
        similarityThreshold: 0.50,
        updatedById: doctorUser.id,
      },
      update: {
        exactDuplicateBlock: true,
        similarityThreshold: 0.50,
        updatedById: doctorUser.id,
      },
    });

    // Multipart submit helper
    async function submitFileTask(taskId: number, token: string, fileBuffer: Buffer, fileName: string) {
      const formData = new FormData();
      formData.append('file', new Blob([fileBuffer]), fileName);

      const res = await fetch(`${baseUrl}/tasks/${taskId}/submit`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const json = await res.json().catch(() => null);
      if (json?.data?.storageKey) {
        tracked.createdDiskFiles.push(path.join(uploadsTaskDir, json.data.storageKey));
      }
      if (json?.data?.id) {
        tracked.submissionIds.push(json.data.id);
      }
      return { status: res.status, body: json };
    }

    // JSON submit helper (link-only)
    async function submitJsonTask(taskId: number, token: string, bodyPayload: any) {
      const res = await fetch(`${baseUrl}/tasks/${taskId}/submit`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bodyPayload),
      });
      const json = await res.json().catch(() => null);
      if (json?.data?.id) {
        tracked.submissionIds.push(json.data.id);
      }
      return { status: res.status, body: json };
    }

    // -------------------------------------------------------------
    // Test 1: file .txt (>= 100 chars and >= 15 words)
    // -> unchanged response shape and, after whenIdle(), a READY fingerprint
    // -------------------------------------------------------------
    await t.test('file .txt submission: response shape unchanged, READY fingerprint created after whenIdle()', async () => {
      const txtBuf = Buffer.from(TEXT_BASE_STUDENT_1, 'utf8');
      const submitRes = await submitFileTask(activeTask.id, studentToken1, txtBuf, 'submission1.txt');

      assert.equal(submitRes.status, 201);
      assert.equal(submitRes.body.success, true);
      assert.ok(submitRes.body.data.id, 'Response must include submission id');
      assert.equal(submitRes.body.data.fileName, 'submission1.txt');
      assert.equal(typeof submitRes.body.data.fileHash, 'string');
      assert.equal(typeof submitRes.body.data.storageKey, 'string');
      assert.ok(submitRes.body.data.fileUrl.includes(`/submissions/${submitRes.body.data.id}/download`));

      const subId = submitRes.body.data.id;

      // Drain similarity runtime queue
      await getSimilarityRuntime().whenIdle();

      // Check fingerprint
      const fingerprint = await prisma.taskSubmissionFingerprint.findUnique({
        where: { submissionId: subId },
      });

      assert.ok(fingerprint, 'Fingerprint row must be created for file submission');
      assert.equal(fingerprint.status, 'READY');
      assert.equal(fingerprint.fileHash, submitRes.body.data.fileHash);
      assert.ok(fingerprint.signature !== null, 'Fingerprint signature must be present for READY');
      assert.ok(fingerprint.shingleCount > 0, 'shingleCount must be > 0');
    });

    // -------------------------------------------------------------
    // Test 2: link-only submission -> no fingerprint
    // -------------------------------------------------------------
    await t.test('link-only submission: enqueues nothing, no fingerprint created', async () => {
      // Create a task without file upload for link-only test
      const linkTask = await prisma.task.create({
        data: {
          title: `LinkTask_${SUFFIX}`,
          description: 'Link assignment',
          courseId: course.id,
          doctorId: doctor.id,
          academicYear: 2026,
          semester: 1,
          dueDate: new Date(Date.now() + 86400000),
          maxScore: 100,
        },
      });
      tracked.taskIds.push(linkTask.id);

      const linkRes = await submitJsonTask(linkTask.id, studentToken1, {
        notes: 'Link-only submission notes',
        linkUrl: 'https://github.com/student/assignment',
      });

      assert.equal(linkRes.status, 201);
      assert.equal(linkRes.body.success, true);
      const linkSubId = linkRes.body.data.id;

      await getSimilarityRuntime().whenIdle();

      const linkFingerprint = await prisma.taskSubmissionFingerprint.findUnique({
        where: { submissionId: linkSubId },
      });
      assert.equal(linkFingerprint, null, 'Link-only submission must not generate a fingerprint');
    });

    // -------------------------------------------------------------
    // Test 3: rejected submit (past due / duplicate 409) -> no fingerprint
    // -------------------------------------------------------------
    await t.test('rejected submits: past due (409) and duplicate (409) create no fingerprint', async () => {
      const txtBuf = Buffer.from(TEXT_BASE_STUDENT_1, 'utf8');

      // 3a: Past due rejection (409)
      const pastDueRes = await submitFileTask(pastDueTask.id, studentToken1, txtBuf, 'pastdue.txt');
      assert.equal(pastDueRes.status, 409, 'Past due submit must return 409 Conflict');

      // 3b: Exact duplicate rejection (409)
      // student1 already submitted TEXT_BASE_STUDENT_1 to activeTask.
      // student2 submitting the exact same file content must be rejected with 409.
      const dupRes = await submitFileTask(activeTask.id, studentToken2, txtBuf, 'dup.txt');
      assert.equal(dupRes.status, 409, 'Duplicate submit must return 409 Conflict');

      await getSimilarityRuntime().whenIdle();

      // Verify no extra fingerprints exist for student2 on activeTask
      const student2Submissions = await prisma.taskSubmission.findMany({
        where: { taskId: activeTask.id, studentId: student2.id },
      });
      assert.equal(student2Submissions.length, 0, 'No submission row created for rejected duplicate');
    });

    // -------------------------------------------------------------
    // Test 4: resubmit with a new file -> fingerprint fileHash equals new file
    // -------------------------------------------------------------
    await t.test('resubmit with a new file: fingerprint fileHash matches new file', async () => {
      const newFileBuf = Buffer.from(TEXT_RESUBMIT, 'utf8');
      const resubmitRes = await submitFileTask(activeTask.id, studentToken1, newFileBuf, 'resubmit.txt');

      assert.equal(resubmitRes.status, 201);
      assert.equal(resubmitRes.body.success, true);
      const subId = resubmitRes.body.data.id;
      const newHash = resubmitRes.body.data.fileHash;

      await getSimilarityRuntime().whenIdle();

      const updatedFingerprint = await prisma.taskSubmissionFingerprint.findUnique({
        where: { submissionId: subId },
      });

      assert.ok(updatedFingerprint, 'Fingerprint must exist after resubmission');
      assert.equal(updatedFingerprint.status, 'READY');
      assert.equal(updatedFingerprint.fileHash, newHash, 'Fingerprint fileHash must equal new file hash');
    });

    // -------------------------------------------------------------
    // Test 5: two students with near-identical texts plus policy threshold
    // -> exactly one PENDING flag
    // -------------------------------------------------------------
    await t.test('two students with near-identical texts: produces exactly one PENDING flag', async () => {
      // Create a fresh task for the near-identical test
      const similarityTask = await prisma.task.create({
        data: {
          title: `SimTask_${SUFFIX}`,
          description: 'Similarity assignment',
          courseId: course.id,
          doctorId: doctor.id,
          academicYear: 2026,
          semester: 1,
          dueDate: new Date(Date.now() + 86400000),
          maxScore: 100,
        },
      });
      tracked.taskIds.push(similarityTask.id);

      // Student 1 submits text 1
      const buf1 = Buffer.from(TEXT_BASE_STUDENT_1, 'utf8');
      const res1 = await submitFileTask(similarityTask.id, studentToken1, buf1, 'student1.txt');
      assert.equal(res1.status, 201);
      await getSimilarityRuntime().whenIdle();

      // Student 2 submits near-identical text 2
      const buf2 = Buffer.from(TEXT_BASE_STUDENT_2_NEAR, 'utf8');
      const res2 = await submitFileTask(similarityTask.id, studentToken2, buf2, 'student2.txt');
      assert.equal(res2.status, 201);
      await getSimilarityRuntime().whenIdle();

      // Check flags for this task
      const flags = await prisma.submissionSimilarityFlag.findMany({
        where: { taskId: similarityTask.id },
      });

      for (const flag of flags) {
        tracked.flagIds.push(flag.id);
      }

      assert.equal(flags.length, 1, 'Must create exactly one similarity flag between the two students');
      assert.equal(flags[0].status, 'PENDING');
      assert.ok(flags[0].similarityScore >= 0.50, 'Similarity score must meet or exceed the 0.50 threshold');
      assert.equal(flags[0].thresholdUsed, 0.50);
    });
  } finally {
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
    }

    // Unlink tracked disk files
    for (const filePath of tracked.createdDiskFiles) {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch {}
    }

    // Teardown DB rows in reverse topological order
    try {
      if (tracked.flagIds.length > 0) {
        await prisma.submissionSimilarityFlag.deleteMany({
          where: { id: { in: tracked.flagIds } },
        });
      }
      if (tracked.taskIds.length > 0) {
        await prisma.submissionSimilarityFlag.deleteMany({
          where: { taskId: { in: tracked.taskIds } },
        });
      }
      if (tracked.submissionIds.length > 0) {
        await prisma.taskSubmissionFingerprint.deleteMany({
          where: { submissionId: { in: tracked.submissionIds } },
        });
        await prisma.taskSubmission.deleteMany({
          where: { id: { in: tracked.submissionIds } },
        });
      }

      // SubmissionIntegrityPolicy cleanup: table 0 afterwards
      await prisma.submissionIntegrityPolicy.deleteMany({});

      if (tracked.taskIds.length > 0) {
        await prisma.task.deleteMany({ where: { id: { in: tracked.taskIds } } });
      }
      if (tracked.slotIds.length > 0) {
        await prisma.scheduleSlot.deleteMany({ where: { id: { in: tracked.slotIds } } });
      }
      if (tracked.enrollmentIds.length > 0) {
        await prisma.enrollment.deleteMany({ where: { id: { in: tracked.enrollmentIds } } });
      }
      if (tracked.studentIds.length > 0) {
        await prisma.student.deleteMany({ where: { id: { in: tracked.studentIds } } });
      }
      if (tracked.doctorIds.length > 0) {
        await prisma.doctor.deleteMany({ where: { id: { in: tracked.doctorIds } } });
      }
      if (tracked.courseIds.length > 0) {
        await prisma.course.deleteMany({ where: { id: { in: tracked.courseIds } } });
      }
      if (tracked.userIds.length > 0) {
        await prisma.user.deleteMany({ where: { id: { in: tracked.userIds } } });
      }
      if (tracked.departmentIds.length > 0) {
        await prisma.department.deleteMany({ where: { id: { in: tracked.departmentIds } } });
      }
      if (tracked.collegeIds.length > 0) {
        await prisma.college.deleteMany({ where: { id: { in: tracked.collegeIds } } });
      }
    } catch (cleanupErr) {
      console.error('Error during test teardown:', cleanupErr);
    }
  }
});
