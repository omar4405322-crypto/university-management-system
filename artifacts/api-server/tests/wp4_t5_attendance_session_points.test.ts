import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import prisma from '../src/utils/prismaClient';
import app from '../src/app';
import { generateAccessToken } from '../src/utils/jwt.utils';
import { toHundredths } from '../src/utils/gradeMath.utils';
import { getGradeCalculator } from '../src/services/gradebookPublish.service';
import AttendanceService from '../src/services/attendance.service';

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

async function setupAttendanceTestContext(suffix: string) {
  // 1. College, Dept
  const college = await prisma.college.create({ data: { name: `Col_${suffix}` } });
  const dept = await prisma.department.create({ data: { name: `Dept_${suffix}`, collegeId: college.id } });

  // 2. Terms
  const termCurrent = await prisma.academicTerm.findFirstOrThrow({ where: { isCurrent: true } });
  const termPast = await prisma.academicTerm.create({
    data: {
      academicYearId: termCurrent.academicYearId,
      name: `Past_${suffix}`,
      termType: 'FALL',
      semesterNumber: 1,
      startDate: new Date('2020-09-01'),
      endDate: new Date('2021-01-31'),
      isCurrent: false,
    },
  });

  // 3. Super Admin & Doctor
  const superAdminUser = await prisma.user.create({
    data: { email: `sadmin_${suffix}@uni.edu`, password: passwordHash, role: 'SUPER_ADMIN' },
  });
  const superAdminToken = generateAccessToken(superAdminUser.id, superAdminUser.tokenVersion);

  const docUser = await prisma.user.create({
    data: { email: `doc_${suffix}@uni.edu`, password: passwordHash, role: 'DOCTOR' },
  });
  const doctor = await prisma.doctor.create({
    data: { userId: docUser.id, firstName: 'Dr', lastName: `Assigned_${suffix}`, departmentId: dept.id },
  });
  const docToken = generateAccessToken(docUser.id, docUser.tokenVersion);

  const unassignedDocUser = await prisma.user.create({
    data: { email: `unassigned_${suffix}@uni.edu`, password: passwordHash, role: 'DOCTOR' },
  });
  const unassignedDoctor = await prisma.doctor.create({
    data: { userId: unassignedDocUser.id, firstName: 'Dr', lastName: `Unassigned_${suffix}`, departmentId: dept.id },
  });
  const unassignedDocToken = generateAccessToken(unassignedDocUser.id, unassignedDocUser.tokenVersion);

  // 4. Students
  const stu1User = await prisma.user.create({
    data: { email: `stu1_${suffix}@uni.edu`, password: passwordHash, role: 'STUDENT' },
  });
  const student1 = await prisma.student.create({
    data: { userId: stu1User.id, firstName: 'Alice', lastName: `A_${suffix}`, studentId: `S1_${suffix.slice(-6)}`, departmentId: dept.id, year: 1 },
  });
  const stu1Token = generateAccessToken(stu1User.id, stu1User.tokenVersion);

  const stu2User = await prisma.user.create({
    data: { email: `stu2_${suffix}@uni.edu`, password: passwordHash, role: 'STUDENT' },
  });
  const student2 = await prisma.student.create({
    data: { userId: stu2User.id, firstName: 'Bob', lastName: `B_${suffix}`, studentId: `S2_${suffix.slice(-6)}`, departmentId: dept.id, year: 1 },
  });
  const stu2Token = generateAccessToken(stu2User.id, stu2User.tokenVersion);

  // 5. Courses
  const course = await prisma.course.create({
    data: { courseCode: `CS_${suffix.slice(-8)}`, name: `Course_${suffix}`, departmentId: dept.id, semester: 1 },
  });

  const courseOther = await prisma.course.create({
    data: { courseCode: `OTH_${suffix.slice(-8)}`, name: `OtherCourse_${suffix}`, departmentId: dept.id, semester: 1 },
  });

  // 6. ScheduleSlots
  const slot = await prisma.scheduleSlot.create({
    data: {
      courseId: course.id,
      doctorId: doctor.id,
      termId: termCurrent.id,
      dayOfWeek: 'Monday',
      startTime: '09:00',
      endTime: '11:00',
      slotType: 'LECTURE',
    },
  });

  const slotOtherCourse = await prisma.scheduleSlot.create({
    data: {
      courseId: courseOther.id,
      doctorId: doctor.id,
      termId: termCurrent.id,
      dayOfWeek: 'Tuesday',
      startTime: '09:00',
      endTime: '11:00',
      slotType: 'LECTURE',
    },
  });

  const slotPastTerm = await prisma.scheduleSlot.create({
    data: {
      courseId: course.id,
      doctorId: doctor.id,
      termId: termPast.id,
      dayOfWeek: 'Wednesday',
      startTime: '09:00',
      endTime: '11:00',
      slotType: 'LECTURE',
    },
  });

  // 7. Enrollments
  const enrollment1 = await prisma.enrollment.create({
    data: { studentId: student1.id, courseId: course.id, semester: 1, academicYear: 2026, termId: termCurrent.id, status: 'ENROLLED' },
  });
  const enrollment2 = await prisma.enrollment.create({
    data: { studentId: student2.id, courseId: course.id, semester: 1, academicYear: 2026, termId: termCurrent.id, status: 'ENROLLED' },
  });

  const cleanup = async () => {
    // Delete in strict child-to-parent order
    await prisma.courseGradeEntry.deleteMany({ where: { enrollment: { courseId: { in: [course.id, courseOther.id] } } } });
    await prisma.courseGradeComponent.deleteMany({ where: { structure: { courseId: { in: [course.id, courseOther.id] } } } });
    await prisma.courseGradeStructure.deleteMany({ where: { courseId: { in: [course.id, courseOther.id] } } });
    await prisma.attendance.deleteMany({ where: { courseId: { in: [course.id, courseOther.id] } } });
    await prisma.attendanceSession.deleteMany({ where: { scheduleSlotId: { in: [slot.id, slotOtherCourse.id, slotPastTerm.id] } } });
    await prisma.enrollment.deleteMany({ where: { courseId: { in: [course.id, courseOther.id] } } });
    await prisma.scheduleSlot.deleteMany({ where: { id: { in: [slot.id, slotOtherCourse.id, slotPastTerm.id] } } });
    await prisma.course.deleteMany({ where: { id: { in: [course.id, courseOther.id] } } });
    await prisma.student.deleteMany({ where: { id: { in: [student1.id, student2.id] } } });
    await prisma.doctor.deleteMany({ where: { id: { in: [doctor.id, unassignedDoctor.id] } } });
    await prisma.department.deleteMany({ where: { id: dept.id } });
    await prisma.college.deleteMany({ where: { id: college.id } });
    await prisma.academicTerm.deleteMany({ where: { id: termPast.id } });
    await prisma.user.deleteMany({
      where: { id: { in: [superAdminUser.id, docUser.id, unassignedDocUser.id, stu1User.id, stu2User.id] } },
    });
  };

  return {
    college,
    dept,
    termCurrent,
    termPast,
    superAdminUser,
    superAdminToken,
    docUser,
    doctor,
    docToken,
    unassignedDocUser,
    unassignedDoctor,
    unassignedDocToken,
    stu1User,
    student1,
    stu1Token,
    stu2User,
    student2,
    stu2Token,
    course,
    courseOther,
    slot,
    slotOtherCourse,
    slotPastTerm,
    enrollment1,
    enrollment2,
    cleanup,
  };
}

