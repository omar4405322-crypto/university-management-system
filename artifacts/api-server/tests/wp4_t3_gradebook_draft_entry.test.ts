import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import prisma from '../src/utils/prismaClient';
import { generateAccessToken } from '../src/utils/jwt.utils';

function makeSuffix(tag: string) {
  return `wp4_t3_${tag}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

let sharedServer: http.Server | null = null;
let sharedBaseUrl: string = '';

async function getTestBaseUrl(): Promise<string> {
  if (!sharedServer) {
    const { default: app } = await import('../src/app');
    sharedServer = http.createServer(app);
    await new Promise<void>((resolve) => sharedServer!.listen(0, '127.0.0.1', resolve));
    const address = sharedServer.address();
    assert.ok(address && typeof address === 'object');
    sharedBaseUrl = `http://127.0.0.1:${address.port}/api`;
  }
  return sharedBaseUrl;
}

interface TestContext {
  collegeOwn: any;
  collegeOther: any;
  deptOwn: any;
  deptOther: any;
  course: any;
  termCurrent: any;
  termPast: any;
  groupA: any;
  groupB: any;
  studentA: any;
  studentB: any;
  studentWithdrawn: any;
  enrollmentA: any;
  enrollmentB: any;
  enrollmentWithdrawn: any;
  structure: any;
  compMidterm: any;
  compQuiz: any;
  compFinal: any;
  actors: {
    superAdminToken: string;
    collegeAdminOwnToken: string;
    collegeAdminOtherToken: string;
    deptAdminOwnToken: string;
    deptAdminOtherToken: string;
    doctorAssignedToken: string;
    doctorUnassignedToken: string;
    taAssignedGroupAToken: string;
    taAssignedCourseWideToken: string;
    taUnassignedToken: string;
    studentEnrolledToken: string;
    studentUnenrolledToken: string;
  };
  cleanup: () => Promise<void>;
}

