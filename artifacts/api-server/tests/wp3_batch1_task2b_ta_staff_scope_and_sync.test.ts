import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import test from 'node:test';
import bcrypt from 'bcryptjs';
import { TestCleanupRegistry } from './testCleanup.utils';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'wp3-batch1-task2b-test-2026';

const [
  { default: app },
  { default: prisma },
  { generateAccessToken },
] = await Promise.all([
  import('../src/app'),
  import('../src/utils/prismaClient'),
  import('../src/utils/jwt.utils'),
]);

test('Task 2b: LAB for in-department TA persists via modal create & grid sync, appears in TA/student/grid; out-of-department TA is rejected with visible reason', async () => {
  const SUFFIX = 't2b_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);
  const passwordHash = await bcrypt.hash(crypto.randomUUID() + '!Aa1', 4);
  const cleanup = new TestCleanupRegistry();

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const baseUrl = `http://127.0.0.1:${address.port}/api`;

  let course: any;
  let dept1: any;
  let timetable: any;
  let ta1: any;
  let ta2: any;

  try {
    const college = await prisma.college.create({
      data: { name: `Col_${SUFFIX}` },
    });
    cleanup.trackCollege(college.id);

    dept1 = await prisma.department.create({
      data: { name: `Dept1_${SUFFIX}`, collegeId: college.id },
    });
    cleanup.trackDepartment(dept1.id);

    const dept2 = await prisma.department.create({
      data: { name: `Dept2_${SUFFIX}`, collegeId: college.id },
    });
    cleanup.trackDepartment(dept2.id);

    course = await prisma.course.create({
      data: {
        name: `Course_${SUFFIX}`,
        courseCode: `C_${SUFFIX}`,
        departmentId: dept1.id,
        year: 1,
        semester: 1,
        isPublished: true,
      },
    });
    cleanup.trackCourse(course.id);

    timetable = await prisma.timetable.create({
      data: {
        title: `Timetable_${SUFFIX}`,
        collegeId: college.id,
        departmentId: dept1.id,
        academicYear: 1,
        semester: 1,
        status: 'PUBLISHED',
      },
    });
    cleanup.trackTimetable(timetable.id);

    const adminUser = await prisma.user.create({
      data: {
        email: `adm_${SUFFIX}@example.test`,
        password: passwordHash,
        role: 'SUPER_ADMIN',
        tokenVersion: 0,
        isActive: true,
      },
    });
    cleanup.trackUser(adminUser.id);

    const studentUser = await prisma.user.create({
      data: {
        email: `stu_${SUFFIX}@example.test`,
        password: passwordHash,
        role: 'STUDENT',
        tokenVersion: 0,
        isActive: true,
      },
    });
    cleanup.trackUser(studentUser.id);

    const student = await prisma.student.create({
      data: {
        userId: studentUser.id,
        studentId: `STU_${SUFFIX}`,
        firstName: 'Student',
        lastName: SUFFIX,
        departmentId: dept1.id,
        year: 1,
      },
    });
    cleanup.trackStudent(student.id);

    // In-department TA
    const ta1User = await prisma.user.create({
      data: {
        email: `ta1_${SUFFIX}@example.test`,
        password: passwordHash,
        role: 'TEACHING_ASSISTANT',
        tokenVersion: 0,
        isActive: true,
      },
    });
    cleanup.trackUser(ta1User.id);

    ta1 = await prisma.teachingAssistant.create({
      data: {
        userId: ta1User.id,
        employeeId: `TA1_${SUFFIX}`,
        firstName: 'InDept',
        lastName: 'TA',
        departmentId: dept1.id,
      },
    });
    cleanup.trackTA(ta1.id);

    // Out-of-department TA (belongs to dept2)
    const ta2User = await prisma.user.create({
      data: {
        email: `ta2_${SUFFIX}@example.test`,
        password: passwordHash,
        role: 'TEACHING_ASSISTANT',
        tokenVersion: 0,
        isActive: true,
      },
    });
    cleanup.trackUser(ta2User.id);

    ta2 = await prisma.teachingAssistant.create({
      data: {
        userId: ta2User.id,
        employeeId: `TA2_${SUFFIX}`,
        firstName: 'OutOfDept',
        lastName: 'TA',
        departmentId: dept2.id,
      },
    });
    cleanup.trackTA(ta2.id);

    const adminToken = generateAccessToken(adminUser.id, 0);
    const studentToken = generateAccessToken(studentUser.id, 0);
    const ta1Token = generateAccessToken(ta1User.id, 0);

    // ─────────────────────────────────────────────────────────────
    // Part 1: Modal Create Path (POST /api/schedules)
    // ─────────────────────────────────────────────────────────────

    // 1a. In-department TA succeeds
    const modalRes = await fetch(`${baseUrl}/schedules`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${adminToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        courseId: course.id,
        teachingAssistantId: ta1.id,
        slotType: 'LAB',
        dayOfWeek: 'SUNDAY',
        startTime: '08:00',
        endTime: '10:00',
        room: 'Lab 101',
        timetableId: timetable.id,
      }),
    });
    assert.equal(modalRes.status, 201);
    const modalBody = await modalRes.json();
    assert.equal(modalBody.success, true);
    const modalSlotId = modalBody.data?.id;
    assert.ok(modalSlotId, 'Created slot must have an id');
    cleanup.trackSlot(modalSlotId);

    // Verify modal slot appears in:
    // a) TA 1 week view
    const taWeek1 = await fetch(`${baseUrl}/schedules/week`, {
      headers: { authorization: `Bearer ${ta1Token}` },
    });
    assert.equal(taWeek1.status, 200);
    const taWeekBody1 = await taWeek1.json();
    assert.ok(taWeekBody1.data.some((s: any) => s.id === modalSlotId), 'Slot must appear in TA week view');

    // b) Student week view (published timetable)
    const stuWeek1 = await fetch(`${baseUrl}/schedules/week`, {
      headers: { authorization: `Bearer ${studentToken}` },
    });
    assert.equal(stuWeek1.status, 200);
    const stuWeekBody1 = await stuWeek1.json();
    assert.ok(stuWeekBody1.data.some((s: any) => s.id === modalSlotId), 'Slot must appear in student week view');

    // c) Grid view
    const gridRes1 = await fetch(`${baseUrl}/schedules?departmentId=${dept1.id}`, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(gridRes1.status, 200);
    const gridBody1 = await gridRes1.json();
    assert.ok(gridBody1.data.some((s: any) => s.id === modalSlotId), 'Slot must appear in grid view');

    // 1b. Out-of-department TA is REJECTED with visible reason on modal create
    const modalRejectRes = await fetch(`${baseUrl}/schedules`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${adminToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        courseId: course.id,
        teachingAssistantId: ta2.id,
        slotType: 'LAB',
        dayOfWeek: 'MONDAY',
        startTime: '08:00',
        endTime: '10:00',
        room: 'Lab 102',
        timetableId: timetable.id,
      }),
    });
    assert.equal(modalRejectRes.status, 403, 'Out-of-department TA must be rejected with 403');
    const modalRejectBody = await modalRejectRes.json();
    assert.equal(modalRejectBody.success, false);
    assert.ok(
      modalRejectBody.message && /teaching assistant/i.test(modalRejectBody.message),
      'Error message must state visible reason regarding teaching assistant scope'
    );

    // ─────────────────────────────────────────────────────────────
    // Part 2: Grid Sync Path (POST /api/schedules/sync-grid)
    // ─────────────────────────────────────────────────────────────

    // 2a. In-department TA succeeds via syncGridToMaster
    const syncRes = await fetch(`${baseUrl}/schedules/sync-grid`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${adminToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        departmentId: dept1.id,
        academicYear: 1,
        semester: 1,
        slots: [
          {
            day: 'TUESDAY',
            startTime: '10:00',
            endTime: '12:00',
            courseName: course.name,
            courseId: course.id,
            teachingAssistantId: ta1.id,
            room: 'Lab 103',
            slotType: 'LAB',
          },
        ],
      }),
    });
    assert.equal(syncRes.status, 200);
    const syncBody = await syncRes.json();
    assert.equal(syncBody.success, true);
    assert.equal(syncBody.data.syncedCount, 1);
    assert.equal(syncBody.data.skippedCount, 0);

    // Find the synced slot id
    const foundSyncedSlot = await prisma.scheduleSlot.findFirst({
      where: {
        courseId: course.id,
        teachingAssistantId: ta1.id,
        dayOfWeek: 'TUESDAY',
        startTime: '10:00',
      },
    });
    assert.ok(foundSyncedSlot, 'Synced slot must exist in database');
    cleanup.trackSlot(foundSyncedSlot.id);

    // Verify synced slot appears in:
    // a) TA 1 week view
    const taWeek2 = await fetch(`${baseUrl}/schedules/week`, {
      headers: { authorization: `Bearer ${ta1Token}` },
    });
    assert.equal(taWeek2.status, 200);
    const taWeekBody2 = await taWeek2.json();
    assert.ok(taWeekBody2.data.some((s: any) => s.id === foundSyncedSlot.id), 'Synced slot must appear in TA week view');

    // b) Student week view
    const stuWeek2 = await fetch(`${baseUrl}/schedules/week`, {
      headers: { authorization: `Bearer ${studentToken}` },
    });
    assert.equal(stuWeek2.status, 200);
    const stuWeekBody2 = await stuWeek2.json();
    assert.ok(stuWeekBody2.data.some((s: any) => s.id === foundSyncedSlot.id), 'Synced slot must appear in student week view');

    // c) Grid view
    const gridRes2 = await fetch(`${baseUrl}/schedules?departmentId=${dept1.id}`, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(gridRes2.status, 200);
    const gridBody2 = await gridRes2.json();
    assert.ok(gridBody2.data.some((s: any) => s.id === foundSyncedSlot.id), 'Synced slot must appear in grid view');

    // 2b. Out-of-department TA in syncGridToMaster is SKIPPED with visible reason (NOT silently dropped)
    const syncRejectRes = await fetch(`${baseUrl}/schedules/sync-grid`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${adminToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        departmentId: dept1.id,
        academicYear: 1,
        semester: 1,
        slots: [
          {
            day: 'WEDNESDAY',
            startTime: '12:00',
            endTime: '14:00',
            courseName: course.name,
            courseId: course.id,
            teachingAssistantId: ta2.id,
            room: 'Lab 104',
            slotType: 'LAB',
          },
        ],
      }),
    });
    assert.equal(syncRejectRes.status, 200);
    const syncRejectBody = await syncRejectRes.json();
    assert.equal(syncRejectBody.data.syncedCount, 0);
    assert.equal(syncRejectBody.data.skippedCount, 1, 'Out-of-department TA slot must be recorded as skipped');
    assert.equal(syncRejectBody.data.skippedSlots.length, 1);
    assert.ok(
      /INSTRUCTOR_ID_NOT_IN_SCOPE/i.test(syncRejectBody.data.skippedSlots[0].reason),
      'Skipped reason must explicitly state INSTRUCTOR_ID_NOT_IN_SCOPE'
    );

    // Verify that the out-of-department slot was NOT created in DB
    const droppedSlot = await prisma.scheduleSlot.findFirst({
      where: {
        courseId: course.id,
        teachingAssistantId: ta2.id,
      },
    });
    assert.equal(droppedSlot, null, 'Out-of-department TA slot must NOT be created in database');
  } finally {
    try {
      await cleanup.teardown(prisma);
    } finally {
      server.closeAllConnections?.();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }
});
