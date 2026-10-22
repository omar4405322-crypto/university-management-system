import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import prisma from '../src/utils/prismaClient';
import app from '../src/app';
import { generateAccessToken } from '../src/utils/jwt.utils';

let sharedServer: http.Server | null = null;
let sharedBaseUrl: string = '';

async function getTestBaseUrl(): Promise<string> {
  if (sharedServer) return sharedBaseUrl;
  sharedServer = http.createServer(app);
  await new Promise<void>((resolve) => {
    sharedServer!.listen(0, '127.0.0.1', () => {
      const addr = sharedServer!.address() as any;
      sharedBaseUrl = `http://127.0.0.1:${addr.port}/api`;
      resolve();
    });
  });
  return sharedBaseUrl;
}

function makeSuffix(testName: string): string {
  const rand = Math.floor(Math.random() * 1000000);
  const time = Date.now().toString().slice(-6);
  return `${testName}_${time}_${rand}`;
}

const passwordHash = '$2b$10$dummyhashedpasswordforisolatedtestsuitesonly0000';

/**
 * Setup a self-contained fixture with:
 * - 1 College, 1 Dept
 * - 1 Course
 * - 1 Current Term, 1 Past Term
 * - 1 Doctor (assigned to course via schedule slot)
 * - 1 Doctor (unassigned)
 * - 1 Teaching Assistant (assigned)
 * - 1 Super Admin, 1 College Admin
 * - 3 Students:
 *   - Student 1 (Enrolled)
 *   - Student 2 (Enrolled)
 *   - Student 3 (Withdrawn)
 *   - Student 4 (Unenrolled)
 * - 1 CourseGradeStructure with passMark: 50.0, components:
 *   - Comp 1: Quiz (10 pts, MANUAL)
 *   - Comp 2: Midterm (30 pts, MANUAL)
 *   - Comp 3: Final Exam (60 pts, MANUAL)
 *   Total = 100 pts.
 */
async function setupTestContext(suffix: string) {
  // 1. College & Dept
  const college = await prisma.college.create({ data: { name: `Col_${suffix}` } });
  const dept = await prisma.department.create({ data: { name: `Dept_${suffix}`, collegeId: college.id } });

  // 2. Terms
  const termCurrent = await prisma.academicTerm.findFirstOrThrow({ where: { isCurrent: true } });
  const termPast = await prisma.academicTerm.create({
    data: {
      name: `PastTerm_${suffix}`,
      academicYearId: termCurrent.academicYearId,
      termType: 'SPRING',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-05-01'),
      isCurrent: false,
    },
  });

  // 3. Course
  const course = await prisma.course.create({
    data: { name: `Course_${suffix}`, courseCode: `C_${suffix.slice(-6)}`, credits: 3, year: 1, semester: 1, departmentId: dept.id },
  });

  // 4. Users & Staff
  // Super Admin
  const saUser = await prisma.user.create({ data: { email: `sa_${suffix}@uni.edu`, password: passwordHash, role: 'SUPER_ADMIN' } });
  const saToken = generateAccessToken(saUser.id, saUser.tokenVersion);

  // College Admin
  const caUser = await prisma.user.create({
    data: { email: `ca_${suffix}@uni.edu`, password: passwordHash, role: 'COLLEGE_ADMIN', managedCollegeId: college.id, collegeId: college.id },
  });
  const caToken = generateAccessToken(caUser.id, caUser.tokenVersion);

  // Assigned Doctor
  const docUser = await prisma.user.create({ data: { email: `doc_asg_${suffix}@uni.edu`, password: passwordHash, role: 'DOCTOR' } });
  const doctorAssigned = await prisma.doctor.create({
    data: { userId: docUser.id, firstName: 'Doc', lastName: `Asg_${suffix}`, departmentId: dept.id },
  });
  const docToken = generateAccessToken(docUser.id, docUser.tokenVersion);

  // Unassigned Doctor
  const docUnasgUser = await prisma.user.create({ data: { email: `doc_unasg_${suffix}@uni.edu`, password: passwordHash, role: 'DOCTOR' } });
  const doctorUnassigned = await prisma.doctor.create({
    data: { userId: docUnasgUser.id, firstName: 'Doc', lastName: `Unasg_${suffix}`, departmentId: dept.id },
  });
  const docUnasgToken = generateAccessToken(docUnasgUser.id, docUnasgUser.tokenVersion);

  // Teaching Assistant
  const taUser = await prisma.user.create({ data: { email: `ta_${suffix}@uni.edu`, password: passwordHash, role: 'TEACHING_ASSISTANT' } });
  const ta = await prisma.teachingAssistant.create({
    data: { userId: taUser.id, firstName: 'TA', lastName: `Staff_${suffix}`, employeeId: `TA_${suffix.slice(-6)}`, departmentId: dept.id },
  });
  const taToken = generateAccessToken(taUser.id, taUser.tokenVersion);

  // Active Schedule Slots
  await prisma.scheduleSlot.create({
    data: {
      courseId: course.id,
      doctorId: doctorAssigned.id,
      termId: termCurrent.id,
      dayOfWeek: 'MONDAY',
      startTime: '09:00',
      endTime: '11:00',
      slotType: 'LECTURE',
    },
  });
  await prisma.scheduleSlot.create({
    data: {
      courseId: course.id,
      teachingAssistantId: ta.id,
      termId: termCurrent.id,
      dayOfWeek: 'TUESDAY',
      startTime: '11:00',
      endTime: '13:00',
      slotType: 'LAB',
    },
  });

  // 5. Students
  const stu1User = await prisma.user.create({ data: { email: `stu1_${suffix}@uni.edu`, password: passwordHash, role: 'STUDENT' } });
  const student1 = await prisma.student.create({ data: { userId: stu1User.id, firstName: 'Alice', lastName: `A_${suffix}`, studentId: `STU1_${suffix.slice(-6)}`, departmentId: dept.id, year: 1 } });
  const stu1Token = generateAccessToken(stu1User.id, stu1User.tokenVersion);

  const stu2User = await prisma.user.create({ data: { email: `stu2_${suffix}@uni.edu`, password: passwordHash, role: 'STUDENT' } });
  const student2 = await prisma.student.create({ data: { userId: stu2User.id, firstName: 'Bob', lastName: `B_${suffix}`, studentId: `STU2_${suffix.slice(-6)}`, departmentId: dept.id, year: 1 } });
  const stu2Token = generateAccessToken(stu2User.id, stu2User.tokenVersion);

  const stu3User = await prisma.user.create({ data: { email: `stu3_${suffix}@uni.edu`, password: passwordHash, role: 'STUDENT' } });
  const student3 = await prisma.student.create({ data: { userId: stu3User.id, firstName: 'Charlie', lastName: `C_${suffix}`, studentId: `STU3_${suffix.slice(-6)}`, departmentId: dept.id, year: 1 } });
  const stu3Token = generateAccessToken(stu3User.id, stu3User.tokenVersion);

  const stuUnenrUser = await prisma.user.create({ data: { email: `stu_un_${suffix}@uni.edu`, password: passwordHash, role: 'STUDENT' } });
  const studentUnenrolled = await prisma.student.create({ data: { userId: stuUnenrUser.id, firstName: 'Dave', lastName: `D_${suffix}`, studentId: `STU4_${suffix.slice(-6)}`, departmentId: dept.id, year: 1 } });
  const stuUnenrToken = generateAccessToken(stuUnenrUser.id, stuUnenrUser.tokenVersion);

  // Enrollments
  const enrollment1 = await prisma.enrollment.create({
    data: { studentId: student1.id, courseId: course.id, semester: 1, academicYear: 2026, termId: termCurrent.id, status: 'ENROLLED' },
  });
  const enrollment2 = await prisma.enrollment.create({
    data: { studentId: student2.id, courseId: course.id, semester: 1, academicYear: 2026, termId: termCurrent.id, status: 'ENROLLED' },
  });
  const enrollment3Withdrawn = await prisma.enrollment.create({
    data: { studentId: student3.id, courseId: course.id, semester: 1, academicYear: 2026, termId: termCurrent.id, status: 'WITHDRAWN' },
  });

  // 6. CourseGradeStructure
  const structure = await prisma.courseGradeStructure.create({
    data: { courseId: course.id, termId: termCurrent.id, passMark: 50.0 },
  });
  const compQuiz = await prisma.courseGradeComponent.create({
    data: { structureId: structure.id, name: 'Quizzes', maxPoints: 10.0, source: 'MANUAL', displayOrder: 1 },
  });
  const compMidterm = await prisma.courseGradeComponent.create({
    data: { structureId: structure.id, name: 'Midterm Exam', maxPoints: 30.0, source: 'MANUAL', displayOrder: 2 },
  });
  const compFinal = await prisma.courseGradeComponent.create({
    data: { structureId: structure.id, name: 'Final Exam', maxPoints: 60.0, source: 'MANUAL', displayOrder: 3 },
  });

  const cleanup = async () => {
    await prisma.courseGradeEntry.deleteMany({ where: { enrollment: { courseId: course.id } } }).catch(() => {});
    await prisma.courseGradeComponent.deleteMany({ where: { structureId: structure.id } }).catch(() => {});
    await prisma.courseGradeStructure.deleteMany({ where: { courseId: course.id } }).catch(() => {});
    await prisma.enrollment.deleteMany({ where: { courseId: course.id } }).catch(() => {});
    await prisma.scheduleSlot.deleteMany({ where: { courseId: course.id } }).catch(() => {});
    await prisma.course.deleteMany({ where: { id: course.id } }).catch(() => {});
    if (termPast?.id) await prisma.academicTerm.deleteMany({ where: { id: termPast.id } }).catch(() => {});
    await prisma.student.deleteMany({ where: { departmentId: dept.id } }).catch(() => {});
    await prisma.teachingAssistant.deleteMany({ where: { departmentId: dept.id } }).catch(() => {});
    await prisma.doctor.deleteMany({ where: { departmentId: dept.id } }).catch(() => {});
    await prisma.department.deleteMany({ where: { id: dept.id } }).catch(() => {});
    await prisma.college.deleteMany({ where: { id: college.id } }).catch(() => {});
    await prisma.user.deleteMany({
      where: {
        id: {
          in: [
            saUser.id, caUser.id, docUser.id, docUnasgUser.id, taUser.id,
            stu1User.id, stu2User.id, stu3User.id, stuUnenrUser.id,
          ],
        },
      },
    }).catch(() => {});
  };

  return {
    college, dept, course, termCurrent, termPast,
    doctorAssigned, doctorUnassigned, ta,
    student1, student2, student3, studentUnenrolled,
    enrollment1, enrollment2, enrollment3Withdrawn,
    structure, compQuiz, compMidterm, compFinal,
    tokens: {
      saToken, caToken, docToken, docUnasgToken, taToken,
      stu1Token, stu2Token, stu3Token, stuUnenrToken,
    },
    users: {
      saUser, caUser, docUser, docUnasgUser, taUser,
      stu1User, stu2User, stu3User, stuUnenrUser,
    },
    cleanup,
  };
}