test('WP-4 T-5: Migration DB CHECK Constraints (Raw SQL Inserts)', async () => {
  const suffix = makeSuffix('mig_check');
  const ctx = await setupAttendanceTestContext(suffix);

  try {
    // 1. AttendanceSession: sessionPoints negative rejected by CHECK constraint
    await assert.rejects(
      async () => {
        await prisma.$executeRawUnsafe(`
          INSERT INTO "AttendanceSession" ("scheduleSlotId", "secretKey", "expiresAt", "sessionPoints")
          VALUES (${ctx.slot.id}, 'secret1', NOW() + interval '1 hour', -1.0)
        `);
      },
      (err: any) => {
        assert.match(err.message, /check constraint|AttendanceSession_sessionPoints_check/i);
        return true;
      }
    );

    // 2. AttendanceSession: sessionPoints with 3 decimals rejected by CHECK constraint
    await assert.rejects(
      async () => {
        await prisma.$executeRawUnsafe(`
          INSERT INTO "AttendanceSession" ("scheduleSlotId", "secretKey", "expiresAt", "sessionPoints")
          VALUES (${ctx.slot.id}, 'secret2', NOW() + interval '1 hour', 2.125)
        `);
      },
      (err: any) => {
        assert.match(err.message, /check constraint|AttendanceSession_sessionPoints_check/i);
        return true;
      }
    );

    // 3. AttendanceStatusWeight: status PRESENT rejected by CHECK constraint
    await assert.rejects(
      async () => {
        await prisma.$executeRawUnsafe(`
          INSERT INTO "AttendanceStatusWeight" ("status", "weight", "updatedById", "createdAt", "updatedAt")
          VALUES ('PRESENT', 1.0, ${ctx.superAdminUser.id}, NOW(), NOW())
        `);
      },
      (err: any) => {
        assert.match(err.message, /check constraint|AttendanceStatusWeight_status_check/i);
        return true;
      }
    );

    // 4. AttendanceStatusWeight: status ABSENT rejected by CHECK constraint
    await assert.rejects(
      async () => {
        await prisma.$executeRawUnsafe(`
          INSERT INTO "AttendanceStatusWeight" ("status", "weight", "updatedById", "createdAt", "updatedAt")
          VALUES ('ABSENT', 0.0, ${ctx.superAdminUser.id}, NOW(), NOW())
        `);
      },
      (err: any) => {
        assert.match(err.message, /check constraint|AttendanceStatusWeight_status_check/i);
        return true;
      }
    );

    // 5. AttendanceStatusWeight: weight < 0 or > 1 rejected
    await assert.rejects(
      async () => {
        await prisma.$executeRawUnsafe(`
          INSERT INTO "AttendanceStatusWeight" ("status", "weight", "updatedById", "createdAt", "updatedAt")
          VALUES ('LATE', -0.5, ${ctx.superAdminUser.id}, NOW(), NOW())
        `);
      },
      (err: any) => {
        assert.match(err.message, /check constraint|AttendanceStatusWeight_weight_check/i);
        return true;
      }
    );

    await assert.rejects(
      async () => {
        await prisma.$executeRawUnsafe(`
          INSERT INTO "AttendanceStatusWeight" ("status", "weight", "updatedById", "createdAt", "updatedAt")
          VALUES ('LATE', 1.5, ${ctx.superAdminUser.id}, NOW(), NOW())
        `);
      },
      (err: any) => {
        assert.match(err.message, /check constraint|AttendanceStatusWeight_weight_check/i);
        return true;
      }
    );

    // 6. AttendanceStatusWeight: weight with 3 decimals rejected
    await assert.rejects(
      async () => {
        await prisma.$executeRawUnsafe(`
          INSERT INTO "AttendanceStatusWeight" ("status", "weight", "updatedById", "createdAt", "updatedAt")
          VALUES ('LATE', 0.125, ${ctx.superAdminUser.id}, NOW(), NOW())
        `);
      },
      (err: any) => {
        assert.match(err.message, /check constraint|AttendanceStatusWeight_weight_check/i);
        return true;
      }
    );
  } finally {
    await ctx.cleanup();
  }
});

