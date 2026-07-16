/**
 * UNIVERSITY MANAGEMENT SYSTEM — INTEGRATION TESTS
 * Tests scenarios a through h as specified in the review.
 * Run with: node integration_test.mjs
 * Requires: server running on localhost:5000, direct DB access via prisma
 */

import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const BASE = 'http://localhost:5000/api';
const JWT_SECRET = 'my-super-secret-jwt-key-that-is-long-enough-32chars';
const prisma = new PrismaClient();

// ─── helpers ────────────────────────────────────────────────────────────────
const pass = (label) => console.log(`  ✅ PASS: ${label}`);
const fail = (label, detail) => console.log(`  ❌ FAIL: ${label}\n     → ${detail}`);

const results = [];
function record(id, label, passed, detail = '') {
  results.push({ id, label, passed, detail });
  if (passed) pass(label);
  else fail(label, detail);
}

function makeToken(userId, tokenVersion = 0) {
  return jwt.sign(
    { id: userId, tokenVersion },
    JWT_SECRET,
    { expiresIn: '1h', issuer: 'Smart University Platform', audience: 'University Users' }
  );
}

async function api(method, path, body, token) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  };
  const res = await fetch(`${BASE}${path}`, opts);
  let data;
  try { data = await res.json(); } catch { data = {}; }
  return { status: res.status, data };
}

// ─── seed helpers ────────────────────────────────────────────────────────────
let testCollegeId, testDeptId;

function resetIds() { testCollegeId = null; testDeptId = null; }

async function ensureCollegeDept() {
  let college = await prisma.college.findFirst({ where: { name: '__TestCollege__' } });
  if (!college) college = await prisma.college.create({ data: { name: '__TestCollege__' } });
  testCollegeId = college.id;

  let dept = await prisma.department.findFirst({ where: { name: '__TestDept__', collegeId: testCollegeId } });
  if (!dept) dept = await prisma.department.create({ data: { name: '__TestDept__', collegeId: testCollegeId } });
  testDeptId = dept.id;
}

async function createTestUser(email, role) {
  await prisma.user.deleteMany({ where: { email } });
  const hash = await bcrypt.hash('Test1234!', 10);
  return prisma.user.create({ data: { email, password: hash, role } });
}

async function createTestStudent(userEmail, studentIdStr) {
  await ensureCollegeDept();
  const user = await createTestUser(userEmail, 'STUDENT');
  const student = await prisma.student.create({
    data: { userId: user.id, firstName: 'Test', lastName: 'Student', studentId: studentIdStr, departmentId: testDeptId }
  });
  return { user, student };
}

async function createTestDoctor(userEmail, seq) {
  await ensureCollegeDept();
  const user = await createTestUser(userEmail, 'DOCTOR');
  const doctor = await prisma.doctor.create({
    data: {
      userId: user.id,
      firstName: 'Dr',
      lastName: `Test${seq}`,
      departmentId: testDeptId,
    }
  });
  return { user, doctor };
}

async function createTestCourse(code) {
  await ensureCollegeDept();
  await prisma.course.deleteMany({ where: { courseCode: code } });
  return prisma.course.create({ data: { courseCode: code, name: `Course ${code}`, departmentId: testDeptId } });
}

async function createTestSection(courseId, doctorId, timetableId = null) {
  return prisma.courseSection.create({
    data: { courseId, doctorId, name: 'Section 1', timetableId }
  });
}

async function createTestAdmin(email) {
  const user = await createTestUser(email, 'SUPER_ADMIN');
  return { user };
}