// -------------------------------------------------------------
// Suite 1: S1 Role & Scope Authorization on POST /publish
// -------------------------------------------------------------
const publishAuthCases = [
  { roleName: 'DOCTOR (assigned)', tokenKey: 'docToken', expectedStatus: 200 },
  { roleName: 'DOCTOR (unassigned)', tokenKey: 'docUnasgToken', expectedStatus: 403 },
  { roleName: 'TEACHING_ASSISTANT', tokenKey: 'taToken', expectedStatus: 403 },
  { roleName: 'SUPER_ADMIN', tokenKey: 'saToken', expectedStatus: 403 },
  { roleName: 'COLLEGE_ADMIN', tokenKey: 'caToken', expectedStatus: 403 },
  { roleName: 'STUDENT', tokenKey: 'stu1Token', expectedStatus: 403 },
  { roleName: 'ANONYMOUS', tokenKey: null, expectedStatus: 401 },
];

for (const tc of publishAuthCases) {
  test(`WP-4 T-4 Publish Auth: ${tc.roleName} -> ${tc.expectedStatus}`, async () => {
    const suffix = makeSuffix(`pub_auth_${tc.roleName.replace(/[^a-zA-Z0-9]/g, '_')}`);
    const ctx = await setupTestContext(suffix);
    const baseUrl = await getTestBaseUrl();

    try {
      const url = `${baseUrl}/courses/${ctx.course.id}/gradebook/publish?termId=${ctx.termCurrent.id}`;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (tc.tokenKey) {
        headers.Authorization = `Bearer ${(ctx.tokens as any)[tc.tokenKey]}`;
      }

      const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify({}) });
      assert.strictEqual(res.status, tc.expectedStatus, `${tc.roleName} expected ${tc.expectedStatus}, got ${res.status}`);
    } finally {
      await ctx.cleanup();
    }
  });
}

// -------------------------------------------------------------
// Suite 2: S4 Role & Scope Authorization on POST /correct
// -------------------------------------------------------------
const correctAuthCases = [
  { roleName: 'DOCTOR (assigned)', tokenKey: 'docToken', expectedStatus: 200 },
  { roleName: 'DOCTOR (unassigned)', tokenKey: 'docUnasgToken', expectedStatus: 403 },
  { roleName: 'TEACHING_ASSISTANT', tokenKey: 'taToken', expectedStatus: 403 },
  { roleName: 'SUPER_ADMIN', tokenKey: 'saToken', expectedStatus: 403 },
  { roleName: 'STUDENT', tokenKey: 'stu1Token', expectedStatus: 403 },
  { roleName: 'ANONYMOUS', tokenKey: null, expectedStatus: 401 },
];

for (const tc of correctAuthCases) {
  test(`WP-4 T-4 Correct Auth: ${tc.roleName} -> ${tc.expectedStatus}`, async () => {
    const suffix = makeSuffix(`corr_auth_${tc.roleName.replace(/[^a-zA-Z0-9]/g, '_')}`);
    const ctx = await setupTestContext(suffix);
    const baseUrl = await getTestBaseUrl();

    // Create a published grade entry for correct endpoint test
    const pubEntry = await prisma.courseGradeEntry.create({
      data: {
        enrollmentId: ctx.enrollment1.id,
        componentId: ctx.compMidterm.id,
        score: 25.0,
        status: 'PUBLISHED',
        version: 1,
      },
    });

    try {
      const url = `${baseUrl}/courses/${ctx.course.id}/gradebook/correct?termId=${ctx.termCurrent.id}`;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (tc.tokenKey) {
        headers.Authorization = `Bearer ${(ctx.tokens as any)[tc.tokenKey]}`;
      }

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          corrections: [
            {
              enrollmentId: ctx.enrollment1.id,
              componentId: ctx.compMidterm.id,
              score: 28.0,
              isAbsent: false,
              version: 1,
              reason: 'Re-evaluation of question 2 gave full marks',
            },
          ],
        }),
      });

      assert.strictEqual(res.status, tc.expectedStatus, `${tc.roleName} expected ${tc.expectedStatus}, got ${res.status}`);
    } finally {
      await ctx.cleanup();
    }
  });
}

// -------------------------------------------------------------
// Suite 3: S6 Role Authorization on GET /api/enrollments/my-grades
// -------------------------------------------------------------
const myGradesAuthCases = [
  { roleName: 'STUDENT (enrolled)', tokenKey: 'stu1Token', expectedStatus: 200 },
  { roleName: 'STUDENT (unenrolled)', tokenKey: 'stuUnenrToken', expectedStatus: 200 },
  { roleName: 'DOCTOR', tokenKey: 'docToken', expectedStatus: 403 },
  { roleName: 'TEACHING_ASSISTANT', tokenKey: 'taToken', expectedStatus: 403 },
  { roleName: 'SUPER_ADMIN', tokenKey: 'saToken', expectedStatus: 403 },
  { roleName: 'ANONYMOUS', tokenKey: null, expectedStatus: 401 },
];

for (const tc of myGradesAuthCases) {
  test(`WP-4 T-4 My Grades Auth: ${tc.roleName} -> ${tc.expectedStatus}`, async () => {
    const suffix = makeSuffix(`mygrades_auth_${tc.roleName.replace(/[^a-zA-Z0-9]/g, '_')}`);
    const ctx = await setupTestContext(suffix);
    const baseUrl = await getTestBaseUrl();

    try {
      const url = `${baseUrl}/enrollments/my-grades`;
      const headers: Record<string, string> = {};
      if (tc.tokenKey) {
        headers.Authorization = `Bearer ${(ctx.tokens as any)[tc.tokenKey]}`;
      }

      const res = await fetch(url, { headers });
      assert.strictEqual(res.status, tc.expectedStatus, `${tc.roleName} expected ${tc.expectedStatus}, got ${res.status}`);
    } finally {
      await ctx.cleanup();
    }
  });
}

// -------------------------------------------------------------
// Suite 4: S2/S3 Completeness Matrix & PassMark Exact Hundredths Boundary
// -------------------------------------------------------------
test('WP-4 T-4 Completeness Matrix, PassMark Exact Hundredths Boundary & ABS Rule', async () => {
  const suffix = makeSuffix('complete_boundary');
  const ctx = await setupTestContext(suffix);
  const baseUrl = await getTestBaseUrl();
  const docAuth = { Authorization: `Bearer ${ctx.tokens.docToken}`, 'Content-Type': 'application/json' };

  try {
    // Student 1: Complete: Quiz (10), Midterm (15), Final (25) -> Total = 50.00 / 100. Exactly equals passMark (50.0) -> COMPLETED
    await prisma.courseGradeEntry.createMany({
      data: [
        { enrollmentId: ctx.enrollment1.id, componentId: ctx.compQuiz.id, score: 10.0, status: 'DRAFT', version: 1 },
        { enrollmentId: ctx.enrollment1.id, componentId: ctx.compMidterm.id, score: 15.0, status: 'DRAFT', version: 1 },
        { enrollmentId: ctx.enrollment1.id, componentId: ctx.compFinal.id, score: 25.0, status: 'DRAFT', version: 1 },
      ],
    });

    // Student 2: Complete: Quiz (10), Midterm (15), Final (24.99) -> Total = 49.99 / 100. One hundredth below passMark (50.0) -> FAILED
    await prisma.courseGradeEntry.createMany({
      data: [
        { enrollmentId: ctx.enrollment2.id, componentId: ctx.compQuiz.id, score: 10.0, status: 'DRAFT', version: 1 },
        { enrollmentId: ctx.enrollment2.id, componentId: ctx.compMidterm.id, score: 15.0, status: 'DRAFT', version: 1 },
        { enrollmentId: ctx.enrollment2.id, componentId: ctx.compFinal.id, score: 24.99, status: 'DRAFT', version: 1 },
      ],
    });

    const urlPub = `${baseUrl}/courses/${ctx.course.id}/gradebook/publish?termId=${ctx.termCurrent.id}`;
    const resPub = await fetch(urlPub, { method: 'POST', headers: docAuth, body: JSON.stringify({}) });
    assert.strictEqual(resPub.status, 200);

    const jsonPub = await resPub.json();
    assert.strictEqual(jsonPub.success, true);

    // Verify Student 1: 50.00 >= 50.00 -> COMPLETED
    const enroll1After = await prisma.enrollment.findUnique({ where: { id: ctx.enrollment1.id } });
    assert.ok(enroll1After);
    assert.strictEqual(enroll1After.finalPointsEarned, 50.0);
    assert.strictEqual(enroll1After.finalPointsMax, 100.0);
    assert.strictEqual(enroll1After.finalGrade, 50.0);
    assert.strictEqual(enroll1After.status, 'COMPLETED');

    // Verify Student 2: 49.99 < 50.00 -> FAILED
    const enroll2After = await prisma.enrollment.findUnique({ where: { id: ctx.enrollment2.id } });
    assert.ok(enroll2After);
    assert.strictEqual(enroll2After.finalPointsEarned, 49.99);
    assert.strictEqual(enroll2After.finalPointsMax, 100.0);
    assert.strictEqual(enroll2After.finalGrade, 49.99);
    assert.strictEqual(enroll2After.status, 'FAILED');

    // Verify entries were transitioned to PUBLISHED
    const entries1 = await prisma.courseGradeEntry.findMany({ where: { enrollmentId: ctx.enrollment1.id } });
    for (const e of entries1) {
      assert.strictEqual(e.status, 'PUBLISHED');
      assert.strictEqual(e.version, 2);
    }
  } finally {
    await ctx.cleanup();
  }
});

