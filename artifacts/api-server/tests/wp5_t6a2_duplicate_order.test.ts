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

const VALID_PDF_BYTES = Buffer.from(
  '%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n',
  'utf8'
);

const VALID_PDF_BYTES_ALT = Buffer.from(
  '%PDF-1.4\n2 0 obj\n<< /Type /Pages >>\nendobj\ntrailer\n<< /Root 2 0 R >>\n%%EOF\n',
  'utf8'
);

test('WP5-T6a2: Duplicate Submission Check Ordering (O1 - O3)', async (t) => {
  const SUFFIX = `t6a2_ord_${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`;
  let server: http.Server | null = null;
  let baseUrl = '';

  const uploadsTaskDir = path.resolve(process.cwd(), 'uploads/tasks');
  if (!fs.existsSync(uploadsTaskDir)) {
    fs.mkdirSync(uploadsTaskDir, { recursive: true });
  }

  const tracked = {
    createdDiskFiles: [] as string[],
    auditLogIds: [] as number[],
    policyIds: [] as number[],
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
    contentType: string = 'application/pdf',
    notes?: string
  ) {
    const filesBefore = new Set(fs.readdirSync(uploadsTaskDir));
    const formData = new FormData();
    formData.append('file', new Blob([fileBuffer], { type: contentType }), filename);
    if (notes) formData.append('notes', notes);

    const res = await fetch(`${baseUrl}/tasks/${taskId}/submit`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    const json: any = await res.json().catch(() => null);

    const filesAfter = fs.readdirSync(uploadsTaskDir);
    for (const f of filesAfter) {
      if (!filesBefore.has(f)) {
        tracked.createdDiskFiles.push(path.join(uploadsTaskDir, f));
      }
    }

    if (json?.data?.id && typeof json.data.id === 'number') {
      tracked.submissionIds.push(json.data.id);
    }

    return { status: res.status, body: json };
  }

  try {
    server = http.createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
    const addr = server.address() as any;
    baseUrl = `http://127.0.0.1:${addr.port}/api`;

    // College & Department
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
      const user = await prisma.user.create({
        data: {
          email: `${role.toLowerCase()}_${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}@test.unicore`,
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

    // Doctor
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

    // Course
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

    // Schedule Slot
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

    // Students A and B
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

    // Helper to create task with specified dueDate
    async function makeTask(title: string, dueDate: Date) {
      const tsk = await prisma.task.create({
        data: {
          title: `${title}_${SUFFIX}`,
          description: 'Task ordering test description',
          courseId: course.id,
          doctorId: doctor.id,
          academicYear: 2026,
          semester: 1,
          dueDate,
          maxScore: 100,
        },
      });
      tracked.taskIds.push(tsk.id);
      return tsk;
    }

    // -------------------------------------------------------------------------
    // O1: Past due task (dueDate 2020-01-01), DB has submission with known hash.
    // Enrolled student uploads bytes with same hash -> 409 deadline passed.
    // -------------------------------------------------------------------------
    await t.test('O1: Student uploads duplicate file to past-due task -> 409 deadline passed, not DUPLICATE_SUBMISSION', async () => {
      const pastDueDate = new Date('2020-01-01T00:00:00.000Z');
      const taskO1 = await makeTask('Task_O1', pastDueDate);

      const knownHash = crypto.createHash('sha256').update(VALID_PDF_BYTES).digest('hex');

      // Create another student's TaskSubmission row directly in DB with known fileHash
      const existingOtherSub = await prisma.taskSubmission.create({
        data: {
          taskId: taskO1.id,
          studentId: studentA.student.id,
          enrollmentId: studentA.enrollment.id,
          notes: 'Prior submitted work',
          fileUrl: `/api/tasks/${taskO1.id}/submissions/prior/download`,
          fileName: 'prior_work.pdf',
          fileSize: VALID_PDF_BYTES.length,
          fileType: 'application/pdf',
          fileHash: knownHash,
          storageKey: `direct-${crypto.randomUUID()}.pdf`,
          submittedAt: new Date('2020-01-01T00:00:00.000Z'),
        },
      });
      tracked.submissionIds.push(existingOtherSub.id);

      const filesBefore = new Set(fs.readdirSync(uploadsTaskDir));
      const subsBefore = await prisma.taskSubmission.count({ where: { taskId: taskO1.id } });

      // Student B (enrolled) uploads bytes matching student A's hash after deadline
      const resB = await uploadTaskFile(studentB.token, taskO1.id, VALID_PDF_BYTES, 'studentB_late_copy.pdf');

      assert.equal(resB.status, 409, 'Late upload must be rejected with 409');
      assert.equal(
        resB.body?.message,
        'The deadline for this task has passed. Submission is not allowed.',
        'Error message must be exactly the deadline message'
      );
      assert.notEqual(resB.body?.code, 'DUPLICATE_SUBMISSION', 'Error code must NOT be DUPLICATE_SUBMISSION');

      // Verify no row created for uploader
      const subsAfter = await prisma.taskSubmission.count({ where: { taskId: taskO1.id } });
      assert.equal(subsAfter, subsBefore, 'Total submission count must remain unchanged');
      const uploaderSub = await prisma.taskSubmission.findUnique({
        where: { taskId_studentId: { taskId: taskO1.id, studentId: studentB.student.id } },
      });
      assert.equal(uploaderSub, null, 'Uploader submission row must not exist');

      // Verify no orphan file
      const filesAfter = fs.readdirSync(uploadsTaskDir);
      const orphanFiles = filesAfter.filter((f) => !filesBefore.has(f));
      assert.equal(orphanFiles.length, 0, 'No orphan file left in uploads/tasks');
    });

    // -------------------------------------------------------------------------
    // O2: Future task (dueDate 2099-01-01), student A & B submit different files (201).
    // A's submission is graded directly in DB (score set).
    // A resubmits bytes equal to B's file -> 409 already-graded, not DUPLICATE_SUBMISSION.
    // -------------------------------------------------------------------------
    await t.test('O2: Graded student resubmits duplicate file -> 409 already graded, not DUPLICATE_SUBMISSION', async () => {
      const futureDueDate = new Date('2099-01-01T00:00:00.000Z');
      const taskO2 = await makeTask('Task_O2', futureDueDate);

      // Student A submits original file (VALID_PDF_BYTES)
      const resA = await uploadTaskFile(studentA.token, taskO2.id, VALID_PDF_BYTES, 'studentA_orig.pdf');
      assert.equal(resA.status, 201, 'Student A initial submission must succeed');
      const subAId = resA.body?.data?.id;
      assert.ok(subAId, 'Student A submission ID must exist');

      // Student B submits different file (VALID_PDF_BYTES_ALT)
      const resB = await uploadTaskFile(studentB.token, taskO2.id, VALID_PDF_BYTES_ALT, 'studentB_diff.pdf');
      assert.equal(resB.status, 201, 'Student B initial submission must succeed');
      const subBId = resB.body?.data?.id;
      assert.ok(subBId, 'Student B submission ID must exist');

      // Directly grade student A's submission in DB
      await prisma.taskSubmission.update({
        where: { id: subAId },
        data: { score: 92, feedback: 'Graded by instructor' },
      });

      // Capture A's submission row and disk file before resubmission attempt
      const rowABefore = await prisma.taskSubmission.findUnique({ where: { id: subAId } });
      assert.ok(rowABefore, 'Student A row must exist before resubmission');
      assert.ok(rowABefore.storageKey, 'Student A storageKey must exist');
      const aDiskPath = path.join(uploadsTaskDir, rowABefore.storageKey);
      assert.equal(fs.existsSync(aDiskPath), true, 'Student A stored file must exist on disk');
      const aDiskBytesBefore = fs.readFileSync(aDiskPath);

      const filesBeforeResubmit = new Set(fs.readdirSync(uploadsTaskDir));

      // Student A attempts to resubmit bytes equal to student B's file
      const resAResubmit = await uploadTaskFile(studentA.token, taskO2.id, VALID_PDF_BYTES_ALT, 'studentA_resubmit_b_copy.pdf');

      assert.equal(resAResubmit.status, 409, 'Resubmission on graded task must be rejected with 409');
      assert.equal(
        resAResubmit.body?.message,
        'This task submission has already been graded and cannot be resubmitted.',
        'Error message must be exactly the already-graded message'
      );
      assert.notEqual(resAResubmit.body?.code, 'DUPLICATE_SUBMISSION', 'Error code must NOT be DUPLICATE_SUBMISSION');

      // Verify Student A's row is untouched
      const rowAAfter = await prisma.taskSubmission.findUnique({ where: { id: subAId } });
      assert.ok(rowAAfter, 'Student A row must still exist');
      assert.equal(rowAAfter.fileHash, rowABefore.fileHash, 'fileHash must be unchanged');
      assert.equal(rowAAfter.storageKey, rowABefore.storageKey, 'storageKey must be unchanged');
      assert.equal(rowAAfter.fileName, rowABefore.fileName, 'fileName must be unchanged');
      assert.equal(rowAAfter.score, 92, 'score must remain 92');

      // Verify Student A's old file on disk is untouched
      assert.equal(fs.existsSync(aDiskPath), true, 'Student A stored file must still exist on disk');
      const aDiskBytesAfter = fs.readFileSync(aDiskPath);
      assert.equal(aDiskBytesAfter.equals(aDiskBytesBefore), true, 'Student A stored file bytes must be untouched');

      // Verify no orphan file created by the rejected resubmit
      const filesAfterResubmit = fs.readdirSync(uploadsTaskDir);
      const orphanFiles = filesAfterResubmit.filter((f) => !filesBeforeResubmit.has(f));
      assert.equal(orphanFiles.length, 0, 'No orphan file created by rejected resubmission');
    });

    // -------------------------------------------------------------------------
    // O3 CONTROL: On-time, ungraded task, student B uploads bytes equal to A's file.
    // Expect 409 DUPLICATE_SUBMISSION (expected to pass before and after).
    // -------------------------------------------------------------------------
    await t.test('O3: Control - on-time ungraded student submits duplicate file -> 409 DUPLICATE_SUBMISSION', async () => {
      const futureDueDate = new Date('2099-01-01T00:00:00.000Z');
      const taskO3 = await makeTask('Task_O3_Control', futureDueDate);

      // Student A submits
      const resA = await uploadTaskFile(studentA.token, taskO3.id, VALID_PDF_BYTES, 'studentA_original.pdf');
      assert.equal(resA.status, 201, 'Student A submission must succeed');

      // Student B submits identical file
      const resB = await uploadTaskFile(studentB.token, taskO3.id, VALID_PDF_BYTES, 'studentB_duplicate.pdf');
      assert.equal(resB.status, 409, 'On-time duplicate must be rejected with 409');
      assert.equal(resB.body?.code, 'DUPLICATE_SUBMISSION', 'Error code must be DUPLICATE_SUBMISSION');
      assert.equal(
        resB.body?.message,
        'This file cannot be accepted because an identical submission already exists for this assignment. Please submit your own original work.',
        'Error message must match exact duplicate submission text'
      );

      const subsB = await prisma.taskSubmission.count({
        where: { taskId: taskO3.id, studentId: studentB.student.id },
      });
      assert.equal(subsB, 0, 'No submission row created for student B');
    });

  } finally {
    if (server) {
      server.close();
    }
    // Strict hermetic cleanup in reverse topological order
    // 1. Clean disk files
    for (const f of tracked.createdDiskFiles) {
      try {
        if (fs.existsSync(f)) fs.unlinkSync(f);
      } catch {}
    }
    // 2. Policy rows (before users)
    await prisma.submissionIntegrityPolicy.deleteMany({ where: { id: { in: tracked.policyIds } } }).catch(() => {});
    if (tracked.policyIds.includes(1)) {
      await prisma.submissionIntegrityPolicy.deleteMany({ where: { id: 1 } }).catch(() => {});
    }
    // 3. AuditLog rows for our tasks and submissions
    const allTaskSubIds = [
      ...tracked.taskIds.map(String),
      ...tracked.submissionIds.map(String),
    ];
    if (allTaskSubIds.length > 0) {
      await prisma.auditLog.deleteMany({
        where: {
          entity: 'TaskSubmission',
          entityId: { in: allTaskSubIds },
        },
      }).catch(() => {});
    }
    if (tracked.auditLogIds.length > 0) {
      await prisma.auditLog.deleteMany({ where: { id: { in: tracked.auditLogIds } } }).catch(() => {});
    }
    // 4. TaskSubmissions
    if (tracked.submissionIds.length > 0) {
      await prisma.taskSubmission.deleteMany({ where: { id: { in: tracked.submissionIds } } }).catch(() => {});
    }
    // 5. Tasks
    if (tracked.taskIds.length > 0) {
      await prisma.task.deleteMany({ where: { id: { in: tracked.taskIds } } }).catch(() => {});
    }
    // 6. Enrollments
    if (tracked.enrollmentIds.length > 0) {
      await prisma.enrollment.deleteMany({ where: { id: { in: tracked.enrollmentIds } } }).catch(() => {});
    }
    // 7. ScheduleSlots
    if (tracked.slotIds.length > 0) {
      await prisma.scheduleSlot.deleteMany({ where: { id: { in: tracked.slotIds } } }).catch(() => {});
    }
    // 8. Students
    if (tracked.studentIds.length > 0) {
      await prisma.student.deleteMany({ where: { id: { in: tracked.studentIds } } }).catch(() => {});
    }
    // 9. Doctors
    if (tracked.doctorIds.length > 0) {
      await prisma.doctor.deleteMany({ where: { id: { in: tracked.doctorIds } } }).catch(() => {});
    }
    // 10. Courses
    if (tracked.courseIds.length > 0) {
      await prisma.course.deleteMany({ where: { id: { in: tracked.courseIds } } }).catch(() => {});
    }
    // 11. Users
    if (tracked.userIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: tracked.userIds } } }).catch(() => {});
    }
    // 12. Departments
    if (tracked.departmentIds.length > 0) {
      await prisma.department.deleteMany({ where: { id: { in: tracked.departmentIds } } }).catch(() => {});
    }
    // 13. Colleges
    if (tracked.collegeIds.length > 0) {
      await prisma.college.deleteMany({ where: { id: { in: tracked.collegeIds } } }).catch(() => {});
    }
  }
});
