import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import test, { describe, before, after } from 'node:test';
import bcrypt from 'bcryptjs';
import { TestCleanupRegistry } from './testCleanup.utils';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'wp3-3a-t3-consolidation-secret-2026';

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

describe('WP-3 Batch 3A Task 3: Schedule Read-Route Consolidation & Deprecation (OD-28)', () => {
  const SUFFIX = 'cons_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);
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

    // Colleges
    college1 = await prisma.college.create({
      data: { name: `Col1_${SUFFIX}`, nameAr: `كلية1_${SUFFIX}` },
    });
    cleanup.trackCollege(college1.id);

    college2 = await prisma.college.create({
      data: { name: `Col2_${SUFFIX}`, nameAr: `كلية2_${SUFFIX}` },
    });
    cleanup.trackCollege(college2.id);

    // Departments
    dept1 = await prisma.department.create({
      data: { name: `Dept1_${SUFFIX}`, nameAr: `قسم1_${SUFFIX}`, collegeId: college1.id },
    });
    cleanup.trackDepartment(dept1.id);

    dept2 = await prisma.department.create({
      data: { name: `Dept2_${SUFFIX}`, nameAr: `قسم2_${SUFFIX}`, collegeId: college2.id },
    });
    cleanup.trackDepartment(dept2.id);

    // Courses
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

    // Timetables
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

    // Doctors
    const docUser1 = await prisma.user.create({
      data: { email: `doc1_${SUFFIX}@example.com`, password: passwordHash, role: 'DOCTOR', departmentId: dept1.id },
    });
    cleanup.trackUser(docUser1.id);
    doctor1 = await prisma.doctor.create({
      data: { userId: docUser1.id, departmentId: dept1.id, firstName: 'Doc1', lastName: 'Cons' },
    });
    cleanup.trackDoctor(doctor1.id);

    const docUser2 = await prisma.user.create({
      data: { email: `doc2_${SUFFIX}@example.com`, password: passwordHash, role: 'DOCTOR', departmentId: dept2.id },
    });
    cleanup.trackUser(docUser2.id);
    doctor2 = await prisma.doctor.create({
      data: { userId: docUser2.id, departmentId: dept2.id, firstName: 'Doc2', lastName: 'Cons' },
    });
    cleanup.trackDoctor(doctor2.id);

    // Teaching Assistants
    const taUser1 = await prisma.user.create({
      data: { email: `ta1_${SUFFIX}@example.com`, password: passwordHash, role: 'TEACHING_ASSISTANT', departmentId: dept1.id },
    });
    cleanup.trackUser(taUser1.id);
    ta1 = await prisma.teachingAssistant.create({
      data: { userId: taUser1.id, departmentId: dept1.id, firstName: 'TA1', lastName: 'Cons', employeeId: `TA1_${SUFFIX}` },
    });
    cleanup.trackTA(ta1.id);

    const taUser2 = await prisma.user.create({
      data: { email: `ta2_${SUFFIX}@example.com`, password: passwordHash, role: 'TEACHING_ASSISTANT', departmentId: dept2.id },
    });
    cleanup.trackUser(taUser2.id);
    ta2 = await prisma.teachingAssistant.create({
      data: { userId: taUser2.id, departmentId: dept2.id, firstName: 'TA2', lastName: 'Cons', employeeId: `TA2_${SUFFIX}` },
    });
    cleanup.trackTA(ta2.id);

    // Students
    const stuUser1 = await prisma.user.create({
      data: { email: `stu1_${SUFFIX}@example.com`, password: passwordHash, role: 'STUDENT', departmentId: dept1.id },
    });
    cleanup.trackUser(stuUser1.id);
    student1 = await prisma.student.create({
      data: { userId: stuUser1.id, departmentId: dept1.id, firstName: 'Stu1', lastName: 'Cons', studentId: `S1_${SUFFIX}`, year: 1 },
    });
    cleanup.trackStudent(student1.id);

    const enr1 = await prisma.enrollment.create({
      data: { studentId: student1.id, courseId: course1.id, status: 'ENROLLED', semester: 1, academicYear: 1 },
    });
    cleanup.trackEnrollment(enr1.id);

    // Admins
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

    // Schedule Slots
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

    tokenStudent1 = generateAccessToken(stuUser1.id);
    tokenDoctor1 = generateAccessToken(docUser1.id);
    tokenTA1 = generateAccessToken(taUser1.id);
    tokenDeptAdmin1 = generateAccessToken(deptAdminUser.id);
    tokenCollegeAdmin1 = generateAccessToken(colAdminUser.id);
    tokenSuperAdmin = generateAccessToken(superAdminUser.id);
  });

  after(async () => {
    try {
      await closeServer(server);
    } finally {
      await cleanup.teardown(prisma);
    }
  });

  async function apiFetch(token: string, path: string) {
    const res = await fetch(`${baseUrl}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const text = await res.text();
    let body: any = null;
    try { body = JSON.parse(text); } catch {}
    return {
      status: res.status,
      headers: res.headers,
      body,
    };
  }

  describe('Deprecation and Link Response Headers (OD-28)', () => {
    test('GET /api/schedules (alias) includes Deprecation: true and Link: </api/schedules/week>; rel="successor-version"', async () => {
      const res = await apiFetch(tokenSuperAdmin, '/schedules');
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('deprecation'), 'true', 'Alias must send Deprecation: true header');
      assert.equal(
        res.headers.get('link'),
        '</api/schedules/week>; rel="successor-version"',
        'Alias must send successor-version Link header pointing to /api/schedules/week'
      );
    });

    test('GET /api/schedules/week (canonical) includes NEITHER Deprecation NOR Link header', async () => {
      const res = await apiFetch(tokenSuperAdmin, '/schedules/week');
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('deprecation'), null, 'Canonical route must NOT send Deprecation header');
      assert.equal(res.headers.get('link'), null, 'Canonical route must NOT send Link header');
    });
  });

  describe('Identical Response Body Parity Across Roles & Queries', () => {
    test('Super Admin: identical body between alias and canonical for unfiltered query', async () => {
      const [aliasRes, canonRes] = await Promise.all([
        apiFetch(tokenSuperAdmin, '/schedules?page=1&limit=50'),
        apiFetch(tokenSuperAdmin, '/schedules/week?page=1&limit=50'),
      ]);
      assert.equal(aliasRes.status, 200);
      assert.equal(canonRes.status, 200);
      assert.deepEqual(aliasRes.body, canonRes.body);
    });

    test('Student: identical body between alias and canonical for enrolled scope', async () => {
      const [aliasRes, canonRes] = await Promise.all([
        apiFetch(tokenStudent1, '/schedules'),
        apiFetch(tokenStudent1, '/schedules/week'),
      ]);
      assert.equal(aliasRes.status, 200);
      assert.equal(canonRes.status, 200);
      assert.deepEqual(aliasRes.body, canonRes.body);
      assert.equal(aliasRes.body.data.length, 1);
      assert.equal(aliasRes.body.data[0].id, slot1.id);
    });

    test('Doctor: identical body between alias and canonical for assigned lectures', async () => {
      const [aliasRes, canonRes] = await Promise.all([
        apiFetch(tokenDoctor1, `/schedules?doctorId=${doctor1.id}&slotType=LECTURE`),
        apiFetch(tokenDoctor1, `/schedules/week?doctorId=${doctor1.id}&slotType=LECTURE`),
      ]);
      assert.equal(aliasRes.status, 200);
      assert.equal(canonRes.status, 200);
      assert.deepEqual(aliasRes.body, canonRes.body);
      assert.equal(aliasRes.body.data.length, 1);
      assert.equal(aliasRes.body.data[0].id, slot1.id);
    });

    test('Teaching Assistant: identical body between alias and canonical for assigned lab', async () => {
      const [aliasRes, canonRes] = await Promise.all([
        apiFetch(tokenTA1, `/schedules?teachingAssistantId=${ta1.id}`),
        apiFetch(tokenTA1, `/schedules/week?teachingAssistantId=${ta1.id}`),
      ]);
      assert.equal(aliasRes.status, 200);
      assert.equal(canonRes.status, 200);
      assert.deepEqual(aliasRes.body, canonRes.body);
      assert.equal(aliasRes.body.data.length, 1);
      assert.equal(aliasRes.body.data[0].id, slot1.id);
    });

    test('Department Admin: identical body between alias and canonical for department scope', async () => {
      const [aliasRes, canonRes] = await Promise.all([
        apiFetch(tokenDeptAdmin1, `/schedules?departmentId=${dept1.id}`),
        apiFetch(tokenDeptAdmin1, `/schedules/week?departmentId=${dept1.id}`),
      ]);
      assert.equal(aliasRes.status, 200);
      assert.equal(canonRes.status, 200);
      assert.deepEqual(aliasRes.body, canonRes.body);
      assert.equal(aliasRes.body.data.length, 1);
      assert.equal(aliasRes.body.data[0].id, slot1.id);
    });

    test('College Admin: identical body between alias and canonical for college scope', async () => {
      const [aliasRes, canonRes] = await Promise.all([
        apiFetch(tokenCollegeAdmin1, `/schedules?collegeId=${college1.id}`),
        apiFetch(tokenCollegeAdmin1, `/schedules/week?collegeId=${college1.id}`),
      ]);
      assert.equal(aliasRes.status, 200);
      assert.equal(canonRes.status, 200);
      assert.deepEqual(aliasRes.body, canonRes.body);
      assert.equal(aliasRes.body.data.length, 1);
      assert.equal(aliasRes.body.data[0].id, slot1.id);
    });
  });

  describe('Security & Role-Scoping Strict Parity on Alias Route', () => {
    test('Alias returns 403 when Doctor queries out-of-scope doctor', async () => {
      const res = await apiFetch(tokenDoctor1, `/schedules?doctorId=${doctor2.id}`);
      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
      assert.equal(res.headers.get('deprecation'), 'true');
      assert.equal(res.headers.get('link'), '</api/schedules/week>; rel="successor-version"');
    });

    test('Canonical returns 403 when Doctor queries out-of-scope doctor without deprecation headers', async () => {
      const res = await apiFetch(tokenDoctor1, `/schedules/week?doctorId=${doctor2.id}`);
      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
      assert.equal(res.headers.get('deprecation'), null);
      assert.equal(res.headers.get('link'), null);
    });

    test('Alias returns 403 when Student queries outside department', async () => {
      const res = await apiFetch(tokenStudent1, `/schedules?departmentId=${dept2.id}`);
      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
      assert.equal(res.headers.get('deprecation'), 'true');
    });

    test('Alias returns 403 when TA queries another TA', async () => {
      const res = await apiFetch(tokenTA1, `/schedules?teachingAssistantId=${ta2.id}`);
      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
      assert.equal(res.headers.get('deprecation'), 'true');
    });

    test('Alias returns 403 when Department Admin queries another department', async () => {
      const res = await apiFetch(tokenDeptAdmin1, `/schedules?departmentId=${dept2.id}`);
      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
      assert.equal(res.headers.get('deprecation'), 'true');
    });

    test('Alias returns 403 when College Admin queries another college', async () => {
      const res = await apiFetch(tokenCollegeAdmin1, `/schedules?collegeId=${college2.id}`);
      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
      assert.equal(res.headers.get('deprecation'), 'true');
    });

    test('Alias returns 400 for invalid query parameter format', async () => {
      const res = await apiFetch(tokenSuperAdmin, '/schedules?slotType=INVALID');
      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.headers.get('deprecation'), 'true');
    });
  });
});