// -------------------------------------------------------------
// Suite 5: S3 Incomplete Untouched, Partial Publish & WITHDRAWN Skipped
// -------------------------------------------------------------
test('WP-4 T-4 Incomplete Untouched, Partial Publish & WITHDRAWN Skipped', async () => {
  const suffix = makeSuffix('incomplete_partial');
  const ctx = await setupTestContext(suffix);
  const baseUrl = await getTestBaseUrl();
  const docAuth = { Authorization: `Bearer ${ctx.tokens.docToken}`, 'Content-Type': 'application/json' };

  try {
    // Student 1 has only Quiz & Midterm (Final is missing -> Incomplete)
    await prisma.courseGradeEntry.createMany({
      data: [
        { enrollmentId: ctx.enrollment1.id, componentId: ctx.compQuiz.id, score: 9.0, status: 'DRAFT', version: 1 },
        { enrollmentId: ctx.enrollment1.id, componentId: ctx.compMidterm.id, score: 25.0, status: 'DRAFT', version: 1 },
      ],
    });

    // Student 2 is complete
    await prisma.courseGradeEntry.createMany({
      data: [
        { enrollmentId: ctx.enrollment2.id, componentId: ctx.compQuiz.id, score: 8.0, status: 'DRAFT', version: 1 },
        { enrollmentId: ctx.enrollment2.id, componentId: ctx.compMidterm.id, score: 25.0, status: 'DRAFT', version: 1 },
        { enrollmentId: ctx.enrollment2.id, componentId: ctx.compFinal.id, score: 50.0, status: 'DRAFT', version: 1 },
      ],
    });

    const urlPub = `${baseUrl}/courses/${ctx.course.id}/gradebook/publish?termId=${ctx.termCurrent.id}`;
    const resPub = await fetch(urlPub, { method: 'POST', headers: docAuth, body: JSON.stringify({}) });
    assert.strictEqual(resPub.status, 200);

    const jsonPub = await resPub.json();
    assert.ok(jsonPub.data.complete.some((c: any) => c.enrollmentId === ctx.enrollment2.id));
    assert.ok(jsonPub.data.incomplete.some((inc: any) => inc.enrollmentId === ctx.enrollment1.id));
    assert.ok(jsonPub.data.skipped.some((sk: any) => sk.enrollmentId === ctx.enrollment3Withdrawn.id));

    // Incomplete enrollment 1 must remain untouched
    const enroll1 = await prisma.enrollment.findUnique({ where: { id: ctx.enrollment1.id } });
    assert.strictEqual(enroll1?.finalGrade, null);
    assert.strictEqual(enroll1?.finalPointsEarned, null);
    assert.strictEqual(enroll1?.status, 'ENROLLED');
  } finally {
    await ctx.cleanup();
  }
});

// -------------------------------------------------------------
// Suite 6: S2 AUTO Component Unavailable (409) & Fake Calculator Injection
// -------------------------------------------------------------
test('WP-4 T-4 AUTO Component Unavailable 409 and Injected Calculator Snapshot', async () => {
  const suffix = makeSuffix('auto_calc');
  const ctx = await setupTestContext(suffix);
  const baseUrl = await getTestBaseUrl();
  const docAuth = { Authorization: `Bearer ${ctx.tokens.docToken}`, 'Content-Type': 'application/json' };

  // Add AUTO_QUIZ component to structure
  const autoComp = await prisma.courseGradeComponent.create({
    data: { structureId: ctx.structure.id, name: 'Online Quizzes', maxPoints: 10.0, source: 'AUTO_QUIZ', displayOrder: 4 },
  });

  try {
    // Student 1 has all MANUAL components entered
    await prisma.courseGradeEntry.createMany({
      data: [
        { enrollmentId: ctx.enrollment1.id, componentId: ctx.compQuiz.id, score: 10.0, status: 'DRAFT', version: 1 },
        { enrollmentId: ctx.enrollment1.id, componentId: ctx.compMidterm.id, score: 25.0, status: 'DRAFT', version: 1 },
        { enrollmentId: ctx.enrollment1.id, componentId: ctx.compFinal.id, score: 50.0, status: 'DRAFT', version: 1 },
      ],
    });

    const urlPub = `${baseUrl}/courses/${ctx.course.id}/gradebook/publish?termId=${ctx.termCurrent.id}`;

    // 1. Without calculator registered, publish complete enrollment must return 409 AUTO_CALCULATOR_UNAVAILABLE
    const resNoCalc = await fetch(urlPub, { method: 'POST', headers: docAuth, body: JSON.stringify({}) });
    assert.strictEqual(resNoCalc.status, 409);
    const jsonNoCalc = await resNoCalc.json();
    assert.match(jsonNoCalc.message, /AUTO_CALCULATOR_UNAVAILABLE/i);

    // 2. Inject fake calculator for AUTO_QUIZ
    const { registerGradeCalculator, unregisterGradeCalculator } = await import('../src/services/gradebookPublish.service');
    registerGradeCalculator('AUTO_QUIZ', async () => 9.5);

    try {
      const resWithCalc = await fetch(urlPub, { method: 'POST', headers: docAuth, body: JSON.stringify({}) });
      assert.strictEqual(resWithCalc.status, 200);

      // Verify AUTO component was snapshotted as PUBLISHED
      const autoEntry = await prisma.courseGradeEntry.findUnique({
        where: { enrollmentId_componentId: { enrollmentId: ctx.enrollment1.id, componentId: autoComp.id } },
      });
      assert.ok(autoEntry);
      assert.strictEqual(autoEntry.score, 9.5);
      assert.strictEqual(autoEntry.status, 'PUBLISHED');

      // Verify Enrollment final points earned includes the 9.5
      const enr1 = await prisma.enrollment.findUnique({ where: { id: ctx.enrollment1.id } });
      assert.strictEqual(enr1?.finalPointsEarned, 10.0 + 25.0 + 50.0 + 9.5); // 94.5
      assert.strictEqual(enr1?.status, 'COMPLETED');
    } finally {
      unregisterGradeCalculator('AUTO_QUIZ');
    }
  } finally {
    await prisma.courseGradeEntry.deleteMany({ where: { componentId: autoComp.id } });
    await prisma.courseGradeComponent.delete({ where: { id: autoComp.id } });
    await ctx.cleanup();
  }
});

const faultyAutoCalculatorCases: Array<{ label: string; value: number }> = [
  { label: 'NaN', value: Number.NaN },
  { label: 'Infinity', value: Number.POSITIVE_INFINITY },
  { label: 'negative', value: -1.5 },
  { label: 'above maxPoints', value: 10.01 },
  { label: 'three decimals', value: 8.125 },
];

for (const fc of faultyAutoCalculatorCases) {
  test(`WP-4 R1 C3: Faulty AUTO calculator returning ${fc.label} -> 409 AUTO_CALCULATOR_INVALID_RESULT and nothing written`, async () => {
    const suffix = makeSuffix(`c3_auto_${fc.label.replace(/[^a-zA-Z0-9]/g, '_')}`);
    const ctx = await setupTestContext(suffix);
    const baseUrl = await getTestBaseUrl();
    const docAuth = { Authorization: `Bearer ${ctx.tokens.docToken}`, 'Content-Type': 'application/json' };
    const { registerGradeCalculator, unregisterGradeCalculator } = await import('../src/services/gradebookPublish.service');

    const autoComp = await prisma.courseGradeComponent.create({
      data: { structureId: ctx.structure.id, name: 'Online Quizzes', maxPoints: 10.0, source: 'AUTO_QUIZ', displayOrder: 4 },
    });

    try {
      await prisma.courseGradeEntry.createMany({
        data: [
          { enrollmentId: ctx.enrollment1.id, componentId: ctx.compQuiz.id, score: 10.0, status: 'DRAFT', version: 1 },
          { enrollmentId: ctx.enrollment1.id, componentId: ctx.compMidterm.id, score: 25.0, status: 'DRAFT', version: 1 },
          { enrollmentId: ctx.enrollment1.id, componentId: ctx.compFinal.id, score: 50.0, status: 'DRAFT', version: 1 },
        ],
      });

      const auditCountBefore = await prisma.auditLog.count({
        where: { action: 'GRADE_PUBLISHED', entityId: String(ctx.course.id) },
      });

      registerGradeCalculator('AUTO_QUIZ', async () => fc.value);
      try {
        const urlPub = `${baseUrl}/courses/${ctx.course.id}/gradebook/publish?termId=${ctx.termCurrent.id}`;
        const res = await fetch(urlPub, { method: 'POST', headers: docAuth, body: JSON.stringify({}) });
        assert.strictEqual(res.status, 409, `Expected 409 for ${fc.label}, got ${res.status}`);
        const json = await res.json();
        assert.match(json.message, /AUTO_CALCULATOR_INVALID_RESULT/, `Expected AUTO_CALCULATOR_INVALID_RESULT in message for ${fc.label}, got: ${json.message}`);

        // Verify nothing was written for that request: manual drafts remain DRAFT v1, no AUTO entry created, enrollment untouched, no audit row
        const manualEntries = await prisma.courseGradeEntry.findMany({
          where: { enrollmentId: ctx.enrollment1.id, componentId: { in: [ctx.compQuiz.id, ctx.compMidterm.id, ctx.compFinal.id] } },
        });
        assert.strictEqual(manualEntries.length, 3);
        for (const me of manualEntries) {
          assert.strictEqual(me.status, 'DRAFT', `Manual entry ${me.id} must remain DRAFT on rollback`);
          assert.strictEqual(me.version, 1, `Manual entry ${me.id} version must remain 1 on rollback`);
        }

        const autoEntry = await prisma.courseGradeEntry.findUnique({
          where: { enrollmentId_componentId: { enrollmentId: ctx.enrollment1.id, componentId: autoComp.id } },
        });
        assert.strictEqual(autoEntry, null, 'No AUTO grade entry may be persisted');

        const enrAfter = await prisma.enrollment.findUnique({ where: { id: ctx.enrollment1.id } });
        assert.strictEqual(enrAfter?.status, 'ENROLLED');
        assert.strictEqual(enrAfter?.finalPointsEarned, null);
        assert.strictEqual(enrAfter?.finalPointsMax, null);
        assert.strictEqual(enrAfter?.finalGrade, null);

        const auditCountAfter = await prisma.auditLog.count({
          where: { action: 'GRADE_PUBLISHED', entityId: String(ctx.course.id) },
        });
        assert.strictEqual(auditCountAfter, auditCountBefore, 'No GRADE_PUBLISHED audit row may be written on failure');
      } finally {
        unregisterGradeCalculator('AUTO_QUIZ');
      }
    } finally {
      await prisma.courseGradeEntry.deleteMany({ where: { componentId: autoComp.id } }).catch(() => {});
      await prisma.courseGradeComponent.deleteMany({ where: { id: autoComp.id } }).catch(() => {});
      await ctx.cleanup();
    }
  });
}