async function setupTestContext(suffix: string): Promise<TestContext> {
  const passwordHash = await bcrypt.hash('Secret123!', 4);

  // 1. Colleges & Departments
  const collegeOwn = await prisma.college.create({ data: { name: `Col_Own_${suffix}` } });
  const collegeOther = await prisma.college.create({ data: { name: `Col_Oth_${suffix}` } });
  const deptOwn = await prisma.department.create({ data: { name: `Dept_Own_${suffix}`, collegeId: collegeOwn.id } });
  const deptOther = await prisma.department.create({ data: { name: `Dept_Oth_${suffix}`, collegeId: collegeOther.id } });

  // 2. Academic Terms
  const termCurrent = await prisma.academicTerm.findFirstOrThrow({
    where: { isCurrent: true },
  });
  const termPast = await prisma.academicTerm.create({
    data: {
      name: `Term_Past_${suffix}`,
      academicYearId: termCurrent.academicYearId,
      termType: 'SPRING',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-05-01'),
      isCurrent: false,
    },
  });

  // 3. Course
  const course = await prisma.course.create({
    data: { name: `Course_${suffix}`, courseCode: `C_${suffix.slice(-6)}`, credits: 3, year: 1, semester: 1, departmentId: deptOwn.id },
  });

  // 4. Student Groups
  const groupA = await prisma.studentGroup.create({ data: { name: `GroupA_${suffix}`, departmentId: deptOwn.id, year: 1 } });
  const groupB = await prisma.studentGroup.create({ data: { name: `GroupB_${suffix}`, departmentId: deptOwn.id, year: 1 } });

  // 5. Users & Roles
  // SUPER_ADMIN
  const saUser = await prisma.user.create({ data: { email: `sa_${suffix}@uni.edu`, password: passwordHash, role: 'SUPER_ADMIN' } });
  const superAdminToken = generateAccessToken(saUser.id, saUser.tokenVersion);

  // COLLEGE_ADMIN Own & Other
  const caOwnUser = await prisma.user.create({ data: { email: `ca_own_${suffix}@uni.edu`, password: passwordHash, role: 'COLLEGE_ADMIN', managedCollegeId: collegeOwn.id, collegeId: collegeOwn.id } });
  const collegeAdminOwnToken = generateAccessToken(caOwnUser.id, caOwnUser.tokenVersion);
  const caOtherUser = await prisma.user.create({ data: { email: `ca_oth_${suffix}@uni.edu`, password: passwordHash, role: 'COLLEGE_ADMIN', managedCollegeId: collegeOther.id, collegeId: collegeOther.id } });
  const collegeAdminOtherToken = generateAccessToken(caOtherUser.id, caOtherUser.tokenVersion);

  // DEPT_ADMIN Own & Other
  const daOwnUser = await prisma.user.create({ data: { email: `da_own_${suffix}@uni.edu`, password: passwordHash, role: 'DEPARTMENT_ADMIN', managedDepartmentId: deptOwn.id, departmentId: deptOwn.id } });
  const deptAdminOwnToken = generateAccessToken(daOwnUser.id, daOwnUser.tokenVersion);
  const daOtherUser = await prisma.user.create({ data: { email: `da_oth_${suffix}@uni.edu`, password: passwordHash, role: 'DEPARTMENT_ADMIN', managedDepartmentId: deptOther.id, departmentId: deptOther.id } });
  const deptAdminOtherToken = generateAccessToken(daOtherUser.id, daOtherUser.tokenVersion);

  // DOCTOR Assigned & Unassigned
  const docAssignedUser = await prisma.user.create({ data: { email: `doc_asg_${suffix}@uni.edu`, password: passwordHash, role: 'DOCTOR', departmentId: deptOwn.id } });
  const docAssigned = await prisma.doctor.create({ data: { userId: docAssignedUser.id, firstName: 'Assigned', lastName: 'Doctor', departmentId: deptOwn.id, specialty: 'CS' } });
  const doctorAssignedToken = generateAccessToken(docAssignedUser.id, docAssignedUser.tokenVersion);
  const docUnassignedUser = await prisma.user.create({ data: { email: `doc_unasg_${suffix}@uni.edu`, password: passwordHash, role: 'DOCTOR', departmentId: deptOwn.id } });
  await prisma.doctor.create({ data: { userId: docUnassignedUser.id, firstName: 'Unassigned', lastName: 'Doctor', departmentId: deptOwn.id, specialty: 'CS' } });
  const doctorUnassignedToken = generateAccessToken(docUnassignedUser.id, docUnassignedUser.tokenVersion);

  // TA Assigned with Group A & TA Assigned Course-Wide & TA Unassigned
  const taGroupAUser = await prisma.user.create({ data: { email: `ta_grpA_${suffix}@uni.edu`, password: passwordHash, role: 'TEACHING_ASSISTANT', departmentId: deptOwn.id } });
  const taGroupA = await prisma.teachingAssistant.create({ data: { userId: taGroupAUser.id, firstName: 'TA', lastName: 'GroupA', employeeId: `TAG_${suffix}`, departmentId: deptOwn.id } });
  const taAssignedGroupAToken = generateAccessToken(taGroupAUser.id, taGroupAUser.tokenVersion);

  const taCourseWideUser = await prisma.user.create({ data: { email: `ta_cw_${suffix}@uni.edu`, password: passwordHash, role: 'TEACHING_ASSISTANT', departmentId: deptOwn.id } });
  const taCourseWide = await prisma.teachingAssistant.create({ data: { userId: taCourseWideUser.id, firstName: 'TA', lastName: 'CourseWide', employeeId: `TACW_${suffix}`, departmentId: deptOwn.id } });
  const taAssignedCourseWideToken = generateAccessToken(taCourseWideUser.id, taCourseWideUser.tokenVersion);

  const taUnassignedUser = await prisma.user.create({ data: { email: `ta_unasg_${suffix}@uni.edu`, password: passwordHash, role: 'TEACHING_ASSISTANT', departmentId: deptOwn.id } });
  await prisma.teachingAssistant.create({ data: { userId: taUnassignedUser.id, firstName: 'TA', lastName: 'Unassigned', employeeId: `TAU_${suffix}`, departmentId: deptOwn.id } });
  const taUnassignedToken = generateAccessToken(taUnassignedUser.id, taUnassignedUser.tokenVersion);

  // STUDENTS: Student A (in Group A), Student B (in Group B), Student Withdrawn, Student Unenrolled
  const stuAUser = await prisma.user.create({ data: { email: `stu_a_${suffix}@uni.edu`, password: passwordHash, role: 'STUDENT', departmentId: deptOwn.id } });
  const studentA = await prisma.student.create({ data: { userId: stuAUser.id, firstName: 'Alice', lastName: 'Student', studentId: `STUA_${suffix}`, year: 1, departmentId: deptOwn.id, groupId: groupA.id } });
  const studentEnrolledToken = generateAccessToken(stuAUser.id, stuAUser.tokenVersion);

  const stuBUser = await prisma.user.create({ data: { email: `stu_b_${suffix}@uni.edu`, password: passwordHash, role: 'STUDENT', departmentId: deptOwn.id } });
  const studentB = await prisma.student.create({ data: { userId: stuBUser.id, firstName: 'Bob', lastName: 'Student', studentId: `STUB_${suffix}`, year: 1, departmentId: deptOwn.id, groupId: groupB.id } });

  const stuWUser = await prisma.user.create({ data: { email: `stu_w_${suffix}@uni.edu`, password: passwordHash, role: 'STUDENT', departmentId: deptOwn.id } });
  const studentWithdrawn = await prisma.student.create({ data: { userId: stuWUser.id, firstName: 'Withdrawn', lastName: 'Student', studentId: `STUW_${suffix}`, year: 1, departmentId: deptOwn.id, groupId: groupA.id } });

  const stuUnenrUser = await prisma.user.create({ data: { email: `stu_unenr_${suffix}@uni.edu`, password: passwordHash, role: 'STUDENT', departmentId: deptOwn.id } });
  await prisma.student.create({ data: { userId: stuUnenrUser.id, firstName: 'Unenrolled', lastName: 'Student', studentId: `STUUN_${suffix}`, year: 1, departmentId: deptOwn.id } });
  const studentUnenrolledToken = generateAccessToken(stuUnenrUser.id, stuUnenrUser.tokenVersion);

  // 6. Schedule Slots (Assignments)
  // Doctor slot
  await prisma.scheduleSlot.create({
    data: { courseId: course.id, termId: termCurrent.id, doctorId: docAssigned.id, dayOfWeek: 'MONDAY', startTime: '09:00', endTime: '11:00', slotType: 'LECTURE', isArchived: false },
  });
  // TA Group A slot (explicit groupId = groupA.id)
  await prisma.scheduleSlot.create({
    data: { courseId: course.id, termId: termCurrent.id, teachingAssistantId: taGroupA.id, groupId: groupA.id, dayOfWeek: 'TUESDAY', startTime: '11:00', endTime: '13:00', slotType: 'LAB', isArchived: false },
  });
  // TA Course-Wide slot (groupId = null)
  await prisma.scheduleSlot.create({
    data: { courseId: course.id, termId: termCurrent.id, teachingAssistantId: taCourseWide.id, groupId: null, dayOfWeek: 'WEDNESDAY', startTime: '13:00', endTime: '15:00', slotType: 'LAB', isArchived: false },
  });

  // 7. Enrollments
  const enrollmentA = await prisma.enrollment.create({
    data: { studentId: studentA.id, courseId: course.id, termId: termCurrent.id, semester: 1, academicYear: 2026, status: 'ENROLLED' },
  });
  const enrollmentB = await prisma.enrollment.create({
    data: { studentId: studentB.id, courseId: course.id, termId: termCurrent.id, semester: 1, academicYear: 2026, status: 'ENROLLED' },
  });
  const enrollmentWithdrawn = await prisma.enrollment.create({
    data: { studentId: studentWithdrawn.id, courseId: course.id, termId: termCurrent.id, semester: 1, academicYear: 2026, status: 'WITHDRAWN' },
  });

  // 8. Grade Structure & Components
  const structure = await prisma.courseGradeStructure.create({
    data: { courseId: course.id, termId: termCurrent.id, passMark: 50.0 },
  });
  const compQuiz = await prisma.courseGradeComponent.create({
    data: { structureId: structure.id, name: 'Quizzes', maxPoints: 20.0, source: 'AUTO_QUIZ', displayOrder: 1 },
  });
  const compMidterm = await prisma.courseGradeComponent.create({
    data: { structureId: structure.id, name: 'Midterm Exam', maxPoints: 30.0, source: 'MANUAL', displayOrder: 2 },
  });
  const compFinal = await prisma.courseGradeComponent.create({
    data: { structureId: structure.id, name: 'Final Exam', maxPoints: 50.0, source: 'MANUAL', displayOrder: 3 },
  });

  const cleanup = async () => {
    await prisma.courseGradeEntry.deleteMany({ where: { enrollment: { courseId: course.id } } }).catch(() => {});
    await prisma.courseGradeComponent.deleteMany({ where: { structureId: structure.id } }).catch(() => {});
    await prisma.courseGradeStructure.deleteMany({ where: { courseId: course.id } }).catch(() => {});
    await prisma.enrollment.deleteMany({ where: { courseId: course.id } }).catch(() => {});
    await prisma.scheduleSlot.deleteMany({ where: { courseId: course.id } }).catch(() => {});
    await prisma.course.deleteMany({ where: { id: course.id } }).catch(() => {});
    if (termPast?.id) await prisma.academicTerm.deleteMany({ where: { id: termPast.id } }).catch(() => {});
    await prisma.student.deleteMany({ where: { departmentId: { in: [deptOwn.id, deptOther.id] } } }).catch(() => {});
    await prisma.studentGroup.deleteMany({ where: { id: { in: [groupA.id, groupB.id] } } }).catch(() => {});
    await prisma.teachingAssistant.deleteMany({ where: { departmentId: { in: [deptOwn.id, deptOther.id] } } }).catch(() => {});
    await prisma.doctor.deleteMany({ where: { departmentId: { in: [deptOwn.id, deptOther.id] } } }).catch(() => {});
    await prisma.department.deleteMany({ where: { id: { in: [deptOwn.id, deptOther.id] } } }).catch(() => {});
    await prisma.college.deleteMany({ where: { id: { in: [collegeOwn.id, collegeOther.id] } } }).catch(() => {});
    await prisma.user.deleteMany({
      where: {
        id: {
          in: [
            saUser.id, caOwnUser.id, caOtherUser.id, daOwnUser.id, daOtherUser.id,
            docAssignedUser.id, docUnassignedUser.id, taGroupAUser.id, taCourseWideUser.id,
            taUnassignedUser.id, stuAUser.id, stuBUser.id, stuWUser.id, stuUnenrUser.id,
          ],
        },
      },
    }).catch(() => {});
  };

  return {
    collegeOwn, collegeOther, deptOwn, deptOther, course, termCurrent, termPast,
    groupA, groupB, studentA, studentB, studentWithdrawn,
    enrollmentA, enrollmentB, enrollmentWithdrawn,
    structure, compMidterm, compQuiz, compFinal,
    actors: {
      superAdminToken, collegeAdminOwnToken, collegeAdminOtherToken, deptAdminOwnToken, deptAdminOtherToken,
      doctorAssignedToken, doctorUnassignedToken, taAssignedGroupAToken, taAssignedCourseWideToken,
      taUnassignedToken, studentEnrolledToken, studentUnenrolledToken,
    },
    cleanup,
  };
}

