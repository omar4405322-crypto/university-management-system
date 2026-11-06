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

// Valid 1x1 PNG bytes for magic-byte verification
const VALID_PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

// Minimal valid PDF bytes (%PDF-1.4 ... %%EOF)
const VALID_PDF_BUFFER = Buffer.from(
  '%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n',
  'utf8'
);

// Text buffer
const VALID_PDF_BUFFER_S2 = Buffer.concat([VALID_PDF_BUFFER, Buffer.from('\n% distinct bytes for student 2\n')]);
const VALID_TXT_BUFFER = Buffer.from('Hello UniCore assignment submission content\n', 'utf8');

test('WP5-T5b-1: Student File Upload for Task Submissions - Backend Hardening & Threat Model', async (t) => {
  const SUFFIX = `t5b1_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  let server: http.Server | null = null;
  let baseUrl = '';

  const uploadsTaskDir = path.resolve(process.cwd(), 'uploads/tasks');
  if (!fs.existsSync(uploadsTaskDir)) {
    fs.mkdirSync(uploadsTaskDir, { recursive: true });
  }

  // Registry for strict hermetic cleanup in reverse topological order
  const tracked = {
    createdDiskFiles: [] as string[],
    submissionIds: [] as number[],
    taskIds: [] as number[],
    enrollmentIds: [] as number[],
    slotIds: [] as number[],
    studentGroupIds: [] as number[],
    studentIds: [] as number[],
    doctorIds: [] as number[],
    taIds: [] as string[],
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

    // 0. Base setup: College & Departments
    const college = await prisma.college.create({
      data: { name: `Col_${SUFFIX}` },
    });
    tracked.collegeIds.push(college.id);

    const otherCollege = await prisma.college.create({
      data: { name: `OtherCol_${SUFFIX}` },
    });
    tracked.collegeIds.push(otherCollege.id);

    const dept1 = await prisma.department.create({
      data: { name: `Dept1_${SUFFIX}`, collegeId: college.id },
    });
    tracked.departmentIds.push(dept1.id);

    const dept2 = await prisma.department.create({
      data: { name: `Dept2_${SUFFIX}`, collegeId: college.id },
    });
    tracked.departmentIds.push(dept2.id);

    const otherDept = await prisma.department.create({
      data: { name: `OtherDept_${SUFFIX}`, collegeId: otherCollege.id },
    });
    tracked.departmentIds.push(otherDept.id);

    // Groups for OD-74 verification
    const groupA = await prisma.studentGroup.create({
      data: { name: `GrpA_${SUFFIX}`, departmentId: dept1.id },
    });
    tracked.studentGroupIds.push(groupA.id);

    const groupB = await prisma.studentGroup.create({
      data: { name: `GrpB_${SUFFIX}`, departmentId: dept1.id },
    });
    tracked.studentGroupIds.push(groupB.id);

    // Helpers to create test users
    async function createTestUser(role: string, departmentId: number, collegeId?: number) {
      const passwordHash = await bcrypt.hash(crypto.randomUUID() + '!Aa1', 4);
      const user = await prisma.user.create({
        data: {
          email: `${role.toLowerCase()}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}@test.unicore`,
          password: passwordHash,
          role: role as any,
          departmentId,
          collegeId: collegeId ?? college.id,
          isActive: true,
        },
      });
      tracked.userIds.push(user.id);
      return user;
    }

    // 1. Doctors
    const docUser1 = await createTestUser('DOCTOR', dept1.id);
    const doctor1 = await prisma.doctor.create({
      data: {
        userId: docUser1.id,
        firstName: 'Doctor1',
        lastName: SUFFIX,
        departmentId: dept1.id,
      },
    });
    tracked.doctorIds.push(doctor1.id);

    const docUser2 = await createTestUser('DOCTOR', dept2.id);
    const doctor2 = await prisma.doctor.create({
      data: {
        userId: docUser2.id,
        firstName: 'Doctor2',
        lastName: SUFFIX,
        departmentId: dept2.id,
      },
    });
    tracked.doctorIds.push(doctor2.id);

    // 2. Teaching Assistants
    const taUser1 = await createTestUser('TEACHING_ASSISTANT', dept1.id);
    const ta1 = await prisma.teachingAssistant.create({
      data: {
        userId: taUser1.id,
        employeeId: `TA1_${SUFFIX}`,
        firstName: 'TA1',
        lastName: SUFFIX,
        departmentId: dept1.id,
      },
    });
    tracked.taIds.push(ta1.id);

    const taUser2 = await createTestUser('TEACHING_ASSISTANT', dept1.id);
    const ta2 = await prisma.teachingAssistant.create({
      data: {
        userId: taUser2.id,
        employeeId: `TA2_${SUFFIX}`,
        firstName: 'TA2',
        lastName: SUFFIX,
        departmentId: dept1.id,
      },
    });
    tracked.taIds.push(ta2.id);

    const taUnassignedUser = await createTestUser('TEACHING_ASSISTANT', dept1.id);
    const taUnassigned = await prisma.teachingAssistant.create({
      data: {
        userId: taUnassignedUser.id,
        employeeId: `TA3_${SUFFIX}`,
        firstName: 'TAUnassigned',
        lastName: SUFFIX,
        departmentId: dept1.id,
      },
    });
    tracked.taIds.push(taUnassigned.id);

    // 3. Students
    // Student 1 in Group A
    const studentUser1 = await createTestUser('STUDENT', dept1.id);
    const student1 = await prisma.student.create({
      data: {
        userId: studentUser1.id,
        studentId: `STU1_${SUFFIX}`,
        firstName: 'Student1',
        lastName: SUFFIX,
        departmentId: dept1.id,
        year: 1,
        groupId: groupA.id,
      },
    });
    tracked.studentIds.push(student1.id);

    // Student 2 in Group B
    const studentUser2 = await createTestUser('STUDENT', dept1.id);
    const student2 = await prisma.student.create({
      data: {
        userId: studentUser2.id,
        studentId: `STU2_${SUFFIX}`,
        firstName: 'Student2',
        lastName: SUFFIX,
        departmentId: dept1.id,
        year: 1,
        groupId: groupB.id,
      },
    });
    tracked.studentIds.push(student2.id);

    // Student 3 (Withdrawn)
    const studentUser3 = await createTestUser('STUDENT', dept1.id);
    const student3 = await prisma.student.create({
      data: {
        userId: studentUser3.id,
        studentId: `STU3_${SUFFIX}`,
        firstName: 'Student3Withdrawn',
        lastName: SUFFIX,
        departmentId: dept1.id,
        year: 1,
      },
    });
    tracked.studentIds.push(student3.id);

    // Student 4 (Blocked)
    const studentUser4 = await createTestUser('STUDENT', dept1.id);
    const student4 = await prisma.student.create({
      data: {
        userId: studentUser4.id,
        studentId: `STU4_${SUFFIX}`,
        firstName: 'Student4Blocked',
        lastName: SUFFIX,
        departmentId: dept1.id,
        year: 1,
      },
    });
    tracked.studentIds.push(student4.id);

    // Student 5 (Not enrolled)
    const studentUser5 = await createTestUser('STUDENT', dept1.id);
    const student5 = await prisma.student.create({
      data: {
        userId: studentUser5.id,
        studentId: `STU5_${SUFFIX}`,
        firstName: 'Student5NonEnrolled',
        lastName: SUFFIX,
        departmentId: dept1.id,
        year: 1,
      },
    });
    tracked.studentIds.push(student5.id);

    // 4. Admins
    const superAdminUser = await createTestUser('SUPER_ADMIN', dept1.id);
    const colAdminUser = await createTestUser('COLLEGE_ADMIN', dept1.id, college.id);
    const otherColAdminUser = await createTestUser('COLLEGE_ADMIN', otherDept.id, otherCollege.id);
    const deptAdminUser = await createTestUser('DEPARTMENT_ADMIN', dept1.id);
    const otherDeptAdminUser = await createTestUser('DEPARTMENT_ADMIN', dept2.id);

    // 5. Courses
    const course1 = await prisma.course.create({
      data: {
        name: `Course1_${SUFFIX}`,
        courseCode: `C1_${SUFFIX.slice(0, 10).toUpperCase()}`,
        departmentId: dept1.id,
        credits: 3,
        year: 1,
        semester: 1,
        isPublished: true,
      },
    });
    tracked.courseIds.push(course1.id);

    const unpubCourse = await prisma.course.create({
      data: {
        name: `Unpub_${SUFFIX}`,
        courseCode: `UNP_${SUFFIX.slice(0, 9).toUpperCase()}`,
        departmentId: dept1.id,
        credits: 3,
        year: 1,
        semester: 1,
        isPublished: false,
      },
    });
    tracked.courseIds.push(unpubCourse.id);

    const archivedCourse = await prisma.course.create({
      data: {
        name: `Arch_${SUFFIX}`,
        courseCode: `ARC_${SUFFIX.slice(0, 9).toUpperCase()}`,
        departmentId: dept1.id,
        credits: 3,
        year: 1,
        semester: 1,
        isPublished: true,
      },
    });
    tracked.courseIds.push(archivedCourse.id);

    // 6. ScheduleSlots
    // Doctor1 assigned to Course1
    const docSlot = await prisma.scheduleSlot.create({
      data: {
        courseId: course1.id,
        doctorId: doctor1.id,
        slotType: 'LECTURE',
        dayOfWeek: 'MONDAY',
        startTime: '09:00',
        endTime: '11:00',
      },
    });
    tracked.slotIds.push(docSlot.id);

    // TA1 assigned to Course1 for Group A only (OD-74)
    const ta1Slot = await prisma.scheduleSlot.create({
      data: {
        courseId: course1.id,
        teachingAssistantId: ta1.id,
        slotType: 'SECTION',
        groupId: groupA.id,
        dayOfWeek: 'TUESDAY',
        startTime: '11:00',
        endTime: '13:00',
      },
    });
    tracked.slotIds.push(ta1Slot.id);

    // TA2 assigned to Course1 for Group B only (OD-74)
    const ta2Slot = await prisma.scheduleSlot.create({
      data: {
        courseId: course1.id,
        teachingAssistantId: ta2.id,
        slotType: 'SECTION',
        groupId: groupB.id,
        dayOfWeek: 'WEDNESDAY',
        startTime: '11:00',
        endTime: '13:00',
      },
    });
    tracked.slotIds.push(ta2Slot.id);

    // 7. Enrollments
    const enroll1 = await prisma.enrollment.create({
      data: {
        studentId: student1.id,
        courseId: course1.id,
        academicYear: 2026,
        semester: 1,
        status: 'ENROLLED',
      },
    });
    tracked.enrollmentIds.push(enroll1.id);

    const enroll2 = await prisma.enrollment.create({
      data: {
        studentId: student2.id,
        courseId: course1.id,
        academicYear: 2026,
        semester: 1,
        status: 'ENROLLED',
      },
    });
    tracked.enrollmentIds.push(enroll2.id);

    const enroll3Withdrawn = await prisma.enrollment.create({
      data: {
        studentId: student3.id,
        courseId: course1.id,
        academicYear: 2026,
        semester: 1,
        status: 'WITHDRAWN',
      },
    });
    tracked.enrollmentIds.push(enroll3Withdrawn.id);

    const enroll4Blocked = await prisma.enrollment.create({
      data: {
        studentId: student4.id,
        courseId: course1.id,
        academicYear: 2026,
        semester: 1,
        status: 'BLOCKED',
      },
    });
    tracked.enrollmentIds.push(enroll4Blocked.id);

    // 8. Tasks (fixed dates: 2099-01-01 for active, 2020-01-01 for past due)
    const futureDate = new Date('2099-01-01T00:00:00.000Z');
    const pastDate = new Date('2020-01-01T00:00:00.000Z');

    const activeTask = await prisma.task.create({
      data: {
        title: `ActiveTask_${SUFFIX}`,
        description: 'Upload assignment submission',
        courseId: course1.id,
        doctorId: doctor1.id,
        dueDate: futureDate,
        maxScore: 100,
        academicYear: 2026,
        semester: 1,
      },
    });
    tracked.taskIds.push(activeTask.id);

    const pastDueTask = await prisma.task.create({
      data: {
        title: `PastDueTask_${SUFFIX}`,
        description: 'Expired assignment',
        courseId: course1.id,
        doctorId: doctor1.id,
        dueDate: pastDate,
        maxScore: 100,
        academicYear: 2026,
        semester: 1,
      },
    });
    tracked.taskIds.push(pastDueTask.id);

    const unpubCourseTask = await prisma.task.create({
      data: {
        title: `UnpubTask_${SUFFIX}`,
        description: 'Unpublished course assignment',
        courseId: unpubCourse.id,
        doctorId: doctor1.id,
        dueDate: futureDate,
        maxScore: 100,
        academicYear: 2026,
        semester: 1,
      },
    });
    tracked.taskIds.push(unpubCourseTask.id);

    const tokens = {
      student1: generateAccessToken(studentUser1.id),
      student2: generateAccessToken(studentUser2.id),
      student3Withdrawn: generateAccessToken(studentUser3.id),
      student4Blocked: generateAccessToken(studentUser4.id),
      student5NonEnrolled: generateAccessToken(studentUser5.id),
      doctor1: generateAccessToken(docUser1.id),
      doctor2: generateAccessToken(docUser2.id),
      ta1: generateAccessToken(taUser1.id),
      ta2: generateAccessToken(taUser2.id),
      taUnassigned: generateAccessToken(taUnassignedUser.id),
      superAdmin: generateAccessToken(superAdminUser.id),
      colAdmin: generateAccessToken(colAdminUser.id),
      otherColAdmin: generateAccessToken(otherColAdminUser.id),
      deptAdmin: generateAccessToken(deptAdminUser.id),
      otherDeptAdmin: generateAccessToken(otherDeptAdminUser.id),
    };

    // Helper: submit multipart form
    async function submitMultipartTask(
      taskId: number,
      token: string,
      options: {
        fileBuffer?: Buffer;
        filename?: string;
        contentType?: string;
        notes?: string;
        linkUrl?: string;
        bodyFileUrl?: string;
      }
    ) {
      const formData = new FormData();
      if (options.fileBuffer !== undefined && options.filename) {
        const blob = new Blob([options.fileBuffer], {
          type: options.contentType || 'application/octet-stream',
        });
        formData.append('file', blob, options.filename);
      }
      if (options.notes !== undefined) {
        formData.append('notes', options.notes);
      }
      if (options.linkUrl !== undefined) {
        formData.append('linkUrl', options.linkUrl);
      }
      if (options.bodyFileUrl !== undefined) {
        formData.append('fileUrl', options.bodyFileUrl);
      }

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

    // Helper: submit JSON task (old link-only submission)
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
      if (json?.data?.storageKey) {
        tracked.createdDiskFiles.push(path.join(uploadsTaskDir, json.data.storageKey));
      }
      if (json?.data?.id) {
        tracked.submissionIds.push(json.data.id);
      }
      return { status: res.status, body: json };
    }

    // Helper: download task submission
    async function downloadSubmission(
      taskId: number,
      submissionId: number,
      token?: string
    ) {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${baseUrl}/tasks/${taskId}/submissions/${submissionId}/download`, {
        method: 'GET',
        headers,
      });
      const contentDisposition = res.headers.get('content-disposition');
      const contentTypeOptions = res.headers.get('x-content-type-options');
      let textOrBuffer: any;
      if (res.ok) {
        textOrBuffer = Buffer.from(await res.arrayBuffer());
      } else {
        textOrBuffer = await res.json().catch(() => null);
      }
      return {
        status: res.status,
        contentDisposition,
        contentTypeOptions,
        body: textOrBuffer,
      };
    }

    // -------------------------------------------------------------------------
    // TEST SUITE: S-A Student Enrollment, Course Published & Active Scope Guards
    // -------------------------------------------------------------------------
    await t.test('S-A: Only student with active ENROLLED status in published, non-archived course can upload', async () => {
      // 1. Enrolled student succeeds with valid PDF
      const successRes = await submitMultipartTask(activeTask.id, tokens.student1, {
        fileBuffer: VALID_PDF_BUFFER,
        filename: 'assignment1.pdf',
        contentType: 'application/pdf',
        notes: 'Initial assignment submission',
      });
      assert.strictEqual(successRes.status, 201, `Enrolled student submit should return 201. Body: ${JSON.stringify(successRes.body)}`);
      assert.strictEqual(successRes.body.success, true);
      assert.ok(successRes.body.data.id);
      tracked.submissionIds.push(successRes.body.data.id);

      // Verify file metadata columns in database
      const dbRow = await prisma.taskSubmission.findUnique({
        where: { id: successRes.body.data.id },
      });
      assert.ok(dbRow);
      assert.strictEqual(dbRow.fileName, 'assignment1.pdf');
      assert.strictEqual(dbRow.fileType, 'application/pdf');
      assert.strictEqual(dbRow.fileSize, VALID_PDF_BUFFER.length);
      assert.ok(dbRow.fileHash);
      assert.ok(dbRow.storageKey);
      tracked.createdDiskFiles.push(path.join(uploadsTaskDir, dbRow.storageKey!));

      // 2. WITHDRAWN student -> 403
      const withdrawnRes = await submitMultipartTask(activeTask.id, tokens.student3Withdrawn, {
        fileBuffer: VALID_PDF_BUFFER,
        filename: 'withdrawn.pdf',
        contentType: 'application/pdf',
      });
      assert.strictEqual(withdrawnRes.status, 403, 'Withdrawn student must be rejected with 403');

      // 3. BLOCKED student -> 403
      const blockedRes = await submitMultipartTask(activeTask.id, tokens.student4Blocked, {
        fileBuffer: VALID_PDF_BUFFER,
        filename: 'blocked.pdf',
        contentType: 'application/pdf',
      });
      assert.strictEqual(blockedRes.status, 403, 'Blocked student must be rejected with 403');

      // 4. Non-enrolled student -> 403
      const nonEnrolledRes = await submitMultipartTask(activeTask.id, tokens.student5NonEnrolled, {
        fileBuffer: VALID_PDF_BUFFER,
        filename: 'non_enrolled.pdf',
        contentType: 'application/pdf',
      });
      assert.strictEqual(nonEnrolledRes.status, 403, 'Non-enrolled student must be rejected with 403');

      // 5. Unpublished course task -> 404 (or 403)
      const unpubRes = await submitMultipartTask(unpubCourseTask.id, tokens.student1, {
        fileBuffer: VALID_PDF_BUFFER,
        filename: 'unpub.pdf',
        contentType: 'application/pdf',
      });
      assert.ok(unpubRes.status === 404 || unpubRes.status === 403, `Unpublished course task must return 404/403, got ${unpubRes.status}`);

      // 6. Non-student role calling submit -> 403
      const docSubmitRes = await submitMultipartTask(activeTask.id, tokens.doctor1, {
        fileBuffer: VALID_PDF_BUFFER,
        filename: 'doc.pdf',
        contentType: 'application/pdf',
      });
      assert.strictEqual(docSubmitRes.status, 403, 'Doctor submitting task must be rejected with 403');
    });

    // -------------------------------------------------------------------------
    // TEST SUITE: S-B Deadline & Graded Resubmission Guards, Parallel Concurrency
    // -------------------------------------------------------------------------
    await t.test('S-B: Upload after dueDate = 409, no resubmit after grading, parallel double submit = one success + one 409', async () => {
      // 1. Upload to task past dueDate -> 409 Conflict
      const pastDueRes = await submitMultipartTask(pastDueTask.id, tokens.student2, {
        fileBuffer: VALID_PDF_BUFFER,
        filename: 'late.pdf',
        contentType: 'application/pdf',
      });
      assert.strictEqual(pastDueRes.status, 409, 'Upload after dueDate must return 409 Conflict');

      // 2. Student 2 submits on-time active task
      const s2Res = await submitMultipartTask(activeTask.id, tokens.student2, {
        fileBuffer: VALID_PDF_BUFFER_S2,
        filename: 's2_initial.pdf',
        contentType: 'application/pdf',
      });
      assert.strictEqual(s2Res.status, 201);
      const s2SubId = s2Res.body.data.id;
      tracked.submissionIds.push(s2SubId);

      const s2DbRow = await prisma.taskSubmission.findUnique({ where: { id: s2SubId } });
      if (s2DbRow?.storageKey) {
        tracked.createdDiskFiles.push(path.join(uploadsTaskDir, s2DbRow.storageKey));
      }

      // Grade Student 2's submission
      const gradeRes = await fetch(`${baseUrl}/tasks/${activeTask.id}/submissions/${s2SubId}/grade`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${tokens.doctor1}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          score: 85,
          feedback: 'Well done',
          expectedSubmittedAt: s2Res.body.data.submittedAt,
        }),
      });
      assert.strictEqual(gradeRes.status, 200, 'Grade must succeed');

      // 3. Resubmit after grading -> 409 Conflict
      const resubmitGradedRes = await submitMultipartTask(activeTask.id, tokens.student2, {
        fileBuffer: VALID_PNG_BUFFER,
        filename: 's2_resubmit.png',
        contentType: 'image/png',
      });
      assert.strictEqual(resubmitGradedRes.status, 409, 'Resubmit after grading must return 409 Conflict');

      // 4. Parallel double submit with fresh task & fixture student
      const tempTask = await prisma.task.create({
        data: {
          title: `ConcurrentTask_${SUFFIX}`,
          description: 'Testing concurrency',
          courseId: course1.id,
          doctorId: doctor1.id,
          dueDate: futureDate,
          maxScore: 100,
          academicYear: 2026,
          semester: 1,
        },
      });
      tracked.taskIds.push(tempTask.id);

      const parallelResults = await Promise.all([
        submitMultipartTask(tempTask.id, tokens.student1, {
          fileBuffer: VALID_PDF_BUFFER,
          filename: 'parallel1.pdf',
          contentType: 'application/pdf',
        }),
        submitMultipartTask(tempTask.id, tokens.student1, {
          fileBuffer: VALID_PDF_BUFFER,
          filename: 'parallel2.pdf',
          contentType: 'application/pdf',
        }),
      ]);

      const statuses = parallelResults.map((r) => r.status).sort();
      assert.deepStrictEqual(statuses, [201, 409], 'Parallel double submit must result in exactly one 201 and one 409');

      // Verify exactly one row in DB
      const subRows = await prisma.taskSubmission.findMany({
        where: { taskId: tempTask.id, studentId: student1.id },
      });
      assert.strictEqual(subRows.length, 1, 'Exactly one submission row must exist');
      tracked.submissionIds.push(subRows[0].id);
      if (subRows[0].storageKey) {
        tracked.createdDiskFiles.push(path.join(uploadsTaskDir, subRows[0].storageKey));
      }
    });

    // -------------------------------------------------------------------------
    // TEST SUITE: S-C No Orphan Files on Rejection & Old File Cleaned on Resubmit
    // -------------------------------------------------------------------------
    await t.test('S-C: No orphan file on rejection (validation, auth, conflict) and old file removed on resubmit', async () => {
      const filesBefore = new Set(fs.readdirSync(uploadsTaskDir));

      // 1. Rejection due to validation (exe content in pdf)
      const fakePdf = Buffer.from('MZ\x90\x00\x03\x00\x00\x00This is a fake PE executable binary disguised as pdf', 'binary');
      const rejRes = await submitMultipartTask(activeTask.id, tokens.student1, {
        fileBuffer: fakePdf,
        filename: 'fake.pdf',
        contentType: 'application/pdf',
      });
      assert.strictEqual(rejRes.status, 400);

      const filesAfterRej = new Set(fs.readdirSync(uploadsTaskDir));
      const leakedFiles = [...filesAfterRej].filter((f) => !filesBefore.has(f));
      assert.deepStrictEqual(leakedFiles, [], 'No orphan file should leak on validation failure');

      // 2. Resubmit on Student 1 replaces old file cleanly
      const subBeforeResubmit = await prisma.taskSubmission.findUnique({
        where: { taskId_studentId: { taskId: activeTask.id, studentId: student1.id } },
      });
      assert.ok(subBeforeResubmit?.storageKey);
      const oldStorageKey = subBeforeResubmit.storageKey;
      const oldFilePath = path.join(uploadsTaskDir, oldStorageKey);
      assert.strictEqual(fs.existsSync(oldFilePath), true, 'Old file must exist before resubmit');

      // Student 1 resubmits with PNG file
      const resubmitRes = await submitMultipartTask(activeTask.id, tokens.student1, {
        fileBuffer: VALID_PNG_BUFFER,
        filename: 'new_resubmission.png',
        contentType: 'image/png',
      });
      assert.strictEqual(resubmitRes.status, 201, `Resubmit should succeed. Body: ${JSON.stringify(resubmitRes.body)}`);

      const subAfterResubmit = await prisma.taskSubmission.findUnique({
        where: { id: subBeforeResubmit.id },
      });
      assert.ok(subAfterResubmit?.storageKey);
      assert.notStrictEqual(subAfterResubmit.storageKey, oldStorageKey, 'Storage key must be updated');
      const newFilePath = path.join(uploadsTaskDir, subAfterResubmit.storageKey);
      tracked.createdDiskFiles.push(newFilePath);

      // Verify old file unlinked from disk, new file exists
      assert.strictEqual(fs.existsSync(oldFilePath), false, 'Old file must be deleted from disk after resubmit commit');
      assert.strictEqual(fs.existsSync(newFilePath), true, 'New file must exist on disk after resubmit commit');
    });

    // -------------------------------------------------------------------------
    // TEST SUITE: S-D File Validation, Size Limit, Extensions, Magic Bytes, Name
    // -------------------------------------------------------------------------
    await t.test('S-D: Size ceiling constant, extension allowlist, magic bytes, double extension & null bytes rejected, server-derived fileUrl', async () => {
      // 1. Oversized file (> 25MB ceiling)
      // We don't allocate 26MB in memory, we test limit with 26MB stream or chunk
      const oversizedBuffer = Buffer.alloc(26 * 1024 * 1024, 0x41);
      const oversizedRes = await submitMultipartTask(activeTask.id, tokens.student1, {
        fileBuffer: oversizedBuffer,
        filename: 'oversized.pdf',
        contentType: 'application/pdf',
      });
      assert.ok(oversizedRes.status === 400 || oversizedRes.status === 413, `Oversized upload must return 400/413, got ${oversizedRes.status}`);

      // 2. Disallowed extension (.exe)
      const exeRes = await submitMultipartTask(activeTask.id, tokens.student1, {
        fileBuffer: Buffer.from('MZ...'),
        filename: 'malware.exe',
        contentType: 'application/x-msdownload',
      });
      assert.strictEqual(exeRes.status, 400, 'Executable file must be rejected with 400');

      // 3. Double extension (e.g. script.php.pdf)
      const doubleExtRes = await submitMultipartTask(activeTask.id, tokens.student1, {
        fileBuffer: VALID_PDF_BUFFER,
        filename: 'script.php.pdf',
        contentType: 'application/pdf',
      });
      assert.strictEqual(doubleExtRes.status, 400, 'Double extension must be rejected with 400');

      // 4. Null byte in filename
      const nullByteRes = await submitMultipartTask(activeTask.id, tokens.student1, {
        fileBuffer: VALID_PDF_BUFFER,
        filename: 'exploit\x00.pdf',
        contentType: 'application/pdf',
      });
      assert.strictEqual(nullByteRes.status, 400, 'Null byte in filename must be rejected with 400');

      // 5. Client provides fileUrl in body alongside upload -> body fileUrl is ignored, stored fileUrl is server-derived
      const tamperRes = await submitMultipartTask(activeTask.id, tokens.student1, {
        fileBuffer: VALID_PDF_BUFFER,
        filename: 'legit.pdf',
        contentType: 'application/pdf',
        bodyFileUrl: 'https://evil.com/malicious.pdf',
      });
      assert.strictEqual(tamperRes.status, 201);
      const tamperedRow = await prisma.taskSubmission.findUnique({
        where: { id: tamperRes.body.data.id },
      });
      assert.notStrictEqual(tamperedRow?.fileUrl, 'https://evil.com/malicious.pdf', 'fileUrl must not be taken from request body when file uploaded');
      assert.ok(tamperedRow?.fileUrl?.startsWith('/api/tasks/'), `fileUrl must be server-derived, got ${tamperedRow?.fileUrl}`);
      if (tamperedRow?.storageKey) {
        tracked.createdDiskFiles.push(path.join(uploadsTaskDir, tamperedRow.storageKey));
      }
    });

    // -------------------------------------------------------------------------
    // TEST SUITE: S-E Path Traversal Defense on Download & Delete
    // -------------------------------------------------------------------------
    await t.test('S-E: Path traversal and sibling directory prefixes rejected on download and delete via path.resolve + path.relative guard', async () => {
      const studentSub = await prisma.taskSubmission.findUnique({
        where: { taskId_studentId: { taskId: activeTask.id, studentId: student1.id } },
      });
      assert.ok(studentSub);

      // Attempt download with parent traversal in submission id or route
      const traversalRes = await fetch(`${baseUrl}/tasks/${activeTask.id}/submissions/..%2F..%2Fetc%2Fpasswd/download`, {
        headers: { Authorization: `Bearer ${tokens.student1}` },
      });
      assert.ok(
        traversalRes.status === 400 || traversalRes.status === 404 || traversalRes.status === 422,
        `Traversal must return 400/404/422, got ${traversalRes.status}`
      );
    });

    // -------------------------------------------------------------------------
    // TEST SUITE: S-F Download Authorization Matrix (Student, Doctor, TA OD-74, Admins)
    // -------------------------------------------------------------------------
    await t.test('S-F: Download authorization: owning student, course doctor, in-scope TA (OD-74 group scope), in-scope admins; attachment headers', async () => {
      // Find Student 1's submission (Student 1 is in Group A)
      const sub1 = await prisma.taskSubmission.findUnique({
        where: { taskId_studentId: { taskId: activeTask.id, studentId: student1.id } },
      });
      assert.ok(sub1);

      // 1. Owning student -> 200 with Content-Disposition: attachment & nosniff
      const ownRes = await downloadSubmission(activeTask.id, sub1.id, tokens.student1);
      assert.strictEqual(ownRes.status, 200, 'Owning student must be able to download');
      assert.ok(ownRes.contentDisposition?.includes('attachment'), 'Content-Disposition must be attachment');
      assert.strictEqual(ownRes.contentTypeOptions, 'nosniff', 'nosniff header must be set');
      assert.ok(Buffer.isBuffer(ownRes.body));

      // 2. Another student (Student 2) -> 403
      const otherStuRes = await downloadSubmission(activeTask.id, sub1.id, tokens.student2);
      assert.strictEqual(otherStuRes.status, 403, 'Other student must be rejected with 403');

      // 3. Course Doctor 1 -> 200
      const docRes = await downloadSubmission(activeTask.id, sub1.id, tokens.doctor1);
      assert.strictEqual(docRes.status, 200, 'Course doctor must be able to download');

      // 4. Other Doctor 2 (not assigned) -> 403
      const otherDocRes = await downloadSubmission(activeTask.id, sub1.id, tokens.doctor2);
      assert.strictEqual(otherDocRes.status, 403, 'Unassigned doctor must be rejected with 403');

      // 5. TA1 (assigned to Course1 for Group A) downloading Student 1 (Group A) -> 200
      const ta1Res = await downloadSubmission(activeTask.id, sub1.id, tokens.ta1);
      assert.strictEqual(ta1Res.status, 200, 'In-scope TA with matching group must be able to download');

      // 6. TA2 (assigned to Course1 for Group B only) downloading Student 1 (Group A) -> 403 (OD-74)
      const ta2Res = await downloadSubmission(activeTask.id, sub1.id, tokens.ta2);
      assert.strictEqual(ta2Res.status, 403, 'In-scope TA with non-matching group must be rejected with 403 (OD-74)');

      // 7. Unassigned TA -> 403
      const unassignedTaRes = await downloadSubmission(activeTask.id, sub1.id, tokens.taUnassigned);
      assert.strictEqual(unassignedTaRes.status, 403, 'Unassigned TA must be rejected with 403');

      // 8. SuperAdmin -> 200
      const superRes = await downloadSubmission(activeTask.id, sub1.id, tokens.superAdmin);
      assert.strictEqual(superRes.status, 200, 'SuperAdmin must be able to download');

      // 9. CollegeAdmin (own college) -> 200
      const colRes = await downloadSubmission(activeTask.id, sub1.id, tokens.colAdmin);
      assert.strictEqual(colRes.status, 200, 'CollegeAdmin in scope must be able to download');

      // 10. CollegeAdmin (other college) -> 403
      const otherColRes = await downloadSubmission(activeTask.id, sub1.id, tokens.otherColAdmin);
      assert.strictEqual(otherColRes.status, 403, 'CollegeAdmin out of scope must be rejected with 403');

      // 11. DepartmentAdmin (own department) -> 200
      const deptRes = await downloadSubmission(activeTask.id, sub1.id, tokens.deptAdmin);
      assert.strictEqual(deptRes.status, 200, 'DeptAdmin in scope must be able to download');

      // 12. DepartmentAdmin (other department) -> 403
      const otherDeptRes = await downloadSubmission(activeTask.id, sub1.id, tokens.otherDeptAdmin);
      assert.strictEqual(otherDeptRes.status, 403, 'DeptAdmin out of scope must be rejected with 403');

      // 13. Unauthenticated -> 401
      const unauthRes = await downloadSubmission(activeTask.id, sub1.id);
      assert.strictEqual(unauthRes.status, 401, 'Unauthenticated request must be rejected with 401');

      // 14. Folder is not served statically
      if (sub1.storageKey) {
        const staticRes = await fetch(`${baseUrl.replace('/api', '')}/uploads/tasks/${sub1.storageKey}`);
        assert.strictEqual(staticRes.status, 404, 'uploads/tasks directory must NOT be served statically');
      }
    });

    // -------------------------------------------------------------------------
    // TEST SUITE: S-F2 ADMIN May Download Any Submission (OD-118)
    // -------------------------------------------------------------------------
    await t.test('S-F2: ADMIN may download any submission', async () => {
      const adminUser = await createTestUser('ADMIN', dept1.id);
      const adminToken = generateAccessToken(adminUser.id);
      const sub1 = await prisma.taskSubmission.findUnique({
        where: { taskId_studentId: { taskId: activeTask.id, studentId: student1.id } },
      });
      assert.ok(sub1);
      const adminRes = await downloadSubmission(activeTask.id, sub1.id, adminToken);
      assert.strictEqual(adminRes.status, 200, 'ADMIN must be able to download any submission (OD-118)');
      assert.ok(adminRes.contentDisposition?.includes('attachment'), 'Content-Disposition must be attachment');
      assert.strictEqual(adminRes.contentTypeOptions, 'nosniff', 'nosniff header must be set');
      assert.ok(Buffer.isBuffer(adminRes.body));
    });

    // -------------------------------------------------------------------------
    // TEST SUITE: S-G Link Submitted Alongside is HTTPS Only & Text Guards
    // -------------------------------------------------------------------------
    await t.test('S-G: Link alongside file is https-only (T4 rules); text fields use existing guard; old JSON link-only submit preserved', async () => {
      // 1. Non-https link alongside file upload -> 400 ValidationError
      const badLinkRes = await submitMultipartTask(activeTask.id, tokens.student1, {
        fileBuffer: VALID_PDF_BUFFER,
        filename: 'linktest.pdf',
        contentType: 'application/pdf',
        linkUrl: 'http://docs.google.com/document/d/1234',
      });
      assert.ok(
        badLinkRes.status === 400 || badLinkRes.status === 422,
        `Non-HTTPS link alongside file must be rejected with 400/422, got ${badLinkRes.status}`
      );

      // 2. Unapproved domain link -> 400/422 ValidationError
      const unapprovedDomainRes = await submitMultipartTask(activeTask.id, tokens.student1, {
        fileBuffer: VALID_PDF_BUFFER,
        filename: 'linktest2.pdf',
        contentType: 'application/pdf',
        linkUrl: 'https://evil-unapproved-site.com/doc',
      });
      assert.ok(
        unapprovedDomainRes.status === 400 || unapprovedDomainRes.status === 422,
        `Unapproved domain link must be rejected with 400/422, got ${unapprovedDomainRes.status}`
      );

      // 3. Notes containing control characters or formula injection -> rejected by validateGuardedText
      const maliciousNotesRes = await submitMultipartTask(activeTask.id, tokens.student1, {
        fileBuffer: VALID_PDF_BUFFER,
        filename: 'notestest.pdf',
        contentType: 'application/pdf',
        notes: '<script>alert(1)</script>',
      });
      assert.ok(
        maliciousNotesRes.status === 400 || maliciousNotesRes.status === 422,
        `Malicious notes must be rejected with 400/422, got ${maliciousNotesRes.status}`
      );

      // 4. Old link-only JSON submit stays accepted
      const tempTaskJson = await prisma.task.create({
        data: {
          title: `JsonSubmitTask_${SUFFIX}`,
          description: 'Testing JSON submission backward compatibility',
          courseId: course1.id,
          doctorId: doctor1.id,
          dueDate: futureDate,
          maxScore: 100,
          academicYear: 2026,
          semester: 1,
        },
      });
      tracked.taskIds.push(tempTaskJson.id);

      const jsonRes = await submitJsonTask(tempTaskJson.id, tokens.student1, {
        fileUrl: 'https://drive.google.com/file/d/test-id-123/view',
        notes: 'Submitted via Google Drive link',
      });
      assert.strictEqual(jsonRes.status, 201, `Old JSON link-only submit must be accepted. Body: ${JSON.stringify(jsonRes.body)}`);
      assert.strictEqual(jsonRes.body.success, true);
      tracked.submissionIds.push(jsonRes.body.data.id);
    });

    // -------------------------------------------------------------------------
    // TEST SUITE: S-H Audit Log Row for Upload/Replace/Download
    // -------------------------------------------------------------------------
    await t.test('S-H: AuditLog records upload, resubmit, and download with correct request context and no secrets', async () => {
      const auditRows = await prisma.auditLog.findMany({
        where: {
          entity: 'TaskSubmission',
        },
        orderBy: { timestamp: 'desc' },
        take: 20,
      });

      assert.ok(auditRows.length > 0, 'AuditLog entries must exist for TaskSubmission');

      for (const row of auditRows) {
        const serialized = JSON.stringify(row);
        assert.ok(!serialized.includes('password'), 'AuditLog must not contain password field');
        assert.ok(!serialized.includes('$2a$'), 'AuditLog must not contain bcrypt hashes');
      }
    });

    // -------------------------------------------------------------------------
    // TEST SUITE: S-I Additive Schema Verification
    // -------------------------------------------------------------------------
    await t.test('S-I: Schema columns exist, nullable, no cascade on submission rows', async () => {
      // Introspect TaskSubmission columns via raw query
      const columns: Array<{ column_name: string; is_nullable: string; data_type: string }> =
        await prisma.$queryRaw`
          SELECT column_name, is_nullable, data_type
          FROM information_schema.columns
          WHERE table_name = 'TaskSubmission'
          ORDER BY column_name;
        `;

      const colMap = new Map(columns.map((c) => [c.column_name, c]));
      assert.ok(colMap.has('fileName'), 'fileName column must exist');
      assert.ok(colMap.has('fileSize'), 'fileSize column must exist');
      assert.ok(colMap.has('fileType'), 'fileType column must exist');
      assert.ok(colMap.has('fileHash'), 'fileHash column must exist');
      assert.ok(colMap.has('storageKey'), 'storageKey column must exist');

      assert.strictEqual(colMap.get('fileName')?.is_nullable, 'YES', 'fileName must be nullable');
      assert.strictEqual(colMap.get('fileSize')?.is_nullable, 'YES', 'fileSize must be nullable');
      assert.strictEqual(colMap.get('fileType')?.is_nullable, 'YES', 'fileType must be nullable');
      assert.strictEqual(colMap.get('fileHash')?.is_nullable, 'YES', 'fileHash must be nullable');
      assert.strictEqual(colMap.get('storageKey')?.is_nullable, 'YES', 'storageKey must be nullable');
    });

    // -------------------------------------------------------------------------
    // TEST SUITE: S-J M-336 Multi-dot filenames with safe segments accepted, dangerous extensions rejected
    // -------------------------------------------------------------------------
    await t.test('S-J: Multi-dot filenames with safe segments accepted, dangerous extensions and malformed names rejected, no disk orphans', async () => {
      const taskMultiDot = await prisma.task.create({
        data: {
          title: `MultiDotTask_${SUFFIX}`,
          description: 'Testing multi-dot filename rules',
          courseId: course1.id,
          doctorId: doctor1.id,
          dueDate: futureDate,
          maxScore: 100,
          academicYear: 2026,
          semester: 1,
        },
      });
      tracked.taskIds.push(taskMultiDot.id);

      // 1. report.v2.pdf must be 201 (currently 400 under double extension check)
      const validMultiDotRes = await submitMultipartTask(taskMultiDot.id, tokens.student1, {
        fileBuffer: VALID_PDF_BUFFER,
        filename: 'report.v2.pdf',
        contentType: 'application/pdf',
      });
      assert.strictEqual(
        validMultiDotRes.status,
        201,
        `report.v2.pdf must be accepted with 201, got ${validMultiDotRes.status}`
      );

      // Verify DB row
      const subRow = await prisma.taskSubmission.findUnique({
        where: { id: validMultiDotRes.body.data.id },
      });
      assert.ok(subRow, 'Submission row must be created');
      assert.strictEqual(subRow.fileName, 'report.v2.pdf');
      assert.ok(subRow.storageKey, 'Storage key must be present');
      assert.ok(fs.existsSync(path.join(uploadsTaskDir, subRow.storageKey)), 'Uploaded file must exist on disk');

      // 2. Dangerous non-final dot-segments must stay 400
      const taskDangerous = await prisma.task.create({
        data: {
          title: `DangerousTask_${SUFFIX}`,
          description: 'Testing dangerous extension rejection',
          courseId: course1.id,
          doctorId: doctor1.id,
          dueDate: futureDate,
          maxScore: 100,
          academicYear: 2026,
          semester: 1,
        },
      });
      tracked.taskIds.push(taskDangerous.id);

      const beforeFiles = fs.existsSync(uploadsTaskDir) ? fs.readdirSync(uploadsTaskDir) : [];

      const exeRes = await submitMultipartTask(taskDangerous.id, tokens.student1, {
        fileBuffer: VALID_PDF_BUFFER,
        filename: 'evil.exe.pdf',
        contentType: 'application/pdf',
      });
      assert.strictEqual(exeRes.status, 400, `evil.exe.pdf must be rejected with 400, got ${exeRes.status}`);

      const phpRes = await submitMultipartTask(taskDangerous.id, tokens.student1, {
        fileBuffer: VALID_PNG_BUFFER,
        filename: 'x.php.png',
        contentType: 'image/png',
      });
      assert.strictEqual(phpRes.status, 400, `x.php.png must be rejected with 400, got ${phpRes.status}`);

      const htmlRes = await submitMultipartTask(taskDangerous.id, tokens.student1, {
        fileBuffer: VALID_PDF_BUFFER,
        filename: 'a.HTML.pdf',
        contentType: 'application/pdf',
      });
      assert.strictEqual(htmlRes.status, 400, `a.HTML.pdf must be rejected with 400, got ${htmlRes.status}`);

      // 3. Names that are only dots or end with a dot stay rejected (400)
      const onlyDotsRes = await submitMultipartTask(taskDangerous.id, tokens.student1, {
        fileBuffer: VALID_PDF_BUFFER,
        filename: '....',
        contentType: 'application/pdf',
      });
      assert.strictEqual(onlyDotsRes.status, 400, `Only dots must be rejected with 400, got ${onlyDotsRes.status}`);

      const dotEndRes = await submitMultipartTask(taskDangerous.id, tokens.student1, {
        fileBuffer: VALID_PDF_BUFFER,
        filename: 'report.pdf.',
        contentType: 'application/pdf',
      });
      assert.strictEqual(dotEndRes.status, 400, `Filename ending with dot must be rejected with 400, got ${dotEndRes.status}`);

      const dotsOnlyExtRes = await submitMultipartTask(taskDangerous.id, tokens.student1, {
        fileBuffer: VALID_PDF_BUFFER,
        filename: '...pdf',
        contentType: 'application/pdf',
      });
      assert.strictEqual(dotsOnlyExtRes.status, 400, `...pdf must be rejected with 400, got ${dotsOnlyExtRes.status}`);

      // 4. Verify no file left on disk after any rejection
      const afterFiles = fs.existsSync(uploadsTaskDir) ? fs.readdirSync(uploadsTaskDir) : [];
      assert.deepStrictEqual(
        afterFiles,
        beforeFiles,
        'No orphan file must be left on disk after any rejected upload'
      );
    });

    // -------------------------------------------------------------------------
    // TEST SUITE: S-K M-338 UTF-8 Arabic fileName storage & RFC 5987 Content-Disposition
    // -------------------------------------------------------------------------
    await t.test('S-K: UTF-8 Arabic fileName stored in DB, RFC 5987 Content-Disposition, no CR/LF header injection', async () => {
      const taskArabic = await prisma.task.create({
        data: {
          title: `ArabicTask_${SUFFIX}`,
          description: 'Testing Arabic filename and RFC 5987 headers',
          courseId: course1.id,
          doctorId: doctor1.id,
          dueDate: futureDate,
          maxScore: 100,
          academicYear: 2026,
          semester: 1,
        },
      });
      tracked.taskIds.push(taskArabic.id);

      // 1. Upload file with Arabic name 'تقرير.pdf'
      const arabicUploadRes = await submitMultipartTask(taskArabic.id, tokens.student1, {
        fileBuffer: VALID_PDF_BUFFER,
        filename: 'تقرير.pdf',
        contentType: 'application/pdf',
      });
      assert.strictEqual(arabicUploadRes.status, 201, `Arabic upload must return 201, got ${arabicUploadRes.status}`);

      const arabicSub = await prisma.taskSubmission.findUnique({
        where: { id: arabicUploadRes.body.data.id },
      });
      assert.ok(arabicSub, 'Arabic submission record must exist in DB');
      // Must be stored as the original display name, Unicode NFC
      assert.strictEqual(
        arabicSub.fileName,
        'تقرير.pdf',
        `DB fileName must equal 'تقرير.pdf', got '${arabicSub.fileName}'`
      );
      // storageKey stays ASCII and server-generated
      assert.ok(
        /^[a-zA-Z0-9._-]+$/.test(arabicSub.storageKey || ''),
        `storageKey must be ASCII server-generated, got ${arabicSub.storageKey}`
      );

      // Download Content-Disposition header check
      const arabicDownload = await downloadSubmission(taskArabic.id, arabicSub.id, tokens.student1);
      assert.strictEqual(arabicDownload.status, 200);
      const dispHeader = arabicDownload.contentDisposition || '';
      assert.ok(dispHeader.startsWith('attachment;'), `Header must start with attachment;, got ${dispHeader}`);
      // Must contain ASCII fallback
      assert.ok(
        dispHeader.includes('filename="______.pdf"') || dispHeader.includes('filename="'),
        `Header must contain filename="<ASCII fallback>", got ${dispHeader}`
      );
      // Must contain RFC 5987 UTF-8 encoding
      assert.ok(
        dispHeader.includes("filename*=UTF-8''%D8%AA%D9%82%D8%B1%D9%8A%D8%B1.pdf"),
        `Header must contain RFC 5987 encoding filename*=UTF-8''%D8%AA%D9%82%D8%B1%D9%8A%D8%B1.pdf, got ${dispHeader}`
      );

      // 2. Upload file with quotes plus CR/LF: must yield header with no CR/LF and no raw quote (no 500, no injection)
      const taskQuoteCrLf = await prisma.task.create({
        data: {
          title: `QuoteCrLfTask_${SUFFIX}`,
          description: 'Testing quote and CRLF header injection defense',
          courseId: course1.id,
          doctorId: doctor1.id,
          dueDate: futureDate,
          maxScore: 100,
          academicYear: 2026,
          semester: 1,
        },
      });
      tracked.taskIds.push(taskQuoteCrLf.id);

      const quoteCrLfUploadRes = await submitMultipartTask(taskQuoteCrLf.id, tokens.student1, {
        fileBuffer: VALID_PDF_BUFFER,
        filename: 'report"evil\r\nname.pdf',
        contentType: 'application/pdf',
      });
      assert.strictEqual(quoteCrLfUploadRes.status, 201, `Quote/CRLF upload must succeed with 201, got ${quoteCrLfUploadRes.status}`);

      const quoteCrLfSub = await prisma.taskSubmission.findUnique({
        where: { id: quoteCrLfUploadRes.body.data.id },
      });
      assert.ok(quoteCrLfSub, 'Quote/CRLF submission record must exist');
      // Quotes and CR/LF removed from stored fileName
      assert.ok(!quoteCrLfSub.fileName?.includes('"'), 'Stored fileName must not contain quotes');
      assert.ok(!quoteCrLfSub.fileName?.includes('\r'), 'Stored fileName must not contain CR');
      assert.ok(!quoteCrLfSub.fileName?.includes('\n'), 'Stored fileName must not contain LF');

      const quoteCrLfDownload = await downloadSubmission(taskQuoteCrLf.id, quoteCrLfSub.id, tokens.student1);
      assert.strictEqual(quoteCrLfDownload.status, 200, `Download must return 200 without 500 error, got ${quoteCrLfDownload.status}`);
      const quoteDisp = quoteCrLfDownload.contentDisposition || '';
      assert.ok(!quoteDisp.includes('\r'), 'Content-Disposition must not contain CR');
      assert.ok(!quoteDisp.includes('\n'), 'Content-Disposition must not contain LF');
      // No raw extra quote inside the quoted filename string
      const filenameMatch = quoteDisp.match(/filename="([^"]*)"/);
      assert.ok(filenameMatch, 'Must contain a validly closed filename="..." attribute');

      // 3. Old ASCII case still works
      const taskAscii = await prisma.task.create({
        data: {
          title: `AsciiTask_${SUFFIX}`,
          description: 'Testing standard ASCII filename download',
          courseId: course1.id,
          doctorId: doctor1.id,
          dueDate: futureDate,
          maxScore: 100,
          academicYear: 2026,
          semester: 1,
        },
      });
      tracked.taskIds.push(taskAscii.id);

      const asciiUploadRes = await submitMultipartTask(taskAscii.id, tokens.student1, {
        fileBuffer: VALID_PDF_BUFFER,
        filename: 'homework_final.pdf',
        contentType: 'application/pdf',
      });
      assert.strictEqual(asciiUploadRes.status, 201);
      const asciiSub = await prisma.taskSubmission.findUnique({
        where: { id: asciiUploadRes.body.data.id },
      });
      assert.ok(asciiSub);
      assert.strictEqual(asciiSub.fileName, 'homework_final.pdf');

      const asciiDownload = await downloadSubmission(taskAscii.id, asciiSub.id, tokens.student1);
      assert.strictEqual(asciiDownload.status, 200);
      assert.ok(
        asciiDownload.contentDisposition?.includes('filename="homework_final.pdf"'),
        `ASCII download must include filename="homework_final.pdf", got ${asciiDownload.contentDisposition}`
      );
      assert.ok(
        asciiDownload.contentDisposition?.includes("filename*=UTF-8''homework_final.pdf"),
        `ASCII download must include filename*=UTF-8''homework_final.pdf, got ${asciiDownload.contentDisposition}`
      );
    });

  } finally {
    // Teardown HTTP server
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
    }

    // Teardown created disk files
    for (const filePath of tracked.createdDiskFiles) {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch {
        // ignore
      }
    }

    try {
      if (fs.existsSync(uploadsTaskDir) && fs.readdirSync(uploadsTaskDir).length === 0) {
        fs.rmdirSync(uploadsTaskDir);
      }
    } catch {
      // ignore
    }

    // Teardown database entities in reverse topological order
    try {
      if (tracked.submissionIds.length > 0) {
        await prisma.taskSubmission.deleteMany({
          where: { id: { in: tracked.submissionIds } },
        });
      }
      if (tracked.taskIds.length > 0) {
        await prisma.task.deleteMany({
          where: { id: { in: tracked.taskIds } },
        });
      }
      if (tracked.slotIds.length > 0) {
        await prisma.scheduleSlot.deleteMany({
          where: { id: { in: tracked.slotIds } },
        });
      }
      if (tracked.enrollmentIds.length > 0) {
        await prisma.enrollment.deleteMany({
          where: { id: { in: tracked.enrollmentIds } },
        });
      }
      if (tracked.studentIds.length > 0) {
        await prisma.student.deleteMany({
          where: { id: { in: tracked.studentIds } },
        });
      }
      if (tracked.studentGroupIds.length > 0) {
        await prisma.studentGroup.deleteMany({
          where: { id: { in: tracked.studentGroupIds } },
        });
      }
      if (tracked.taIds.length > 0) {
        await prisma.teachingAssistant.deleteMany({
          where: { id: { in: tracked.taIds } },
        });
      }
      if (tracked.doctorIds.length > 0) {
        await prisma.doctor.deleteMany({
          where: { id: { in: tracked.doctorIds } },
        });
      }
      if (tracked.courseIds.length > 0) {
        await prisma.course.deleteMany({
          where: { id: { in: tracked.courseIds } },
        });
      }
      if (tracked.userIds.length > 0) {
        await prisma.user.deleteMany({
          where: { id: { in: tracked.userIds } },
        });
      }
      if (tracked.departmentIds.length > 0) {
        await prisma.department.deleteMany({
          where: { id: { in: tracked.departmentIds } },
        });
      }
      if (tracked.collegeIds.length > 0) {
        await prisma.college.deleteMany({
          where: { id: { in: tracked.collegeIds } },
        });
      }
    } catch (cleanupErr) {
      console.error('Error during test teardown:', cleanupErr);
    }
  }
});
