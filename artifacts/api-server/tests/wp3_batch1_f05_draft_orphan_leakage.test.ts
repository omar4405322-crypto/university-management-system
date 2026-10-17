import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import test from 'node:test';
import bcrypt from 'bcryptjs';
import { TestCleanupRegistry } from './testCleanup.utils';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'wp3-batch1-f05-test-secret-2026';

const [
  { default: app },
  { default: prisma },
  { generateAccessToken },
] = await Promise.all([
  import('../src/app'),
  import('../src/utils/prismaClient'),
  import('../src/utils/jwt.utils'),
]);

test('F-05 & A3: draft-timetable slot + orphan slot are never returned to student, doctor, or TA personal schedules', async () => {
  const SUFFIX = 'f05_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);
  const passwordHash = await bcrypt.hash(crypto.randomUUID() + '!Aa1', 4);
  const cleanup = new TestCleanupRegistry();

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const baseUrl = `http://127.0.0.1:${address.port}/api`;

  try {
    const college = await prisma.college.create({
      data: { name: `Col_${SUFFIX}` }
    });
    cleanup.trackCollege(college.id);

    const dept = await prisma.department.create({
      data: { name: `Dept_${SUFFIX}`, collegeId: college.id }
    });
    cleanup.trackDepartment(dept.id);

    const course = await prisma.course.create({
      data: {
        name: `Course_${SUFFIX}`,
        courseCode: `C_${SUFFIX}`,
        departmentId: dept.id,
        year: 1,
        semester: 1,
        isPublished: true,
      }
    });
    cleanup.trackCourse(course.id);

    const group = await prisma.studentGroup.create({
      data: {
        name: `Group_${SUFFIX}`,
        departmentId: dept.id,
        year: 1,
      }
    });
    cleanup.trackGroup(group.id);

    const studentUser = await prisma.user.create({
      data: {
        email: `stu_${SUFFIX}@example.test`,
        password: passwordHash,
        role: 'STUDENT',
        tokenVersion: 0,
        isActive: true,
      }
    });
    cleanup.trackUser(studentUser.id);

    const student = await prisma.student.create({
      data: {
        userId: studentUser.id,
        studentId: `STU_${SUFFIX}`,
        firstName: 'Student',
        lastName: SUFFIX,
        departmentId: dept.id,
        groupId: group.id,
        year: 1,
      }
    });
    cleanup.trackStudent(student.id);

    const doctorUser = await prisma.user.create({
      data: {
        email: `doc_${SUFFIX}@example.test`,
        password: passwordHash,
        role: 'DOCTOR',
        tokenVersion: 0,
        isActive: true,
      }
    });
    cleanup.trackUser(doctorUser.id);

    const doctor = await prisma.doctor.create({
      data: {
        userId: doctorUser.id,
        doctorId: `DOC_${SUFFIX}`,
        firstName: 'Doctor',
        lastName: SUFFIX,
        departmentId: dept.id,
      }
    });
    cleanup.trackDoctor(doctor.id);

    const taUser = await prisma.user.create({
      data: {
        email: `ta_${SUFFIX}@example.test`,
        password: passwordHash,
        role: 'TEACHING_ASSISTANT',
        tokenVersion: 0,
        isActive: true,
      }
    });
    cleanup.trackUser(taUser.id);

    const ta = await prisma.teachingAssistant.create({
      data: {
        userId: taUser.id,
        employeeId: `TA_${SUFFIX}`,
        firstName: 'TA',
        lastName: SUFFIX,
        departmentId: dept.id,
      }
    });
    cleanup.trackTA(ta.id);

    const ttPublished = await prisma.timetable.create({
      data: {
        title: `Published TT ${SUFFIX}`,
        collegeId: college.id,
        departmentId: dept.id,
        academicYear: 1,
        semester: 1,
        status: 'PUBLISHED',
      }
    });
    cleanup.trackTimetable(ttPublished.id);

    const ttDraft = await prisma.timetable.create({
      data: {
        title: `Draft TT ${SUFFIX}`,
        collegeId: college.id,
        departmentId: dept.id,
        academicYear: 2,
        semester: 1,
        status: 'DRAFT',
      }
    });
    cleanup.trackTimetable(ttDraft.id);

    // Slot A: in Published Timetable
    const slotA = await prisma.scheduleSlot.create({
      data: {
        timetableId: ttPublished.id,
        courseId: course.id,
        doctorId: doctor.id,
        teachingAssistantId: ta.id,
        groupId: group.id,
        dayOfWeek: 'MONDAY',
        startTime: '09:00',
        endTime: '11:00',
        room: 'Room Pub',
        slotType: 'LAB',
      }
    });
    cleanup.trackSlot(slotA.id);

    // Slot B: in Draft Timetable
    const slotB = await prisma.scheduleSlot.create({
      data: {
        timetableId: ttDraft.id,
        courseId: course.id,
        doctorId: doctor.id,
        teachingAssistantId: ta.id,
        groupId: group.id,
        dayOfWeek: 'TUESDAY',
        startTime: '11:00',
        endTime: '13:00',
        room: 'Room Draft',
        slotType: 'LAB',
      }
    });
    cleanup.trackSlot(slotB.id);

    // Slot C: Orphan (timetableId is null)
    const slotC = await prisma.scheduleSlot.create({
      data: {
        timetableId: null,
        courseId: course.id,
        doctorId: doctor.id,
        teachingAssistantId: ta.id,
        groupId: group.id,
        dayOfWeek: 'WEDNESDAY',
        startTime: '14:00',
        endTime: '16:00',
        room: 'Room Orphan',
        slotType: 'LAB',
      }
    });
    cleanup.trackSlot(slotC.id);

    // 1. Verify Student personal schedule: sees ONLY slotA (from published timetable)
    const stuToken = generateAccessToken(studentUser.id, 0);
    const stuRes = await fetch(`${baseUrl}/schedules/week`, {
      headers: { authorization: `Bearer ${stuToken}` }
    });
    assert.equal(stuRes.status, 200);
    const stuBody = await stuRes.json();
    assert.equal(stuBody.success, true);
    const stuSlotIds = stuBody.data.map((s: any) => s.id);
    assert.ok(stuSlotIds.includes(slotA.id), 'Student must receive published slot');
    assert.ok(!stuSlotIds.includes(slotB.id), 'Student must NOT receive draft slot');
    assert.ok(!stuSlotIds.includes(slotC.id), 'Student must NOT receive orphan slot');

    // 2. Verify Doctor personal schedule: sees ONLY slotA (from published timetable)
    const docToken = generateAccessToken(doctorUser.id, 0);
    const docRes = await fetch(`${baseUrl}/schedules/week`, {
      headers: { authorization: `Bearer ${docToken}` }
    });
    assert.equal(docRes.status, 200);
    const docBody = await docRes.json();
    assert.equal(docBody.success, true);
    const docSlotIds = docBody.data.map((s: any) => s.id);
    assert.ok(docSlotIds.includes(slotA.id), 'Doctor must receive published slot');
    assert.ok(!docSlotIds.includes(slotB.id), 'Doctor must NOT receive draft slot');
    assert.ok(!docSlotIds.includes(slotC.id), 'Doctor must NOT receive orphan slot');

    // 3. Verify TA personal schedule: sees ONLY slotA (from published timetable)
    const taToken = generateAccessToken(taUser.id, 0);
    const taRes = await fetch(`${baseUrl}/schedules/week`, {
      headers: { authorization: `Bearer ${taToken}` }
    });
    assert.equal(taRes.status, 200);
    const taBody = await taRes.json();
    assert.equal(taBody.success, true);
    const taSlotIds = taBody.data.map((s: any) => s.id);
    assert.ok(taSlotIds.includes(slotA.id), 'TA must receive published slot');
    assert.ok(!taSlotIds.includes(slotB.id), 'TA must NOT receive draft slot');
    assert.ok(!taSlotIds.includes(slotC.id), 'TA must NOT receive orphan slot');

    // 4. Verify Admin view: sees all slots and includes timetable metadata for badges
    const adminUser = await prisma.user.create({
      data: {
        email: `adm_${SUFFIX}@example.test`,
        password: passwordHash,
        role: 'SUPER_ADMIN',
        tokenVersion: 0,
        isActive: true,
      }
    });
    cleanup.trackUser(adminUser.id);

    const adminToken = generateAccessToken(adminUser.id, 0);
    const adminRes = await fetch(`${baseUrl}/schedules/week?departmentId=${dept.id}`, {
      headers: { authorization: `Bearer ${adminToken}` }
    });
    assert.equal(adminRes.status, 200);
    const adminBody = await adminRes.json();
    assert.equal(adminBody.success, true);
    const adminSlots = adminBody.data;
    const foundSlotA = adminSlots.find((s: any) => s.id === slotA.id);
    const foundSlotB = adminSlots.find((s: any) => s.id === slotB.id);
    const foundSlotC = adminSlots.find((s: any) => s.id === slotC.id);
    assert.ok(foundSlotA, 'Admin sees published slot');
    assert.equal(foundSlotA.timetable?.status, 'PUBLISHED');
    assert.ok(foundSlotB, 'Admin sees draft slot');
    assert.equal(foundSlotB.timetable?.status, 'DRAFT');
    assert.ok(foundSlotC, 'Admin sees orphan slot');
    assert.equal(foundSlotC.timetable, null);
  } finally {
    try {
      await cleanup.teardown(prisma);
    } finally {
      server.closeAllConnections?.();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }
});