// ─── CLEANUP ─────────────────────────────────────────────────────────────────
async function cleanup() {
  // Delete in FK-safe order
  await prisma.scheduleChangeRequest.deleteMany({ where: { courseSection: { course: { courseCode: { startsWith: '__TC' } } } } });
  await prisma.scheduleOverride.deleteMany({});
  await prisma.scheduleSlot.deleteMany({ where: { courseSection: { course: { courseCode: { startsWith: '__TC' } } } } });
  await prisma.quiz.deleteMany({ where: { course: { courseCode: { startsWith: '__TC' } } } });
  await prisma.attendance.deleteMany({ where: { course: { courseCode: { startsWith: '__TC' } } } });
  await prisma.enrollment.deleteMany({ where: { course: { courseCode: { startsWith: '__TC' } } } });
  await prisma.absenceThresholdPolicy.deleteMany({ where: { course: { courseCode: { startsWith: '__TC' } } } });
  await prisma.courseSection.deleteMany({ where: { course: { courseCode: { startsWith: '__TC' } } } });
  await prisma.course.deleteMany({ where: { courseCode: { startsWith: '__TC' } } });
  await prisma.student.deleteMany({ where: { user: { email: { startsWith: 'test_' } } } });
  await prisma.doctor.deleteMany({ where: { user: { email: { startsWith: 'test_' } } } });
  // Notifications block user deletion — clear them first
  const testUsers = await prisma.user.findMany({ where: { email: { startsWith: 'test_' } }, select: { id: true } });
  const testUserIds = testUsers.map(u => u.id);
  if (testUserIds.length > 0) {
    await prisma.notification.deleteMany({ where: { userId: { in: testUserIds } } });
    await prisma.refreshToken.deleteMany({ where: { userId: { in: testUserIds } } });
    await prisma.auditLog.deleteMany({ where: { userId: { in: testUserIds } } });
  }
  await prisma.user.deleteMany({ where: { email: { startsWith: 'test_' } } });
  await prisma.studentGroup.deleteMany({ where: { department: { name: '__TestDeptJ__' } } });
  await prisma.department.deleteMany({ where: { name: '__TestDept__' } });
  await prisma.department.deleteMany({ where: { name: '__TestDeptJ__' } });
  await prisma.college.deleteMany({ where: { name: '__TestCollege__' } });
}

// ════════════════════════════════════════════════════════════════════════════
// TEST A — IDOR Attendance access: Student A cannot see Student B's records
// ════════════════════════════════════════════════════════════════════════════
async function testA() {
  console.log('\n── Test A: IDOR — Student A cannot see Student B attendance ──');
  const course = await createTestCourse('__TC_A');

  const { user: uA, student: sA } = await createTestStudent('test_studentA@test.com', 'STUA001');
  const { user: uB, student: sB } = await createTestStudent('test_studentB@test.com', 'STUB002');

  // Crucially: User.id !== Student.id by design in real DBs. Let's log them.
  console.log(`  User A: userId=${uA.id}, studentId=${sA.id}`);
  console.log(`  User B: userId=${uB.id}, studentId=${sB.id}`);

  // Insert attendance records for Student B only
  await prisma.attendance.create({
    data: { studentId: sB.id, courseId: course.id, date: new Date('2025-01-10'), status: 'PRESENT' }
  });

  // Login as Student A and call GET /attendance/my-attendance
  const tokenA = makeToken(uA.id);
  const { status, data } = await api('GET', '/attendance/my-attendance', null, tokenA);

  console.log(`  GET /attendance/my-attendance as StudentA → HTTP ${status}, records returned: ${data.data?.length ?? 'N/A'}`);

  const contaminated = (data.data ?? []).some(r => r.studentId === sB.id);

  record('A', 'IDOR: StudentA /attendance/my-attendance returns only their records',
    status === 200 && (data.data?.length === 0) && !contaminated,
    `HTTP=${status}, count=${data.data?.length}, contaminated=${contaminated}`
  );
}