// -------------------------------------------------------------
// Suite 1: Table-Driven Role Authorization on GET /api/courses/:courseId/gradebook
// -------------------------------------------------------------
const getAuthCases = [
  { roleName: 'SUPER_ADMIN', tokenKey: 'superAdminToken', expectedStatus: 200 },
  { roleName: 'COLLEGE_ADMIN (own)', tokenKey: 'collegeAdminOwnToken', expectedStatus: 200 },
  { roleName: 'COLLEGE_ADMIN (other)', tokenKey: 'collegeAdminOtherToken', expectedStatus: 403 },
  { roleName: 'DEPARTMENT_ADMIN (own)', tokenKey: 'deptAdminOwnToken', expectedStatus: 200 },
  { roleName: 'DEPARTMENT_ADMIN (other)', tokenKey: 'deptAdminOtherToken', expectedStatus: 403 },
  { roleName: 'DOCTOR (assigned)', tokenKey: 'doctorAssignedToken', expectedStatus: 200 },
  { roleName: 'DOCTOR (unassigned)', tokenKey: 'doctorUnassignedToken', expectedStatus: 403 },
  { roleName: 'TA (assigned group A)', tokenKey: 'taAssignedGroupAToken', expectedStatus: 200 },
  { roleName: 'TA (assigned course-wide)', tokenKey: 'taAssignedCourseWideToken', expectedStatus: 200 },
  { roleName: 'TA (unassigned)', tokenKey: 'taUnassignedToken', expectedStatus: 403 },
  { roleName: 'STUDENT (enrolled)', tokenKey: 'studentEnrolledToken', expectedStatus: 403 },
  { roleName: 'STUDENT (unenrolled)', tokenKey: 'studentUnenrolledToken', expectedStatus: 403 },
  { roleName: 'ANONYMOUS', tokenKey: null, expectedStatus: 401 },
];

