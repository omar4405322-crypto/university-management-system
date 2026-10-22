import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import prisma from '../src/utils/prismaClient';
import { generateAccessToken } from '../src/utils/jwt.utils';

function makeSuffix(tag: string) {
  return `wp4_t2_${tag}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
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

interface TestActors {
  superAdminToken: string;
  collegeAdminOwnToken: string;
  collegeAdminOtherToken: string;
  deptAdminOwnToken: string;
  deptAdminOtherToken: string;
  doctorAssignedToken: string;
  doctorUnassignedToken: string;
  taAssignedToken: string;
  taUnassignedToken: string;
  studentEnrolledToken: string;
  studentUnenrolledToken: string;
}

interface TestContext {
  collegeOwn: any;
  collegeOther: any;
  deptOwn: any;
  deptOther: any;
  course: any;
  termCurrent: any;
  termPast: any;
  slotDoctor: any;
  slotTA: any;
  enrollment: any;
  actors: TestActors;
  cleanup: () => Promise<void>;
}

async function setupTestContext(suffix: string): Promise<TestContext> {
  const passwordHash = await bcrypt.hash('TestPass!123', 4);

  // Colleges & Depts
  const collegeOwn = await prisma.college.create({ data: { name: `CollegeOwn_${suffix}` } });
  const collegeOther = await prisma.college.create({ data: { name: `CollegeOther_${suffix}` } });
  const deptOwn = await prisma.department.create({
    data: { name: `DeptOwn_${suffix}`, collegeId: collegeOwn.id },
  });
  const deptOther = await prisma.department.create({
    data: { name: `DeptOther_${suffix}`, collegeId: collegeOther.id },
  });

  // Course
  const course = await prisma.course.create({
    data: {
      name: `Course_${suffix}`,
      courseCode: `C_${suffix.slice(-6)}`,
      credits: 3,
      departmentId: deptOwn.id,
    },
  });

  const termCurrent = await prisma.academicTerm.findFirstOrThrow({
    where: { isCurrent: true },
  });

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

  // 1. Super Admin
  const superAdminUser = await prisma.user.create({
    data: {
      email: `sa_${suffix}@uni.edu`,
      password: passwordHash,
      role: 'SUPER_ADMIN',
    },
  });
  const superAdminToken = generateAccessToken(superAdminUser.id, superAdminUser.tokenVersion);

  // 2. College Admin Own
  const collegeAdminOwnUser = await prisma.user.create({
    data: {
      email: `ca_own_${suffix}@uni.edu`,
      password: passwordHash,
      role: 'COLLEGE_ADMIN',
      managedCollegeId: collegeOwn.id,
      collegeId: collegeOwn.id,
    },
  });
  const collegeAdminOwnToken = generateAccessToken(
    collegeAdminOwnUser.id,
    collegeAdminOwnUser.tokenVersion
  );

  // 3. College Admin Other
  const collegeAdminOtherUser = await prisma.user.create({
    data: {
      email: `ca_other_${suffix}@uni.edu`,
      password: passwordHash,
      role: 'COLLEGE_ADMIN',
      managedCollegeId: collegeOther.id,
      collegeId: collegeOther.id,
    },
  });
  const collegeAdminOtherToken = generateAccessToken(
    collegeAdminOtherUser.id,
    collegeAdminOtherUser.tokenVersion
  );

  // 4. Dept Admin Own
  const deptAdminOwnUser = await prisma.user.create({
    data: {
      email: `da_own_${suffix}@uni.edu`,
      password: passwordHash,
      role: 'DEPARTMENT_ADMIN',
      managedDepartmentId: deptOwn.id,
      departmentId: deptOwn.id,
    },
  });
  const deptAdminOwnToken = generateAccessToken(
    deptAdminOwnUser.id,
    deptAdminOwnUser.tokenVersion
  );

  // 5. Dept Admin Other
  const deptAdminOtherUser = await prisma.user.create({
    data: {
      email: `da_other_${suffix}@uni.edu`,
      password: passwordHash,
      role: 'DEPARTMENT_ADMIN',
      managedDepartmentId: deptOther.id,
      departmentId: deptOther.id,
    },
  });
  const deptAdminOtherToken = generateAccessToken(
    deptAdminOtherUser.id,
    deptAdminOtherUser.tokenVersion
  );

  // 6. Doctor Assigned
  const docAssignedUser = await prisma.user.create({
    data: {
      email: `doc_asg_${suffix}@uni.edu`,
      password: passwordHash,
      role: 'DOCTOR',
      departmentId: deptOwn.id,
    },
  });
  const docAssigned = await prisma.doctor.create({
    data: {
      userId: docAssignedUser.id,
      firstName: 'Assigned',
      lastName: 'Doctor',
      departmentId: deptOwn.id,
      specialty: 'CS',
    },
  });
  const doctorAssignedToken = generateAccessToken(
    docAssignedUser.id,
    docAssignedUser.tokenVersion
  );

  // 7. Doctor Unassigned
  const docUnassignedUser = await prisma.user.create({
    data: {
      email: `doc_unasg_${suffix}@uni.edu`,
      password: passwordHash,
      role: 'DOCTOR',
      departmentId: deptOwn.id,
    },
  });
  await prisma.doctor.create({
    data: {
      userId: docUnassignedUser.id,
      firstName: 'Unassigned',
      lastName: 'Doctor',
      departmentId: deptOwn.id,
      specialty: 'CS',
    },
  });
  const doctorUnassignedToken = generateAccessToken(
    docUnassignedUser.id,
    docUnassignedUser.tokenVersion
  );

  // 8. TA Assigned
  const taAssignedUser = await prisma.user.create({
    data: {
      email: `ta_asg_${suffix}@uni.edu`,
      password: passwordHash,
      role: 'TEACHING_ASSISTANT',
      departmentId: deptOwn.id,
    },
  });
  const taAssigned = await prisma.teachingAssistant.create({
    data: {
      userId: taAssignedUser.id,
      firstName: 'Assigned',
      lastName: 'TA',
      employeeId: `TA_ASG_${suffix}`,
      departmentId: deptOwn.id,
    },
  });
  const taAssignedToken = generateAccessToken(
    taAssignedUser.id,
    taAssignedUser.tokenVersion
  );

  // 9. TA Unassigned
  const taUnassignedUser = await prisma.user.create({
    data: {
      email: `ta_unasg_${suffix}@uni.edu`,
      password: passwordHash,
      role: 'TEACHING_ASSISTANT',
      departmentId: deptOwn.id,
    },
  });
  await prisma.teachingAssistant.create({
    data: {
      userId: taUnassignedUser.id,
      firstName: 'Unassigned',
      lastName: 'TA',
      employeeId: `TA_UNASG_${suffix}`,
      departmentId: deptOwn.id,
    },
  });
  const taUnassignedToken = generateAccessToken(
    taUnassignedUser.id,
    taUnassignedUser.tokenVersion
  );

  // 10. Student Enrolled
  const studentEnrolledUser = await prisma.user.create({
    data: {
      email: `stu_enr_${suffix}@uni.edu`,
      password: passwordHash,
      role: 'STUDENT',
      departmentId: deptOwn.id,
    },
  });
  const studentEnrolled = await prisma.student.create({
    data: {
      userId: studentEnrolledUser.id,
      firstName: 'Enrolled',
      lastName: 'Student',
      studentId: `STU_ENR_${suffix}`,
      year: 1,
      departmentId: deptOwn.id,
    },
  });
  const studentEnrolledToken = generateAccessToken(
    studentEnrolledUser.id,
    studentEnrolledUser.tokenVersion
  );

  // 11. Student Unenrolled
  const studentUnenrolledUser = await prisma.user.create({
    data: {
      email: `stu_unenr_${suffix}@uni.edu`,
      password: passwordHash,
      role: 'STUDENT',
      departmentId: deptOwn.id,
    },
  });
  await prisma.student.create({
    data: {
      userId: studentUnenrolledUser.id,
      firstName: 'Unenrolled',
      lastName: 'Student',
      studentId: `STU_UNENR_${suffix}`,
      year: 1,
      departmentId: deptOwn.id,
    },
  });
  const studentUnenrolledToken = generateAccessToken(
    studentUnenrolledUser.id,
    studentUnenrolledUser.tokenVersion
  );

  // Assignments in current term
  const slotDoctor = await prisma.scheduleSlot.create({
    data: {
      courseId: course.id,
      termId: termCurrent.id,
      doctorId: docAssigned.id,
      dayOfWeek: 'MONDAY',
      startTime: '09:00',
      endTime: '11:00',
      slotType: 'LECTURE',
      isArchived: false,
    },
  });

  const slotTA = await prisma.scheduleSlot.create({
    data: {
      courseId: course.id,
      termId: termCurrent.id,
      teachingAssistantId: taAssigned.id,
      dayOfWeek: 'TUESDAY',
      startTime: '11:00',
      endTime: '13:00',
      slotType: 'LAB',
      isArchived: false,
    },
  });

  const enrollment = await prisma.enrollment.create({
    data: {
      studentId: studentEnrolled.id,
      courseId: course.id,
      termId: termCurrent.id,
      semester: 1,
      academicYear: 2026,
      status: 'ENROLLED',
    },
  });

  const cleanup = async () => {
    // Delete in dependency order
    await prisma.courseGradeEntry.deleteMany({ where: { enrollment: { courseId: course.id } } }).catch(() => {});
    await prisma.courseGradeComponent.deleteMany({ where: { structure: { courseId: course.id } } }).catch(() => {});
    await prisma.courseGradeStructure.deleteMany({ where: { courseId: course.id } }).catch(() => {});
    await prisma.enrollment.deleteMany({ where: { courseId: course.id } }).catch(() => {});
    await prisma.scheduleSlot.deleteMany({ where: { courseId: course.id } }).catch(() => {});
    await prisma.course.deleteMany({ where: { id: course.id } }).catch(() => {});
    if (termPast?.id) {
      await prisma.academicTerm.deleteMany({ where: { id: termPast.id } }).catch(() => {});
    }
    await prisma.student.deleteMany({ where: { departmentId: { in: [deptOwn.id, deptOther.id] } } }).catch(() => {});
    await prisma.teachingAssistant.deleteMany({ where: { departmentId: { in: [deptOwn.id, deptOther.id] } } }).catch(() => {});
    await prisma.doctor.deleteMany({ where: { departmentId: { in: [deptOwn.id, deptOther.id] } } }).catch(() => {});
    await prisma.department.deleteMany({ where: { id: { in: [deptOwn.id, deptOther.id] } } }).catch(() => {});
    await prisma.college.deleteMany({ where: { id: { in: [collegeOwn.id, collegeOther.id] } } }).catch(() => {});
    await prisma.user.deleteMany({
      where: {
        id: {
          in: [
            superAdminUser.id,
            collegeAdminOwnUser.id,
            collegeAdminOtherUser.id,
            deptAdminOwnUser.id,
            deptAdminOtherUser.id,
            docAssignedUser.id,
            docUnassignedUser.id,
            taAssignedUser.id,
            taUnassignedUser.id,
            studentEnrolledUser.id,
            studentUnenrolledUser.id,
          ],
        },
      },
    }).catch(() => {});
  };

  return {
    collegeOwn,
    collegeOther,
    deptOwn,
    deptOther,
    course,
    termCurrent,
    termPast,
    slotDoctor,
    slotTA,
    enrollment,
    actors: {
      superAdminToken,
      collegeAdminOwnToken,
      collegeAdminOtherToken,
      deptAdminOwnToken,
      deptAdminOtherToken,
      doctorAssignedToken,
      doctorUnassignedToken,
      taAssignedToken,
      taUnassignedToken,
      studentEnrolledToken,
      studentUnenrolledToken,
    },
    cleanup,
  };
}

test('WP-4 T-2 Case 1: GET /api/courses/:courseId/grade-structure Role & Scope Authorization', async () => {
  const suffix = makeSuffix('c1_get_auth');
  const ctx = await setupTestContext(suffix);
  const baseUrl = await getTestBaseUrl();

  try {
    const url = `${baseUrl}/courses/${ctx.course.id}/grade-structure?termId=${ctx.termCurrent.id}`;

    // SUPER_ADMIN -> 200
    const resSA = await fetch(url, { headers: { Authorization: `Bearer ${ctx.actors.superAdminToken}` } });
    assert.strictEqual(resSA.status, 200, 'SUPER_ADMIN must receive 200');

    // COLLEGE_ADMIN own -> 200
    const resCAOwn = await fetch(url, { headers: { Authorization: `Bearer ${ctx.actors.collegeAdminOwnToken}` } });
    assert.strictEqual(resCAOwn.status, 200, 'COLLEGE_ADMIN (own) must receive 200');

    // COLLEGE_ADMIN other -> 403
    const resCAOther = await fetch(url, { headers: { Authorization: `Bearer ${ctx.actors.collegeAdminOtherToken}` } });
    assert.strictEqual(resCAOther.status, 403, 'COLLEGE_ADMIN (other) must receive 403');

    // DEPARTMENT_ADMIN own -> 200
    const resDAOwn = await fetch(url, { headers: { Authorization: `Bearer ${ctx.actors.deptAdminOwnToken}` } });
    assert.strictEqual(resDAOwn.status, 200, 'DEPARTMENT_ADMIN (own) must receive 200');

    // DEPARTMENT_ADMIN other -> 403
    const resDAOther = await fetch(url, { headers: { Authorization: `Bearer ${ctx.actors.deptAdminOtherToken}` } });
    assert.strictEqual(resDAOther.status, 403, 'DEPARTMENT_ADMIN (other) must receive 403');

    // DOCTOR assigned -> 200
    const resDocAsg = await fetch(url, { headers: { Authorization: `Bearer ${ctx.actors.doctorAssignedToken}` } });
    assert.strictEqual(resDocAsg.status, 200, 'DOCTOR (assigned) must receive 200');

    // DOCTOR unassigned -> 403
    const resDocUnasg = await fetch(url, { headers: { Authorization: `Bearer ${ctx.actors.doctorUnassignedToken}` } });
    assert.strictEqual(resDocUnasg.status, 403, 'DOCTOR (unassigned) must receive 403');

    // TA assigned -> 200
    const resTAAsg = await fetch(url, { headers: { Authorization: `Bearer ${ctx.actors.taAssignedToken}` } });
    assert.strictEqual(resTAAsg.status, 200, 'TA (assigned) must receive 200');

    // TA unassigned -> 403
    const resTAUnasg = await fetch(url, { headers: { Authorization: `Bearer ${ctx.actors.taUnassignedToken}` } });
    assert.strictEqual(resTAUnasg.status, 403, 'TA (unassigned) must receive 403');

    // STUDENT enrolled -> 200
    const resStuEnr = await fetch(url, { headers: { Authorization: `Bearer ${ctx.actors.studentEnrolledToken}` } });
    assert.strictEqual(resStuEnr.status, 200, 'STUDENT (enrolled) must receive 200');

    // STUDENT unenrolled -> 403
    const resStuUnenr = await fetch(url, { headers: { Authorization: `Bearer ${ctx.actors.studentUnenrolledToken}` } });
    assert.strictEqual(resStuUnenr.status, 403, 'STUDENT (unenrolled) must receive 403');

    // Anon -> 401
    const resAnon = await fetch(url);
    assert.strictEqual(resAnon.status, 401, 'Anonymous request must receive 401');
  } finally {
    await ctx.cleanup();
  }
});

test('WP-4 T-2 Case 2: Term Resolution & Empty Structure Response (GET)', async () => {
  const suffix = makeSuffix('c2_term_empty');
  const ctx = await setupTestContext(suffix);
  const baseUrl = await getTestBaseUrl();

  try {
    // 1. Explicit termId query param
    const resExplicit = await fetch(
      `${baseUrl}/courses/${ctx.course.id}/grade-structure?termId=${ctx.termCurrent.id}`,
      { headers: { Authorization: `Bearer ${ctx.actors.superAdminToken}` } }
    );
    assert.strictEqual(resExplicit.status, 200);
    const bodyExplicit = await resExplicit.json();
    assert.strictEqual(bodyExplicit.success, true);
    assert.strictEqual(bodyExplicit.data.courseId, ctx.course.id);
    assert.strictEqual(bodyExplicit.data.termId, ctx.termCurrent.id);
    assert.strictEqual(bodyExplicit.data.termName, ctx.termCurrent.name);
    assert.strictEqual(bodyExplicit.data.totalPoints, 0);
    assert.strictEqual(bodyExplicit.data.passMark, null);
    assert.strictEqual(bodyExplicit.data.gradeScale, undefined, 'gradeScale must not be present in response');
    assert.deepStrictEqual(bodyExplicit.data.components, []);
    assert.strictEqual(bodyExplicit.data.isLocked, false);

    // 2. Default to current term when termId omitted
    const resOmitted = await fetch(
      `${baseUrl}/courses/${ctx.course.id}/grade-structure`,
      { headers: { Authorization: `Bearer ${ctx.actors.superAdminToken}` } }
    );
    assert.strictEqual(resOmitted.status, 200);
    const bodyOmitted = await resOmitted.json();
    assert.strictEqual(bodyOmitted.data.termId, ctx.termCurrent.id);

    // 3. Invalid termId -> 422
    const resInvalid = await fetch(
      `${baseUrl}/courses/${ctx.course.id}/grade-structure?termId=invalid_num`,
      { headers: { Authorization: `Bearer ${ctx.actors.superAdminToken}` } }
    );
    assert.strictEqual(resInvalid.status, 422);

    // 4. Non-existent termId -> 404
    const resNotFound = await fetch(
      `${baseUrl}/courses/${ctx.course.id}/grade-structure?termId=9999999`,
      { headers: { Authorization: `Bearer ${ctx.actors.superAdminToken}` } }
    );
    assert.strictEqual(resNotFound.status, 404);
  } finally {
    await ctx.cleanup();
  }
});

test('WP-4 T-2 Case 3: PUT /api/courses/:courseId/grade-structure Role Authorization', async () => {
  const suffix = makeSuffix('c3_put_auth');
  const ctx = await setupTestContext(suffix);
  const baseUrl = await getTestBaseUrl();

  const validPayload = {
    passMark: 50.0,
    components: [
      { name: 'Quizzes', maxPoints: 20.0, source: 'AUTO_QUIZ', displayOrder: 1 },
      { name: 'Attendance', maxPoints: 10.0, source: 'AUTO_ATTENDANCE', displayOrder: 2 },
      { name: 'Final Exam', maxPoints: 70.0, source: 'MANUAL', displayOrder: 3 },
    ],
  };

  try {
    const url = `${baseUrl}/courses/${ctx.course.id}/grade-structure?termId=${ctx.termCurrent.id}`;

    // SUPER_ADMIN -> 200
    const resSA = await fetch(url, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${ctx.actors.superAdminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(validPayload),
    });
    assert.strictEqual(resSA.status, 200, 'SUPER_ADMIN must receive 200');

    // COLLEGE_ADMIN own -> 200
    const resCAOwn = await fetch(url, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${ctx.actors.collegeAdminOwnToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(validPayload),
    });
    assert.strictEqual(resCAOwn.status, 200, 'COLLEGE_ADMIN (own) must receive 200');

    // COLLEGE_ADMIN other -> 403
    const resCAOther = await fetch(url, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${ctx.actors.collegeAdminOtherToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(validPayload),
    });
    assert.strictEqual(resCAOther.status, 403, 'COLLEGE_ADMIN (other) must receive 403');

    // DEPARTMENT_ADMIN own -> 200
    const resDAOwn = await fetch(url, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${ctx.actors.deptAdminOwnToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(validPayload),
    });
    assert.strictEqual(resDAOwn.status, 200, 'DEPARTMENT_ADMIN (own) must receive 200');

    // DEPARTMENT_ADMIN other -> 403
    const resDAOther = await fetch(url, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${ctx.actors.deptAdminOtherToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(validPayload),
    });
    assert.strictEqual(resDAOther.status, 403, 'DEPARTMENT_ADMIN (other) must receive 403');

    // DOCTOR assigned -> 403 (read-only per S2)
    const resDocAsg = await fetch(url, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${ctx.actors.doctorAssignedToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(validPayload),
    });
    assert.strictEqual(resDocAsg.status, 403, 'DOCTOR (assigned) must receive 403 (read-only per S2)');

    // DOCTOR unassigned -> 403
    const resDocUnasg = await fetch(url, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${ctx.actors.doctorUnassignedToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(validPayload),
    });
    assert.strictEqual(resDocUnasg.status, 403, 'DOCTOR (unassigned) must receive 403');

    // TEACHING_ASSISTANT (even assigned!) -> 403
    const resTA = await fetch(url, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${ctx.actors.taAssignedToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(validPayload),
    });
    assert.strictEqual(resTA.status, 403, 'TEACHING_ASSISTANT must receive 403');

    // STUDENT -> 403
    const resStu = await fetch(url, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${ctx.actors.studentEnrolledToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(validPayload),
    });
    assert.strictEqual(resStu.status, 403, 'STUDENT must receive 403');

    // Anon -> 401
    const resAnon = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validPayload),
    });
    assert.strictEqual(resAnon.status, 401, 'Anonymous request must receive 401');
  } finally {
    await ctx.cleanup();
  }
});

test('WP-4 T-2 Case 4: Validation Boundaries & Malformed Input Handling on PUT', async () => {
  const suffix = makeSuffix('c4_validation');
  const ctx = await setupTestContext(suffix);
  const baseUrl = await getTestBaseUrl();
  const url = `${baseUrl}/courses/${ctx.course.id}/grade-structure?termId=${ctx.termCurrent.id}`;
  const authHeader = { Authorization: `Bearer ${ctx.actors.superAdminToken}`, 'Content-Type': 'application/json' };

  try {
    // 1. Empty components array
    const resEmpty = await fetch(url, {
      method: 'PUT',
      headers: authHeader,
      body: JSON.stringify({ components: [] }),
    });
    assert.strictEqual(resEmpty.status, 422, 'Empty components array must return 422');

    // 2. Control characters in component name
    const resCtrl = await fetch(url, {
      method: 'PUT',
      headers: authHeader,
      body: JSON.stringify({
        components: [{ name: 'Midterm\x00Exam', maxPoints: 20, source: 'MANUAL' }],
      }),
    });
    assert.strictEqual(resCtrl.status, 422, 'Control characters in name must return 422');

    // 3. Angle brackets in component name
    const resAngle = await fetch(url, {
      method: 'PUT',
      headers: authHeader,
      body: JSON.stringify({
        components: [{ name: 'Midterm <1>', maxPoints: 20, source: 'MANUAL' }],
      }),
    });
    assert.strictEqual(resAngle.status, 422, 'Angle brackets in name must return 422');

    // 4. Duplicate names case-insensitively
    const resDup = await fetch(url, {
      method: 'PUT',
      headers: authHeader,
      body: JSON.stringify({
        components: [
          { name: 'Final Exam', maxPoints: 50, source: 'MANUAL' },
          { name: 'final exam', maxPoints: 50, source: 'MANUAL' },
        ],
      }),
    });
    assert.strictEqual(resDup.status, 422, 'Case-insensitive duplicate names must return 422');

    // 5. maxPoints <= 0
    const resZeroPoints = await fetch(url, {
      method: 'PUT',
      headers: authHeader,
      body: JSON.stringify({
        components: [{ name: 'Final Exam', maxPoints: 0, source: 'MANUAL' }],
      }),
    });
    assert.strictEqual(resZeroPoints.status, 422, 'maxPoints <= 0 must return 422');

    // 6. maxPoints > MAX_POINTS_TECHNICAL_CEILING (10000)
    const resCeiling = await fetch(url, {
      method: 'PUT',
      headers: authHeader,
      body: JSON.stringify({
        components: [{ name: 'Final Exam', maxPoints: 10001, source: 'MANUAL' }],
      }),
    });
    assert.strictEqual(resCeiling.status, 422, 'maxPoints > 10000 must return 422');

    // 7. maxPoints > 2 decimal places
    const resDecimals = await fetch(url, {
      method: 'PUT',
      headers: authHeader,
      body: JSON.stringify({
        components: [{ name: 'Final Exam', maxPoints: 20.125, source: 'MANUAL' }],
      }),
    });
    assert.strictEqual(resDecimals.status, 422, 'maxPoints with > 2 decimal places must return 422');

    // 8. Multiple AUTO_QUIZ
    const resMultiQuiz = await fetch(url, {
      method: 'PUT',
      headers: authHeader,
      body: JSON.stringify({
        components: [
          { name: 'Quiz 1', maxPoints: 10, source: 'AUTO_QUIZ' },
          { name: 'Quiz 2', maxPoints: 10, source: 'AUTO_QUIZ' },
        ],
      }),
    });
    assert.strictEqual(resMultiQuiz.status, 422, 'Multiple AUTO_QUIZ must return 422');

    // 9. Multiple AUTO_ATTENDANCE
    const resMultiAtt = await fetch(url, {
      method: 'PUT',
      headers: authHeader,
      body: JSON.stringify({
        components: [
          { name: 'Attendance 1', maxPoints: 5, source: 'AUTO_ATTENDANCE' },
          { name: 'Attendance 2', maxPoints: 5, source: 'AUTO_ATTENDANCE' },
        ],
      }),
    });
    assert.strictEqual(resMultiAtt.status, 422, 'Multiple AUTO_ATTENDANCE must return 422');

    // 10. passMark > totalPoints
    const resPassMark = await fetch(url, {
      method: 'PUT',
      headers: authHeader,
      body: JSON.stringify({
        passMark: 120.0,
        components: [{ name: 'Final Exam', maxPoints: 100.0, source: 'MANUAL' }],
      }),
    });
    assert.strictEqual(resPassMark.status, 422, 'passMark > totalPoints must return 422');

    // 11. Client-sent totalPoints is ignored and computed dynamically
    const resTotal = await fetch(url, {
      method: 'PUT',
      headers: authHeader,
      body: JSON.stringify({
        totalPoints: 9999, // Hostile or forged client total
        passMark: 50.0,
        components: [
          { name: 'Quiz', maxPoints: 20.0, source: 'AUTO_QUIZ' },
          { name: 'Final Exam', maxPoints: 80.0, source: 'MANUAL' },
        ],
      }),
    });
    assert.strictEqual(resTotal.status, 200);
    const bodyTotal = await resTotal.json();
    assert.strictEqual(bodyTotal.data.totalPoints, 100.0, 'totalPoints must be dynamically computed sum (100.0), not 9999');
  } finally {
    await ctx.cleanup();
  }
});

test('WP-4 T-2 Case 5: 409 Conflict Invariants (Past-Term Lock, Published Lock & Draft Invariants)', async () => {
  const suffix = makeSuffix('c5_conflicts');
  const ctx = await setupTestContext(suffix);
  const baseUrl = await getTestBaseUrl();
  const authHeader = { Authorization: `Bearer ${ctx.actors.superAdminToken}`, 'Content-Type': 'application/json' };

  try {
    // 1. Past-term lock
    const resPast = await fetch(
      `${baseUrl}/courses/${ctx.course.id}/grade-structure?termId=${ctx.termPast.id}`,
      {
        method: 'PUT',
        headers: authHeader,
        body: JSON.stringify({
          components: [{ name: 'Final Exam', maxPoints: 100, source: 'MANUAL' }],
        }),
      }
    );
    assert.strictEqual(resPast.status, 409, 'Past term update must return 409 Conflict');

    // Setup initial valid structure in current term
    const resInit = await fetch(
      `${baseUrl}/courses/${ctx.course.id}/grade-structure?termId=${ctx.termCurrent.id}`,
      {
        method: 'PUT',
        headers: authHeader,
        body: JSON.stringify({
          components: [
            { name: 'Midterm', maxPoints: 30.0, source: 'MANUAL' },
            { name: 'Final Exam', maxPoints: 70.0, source: 'MANUAL' },
          ],
        }),
      }
    );
    assert.strictEqual(resInit.status, 200);
    const initData = (await resInit.json()).data;
    const midtermComp = initData.components.find((c: any) => c.name === 'Midterm');
    const finalComp = initData.components.find((c: any) => c.name === 'Final Exam');

    // Create draft entry on Midterm with score = 25.0
    const draftEntry = await prisma.courseGradeEntry.create({
      data: {
        enrollmentId: ctx.enrollment.id,
        componentId: midtermComp.id,
        score: 25.0,
        status: 'DRAFT',
      },
    });

    // 2. Draft invariant: Cannot remove component with entries
    const resRemove = await fetch(
      `${baseUrl}/courses/${ctx.course.id}/grade-structure?termId=${ctx.termCurrent.id}`,
      {
        method: 'PUT',
        headers: authHeader,
        body: JSON.stringify({
          components: [{ id: finalComp.id, name: 'Final Exam', maxPoints: 70.0, source: 'MANUAL' }],
        }),
      }
    );
    assert.strictEqual(resRemove.status, 409, 'Removing component with draft entries must return 409 Conflict');
    const jsonRemove = await resRemove.json();
    assert.match(jsonRemove.message, /grade entries exist/);

    // 3. Draft invariant: Cannot change source of component with entries
    const resChangeSource = await fetch(
      `${baseUrl}/courses/${ctx.course.id}/grade-structure?termId=${ctx.termCurrent.id}`,
      {
        method: 'PUT',
        headers: authHeader,
        body: JSON.stringify({
          components: [
            { id: midtermComp.id, name: 'Midterm', maxPoints: 30.0, source: 'AUTO_QUIZ' },
            { id: finalComp.id, name: 'Final Exam', maxPoints: 70.0, source: 'MANUAL' },
          ],
        }),
      }
    );
    assert.strictEqual(resChangeSource.status, 409, 'Changing source with draft entries must return 409 Conflict');

    // 4. Draft invariant: Cannot reduce maxPoints below existing draft score (draft = 25.0, new = 20.0)
    const resReduceBelow = await fetch(
      `${baseUrl}/courses/${ctx.course.id}/grade-structure?termId=${ctx.termCurrent.id}`,
      {
        method: 'PUT',
        headers: authHeader,
        body: JSON.stringify({
          components: [
            { id: midtermComp.id, name: 'Midterm', maxPoints: 20.0, source: 'MANUAL' },
            { id: finalComp.id, name: 'Final Exam', maxPoints: 70.0, source: 'MANUAL' },
          ],
        }),
      }
    );
    assert.strictEqual(resReduceBelow.status, 409, 'Reducing maxPoints below draft score must return 409 Conflict');
    const jsonReduce = await resReduceBelow.json();
    assert.match(jsonReduce.message, /Cannot reduce maxPoints below existing draft score 25/);

    // 5. Valid draft adjustment: Changing maxPoints >= draft score (draft = 25.0, new = 28.0) succeeds
    const resReduceValid = await fetch(
      `${baseUrl}/courses/${ctx.course.id}/grade-structure?termId=${ctx.termCurrent.id}`,
      {
        method: 'PUT',
        headers: authHeader,
        body: JSON.stringify({
          components: [
            { id: midtermComp.id, name: 'Midterm', maxPoints: 28.0, source: 'MANUAL' },
            { id: finalComp.id, name: 'Final Exam', maxPoints: 72.0, source: 'MANUAL' },
          ],
        }),
      }
    );
    assert.strictEqual(resReduceValid.status, 200, 'Reducing maxPoints to >= highest draft score must succeed');

    // 6. Published grades lock: Transition entry to PUBLISHED
    await prisma.courseGradeEntry.update({
      where: { id: draftEntry.id },
      data: { status: 'PUBLISHED' },
    });

    const resPublishedLock = await fetch(
      `${baseUrl}/courses/${ctx.course.id}/grade-structure?termId=${ctx.termCurrent.id}`,
      {
        method: 'PUT',
        headers: authHeader,
        body: JSON.stringify({
          components: [
            { id: midtermComp.id, name: 'Midterm', maxPoints: 30.0, source: 'MANUAL' },
            { id: finalComp.id, name: 'Final Exam', maxPoints: 70.0, source: 'MANUAL' },
          ],
        }),
      }
    );
    assert.strictEqual(resPublishedLock.status, 409, 'Modifying structure when published entries exist must return 409');
    const jsonPublished = await resPublishedLock.json();
    assert.match(jsonPublished.message, /published grades exist/);

    // Verify GET indicates isLocked = true
    const resGetLocked = await fetch(
      `${baseUrl}/courses/${ctx.course.id}/grade-structure?termId=${ctx.termCurrent.id}`,
      { headers: authHeader }
    );
    assert.strictEqual(resGetLocked.status, 200);
    const bodyGetLocked = await resGetLocked.json();
    assert.strictEqual(bodyGetLocked.data.isLocked, true, 'isLocked must be true when published grades exist');
  } finally {
    await ctx.cleanup();
  }
});

test('WP-4 T-2 Case 6: Component Reconciliation & Audit Log Generation', async () => {
  const suffix = makeSuffix('c6_reconcile_audit');
  const ctx = await setupTestContext(suffix);
  const baseUrl = await getTestBaseUrl();
  const authHeader = { Authorization: `Bearer ${ctx.actors.superAdminToken}`, 'Content-Type': 'application/json' };

  try {
    const url = `${baseUrl}/courses/${ctx.course.id}/grade-structure?termId=${ctx.termCurrent.id}`;

    // Step 1: Initial creation with 2 components
    const res1 = await fetch(url, {
      method: 'PUT',
      headers: authHeader,
      body: JSON.stringify({
        passMark: 50.0,
        components: [
          { name: 'Quizzes', maxPoints: 20.0, source: 'AUTO_QUIZ' },
          { name: 'Midterm Exam', maxPoints: 30.0, source: 'MANUAL' },
        ],
      }),
    });
    assert.strictEqual(res1.status, 200);
    const data1 = (await res1.json()).data;
    assert.strictEqual(data1.components.length, 2);
    const quizComp = data1.components.find((c: any) => c.name === 'Quizzes');
    const midtermComp = data1.components.find((c: any) => c.name === 'Midterm Exam');

    // Step 2: Update existing (keep quizComp by id), delete midterm (omit id), add new final
    const res2 = await fetch(url, {
      method: 'PUT',
      headers: authHeader,
      body: JSON.stringify({
        passMark: 60.0,
        components: [
          { id: quizComp.id, name: 'Quizzes Updated', maxPoints: 25.0, source: 'AUTO_QUIZ', displayOrder: 1 },
          { name: 'Final Exam', maxPoints: 75.0, source: 'MANUAL', displayOrder: 2 },
        ],
      }),
    });
    assert.strictEqual(res2.status, 200);
    const data2 = (await res2.json()).data;
    assert.strictEqual(data2.totalPoints, 100.0);
    assert.strictEqual(data2.passMark, 60.0);
    assert.strictEqual(data2.components.length, 2);

    // Verify quizComp ID preserved and properties updated
    const updatedQuiz = data2.components.find((c: any) => c.id === quizComp.id);
    assert.ok(updatedQuiz, 'Component ID must be preserved on update');
    assert.strictEqual(updatedQuiz.name, 'Quizzes Updated');
    assert.strictEqual(updatedQuiz.maxPoints, 25.0);

    // Verify midterm was deleted
    const deletedMidterm = await prisma.courseGradeComponent.findUnique({ where: { id: midtermComp.id } });
    assert.strictEqual(deletedMidterm, null, 'Omitted component must be deleted');

    // Step 3: Verify AuditLog row
    const auditEntries = await prisma.auditLog.findMany({
      where: {
        action: 'GRADE_STRUCTURE_UPDATED',
        entity: 'CourseGradeStructure',
      },
      orderBy: { timestamp: 'desc' },
      take: 2,
    });
    assert.ok(auditEntries.length >= 2, 'AuditLog entries must be created for each structure update');
    const latestAudit = auditEntries[0];
    const changes = latestAudit.details as any;
    assert.strictEqual(changes.courseId, ctx.course.id);
    assert.strictEqual(changes.termId, ctx.termCurrent.id);
    assert.ok(changes.before, 'AuditLog must contain before snapshot');
    assert.ok(changes.after, 'AuditLog must contain after snapshot');
  } finally {
    await ctx.cleanup();
  }
});

test('WP-4 T-2 Case 7: Concurrency & Serializable Isolation on Parallel PUTs', async () => {
  const suffix = makeSuffix('c7_parallel');
  const ctx = await setupTestContext(suffix);
  const baseUrl = await getTestBaseUrl();
  const authHeader = { Authorization: `Bearer ${ctx.actors.superAdminToken}`, 'Content-Type': 'application/json' };

  try {
    const url = `${baseUrl}/courses/${ctx.course.id}/grade-structure?termId=${ctx.termCurrent.id}`;

    const payloadA = {
      passMark: 50.0,
      components: [
        { name: 'Quizzes A', maxPoints: 20.0, source: 'AUTO_QUIZ' },
        { name: 'Final Exam A', maxPoints: 80.0, source: 'MANUAL' },
      ],
    };

    const payloadB = {
      passMark: 55.0,
      components: [
        { name: 'Quizzes B', maxPoints: 30.0, source: 'AUTO_QUIZ' },
        { name: 'Final Exam B', maxPoints: 70.0, source: 'MANUAL' },
      ],
    };

    // Fire 2 concurrent PUT requests
    const [resA, resB] = await Promise.all([
      fetch(url, { method: 'PUT', headers: authHeader, body: JSON.stringify(payloadA) }),
      fetch(url, { method: 'PUT', headers: authHeader, body: JSON.stringify(payloadB) }),
    ]);

    // Both should terminate with expected HTTP statuses (either 200 or 409 retry conflict)
    assert.ok(
      [200, 409].includes(resA.status),
      `Parallel request A must complete with 200 or 409, got ${resA.status}`
    );
    assert.ok(
      [200, 409].includes(resB.status),
      `Parallel request B must complete with 200 or 409, got ${resB.status}`
    );

    // At least one must succeed with 200
    assert.ok(resA.status === 200 || resB.status === 200, 'At least one parallel PUT must succeed');

    // Database state must be clean and consistent
    const finalStructure = await prisma.courseGradeStructure.findUnique({
      where: { courseId_termId: { courseId: ctx.course.id, termId: ctx.termCurrent.id } },
      include: { components: true },
    });
    assert.ok(finalStructure, 'CourseGradeStructure must exist in database');
    assert.strictEqual(finalStructure.components.length, 2);
  } finally {
    await ctx.cleanup();
  }
});

test('WP-4 R1 C2: PUT with component id from another course-term returns 422, foreign component and own structure unchanged', async () => {
  const suffix = makeSuffix('c2_foreign_id');
  const ctx = await setupTestContext(suffix);
  const baseUrl = await getTestBaseUrl();
  const authHeader = { Authorization: `Bearer ${ctx.actors.superAdminToken}`, 'Content-Type': 'application/json' };
  let otherCourse: any = null;

  try {
    // 1. Create initial structure on own course
    const ownUrl = `${baseUrl}/courses/${ctx.course.id}/grade-structure?termId=${ctx.termCurrent.id}`;
    const resOwnInit = await fetch(ownUrl, {
      method: 'PUT',
      headers: authHeader,
      body: JSON.stringify({
        passMark: 50.0,
        components: [{ name: 'Own Midterm', maxPoints: 100.0, source: 'MANUAL' }],
      }),
    });
    assert.strictEqual(resOwnInit.status, 200);
    const ownCompId = (await resOwnInit.json()).data.components[0].id;

    // 2. Create another course in the other college/department with its own structure & component
    otherCourse = await prisma.course.create({
      data: {
        name: `OtherCourse_${suffix}`,
        courseCode: `OC_${suffix.slice(-6)}`,
        credits: 3,
        departmentId: ctx.deptOther.id,
      },
    });
    const otherStructure = await prisma.courseGradeStructure.create({
      data: { courseId: otherCourse.id, termId: ctx.termCurrent.id, passMark: 60.0 },
    });
    const foreignComp = await prisma.courseGradeComponent.create({
      data: {
        structureId: otherStructure.id,
        name: 'Foreign Final',
        maxPoints: 80.0,
        source: 'MANUAL',
        displayOrder: 1,
      },
    });

    // 3. Attempt to PUT on own course using foreignComp.id
    const resAttack = await fetch(ownUrl, {
      method: 'PUT',
      headers: authHeader,
      body: JSON.stringify({
        passMark: 40.0,
        components: [
          { id: ownCompId, name: 'Own Midterm', maxPoints: 50.0, source: 'MANUAL' },
          { id: foreignComp.id, name: 'Hijacked Name', maxPoints: 50.0, source: 'MANUAL' },
        ],
      }),
    });
    assert.strictEqual(resAttack.status, 422, `Expected 422 for foreign component id, got ${resAttack.status}`);

    // Verify foreign component is completely unchanged
    const foreignAfter = await prisma.courseGradeComponent.findUnique({ where: { id: foreignComp.id } });
    assert.ok(foreignAfter);
    assert.strictEqual(foreignAfter.name, 'Foreign Final');
    assert.strictEqual(foreignAfter.maxPoints, 80.0);
    assert.strictEqual(foreignAfter.structureId, otherStructure.id);

    // Verify own structure and component are completely unchanged
    const ownStructureAfter = await prisma.courseGradeStructure.findUnique({
      where: { courseId_termId: { courseId: ctx.course.id, termId: ctx.termCurrent.id } },
      include: { components: true },
    });
    assert.ok(ownStructureAfter);
    assert.strictEqual(ownStructureAfter.passMark, 50.0);
    assert.strictEqual(ownStructureAfter.components.length, 1);
    assert.strictEqual(ownStructureAfter.components[0].id, ownCompId);
    assert.strictEqual(ownStructureAfter.components[0].name, 'Own Midterm');
    assert.strictEqual(ownStructureAfter.components[0].maxPoints, 100.0);
  } finally {
    if (otherCourse?.id) {
      await prisma.courseGradeComponent.deleteMany({ where: { structure: { courseId: otherCourse.id } } }).catch(() => {});
      await prisma.courseGradeStructure.deleteMany({ where: { courseId: otherCourse.id } }).catch(() => {});
      await prisma.course.deleteMany({ where: { id: otherCourse.id } }).catch(() => {});
    }
    await ctx.cleanup();
  }
});

test('WP-4 R1 C2: PUT with component id from a locked/published structure returns 422, locked component and own structure unchanged', async () => {
  const suffix = makeSuffix('c2_locked_foreign_id');
  const ctx = await setupTestContext(suffix);
  const baseUrl = await getTestBaseUrl();
  const authHeader = { Authorization: `Bearer ${ctx.actors.superAdminToken}`, 'Content-Type': 'application/json' };
  let lockedCourse: any = null;

  try {
    // 1. Create initial structure on own course (current term)
    const ownUrl = `${baseUrl}/courses/${ctx.course.id}/grade-structure?termId=${ctx.termCurrent.id}`;
    const resOwnInit = await fetch(ownUrl, {
      method: 'PUT',
      headers: authHeader,
      body: JSON.stringify({
        passMark: 50.0,
        components: [{ name: 'Own Midterm', maxPoints: 100.0, source: 'MANUAL' }],
      }),
    });
    assert.strictEqual(resOwnInit.status, 200);
    const ownCompId = (await resOwnInit.json()).data.components[0].id;

    // 2. Create a structure in a past/locked term (and with a PUBLISHED entry) on lockedCourse
    lockedCourse = await prisma.course.create({
      data: {
        name: `LockedCourse_${suffix}`,
        courseCode: `LC_${suffix.slice(-6)}`,
        credits: 3,
        departmentId: ctx.deptOwn.id,
      },
    });
    const lockedStructure = await prisma.courseGradeStructure.create({
      data: { courseId: lockedCourse.id, termId: ctx.termPast.id, passMark: 50.0 },
    });
    const lockedComp = await prisma.courseGradeComponent.create({
      data: {
        structureId: lockedStructure.id,
        name: 'Locked Published Exam',
        maxPoints: 100.0,
        source: 'MANUAL',
        displayOrder: 1,
      },
    });
    const lockedEnr = await prisma.enrollment.create({
      data: {
        studentId: ctx.enrollment.studentId,
        courseId: lockedCourse.id,
        semester: 1,
        academicYear: 2024,
        termId: ctx.termPast.id,
        status: 'COMPLETED',
      },
    });
    await prisma.courseGradeEntry.create({
      data: {
        enrollmentId: lockedEnr.id,
        componentId: lockedComp.id,
        score: 90.0,
        isAbsent: false,
        status: 'PUBLISHED',
        version: 1,
      },
    });

    // 3. Attempt to overwrite lockedComp via PUT on own course
    const resAttack = await fetch(ownUrl, {
      method: 'PUT',
      headers: authHeader,
      body: JSON.stringify({
        passMark: 50.0,
        components: [
          { id: ownCompId, name: 'Own Midterm', maxPoints: 60.0, source: 'MANUAL' },
          { id: lockedComp.id, name: 'Tampered Locked Exam', maxPoints: 40.0, source: 'MANUAL' },
        ],
      }),
    });
    assert.strictEqual(resAttack.status, 422, `Expected 422 for locked foreign component id, got ${resAttack.status}`);

    // Verify locked component is untouched
    const lockedCompAfter = await prisma.courseGradeComponent.findUnique({ where: { id: lockedComp.id } });
    assert.ok(lockedCompAfter);
    assert.strictEqual(lockedCompAfter.name, 'Locked Published Exam');
    assert.strictEqual(lockedCompAfter.maxPoints, 100.0);

    // Verify own structure is untouched
    const ownStructureAfter = await prisma.courseGradeStructure.findUnique({
      where: { courseId_termId: { courseId: ctx.course.id, termId: ctx.termCurrent.id } },
      include: { components: true },
    });
    assert.ok(ownStructureAfter);
    assert.strictEqual(ownStructureAfter.components.length, 1);
    assert.strictEqual(ownStructureAfter.components[0].id, ownCompId);
    assert.strictEqual(ownStructureAfter.components[0].maxPoints, 100.0);
  } finally {
    if (lockedCourse?.id) {
      await prisma.courseGradeEntry.deleteMany({ where: { enrollment: { courseId: lockedCourse.id } } }).catch(() => {});
      await prisma.enrollment.deleteMany({ where: { courseId: lockedCourse.id } }).catch(() => {});
      await prisma.courseGradeComponent.deleteMany({ where: { structure: { courseId: lockedCourse.id } } }).catch(() => {});
      await prisma.courseGradeStructure.deleteMany({ where: { courseId: lockedCourse.id } }).catch(() => {});
      await prisma.course.deleteMany({ where: { id: lockedCourse.id } }).catch(() => {});
    }
    await ctx.cleanup();
  }
});

test('WP-4 R1 C2: PUT with non-existent component id returns 422 (no 500), own structure unchanged', async () => {
  const suffix = makeSuffix('c2_nonexistent_id');
  const ctx = await setupTestContext(suffix);
  const baseUrl = await getTestBaseUrl();
  const authHeader = { Authorization: `Bearer ${ctx.actors.superAdminToken}`, 'Content-Type': 'application/json' };

  try {
    const ownUrl = `${baseUrl}/courses/${ctx.course.id}/grade-structure?termId=${ctx.termCurrent.id}`;
    const resOwnInit = await fetch(ownUrl, {
      method: 'PUT',
      headers: authHeader,
      body: JSON.stringify({
        passMark: 50.0,
        components: [{ name: 'Own Midterm', maxPoints: 100.0, source: 'MANUAL' }],
      }),
    });
    assert.strictEqual(resOwnInit.status, 200);
    const ownCompId = (await resOwnInit.json()).data.components[0].id;

    // Send non-existent component ID 99999999
    const resNonExistent = await fetch(ownUrl, {
      method: 'PUT',
      headers: authHeader,
      body: JSON.stringify({
        passMark: 50.0,
        components: [
          { id: ownCompId, name: 'Own Midterm', maxPoints: 50.0, source: 'MANUAL' },
          { id: 99999999, name: 'Ghost Component', maxPoints: 50.0, source: 'MANUAL' },
        ],
      }),
    });
    assert.notStrictEqual(resNonExistent.status, 500, 'Non-existent component id must not return 500');
    assert.strictEqual(resNonExistent.status, 422, `Expected 422 for non-existent component id, got ${resNonExistent.status}`);

    // Verify own structure is untouched
    const ownStructureAfter = await prisma.courseGradeStructure.findUnique({
      where: { courseId_termId: { courseId: ctx.course.id, termId: ctx.termCurrent.id } },
      include: { components: true },
    });
    assert.ok(ownStructureAfter);
    assert.strictEqual(ownStructureAfter.components.length, 1);
    assert.strictEqual(ownStructureAfter.components[0].id, ownCompId);
    assert.strictEqual(ownStructureAfter.components[0].maxPoints, 100.0);
  } finally {
    await ctx.cleanup();
  }
});

test.after(async () => {
  if (sharedServer) {
    await new Promise<void>((resolve) => sharedServer!.close(() => resolve()));
  }
});