// ════════════════════════════════════════════════════════════════════════════
// TEST B — IDOR: Doctor X cannot access Doctor Y's course
// ════════════════════════════════════════════════════════════════════════════
async function testB() {
  console.log('\n── Test B: IDOR — Doctor X blocked from Doctor Y course ──');
  const courseX = await createTestCourse('__TC_BX');
  const courseY = await createTestCourse('__TC_BY');

  const { user: uX, doctor: dX } = await createTestDoctor('test_docX@test.com', 'X');
  const { user: uY, doctor: dY } = await createTestDoctor('test_docY@test.com', 'Y');

  await createTestSection(courseX.id, dX.id);
  await createTestSection(courseY.id, dY.id);

  const tokenX = makeToken(uX.id);

  // Doctor X tries recordAttendance on courseY
  const r1 = await api('POST', '/attendance', {
    courseId: courseY.id, date: '2025-01-10', records: []
  }, tokenX);
  console.log(`  POST /attendance (courseY) as DoctorX → HTTP ${r1.status}: ${r1.data?.message}`);
  record('B1', 'IDOR: Doctor X recordAttendance on courseY → 403', r1.status === 403,
    `HTTP=${r1.status}, msg=${r1.data?.message}`);

  // Doctor X tries getCourseAttendance on courseY
  const r2 = await api('GET', `/attendance/course/${courseY.id}`, null, tokenX);
  console.log(`  GET /attendance/course/:courseY as DoctorX → HTTP ${r2.status}: ${r2.data?.message}`);
  record('B2', 'IDOR: Doctor X getCourseAttendance on courseY → 403', r2.status === 403,
    `HTTP=${r2.status}, msg=${r2.data?.message}`);
}

// ════════════════════════════════════════════════════════════════════════════
// TEST C — Duplicate attendance prevention (upsert)
// ════════════════════════════════════════════════════════════════════════════
async function testC() {
  console.log('\n── Test C: Duplicate attendance prevention ──');
  const course = await createTestCourse('__TC_C');
  const { user: uA, doctor: dA } = await createTestDoctor('test_docC@test.com', 'C');
  const { student: s1 } = await createTestStudent('test_studentC@test.com', 'STUC001');

  // Make doctor scope this course via a section
  await createTestSection(course.id, dA.id);

  const tokenDoc = makeToken(uA.id);
  const payload = {
    courseId: course.id, date: '2025-02-15',
    records: [{ studentId: s1.id, status: 'PRESENT', remarks: 'First call' }]
  };

  // First call
  const r1 = await api('POST', '/attendance', payload, tokenDoc);
  console.log(`  1st POST /attendance → HTTP ${r1.status}`);

  // Second call same date — should upsert not duplicate
  const payload2 = { ...payload, records: [{ studentId: s1.id, status: 'LATE', remarks: 'Second call' }] };
  const r2 = await api('POST', '/attendance', payload2, tokenDoc);
  console.log(`  2nd POST /attendance (same student/course/date) → HTTP ${r2.status}`);

  // Check DB directly
  const attendanceDate = new Date('2025-02-15');
  attendanceDate.setHours(0,0,0,0);
  const rows = await prisma.attendance.findMany({
    where: { studentId: s1.id, courseId: course.id, date: attendanceDate }
  });
  console.log(`  DB rows for studentId=${s1.id}, courseId=${course.id}, date=2025-02-15: ${rows.length}`);
  console.log(`  Row status: ${rows.map(r => r.status).join(', ')}`);

  record('C', 'Duplicate attendance upsert: exactly 1 row after 2 calls',
    rows.length === 1 && rows[0].status === 'LATE',
    `rowCount=${rows.length}, status=${rows[0]?.status}`
  );
}