for (const tc of getAuthCases) {
  test(`WP-4 T-3 GET Gradebook Auth: ${tc.roleName} -> ${tc.expectedStatus}`, async () => {
    const suffix = makeSuffix(`auth_${tc.roleName.replace(/[^a-zA-Z0-9]/g, '_')}`);
    const ctx = await setupTestContext(suffix);
    const baseUrl = await getTestBaseUrl();

    try {
      const url = `${baseUrl}/courses/${ctx.course.id}/gradebook?termId=${ctx.termCurrent.id}`;
      const headers: Record<string, string> = {};
      if (tc.tokenKey) {
        headers.Authorization = `Bearer ${(ctx.actors as any)[tc.tokenKey]}`;
      }

      const res = await fetch(url, { headers });
      assert.strictEqual(
        res.status,
        tc.expectedStatus,
        `${tc.roleName} expected ${tc.expectedStatus}, got ${res.status}`
      );
    } finally {
      await ctx.cleanup();
    }
  });
}

// -------------------------------------------------------------
// Suite 2: TA Scoping vs Course-Wide, WITHDRAWN Exclusion & Shape Formatting
// -------------------------------------------------------------
test('WP-4 T-3 GET Gradebook Scoping: TA Group Scoping, WITHDRAWN Exclusion, and AUTO Value Null', async () => {
  const suffix = makeSuffix('scoping_test');
  const ctx = await setupTestContext(suffix);
  const baseUrl = await getTestBaseUrl();

  try {
    const url = `${baseUrl}/courses/${ctx.course.id}/gradebook?termId=${ctx.termCurrent.id}`;

    // 1. Doctor sees both enrolled students (Alice and Bob), but NOT Withdrawn student
    const resDoc = await fetch(url, { headers: { Authorization: `Bearer ${ctx.actors.doctorAssignedToken}` } });
    assert.strictEqual(resDoc.status, 200);
    const jsonDoc = await resDoc.json();
    assert.strictEqual(jsonDoc.success, true);
    assert.strictEqual(jsonDoc.data.courseId, ctx.course.id);
    assert.strictEqual(jsonDoc.data.termId, ctx.termCurrent.id);
    assert.strictEqual(jsonDoc.data.structure.totalPoints, 100);
    assert.strictEqual(jsonDoc.data.structure.passMark, 50);

    const docStudents = jsonDoc.data.students;
    const docStudentIds = docStudents.map((s: any) => s.studentId);
    assert.ok(docStudentIds.includes(ctx.studentA.id), 'Doctor must see Student A');
    assert.ok(docStudentIds.includes(ctx.studentB.id), 'Doctor must see Student B');
    assert.ok(!docStudentIds.includes(ctx.studentWithdrawn.id), 'Doctor must NOT see WITHDRAWN student');

    // Verify AUTO component formatting has value: null and source
    const firstStudent = docStudents[0];
    const quizGrade = firstStudent.grades.find((g: any) => g.componentId === ctx.compQuiz.id);
    assert.ok(quizGrade, 'Quiz component grade item must exist');
    assert.strictEqual(quizGrade.value, null, 'AUTO component must have value: null');
    assert.strictEqual(quizGrade.source, 'AUTO_QUIZ', 'AUTO component must expose source');

    // 2. TA Group A (slot specifies groupA.id): must see ONLY Student A, NOT Student B, NOT Withdrawn
    const resTaA = await fetch(url, { headers: { Authorization: `Bearer ${ctx.actors.taAssignedGroupAToken}` } });
    assert.strictEqual(resTaA.status, 200);
    const jsonTaA = await resTaA.json();
    const taAStudentIds = jsonTaA.data.students.map((s: any) => s.studentId);
    assert.ok(taAStudentIds.includes(ctx.studentA.id), 'TA Group A must see Student A');
    assert.ok(!taAStudentIds.includes(ctx.studentB.id), 'TA Group A must NOT see Student B');
    assert.ok(!taAStudentIds.includes(ctx.studentWithdrawn.id), 'TA Group A must NOT see Withdrawn student');

    // 3. TA Course-Wide (slot has groupId: null): sees both Student A and Student B
    const resTaCW = await fetch(url, { headers: { Authorization: `Bearer ${ctx.actors.taAssignedCourseWideToken}` } });
    assert.strictEqual(resTaCW.status, 200);
    const jsonTaCW = await resTaCW.json();
    const taCWStudentIds = jsonTaCW.data.students.map((s: any) => s.studentId);
    assert.ok(taCWStudentIds.includes(ctx.studentA.id), 'Course-Wide TA must see Student A');
    assert.ok(taCWStudentIds.includes(ctx.studentB.id), 'Course-Wide TA must see Student B');
    assert.ok(!taCWStudentIds.includes(ctx.studentWithdrawn.id), 'Course-Wide TA must NOT see Withdrawn student');
  } finally {
    await ctx.cleanup();
  }
});