test('WP-4 T-5: sessionPoints Validation on Session Start', async () => {
  const suffix = makeSuffix('sp_val');
  const ctx = await setupAttendanceTestContext(suffix);
  const baseUrl = await getTestBaseUrl();
  const startUrl = `${baseUrl}/attendance/session/start`;

  try {
    // 1. Doctor supplies positive sessionPoints when course has NO AUTO_ATTENDANCE component -> 422
    const resNoComp = await fetch(startUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ctx.docToken}` },
      body: JSON.stringify({ scheduleSlotId: ctx.slot.id, sessionPoints: 5.0 }),
    });
    assert.strictEqual(resNoComp.status, 422, 'Supplying sessionPoints without AUTO_ATTENDANCE component must return 422');

    // Now create CourseGradeStructure with AUTO_ATTENDANCE component (maxPoints: 10.0)
    const structure = await prisma.courseGradeStructure.create({
      data: { courseId: ctx.course.id, termId: ctx.termCurrent.id, passMark: 50.0 },
    });
    const autoAttendanceComp = await prisma.courseGradeComponent.create({
      data: { structureId: structure.id, name: 'Attendance', maxPoints: 10.0, source: 'AUTO_ATTENDANCE', displayOrder: 1 },
    });

    // 2. Negative sessionPoints -> 400 or 422
    const resNeg = await fetch(startUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ctx.docToken}` },
      body: JSON.stringify({ scheduleSlotId: ctx.slot.id, sessionPoints: -1.0 }),
    });
    assert.ok(resNeg.status === 400 || resNeg.status === 422, 'Negative sessionPoints must be rejected');

    // 3. Non-number sessionPoints -> 400 or 422
    const resNaN = await fetch(startUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ctx.docToken}` },
      body: JSON.stringify({ scheduleSlotId: ctx.slot.id, sessionPoints: 'invalid_points' }),
    });
    assert.ok(resNaN.status === 400 || resNaN.status === 422, 'Non-number sessionPoints must be rejected');

    // 4. More than 2 decimals sessionPoints -> 400 or 422
    const resDec = await fetch(startUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ctx.docToken}` },
      body: JSON.stringify({ scheduleSlotId: ctx.slot.id, sessionPoints: 2.125 }),
    });
    assert.ok(resDec.status === 400 || resDec.status === 422, 'More than 2 decimals sessionPoints must be rejected');

    // 5. Exceeding single component maxPoints (11.0 > 10.0) -> 422
    const resAboveMax = await fetch(startUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ctx.docToken}` },
      body: JSON.stringify({ scheduleSlotId: ctx.slot.id, sessionPoints: 11.0 }),
    });
    assert.strictEqual(resAboveMax.status, 422, 'sessionPoints exceeding component maxPoints must return 422');

    // 6. Valid first session: 6.0 points -> 200
    const resSess1 = await fetch(startUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ctx.docToken}` },
      body: JSON.stringify({ scheduleSlotId: ctx.slot.id, sessionPoints: 6.0 }),
    });
    assert.strictEqual(resSess1.status, 200, 'Valid session start with sessionPoints 6.0 must succeed');
    const jsonSess1 = await resSess1.json();
    assert.strictEqual(jsonSess1.success, true);

    const savedSess1 = await prisma.attendanceSession.findUnique({ where: { id: jsonSess1.data.sessionId } });
    assert.strictEqual(savedSess1?.sessionPoints, 6.0);

    // 7. Cumulative overflow: second session requesting 5.0 points (6.0 + 5.0 = 11.0 > 10.0) -> 422
    const resSess2 = await fetch(startUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ctx.docToken}` },
      body: JSON.stringify({ scheduleSlotId: ctx.slot.id, sessionPoints: 5.0 }),
    });
    assert.strictEqual(resSess2.status, 422, 'Cumulative sessionPoints overflow (11.0 > 10.0) must return 422');

    // 8. Null sessionPoints allowed: contributes 0 and succeeds
    const resSessNull = await fetch(startUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ctx.docToken}` },
      body: JSON.stringify({ scheduleSlotId: ctx.slot.id, sessionPoints: null }),
    });
    assert.strictEqual(resSessNull.status, 200, 'Session start with null sessionPoints must succeed');
    const jsonSessNull = await resSessNull.json();
    const savedSessNull = await prisma.attendanceSession.findUnique({ where: { id: jsonSessNull.data.sessionId } });
    assert.strictEqual(savedSessNull?.sessionPoints, null);

    // 9. Unauthorized role / scope checks:
    // Student token attempting to start session -> 403
    const resStuStart = await fetch(startUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ctx.stu1Token}` },
      body: JSON.stringify({ scheduleSlotId: ctx.slot.id, sessionPoints: 2.0 }),
    });
    assert.strictEqual(resStuStart.status, 403, 'Student cannot start attendance session');

    // Unassigned Doctor attempting to start session for another doctor slot -> 403
    const resUnassignedStart = await fetch(startUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ctx.unassignedDocToken}` },
      body: JSON.stringify({ scheduleSlotId: ctx.slot.id, sessionPoints: 2.0 }),
    });
    assert.strictEqual(resUnassignedStart.status, 403, 'Doctor unassigned to slot cannot start session');
  } finally {
    await ctx.cleanup();
  }
});