// ════════════════════════════════════════════════════════════════════════════
// TEST D — Excused absence: excluded from denominator in % calculation
// ════════════════════════════════════════════════════════════════════════════
async function testD() {
  console.log('\n── Test D: Excused absence excluded from percentage denominator ──');
  const course = await createTestCourse('__TC_D');
  const { user: uS, student: s1 } = await createTestStudent('test_studentD@test.com', 'STUD001');

  // Insert 10 records: 7 PRESENT, 1 LATE, 2 EXCUSED
  const records = [
    ...Array.from({length:7}, (_,i) => ({ status:'PRESENT', date: new Date(`2025-03-0${i+1}`) })),
    { status: 'LATE', date: new Date('2025-03-08') },
    { status: 'EXCUSED', date: new Date('2025-03-09') },
    { status: 'EXCUSED', date: new Date('2025-03-10') },
  ];
  for (const r of records) {
    await prisma.attendance.create({ data: { studentId: s1.id, courseId: course.id, date: r.date, status: r.status } });
  }

  const tokenS = makeToken(uS.id);
  const { status, data } = await api('GET', `/attendance/student/${s1.id}?courseId=${course.id}`, null, tokenS);
  const pct = data.stats?.percentage;
  const expected = ((7 + 0.5) / 8) * 100; // 93.75

  console.log(`  GET /attendance/student/:id → HTTP ${status}`);
  console.log(`  stats: ${JSON.stringify(data.stats)}`);
  console.log(`  Expected attendance%: ${expected}, Got: ${pct}`);

  record('D', `Excused excluded: attendance% = ${expected}%`,
    Math.abs(pct - expected) < 0.01,
    `expected=${expected}, got=${pct}`
  );
}

// ════════════════════════════════════════════════════════════════════════════
// TEST E — Absence threshold: auto-block + unblock
// ════════════════════════════════════════════════════════════════════════════
async function testE() {
  console.log('\n── Test E: Absence threshold auto-block and admin unblock ──');
  const course = await createTestCourse('__TC_E');
  const { user: uD, doctor: dD } = await createTestDoctor('test_docE@test.com', 'E');
  const { user: uS, student: sE } = await createTestStudent('test_studentE@test.com', 'STUE001');
  const { user: uAdmin } = await createTestAdmin('test_adminE@test.com');

  await createTestSection(course.id, dD.id);

  // Enroll the student
  await prisma.enrollment.create({
    data: { studentId: sE.id, courseId: course.id, semester: 1, academicYear: 2025, status: 'ENROLLED' }
  });

  // Set policy: max 25% absence
  await prisma.absenceThresholdPolicy.create({ data: { courseId: course.id, maxAbsencePercent: 25 } });

  const tokenDoc = makeToken(uD.id);

  // Record 4 absences and 1 present → 4/5 = 80% absent → should trigger block
  const dates = ['2025-04-01','2025-04-02','2025-04-03','2025-04-04','2025-04-05'];
  const statuses = ['ABSENT','ABSENT','ABSENT','ABSENT','PRESENT'];

  for (let i = 0; i < dates.length; i++) {
    await api('POST', '/attendance', {
      courseId: course.id, date: dates[i],
      records: [{ studentId: sE.id, status: statuses[i], remarks: '' }]
    }, tokenDoc);
  }

  // Wait longer for async recalculation to complete
  await new Promise(r => setTimeout(r, 2000));

  const enrollment = await prisma.enrollment.findFirst({ where: { studentId: sE.id, courseId: course.id } });
  console.log(`  Enrollment status after 4/5 absences (80%): ${enrollment?.status}`);
  record('E1', 'Auto-block: enrollment status = BLOCKED after exceeding 25% threshold',
    enrollment?.status === 'BLOCKED',
    `status=${enrollment?.status}`
  );

  // Admin unblocks
  const tokenAdmin = makeToken(uAdmin.id);
  const { status: unblockStatus, data: unblockData } = await api('POST', `/attendance/unblock/${enrollment.id}`, null, tokenAdmin);
  console.log(`  POST /attendance/unblock/:id → HTTP ${unblockStatus}: ${unblockData?.message}`);

  const afterUnblock = await prisma.enrollment.findUnique({ where: { id: enrollment.id } });
  console.log(`  Enrollment status after unblock: ${afterUnblock?.status}`);
  record('E2', 'Admin unblock: enrollment status reverts to ENROLLED',
    unblockStatus === 200 && afterUnblock?.status === 'ENROLLED',
    `HTTP=${unblockStatus}, status=${afterUnblock?.status}`
  );
}