// -------------------------------------------------------------
// Suite 3: Table-Driven Role Authorization on POST /api/courses/:courseId/gradebook/draft
// -------------------------------------------------------------
const postAuthCases = [
  { roleName: 'DOCTOR (assigned)', tokenKey: 'doctorAssignedToken', expectedStatus: 200 },
  { roleName: 'TA (assigned group A)', tokenKey: 'taAssignedGroupAToken', expectedStatus: 200 },
  { roleName: 'TA (assigned course-wide)', tokenKey: 'taAssignedCourseWideToken', expectedStatus: 200 },
  { roleName: 'SUPER_ADMIN', tokenKey: 'superAdminToken', expectedStatus: 403 },
  { roleName: 'COLLEGE_ADMIN (own)', tokenKey: 'collegeAdminOwnToken', expectedStatus: 403 },
  { roleName: 'DEPARTMENT_ADMIN (own)', tokenKey: 'deptAdminOwnToken', expectedStatus: 403 },
  { roleName: 'DOCTOR (unassigned)', tokenKey: 'doctorUnassignedToken', expectedStatus: 403 },
  { roleName: 'TA (unassigned)', tokenKey: 'taUnassignedToken', expectedStatus: 403 },
  { roleName: 'STUDENT (enrolled)', tokenKey: 'studentEnrolledToken', expectedStatus: 403 },
  { roleName: 'ANONYMOUS', tokenKey: null, expectedStatus: 401 },
];

for (const tc of postAuthCases) {
  test(`WP-4 T-3 POST Draft Auth: ${tc.roleName} -> ${tc.expectedStatus}`, async () => {
    const suffix = makeSuffix(`post_auth_${tc.roleName.replace(/[^a-zA-Z0-9]/g, '_')}`);
    const ctx = await setupTestContext(suffix);
    const baseUrl = await getTestBaseUrl();

    try {
      const url = `${baseUrl}/courses/${ctx.course.id}/gradebook/draft?termId=${ctx.termCurrent.id}`;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (tc.tokenKey) {
        headers.Authorization = `Bearer ${(ctx.actors as any)[tc.tokenKey]}`;
      }

      const body = {
        entries: [
          {
            enrollmentId: ctx.enrollmentA.id,
            componentId: ctx.compMidterm.id,
            score: 25.0,
            isAbsent: false,
            notes: 'Good job',
          },
        ],
      };

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      assert.strictEqual(
        res.status,
        tc.expectedStatus,
        `${tc.roleName} expected ${tc.expectedStatus}, got ${res.status}`
      );
    } finally {
      await ctx.cleanup();
    }
  });
}

// -------------------------------------------------------------
// Suite 4: Rule D1 Invariants (AUTO component 422, Scope & Withdrawn 422/403)
// -------------------------------------------------------------
test('WP-4 T-3 Rule D1: Component & Enrollment Invariants on Draft POST', async () => {
  const suffix = makeSuffix('d1_invariants');
  const ctx = await setupTestContext(suffix);
  const baseUrl = await getTestBaseUrl();
  const url = `${baseUrl}/courses/${ctx.course.id}/gradebook/draft?termId=${ctx.termCurrent.id}`;
  const docAuth = { Authorization: `Bearer ${ctx.actors.doctorAssignedToken}`, 'Content-Type': 'application/json' };
  const taAuth = { Authorization: `Bearer ${ctx.actors.taAssignedGroupAToken}`, 'Content-Type': 'application/json' };

  try {
    // 1. AUTO component must return 422
    const resAuto = await fetch(url, {
      method: 'POST',
      headers: docAuth,
      body: JSON.stringify({
        entries: [{ enrollmentId: ctx.enrollmentA.id, componentId: ctx.compQuiz.id, score: 18.0, isAbsent: false }],
      }),
    });
    assert.strictEqual(resAuto.status, 422, 'Grading AUTO component must return 422');

    // 2. Foreign componentId from outside structure must return 422
    const resForeignComp = await fetch(url, {
      method: 'POST',
      headers: docAuth,
      body: JSON.stringify({
        entries: [{ enrollmentId: ctx.enrollmentA.id, componentId: 999999, score: 20.0, isAbsent: false }],
      }),
    });
    assert.strictEqual(resForeignComp.status, 422, 'Foreign componentId must return 422');

    // 3. WITHDRAWN enrollment must return 422
    const resWithdrawn = await fetch(url, {
      method: 'POST',
      headers: docAuth,
      body: JSON.stringify({
        entries: [{ enrollmentId: ctx.enrollmentWithdrawn.id, componentId: ctx.compMidterm.id, score: 20.0, isAbsent: false }],
      }),
    });
    assert.strictEqual(resWithdrawn.status, 422, 'Grading WITHDRAWN enrollment must return 422');

    // 4. TA Group A grading Student B (outside group scope) must return 403
    const resTaOutOfScope = await fetch(url, {
      method: 'POST',
      headers: taAuth,
      body: JSON.stringify({
        entries: [{ enrollmentId: ctx.enrollmentB.id, componentId: ctx.compMidterm.id, score: 20.0, isAbsent: false }],
      }),
    });
    assert.strictEqual(resTaOutOfScope.status, 403, 'TA grading student outside group scope must return 403');
  } finally {
    await ctx.cleanup();
  }
});