// -------------------------------------------------------------
// Suite 7: S4 Gradebook Correction Service & Recomputation
// -------------------------------------------------------------
test('WP-4 T-4 Correction Service: Recompute Totals, Stale 409 & Reason Rules', async () => {
  const suffix = makeSuffix('correct_service');
  const ctx = await setupTestContext(suffix);
  const baseUrl = await getTestBaseUrl();
  const docAuth = { Authorization: `Bearer ${ctx.tokens.docToken}`, 'Content-Type': 'application/json' };

  try {
    // Setup complete enrollment with status FAILED (Total = 49.0 / 100)
    await prisma.courseGradeEntry.createMany({
      data: [
        { enrollmentId: ctx.enrollment1.id, componentId: ctx.compQuiz.id, score: 9.0, status: 'PUBLISHED', version: 1 },
        { enrollmentId: ctx.enrollment1.id, componentId: ctx.compMidterm.id, score: 15.0, status: 'PUBLISHED', version: 1 },
        { enrollmentId: ctx.enrollment1.id, componentId: ctx.compFinal.id, score: 25.0, status: 'PUBLISHED', version: 1 },
      ],
    });
    await prisma.enrollment.update({
      where: { id: ctx.enrollment1.id },
      data: { finalPointsEarned: 49.0, finalPointsMax: 100.0, finalGrade: 49.0, status: 'FAILED' },
    });

    const urlCorr = `${baseUrl}/courses/${ctx.course.id}/gradebook/correct?termId=${ctx.termCurrent.id}`;

    // 1. Stale version (expected 1, sent 99) -> 409 Conflict
    const resStale = await fetch(urlCorr, {
      method: 'POST',
      headers: docAuth,
      body: JSON.stringify({
        corrections: [{ enrollmentId: ctx.enrollment1.id, componentId: ctx.compMidterm.id, score: 20.0, isAbsent: false, version: 99, reason: 'Valid reason here' }],
      }),
    });
    assert.strictEqual(resStale.status, 409);

    // 2. Reason with angle brackets -> 422
    const resAngle = await fetch(urlCorr, {
      method: 'POST',
      headers: docAuth,
      body: JSON.stringify({
        corrections: [{ enrollmentId: ctx.enrollment1.id, componentId: ctx.compMidterm.id, score: 20.0, isAbsent: false, version: 1, reason: '<script>alert(1)</script>' }],
      }),
    });
    assert.strictEqual(resAngle.status, 422);

    // 3. Valid correction: Midterm score bumped from 15.0 to 20.0 (+5.0 pts).
    // Total becomes 54.0 >= 50.0 -> status should flip from FAILED to COMPLETED!
    const resValid = await fetch(urlCorr, {
      method: 'POST',
      headers: docAuth,
      body: JSON.stringify({
        corrections: [{ enrollmentId: ctx.enrollment1.id, componentId: ctx.compMidterm.id, score: 20.0, isAbsent: false, version: 1, reason: 'Discovered grading calculation error' }],
      }),
    });
    assert.strictEqual(resValid.status, 200);

    const midtermAfter = await prisma.courseGradeEntry.findUnique({
      where: { enrollmentId_componentId: { enrollmentId: ctx.enrollment1.id, componentId: ctx.compMidterm.id } },
    });
    assert.strictEqual(midtermAfter?.score, 20.0);
    assert.strictEqual(midtermAfter?.version, 2);
    assert.strictEqual(midtermAfter?.notes, 'Discovered grading calculation error');

    // Verify enrollment recomputation
    const enrollAfter = await prisma.enrollment.findUnique({ where: { id: ctx.enrollment1.id } });
    assert.strictEqual(enrollAfter?.finalPointsEarned, 54.0);
    assert.strictEqual(enrollAfter?.finalGrade, 54.0);
    assert.strictEqual(enrollAfter?.status, 'COMPLETED');
  } finally {
    await ctx.cleanup();
  }
});

test('WP-4 R1 C1: Correct published MANUAL entry to isAbsent true with score null -> 200, stored score null + isAbsent true, ABS counts 0 points, totals recomputed', async () => {
  const suffix = makeSuffix('c1_corr_to_absent');
  const ctx = await setupTestContext(suffix);
  const baseUrl = await getTestBaseUrl();
  const docAuth = { Authorization: `Bearer ${ctx.tokens.docToken}`, 'Content-Type': 'application/json' };

  try {
    // Initially complete & COMPLETED: Quiz 10 + Midterm 20 + Final 30 = 60.0 >= 50.0
    await prisma.courseGradeEntry.createMany({
      data: [
        { enrollmentId: ctx.enrollment1.id, componentId: ctx.compQuiz.id, score: 10.0, isAbsent: false, status: 'PUBLISHED', version: 1 },
        { enrollmentId: ctx.enrollment1.id, componentId: ctx.compMidterm.id, score: 20.0, isAbsent: false, status: 'PUBLISHED', version: 1 },
        { enrollmentId: ctx.enrollment1.id, componentId: ctx.compFinal.id, score: 30.0, isAbsent: false, status: 'PUBLISHED', version: 1 },
      ],
    });
    await prisma.enrollment.update({
      where: { id: ctx.enrollment1.id },
      data: { finalPointsEarned: 60.0, finalPointsMax: 100.0, finalGrade: 60.0, status: 'COMPLETED' },
    });

    const urlCorr = `${baseUrl}/courses/${ctx.course.id}/gradebook/correct?termId=${ctx.termCurrent.id}`;

    // Correct Midterm (20.0) -> isAbsent: true, score: null (ABS counts 0 points -> total drops to 40.0 < 50.0 -> FAILED)
    const resToAbsent = await fetch(urlCorr, {
      method: 'POST',
      headers: docAuth,
      body: JSON.stringify({
        corrections: [
          {
            enrollmentId: ctx.enrollment1.id,
            componentId: ctx.compMidterm.id,
            score: null,
            isAbsent: true,
            version: 1,
            reason: 'Student was marked absent on attendance sheet',
          },
        ],
      }),
    });
    assert.strictEqual(resToAbsent.status, 200, `Expected 200 when correcting to isAbsent=true, got ${resToAbsent.status}`);

    const entryAfterAbsent = await prisma.courseGradeEntry.findUnique({
      where: { enrollmentId_componentId: { enrollmentId: ctx.enrollment1.id, componentId: ctx.compMidterm.id } },
    });
    assert.ok(entryAfterAbsent);
    assert.strictEqual(entryAfterAbsent.score, null, 'Stored score must be null when isAbsent is true');
    assert.strictEqual(entryAfterAbsent.isAbsent, true, 'Stored isAbsent must be true');
    assert.strictEqual(entryAfterAbsent.version, 2);

    const enrollAfterAbsent = await prisma.enrollment.findUnique({ where: { id: ctx.enrollment1.id } });
    assert.strictEqual(enrollAfterAbsent?.finalPointsEarned, 40.0, 'ABS must count 0 points toward finalPointsEarned');
    assert.strictEqual(enrollAfterAbsent?.finalPointsMax, 100.0);
    assert.strictEqual(enrollAfterAbsent?.finalGrade, 40.0);
    assert.strictEqual(enrollAfterAbsent?.status, 'FAILED', 'Total 40.0 < passMark 50.0 must recompute status to FAILED');
  } finally {
    await ctx.cleanup();
  }
});