// ════════════════════════════════════════════════════════════════════════════
// TEST F — Schedule conflict detection with overrides
// ════════════════════════════════════════════════════════════════════════════
async function testF() {
  console.log('\n── Test F: Schedule conflict detection with overrides ──');
  const course = await createTestCourse('__TC_F');
  const { user: uD, doctor: dD } = await createTestDoctor('test_docF@test.com', 'F');
  const section = await createTestSection(course.id, dD.id);

  const tokenAdmin = makeToken((await createTestAdmin('test_adminF@test.com')).user.id);

  // Create base slot: Room 101, Monday 09:00–10:00
  const baseSlot = await prisma.scheduleSlot.create({
    data: {
      courseSectionId: section.id, dayOfWeek: 'MONDAY',
      startTime: '09:00', endTime: '10:00', room: 'ROOM101', sessionType: 'LECTURE'
    }
  });
  console.log(`  Created base slot id=${baseSlot.id} Room=ROOM101 Monday 09:00-10:00`);

  // Create active override: move to Room 102 for specific date range (covers "today")
  const overrideStart = new Date(); overrideStart.setDate(overrideStart.getDate() - 1);
  const overrideEnd = new Date(); overrideEnd.setDate(overrideEnd.getDate() + 7);

  await prisma.scheduleOverride.create({
    data: {
      scheduleSlotId: baseSlot.id, startDate: overrideStart, endDate: overrideEnd,
      room: 'ROOM102', dayOfWeek: 'MONDAY', startTime: '09:00', endTime: '10:00',
      createdBy: (await prisma.user.findFirst({ where: { email: 'test_adminF@test.com' } })).id
    }
  });
  console.log(`  Created override: ROOM101→ROOM102 for Monday 09:00-10:00`);

  // Create a second course/section for conflict testing
  const course2 = await createTestCourse('__TC_F2');
  const { doctor: dD2 } = await createTestDoctor('test_docF2@test.com', 'F2');
  const section2 = await createTestSection(course2.id, dD2.id);

  // F1: Attempt new slot in ROOM101 Monday 09:00-10:00 → should SUCCEED (room freed by override)
  // (Testing via direct DB insertion to simulate the service layer check)
  // We do this by calling the conflict checker directly through the API if possible,
  // or via a schedule creation call.
  const r1 = await api('POST', '/schedules', {
    courseSectionId: section2.id, dayOfWeek: 'MONDAY',
    startTime: '09:00', endTime: '10:00', room: 'ROOM101', sessionType: 'LECTURE'
  }, tokenAdmin);
  console.log(`  F1: New slot ROOM101 Mon 09-10 (room freed by override) → HTTP ${r1.status}: ${r1.data?.message || JSON.stringify(r1.data?.data?.id)}`);
  record('F1', 'Override frees Room101: new slot in Room101 succeeds',
    r1.status === 201,
    `HTTP=${r1.status}, msg=${r1.data?.message}`
  );

  // F2: Attempt new slot in ROOM102 Monday 09:00-10:00 → should be REJECTED (override occupies ROOM102)
  const course3 = await createTestCourse('__TC_F3');
  const { doctor: dD3 } = await createTestDoctor('test_docF3@test.com', 'F3');
  const section3 = await createTestSection(course3.id, dD3.id);

  const r2 = await api('POST', '/schedules', {
    courseSectionId: section3.id, dayOfWeek: 'MONDAY',
    startTime: '09:00', endTime: '10:00', room: 'ROOM102', sessionType: 'LECTURE'
  }, tokenAdmin);
  console.log(`  F2: New slot ROOM102 Mon 09-10 (override in ROOM102) → HTTP ${r2.status}: ${r2.data?.message}`);
  record('F2', 'Override occupies Room102: new slot in Room102 rejected with conflict',
    r2.status === 409,
    `HTTP=${r2.status}, msg=${r2.data?.message}`
  );
}

