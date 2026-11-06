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

const NON_MATERIAL_PDF_BYTES = Buffer.from(
  '%PDF-1.4\n3 0 obj\n<< /Type /OtherWork >>\nendobj\ntrailer\n<< /Root 3 0 R >>\n%%EOF\n',
  'utf8'
);

test('WP5-T6a2: Duplicate Submission Integrity (C1 - C9)', async (t) => {
  const SUFFIX = `t6a2_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
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
    materialIds: [] as number[],
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
    const doctorToken = generateAccessToken(docUser.id, docUser.tokenVersion);

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

    // Schedule Slot (assigns doctor to course)
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

    // Students (A, B, C, D)
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
    const studentC = await makeStudent(3);
    const studentD = await makeStudent(4);

    // Helper to create task
    async function makeTask(title: string) {
      const tsk = await prisma.task.create({
        data: {
          title: `${title}_${SUFFIX}`,
          description: 'Assignment task description',
          courseId: course.id,
          doctorId: doctor.id,
          academicYear: 2026,
          semester: 1,
          dueDate: new Date('2099-01-01T00:00:00.000Z'),
          maxScore: 100,
        },
      });
      tracked.taskIds.push(tsk.id);
      return tsk;
    }

    // -------------------------------------------------------------------------
    // C1: Student B submits to task X a file whose hash equals student A's stored hash
    // -------------------------------------------------------------------------
    await t.test('C1: Student B submits duplicate file to task X -> 409 DUPLICATE_SUBMISSION', async () => {
      const task1 = await makeTask('Task_C1');

      // Student A submits
      const resA = await uploadTaskFile(studentA.token, task1.id, VALID_PDF_BYTES, 'studentA_work.pdf');
      assert.equal(resA.status, 201, 'Student A submission must succeed with 201');
      assert.ok(resA.body?.data?.id, 'Student A must receive created submission id');

      const filesBeforeB = fs.readdirSync(uploadsTaskDir);
      const subsBeforeB = await prisma.taskSubmission.count({ where: { taskId: task1.id } });
      assert.equal(subsBeforeB, 1, 'Exactly one submission before B submits');

      // Student B submits identical file
      const resB = await uploadTaskFile(studentB.token, task1.id, VALID_PDF_BYTES, 'studentB_copy.pdf');
      assert.equal(resB.status, 409, 'Duplicate submission must be rejected with 409');
      assert.equal(resB.body?.code, 'DUPLICATE_SUBMISSION', 'Error code must be DUPLICATE_SUBMISSION');
      assert.equal(
        resB.body?.message,
        'This file cannot be accepted because an identical submission already exists for this assignment. Please submit your own original work.',
        'Error message must match exact required text'
      );

      // Verify no TaskSubmission row created or changed
      const subsAfterB = await prisma.taskSubmission.count({ where: { taskId: task1.id } });
      assert.equal(subsAfterB, 1, 'No new TaskSubmission row may be created on duplicate block');

      // Verify uploaded file is removed
      const filesAfterB = fs.readdirSync(uploadsTaskDir);
      assert.equal(filesAfterB.length, filesBeforeB.length, 'Uploaded file must be removed from disk on 409');

      // Verify response reveals nothing about Student A
      const respStr = JSON.stringify(resB.body);
      assert.ok(!respStr.includes(String(studentA.student.id)), 'Response must not leak Student A student ID');
      assert.ok(!respStr.includes(studentA.student.firstName), 'Response must not leak Student A name');
      assert.ok(!respStr.includes('studentA_work.pdf'), 'Response must not leak Student A file name');
    });

    // -------------------------------------------------------------------------
    // C2: Same bytes under a different file name or extension case
    // -------------------------------------------------------------------------
    await t.test('C2: Same bytes under different file name or extension case -> 409', async () => {
      const task2 = await makeTask('Task_C2');

      const resA = await uploadTaskFile(studentA.token, task2.id, VALID_PDF_BYTES, 'original.pdf');
      assert.equal(resA.status, 201);

      // Student B submits same bytes with different name and uppercase extension
      const resB = await uploadTaskFile(studentB.token, task2.id, VALID_PDF_BYTES, 'RENAMED_WORK.PDF');
      assert.equal(resB.status, 409, 'Same bytes under different name/casing must still trigger 409');
      assert.equal(resB.body?.code, 'DUPLICATE_SUBMISSION');
    });

    // -------------------------------------------------------------------------
    // C3: TRULY PARALLEL: at least 3 simultaneous real HTTP uploads
    // -------------------------------------------------------------------------
    await t.test('C3: Truly parallel 3 simultaneous uploads -> exactly one 201, two 409s', async () => {
      const task3 = await makeTask('Task_C3');

      // 3 simultaneous uploads by different students with identical bytes
      const [r1, r2, r3] = await Promise.all([
        uploadTaskFile(studentA.token, task3.id, VALID_PDF_BYTES, 'parallel_a.pdf'),
        uploadTaskFile(studentB.token, task3.id, VALID_PDF_BYTES, 'parallel_b.pdf'),
        uploadTaskFile(studentC.token, task3.id, VALID_PDF_BYTES, 'parallel_c.pdf'),
      ]);

      const statuses = [r1.status, r2.status, r3.status];
      const successes = statuses.filter((s) => s === 201);
      const conflicts = statuses.filter((s) => s === 409);

      assert.equal(successes.length, 1, `Expected exactly one 201, got ${successes.length} (statuses: ${statuses.join(',')})`);
      assert.equal(conflicts.length, 2, `Expected exactly two 409s, got ${conflicts.length}`);

      const fileHash = crypto.createHash('sha256').update(VALID_PDF_BYTES).digest('hex');
      const rows = await prisma.taskSubmission.count({
        where: { taskId: task3.id, fileHash },
      });
      assert.equal(rows, 1, 'Exactly one row must exist in the database with that hash');
    });

    // -------------------------------------------------------------------------
    // C4: Same student re-submits with a file equal to their OWN earlier file
    // -------------------------------------------------------------------------
    await t.test('C4: Same student re-submits with a file equal to their OWN earlier file -> allowed', async () => {
      const task4 = await makeTask('Task_C4');

      const resA1 = await uploadTaskFile(studentA.token, task4.id, VALID_PDF_BYTES, 'draft.pdf');
      assert.equal(resA1.status, 201);

      // Student B submits same file -> blocked to confirm exactDuplicateBlock is active
      const resB = await uploadTaskFile(studentB.token, task4.id, VALID_PDF_BYTES, 'stolen.pdf');
      assert.equal(resB.status, 409);
      assert.equal(resB.body?.code, 'DUPLICATE_SUBMISSION');

      // Student A re-submits the exact same file (wait 200ms to clear rapid-submit guard)
      await new Promise((resolve) => setTimeout(resolve, 200));
      const resA2 = await uploadTaskFile(studentA.token, task4.id, VALID_PDF_BYTES, 'draft_final.pdf');
      assert.ok([200, 201].includes(resA2.status), `Own resubmission must be allowed, got status ${resA2.status}`);

      const count = await prisma.taskSubmission.count({ where: { taskId: task4.id } });
      assert.equal(count, 1, 'Resubmission updates existing row, count stays 1');
    });

    // -------------------------------------------------------------------------
    // C5: Legacy row with fileHash null is never counted as duplicate
    // -------------------------------------------------------------------------
    await t.test('C5: Legacy row with fileHash null is never counted as duplicate', async () => {
      const task5 = await makeTask('Task_C5');

      // Create legacy submission directly in DB with fileHash: null
      const legacySub = await prisma.taskSubmission.create({
        data: {
          taskId: task5.id,
          studentId: studentA.student.id,
          enrollmentId: studentA.enrollment.id,
          notes: 'Legacy submission without hash',
          fileHash: null,
          fileUrl: `/api/tasks/${task5.id}/submissions/legacy/download`,
        },
      });
      tracked.submissionIds.push(legacySub.id);

      // Student B submits a file with valid hash
      const resB = await uploadTaskFile(studentB.token, task5.id, VALID_PDF_BYTES, 'studentB.pdf');
      assert.equal(resB.status, 201, 'Student B submission must succeed despite legacy null hash row');

      // Student C submits the same file -> 409 because B submitted it
      const resC = await uploadTaskFile(studentC.token, task5.id, VALID_PDF_BYTES, 'studentC.pdf');
      assert.equal(resC.status, 409, 'Student C must be blocked by Student B hash');
      assert.equal(resC.body?.code, 'DUPLICATE_SUBMISSION');
    });

    // -------------------------------------------------------------------------
    // C6: A file whose hash equals a CourseMaterial.fileHash is never blocked
    // -------------------------------------------------------------------------
    await t.test('C6: File matching CourseMaterial.fileHash is never blocked', async () => {
      const task6 = await makeTask('Task_C6');

      // 1. Without matching CourseMaterial, duplicate submission is blocked
      const resA1 = await uploadTaskFile(studentA.token, task6.id, NON_MATERIAL_PDF_BYTES, 'work_a.pdf');
      assert.equal(resA1.status, 201);

      const resB1 = await uploadTaskFile(studentB.token, task6.id, NON_MATERIAL_PDF_BYTES, 'work_b.pdf');
      assert.equal(resB1.status, 409, 'Without matching CourseMaterial, duplicate must be blocked');
      assert.equal(resB1.body?.code, 'DUPLICATE_SUBMISSION');

      // 2. Now upload/link CourseMaterial with VALID_PDF_BYTES
      const templateHash = crypto.createHash('sha256').update(VALID_PDF_BYTES).digest('hex');
      const mat = await prisma.courseMaterial.create({
        data: {
          title: `Template_${SUFFIX}`,
          type: 'LECTURE',
          courseId: course.id,
          uploadedById: docUser.id,
          fileHash: templateHash,
          fileUrl: '/uploads/materials/template.pdf',
        },
      });
      tracked.materialIds.push(mat.id);

      // Student C submits template file
      const resC = await uploadTaskFile(studentC.token, task6.id, VALID_PDF_BYTES, 'studentC_template.pdf');
      assert.equal(resC.status, 201);

      // Student D also submits the template file -> MUST BE ALLOWED because it is CourseMaterial
      const resD = await uploadTaskFile(studentD.token, task6.id, VALID_PDF_BYTES, 'studentD_template.pdf');
      assert.equal(resD.status, 201, 'Submission matching CourseMaterial fileHash must be accepted');

      // Clean up course material so later subtests are not affected by this template hash
      await prisma.courseMaterial.deleteMany({ where: { id: mat.id } });
      tracked.materialIds = tracked.materialIds.filter((id) => id !== mat.id);
    });

    // -------------------------------------------------------------------------
    // C7: Never cross-task: same bytes submitted to different task accepted
    // -------------------------------------------------------------------------
    await t.test('C7: Never cross-task: same bytes submitted to different task are accepted', async () => {
      const taskA = await makeTask('Task_C7_A');
      const taskB = await makeTask('Task_C7_B');

      // Student A submits to Task A
      const resA = await uploadTaskFile(studentA.token, taskA.id, VALID_PDF_BYTES, 'work.pdf');
      assert.equal(resA.status, 201);

      // Student B submits same file to Task A -> 409
      const resB_A = await uploadTaskFile(studentB.token, taskA.id, VALID_PDF_BYTES, 'work.pdf');
      assert.equal(resB_A.status, 409);
      assert.equal(resB_A.body?.code, 'DUPLICATE_SUBMISSION');

      // Student B submits same file to Task B -> 201 accepted!
      const resB_B = await uploadTaskFile(studentB.token, taskB.id, VALID_PDF_BYTES, 'work.pdf');
      assert.equal(resB_B.status, 201, 'Same file submitted to different task must be accepted');
    });

    // -------------------------------------------------------------------------
    // C8: Policy row with exactDuplicateBlock=false: duplicates accepted
    // -------------------------------------------------------------------------
    await t.test('C8: Policy row with exactDuplicateBlock=false: duplicates accepted. No row: block ON', async () => {
      const task8 = await makeTask('Task_C8');

      // Step 1: No policy row -> Block is ON by default
      const resA = await uploadTaskFile(studentA.token, task8.id, VALID_PDF_BYTES, 'sub_a.pdf');
      assert.equal(resA.status, 201);

      const resB = await uploadTaskFile(studentB.token, task8.id, VALID_PDF_BYTES, 'sub_b.pdf');
      assert.equal(resB.status, 409, 'Without policy row, duplicate block must be ON');
      assert.equal(resB.body?.code, 'DUPLICATE_SUBMISSION');

      // Step 2: Create policy row with exactDuplicateBlock: false
      const policy = await prisma.submissionIntegrityPolicy.upsert({
        where: { id: 1 },
        create: {
          id: 1,
          exactDuplicateBlock: false,
          updatedBy: { connect: { id: docUser.id } },
        },
        update: {
          exactDuplicateBlock: false,
          updatedBy: { connect: { id: docUser.id } },
        },
      });
      tracked.policyIds.push(policy.id);

      // Student C submits same file -> accepted because exactDuplicateBlock is false
      const resC = await uploadTaskFile(studentC.token, task8.id, VALID_PDF_BYTES, 'sub_c.pdf');
      assert.equal(resC.status, 201, 'With exactDuplicateBlock=false, duplicate submissions must be accepted');

      // Clean up policy row immediately
      await prisma.submissionIntegrityPolicy.deleteMany({ where: { id: 1 } });
      tracked.policyIds = [];
    });

    // -------------------------------------------------------------------------
    // C9: Blocked attempt writes audit row OUTSIDE failing transaction
    // -------------------------------------------------------------------------
    await t.test('C9: Blocked attempt writes audit row OUTSIDE failing transaction, doctor sees nothing', async () => {
      const task9 = await makeTask('Task_C9');
      const fileHash = crypto.createHash('sha256').update(VALID_PDF_BYTES).digest('hex');

      // Student A submits
      const resA = await uploadTaskFile(studentA.token, task9.id, VALID_PDF_BYTES, 'original.pdf');
      assert.equal(resA.status, 201);

      const auditCountBefore = await prisma.auditLog.count({
        where: {
          action: 'SUBMISSION_DUPLICATE_BLOCKED',
          entity: 'TaskSubmission',
        },
      });

      // Student B submits duplicate -> 409
      const resB = await uploadTaskFile(studentB.token, task9.id, VALID_PDF_BYTES, 'duplicate.pdf');
      assert.equal(resB.status, 409);
      assert.equal(resB.body?.code, 'DUPLICATE_SUBMISSION');

      // Check audit row exists outside the failed transaction
      const auditRows = await prisma.auditLog.findMany({
        where: {
          action: 'SUBMISSION_DUPLICATE_BLOCKED',
          entity: 'TaskSubmission',
        },
        orderBy: { timestamp: 'desc' },
        take: 1,
      });

      assert.ok(auditRows.length > 0, 'Audit log row must be written for blocked duplicate');
      const latestAudit = auditRows[0];
      tracked.auditLogIds.push(latestAudit.id);

      assert.equal(latestAudit.userId, studentB.user.id, 'Audit row actor must be Student B');
      assert.equal((latestAudit.details as any)?.taskId, task9.id, 'Audit row must record taskId');
      assert.equal((latestAudit.details as any)?.fileHash, fileHash, 'Audit row must record fileHash');

      // Doctor views submissions for task9 -> sees only Student A, nothing about Student B
      const docRes = await fetch(`${baseUrl}/tasks/${task9.id}/submissions`, {
        headers: { Authorization: `Bearer ${doctorToken}` },
      });
      assert.equal(docRes.status, 200);
      const docJson: any = await docRes.json();
      const allRows = docJson.data?.rows || [];
      const submittedRows = allRows.filter((r: any) => r.isSubmitted && r.submission);
      assert.equal(submittedRows.length, 1, 'Doctor must only see 1 accepted submission');
      assert.equal(submittedRows[0].student.id, studentA.student.id, 'Submission must belong to Student A');
      const studentBRow = allRows.find((r: any) => r.student.id === studentB.student.id);
      assert.ok(studentBRow, 'Student B row must exist in roster');
      assert.equal(studentBRow.isSubmitted, false, 'Student B submission must not exist');
      assert.equal(studentBRow.submission, null, 'Doctor sees nothing about Student B blocked attempt');
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
    // 3. AuditLog rows
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
    // 6. CourseMaterials
    if (tracked.materialIds.length > 0) {
      await prisma.courseMaterial.deleteMany({ where: { id: { in: tracked.materialIds } } }).catch(() => {});
    }
    // 7. Enrollments
    if (tracked.enrollmentIds.length > 0) {
      await prisma.enrollment.deleteMany({ where: { id: { in: tracked.enrollmentIds } } }).catch(() => {});
    }
    // 8. ScheduleSlots
    if (tracked.slotIds.length > 0) {
      await prisma.scheduleSlot.deleteMany({ where: { id: { in: tracked.slotIds } } }).catch(() => {});
    }
    // 9. Students
    if (tracked.studentIds.length > 0) {
      await prisma.student.deleteMany({ where: { id: { in: tracked.studentIds } } }).catch(() => {});
    }
    // 10. Doctors
    if (tracked.doctorIds.length > 0) {
      await prisma.doctor.deleteMany({ where: { id: { in: tracked.doctorIds } } }).catch(() => {});
    }
    // 11. Courses
    if (tracked.courseIds.length > 0) {
      await prisma.course.deleteMany({ where: { id: { in: tracked.courseIds } } }).catch(() => {});
    }
    // 12. Users
    if (tracked.userIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: tracked.userIds } } }).catch(() => {});
    }
    // 13. Departments
    if (tracked.departmentIds.length > 0) {
      await prisma.department.deleteMany({ where: { id: { in: tracked.departmentIds } } }).catch(() => {});
    }
    // 14. Colleges
    if (tracked.collegeIds.length > 0) {
      await prisma.college.deleteMany({ where: { id: { in: tracked.collegeIds } } }).catch(() => {});
    }
  }
});