test('WP-4 R1 C1: Correct absent published MANUAL entry back to a number -> 200, stored score number + isAbsent false, totals recomputed', async () => {
  const suffix = makeSuffix('c1_corr_from_absent');
  const ctx = await setupTestContext(suffix);
  const baseUrl = await getTestBaseUrl();
  const docAuth = { Authorization: `Bearer ${ctx.tokens.docToken}`, 'Content-Type': 'application/json' };

  try {
    // Initially complete with Midterm absent (score: null, isAbsent: true): Quiz 10 + Midterm ABS(0) + Final 30 = 40.0 < 50.0 -> FAILED
    await prisma.courseGradeEntry.createMany({
      data: [
        { enrollmentId: ctx.enrollment1.id, componentId: ctx.compQuiz.id, score: 10.0, isAbsent: false, status: 'PUBLISHED', version: 1 },
        { enrollmentId: ctx.enrollment1.id, componentId: ctx.compMidterm.id, score: null, isAbsent: true, status: 'PUBLISHED', version: 2 },
        { enrollmentId: ctx.enrollment1.id, componentId: ctx.compFinal.id, score: 30.0, isAbsent: false, status: 'PUBLISHED', version: 1 },
      ],
    });
    await prisma.enrollment.update({
      where: { id: ctx.enrollment1.id },
      data: { finalPointsEarned: 40.0, finalPointsMax: 100.0, finalGrade: 40.0, status: 'FAILED' },
    });

    const urlCorr = `${baseUrl}/courses/${ctx.course.id}/gradebook/correct?termId=${ctx.termCurrent.id}`;

    // Correct the absent entry back to a number (25.0) -> total becomes 65.0 >= 50.0 -> COMPLETED
    const resBackToNumber = await fetch(urlCorr, {
      method: 'POST',
      headers: docAuth,
      body: JSON.stringify({
        corrections: [
          {
            enrollmentId: ctx.enrollment1.id,
            componentId: ctx.compMidterm.id,
            score: 25.0,
            isAbsent: false,
            version: 2,
            reason: 'Makeup midterm exam completed and graded',
          },
        ],
      }),
    });
    assert.strictEqual(resBackToNumber.status, 200, `Expected 200 when correcting absent entry back to number, got ${resBackToNumber.status}`);

    const entryAfterNum = await prisma.courseGradeEntry.findUnique({
      where: { enrollmentId_componentId: { enrollmentId: ctx.enrollment1.id, componentId: ctx.compMidterm.id } },
    });
    assert.ok(entryAfterNum);
    assert.strictEqual(entryAfterNum.score, 25.0);
    assert.strictEqual(entryAfterNum.isAbsent, false);
    assert.strictEqual(entryAfterNum.version, 3);

    const enrollAfterNum = await prisma.enrollment.findUnique({ where: { id: ctx.enrollment1.id } });
    assert.strictEqual(enrollAfterNum?.finalPointsEarned, 65.0);
    assert.strictEqual(enrollAfterNum?.finalPointsMax, 100.0);
    assert.strictEqual(enrollAfterNum?.finalGrade, 65.0);
    assert.strictEqual(enrollAfterNum?.status, 'COMPLETED');
  } finally {
    await ctx.cleanup();
  }
});

// -------------------------------------------------------------
// Suite 8: S6 Student my-grades Isolation & Zero Draft Leakage
// -------------------------------------------------------------
test('WP-4 T-4 Student my-grades: Isolation, No Draft Leakage, null finalGrade while incomplete', async () => {
  const suffix = makeSuffix('my_grades_isolation');
  const ctx = await setupTestContext(suffix);
  const baseUrl = await getTestBaseUrl();
  const stu1Auth = { Authorization: `Bearer ${ctx.tokens.stu1Token}` };

  try {
    // 1. Enter DRAFT scores for Student 1
    await prisma.courseGradeEntry.create({
      data: { enrollmentId: ctx.enrollment1.id, componentId: ctx.compMidterm.id, score: 28.0, status: 'DRAFT', version: 1 },
    });

    const res = await fetch(`${baseUrl}/enrollments/my-grades`, { headers: stu1Auth });
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);

    const courseGrade = json.data.find((c: any) => c.courseId === ctx.course.id);
    assert.ok(courseGrade);

    // Draft score of 28 must NOT be visible to student
    const midtermItem = courseGrade.components.find((comp: any) => comp.componentId === ctx.compMidterm.id);
    assert.ok(midtermItem);
    assert.strictEqual(midtermItem.score, null, 'Draft score must remain null to student');
    assert.strictEqual(midtermItem.isPublished, false);

    // Totals must remain null while incomplete
    assert.strictEqual(courseGrade.finalGrade, null);
    assert.strictEqual(courseGrade.finalPointsEarned, null);
  } finally {
    await ctx.cleanup();
  }
});

// -------------------------------------------------------------
// Suite 9: S7 Legacy PATCH /api/enrollments/:id/grade 409 Rejection
// -------------------------------------------------------------
test('WP-4 T-4 Legacy PATCH /api/enrollments/:id/grade returns 409 Conflict', async () => {
  const suffix = makeSuffix('legacy_patch');
  const ctx = await setupTestContext(suffix);
  const baseUrl = await getTestBaseUrl();

  try {
    // 1. Anonymous -> 401
    const resAnon = await fetch(`${baseUrl}/enrollments/${ctx.enrollment1.id}/grade`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ finalGrade: 85 }),
    });
    assert.strictEqual(resAnon.status, 401);

    // 2. Student -> 403
    const resStu = await fetch(`${baseUrl}/enrollments/${ctx.enrollment1.id}/grade`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${ctx.tokens.stu1Token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ finalGrade: 85 }),
    });
    assert.strictEqual(resStu.status, 403);

    // 3. Doctor (authorized role) -> 409 Conflict pointing to gradebook
    const resDoc = await fetch(`${baseUrl}/enrollments/${ctx.enrollment1.id}/grade`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${ctx.tokens.docToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ finalGrade: 85 }),
    });
    assert.strictEqual(resDoc.status, 409);
    const jsonDoc = await resDoc.json();
    assert.match(jsonDoc.message, /gradebook/i);
  } finally {
    await ctx.cleanup();
  }
});

// -------------------------------------------------------------
// Suite 10: Concurrency & Parallel Publishes
// -------------------------------------------------------------
test('WP-4 T-4 Concurrency: Parallel Publishes on Same Course-Term', async () => {
  const suffix = makeSuffix('parallel_pub');
  const ctx = await setupTestContext(suffix);
  const baseUrl = await getTestBaseUrl();
  const docAuth = { Authorization: `Bearer ${ctx.tokens.docToken}`, 'Content-Type': 'application/json' };

  try {
    // Setup complete drafts
    await prisma.courseGradeEntry.createMany({
      data: [
        { enrollmentId: ctx.enrollment1.id, componentId: ctx.compQuiz.id, score: 10.0, status: 'DRAFT', version: 1 },
        { enrollmentId: ctx.enrollment1.id, componentId: ctx.compMidterm.id, score: 25.0, status: 'DRAFT', version: 1 },
        { enrollmentId: ctx.enrollment1.id, componentId: ctx.compFinal.id, score: 50.0, status: 'DRAFT', version: 1 },
      ],
    });

    const urlPub = `${baseUrl}/courses/${ctx.course.id}/gradebook/publish?termId=${ctx.termCurrent.id}`;

    // Two parallel publish calls
    const [resP1, resP2] = await Promise.all([
      fetch(urlPub, { method: 'POST', headers: docAuth, body: JSON.stringify({}) }),
      fetch(urlPub, { method: 'POST', headers: docAuth, body: JSON.stringify({}) }),
    ]);

    assert.ok(resP1.status === 200 || resP1.status === 409);
    assert.ok(resP2.status === 200 || resP2.status === 409);
    assert.ok(resP1.status === 200 || resP2.status === 200, 'At least one parallel publish must succeed');

    const enroll1 = await prisma.enrollment.findUnique({ where: { id: ctx.enrollment1.id } });
    assert.strictEqual(enroll1?.status, 'COMPLETED');
    assert.strictEqual(enroll1?.finalGrade, 85.0);
  } finally {
    await ctx.cleanup();
  }
});

test('WP-4 T-4 Concurrency: Parallel Publish vs Correct', async () => {
  const suffix = makeSuffix('par_pub_corr');
  const ctx = await setupTestContext(suffix);
  const baseUrl = await getTestBaseUrl();
  const docAuth = { Authorization: `Bearer ${ctx.tokens.docToken}`, 'Content-Type': 'application/json' };

  try {
    // Setup complete published entries initially
    await prisma.courseGradeEntry.createMany({
      data: [
        { enrollmentId: ctx.enrollment1.id, componentId: ctx.compQuiz.id, score: 10.0, status: 'PUBLISHED', version: 1 },
        { enrollmentId: ctx.enrollment1.id, componentId: ctx.compMidterm.id, score: 25.0, status: 'PUBLISHED', version: 1 },
        { enrollmentId: ctx.enrollment1.id, componentId: ctx.compFinal.id, score: 50.0, status: 'PUBLISHED', version: 1 },
      ],
    });

    const urlPub = `${baseUrl}/courses/${ctx.course.id}/gradebook/publish?termId=${ctx.termCurrent.id}`;
    const urlCorr = `${baseUrl}/courses/${ctx.course.id}/gradebook/correct?termId=${ctx.termCurrent.id}`;

    // Parallel publish and correct
    const [resPub, resCorr] = await Promise.all([
      fetch(urlPub, { method: 'POST', headers: docAuth, body: JSON.stringify({}) }),
      fetch(urlCorr, {
        method: 'POST',
        headers: docAuth,
        body: JSON.stringify({
          corrections: [
            {
              enrollmentId: ctx.enrollment1.id,
              componentId: ctx.compMidterm.id,
              score: 28.0,
              isAbsent: false,
              version: 1,
              reason: 'Recalculated midterm score accurately',
            },
          ],
        }),
      }),
    ]);

    // Neither call may return 500
    assert.notStrictEqual(resPub.status, 500);
    assert.notStrictEqual(resCorr.status, 500);
    assert.ok(resPub.status === 200 || resPub.status === 409);
    assert.ok(resCorr.status === 200 || resCorr.status === 409);

    // Final database state is consistent
    const midtermFinal = await prisma.courseGradeEntry.findUnique({
      where: { enrollmentId_componentId: { enrollmentId: ctx.enrollment1.id, componentId: ctx.compMidterm.id } },
    });
    assert.ok(midtermFinal?.score === 25.0 || midtermFinal?.score === 28.0);
    assert.strictEqual(midtermFinal?.status, 'PUBLISHED');
  } finally {
    await ctx.cleanup();
  }
});