// ════════════════════════════════════════════════════════════════════════════
// TEST G — Race condition: two simultaneous bookings for same slot
// ════════════════════════════════════════════════════════════════════════════
async function testG() {
  console.log('\n── Test G: Race condition — simultaneous double-booking ──');
  const course1 = await createTestCourse('__TC_G1');
  const course2 = await createTestCourse('__TC_G2');
  const { user: uD1, doctor: dD1 } = await createTestDoctor('test_docG1@test.com', 'G1');
  const { doctor: dD2 } = await createTestDoctor('test_docG2@test.com', 'G2');
  const section1 = await createTestSection(course1.id, dD1.id);
  const section2 = await createTestSection(course2.id, dD2.id);

  const { user: adminG } = await createTestAdmin('test_adminG@test.com');
  const tokenAdmin = makeToken(adminG.id);

  const payload1 = {
    courseSectionId: section1.id, dayOfWeek: 'TUESDAY',
    startTime: '11:00', endTime: '12:00', room: 'ROOMG99', sessionType: 'LECTURE'
  };
  const payload2 = {
    courseSectionId: section2.id, dayOfWeek: 'TUESDAY',
    startTime: '11:00', endTime: '12:00', room: 'ROOMG99', sessionType: 'LECTURE'
  };

  // Fire both simultaneously
  const [r1, r2] = await Promise.all([
    api('POST', '/schedules', payload1, tokenAdmin),
    api('POST', '/schedules', payload2, tokenAdmin),
  ]);

  const statuses = [r1.status, r2.status].sort();
  console.log(`  Concurrent booking results: HTTP ${r1.status}, HTTP ${r2.status}`);
  console.log(`  Msg1: ${r1.data?.message}`);
  console.log(`  Msg2: ${r2.data?.message}`);

  // Check DB: exactly one slot should exist for ROOMG99 on TUESDAY 11:00-12:00
  const rows = await prisma.scheduleSlot.findMany({
    where: { room: 'ROOMG99', dayOfWeek: 'TUESDAY', startTime: '11:00', endTime: '12:00' }
  });
  console.log(`  DB rows for ROOMG99 TUESDAY 11:00-12:00: ${rows.length}`);

  const oneSucceeded = statuses.includes(201);
  const oneRejected = statuses.includes(409);
  record('G', 'Race condition: exactly 1 booking succeeds, 1 rejected (409)',
    rows.length === 1 && oneSucceeded && oneRejected,
    `statuses=[${r1.status},${r2.status}], dbRows=${rows.length}`
  );
}

