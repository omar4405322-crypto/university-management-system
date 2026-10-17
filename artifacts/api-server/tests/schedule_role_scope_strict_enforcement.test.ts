import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import test, { describe, before, after } from 'node:test';
import bcrypt from 'bcryptjs';
import { TestCleanupRegistry } from './testCleanup.utils';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'wp3-3a-t2-schedule-scope-secret-2026';

const [
  { default: app },
  { default: prisma },
  { generateAccessToken },
] = await Promise.all([
  import('../src/app'),
  import('../src/utils/prismaClient'),
  import('../src/utils/jwt.utils'),
]);

async function createServer() {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const baseUrl = `http://127.0.0.1:${address.port}/api`;
  return { server, baseUrl };
}

async function closeServer(server: http.Server | null) {
  if (server) {
    server.closeAllConnections?.();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

describe('WP-3 Batch 3A Task 2: Role-Scoped Schedule Queries Enforced by API (OD-34)', () => {
  const SUFFIX = 'scopet2_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);
  const cleanup = new TestCleanupRegistry();
  let server: http.Server | null = null;
  let baseUrl = '';

  let college1: any;
  let college2: any;
  let dept1: any;
  let dept2: any;
  let course1: any;
  let course2: any;
  let tt1: any;
  let tt2: any;
  let doctor1: any;
  let doctor2: any;
  let ta1: any;
  let ta2: any;
  let student1: any;
  let student2: any;
  let slot1: any;
  let slot2: any;

  let tokenStudent1 = '';
  let tokenDoctor1 = '';
  let tokenTA1 = '';
  let tokenDeptAdmin1 = '';
  let tokenCollegeAdmin1 = '';
  let tokenSuperAdmin = '';

  before(async () => {
    const srv = await createServer();
    server = srv.server;
    baseUrl = srv.baseUrl;

    const passwordHash = await bcrypt.hash(crypto.randomUUID() + '!Aa1', 4);

    // 1. Colleges
    college1 = await prisma.college.create({
      data: { name: `Col1_${SUFFIX}`, nameAr: `كلية1_${SUFFIX}` },
    });
    cleanup.trackCollege(college1.id);

    college2 = await prisma.college.create({
      data: { name: `Col2_${SUFFIX}`, nameAr: `كلية2_${SUFFIX}` },
    });
    cleanup.trackCollege(college2.id);

    // 2. Departments
    dept1 = await prisma.department.create({
      data: { name: `Dept1_${SUFFIX}`, nameAr: `قسم1_${SUFFIX}`, collegeId: college1.id },
    });
    cleanup.trackDepartment(dept1.id);

    dept2 = await prisma.department.create({
      data: { name: `Dept2_${SUFFIX}`, nameAr: `قسم2_${SUFFIX}`, collegeId: college2.id },
    });
    cleanup.trackDepartment(dept2.id);

    // 3. Courses
    course1 = await prisma.course.create({
      data: {
        name: `Course1_${SUFFIX}`,
        courseCode: `C1_${SUFFIX}`,
        departmentId: dept1.id,
        year: 1,
        semester: 1,
        credits: 3,
        isPublished: true,
      },
    });
    cleanup.trackCourse(course1.id);

    course2 = await prisma.course.create({
      data: {
        name: `Course2_${SUFFIX}`,
        courseCode: `C2_${SUFFIX}`,
        departmentId: dept2.id,
        year: 2,
        semester: 1,
        credits: 3,
        isPublished: true,
      },
    });
    cleanup.trackCourse(course2.id);

    // 4. Timetables
    tt1 = await prisma.timetable.create({
      data: {
        academicYear: 1,
        semester: 1,
        departmentId: dept1.id,
        collegeId: college1.id,
        status: 'PUBLISHED',
        title: `TT1_${SUFFIX}`,
      },
    });
    cleanup.trackTimetable(tt1.id);

    tt2 = await prisma.timetable.create({
      data: {
        academicYear: 1,
        semester: 1,
        departmentId: dept2.id,
        collegeId: college2.id,
        status: 'PUBLISHED',
        title: `TT2_${SUFFIX}`,
      },
    });
    cleanup.trackTimetable(tt2.id);

    // 5. Doctors
    const docUser1 = await prisma.user.create({
      data: { email: `doc1_${SUFFIX}@example.com`, password: passwordHash, role: 'DOCTOR', departmentId: dept1.id },
    });
    cleanup.trackUser(docUser1.id);
    doctor1 = await prisma.doctor.create({
      data: { userId: docUser1.id, departmentId: dept1.id, firstName: 'Doc1', lastName: 'Scope' },
    });
    cleanup.trackDoctor(doctor1.id);

    const docUser2 = await prisma.user.create({
      data: { email: `doc2_${SUFFIX}@example.com`, password: passwordHash, role: 'DOCTOR', departmentId: dept2.id },
    });
    cleanup.trackUser(docUser2.id);
    doctor2 = await prisma.doctor.create({
      data: { userId: docUser2.id, departmentId: dept2.id, firstName: 'Doc2', lastName: 'Scope' },
    });
    cleanup.trackDoctor(doctor2.id);

    // 6. Teaching Assistants
    const taUser1 = await prisma.user.create({
      data: { email: `ta1_${SUFFIX}@example.com`, password: passwordHash, role: 'TEACHING_ASSISTANT', departmentId: dept1.id },
    });
    cleanup.trackUser(taUser1.id);
    ta1 = await prisma.teachingAssistant.create({
      data: { userId: taUser1.id, departmentId: dept1.id, firstName: 'TA1', lastName: 'Scope', employeeId: `TA1_${SUFFIX}` },
    });
    cleanup.trackTA(ta1.id);

    const taUser2 = await prisma.user.create({
      data: { email: `ta2_${SUFFIX}@example.com`, password: passwordHash, role: 'TEACHING_ASSISTANT', departmentId: dept2.id },
    });
    cleanup.trackUser(taUser2.id);
    ta2 = await prisma.teachingAssistant.create({
      data: { userId: taUser2.id, departmentId: dept2.id, firstName: 'TA2', lastName: 'Scope', employeeId: `TA2_${SUFFIX}` },
    });
    cleanup.trackTA(ta2.id);

    // 7. Students
    const stuUser1 = await prisma.user.create({
      data: { email: `stu1_${SUFFIX}@example.com`, password: passwordHash, role: 'STUDENT', departmentId: dept1.id },
    });
    cleanup.trackUser(stuUser1.id);
    student1 = await prisma.student.create({
      data: { userId: stuUser1.id, departmentId: dept1.id, firstName: 'Stu1', lastName: 'Scope', studentId: `S1_${SUFFIX}`, year: 1 },
    });
    cleanup.trackStudent(student1.id);

    const stuUser2 = await prisma.user.create({
      data: { email: `stu2_${SUFFIX}@example.com`, password: passwordHash, role: 'STUDENT', departmentId: dept2.id },
    });
    cleanup.trackUser(stuUser2.id);
    student2 = await prisma.student.create({
      data: { userId: stuUser2.id, departmentId: dept2.id, firstName: 'Stu2', lastName: 'Scope', studentId: `S2_${SUFFIX}`, year: 2 },
    });
    cleanup.trackStudent(student2.id);

    // 8. Enrollments
    const enr1 = await prisma.enrollment.create({
      data: { studentId: student1.id, courseId: course1.id, status: 'ENROLLED', semester: 1, academicYear: 1 },
    });
    cleanup.trackEnrollment(enr1.id);

    const enr2 = await prisma.enrollment.create({
      data: { studentId: student2.id, courseId: course2.id, status: 'ENROLLED', semester: 1, academicYear: 1 },
    });
    cleanup.trackEnrollment(enr2.id);

    // 9. Department Admin & College Admin & Super Admin
    const deptAdminUser = await prisma.user.create({
      data: { email: `da_${SUFFIX}@example.com`, password: passwordHash, role: 'DEPARTMENT_ADMIN', managedDepartmentId: dept1.id, departmentId: dept1.id },
    });
    cleanup.trackUser(deptAdminUser.id);

    const colAdminUser = await prisma.user.create({
      data: { email: `ca_${SUFFIX}@example.com`, password: passwordHash, role: 'COLLEGE_ADMIN', managedCollegeId: college1.id, collegeId: college1.id },
    });
    cleanup.trackUser(colAdminUser.id);

    const superAdminUser = await prisma.user.create({
      data: { email: `sa_${SUFFIX}@example.com`, password: passwordHash, role: 'SUPER_ADMIN' },
    });
    cleanup.trackUser(superAdminUser.id);

    // 10. Schedule Slots
    // Slot 1: Course 1 (Dept 1), Doctor 1, TA 1, LECTURE, MONDAY, Timetable 1
    slot1 = await prisma.scheduleSlot.create({
      data: {
        timetableId: tt1.id,
        courseId: course1.id,
        doctorId: doctor1.id,
        teachingAssistantId: ta1.id,
        dayOfWeek: 'MONDAY',
        startTime: '09:00',
        endTime: '11:00',
        room: 'Room1',
        slotType: 'LECTURE',
      },
    });
    cleanup.trackSlot(slot1.id);

    // Slot 2: Course 2 (Dept 2), Doctor 2, TA 2, LAB, TUESDAY, Timetable 2
    slot2 = await prisma.scheduleSlot.create({
      data: {
        timetableId: tt2.id,
        courseId: course2.id,
        doctorId: doctor2.id,
        teachingAssistantId: ta2.id,
        dayOfWeek: 'TUESDAY',
        startTime: '11:00',
        endTime: '13:00',
        room: 'Lab2',
        slotType: 'LAB',
      },
    });
    cleanup.trackSlot(slot2.id);

    // Generate JWT access tokens
    tokenStudent1 = generateAccessToken(stuUser1.id);
    tokenDoctor1 = generateAccessToken(docUser1.id);
    tokenTA1 = generateAccessToken(taUser1.id);
    tokenDeptAdmin1 = generateAccessToken(deptAdminUser.id);
    tokenCollegeAdmin1 = generateAccessToken(colAdminUser.id);
    tokenSuperAdmin = generateAccessToken(superAdminUser.id);
  });

  after(async () => {
    await closeServer(server);
    await cleanup.teardown(prisma);
  });

  async function apiGet(token: string, path: string) {
    const res = await fetch(`${baseUrl}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const text = await res.text();
    let body: any = null;
    try { body = JSON.parse(text); } catch {}
    return { status: res.status, body };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. STUDENT SCOPE ENFORCEMENT
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Student Role-Scope Enforcement', () => {
    test('absent or empty query returns student own scope (200 OK)', async () => {
      const res = await apiGet(tokenStudent1, '/schedules/week');
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.length, 1);
      assert.equal(res.body.data[0].id, slot1.id);
    });

    test('alias GET /schedules behaves identically to GET /schedules/week', async () => {
      const res = await apiGet(tokenStudent1, '/schedules');
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.length, 1);
      assert.equal(res.body.data[0].id, slot1.id);
    });

    test('student passing foreign departmentId returns 403 Forbidden', async () => {
      const res = await apiGet(tokenStudent1, `/schedules/week?departmentId=${dept2.id}`);
      assert.equal(res.status, 403);
    });

    test('student passing foreign collegeId returns 403 Forbidden', async () => {
      const res = await apiGet(tokenStudent1, `/schedules/week?collegeId=${college2.id}`);
      assert.equal(res.status, 403);
    });

    test('student passing doctorId not teaching student enrolled course returns 403 Forbidden', async () => {
      const res = await apiGet(tokenStudent1, `/schedules/week?doctorId=${doctor2.id}`);
      assert.equal(res.status, 403);
    });

    test('student passing teachingAssistantId not teaching student enrolled course returns 403 Forbidden', async () => {
      const res = await apiGet(tokenStudent1, `/schedules/week?teachingAssistantId=${ta2.id}`);
      assert.equal(res.status, 403);
    });

    test('student passing non-enrolled courseId returns 403 Forbidden', async () => {
      const res = await apiGet(tokenStudent1, `/schedules/week?courseId=${course2.id}`);
      assert.equal(res.status, 403);
    });

    test('student passing in-scope departmentId, doctorId, courseId returns 200 OK', async () => {
      const res = await apiGet(tokenStudent1, `/schedules/week?departmentId=${dept1.id}&doctorId=${doctor1.id}&courseId=${course1.id}`);
      assert.equal(res.status, 200);
      assert.equal(res.body.data.length, 1);
    });

    test('student slotType filter filters slots by LECTURE or LAB', async () => {
      const resLecture = await apiGet(tokenStudent1, '/schedules/week?slotType=LECTURE');
      assert.equal(resLecture.status, 200);
      assert.equal(resLecture.body.data.length, 1);

      const resLab = await apiGet(tokenStudent1, '/schedules/week?slotType=LAB');
      assert.equal(resLab.status, 200);
      assert.equal(resLab.body.data.length, 0);
    });

    test('student dayOfWeek filter filters slots by day', async () => {
      const resMonday = await apiGet(tokenStudent1, '/schedules/week?dayOfWeek=MONDAY');
      assert.equal(resMonday.status, 200);
      assert.equal(resMonday.body.data.length, 1);

      const resWednesday = await apiGet(tokenStudent1, '/schedules/week?dayOfWeek=WEDNESDAY');
      assert.equal(resWednesday.status, 200);
      assert.equal(resWednesday.body.data.length, 0);
    });

    test('invalid enum slotType returns 400 Bad Request', async () => {
      const res = await apiGet(tokenStudent1, '/schedules/week?slotType=INVALID_SLOT');
      assert.equal(res.status, 400);
    });

    test('invalid enum dayOfWeek returns 400 Bad Request', async () => {
      const res = await apiGet(tokenStudent1, '/schedules/week?dayOfWeek=INVALID_DAY');
      assert.equal(res.status, 400);
    });

    test('empty string params ?slotType=&dayOfWeek=&courseId= treated as absent / own scope (200 OK)', async () => {
      const res = await apiGet(tokenStudent1, '/schedules/week?slotType=&dayOfWeek=&courseId=&departmentId=');
      assert.equal(res.status, 200);
      assert.equal(res.body.data.length, 1);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. TEACHING ASSISTANT SCOPE ENFORCEMENT
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Teaching Assistant Role-Scope Enforcement', () => {
    test('absent or empty query returns TA own slots only (200 OK)', async () => {
      const res = await apiGet(tokenTA1, '/schedules/week');
      assert.equal(res.status, 200);
      assert.equal(res.body.data.length, 1);
      assert.equal(res.body.data[0].id, slot1.id);
    });

    test('TA passing another teachingAssistantId returns 403 Forbidden', async () => {
      const res = await apiGet(tokenTA1, `/schedules/week?teachingAssistantId=${ta2.id}`);
      assert.equal(res.status, 403);
    });

    test('TA passing unassigned courseId returns 403 Forbidden', async () => {
      const res = await apiGet(tokenTA1, `/schedules/week?courseId=${course2.id}`);
      assert.equal(res.status, 403);
    });

    test('TA passing another doctorId or foreign departmentId returns 403 Forbidden', async () => {
      const resDoc = await apiGet(tokenTA1, `/schedules/week?doctorId=${doctor2.id}`);
      assert.equal(resDoc.status, 403);

      const resDept = await apiGet(tokenTA1, `/schedules/week?departmentId=${dept2.id}`);
      assert.equal(resDept.status, 403);
    });

    test('TA passing own teachingAssistantId and assigned courseId returns 200 OK', async () => {
      const res = await apiGet(tokenTA1, `/schedules/week?teachingAssistantId=${ta1.id}&courseId=${course1.id}&slotType=LECTURE&dayOfWeek=MONDAY`);
      assert.equal(res.status, 200);
      assert.equal(res.body.data.length, 1);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. DOCTOR SCOPE ENFORCEMENT
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Doctor Role-Scope Enforcement', () => {
    test('absent or empty query returns doctor own slots only (200 OK)', async () => {
      const res = await apiGet(tokenDoctor1, '/schedules/week');
      assert.equal(res.status, 200);
      assert.equal(res.body.data.length, 1);
      assert.equal(res.body.data[0].id, slot1.id);
    });

    test('doctor passing another doctorId returns 403 Forbidden', async () => {
      const res = await apiGet(tokenDoctor1, `/schedules/week?doctorId=${doctor2.id}`);
      assert.equal(res.status, 403);
    });

    test('doctor passing not-own courseId returns 403 Forbidden', async () => {
      const res = await apiGet(tokenDoctor1, `/schedules/week?courseId=${course2.id}`);
      assert.equal(res.status, 403);
    });

    test('doctor passing foreign departmentId or teachingAssistantId returns 403 Forbidden', async () => {
      const resDept = await apiGet(tokenDoctor1, `/schedules/week?departmentId=${dept2.id}`);
      assert.equal(resDept.status, 403);

      const resTA = await apiGet(tokenDoctor1, `/schedules/week?teachingAssistantId=${ta2.id}`);
      assert.equal(resTA.status, 403);
    });

    test('doctor passing year not matching any own courses returns 403 Forbidden', async () => {
      // Course 1 is year 1; year 4 is not taught by doctor 1
      const res = await apiGet(tokenDoctor1, '/schedules/week?year=4');
      assert.equal(res.status, 403);
    });

    test('doctor passing own doctorId, own courseId, own year returns 200 OK', async () => {
      const res = await apiGet(tokenDoctor1, `/schedules/week?doctorId=${doctor1.id}&courseId=${course1.id}&year=1&slotType=LECTURE`);
      assert.equal(res.status, 200);
      assert.equal(res.body.data.length, 1);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. DEPARTMENT_ADMIN & COLLEGE_ADMIN & SUPER_ADMIN SCOPE ENFORCEMENT
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Admin Role-Scope Enforcement', () => {
    test('DEPARTMENT_ADMIN passing foreign departmentId returns 403 Forbidden', async () => {
      const res = await apiGet(tokenDeptAdmin1, `/schedules/week?departmentId=${dept2.id}`);
      assert.equal(res.status, 403);
    });

    test('DEPARTMENT_ADMIN passing foreign collegeId returns 403 Forbidden', async () => {
      const res = await apiGet(tokenDeptAdmin1, `/schedules/week?collegeId=${college2.id}`);
      assert.equal(res.status, 403);
    });

    test('DEPARTMENT_ADMIN passing doctor outside managed department returns 403 Forbidden', async () => {
      const res = await apiGet(tokenDeptAdmin1, `/schedules/week?doctorId=${doctor2.id}`);
      assert.equal(res.status, 403);
    });

    test('DEPARTMENT_ADMIN passing TA outside managed department returns 403 Forbidden', async () => {
      const res = await apiGet(tokenDeptAdmin1, `/schedules/week?teachingAssistantId=${ta2.id}`);
      assert.equal(res.status, 403);
    });

    test('DEPARTMENT_ADMIN passing own departmentId and doctor in department returns 200 OK', async () => {
      const res = await apiGet(tokenDeptAdmin1, `/schedules/week?departmentId=${dept1.id}&doctorId=${doctor1.id}`);
      assert.equal(res.status, 200);
      assert.equal(res.body.data.length, 1);
    });

    test('COLLEGE_ADMIN passing foreign departmentId returns 403 Forbidden', async () => {
      const res = await apiGet(tokenCollegeAdmin1, `/schedules/week?departmentId=${dept2.id}`);
      assert.equal(res.status, 403);
    });

    test('COLLEGE_ADMIN passing foreign collegeId returns 403 Forbidden', async () => {
      const res = await apiGet(tokenCollegeAdmin1, `/schedules/week?collegeId=${college2.id}`);
      assert.equal(res.status, 403);
    });

    test('COLLEGE_ADMIN passing own collegeId and department within college returns 200 OK', async () => {
      const res = await apiGet(tokenCollegeAdmin1, `/schedules/week?collegeId=${college1.id}&departmentId=${dept1.id}`);
      assert.equal(res.status, 200);
      assert.equal(res.body.data.length, 1);
    });

    test('SUPER_ADMIN passing any departmentId or doctorId returns 200 OK', async () => {
      const res = await apiGet(tokenSuperAdmin, `/schedules/week?departmentId=${dept2.id}&doctorId=${doctor2.id}`);
      assert.equal(res.status, 200);
      assert.equal(res.body.data.length, 1);
      assert.equal(res.body.data[0].id, slot2.id);
    });
  });
});