test('WP-4 R1 C4: Parallel corrections on two different components of the SAME enrollment repeated several times -> statuses 200 or 409 only, and final Enrollment totals/status equal recomputation from entries', async () => {
  const suffix = makeSuffix('c4_par_corr');
  const ctx = await setupTestContext(suffix);
  const baseUrl = await getTestBaseUrl();
  const docAuth = { Authorization: `Bearer ${ctx.tokens.docToken}`, 'Content-Type': 'application/json' };

  try {
    await prisma.courseGradeEntry.createMany({
      data: [
        { enrollmentId: ctx.enrollment1.id, componentId: ctx.compQuiz.id, score: 5.0, status: 'DRAFT', version: 1 },
        { enrollmentId: ctx.enrollment1.id, componentId: ctx.compMidterm.id, score: 15.0, status: 'DRAFT', version: 1 },
        { enrollmentId: ctx.enrollment1.id, componentId: ctx.compFinal.id, score: 25.0, status: 'DRAFT', version: 1 },
      ],
    });

    const urlPub = `${baseUrl}/courses/${ctx.course.id}/gradebook/publish?termId=${ctx.termCurrent.id}`;
    const resInitPub = await fetch(urlPub, { method: 'POST', headers: docAuth, body: JSON.stringify({}) });
    assert.strictEqual(resInitPub.status, 200);

    const urlCorr = `${baseUrl}/courses/${ctx.course.id}/gradebook/correct?termId=${ctx.termCurrent.id}`;

    for (let iter = 1; iter <= 8; iter++) {
      const entriesBefore = await prisma.courseGradeEntry.findMany({
        where: { enrollmentId: ctx.enrollment1.id },
      });
      const midtermEntry = entriesBefore.find((e) => e.componentId === ctx.compMidterm.id)!;
      const finalEntry = entriesBefore.find((e) => e.componentId === ctx.compFinal.id)!;

      const nextMidtermScore = iter % 2 === 0 ? 10.0 + iter : 20.0 + iter;
      const nextFinalScore = iter % 2 === 0 ? 20.0 + iter * 2 : 35.0 + iter;

      const [res1, res2] = await Promise.all([
        fetch(urlCorr, {
          method: 'POST',
          headers: docAuth,
          body: JSON.stringify({
            corrections: [
              {
                enrollmentId: ctx.enrollment1.id,
                componentId: ctx.compMidterm.id,
                score: nextMidtermScore,
                isAbsent: false,
                version: midtermEntry.version,
                reason: `Parallel midterm correction iteration ${iter}`,
              },
            ],
          }),
        }),
        fetch(urlCorr, {
          method: 'POST',
          headers: docAuth,
          body: JSON.stringify({
            corrections: [
              {
                enrollmentId: ctx.enrollment1.id,
                componentId: ctx.compFinal.id,
                score: nextFinalScore,
                isAbsent: false,
                version: finalEntry.version,
                reason: `Parallel final correction iteration ${iter}`,
              },
            ],
          }),
        }),
      ]);

      assert.ok(
        res1.status === 200 || res1.status === 409,
        `Iteration ${iter}: expected res1 status 200 or 409, got ${res1.status}`
      );
      assert.ok(
        res2.status === 200 || res2.status === 409,
        `Iteration ${iter}: expected res2 status 200 or 409, got ${res2.status}`
      );

      const entriesAfter = await prisma.courseGradeEntry.findMany({
        where: { enrollmentId: ctx.enrollment1.id, status: 'PUBLISHED' },
      });
      const recomputedEarned =
        Math.round(
          entriesAfter.reduce((acc, e) => acc + (e.isAbsent ? 0 : (e.score ?? 0)), 0) * 100
        ) / 100;
      const recomputedMax = 100.0;
      const recomputedGrade = Math.round((recomputedEarned / recomputedMax) * 10000) / 100;
      const recomputedStatus =
        Math.round(recomputedEarned * 100) >= Math.round(ctx.structure.passMark! * 100)
          ? 'COMPLETED'
          : 'FAILED';

      const enrollmentAfter = await prisma.enrollment.findUnique({
        where: { id: ctx.enrollment1.id },
      });
      assert.strictEqual(
        enrollmentAfter?.finalPointsEarned,
        recomputedEarned,
        `Iteration ${iter}: Enrollment finalPointsEarned (${enrollmentAfter?.finalPointsEarned}) diverged from recomputed entries sum (${recomputedEarned})`
      );
      assert.strictEqual(
        enrollmentAfter?.finalPointsMax,
        recomputedMax,
        `Iteration ${iter}: Enrollment finalPointsMax (${enrollmentAfter?.finalPointsMax}) diverged from recomputed max (${recomputedMax})`
      );
      assert.strictEqual(
        enrollmentAfter?.finalGrade,
        recomputedGrade,
        `Iteration ${iter}: Enrollment finalGrade (${enrollmentAfter?.finalGrade}) diverged from recomputed grade (${recomputedGrade})`
      );
      assert.strictEqual(
        enrollmentAfter?.status,
        recomputedStatus,
        `Iteration ${iter}: Enrollment status (${enrollmentAfter?.status}) diverged from recomputed status (${recomputedStatus})`
      );
    }
  } finally {
    await ctx.cleanup();
  }
});

// -------------------------------------------------------------
// Suite 11: WP-4 R1 C6 — One test per case (no bundling)
// -------------------------------------------------------------
test('WP-4 R1 C6: Publish on a past term returns 409', async () => {
  const suffix = makeSuffix('c6_pub_past');
  const ctx = await setupTestContext(suffix);
  const baseUrl = await getTestBaseUrl();
  const docAuth = { Authorization: `Bearer ${ctx.tokens.docToken}`, 'Content-Type': 'application/json' };

  try {
    await prisma.scheduleSlot.create({
      data: {
        courseId: ctx.course.id,
        doctorId: ctx.doctorAssigned.id,
        termId: ctx.termPast.id,
        dayOfWeek: 'WEDNESDAY',
        startTime: '09:00',
        endTime: '11:00',
        slotType: 'LECTURE',
      },
    });
    const pastStruct = await prisma.courseGradeStructure.create({
      data: { courseId: ctx.course.id, termId: ctx.termPast.id, passMark: 50.0 },
    });
    await prisma.courseGradeComponent.create({
      data: { structureId: pastStruct.id, name: 'Final', maxPoints: 100.0, source: 'MANUAL', displayOrder: 1 },
    });

    const urlPubPast = `${baseUrl}/courses/${ctx.course.id}/gradebook/publish?termId=${ctx.termPast.id}`;
    const res = await fetch(urlPubPast, { method: 'POST', headers: docAuth, body: JSON.stringify({}) });
    assert.strictEqual(res.status, 409, `Expected 409 when publishing on a past term, got ${res.status}`);

    await prisma.courseGradeComponent.deleteMany({ where: { structureId: pastStruct.id } });
  } finally {
    await ctx.cleanup();
  }
});

test('WP-4 R1 C6: Correct on a past term returns 409', async () => {
  const suffix = makeSuffix('c6_corr_past');
  const ctx = await setupTestContext(suffix);
  const baseUrl = await getTestBaseUrl();
  const docAuth = { Authorization: `Bearer ${ctx.tokens.docToken}`, 'Content-Type': 'application/json' };

  try {
    await prisma.scheduleSlot.create({
      data: {
        courseId: ctx.course.id,
        doctorId: ctx.doctorAssigned.id,
        termId: ctx.termPast.id,
        dayOfWeek: 'THURSDAY',
        startTime: '09:00',
        endTime: '11:00',
        slotType: 'LECTURE',
      },
    });
    const pastStruct = await prisma.courseGradeStructure.create({
      data: { courseId: ctx.course.id, termId: ctx.termPast.id, passMark: 50.0 },
    });
    const pastComp = await prisma.courseGradeComponent.create({
      data: { structureId: pastStruct.id, name: 'Final', maxPoints: 100.0, source: 'MANUAL', displayOrder: 1 },
    });
    const pastEnr = await prisma.enrollment.create({
      data: { studentId: ctx.student1.id, courseId: ctx.course.id, semester: 2, academicYear: 2024, termId: ctx.termPast.id, status: 'COMPLETED', finalPointsEarned: 80.0, finalPointsMax: 100.0, finalGrade: 80.0 },
    });
    await prisma.courseGradeEntry.create({
      data: { enrollmentId: pastEnr.id, componentId: pastComp.id, score: 80.0, isAbsent: false, status: 'PUBLISHED', version: 1 },
    });

    const urlCorrPast = `${baseUrl}/courses/${ctx.course.id}/gradebook/correct?termId=${ctx.termPast.id}`;
    const res = await fetch(urlCorrPast, {
      method: 'POST',
      headers: docAuth,
      body: JSON.stringify({
        corrections: [
          {
            enrollmentId: pastEnr.id,
            componentId: pastComp.id,
            score: 85.0,
            isAbsent: false,
            version: 1,
            reason: 'Attempt correction on past term',
          },
        ],
      }),
    });
    assert.strictEqual(res.status, 409, `Expected 409 when correcting on a past term, got ${res.status}`);

    await prisma.courseGradeEntry.deleteMany({ where: { enrollmentId: pastEnr.id } });
    await prisma.courseGradeComponent.deleteMany({ where: { structureId: pastStruct.id } });
  } finally {
    await ctx.cleanup();
  }
});