test('WP-4 T-5: Concurrency / Parallel Session Starts Cumulative Cap', async () => {
  const suffix = makeSuffix('parallel_starts');
  const ctx = await setupAttendanceTestContext(suffix);
  const baseUrl = await getTestBaseUrl();
  const startUrl = `${baseUrl}/attendance/session/start`;

  try {
    const structure = await prisma.courseGradeStructure.create({
      data: { courseId: ctx.course.id, termId: ctx.termCurrent.id, passMark: 50.0 },
    });
    await prisma.courseGradeComponent.create({
      data: { structureId: structure.id, name: 'Attendance', maxPoints: 10.0, source: 'AUTO_ATTENDANCE', displayOrder: 1 },
    });

    // Two parallel requests both asking for 6.0 points on a 10.0 cap
    const [res1, res2] = await Promise.all([
      fetch(startUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ctx.docToken}` },
        body: JSON.stringify({ scheduleSlotId: ctx.slot.id, sessionPoints: 6.0 }),
      }),
      fetch(startUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ctx.docToken}` },
        body: JSON.stringify({ scheduleSlotId: ctx.slot.id, sessionPoints: 6.0 }),
      }),
    ]);

    const statuses = [res1.status, res2.status].sort();
    // One must succeed (200) and the other must be rejected (422) due to serializable cumulative cap check
    assert.deepStrictEqual(statuses, [200, 422], 'One parallel start must succeed (200) and one must fail (422)');

    // Verify sum of points in DB never exceeds 10.0
    const sessions = await prisma.attendanceSession.findMany({
      where: { scheduleSlotId: ctx.slot.id },
    });
    const totalPoints = sessions.reduce((sum, s) => sum + (s.sessionPoints ?? 0), 0);
    assert.ok(totalPoints <= 10.0, `Total session points (${totalPoints}) must not exceed maxPoints (10.0)`);
  } finally {
    await ctx.cleanup();
  }
});

test('WP-4 T-5: Mass Assignment Protection on Other Attendance Routes', async () => {
  const suffix = makeSuffix('mass_assign');
  const ctx = await setupAttendanceTestContext(suffix);
  const baseUrl = await getTestBaseUrl();

  try {
    const structure = await prisma.courseGradeStructure.create({
      data: { courseId: ctx.course.id, termId: ctx.termCurrent.id, passMark: 50.0 },
    });
    await prisma.courseGradeComponent.create({
      data: { structureId: structure.id, name: 'Attendance', maxPoints: 10.0, source: 'AUTO_ATTENDANCE', displayOrder: 1 },
    });

    // Start a valid session with 5.0 sessionPoints
    const resStart = await fetch(`${baseUrl}/attendance/session/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ctx.docToken}` },
      body: JSON.stringify({ scheduleSlotId: ctx.slot.id, sessionPoints: 5.0 }),
    });
    assert.strictEqual(resStart.status, 200);
    const { data: sessionData } = await resStart.json();

    // 1. POST /api/attendance/session/:sessionId/mark with sessionPoints in body
    const resMark = await fetch(`${baseUrl}/attendance/session/${sessionData.sessionId}/mark`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ctx.docToken}` },
      body: JSON.stringify({ studentId: ctx.student1.id, status: 'PRESENT', sessionPoints: 99.0 }),
    });
    assert.strictEqual(resMark.status, 200);

    // 2. PUT /api/attendance/session/:sessionId/location with sessionPoints in body
    const resLoc = await fetch(`${baseUrl}/attendance/session/${sessionData.sessionId}/location`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ctx.docToken}` },
      body: JSON.stringify({ latitude: 30.0, longitude: 31.0, radius: 100, sessionPoints: 99.0 }),
    });
    assert.strictEqual(resLoc.status, 200);

    // Verify sessionPoints remains exactly 5.0 and was not overwritten
    const sessionAfter = await prisma.attendanceSession.findUnique({ where: { id: sessionData.sessionId } });
    assert.strictEqual(sessionAfter?.sessionPoints, 5.0, 'Session sessionPoints must remain 5.0');
  } finally {
    await ctx.cleanup();
  }
});

