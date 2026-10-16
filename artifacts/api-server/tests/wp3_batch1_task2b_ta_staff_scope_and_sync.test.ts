import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';

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
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const baseUrl = `http://127.0.0.1:${address.port}/api`;

  let college: any;
  let dept1: any;
  let dept2: any;
  let course: any;
  let timetable: any;
  let studentUser: any;
  let student: any;
  let adminUser: any;
  let ta1User: any;
  let ta1: any;
  let ta2User: any;
  let ta2: any;
  let createdSlotIds: number[] = [];

  try {
    college = await prisma.college.create({
      data: { name: `Col_${SUFFIX}` },
    });

    dept1 = await prisma.department.create({
      data: { name: `Dept1_${SUFFIX}`, collegeId: college.id },
    });

    dept2 = await prisma.department.create({
      data: { name: `Dept2_${SUFFIX}`, collegeId: college.id },
    });

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

    adminUser = await prisma.user.create({
      data: {
        email: `adm_${SUFFIX}@example.test`,
        password: 'Password123!',
        role: 'SUPER_ADMIN',
        tokenVersion: 0,
        isActive: true,
      },
    });

    studentUser = await prisma.user.create({
      data: {
        email: `stu_${SUFFIX}@example.test`,
        password: 'Password123!',
        role: 'STUDENT',
        tokenVersion: 0,
        isActive: true,
      },
    });

    student = await prisma.student.create({
      data: {
        userId: studentUser.id,
        studentId: `STU_${SUFFIX}`,
        firstName: 'Student',
        lastName: SUFFIX,
        departmentId: dept1.id,
        year: 1,
      },
    });

    // In-department TA
    ta1User = await prisma.user.create({
      data: {
        email: `ta1_${SUFFIX}@example.test`,
        password: 'Password123!',
        role: 'TEACHING_ASSISTANT',
        tokenVersion: 0,
        isActive: true,
      },
    });
    ta1 = await prisma.teachingAssistant.create({
      data: {
        userId: ta1User.id,
        employeeId: `TA1_${SUFFIX}`,
        firstName: 'InDept',
        lastName: 'TA',
        departmentId: dept1.id,
      },
    });

    // Out-of-department TA (belongs to dept2)
    ta2User = await prisma.user.create({
      data: {
        email: `ta2_${SUFFIX}@example.test`,
        password: 'Password123!',
        role: 'TEACHING_ASSISTANT',
        tokenVersion: 0,
        isActive: true,
      },
    });
    ta2 = await prisma.teachingAssistant.create({
      data: {
        userId: ta2User.id,
        employeeId: `TA2_${SUFFIX}`,
        firstName: 'OutOfDept',
        lastName: 'TA',
        departmentId: dept2.id,
      },
    });

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
    createdSlotIds.push(modalSlotId);

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
    createdSlotIds.push(foundSyncedSlot.id);

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
    if (createdSlotIds.length > 0) {
      await prisma.scheduleSlot.deleteMany({ where: { id: { in: createdSlotIds } } }).catch(() => {});
    }
    if (timetable?.id) await prisma.timetable.delete({ where: { id: timetable.id } }).catch(() => {});
    if (student?.id) await prisma.student.delete({ where: { id: student.id } }).catch(() => {});
    if (studentUser?.id) await prisma.user.delete({ where: { id: studentUser.id } }).catch(() => {});
    if (ta1?.id) await prisma.teachingAssistant.delete({ where: { id: ta1.id } }).catch(() => {});
    if (ta1User?.id) await prisma.user.delete({ where: { id: ta1User.id } }).catch(() => {});
    if (ta2?.id) await prisma.teachingAssistant.delete({ where: { id: ta2.id } }).catch(() => {});
    if (ta2User?.id) await prisma.user.delete({ where: { id: ta2User.id } }).catch(() => {});
    if (adminUser?.id) await prisma.user.delete({ where: { id: adminUser.id } }).catch(() => {});
    if (course?.id) await prisma.course.delete({ where: { id: course.id } }).catch(() => {});
    if (dept1?.id) await prisma.department.delete({ where: { id: dept1.id } }).catch(() => {});
    if (dept2?.id) await prisma.department.delete({ where: { id: dept2.id } }).catch(() => {});
    if (college?.id) await prisma.college.delete({ where: { id: college.id } }).catch(() => {});
    server.close();
  }
});