test('WP-4 R1 C6: BLOCKED enrollment is skipped on publish', async () => {
  const suffix = makeSuffix('c6_pub_blocked');
  const ctx = await setupTestContext(suffix);
  const baseUrl = await getTestBaseUrl();
  const docAuth = { Authorization: `Bearer ${ctx.tokens.docToken}`, 'Content-Type': 'application/json' };

  try {
    await prisma.enrollment.update({
      where: { id: ctx.enrollment1.id },
      data: { status: 'BLOCKED' },
    });
    await prisma.courseGradeEntry.createMany({
      data: [
        { enrollmentId: ctx.enrollment1.id, componentId: ctx.compQuiz.id, score: 10.0, status: 'DRAFT', version: 1 },
        { enrollmentId: ctx.enrollment1.id, componentId: ctx.compMidterm.id, score: 25.0, status: 'DRAFT', version: 1 },
        { enrollmentId: ctx.enrollment1.id, componentId: ctx.compFinal.id, score: 50.0, status: 'DRAFT', version: 1 },
      ],
    });

    const urlPub = `${baseUrl}/courses/${ctx.course.id}/gradebook/publish?termId=${ctx.termCurrent.id}`;
    const res = await fetch(urlPub, { method: 'POST', headers: docAuth, body: JSON.stringify({}) });
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    const skippedItem = json.data.skipped.find((s: any) => s.enrollmentId === ctx.enrollment1.id);
    assert.ok(skippedItem, 'BLOCKED enrollment must be listed in skipped');
    assert.strictEqual(skippedItem.status, 'BLOCKED');

    const enrAfter = await prisma.enrollment.findUnique({ where: { id: ctx.enrollment1.id } });
    assert.strictEqual(enrAfter?.status, 'BLOCKED');
    assert.strictEqual(enrAfter?.finalPointsEarned, null);
    assert.strictEqual(enrAfter?.finalGrade, null);

    const entriesAfter = await prisma.courseGradeEntry.findMany({ where: { enrollmentId: ctx.enrollment1.id } });
    for (const e of entriesAfter) {
      assert.strictEqual(e.status, 'DRAFT', 'Entries of skipped BLOCKED enrollment must not be published');
    }
  } finally {
    await ctx.cleanup();
  }
});

test('WP-4 R1 C6: Correct on a BLOCKED enrollment returns 409', async () => {
  const suffix = makeSuffix('c6_corr_blocked');
  const ctx = await setupTestContext(suffix);
  const baseUrl = await getTestBaseUrl();
  const docAuth = { Authorization: `Bearer ${ctx.tokens.docToken}`, 'Content-Type': 'application/json' };

  try {
    await prisma.enrollment.update({
      where: { id: ctx.enrollment1.id },
      data: { status: 'BLOCKED' },
    });
    await prisma.courseGradeEntry.create({
      data: { enrollmentId: ctx.enrollment1.id, componentId: ctx.compMidterm.id, score: 20.0, isAbsent: false, status: 'PUBLISHED', version: 1 },
    });

    const urlCorr = `${baseUrl}/courses/${ctx.course.id}/gradebook/correct?termId=${ctx.termCurrent.id}`;
    const res = await fetch(urlCorr, {
      method: 'POST',
      headers: docAuth,
      body: JSON.stringify({
        corrections: [
          {
            enrollmentId: ctx.enrollment1.id,
            componentId: ctx.compMidterm.id,
            score: 25.0,
            isAbsent: false,
            version: 1,
            reason: 'Attempt correction on BLOCKED enrollment',
          },
        ],
      }),
    });
    assert.strictEqual(res.status, 409, `Expected 409 when correcting a BLOCKED enrollment, got ${res.status}`);

    const entryAfter = await prisma.courseGradeEntry.findUnique({
      where: { enrollmentId_componentId: { enrollmentId: ctx.enrollment1.id, componentId: ctx.compMidterm.id } },
    });
    assert.strictEqual(entryAfter?.score, 20.0);
    assert.strictEqual(entryAfter?.version, 1);
  } finally {
    await ctx.cleanup();
  }
});

test('WP-4 R1 C6: passMark null returns 409 on publish', async () => {
  const suffix = makeSuffix('c6_pub_nopassmark');
  const ctx = await setupTestContext(suffix);
  const baseUrl = await getTestBaseUrl();
  const docAuth = { Authorization: `Bearer ${ctx.tokens.docToken}`, 'Content-Type': 'application/json' };

  try {
    await prisma.courseGradeStructure.update({
      where: { id: ctx.structure.id },
      data: { passMark: null },
    });
    await prisma.courseGradeEntry.createMany({
      data: [
        { enrollmentId: ctx.enrollment1.id, componentId: ctx.compQuiz.id, score: 10.0, status: 'DRAFT', version: 1 },
        { enrollmentId: ctx.enrollment1.id, componentId: ctx.compMidterm.id, score: 25.0, status: 'DRAFT', version: 1 },
        { enrollmentId: ctx.enrollment1.id, componentId: ctx.compFinal.id, score: 50.0, status: 'DRAFT', version: 1 },
      ],
    });

    const urlPub = `${baseUrl}/courses/${ctx.course.id}/gradebook/publish?termId=${ctx.termCurrent.id}`;
    const res = await fetch(urlPub, { method: 'POST', headers: docAuth, body: JSON.stringify({}) });
    assert.strictEqual(res.status, 409, `Expected 409 on publish when passMark is null, got ${res.status}`);

    const enrAfter = await prisma.enrollment.findUnique({ where: { id: ctx.enrollment1.id } });
    assert.strictEqual(enrAfter?.status, 'ENROLLED');
    assert.strictEqual(enrAfter?.finalGrade, null);
  } finally {
    await ctx.cleanup();
  }
});

test('WP-4 R1 C6: passMark null returns 409 on correct', async () => {
  const suffix = makeSuffix('c6_corr_nopassmark');
  const ctx = await setupTestContext(suffix);
  const baseUrl = await getTestBaseUrl();
  const docAuth = { Authorization: `Bearer ${ctx.tokens.docToken}`, 'Content-Type': 'application/json' };

  try {
    await prisma.courseGradeEntry.createMany({
      data: [
        { enrollmentId: ctx.enrollment1.id, componentId: ctx.compQuiz.id, score: 10.0, status: 'PUBLISHED', version: 1 },
        { enrollmentId: ctx.enrollment1.id, componentId: ctx.compMidterm.id, score: 20.0, status: 'PUBLISHED', version: 1 },
        { enrollmentId: ctx.enrollment1.id, componentId: ctx.compFinal.id, score: 40.0, status: 'PUBLISHED', version: 1 },
      ],
    });
    await prisma.courseGradeStructure.update({
      where: { id: ctx.structure.id },
      data: { passMark: null },
    });

    const urlCorr = `${baseUrl}/courses/${ctx.course.id}/gradebook/correct?termId=${ctx.termCurrent.id}`;
    const res = await fetch(urlCorr, {
      method: 'POST',
      headers: docAuth,
      body: JSON.stringify({
        corrections: [
          {
            enrollmentId: ctx.enrollment1.id,
            componentId: ctx.compMidterm.id,
            score: 25.0,
            isAbsent: false,
            version: 1,
            reason: 'Attempt correction with null passMark',
          },
        ],
      }),
    });
    assert.strictEqual(res.status, 409, `Expected 409 on correct when passMark is null, got ${res.status}`);

    const entryAfter = await prisma.courseGradeEntry.findUnique({
      where: { enrollmentId_componentId: { enrollmentId: ctx.enrollment1.id, componentId: ctx.compMidterm.id } },
    });
    assert.strictEqual(entryAfter?.score, 20.0);
    assert.strictEqual(entryAfter?.version, 1);
  } finally {
    await ctx.cleanup();
  }
});

test('WP-4 R1 C6: No Notification rows created by draft grade entry save (count before/after for users involved)', async () => {
  const suffix = makeSuffix('c6_notif_draft');
  const ctx = await setupTestContext(suffix);
  const baseUrl = await getTestBaseUrl();
  const docAuth = { Authorization: `Bearer ${ctx.tokens.docToken}`, 'Content-Type': 'application/json' };

  try {
    const involvedUserIds = [
      ctx.users.docUser.id,
      ctx.users.taUser.id,
      ctx.users.stu1User.id,
      ctx.users.stu2User.id,
      ctx.users.stu3User.id,
    ];
    const notifBefore = await prisma.notification.count({
      where: { userId: { in: involvedUserIds } },
    });

    const urlDraft = `${baseUrl}/courses/${ctx.course.id}/gradebook/draft?termId=${ctx.termCurrent.id}`;
    const res = await fetch(urlDraft, {
      method: 'POST',
      headers: docAuth,
      body: JSON.stringify({
        entries: [
          { enrollmentId: ctx.enrollment1.id, componentId: ctx.compQuiz.id, score: 9.0, isAbsent: false },
          { enrollmentId: ctx.enrollment1.id, componentId: ctx.compMidterm.id, score: 25.0, isAbsent: false },
        ],
      }),
    });
    assert.strictEqual(res.status, 200);

    const notifAfter = await prisma.notification.count({
      where: { userId: { in: involvedUserIds } },
    });
    assert.strictEqual(notifAfter, notifBefore, 'Draft grade entry save must create 0 Notification rows');
  } finally {
    await ctx.cleanup();
  }
});