test('WP-4 T-5: Attendance Status Weights API & Validation', async () => {
  const suffix = makeSuffix('weights');
  const ctx = await setupAttendanceTestContext(suffix);
  const baseUrl = await getTestBaseUrl();
  const weightsUrl = `${baseUrl}/attendance/weights`;

  try {
    // 1. GET without token -> 401
    const resNoAuth = await fetch(weightsUrl);
    assert.strictEqual(resNoAuth.status, 401);

    // 2. GET with Student or Doctor token -> 403
    const resStu = await fetch(weightsUrl, { headers: { Authorization: `Bearer ${ctx.stu1Token}` } });
    assert.strictEqual(resStu.status, 403);
    const resDoc = await fetch(weightsUrl, { headers: { Authorization: `Bearer ${ctx.docToken}` } });
    assert.strictEqual(resDoc.status, 403);

    // 3. GET with Super Admin -> 200 with default unset 0 weights
    const resGet = await fetch(weightsUrl, { headers: { Authorization: `Bearer ${ctx.superAdminToken}` } });
    assert.strictEqual(resGet.status, 200);
    const jsonGet = await resGet.json();
    assert.strictEqual(jsonGet.success, true);
    assert.ok(jsonGet.data);

    // 4. PUT without Super Admin -> 403
    const resPutDoc = await fetch(weightsUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ctx.docToken}` },
      body: JSON.stringify({ weights: { LATE: 0.5 } }),
    });
    assert.strictEqual(resPutDoc.status, 403);

    // 5. PUT invalid weights (weight < 0, weight > 1, 3 decimals, unknown status, PRESENT, ABSENT)
    const invalidPayloads = [
      { weights: { LATE: -0.1 } },
      { weights: { LATE: 1.1 } },
      { weights: { LATE: 0.125 } },
      { weights: { LATE: 'not_a_number' } },
      { weights: { PRESENT: 1.0 } },
      { weights: { ABSENT: 0.5 } },
      { weights: { UNKNOWN_STATUS: 0.5 } },
    ];

    for (const payload of invalidPayloads) {
      const resInv = await fetch(weightsUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ctx.superAdminToken}` },
        body: JSON.stringify(payload),
      });
      assert.ok(
        resInv.status === 400 || resInv.status === 422,
        `Invalid payload ${JSON.stringify(payload)} must be rejected with 400/422, got ${resInv.status}`
      );
    }

    // 6. Valid PUT update
    const validWeights = { LATE: 0.5, EXCUSED: 0.75, PENDING_REVIEW: 0.25 };
    const resPut = await fetch(weightsUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ctx.superAdminToken}` },
      body: JSON.stringify({ weights: validWeights }),
    });
    assert.strictEqual(resPut.status, 200);
    const jsonPut = await resPut.json();
    assert.strictEqual(jsonPut.success, true);

    // Verify GET reflects the new weights
    const resGetAfter = await fetch(weightsUrl, { headers: { Authorization: `Bearer ${ctx.superAdminToken}` } });
    assert.strictEqual(resGetAfter.status, 200);
    const jsonGetAfter = await resGetAfter.json();
    assert.strictEqual(jsonGetAfter.data.LATE, 0.5);
    assert.strictEqual(jsonGetAfter.data.EXCUSED, 0.75);
    assert.strictEqual(jsonGetAfter.data.PENDING_REVIEW, 0.25);

    // 7. Verify Audit Log entry created for the weight change
    const auditRow = await prisma.auditLog.findFirst({
      where: { action: 'UPDATE_ATTENDANCE_WEIGHTS', userId: ctx.superAdminUser.id },
      orderBy: { id: 'desc' },
    });
    assert.ok(auditRow, 'An AuditLog row must be recorded for UPDATE_ATTENDANCE_WEIGHTS');
  } finally {
    await prisma.attendanceStatusWeight.deleteMany({});
    await ctx.cleanup();
  }
});

test('WP-4 T-5: AUTO_ATTENDANCE Calculator Logic & Weight Mathematics', async () => {
  const suffix = makeSuffix('calc_logic');
  const ctx = await setupAttendanceTestContext(suffix);

  try {
    // Set weights in DB: LATE = 0.50, EXCUSED = 0.80, PENDING_REVIEW = 0.00
    await prisma.attendanceStatusWeight.deleteMany({});
    await prisma.attendanceStatusWeight.createMany({
      data: [
        { status: 'LATE', weight: 0.5, updatedById: ctx.superAdminUser.id },
        { status: 'EXCUSED', weight: 0.8, updatedById: ctx.superAdminUser.id },
      ],
    });

    const structure = await prisma.courseGradeStructure.create({
      data: { courseId: ctx.course.id, termId: ctx.termCurrent.id, passMark: 50.0 },
    });
    const autoComp = await prisma.courseGradeComponent.create({
      data: { structureId: structure.id, name: 'Attendance Component', maxPoints: 20.0, source: 'AUTO_ATTENDANCE', displayOrder: 1 },
    });

    // Create 4 sessions for this course-term:
    // Session 1: 3.0 pts
    const sess1 = await prisma.attendanceSession.create({
      data: { scheduleSlotId: ctx.slot.id, secretKey: 'key1', sessionPoints: 3.0, expiresAt: new Date(Date.now() + 3600000) },
    });
    // Session 2: 4.0 pts
    const sess2 = await prisma.attendanceSession.create({
      data: { scheduleSlotId: ctx.slot.id, secretKey: 'key2', sessionPoints: 4.0, expiresAt: new Date(Date.now() + 3600000) },
    });
    // Session 3: 2.5 pts
    const sess3 = await prisma.attendanceSession.create({
      data: { scheduleSlotId: ctx.slot.id, secretKey: 'key3', sessionPoints: 2.5, expiresAt: new Date(Date.now() + 3600000) },
    });
    // Session 4: 2.0 pts
    const sess4 = await prisma.attendanceSession.create({
      data: { scheduleSlotId: ctx.slot.id, secretKey: 'key4', sessionPoints: 2.0, expiresAt: new Date(Date.now() + 3600000) },
    });

    // Other course session: 10.0 pts (MUST BE EXCLUDED)
    const sessOtherCourse = await prisma.attendanceSession.create({
      data: { scheduleSlotId: ctx.slotOtherCourse.id, secretKey: 'keyOth', sessionPoints: 10.0, expiresAt: new Date(Date.now() + 3600000) },
    });

    // Other term session: 10.0 pts (MUST BE EXCLUDED)
    const sessPastTerm = await prisma.attendanceSession.create({
      data: { scheduleSlotId: ctx.slotPastTerm.id, secretKey: 'keyPast', sessionPoints: 10.0, expiresAt: new Date(Date.now() + 3600000) },
    });

    // Student 1 Attendances:
    // Session 1: PRESENT (approved, locationFlagged = false) -> 3.0 * 1.0 = 3.0
    // Session 2: LATE -> 4.0 * 0.50 = 2.0
    // Session 3: EXCUSED -> 2.5 * 0.80 = 2.0
    // Session 4: ABSENT -> 2.0 * 0.0 = 0.0
    // sessOtherCourse: PRESENT (must not count!)
    // Expected = 3.0 + 2.0 + 2.0 + 0.0 = 7.00
    await prisma.attendance.createMany({
      data: [
        { studentId: ctx.student1.id, courseId: ctx.course.id, sessionId: sess1.id, scheduleSlotId: ctx.slot.id, status: 'PRESENT', locationFlagged: false },
        { studentId: ctx.student1.id, courseId: ctx.course.id, sessionId: sess2.id, scheduleSlotId: ctx.slot.id, status: 'LATE', locationFlagged: false },
        { studentId: ctx.student1.id, courseId: ctx.course.id, sessionId: sess3.id, scheduleSlotId: ctx.slot.id, status: 'EXCUSED', locationFlagged: false },
        { studentId: ctx.student1.id, courseId: ctx.course.id, sessionId: sess4.id, scheduleSlotId: ctx.slot.id, status: 'ABSENT', locationFlagged: false },
        { studentId: ctx.student1.id, courseId: ctx.courseOther.id, sessionId: sessOtherCourse.id, scheduleSlotId: ctx.slotOtherCourse.id, status: 'PRESENT', locationFlagged: false },
      ],
    });

    // Student 2 Attendances:
    // Session 1: PRESENT with locationFlagged = true (unapproved) -> counts as unapproved (not full points, or pending)
    // Session 2: PENDING_REVIEW (weight unset -> 0.0) -> 0.0
    // Session 3: No record (absent) -> 0.0
    // Session 4: PRESENT (approved) -> 2.0 * 1.0 = 2.0
    // Expected Student 2 = 2.00
    await prisma.attendance.createMany({
      data: [
        { studentId: ctx.student2.id, courseId: ctx.course.id, sessionId: sess1.id, scheduleSlotId: ctx.slot.id, status: 'PRESENT', locationFlagged: true },
        { studentId: ctx.student2.id, courseId: ctx.course.id, sessionId: sess2.id, scheduleSlotId: ctx.slot.id, status: 'PENDING_REVIEW', locationFlagged: true },
        { studentId: ctx.student2.id, courseId: ctx.course.id, sessionId: sess4.id, scheduleSlotId: ctx.slot.id, status: 'PRESENT', locationFlagged: false },
      ],
    });

    const calculator = getGradeCalculator('AUTO_ATTENDANCE');
    assert.ok(calculator, 'AUTO_ATTENDANCE calculator must be registered');

    // Run calculator inside transaction
    const score1 = await prisma.$transaction(async (tx) => {
      return calculator!({
        enrollmentId: ctx.enrollment1.id,
        courseId: ctx.course.id,
        termId: ctx.termCurrent.id,
        component: { id: autoComp.id, name: autoComp.name, maxPoints: autoComp.maxPoints, source: autoComp.source },
        tx,
      });
    });

    const expectedScore1 = 3.0 * 1.0 + 4.0 * 0.5 + 2.5 * 0.8 + 2.0 * 0.0;
    assert.strictEqual(score1, expectedScore1, `Student 1 score must be ${expectedScore1}`);

    const score2 = await prisma.$transaction(async (tx) => {
      return calculator!({
        enrollmentId: ctx.enrollment2.id,
        courseId: ctx.course.id,
        termId: ctx.termCurrent.id,
        component: { id: autoComp.id, name: autoComp.name, maxPoints: autoComp.maxPoints, source: autoComp.source },
        tx,
      });
    });

    const expectedScore2 = 2.0 * 1.0;
    assert.strictEqual(score2, expectedScore2, `Student 2 score must be ${expectedScore2}`);
  } finally {
    await prisma.attendanceStatusWeight.deleteMany({});
    await ctx.cleanup();
  }
});

test('WP-4 T-5: End-to-End Gradebook Publish with AUTO_ATTENDANCE Component', async () => {
  const suffix = makeSuffix('pub_e2e');
  const ctx = await setupAttendanceTestContext(suffix);
  const baseUrl = await getTestBaseUrl();
  const publishUrl = `${baseUrl}/courses/${ctx.course.id}/gradebook/publish?termId=${ctx.termCurrent.id}`;

  try {
    // Set LATE weight = 0.50
    await prisma.attendanceStatusWeight.deleteMany({});
    await prisma.attendanceStatusWeight.create({
      data: { status: 'LATE', weight: 0.5, updatedById: ctx.superAdminUser.id },
    });

    // Structure with passMark 50.0:
    // Comp 1: AUTO_ATTENDANCE (10 pts)
    // Comp 2: Midterm MANUAL (40 pts)
    // Comp 3: Final MANUAL (50 pts)
    // Total = 100 pts.
    const structure = await prisma.courseGradeStructure.create({
      data: { courseId: ctx.course.id, termId: ctx.termCurrent.id, passMark: 50.0 },
    });
    const autoAttendanceComp = await prisma.courseGradeComponent.create({
      data: { structureId: structure.id, name: 'Attendance', maxPoints: 10.0, source: 'AUTO_ATTENDANCE', displayOrder: 1 },
    });
    const compMidterm = await prisma.courseGradeComponent.create({
      data: { structureId: structure.id, name: 'Midterm', maxPoints: 40.0, source: 'MANUAL', displayOrder: 2 },
    });
    const compFinal = await prisma.courseGradeComponent.create({
      data: { structureId: structure.id, name: 'Final', maxPoints: 50.0, source: 'MANUAL', displayOrder: 3 },
    });

    // Start 2 attendance sessions:
    // Session 1: 5.0 pts
    const sess1 = await prisma.attendanceSession.create({
      data: { scheduleSlotId: ctx.slot.id, secretKey: 'sec1', sessionPoints: 5.0, expiresAt: new Date(Date.now() + 3600000) },
    });
    // Session 2: 5.0 pts
    const sess2 = await prisma.attendanceSession.create({
      data: { scheduleSlotId: ctx.slot.id, secretKey: 'sec2', sessionPoints: 5.0, expiresAt: new Date(Date.now() + 3600000) },
    });

    // Student 1: Session 1 PRESENT (5.0), Session 2 LATE (5.0 * 0.5 = 2.5) -> Auto Attendance = 7.5 pts
    await prisma.attendance.createMany({
      data: [
        { studentId: ctx.student1.id, courseId: ctx.course.id, sessionId: sess1.id, scheduleSlotId: ctx.slot.id, status: 'PRESENT', locationFlagged: false },
        { studentId: ctx.student1.id, courseId: ctx.course.id, sessionId: sess2.id, scheduleSlotId: ctx.slot.id, status: 'LATE', locationFlagged: false },
      ],
    });

    // Pre-enter MANUAL components for Student 1 as PUBLISHED
    await prisma.courseGradeEntry.createMany({
      data: [
        { enrollmentId: ctx.enrollment1.id, componentId: compMidterm.id, score: 32.5, status: 'PUBLISHED', publishedById: ctx.docUser.id },
        { enrollmentId: ctx.enrollment1.id, componentId: compFinal.id, score: 45.0, status: 'PUBLISHED', publishedById: ctx.docUser.id },
      ],
    });

    // Student 2: Manual components missing -> enrollment 2 is incomplete, auto component not snapshotted yet

    // Publish gradebook as Doctor
    const resPub = await fetch(publishUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ctx.docToken}` },
      body: JSON.stringify({}),
    });
    assert.strictEqual(resPub.status, 200, 'Publishing complete gradebook with AUTO_ATTENDANCE must succeed');

    // Verify AUTO_ATTENDANCE component entry for Student 1 was snapshotted as PUBLISHED with score 7.5
    const entry1 = await prisma.courseGradeEntry.findUnique({
      where: { enrollmentId_componentId: { enrollmentId: ctx.enrollment1.id, componentId: autoAttendanceComp.id } },
    });
    assert.ok(entry1, 'GradeEntry for AUTO_ATTENDANCE component must be created');
    assert.strictEqual(entry1.status, 'PUBLISHED');
    assert.strictEqual(entry1.score, 7.5);

    // Verify Enrollment 1 totals:
    // Attendance 7.5 + Midterm 32.5 + Final 45.0 = 85.0 points earned
    // Total max = 100.0, finalGrade = 85.0%, status = COMPLETED (>= 50.0 passMark)
    const enr1 = await prisma.enrollment.findUnique({ where: { id: ctx.enrollment1.id } });
    assert.strictEqual(enr1?.finalPointsEarned, 85.0);
    assert.strictEqual(enr1?.finalPointsMax, 100.0);
    assert.strictEqual(enr1?.finalGrade, 85.0);
    assert.strictEqual(enr1?.status, 'COMPLETED');
  } finally {
    await prisma.attendanceStatusWeight.deleteMany({});
    await ctx.cleanup();
  }
});