// -------------------------------------------------------------
// Suite 5: Rule D2 Boundaries (Score numbers, bounds, absence, notes)
// -------------------------------------------------------------
test('WP-4 T-3 Rule D2: Score Boundaries & Absence Rules on Draft POST', async () => {
  const suffix = makeSuffix('d2_boundaries');
  const ctx = await setupTestContext(suffix);
  const baseUrl = await getTestBaseUrl();
  const url = `${baseUrl}/courses/${ctx.course.id}/gradebook/draft?termId=${ctx.termCurrent.id}`;
  const docAuth = { Authorization: `Bearer ${ctx.actors.doctorAssignedToken}`, 'Content-Type': 'application/json' };

  try {
    // 1. String score rejected -> 422
    const resString = await fetch(url, {
      method: 'POST',
      headers: docAuth,
      body: JSON.stringify({
        entries: [{ enrollmentId: ctx.enrollmentA.id, componentId: ctx.compMidterm.id, score: "25", isAbsent: false }],
      }),
    });
    assert.strictEqual(resString.status, 422, 'String score must return 422');

    // 2. Negative score rejected -> 422
    const resNeg = await fetch(url, {
      method: 'POST',
      headers: docAuth,
      body: JSON.stringify({
        entries: [{ enrollmentId: ctx.enrollmentA.id, componentId: ctx.compMidterm.id, score: -5, isAbsent: false }],
      }),
    });
    assert.strictEqual(resNeg.status, 422, 'Negative score must return 422');

    // 3. Score exceeding component maxPoints (30.0) -> 422
    const resExceed = await fetch(url, {
      method: 'POST',
      headers: docAuth,
      body: JSON.stringify({
        entries: [{ enrollmentId: ctx.enrollmentA.id, componentId: ctx.compMidterm.id, score: 35.0, isAbsent: false }],
      }),
    });
    assert.strictEqual(resExceed.status, 422, 'Score exceeding maxPoints must return 422');

    // 4. Score with > 2 decimal places -> 422
    const resDecimals = await fetch(url, {
      method: 'POST',
      headers: docAuth,
      body: JSON.stringify({
        entries: [{ enrollmentId: ctx.enrollmentA.id, componentId: ctx.compMidterm.id, score: 25.125, isAbsent: false }],
      }),
    });
    assert.strictEqual(resDecimals.status, 422, 'Score with > 2 decimal places must return 422');

    // 5. isAbsent true with non-null score -> 422
    const resAbsentScore = await fetch(url, {
      method: 'POST',
      headers: docAuth,
      body: JSON.stringify({
        entries: [{ enrollmentId: ctx.enrollmentA.id, componentId: ctx.compMidterm.id, score: 20.0, isAbsent: true }],
      }),
    });
    assert.strictEqual(resAbsentScore.status, 422, 'isAbsent true with non-null score must return 422');

    // 6. Notes with control characters -> 422
    const resNotesCtrl = await fetch(url, {
      method: 'POST',
      headers: docAuth,
      body: JSON.stringify({
        entries: [{ enrollmentId: ctx.enrollmentA.id, componentId: ctx.compMidterm.id, score: 20.0, isAbsent: false, notes: 'Hello\x00World' }],
      }),
    });
    assert.strictEqual(resNotesCtrl.status, 422, 'Notes with control characters must return 422');

    // 7. Notes with angle brackets -> 422
    const resNotesAngle = await fetch(url, {
      method: 'POST',
      headers: docAuth,
      body: JSON.stringify({
        entries: [{ enrollmentId: ctx.enrollmentA.id, componentId: ctx.compMidterm.id, score: 20.0, isAbsent: false, notes: '<script>alert(1)</script>' }],
      }),
    });
    assert.strictEqual(resNotesAngle.status, 422, 'Notes with angle brackets must return 422');

    // 8. Valid isAbsent true with score null -> 200
    const resAbsentValid = await fetch(url, {
      method: 'POST',
      headers: docAuth,
      body: JSON.stringify({
        entries: [{ enrollmentId: ctx.enrollmentA.id, componentId: ctx.compMidterm.id, score: null, isAbsent: true, notes: 'Excused illness' }],
      }),
    });
    assert.strictEqual(resAbsentValid.status, 200, 'Valid absence with null score must return 200');
  } finally {
    await ctx.cleanup();
  }
});