// ════════════════════════════════════════════════════════════════════════════
// TEST H — Instructor schedule request workflow
// ════════════════════════════════════════════════════════════════════════════
async function testH() {
  console.log('\n── Test H: Instructor schedule request workflow ──');
  const course1 = await createTestCourse('__TC_H1');
  const course2 = await createTestCourse('__TC_H2');
  const { user: uDoc1, doctor: dDoc1 } = await createTestDoctor('test_docH1@test.com', 'H1');
  const { doctor: dDoc2 } = await createTestDoctor('test_docH2@test.com', 'H2');
  const section1 = await createTestSection(course1.id, dDoc1.id);
  const section2 = await createTestSection(course2.id, dDoc2.id);

  const { user: adminH } = await createTestAdmin('test_adminH@test.com');
  const tokenDoc1 = makeToken(uDoc1.id);
  const tokenAdmin = makeToken(adminH.id);

  // H1: Doctor submits request for their OWN section → should succeed (201)
  const r1 = await api('POST', '/requests', {
    type: 'NEW_SLOT',
    courseSectionId: section1.id,
    proposedData: { dayOfWeek: 'WEDNESDAY', startTime: '10:00', endTime: '11:00', room: 'ROOMH1', sessionType: 'LECTURE' },
    reason: 'Testing new slot request'
  }, tokenDoc1);
  console.log(`  H1: Doctor creates request for own section → HTTP ${r1.status}: ${r1.data?.message || `id=${r1.data?.data?.id}`}`);
  record('H1', 'Doctor creates request for own section → 201',
    r1.status === 201,
    `HTTP=${r1.status}, msg=${r1.data?.message}`
  );

  // H2: Doctor submits request for ANOTHER doctor's section → should be rejected (403)
  const r2 = await api('POST', '/requests', {
    type: 'NEW_SLOT',
    courseSectionId: section2.id,
    proposedData: { dayOfWeek: 'WEDNESDAY', startTime: '10:00', endTime: '11:00', room: 'ROOMH2', sessionType: 'LECTURE' },
    reason: 'Testing unauthorized request'
  }, tokenDoc1);
  console.log(`  H2: Doctor creates request for other section → HTTP ${r2.status}: ${r2.data?.message}`);
  record('H2', 'Doctor blocked from requesting other doctor\'s section → 403',
    r2.status === 403,
    `HTTP=${r2.status}, msg=${r2.data?.message}`
  );

  // H3: Admin approves the first request → slot should be created atomically
  const requestId = r1.data?.data?.id;
  if (!requestId) {
    record('H3', 'Admin approves request → slot created atomically', false, 'No requestId to approve (H1 failed)');
    return;
  }

  const r3 = await api('PUT', `/requests/${requestId}/approve`, { adminComment: 'Looks good' }, tokenAdmin);
  console.log(`  H3: Admin approves request ${requestId} → HTTP ${r3.status}: ${r3.data?.message}`);

  // Verify: the schedule slot should now exist
  const slot = await prisma.scheduleSlot.findFirst({
    where: { courseSectionId: section1.id, dayOfWeek: 'WEDNESDAY', startTime: '10:00', room: 'ROOMH1' }
  });
  // Verify: request status is APPROVED
  const req = await prisma.scheduleChangeRequest.findUnique({ where: { id: requestId } });
  console.log(`  Slot created: ${slot ? `id=${slot.id}` : 'NOT FOUND'}`);
  console.log(`  Request status: ${req?.status}`);

  record('H3', 'Admin approves request: slot created + request status=APPROVED',
    r3.status === 200 && slot !== null && req?.status === 'APPROVED',
    `HTTP=${r3.status}, slotFound=${!!slot}, reqStatus=${req?.status}`
  );
}

// ════════════════════════════════════════════════════════════════════════════
// TEST I — Doctor deletion blocked by active quiz/task
// ════════════════════════════════════════════════════════════════════════════
async function testI() {
  console.log('\n── Test I: Doctor deletion blocked by active quiz/task ──');
  const course = await createTestCourse('__TC_I');
  const { user: uDoc, doctor: dDoc } = await createTestDoctor('test_docI@test.com', 'I');
  const { user: adminI } = await createTestAdmin('test_adminI@test.com');
  const tokenAdmin = makeToken(adminI.id);

  await prisma.quiz.create({
    data: {
      title: 'Test Quiz',
      courseId: course.id,
      doctorId: dDoc.id,
      duration: 30,
    }
  });

  const r = await api('DELETE', `/doctors/${dDoc.id}`, null, tokenAdmin);
  console.log(`  DELETE /doctors/${dDoc.id} → HTTP ${r.status}: ${r.data?.message}`);
  record('I', 'Doctor with active quiz cannot be deleted (400)',
    r.status === 400 && r.data?.message?.includes('active quizzes'),
    `HTTP=${r.status}, msg=${r.data?.message}`
  );
}