test('WP-4 T-5 Correction P4: Calculator semantics - (a) locationFlagged unreviewed gives 0, (b) overrideFlaggedRecord approval gives full session points, (c) null-termId slot counts only when structure term is current term', async () => {
  const suffix = makeSuffix('corr_p4');
  const ctx = await setupAttendanceTestContext(suffix);

  try {
    // 1. Structure in Current Term (passMark 50, AUTO_ATTENDANCE 20 pts)
    const structCurrent = await prisma.courseGradeStructure.create({
      data: { courseId: ctx.course.id, termId: ctx.termCurrent.id, passMark: 50.0 },
    });
    const autoCompCurrent = await prisma.courseGradeComponent.create({
      data: { structureId: structCurrent.id, name: 'Attendance Current', maxPoints: 20.0, source: 'AUTO_ATTENDANCE', displayOrder: 1 },
    });

    // Structure in Past Term (passMark 50, AUTO_ATTENDANCE 20 pts)
    const structPast = await prisma.courseGradeStructure.create({
      data: { courseId: ctx.course.id, termId: ctx.termPast.id, passMark: 50.0 },
    });
    const autoCompPast = await prisma.courseGradeComponent.create({
      data: { structureId: structPast.id, name: 'Attendance Past', maxPoints: 20.0, source: 'AUTO_ATTENDANCE', displayOrder: 1 },
    });

    // Enrollment in Past Term for student 1
    const enrPast = await prisma.enrollment.create({
      data: { studentId: ctx.student1.id, courseId: ctx.course.id, semester: 1, academicYear: 2020, termId: ctx.termPast.id, status: 'ENROLLED' },
    });

    // Slot with termId: null (OD-29 baseline compatibility)
    const slotNullTerm = await prisma.scheduleSlot.create({
      data: {
        courseId: ctx.course.id,
        doctorId: ctx.doctor.id,
        termId: null,
        dayOfWeek: 'Thursday',
        startTime: '11:00',
        endTime: '13:00',
        slotType: 'LECTURE',
      },
    });

    // Session 1: On normal current-term slot (ctx.slot), 5.0 pts
    const sessFlagged = await prisma.attendanceSession.create({
      data: { scheduleSlotId: ctx.slot.id, secretKey: 'secFlag', sessionPoints: 5.0, expiresAt: new Date(Date.now() + 3600000) },
    });

    // Session 2: On null-term slot (slotNullTerm), 4.0 pts
    const sessNullTerm = await prisma.attendanceSession.create({
      data: { scheduleSlotId: slotNullTerm.id, secretKey: 'secNull', sessionPoints: 4.0, expiresAt: new Date(Date.now() + 3600000) },
    });

    // Student 1 Attendance:
    // Session 1: PENDING_REVIEW with locationFlagged = true (unreviewed).
    const attFlagged = await prisma.attendance.create({
      data: {
        studentId: ctx.student1.id,
        courseId: ctx.course.id,
        sessionId: sessFlagged.id,
        scheduleSlotId: ctx.slot.id,
        status: 'PENDING_REVIEW',
        pendingApprovedStatus: 'PRESENT',
        locationFlagged: true,
      },
    });

    // Session 2: PRESENT on null-term slot
    await prisma.attendance.create({
      data: {
        studentId: ctx.student1.id,
        courseId: ctx.course.id,
        sessionId: sessNullTerm.id,
        scheduleSlotId: slotNullTerm.id,
        status: 'PRESENT',
        locationFlagged: false,
      },
    });

    const calculator = getGradeCalculator('AUTO_ATTENDANCE');
    assert.ok(calculator, 'AUTO_ATTENDANCE calculator must be registered');

    // (a) Run calculator on Current Term:
    // sessFlagged: unreviewed locationFlagged -> 0 points
    // sessNullTerm: null-term slot matches because termCurrent.isCurrent is true -> 4.0 points
    // Total expected = 0.0 + 4.0 = 4.0
    const scoreBeforeApproval = await prisma.$transaction(async (tx) => {
      return calculator!({
        enrollmentId: ctx.enrollment1.id,
        courseId: ctx.course.id,
        termId: ctx.termCurrent.id,
        component: { id: autoCompCurrent.id, name: autoCompCurrent.name, maxPoints: autoCompCurrent.maxPoints, source: autoCompCurrent.source },
        tx,
      });
    });
    assert.strictEqual(scoreBeforeApproval, 4.0, '(a) Unreviewed locationFlagged session must give 0 points');

    // (b) Real overrideFlaggedRecord approval via AttendanceService:
    const docActor = {
      id: ctx.docUser.id,
      email: ctx.docUser.email,
      role: 'DOCTOR',
      doctor: { id: ctx.doctor.id },
    } as any;

    await AttendanceService.overrideFlaggedRecord(docActor, attFlagged.id, 'Approved by assigned doctor');

    // Verify record in DB is now resolved
    const attAfter = await prisma.attendance.findUnique({ where: { id: attFlagged.id } });
    assert.strictEqual(attAfter?.status, 'PRESENT');
    assert.strictEqual(attAfter?.locationFlagged, false);

    // Re-run calculator on Current Term:
    // sessFlagged: approved -> 5.0 points
    // sessNullTerm: null-term slot in current term -> 4.0 points
    // Total expected = 5.0 + 4.0 = 9.0
    const scoreAfterApproval = await prisma.$transaction(async (tx) => {
      return calculator!({
        enrollmentId: ctx.enrollment1.id,
        courseId: ctx.course.id,
        termId: ctx.termCurrent.id,
        component: { id: autoCompCurrent.id, name: autoCompCurrent.name, maxPoints: autoCompCurrent.maxPoints, source: autoCompCurrent.source },
        tx,
      });
    });
    assert.strictEqual(scoreAfterApproval, 9.0, '(b) Approved record must give full session points (5.0 + 4.0 = 9.0)');

    // (c) Prove null-termId slot is NOT counted when structure term is NOT current term (Past Term):
    const scorePastTerm = await prisma.$transaction(async (tx) => {
      return calculator!({
        enrollmentId: enrPast.id,
        courseId: ctx.course.id,
        termId: ctx.termPast.id,
        component: { id: autoCompPast.id, name: autoCompPast.name, maxPoints: autoCompPast.maxPoints, source: autoCompPast.source },
        tx,
      });
    });
    assert.strictEqual(scorePastTerm, 0.0, '(c) A null-termId slot must NOT count when structure term is a past term');
  } finally {
    await prisma.courseGradeComponent.deleteMany({ where: { structure: { courseId: ctx.course.id } } });
    await prisma.courseGradeStructure.deleteMany({ where: { courseId: ctx.course.id } });
    await ctx.cleanup();
  }
});

test.after(async () => {
  if (sharedServer) {
    await new Promise<void>((resolve) => sharedServer!.close(() => resolve()));
  }
});