// -------------------------------------------------------------
// Suite 6: Rule D3 (Optimistic Locking, Published Protection, Unchanged & Clear)
// -------------------------------------------------------------
test('WP-4 T-3 Rule D3: Optimistic Locking, Published Lock, Unchanged No-Op & Draft Clear', async () => {
  const suffix = makeSuffix('d3_versioning');
  const ctx = await setupTestContext(suffix);
  const baseUrl = await getTestBaseUrl();
  const url = `${baseUrl}/courses/${ctx.course.id}/gradebook/draft?termId=${ctx.termCurrent.id}`;
  const docAuth = { Authorization: `Bearer ${ctx.actors.doctorAssignedToken}`, 'Content-Type': 'application/json' };

  try {
    // 1. Initial draft creation sets version = 1
    const resInit = await fetch(url, {
      method: 'POST',
      headers: docAuth,
      body: JSON.stringify({
        entries: [{ enrollmentId: ctx.enrollmentA.id, componentId: ctx.compMidterm.id, score: 25.0, isAbsent: false }],
      }),
    });
    assert.strictEqual(resInit.status, 200);

    const savedEntry = await prisma.courseGradeEntry.findUnique({
      where: { enrollmentId_componentId: { enrollmentId: ctx.enrollmentA.id, componentId: ctx.compMidterm.id } },
    });
    assert.ok(savedEntry);
    assert.strictEqual(savedEntry.score, 25.0);
    assert.strictEqual(savedEntry.version, 1);
    assert.strictEqual(savedEntry.status, 'DRAFT');

    // 2. Updating existing entry without version -> 409
    const resNoVer = await fetch(url, {
      method: 'POST',
      headers: docAuth,
      body: JSON.stringify({
        entries: [{ enrollmentId: ctx.enrollmentA.id, componentId: ctx.compMidterm.id, score: 26.0, isAbsent: false }],
      }),
    });
    assert.strictEqual(resNoVer.status, 409, 'Updating existing entry without version must return 409');

    // 3. Updating with stale version (e.g. 0 or 99) -> 409
    const resStale = await fetch(url, {
      method: 'POST',
      headers: docAuth,
      body: JSON.stringify({
        entries: [{ enrollmentId: ctx.enrollmentA.id, componentId: ctx.compMidterm.id, score: 26.0, isAbsent: false, version: 99 }],
      }),
    });
    assert.strictEqual(resStale.status, 409, 'Stale version must return 409');

    // 4. Update with matching version (version = 1) -> succeeds, version bumps to 2
    const resValidUpdate = await fetch(url, {
      method: 'POST',
      headers: docAuth,
      body: JSON.stringify({
        entries: [{ enrollmentId: ctx.enrollmentA.id, componentId: ctx.compMidterm.id, score: 28.0, isAbsent: false, version: 1 }],
      }),
    });
    assert.strictEqual(resValidUpdate.status, 200);
    const updatedEntry = await prisma.courseGradeEntry.findUnique({
      where: { enrollmentId_componentId: { enrollmentId: ctx.enrollmentA.id, componentId: ctx.compMidterm.id } },
    });
    assert.strictEqual(updatedEntry?.score, 28.0);
    assert.strictEqual(updatedEntry?.version, 2);

    // 5. Unchanged entry causes no version bump and no new audit item
    const auditCountBefore = await prisma.auditLog.count({ where: { action: 'GRADE_DRAFT_SAVED' } });
    const resUnchanged = await fetch(url, {
      method: 'POST',
      headers: docAuth,
      body: JSON.stringify({
        entries: [{ enrollmentId: ctx.enrollmentA.id, componentId: ctx.compMidterm.id, score: 28.0, isAbsent: false, version: 2 }],
      }),
    });
    assert.strictEqual(resUnchanged.status, 200);
    const entryAfterUnchanged = await prisma.courseGradeEntry.findUnique({
      where: { enrollmentId_componentId: { enrollmentId: ctx.enrollmentA.id, componentId: ctx.compMidterm.id } },
    });
    assert.strictEqual(entryAfterUnchanged?.version, 2, 'Unchanged entry version must remain 2');
    const auditCountAfter = await prisma.auditLog.count({ where: { action: 'GRADE_DRAFT_SAVED' } });
    assert.strictEqual(auditCountAfter, auditCountBefore, 'Unchanged entry must not create an audit row');

    // 6. Clearing draft row: score null with isAbsent false clears draft row
    const resClear = await fetch(url, {
      method: 'POST',
      headers: docAuth,
      body: JSON.stringify({
        entries: [{ enrollmentId: ctx.enrollmentA.id, componentId: ctx.compMidterm.id, score: null, isAbsent: false, version: 2 }],
      }),
    });
    assert.strictEqual(resClear.status, 200);
    const clearedEntry = await prisma.courseGradeEntry.findUnique({
      where: { enrollmentId_componentId: { enrollmentId: ctx.enrollmentA.id, componentId: ctx.compMidterm.id } },
    });
    assert.strictEqual(clearedEntry, null, 'Cleared draft entry row must be deleted');

    // 7. Modifying a PUBLISHED entry returns 409
    const pubEntry = await prisma.courseGradeEntry.create({
      data: {
        enrollmentId: ctx.enrollmentA.id,
        componentId: ctx.compFinal.id,
        score: 45.0,
        status: 'PUBLISHED',
        version: 1,
      },
    });

    const resPubMod = await fetch(url, {
      method: 'POST',
      headers: docAuth,
      body: JSON.stringify({
        entries: [{ enrollmentId: ctx.enrollmentA.id, componentId: ctx.compFinal.id, score: 48.0, isAbsent: false, version: 1 }],
      }),
    });
    assert.strictEqual(resPubMod.status, 409, 'Draft endpoint must return 409 when touching PUBLISHED entry');
  } finally {
    await ctx.cleanup();
  }
});