// ════════════════════════════════════════════════════════════════════════════
// TEST J — Department deletion blocked by active student group
// ════════════════════════════════════════════════════════════════════════════
async function testJ() {
  console.log('\n── Test J: Department deletion blocked by active student group ──');
  const { user: adminJ } = await createTestAdmin('test_adminJ@test.com');
  const tokenAdmin = makeToken(adminJ.id);

  const dept = await prisma.department.create({
    data: { name: '__TestDeptJ__', collegeId: testCollegeId }
  });
  await prisma.studentGroup.create({
    data: { name: 'Group J', departmentId: dept.id }
  });

  const r = await api('DELETE', `/departments/${dept.id}`, null, tokenAdmin);
  console.log(`  DELETE /departments/${dept.id} → HTTP ${r.status}: ${r.data?.message}`);
  record('J', 'Department with active student group cannot be deleted (400)',
    r.status === 400 && r.data?.message?.includes('active student group'),
    `HTTP=${r.status}, msg=${r.data?.message}`
  );
}

// ════════════════════════════════════════════════════════════════════════════
// TEST K — User deactivation preserves records and blocks login
// ════════════════════════════════════════════════════════════════════════════
async function testK() {
  console.log('\n── Test K: User deactivation preserves records and blocks login ──');
  const { user: uK, doctor: dK } = await createTestDoctor('test_dock@test.com', 'K');
  const { user: adminK } = await createTestAdmin('test_admink@test.com');
  const tokenAdmin = makeToken(adminK.id);

  const course = await createTestCourse('__TC_K');
  const section = await createTestSection(course.id, dK.id);

  const tokenDoc = makeToken(uK.id);
  const r1 = await api('POST', '/requests', {
    type: 'NEW_SLOT',
    courseSectionId: section.id,
    proposedData: { dayOfWeek: 'FRIDAY', startTime: '10:00', endTime: '11:00', room: 'ROOMK', sessionType: 'LECTURE' },
    reason: 'Testing preservation'
  }, tokenDoc);

  const rDelete = await api('DELETE', `/users/${uK.id}`, null, tokenAdmin);
  console.log(`  DELETE /users/${uK.id} (deactivate) → HTTP ${rDelete.status}: ${rDelete.data?.message}`);

  const rLogin = await api('POST', '/auth/login', { email: 'test_dock@test.com', password: 'Test1234!' });
  console.log(`  POST /auth/login (deactivated user) → HTTP ${rLogin.status}: ${rLogin.data?.message}`);

  const requests = await prisma.scheduleChangeRequest.findMany({ where: { requesterId: uK.id } });
  
  record('K', 'User deactivation blocks login and preserves schedule requests',
    rLogin.status === 401 && rLogin.data?.message?.includes('deactivated') && requests.length > 0,
    `loginHTTP=${rLogin.status}, msg=${rLogin.data?.message}, preservedRequests=${requests.length}`
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════════════════════════════════════
async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   UNIVERSITY MANAGEMENT SYSTEM — INTEGRATION TEST SUITE       ');
  console.log('═══════════════════════════════════════════════════════════════');

  try {
    console.log('\n[SETUP] Cleaning test data...');
    await cleanup();
    resetIds(); // clear stale in-memory IDs after cleanup

    await testA();
    await testB();
    await testC();
    await testD();
    await testE();
    await testF();
    await testG();
    await testH();
    await testI();
    await testJ();
    await testK();

  } catch (err) {
    console.error('\n[FATAL ERROR]', err);
  } finally {
    console.log('\n[TEARDOWN] Cleaning test data...');
    await cleanup();
    await prisma.$disconnect();
  }

  // ── Summary Table ──────────────────────────────────────────────────────────
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  RESULTS SUMMARY                                               ');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  ID    │ Label                                            │ Result');
  console.log('  ──────┼──────────────────────────────────────────────────┼────────');
  for (const r of results) {
    const status = r.passed ? '✅ PASS' : '❌ FAIL';
    const detail = r.passed ? '' : ` [${r.detail}]`;
    console.log(`  ${r.id.padEnd(5)} │ ${r.label.slice(0,48).padEnd(48)} │ ${status}${detail}`);
  }
  const passed = results.filter(r => r.passed).length;
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  TOTAL: ${passed}/${results.length} passed`);
  console.log('═══════════════════════════════════════════════════════════════');
}

main();


