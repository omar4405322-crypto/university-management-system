import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';

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
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const baseUrl = `http://127.0.0.1:${address.port}/api`;

  let college: any;
  let dept: any;
  let course: any;
  let group: any;
  let studentUser: any;
  let student: any;
  let doctorUser: any;
  let doctor: any;
  let taUser: any;
  let ta: any;
  let ttPublished: any;
  let ttDraft: any;
  let slotA: any;
  let slotB: any;
  let slotC: any;

  try {
    college = await prisma.college.create({
      data: { name: `Col_${SUFFIX}` }
    });

    dept = await prisma.department.create({
      data: { name: `Dept_${SUFFIX}`, collegeId: college.id }
    });

    course = await prisma.course.create({
      data: {
        name: `Course_${SUFFIX}`,
        courseCode: `C_${SUFFIX}`,
        departmentId: dept.id,
        year: 1,
        semester: 1,
        isPublished: true,
      }
    });

    group = await prisma.studentGroup.create({
      data: {
        name: `Group_${SUFFIX}`,
        departmentId: dept.id,
        year: 1,
      }
    });

    studentUser = await prisma.user.create({
      data: {
        email: `stu_${SUFFIX}@example.test`,
        password: 'Password123!',
        role: 'STUDENT',
        tokenVersion: 0,
        isActive: true,
      }
    });
    student = await prisma.student.create({
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

    doctorUser = await prisma.user.create({
      data: {
        email: `doc_${SUFFIX}@example.test`,
        password: 'Password123!',
        role: 'DOCTOR',
        tokenVersion: 0,
        isActive: true,
      }
    });
    doctor = await prisma.doctor.create({
      data: {
        userId: doctorUser.id,
        doctorId: `DOC_${SUFFIX}`,
        firstName: 'Doctor',
        lastName: SUFFIX,
        departmentId: dept.id,
      }
    });

    taUser = await prisma.user.create({
      data: {
        email: `ta_${SUFFIX}@example.test`,
        password: 'Password123!',
        role: 'TEACHING_ASSISTANT',
        tokenVersion: 0,
        isActive: true,
      }
    });
    ta = await prisma.teachingAssistant.create({
      data: {
        userId: taUser.id,
        employeeId: `TA_${SUFFIX}`,
        firstName: 'TA',
        lastName: SUFFIX,
        departmentId: dept.id,
      }
    });

    ttPublished = await prisma.timetable.create({
      data: {
        title: `Published TT ${SUFFIX}`,
        collegeId: college.id,
        departmentId: dept.id,
        academicYear: 1,
        semester: 1,
        status: 'PUBLISHED',
      }
    });

    ttDraft = await prisma.timetable.create({
      data: {
        title: `Draft TT ${SUFFIX}`,
        collegeId: college.id,
        departmentId: dept.id,
        academicYear: 2,
        semester: 1,
        status: 'DRAFT',
      }
    });

    // Slot A: in Published Timetable
    slotA = await prisma.scheduleSlot.create({
      data: {
        timetableId: ttPublished.id,
        courseId: course.id,
        doctorId: doctor.id,
        teachingAssistantId: ta.id,
        groupId: group.id,
        dayOfWeek: 'MONDAY',
        startTime: '09:00',
        endTime: '11:00',
        slotType: 'LECTURE',
      }
    });

    // Slot B: in Draft Timetable
    slotB = await prisma.scheduleSlot.create({
      data: {
        timetableId: ttDraft.id,
        courseId: course.id,
        doctorId: doctor.id,
        teachingAssistantId: ta.id,
        groupId: group.id,
        dayOfWeek: 'TUESDAY',
        startTime: '09:00',
        endTime: '11:00',
        slotType: 'LECTURE',
      }
    });

    // Slot C: Orphan Slot (timetableId is null)
    slotC = await prisma.scheduleSlot.create({
      data: {
        timetableId: null,
        courseId: course.id,
        doctorId: doctor.id,
        teachingAssistantId: ta.id,
        groupId: group.id,
        dayOfWeek: 'WEDNESDAY',
        startTime: '09:00',
        endTime: '11:00',
        slotType: 'LAB',
      }
    });

    const studentToken = generateAccessToken(studentUser.id, 0);
    const doctorToken = generateAccessToken(doctorUser.id, 0);
    const taToken = generateAccessToken(taUser.id, 0);

    // 1. Verify Student view
    const stuRes = await fetch(`${baseUrl}/schedules/week`, {
      headers: { authorization: `Bearer ${studentToken}` }
    });
    assert.equal(stuRes.status, 200);
    const stuBody = await stuRes.json();
    assert.equal(stuBody.success, true);
    const stuSlotIds = stuBody.data.map((s: any) => s.id);
    assert.ok(stuSlotIds.includes(slotA.id), 'Student must receive published slot');
    assert.ok(!stuSlotIds.includes(slotB.id), 'Student must NOT receive draft slot');
    assert.ok(!stuSlotIds.includes(slotC.id), 'Student must NOT receive orphan slot');

    // 2. Verify Doctor view
    const docRes = await fetch(`${baseUrl}/schedules/week`, {
      headers: { authorization: `Bearer ${doctorToken}` }
    });
    assert.equal(docRes.status, 200);
    const docBody = await docRes.json();
    assert.equal(docBody.success, true);
    const docSlotIds = docBody.data.map((s: any) => s.id);
    assert.ok(docSlotIds.includes(slotA.id), 'Doctor must receive published slot');
    assert.ok(!docSlotIds.includes(slotB.id), 'Doctor must NOT receive draft slot');
    assert.ok(!docSlotIds.includes(slotC.id), 'Doctor must NOT receive orphan slot');

    // 3. Verify TA view
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
        password: 'Password123!',
        role: 'SUPER_ADMIN',
        tokenVersion: 0,
        isActive: true,
      }
    });
    try {
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
      await prisma.user.delete({ where: { id: adminUser.id } }).catch(() => {});
    }
  } finally {
    // Hermetic cleanup in reverse order
    const slotIds = [slotA?.id, slotB?.id, slotC?.id].filter(Boolean);
    if (slotIds.length > 0) {
      await prisma.scheduleSlot.deleteMany({ where: { id: { in: slotIds } } });
    }
    const ttIds = [ttPublished?.id, ttDraft?.id].filter(Boolean);
    if (ttIds.length > 0) {
      await prisma.timetable.deleteMany({ where: { id: { in: ttIds } } });
    }
    if (student?.id) await prisma.student.delete({ where: { id: student.id } }).catch(() => {});
    if (studentUser?.id) await prisma.user.delete({ where: { id: studentUser.id } }).catch(() => {});
    if (doctor?.id) await prisma.doctor.delete({ where: { id: doctor.id } }).catch(() => {});
    if (doctorUser?.id) await prisma.user.delete({ where: { id: doctorUser.id } }).catch(() => {});
    if (ta?.id) await prisma.teachingAssistant.delete({ where: { id: ta.id } }).catch(() => {});
    if (taUser?.id) await prisma.user.delete({ where: { id: taUser.id } }).catch(() => {});
    if (group?.id) await prisma.studentGroup.delete({ where: { id: group.id } }).catch(() => {});
    if (course?.id) await prisma.course.delete({ where: { id: course.id } }).catch(() => {});
    if (dept?.id) await prisma.department.delete({ where: { id: dept.id } }).catch(() => {});
    if (college?.id) await prisma.college.delete({ where: { id: college.id } }).catch(() => {});
    server.close();
  }
});