// -------------------------------------------------------------
// Suite 7: Rule D4 (Atomic Batch, Duplicate Pairs, Past-Term Lock & Concurrency)
// -------------------------------------------------------------
test('WP-4 T-3 Rule D4: Atomic Batch Rollback, Duplicate Pairs, Past Term & Parallel Writes', async () => {
  const suffix = makeSuffix('d4_atomic');
  const ctx = await setupTestContext(suffix);
  const baseUrl = await getTestBaseUrl();
  const url = `${baseUrl}/courses/${ctx.course.id}/gradebook/draft?termId=${ctx.termCurrent.id}`;
  const docAuth = { Authorization: `Bearer ${ctx.actors.doctorAssignedToken}`, 'Content-Type': 'application/json' };

  try {
    // 1. Duplicate (enrollmentId, componentId) pair in payload rejects with 422
    const resDup = await fetch(url, {
      method: 'POST',
      headers: docAuth,
      body: JSON.stringify({
        entries: [
          { enrollmentId: ctx.enrollmentA.id, componentId: ctx.compMidterm.id, score: 20.0, isAbsent: false },
          { enrollmentId: ctx.enrollmentA.id, componentId: ctx.compMidterm.id, score: 22.0, isAbsent: false },
        ],
      }),
    });
    assert.strictEqual(resDup.status, 422, 'Duplicate enrollment and component in payload must return 422');

    // 2. Atomic rollback: 1 valid entry and 1 invalid entry (score > max) writes NOTHING
    const resRollback = await fetch(url, {
      method: 'POST',
      headers: docAuth,
      body: JSON.stringify({
        entries: [
          { enrollmentId: ctx.enrollmentA.id, componentId: ctx.compMidterm.id, score: 20.0, isAbsent: false },
          { enrollmentId: ctx.enrollmentB.id, componentId: ctx.compMidterm.id, score: 99.0, isAbsent: false }, // Invalid!
        ],
      }),
    });
    assert.strictEqual(resRollback.status, 422);
    const countAfterRollback = await prisma.courseGradeEntry.count({
      where: { enrollment: { courseId: ctx.course.id } },
    });
    assert.strictEqual(countAfterRollback, 0, 'Transactional rollback must ensure zero entries written');

    // 3. Past term lock returns 409
    const urlPast = `${baseUrl}/courses/${ctx.course.id}/gradebook/draft?termId=${ctx.termPast.id}`;
    const resPast = await fetch(urlPast, {
      method: 'POST',
      headers: docAuth,
      body: JSON.stringify({
        entries: [{ enrollmentId: ctx.enrollmentA.id, componentId: ctx.compMidterm.id, score: 20.0, isAbsent: false }],
      }),
    });
    assert.strictEqual(resPast.status, 409, 'Draft post in past term must return 409 Conflict');

    // 4. Parallel writes to one entry: optimistic lock ensures serializable consistency
    // Setup initial row
    await fetch(url, {
      method: 'POST',
      headers: docAuth,
      body: JSON.stringify({
        entries: [{ enrollmentId: ctx.enrollmentA.id, componentId: ctx.compMidterm.id, score: 20.0, isAbsent: false }],
      }),
    });

    // Two parallel requests both send version: 1
    const [resP1, resP2] = await Promise.all([
      fetch(url, {
        method: 'POST',
        headers: docAuth,
        body: JSON.stringify({
          entries: [{ enrollmentId: ctx.enrollmentA.id, componentId: ctx.compMidterm.id, score: 21.0, isAbsent: false, version: 1 }],
        }),
      }),
      fetch(url, {
        method: 'POST',
        headers: docAuth,
        body: JSON.stringify({
          entries: [{ enrollmentId: ctx.enrollmentA.id, componentId: ctx.compMidterm.id, score: 22.0, isAbsent: false, version: 1 }],
        }),
      }),
    ]);

    const statuses = [resP1.status, resP2.status].sort();
    assert.deepStrictEqual(
      statuses,
      [200, 409],
      'Parallel updates to same version must result in exactly one 200 and one 409 Conflict'
    );
  } finally {
    await ctx.cleanup();
  }
});

// -------------------------------------------------------------
// Suite 8: Threat T2 - Student Isolation & Transcript Leakage
// -------------------------------------------------------------
test('WP-4 T-3 Threat T2: Student Grade Structure & Transcript Leaks No Draft Values', async () => {
  const suffix = makeSuffix('t2_student_leak');
  const ctx = await setupTestContext(suffix);
  const baseUrl = await getTestBaseUrl();
  const docAuth = { Authorization: `Bearer ${ctx.actors.doctorAssignedToken}`, 'Content-Type': 'application/json' };
  const stuAuth = { Authorization: `Bearer ${ctx.actors.studentEnrolledToken}` };

  try {
    // 1. Doctor enters a draft score of 28.0 for Student A on Midterm
    const urlDraft = `${baseUrl}/courses/${ctx.course.id}/gradebook/draft?termId=${ctx.termCurrent.id}`;
    const resDraft = await fetch(urlDraft, {
      method: 'POST',
      headers: docAuth,
      body: JSON.stringify({
        entries: [{ enrollmentId: ctx.enrollmentA.id, componentId: ctx.compMidterm.id, score: 28.0, isAbsent: false }],
      }),
    });
    assert.strictEqual(resDraft.status, 200);

    // 2. Student queries grade structure endpoint
    const urlStruct = `${baseUrl}/courses/${ctx.course.id}/grade-structure?termId=${ctx.termCurrent.id}`;
    const resStruct = await fetch(urlStruct, { headers: stuAuth });
    assert.strictEqual(resStruct.status, 200);
    const structBody = await resStruct.json();
    assert.strictEqual(structBody.success, true);
    const structData = structBody.data;
    assert.ok(structData, 'Grade structure response data must exist');
    assert.strictEqual(Array.isArray(structData.components), true, 'Components must be an array');

    // M-56: Verify structure response never leaks draft entries or student scores.
    // Instead of raw string matching on '28' (which false-positives on IDs or timestamps),
    // inspect parsed keys and values to ensure draft/entry data is completely absent.
    const forbiddenKeys = new Set(['entries', 'draft', 'draftScore', 'score', 'isAbsent', 'enrollmentId']);
    const assertNoDraftLeaks = (obj: any, path = 'data') => {
      if (!obj || typeof obj !== 'object') return;
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = `${path}.${key}`;
        assert.ok(
          !forbiddenKeys.has(key),
          `Grade structure response leaked sensitive key "${key}" at ${currentPath}`
        );
        if (key === 'score' || key === 'draftScore') {
          assert.notStrictEqual(value, 28, `Grade structure response leaked draft score value at ${currentPath}`);
        }
        if (typeof value === 'object' && value !== null) {
          assertNoDraftLeaks(value, currentPath);
        }
      }
    };
    assertNoDraftLeaks(structData);

    // 3. Student queries enrollments
    const resEnroll = await fetch(`${baseUrl}/enrollments`, { headers: stuAuth });
    assert.strictEqual(resEnroll.status, 200);
    const bodyEnroll = await resEnroll.json();
    const myEnroll = bodyEnroll.data.find((e: any) => e.id === ctx.enrollmentA.id);
    assert.ok(myEnroll);
    assert.strictEqual(myEnroll.finalGrade, null, 'finalGrade must remain null while grades are drafts');
  } finally {
    await ctx.cleanup();
  }
});

test.after(async () => {
  if (sharedServer) {
    await new Promise<void>((resolve) => sharedServer!.close(() => resolve()));
  }
});
