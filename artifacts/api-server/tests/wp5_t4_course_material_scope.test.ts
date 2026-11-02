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

test('WP5-T4: Course, material, and TA scope hardening & threat model verification', async (t) => {
  const SUFFIX = `t4_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  let server: http.Server | null = null;
  let baseUrl = '';

  // Tracking registries for strict hermetic teardown in reverse topological order
  const tracked = {
    createdDiskFiles: [] as string[],
    materialIds: [] as number[],
    taskIds: [] as number[],
    enrollmentIds: [] as number[],
    slotIds: [] as number[],
    approvalIds: [] as number[],
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

    const dept1 = await prisma.department.create({
      data: { name: `Dept1_${SUFFIX}`, collegeId: college.id },
    });
    tracked.departmentIds.push(dept1.id);

    const dept2 = await prisma.department.create({
      data: { name: `Dept2_${SUFFIX}`, collegeId: college.id },
    });
    tracked.departmentIds.push(dept2.id);

    // Helpers to create user and entity
    async function createTestUser(role: string, departmentId: number) {
      const passwordHash = await bcrypt.hash(crypto.randomUUID() + '!Aa1', 4);
      const user = await prisma.user.create({
        data: {
          email: `${role.toLowerCase()}_${crypto.randomUUID().slice(0, 8)}_${SUFFIX}@example.test`,
          password: passwordHash,
          role,
          departmentId,
          collegeId: college.id,
          tokenVersion: 0,
          isActive: true,
        },
      });
      tracked.userIds.push(user.id);
      return user;
    }

    async function createTestDoctor(departmentId: number) {
      const user = await createTestUser('DOCTOR', departmentId);
      const doctor = await prisma.doctor.create({
        data: {
          userId: user.id,
          firstName: 'Doc',
          lastName: SUFFIX,
          departmentId,
        },
      });
      tracked.doctorIds.push(doctor.id);
      return { user, doctor, token: generateAccessToken(user.id, 0) };
    }

    async function createTestTA(departmentId: number) {
      const user = await createTestUser('TEACHING_ASSISTANT', departmentId);
      const ta = await prisma.teachingAssistant.create({
        data: {
          userId: user.id,
          employeeId: `EMP_${crypto.randomUUID().slice(0, 8)}`,
          firstName: 'TA',
          lastName: SUFFIX,
          departmentId,
        },
      });
      tracked.taIds.push(ta.id);
      return { user, ta, token: generateAccessToken(user.id, 0) };
    }

    async function createTestStudent(departmentId: number, year = 1) {
      const user = await createTestUser('STUDENT', departmentId);
      const student = await prisma.student.create({
        data: {
          userId: user.id,
          studentId: `STU_${crypto.randomUUID().slice(0, 8)}`,
          firstName: 'Student',
          lastName: SUFFIX,
          year,
          departmentId,
          isActive: true,
        },
      });
      tracked.studentIds.push(student.id);
      return { user, student, token: generateAccessToken(user.id, 0) };
    }

    // =========================================================================
    // Threat T-A: TA read scope
    // A TA must NOT read draft courses, unpublished materials,
    // or student rosters of courses they are NOT assigned to
    // (requires non-archived slot AND approved TACrossDepartmentApproval if cross-dept).
    // =========================================================================
    await t.test('T-A: TA read scope - unassigned/unapproved TA denied draft course details and roster; approved TA allowed', async () => {
      // Course in Dept 2, draft (isPublished: false)
      const courseTA = await prisma.course.create({
        data: {
          name: `Course_TA_${SUFFIX}`,
          courseCode: `CTA_${SUFFIX.slice(-6).toUpperCase()}`,
          credits: 3,
          year: 1,
          semester: 1,
          isPublished: false,
          departmentId: dept2.id,
        },
      });
      tracked.courseIds.push(courseTA.id);

      const doc = await createTestDoctor(dept2.id);
      const matTA = await prisma.courseMaterial.create({
        data: {
          title: `Confidential Notes ${SUFFIX}`,
          type: 'LECTURE',
          fileUrl: 'https://example.test/confidential.pdf',
          isPublished: false,
          courseId: courseTA.id,
          uploadedById: doc.user.id,
        },
      });
      tracked.materialIds.push(matTA.id);

      const stu = await createTestStudent(dept2.id);
      const enr = await prisma.enrollment.create({
        data: {
          studentId: stu.student.id,
          courseId: courseTA.id,
          semester: 1,
          academicYear: 2026,
          status: 'ENROLLED',
        },
      });
      tracked.enrollmentIds.push(enr.id);

      // TA in Dept 1 (cross-dept) placed in courseTA without approval
      const crossTA = await createTestTA(dept1.id);
      const slotTA = await prisma.scheduleSlot.create({
        data: {
          courseId: courseTA.id,
          teachingAssistantId: crossTA.ta.id,
          dayOfWeek: 'Monday',
          startTime: '08:00',
          endTime: '10:00',
          slotType: 'SECTION',
          isArchived: false,
        },
      });
      tracked.slotIds.push(slotTA.id);

      const revokedApproval = await prisma.tACrossDepartmentApproval.create({
        data: {
          teachingAssistantId: crossTA.ta.id,
          courseId: courseTA.id,
          status: 'REVOKED',
          approvedByUserId: doc.user.id,
          revokedByUserId: doc.user.id,
          revokedAt: new Date(),
        },
      });
      tracked.approvalIds.push(revokedApproval.id);

      // 1. Refused: Unapproved TA attempts GET /courses/:id
      const resRefused = await fetch(`${baseUrl}/courses/${courseTA.id}`, {
        headers: { Authorization: `Bearer ${crossTA.token}` },
      });
      const bodyRefused = await resRefused.json();
      console.log(`[PROOF T-A REFUSED] Status: ${resRefused.status}, Body:`, JSON.stringify(bodyRefused));
      assert.ok(
        [403, 404].includes(resRefused.status),
        `Unapproved TA must be refused course details of course without approved TACrossDepartmentApproval, got ${resRefused.status}`
      );

      // 2. Refused: Unapproved TA attempts GET /courses/:id/roster
      const resRosterRefused = await fetch(`${baseUrl}/courses/${courseTA.id}/roster`, {
        headers: { Authorization: `Bearer ${crossTA.token}` },
      });
      assert.ok(
        [403, 404].includes(resRosterRefused.status),
        `Unapproved TA must be refused course roster, got ${resRosterRefused.status}`
      );

      // 3. Allowed: TA approved for courseTA via approved TACrossDepartmentApproval
      await prisma.tACrossDepartmentApproval.update({
        where: { id: revokedApproval.id },
        data: { status: 'APPROVED', revokedAt: null, revokedByUserId: null },
      });

      const resAllowed = await fetch(`${baseUrl}/courses/${courseTA.id}`, {
        headers: { Authorization: `Bearer ${crossTA.token}` },
      });
      const bodyAllowed = await resAllowed.json();
      console.log(`[PROOF T-A ALLOWED] Status: ${resAllowed.status}, Body:`, JSON.stringify({ success: bodyAllowed.success, courseId: bodyAllowed.data?.id, name: bodyAllowed.data?.name }));
      assert.equal(resAllowed.status, 200, 'Approved assigned TA must be able to view course details');
      assert.equal(bodyAllowed.data?.id, courseTA.id);
    });

    // =========================================================================
    // Threat T-B: fileUrl injection (uploadCourseMaterial)
    // Server derives fileUrl on upload; body fileUrl accepted ONLY as https link.
    // Dangerous schemes, local paths without file upload, or non-https rejected with 400.
    // =========================================================================
    await t.test('T-B: fileUrl injection - body fileUrl with local path or dangerous URI rejected; legitimate https link accepted', async () => {
      const courseTB = await prisma.course.create({
        data: {
          name: `Course_TB_${SUFFIX}`,
          courseCode: `CTB_${SUFFIX.slice(-6).toUpperCase()}`,
          credits: 3,
          year: 1,
          semester: 1,
          isPublished: true,
          departmentId: dept1.id,
        },
      });
      tracked.courseIds.push(courseTB.id);

      const doc = await createTestDoctor(dept1.id);
      const slot = await prisma.scheduleSlot.create({
        data: {
          courseId: courseTB.id,
          doctorId: doc.doctor.id,
          dayOfWeek: 'Monday',
          startTime: '09:00',
          endTime: '11:00',
          slotType: 'LECTURE',
          isArchived: false,
        },
      });
      tracked.slotIds.push(slot.id);

      // 1. Refused: Injected local path in JSON body without file upload
      const resLocal = await fetch(`${baseUrl}/courses/${courseTB.id}/materials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${doc.token}`,
        },
        body: JSON.stringify({
          title: 'Arbitrary Local Path',
          type: 'LECTURE',
          fileUrl: '/uploads/materials/confidential_exam.pdf',
        }),
      });
      const bodyLocal = await resLocal.json();
      console.log(`[PROOF T-B REFUSED] Status: ${resLocal.status}, Body:`, JSON.stringify(bodyLocal));
      assert.equal(
        resLocal.status,
        400,
        `Body fileUrl pointing to /uploads/materials/ must be rejected with 400, got ${resLocal.status}`
      );

      // 2. Refused: Injected javascript: URL
      const resJs = await fetch(`${baseUrl}/courses/${courseTB.id}/materials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${doc.token}`,
        },
        body: JSON.stringify({
          title: 'XSS Vector',
          type: 'LECTURE',
          fileUrl: 'javascript:alert(1)',
        }),
      });
      assert.equal(resJs.status, 400, `javascript: fileUrl must be rejected with 400, got ${resJs.status}`);

      // 3. Allowed: Legitimate HTTPS external lecture link
      const resHttps = await fetch(`${baseUrl}/courses/${courseTB.id}/materials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${doc.token}`,
        },
        body: JSON.stringify({
          title: 'Official Lecture Slides',
          description: 'Chapter 1 Slides',
          type: 'LECTURE',
          fileUrl: 'https://cdn.university.test/materials/cs101_ch1.pdf',
        }),
      });
      const bodyHttps = await resHttps.json();
      console.log(`[PROOF T-B ALLOWED] Status: ${resHttps.status}, Body:`, JSON.stringify({ success: bodyHttps.success, id: bodyHttps.data?.id, fileUrl: bodyHttps.data?.fileUrl }));
      assert.equal(resHttps.status, 201, 'Valid HTTPS material link must be created successfully');
      if (bodyHttps.data?.id) {
        tracked.materialIds.push(bodyHttps.data.id);
      }
    });

    // =========================================================================
    // Threat T-C: TA material permissions
    // TA uploads, deletes, and toggles only their OWN TUTORIAL materials.
    // Never uploads LECTURE, never deletes doctor's LECTURE material,
    // never toggles course publication.
    // =========================================================================
    await t.test('T-C: TA material permissions - TA restricted to own TUTORIAL materials and cannot toggle course publication', async () => {
      const courseTC = await prisma.course.create({
        data: {
          name: `Course_TC_${SUFFIX}`,
          courseCode: `CTC_${SUFFIX.slice(-6).toUpperCase()}`,
          credits: 3,
          year: 1,
          semester: 1,
          isPublished: true,
          departmentId: dept1.id,
        },
      });
      tracked.courseIds.push(courseTC.id);

      const doc = await createTestDoctor(dept1.id);
      const ta = await createTestTA(dept1.id);

      const slotDoc = await prisma.scheduleSlot.create({
        data: {
          courseId: courseTC.id,
          doctorId: doc.doctor.id,
          dayOfWeek: 'Monday',
          startTime: '09:00',
          endTime: '11:00',
          slotType: 'LECTURE',
          isArchived: false,
        },
      });
      tracked.slotIds.push(slotDoc.id);

      const slotTA = await prisma.scheduleSlot.create({
        data: {
          courseId: courseTC.id,
          teachingAssistantId: ta.ta.id,
          dayOfWeek: 'Tuesday',
          startTime: '11:00',
          endTime: '13:00',
          slotType: 'SECTION',
          isArchived: false,
        },
      });
      tracked.slotIds.push(slotTA.id);

      const docMat = await prisma.courseMaterial.create({
        data: {
          title: `Professor Lecture ${SUFFIX}`,
          type: 'LECTURE',
          fileUrl: 'https://example.test/prof_lecture.pdf',
          courseId: courseTC.id,
          uploadedById: doc.user.id,
          isPublished: true,
        },
      });
      tracked.materialIds.push(docMat.id);

      // 1. Refused: TA attempts to upload LECTURE material
      const resUploadLecture = await fetch(`${baseUrl}/courses/${courseTC.id}/materials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ta.token}`,
        },
        body: JSON.stringify({
          title: 'TA Lecture Attempt',
          type: 'LECTURE',
          fileUrl: 'https://example.test/ta_lecture.pdf',
        }),
      });
      const bodyUploadLecture = await resUploadLecture.json();
      console.log(`[PROOF T-C REFUSED UPLOAD] Status: ${resUploadLecture.status}, Body:`, JSON.stringify(bodyUploadLecture));
      assert.equal(resUploadLecture.status, 403, 'TA upload of LECTURE material must be refused with 403');

      // 2. Refused: TA attempts to delete doctor's LECTURE material
      const resDeleteDocMat = await fetch(`${baseUrl}/courses/${courseTC.id}/materials/${docMat.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${ta.token}` },
      });
      const bodyDeleteDocMat = await resDeleteDocMat.json();
      console.log(`[PROOF T-C REFUSED DELETE] Status: ${resDeleteDocMat.status}, Body:`, JSON.stringify(bodyDeleteDocMat));
      assert.equal(resDeleteDocMat.status, 403, 'TA deleting doctor LECTURE material must be refused with 403');

      // 3. Refused: TA attempts to toggle course publication
      const resToggleCourse = await fetch(`${baseUrl}/courses/${courseTC.id}/toggle-publication`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${ta.token}` },
      });
      const bodyToggleCourse = await resToggleCourse.json();
      console.log(`[PROOF T-C REFUSED COURSE TOGGLE] Status: ${resToggleCourse.status}, Body:`, JSON.stringify(bodyToggleCourse));
      assert.equal(resToggleCourse.status, 403, 'TA toggling course publication must be refused with 403');

      // 4. Allowed: TA uploads legitimate TUTORIAL material
      const resUploadTutorial = await fetch(`${baseUrl}/courses/${courseTC.id}/materials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ta.token}`,
        },
        body: JSON.stringify({
          title: 'Lab Exercise 1',
          type: 'TUTORIAL',
          fileUrl: 'https://example.test/lab1.pdf',
        }),
      });
      const bodyUploadTutorial = await resUploadTutorial.json();
      console.log(`[PROOF T-C ALLOWED TA TUTORIAL] Status: ${resUploadTutorial.status}, Body:`, JSON.stringify({ success: bodyUploadTutorial.success, id: bodyUploadTutorial.data?.id, type: bodyUploadTutorial.data?.type }));
      assert.equal(resUploadTutorial.status, 201, 'TA upload of TUTORIAL material must succeed');
      const taMatId = bodyUploadTutorial.data?.id;
      if (taMatId) tracked.materialIds.push(taMatId);

      // 5. Allowed: TA toggles and deletes their OWN TUTORIAL material
      const resToggleOwn = await fetch(`${baseUrl}/courses/${courseTC.id}/materials/${taMatId}/toggle`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${ta.token}` },
      });
      assert.equal(resToggleOwn.status, 200, 'TA must be able to toggle their own tutorial material');

      const resDeleteOwn = await fetch(`${baseUrl}/courses/${courseTC.id}/materials/${taMatId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${ta.token}` },
      });
      assert.equal(resDeleteOwn.status, 200, 'TA must be able to delete their own tutorial material');

      // 6. Allowed: Doctor toggles course publication
      const resDocToggleCourse = await fetch(`${baseUrl}/courses/${courseTC.id}/toggle-publication`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${doc.token}` },
      });
      assert.equal(resDocToggleCourse.status, 200, 'Doctor must be able to toggle course publication');
    });

    // =========================================================================
    // Threat T-D: schedule-slot checks ignore isArchived and the term
    // Only non-archived slots of current term count (slots with termId null count as current term).
    // An archived slot or past-term slot must NOT grant management access.
    // =========================================================================
    await t.test('T-D: schedule-slot checks - archived or past-term slot denies management access; current slot allowed', async () => {
      const courseTD = await prisma.course.create({
        data: {
          name: `Course_TD_${SUFFIX}`,
          courseCode: `CTD_${SUFFIX.slice(-6).toUpperCase()}`,
          credits: 3,
          year: 1,
          semester: 1,
          isPublished: true,
          departmentId: dept1.id,
        },
      });
      tracked.courseIds.push(courseTD.id);

      const pastTerm = await prisma.academicTerm.findFirst({
        where: { isCurrent: false },
      });
      assert.ok(pastTerm, 'Past term must exist in test DB baseline');

      const docPast = await createTestDoctor(dept1.id);
      const slotPastDoc = await prisma.scheduleSlot.create({
        data: {
          courseId: courseTD.id,
          doctorId: docPast.doctor.id,
          termId: pastTerm.id,
          dayOfWeek: 'Monday',
          startTime: '09:00',
          endTime: '11:00',
          slotType: 'LECTURE',
          isArchived: false,
        },
      });
      tracked.slotIds.push(slotPastDoc.id);

      // 1. Refused: Doctor with past-term slot attempts upload
      const resPastDoc = await fetch(`${baseUrl}/courses/${courseTD.id}/materials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${docPast.token}`,
        },
        body: JSON.stringify({
          title: 'Past Term Lecture',
          type: 'LECTURE',
          fileUrl: 'https://example.test/past_lecture.pdf',
        }),
      });
      const bodyPastDoc = await resPastDoc.json();
      console.log(`[PROOF T-D REFUSED DOCTOR PAST TERM] Status: ${resPastDoc.status}, Body:`, JSON.stringify(bodyPastDoc));
      assert.equal(resPastDoc.status, 403, 'Doctor with only past-term slot must be refused with 403');

      // 2. Refused: TA with archived slot
      const taArchived = await createTestTA(dept1.id);
      const slotArchivedTA = await prisma.scheduleSlot.create({
        data: {
          courseId: courseTD.id,
          teachingAssistantId: taArchived.ta.id,
          dayOfWeek: 'Wednesday',
          startTime: '10:00',
          endTime: '12:00',
          slotType: 'SECTION',
          isArchived: true,
        },
      });
      tracked.slotIds.push(slotArchivedTA.id);

      const resArchivedTA = await fetch(`${baseUrl}/courses/${courseTD.id}/materials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${taArchived.token}`,
        },
        body: JSON.stringify({
          title: 'Archived TA Tutorial',
          type: 'TUTORIAL',
          fileUrl: 'https://example.test/archived_tutorial.pdf',
        }),
      });
      const bodyArchivedTA = await resArchivedTA.json();
      console.log(`[PROOF T-D REFUSED TA ARCHIVED] Status: ${resArchivedTA.status}, Body:`, JSON.stringify(bodyArchivedTA));
      assert.equal(resArchivedTA.status, 403, 'TA with only archived slot must be refused with 403');

      // 3. Allowed: Doctor with current-term slot (termId: null represents current term)
      const docCurrent = await createTestDoctor(dept1.id);
      const slotCurrentDoc = await prisma.scheduleSlot.create({
        data: {
          courseId: courseTD.id,
          doctorId: docCurrent.doctor.id,
          termId: null,
          dayOfWeek: 'Thursday',
          startTime: '09:00',
          endTime: '11:00',
          slotType: 'LECTURE',
          isArchived: false,
        },
      });
      tracked.slotIds.push(slotCurrentDoc.id);

      const resCurrentDoc = await fetch(`${baseUrl}/courses/${courseTD.id}/materials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${docCurrent.token}`,
        },
        body: JSON.stringify({
          title: 'Current Term Lecture',
          type: 'LECTURE',
          fileUrl: 'https://example.test/current_lecture.pdf',
        }),
      });
      const bodyCurrentDoc = await resCurrentDoc.json();
      console.log(`[PROOF T-D ALLOWED DOCTOR CURRENT] Status: ${resCurrentDoc.status}, Body:`, JSON.stringify({ success: bodyCurrentDoc.success, id: bodyCurrentDoc.data?.id }));
      assert.equal(resCurrentDoc.status, 201, 'Doctor with active current-term slot must succeed');
      if (bodyCurrentDoc.data?.id) tracked.materialIds.push(bodyCurrentDoc.data.id);
    });

    // =========================================================================
    // Threat T-E: materials/tasks LIST of course visible to WITHDRAWN/BLOCKED students
    // Restrict course details & material/task list to ENROLLED students;
    // WITHDRAWN / BLOCKED students must be denied.
    // =========================================================================
    await t.test('T-E: WITHDRAWN and BLOCKED students denied course materials and tasks list; ENROLLED students allowed', async () => {
      // Course in Dept 2 (so students in Dept 1 do not get same-dept auto-enrolment)
      const courseTE = await prisma.course.create({
        data: {
          name: `Course_TE_${SUFFIX}`,
          courseCode: `CTE_${SUFFIX.slice(-6).toUpperCase()}`,
          credits: 3,
          year: 1,
          semester: 1,
          isPublished: true,
          departmentId: dept2.id,
        },
      });
      tracked.courseIds.push(courseTE.id);

      const doc = await createTestDoctor(dept2.id);
      const matTE = await prisma.courseMaterial.create({
        data: {
          title: `Active Lecture ${SUFFIX}`,
          type: 'LECTURE',
          fileUrl: 'https://example.test/active_lecture.pdf',
          isPublished: true,
          courseId: courseTE.id,
          uploadedById: doc.user.id,
        },
      });
      tracked.materialIds.push(matTE.id);

      const taskTE = await prisma.task.create({
        data: {
          title: `Homework 1 ${SUFFIX}`,
          description: 'Solve problems 1 to 5',
          courseId: courseTE.id,
          academicYear: 2026,
          semester: 1,
          doctorId: doc.doctor.id,
          dueDate: new Date('2026-12-01T23:59:59.000Z'),
          maxScore: 100,
        },
      });
      tracked.taskIds.push(taskTE.id);

      // Student from Dept 1 WITHDRAWN from courseTE
      const stuWithdrawn = await createTestStudent(dept1.id);
      const enrWithdrawn = await prisma.enrollment.create({
        data: {
          studentId: stuWithdrawn.student.id,
          courseId: courseTE.id,
          semester: 1,
          academicYear: 2026,
          status: 'WITHDRAWN',
        },
      });
      tracked.enrollmentIds.push(enrWithdrawn.id);

      // Student from Dept 1 BLOCKED in courseTE
      const stuBlocked = await createTestStudent(dept1.id);
      const enrBlocked = await prisma.enrollment.create({
        data: {
          studentId: stuBlocked.student.id,
          courseId: courseTE.id,
          semester: 1,
          academicYear: 2026,
          status: 'BLOCKED',
        },
      });
      tracked.enrollmentIds.push(enrBlocked.id);

      // Student from Dept 1 ENROLLED in courseTE
      const stuEnrolled = await createTestStudent(dept1.id);
      const enrActive = await prisma.enrollment.create({
        data: {
          studentId: stuEnrolled.student.id,
          courseId: courseTE.id,
          semester: 1,
          academicYear: 2026,
          status: 'ENROLLED',
        },
      });
      tracked.enrollmentIds.push(enrActive.id);

      // 1. Refused: Withdrawn student attempts GET /courses/:id
      const resWithdrawn = await fetch(`${baseUrl}/courses/${courseTE.id}`, {
        headers: { Authorization: `Bearer ${stuWithdrawn.token}` },
      });
      const bodyWithdrawn = await resWithdrawn.json();
      console.log(`[PROOF T-E REFUSED WITHDRAWN] Status: ${resWithdrawn.status}, Body:`, JSON.stringify(bodyWithdrawn));
      assert.ok(
        [403, 404].includes(resWithdrawn.status),
        `Withdrawn student must be denied course materials/tasks list, got ${resWithdrawn.status}`
      );

      // 2. Refused: Blocked student attempts GET /courses/:id
      const resBlocked = await fetch(`${baseUrl}/courses/${courseTE.id}`, {
        headers: { Authorization: `Bearer ${stuBlocked.token}` },
      });
      const bodyBlocked = await resBlocked.json();
      console.log(`[PROOF T-E REFUSED BLOCKED] Status: ${resBlocked.status}, Body:`, JSON.stringify(bodyBlocked));
      assert.ok(
        [403, 404].includes(resBlocked.status),
        `Blocked student must be denied course materials/tasks list, got ${resBlocked.status}`
      );

      // 3. Allowed: Enrolled student attempts GET /courses/:id and reads materials/tasks
      const resEnrolled = await fetch(`${baseUrl}/courses/${courseTE.id}`, {
        headers: { Authorization: `Bearer ${stuEnrolled.token}` },
      });
      const bodyEnrolled = await resEnrolled.json();
      console.log(`[PROOF T-E ALLOWED ENROLLED] Status: ${resEnrolled.status}, Body:`, JSON.stringify({ success: bodyEnrolled.success, courseId: bodyEnrolled.data?.id, materialsCount: bodyEnrolled.data?.materials?.length, tasksCount: bodyEnrolled.data?.tasks?.length }));
      assert.equal(resEnrolled.status, 200, 'Enrolled student must receive course details with materials and tasks');
      assert.equal(bodyEnrolled.data?.materials?.length, 1);
      assert.equal(bodyEnrolled.data?.tasks?.length, 1);
    });

    // =========================================================================
    // Threat T-F: TA null department and cross-department approval scope (OD-107)
    // A TA whose TeachingAssistant and User departmentId are both null must NOT
    // manage course materials, view roster, or view course details without an
    // approved TACrossDepartmentApproval.
    // =========================================================================
    await t.test('T-F: TA null department and cross-department approval scope (OD-107)', async () => {
      const courseTF = await prisma.course.create({
        data: {
          name: `Course_TF_${SUFFIX}`,
          courseCode: `CTF_${SUFFIX.slice(-6).toUpperCase()}`,
          credits: 3,
          year: 1,
          semester: 1,
          isPublished: true,
          departmentId: dept1.id,
        },
      });
      tracked.courseIds.push(courseTF.id);

      const docTF = await createTestDoctor(dept1.id);

      // (F1) TA with TeachingAssistant.departmentId null AND User.departmentId null,
      // a non-archived current-term slot in courseTF, NO approval
      const passwordHashF1 = await bcrypt.hash(crypto.randomUUID() + '!Aa1', 4);
      const userF1 = await prisma.user.create({
        data: {
          email: `ta_null_${crypto.randomUUID().slice(0, 8)}_${SUFFIX}@example.test`,
          password: passwordHashF1,
          role: 'TEACHING_ASSISTANT',
          departmentId: null,
          collegeId: college.id,
          tokenVersion: 0,
          isActive: true,
        },
      });
      tracked.userIds.push(userF1.id);

      const taF1 = await prisma.teachingAssistant.create({
        data: {
          userId: userF1.id,
          employeeId: `EMP_${crypto.randomUUID().slice(0, 8)}`,
          firstName: 'TA_Null',
          lastName: SUFFIX,
          departmentId: null,
        },
      });
      tracked.taIds.push(taF1.id);
      const tokenF1 = generateAccessToken(userF1.id, 0);

      const slotF1 = await prisma.scheduleSlot.create({
        data: {
          courseId: courseTF.id,
          teachingAssistantId: taF1.id,
          dayOfWeek: 'Tuesday',
          startTime: '10:00',
          endTime: '12:00',
          slotType: 'SECTION',
          isArchived: false,
        },
      });
      tracked.slotIds.push(slotF1.id);

      // 1. GET /api/courses/:id = 404
      const resCourseF1 = await fetch(`${baseUrl}/courses/${courseTF.id}`, {
        headers: { Authorization: `Bearer ${tokenF1}` },
      });
      const bodyCourseF1 = await resCourseF1.json();
      console.log(`[PROOF T-F1 COURSE REFUSED] Status: ${resCourseF1.status}, Body:`, JSON.stringify(bodyCourseF1));
      assert.equal(resCourseF1.status, 404, `Unapproved null-department TA must receive 404 for course details, got ${resCourseF1.status}`);

      // 2. GET .../roster = 403
      const resRosterF1 = await fetch(`${baseUrl}/courses/${courseTF.id}/roster`, {
        headers: { Authorization: `Bearer ${tokenF1}` },
      });
      const bodyRosterF1 = await resRosterF1.json();
      console.log(`[PROOF T-F1 ROSTER REFUSED] Status: ${resRosterF1.status}, Body:`, JSON.stringify(bodyRosterF1));
      assert.equal(resRosterF1.status, 403, `Unapproved null-department TA must receive 403 for course roster, got ${resRosterF1.status}`);

      // 3. POST .../materials (TUTORIAL, https link) = 403
      const resMatF1 = await fetch(`${baseUrl}/courses/${courseTF.id}/materials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenF1}`,
        },
        body: JSON.stringify({
          title: `Tutorial Sheet F1 ${SUFFIX}`,
          type: 'TUTORIAL',
          fileUrl: 'https://cdn.university.test/materials/tf1_tut.pdf',
        }),
      });
      const bodyMatF1 = await resMatF1.json();
      console.log(`[PROOF T-F1 MATERIAL REFUSED] Status: ${resMatF1.status}, Body:`, JSON.stringify(bodyMatF1));
      assert.equal(resMatF1.status, 403, `Unapproved null-department TA must receive 403 for material upload, got ${resMatF1.status}`);

      // (F2) the same TA after an APPROVED approval is created: 200, 200, 201
      const approvalF2 = await prisma.tACrossDepartmentApproval.create({
        data: {
          teachingAssistantId: taF1.id,
          courseId: courseTF.id,
          status: 'APPROVED',
          approvedByUserId: docTF.user.id,
          reason: `Cross-department approval for ${SUFFIX}`,
        },
      });
      tracked.approvalIds.push(approvalF2.id);

      const resCourseF2 = await fetch(`${baseUrl}/courses/${courseTF.id}`, {
        headers: { Authorization: `Bearer ${tokenF1}` },
      });
      assert.equal(resCourseF2.status, 200, `Approved TA must receive 200 for course details, got ${resCourseF2.status}`);

      const resRosterF2 = await fetch(`${baseUrl}/courses/${courseTF.id}/roster`, {
        headers: { Authorization: `Bearer ${tokenF1}` },
      });
      assert.equal(resRosterF2.status, 200, `Approved TA must receive 200 for course roster, got ${resRosterF2.status}`);

      const resMatF2 = await fetch(`${baseUrl}/courses/${courseTF.id}/materials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenF1}`,
        },
        body: JSON.stringify({
          title: `Tutorial Sheet F2 ${SUFFIX}`,
          type: 'TUTORIAL',
          fileUrl: 'https://cdn.university.test/materials/tf2_tut.pdf',
        }),
      });
      const bodyMatF2 = await resMatF2.json();
      assert.equal(resMatF2.status, 201, `Approved TA must receive 201 for material upload, got ${resMatF2.status}`);
      if (bodyMatF2.data?.id) {
        tracked.materialIds.push(bodyMatF2.data.id);
      }

      // (F3) a TA whose department is set ONLY on the TeachingAssistant row and equals the course department (User.departmentId null): GET course = 200
      const passwordHashF3 = await bcrypt.hash(crypto.randomUUID() + '!Aa1', 4);
      const userF3 = await prisma.user.create({
        data: {
          email: `ta_only_${crypto.randomUUID().slice(0, 8)}_${SUFFIX}@example.test`,
          password: passwordHashF3,
          role: 'TEACHING_ASSISTANT',
          departmentId: null,
          collegeId: college.id,
          tokenVersion: 0,
          isActive: true,
        },
      });
      tracked.userIds.push(userF3.id);

      const taF3 = await prisma.teachingAssistant.create({
        data: {
          userId: userF3.id,
          employeeId: `EMP_${crypto.randomUUID().slice(0, 8)}`,
          firstName: 'TA_Only',
          lastName: SUFFIX,
          departmentId: dept1.id,
        },
      });
      tracked.taIds.push(taF3.id);
      const tokenF3 = generateAccessToken(userF3.id, 0);

      const slotF3 = await prisma.scheduleSlot.create({
        data: {
          courseId: courseTF.id,
          teachingAssistantId: taF3.id,
          dayOfWeek: 'Wednesday',
          startTime: '14:00',
          endTime: '16:00',
          slotType: 'SECTION',
          isArchived: false,
        },
      });
      tracked.slotIds.push(slotF3.id);

      const resCourseF3 = await fetch(`${baseUrl}/courses/${courseTF.id}`, {
        headers: { Authorization: `Bearer ${tokenF3}` },
      });
      assert.equal(resCourseF3.status, 200, `Same-department TA with department on TeachingAssistant row only must receive 200 for course details, got ${resCourseF3.status}`);
    });

    // =========================================================================
    // WP5-T5a-1 SCOPE TESTS
    // =========================================================================

    // T5-A (M-284): Multer stored file cleanup on rejection
    await t.test('T5-A: uploadCourseMaterial removes stored file from uploads/materials on rejection (M-284)', async () => {
      const uploadDir = path.resolve(process.cwd(), 'uploads/materials');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const taDept1 = await createTestTA(dept1.id);
      const docDept1 = await createTestDoctor(dept1.id);
      const courseT5A = await prisma.course.create({
        data: {
          name: `Course_T5A_${SUFFIX}`,
          courseCode: `C5A_${SUFFIX.slice(-6).toUpperCase()}`,
          credits: 3,
          year: 1,
          semester: 1,
          isPublished: true,
          departmentId: dept1.id,
        },
      });
      tracked.courseIds.push(courseT5A.id);

      const slotT5A = await prisma.scheduleSlot.create({
        data: {
          courseId: courseT5A.id,
          teachingAssistantId: taDept1.ta.id,
          dayOfWeek: 'Monday',
          startTime: '08:00',
          endTime: '10:00',
          slotType: 'SECTION',
          isArchived: false,
        },
      });
      tracked.slotIds.push(slotT5A.id);

      const docSlot = await prisma.scheduleSlot.create({
        data: {
          courseId: courseT5A.id,
          doctorId: docDept1.doctor.id,
          dayOfWeek: 'Tuesday',
          startTime: '10:00',
          endTime: '12:00',
          slotType: 'LECTURE',
          isArchived: false,
        },
      });
      tracked.slotIds.push(docSlot.id);

      const validPng = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=',
        'base64'
      );

      // (1) TA attempts to upload LECTURE material -> 403
      const fileMarker1 = `t5a_ta_${SUFFIX}.png`;
      const form1 = new FormData();
      form1.append('file', new Blob([validPng], { type: 'image/png' }), fileMarker1);
      form1.append('title', `Tutorial Sheet ${SUFFIX}`);
      form1.append('type', 'LECTURE');

      const filesBefore1 = new Set(fs.readdirSync(uploadDir));
      const res1 = await fetch(`${baseUrl}/courses/${courseT5A.id}/materials`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${taDept1.token}` },
        body: form1,
      });
      const body1 = await res1.json();
      console.log(`[PROOF T5-A TA 403] Status: ${res1.status}, Body: ${JSON.stringify(body1)}`);
      assert.equal(res1.status, 403, `TA uploading LECTURE must return 403`);

      const filesAfter1 = fs.readdirSync(uploadDir);
      const newFiles1 = filesAfter1.filter(f => !filesBefore1.has(f) && f.includes(fileMarker1));
      newFiles1.forEach(f => tracked.createdDiskFiles.push(path.join(uploadDir, f)));
      console.log(`[PROOF T5-A DIR LISTING AFTER 403] Files: ${JSON.stringify(newFiles1)}`);
      assert.equal(newFiles1.length, 0, `Orphan file must not remain in uploads/materials on 403 rejection; found: ${newFiles1.join(', ')}`);

      // (2) Doctor attempts to upload with invalid title -> 400
      const fileMarker2 = `t5a_doc_${SUFFIX}.png`;
      const form2 = new FormData();
      form2.append('file', new Blob([validPng], { type: 'image/png' }), fileMarker2);
      form2.append('title', '<script>alert(1)</script>');
      form2.append('type', 'LECTURE');

      const filesBefore2 = new Set(fs.readdirSync(uploadDir));
      const res2 = await fetch(`${baseUrl}/courses/${courseT5A.id}/materials`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${docDept1.token}` },
        body: form2,
      });
      const body2 = await res2.json();
      console.log(`[PROOF T5-A DOC 400] Status: ${res2.status}, Body: ${JSON.stringify(body2)}`);
      assert.equal(res2.status, 400, `Upload with invalid title markup must return 400`);

      const filesAfter2 = fs.readdirSync(uploadDir);
      const newFiles2 = filesAfter2.filter(f => !filesBefore2.has(f) && f.includes(fileMarker2));
      newFiles2.forEach(f => tracked.createdDiskFiles.push(path.join(uploadDir, f)));
      console.log(`[PROOF T5-A DIR LISTING AFTER 400] Files: ${JSON.stringify(newFiles2)}`);
      assert.equal(newFiles2.length, 0, `Orphan file must not remain in uploads/materials on 400 rejection; found: ${newFiles2.join(', ')}`);
    });

    // T5-B (W5-T5): Storage path resolvers reject sibling prefixes via path.resolve + path.relative
    await t.test('T5-B: storage path resolvers reject sibling directory prefixes via path.relative (W5-T5)', async () => {
      const { resolveSafeMaterialStoragePath } = await import('../src/controllers/courses.controller');

      const allowedDir = path.resolve(process.cwd(), 'uploads/materials');
      const siblingDir = path.resolve(process.cwd(), 'uploads/materials-evil');
      const siblingFile = path.resolve(siblingDir, 'payload.pdf');

      // Old startsWith logic: siblingFile.startsWith(allowedDir) evaluates to true on systems where prefix matches
      // New resolver MUST reject sibling directories
      const resolvedSibling = resolveSafeMaterialStoragePath(allowedDir, siblingFile);
      assert.equal(resolvedSibling, null, 'resolveSafeMaterialStoragePath must reject sibling directories like materials-evil');

      // Must reject parent traversal
      const parentFile = path.resolve(allowedDir, '../secret.env');
      assert.equal(resolveSafeMaterialStoragePath(allowedDir, parentFile), null, 'resolveSafeMaterialStoragePath must reject parent directory files');

      // Must reject base directory itself
      assert.equal(resolveSafeMaterialStoragePath(allowedDir, allowedDir), null, 'resolveSafeMaterialStoragePath must reject directory path itself');

      // Must accept legitimate file inside allowedDir
      const legitimateFile = path.resolve(allowedDir, 'legitimate.pdf');
      assert.equal(resolveSafeMaterialStoragePath(allowedDir, legitimateFile), legitimateFile, 'resolveSafeMaterialStoragePath must accept files inside allowedDir');
    });

    // T5-C: deleteCourseMaterial unlinks file under /uploads/materials/ even when fileName is null
    await t.test('T5-C: deleteCourseMaterial unlinks file under /uploads/materials/ even when fileName is null (T5-C)', async () => {
      const uploadDir = path.resolve(process.cwd(), 'uploads/materials');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const doc = await createTestDoctor(dept1.id);
      const courseT5C = await prisma.course.create({
        data: {
          name: `Course_T5C_${SUFFIX}`,
          courseCode: `C5C_${SUFFIX.slice(-6).toUpperCase()}`,
          credits: 3,
          year: 1,
          semester: 1,
          isPublished: true,
          departmentId: dept1.id,
        },
      });
      tracked.courseIds.push(courseT5C.id);

      const docSlot = await prisma.scheduleSlot.create({
        data: {
          courseId: courseT5C.id,
          doctorId: doc.doctor.id,
          dayOfWeek: 'Monday',
          startTime: '10:00',
          endTime: '12:00',
          slotType: 'LECTURE',
          isArchived: false,
        },
      });
      tracked.slotIds.push(docSlot.id);

      const testFileName = `t5c_disk_${SUFFIX}.png`;
      const testFilePath = path.join(uploadDir, testFileName);
      fs.writeFileSync(testFilePath, 'dummy-content');
      tracked.createdDiskFiles.push(testFilePath);

      // Material with null fileName
      const matNullFileName = await prisma.courseMaterial.create({
        data: {
          courseId: courseT5C.id,
          title: `Material Null FileName ${SUFFIX}`,
          type: 'LECTURE',
          fileUrl: `/uploads/materials/${testFileName}`,
          fileName: null,
          uploadedById: doc.user.id,
        },
      });
      tracked.materialIds.push(matNullFileName.id);

      assert.ok(fs.existsSync(testFilePath), 'Test file must exist before delete');
      console.log(`[PROOF T5-C BEFORE DELETE] Disk file exists: ${fs.existsSync(testFilePath)} (${testFilePath})`);

      const delRes = await fetch(`${baseUrl}/courses/${courseT5C.id}/materials/${matNullFileName.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${doc.token}` },
      });
      const delBody = await delRes.json();
      console.log(`[PROOF T5-C AFTER DELETE] Status: ${delRes.status}, Body: ${JSON.stringify(delBody)}`);
      console.log(`[PROOF T5-C AFTER DELETE] Disk file exists: ${fs.existsSync(testFilePath)} (${testFilePath})`);

      assert.equal(delRes.status, 200, `Delete must succeed with 200`);
      assert.equal(fs.existsSync(testFilePath), false, 'Disk file must be unlinked even when fileName is null');

      // Missing file on disk must not throw 500
      const matMissing = await prisma.courseMaterial.create({
        data: {
          courseId: courseT5C.id,
          title: `Material Missing Disk ${SUFFIX}`,
          type: 'LECTURE',
          fileUrl: `/uploads/materials/already_gone_${SUFFIX}.pdf`,
          fileName: `already_gone_${SUFFIX}.pdf`,
          uploadedById: doc.user.id,
        },
      });
      tracked.materialIds.push(matMissing.id);

      const delMissingRes = await fetch(`${baseUrl}/courses/${courseT5C.id}/materials/${matMissing.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${doc.token}` },
      });
      assert.equal(delMissingRes.status, 200, `Delete when file missing on disk must succeed with 200`);

      // External link material must not touch disk and must succeed
      const matLink = await prisma.courseMaterial.create({
        data: {
          courseId: courseT5C.id,
          title: `Material Link ${SUFFIX}`,
          type: 'LECTURE',
          fileUrl: `https://example.com/materials/link_${SUFFIX}.pdf`,
          fileName: null,
          uploadedById: doc.user.id,
        },
      });
      tracked.materialIds.push(matLink.id);

      const delLinkRes = await fetch(`${baseUrl}/courses/${courseT5C.id}/materials/${matLink.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${doc.token}` },
      });
      assert.equal(delLinkRes.status, 200, `Delete of link material must succeed with 200`);
    });

    // T5-D (M-270): TA course list must not return courses whose detail returns 404 for the same TA
    await t.test('T5-D: TA course list must not return courses whose detail returns 404 for the same TA (M-270)', async () => {
      const taDept1 = await createTestTA(dept1.id);

      // (1) Cross-department course without approval
      const courseCross = await prisma.course.create({
        data: {
          name: `Course_CrossUnapp_${SUFFIX}`,
          courseCode: `CCU_${SUFFIX.slice(-6).toUpperCase()}`,
          credits: 3,
          year: 1,
          semester: 1,
          isPublished: true,
          departmentId: dept2.id,
        },
      });
      tracked.courseIds.push(courseCross.id);

      const slotCross = await prisma.scheduleSlot.create({
        data: {
          courseId: courseCross.id,
          teachingAssistantId: taDept1.ta.id,
          dayOfWeek: 'Monday',
          startTime: '10:00',
          endTime: '12:00',
          slotType: 'SECTION',
          isArchived: false,
        },
      });
      tracked.slotIds.push(slotCross.id);

      // (2) Same-department course with ARCHIVED slot
      const courseArchived = await prisma.course.create({
        data: {
          name: `Course_ArchivedSlot_${SUFFIX}`,
          courseCode: `CAS_${SUFFIX.slice(-6).toUpperCase()}`,
          credits: 3,
          year: 1,
          semester: 1,
          isPublished: true,
          departmentId: dept1.id,
        },
      });
      tracked.courseIds.push(courseArchived.id);

      const slotArchived = await prisma.scheduleSlot.create({
        data: {
          courseId: courseArchived.id,
          teachingAssistantId: taDept1.ta.id,
          dayOfWeek: 'Tuesday',
          startTime: '14:00',
          endTime: '16:00',
          slotType: 'SECTION',
          isArchived: true,
        },
      });
      tracked.slotIds.push(slotArchived.id);

      // Detail endpoint returns 404 for both
      const detail1 = await fetch(`${baseUrl}/courses/${courseCross.id}`, {
        headers: { Authorization: `Bearer ${taDept1.token}` },
      });
      assert.equal(detail1.status, 404, `Cross-department course without approval must return 404 on detail`);

      const detail2 = await fetch(`${baseUrl}/courses/${courseArchived.id}`, {
        headers: { Authorization: `Bearer ${taDept1.token}` },
      });
      assert.equal(detail2.status, 404, `Archived-slot course must return 404 on detail`);

      // List endpoint GET /api/courses
      const listRes = await fetch(`${baseUrl}/courses`, {
        headers: { Authorization: `Bearer ${taDept1.token}` },
      });
      assert.equal(listRes.status, 200);
      const listBody = await listRes.json();
      const coursesList = Array.isArray(listBody.data) ? listBody.data : (listBody.data?.courses || []);
      const listedIds = coursesList.map((c: any) => c.id);

      assert.equal(
        listedIds.includes(courseCross.id),
        false,
        `TA course list must NOT include cross-department course without approval (id ${courseCross.id})`
      );
      assert.equal(
        listedIds.includes(courseArchived.id),
        false,
        `TA course list must NOT include course with archived slot (id ${courseArchived.id})`
      );
    });

  } finally {
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
    }

    if (tracked.createdDiskFiles && tracked.createdDiskFiles.length > 0) {
      for (const diskFile of tracked.createdDiskFiles) {
        try {
          if (fs.existsSync(diskFile)) fs.unlinkSync(diskFile);
        } catch {}
      }
    }

    // Teardown created records in strict reverse topological order
    if (tracked.materialIds.length > 0) {
      await prisma.courseMaterial.deleteMany({ where: { id: { in: tracked.materialIds } } }).catch(() => {});
    }
    if (tracked.taskIds.length > 0) {
      await prisma.task.deleteMany({ where: { id: { in: tracked.taskIds } } }).catch(() => {});
    }
    if (tracked.enrollmentIds.length > 0) {
      await prisma.enrollment.deleteMany({ where: { id: { in: tracked.enrollmentIds } } }).catch(() => {});
    }
    if (tracked.slotIds.length > 0) {
      await prisma.scheduleSlot.deleteMany({ where: { id: { in: tracked.slotIds } } }).catch(() => {});
    }
    if (tracked.approvalIds.length > 0) {
      await prisma.tACrossDepartmentApproval.deleteMany({ where: { id: { in: tracked.approvalIds } } }).catch(() => {});
    }
    if (tracked.studentIds.length > 0) {
      await prisma.student.deleteMany({ where: { id: { in: tracked.studentIds } } }).catch(() => {});
    }
    if (tracked.doctorIds.length > 0) {
      await prisma.doctor.deleteMany({ where: { id: { in: tracked.doctorIds } } }).catch(() => {});
    }
    if (tracked.taIds.length > 0) {
      await prisma.teachingAssistant.deleteMany({ where: { id: { in: tracked.taIds } } }).catch(() => {});
    }
    if (tracked.courseIds.length > 0) {
      await prisma.course.deleteMany({ where: { id: { in: tracked.courseIds } } }).catch(() => {});
    }
    if (tracked.userIds.length > 0) {
      await prisma.auditLog.deleteMany({ where: { userId: { in: tracked.userIds } } }).catch(() => {});
      await prisma.notification.deleteMany({ where: { userId: { in: tracked.userIds } } }).catch(() => {});
      await prisma.refreshToken.deleteMany({ where: { userId: { in: tracked.userIds } } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: { in: tracked.userIds } } }).catch(() => {});
    }
    if (tracked.departmentIds.length > 0) {
      await prisma.department.deleteMany({ where: { id: { in: tracked.departmentIds } } }).catch(() => {});
    }
    if (tracked.collegeIds.length > 0) {
      await prisma.college.deleteMany({ where: { id: { in: tracked.collegeIds } } }).catch(() => {});
    }
  }
});