test('WP-4 R1 C6: No Notification rows created by publish (count before/after for users involved)', async () => {
  const suffix = makeSuffix('c6_notif_pub');
  const ctx = await setupTestContext(suffix);
  const baseUrl = await getTestBaseUrl();
  const docAuth = { Authorization: `Bearer ${ctx.tokens.docToken}`, 'Content-Type': 'application/json' };

  try {
    await prisma.courseGradeEntry.createMany({
      data: [
        { enrollmentId: ctx.enrollment1.id, componentId: ctx.compQuiz.id, score: 10.0, status: 'DRAFT', version: 1 },
        { enrollmentId: ctx.enrollment1.id, componentId: ctx.compMidterm.id, score: 25.0, status: 'DRAFT', version: 1 },
        { enrollmentId: ctx.enrollment1.id, componentId: ctx.compFinal.id, score: 50.0, status: 'DRAFT', version: 1 },
      ],
    });

    const involvedUserIds = [
      ctx.users.docUser.id,
      ctx.users.taUser.id,
      ctx.users.stu1User.id,
      ctx.users.stu2User.id,
      ctx.users.stu3User.id,
    ];
    const notifBefore = await prisma.notification.count({
      where: { userId: { in: involvedUserIds } },
    });

    const urlPub = `${baseUrl}/courses/${ctx.course.id}/gradebook/publish?termId=${ctx.termCurrent.id}`;
    const res = await fetch(urlPub, { method: 'POST', headers: docAuth, body: JSON.stringify({}) });
    assert.strictEqual(res.status, 200);

    const notifAfter = await prisma.notification.count({
      where: { userId: { in: involvedUserIds } },
    });
    assert.strictEqual(notifAfter, notifBefore, 'Publish must create 0 Notification rows');
  } finally {
    await ctx.cleanup();
  }
});

test('WP-4 R1 C6: No Notification rows created by correct (count before/after for users involved)', async () => {
  const suffix = makeSuffix('c6_notif_corr');
  const ctx = await setupTestContext(suffix);
  const baseUrl = await getTestBaseUrl();
  const docAuth = { Authorization: `Bearer ${ctx.tokens.docToken}`, 'Content-Type': 'application/json' };

  try {
    await prisma.courseGradeEntry.createMany({
      data: [
        { enrollmentId: ctx.enrollment1.id, componentId: ctx.compQuiz.id, score: 10.0, status: 'PUBLISHED', version: 1 },
        { enrollmentId: ctx.enrollment1.id, componentId: ctx.compMidterm.id, score: 20.0, status: 'PUBLISHED', version: 1 },
        { enrollmentId: ctx.enrollment1.id, componentId: ctx.compFinal.id, score: 30.0, status: 'PUBLISHED', version: 1 },
      ],
    });
    await prisma.enrollment.update({
      where: { id: ctx.enrollment1.id },
      data: { finalPointsEarned: 60.0, finalPointsMax: 100.0, finalGrade: 60.0, status: 'COMPLETED' },
    });

    const involvedUserIds = [
      ctx.users.docUser.id,
      ctx.users.taUser.id,
      ctx.users.stu1User.id,
      ctx.users.stu2User.id,
      ctx.users.stu3User.id,
    ];
    const notifBefore = await prisma.notification.count({
      where: { userId: { in: involvedUserIds } },
    });

    const urlCorr = `${baseUrl}/courses/${ctx.course.id}/gradebook/correct?termId=${ctx.termCurrent.id}`;
    const res = await fetch(urlCorr, {
      method: 'POST',
      headers: docAuth,
      body: JSON.stringify({
        corrections: [
          {
            enrollmentId: ctx.enrollment1.id,
            componentId: ctx.compMidterm.id,
            score: 15.0,
            isAbsent: false,
            version: 1,
            reason: 'Midterm score lowered after recheck',
          },
        ],
      }),
    });
    assert.strictEqual(res.status, 200);

    const notifAfter = await prisma.notification.count({
      where: { userId: { in: involvedUserIds } },
    });
    assert.strictEqual(notifAfter, notifBefore, 'Correct must create 0 Notification rows');
  } finally {
    await ctx.cleanup();
  }
});

test('WP-4 R1 C6: GRADE_PUBLISHED audit row asserted in database', async () => {
  const suffix = makeSuffix('c6_audit_pub');
  const ctx = await setupTestContext(suffix);
  const baseUrl = await getTestBaseUrl();
  const docAuth = { Authorization: `Bearer ${ctx.tokens.docToken}`, 'Content-Type': 'application/json' };

  try {
    const e1 = await prisma.courseGradeEntry.create({
      data: { enrollmentId: ctx.enrollment1.id, componentId: ctx.compQuiz.id, score: 10.0, status: 'DRAFT', version: 1 },
    });
    const e2 = await prisma.courseGradeEntry.create({
      data: { enrollmentId: ctx.enrollment1.id, componentId: ctx.compMidterm.id, score: 25.0, status: 'DRAFT', version: 1 },
    });
    const e3 = await prisma.courseGradeEntry.create({
      data: { enrollmentId: ctx.enrollment1.id, componentId: ctx.compFinal.id, score: 50.0, status: 'DRAFT', version: 1 },
    });

    const urlPub = `${baseUrl}/courses/${ctx.course.id}/gradebook/publish?termId=${ctx.termCurrent.id}`;
    const res = await fetch(urlPub, { method: 'POST', headers: docAuth, body: JSON.stringify({}) });
    assert.strictEqual(res.status, 200);

    const auditRow = await prisma.auditLog.findFirst({
      where: { action: 'GRADE_PUBLISHED', entity: 'Course', entityId: String(ctx.course.id) },
      orderBy: { timestamp: 'desc' },
    });
    assert.ok(auditRow, 'GRADE_PUBLISHED audit row must exist');
    assert.strictEqual(auditRow.userId, ctx.users.docUser.id);
    assert.strictEqual(auditRow.actorEmail, ctx.users.docUser.email);
    assert.strictEqual(auditRow.userRole, 'DOCTOR');
    const details = auditRow.details as any;
    assert.ok(Array.isArray(details.enrollments));
    assert.strictEqual(details.enrollments.length, 1);
    assert.strictEqual(details.enrollments[0].enrollmentId, ctx.enrollment1.id);
    assert.deepStrictEqual(
      [...details.enrollments[0].flippedEntryIds].sort((a: number, b: number) => a - b),
      [e1.id, e2.id, e3.id].sort((a, b) => a - b)
    );
    assert.deepStrictEqual(details.enrollments[0].before, {
      finalPointsEarned: null,
      finalPointsMax: null,
      finalGrade: null,
      status: 'ENROLLED',
    });
    assert.deepStrictEqual(details.enrollments[0].after, {
      finalPointsEarned: 85.0,
      finalPointsMax: 100.0,
      finalGrade: 85.0,
      status: 'COMPLETED',
    });
  } finally {
    await ctx.cleanup();
  }
});

test('WP-4 R1 C6: GRADE_CORRECTED audit row asserted in database', async () => {
  const suffix = makeSuffix('c6_audit_corr');
  const ctx = await setupTestContext(suffix);
  const baseUrl = await getTestBaseUrl();
  const docAuth = { Authorization: `Bearer ${ctx.tokens.docToken}`, 'Content-Type': 'application/json' };

  try {
    await prisma.courseGradeEntry.createMany({
      data: [
        { enrollmentId: ctx.enrollment1.id, componentId: ctx.compQuiz.id, score: 10.0, status: 'PUBLISHED', version: 1 },
        { enrollmentId: ctx.enrollment1.id, componentId: ctx.compMidterm.id, score: 20.0, status: 'PUBLISHED', version: 1 },
        { enrollmentId: ctx.enrollment1.id, componentId: ctx.compFinal.id, score: 30.0, status: 'PUBLISHED', version: 1 },
      ],
    });
    await prisma.enrollment.update({
      where: { id: ctx.enrollment1.id },
      data: { finalPointsEarned: 60.0, finalPointsMax: 100.0, finalGrade: 60.0, status: 'COMPLETED' },
    });

    const urlCorr = `${baseUrl}/courses/${ctx.course.id}/gradebook/correct?termId=${ctx.termCurrent.id}`;
    const res = await fetch(urlCorr, {
      method: 'POST',
      headers: docAuth,
      body: JSON.stringify({
        corrections: [
          {
            enrollmentId: ctx.enrollment1.id,
            componentId: ctx.compMidterm.id,
            score: 15.0,
            isAbsent: false,
            version: 1,
            reason: 'Midterm score lowered after recheck',
          },
        ],
      }),
    });
    assert.strictEqual(res.status, 200);

    const auditRow = await prisma.auditLog.findFirst({
      where: { action: 'GRADE_CORRECTED', entity: 'Course', entityId: String(ctx.course.id) },
      orderBy: { timestamp: 'desc' },
    });
    assert.ok(auditRow, 'GRADE_CORRECTED audit row must exist');
    assert.strictEqual(auditRow.userId, ctx.users.docUser.id);
    assert.strictEqual(auditRow.actorEmail, ctx.users.docUser.email);
    assert.strictEqual(auditRow.userRole, 'DOCTOR');
    const details = auditRow.details as any;
    assert.strictEqual(details.entries.length, 1);
    assert.deepStrictEqual(details.entries[0].before, { score: 20.0, isAbsent: false, version: 1 });
    assert.deepStrictEqual(details.entries[0].after, { score: 15.0, isAbsent: false, version: 2 });
    assert.strictEqual(details.entries[0].reason, 'Midterm score lowered after recheck');
    assert.strictEqual(details.enrollmentTotals.length, 1);
    assert.deepStrictEqual(details.enrollmentTotals[0].before, {
      finalPointsEarned: 60.0,
      finalPointsMax: 100.0,
      finalGrade: 60.0,
      status: 'COMPLETED',
    });
    assert.deepStrictEqual(details.enrollmentTotals[0].after, {
      finalPointsEarned: 55.0,
      finalPointsMax: 100.0,
      finalGrade: 55.0,
      status: 'COMPLETED',
    });
  } finally {
    await ctx.cleanup();
  }
});

test.after(async () => {
  if (sharedServer) {
    await new Promise<void>((resolve) => sharedServer!.close(() => resolve()));
  }
});
