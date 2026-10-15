import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import app from '../src/app';
import prisma from '../src/utils/prismaClient';
import { generateAccessToken } from '../src/utils/jwt.utils';

test('Student Dashboard Term Consistency & Term History Filter (T9)', async () => {
  const runSuffix = `dash_t9_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${address.port}/api`;

  let collegeId: number | undefined;
  let departmentId: number | undefined;
  let userId: number | undefined;
  let studentId: number | undefined;
  let yearId: number | undefined;
  let activeTermId: number | undefined;
  let pastTermId: number | undefined;
  let courseAId: number | undefined;
  let courseBId: number | undefined;

  try {
    // 1. Setup College, Dept, Student
    const college = await prisma.college.create({
      data: { name: `Col_${runSuffix}` },
    });
    collegeId = college.id;

    const department = await prisma.department.create({
      data: { name: `Dept_${runSuffix}`, collegeId: college.id },
    });
    departmentId = department.id;

    const user = await prisma.user.create({
      data: {
        email: `student_${runSuffix}@test.local`,
        password: 'hashed-password-fixture',
        role: 'STUDENT',
        isActive: true,
      },
    });
    userId = user.id;

    const student = await prisma.student.create({
      data: {
        userId: user.id,
        firstName: 'Ali',
        lastName: 'Hassan',
        studentId: `STU_${runSuffix}`,
        year: 1,
        departmentId: department.id,
      },
    });
    studentId = student.id;

    const studentToken = generateAccessToken(user.id, user.tokenVersion || 0);

    // 2. Setup Academic Year and two Terms
    let activeTerm = await prisma.academicTerm.findFirst({
      where: { isCurrent: true },
      include: { academicYear: true },
    });

    if (!activeTerm) {
      let activeYear = await prisma.academicYear.findFirst({
        where: { isCurrent: true },
      });
      if (!activeYear) {
        activeYear = await prisma.academicYear.create({
          data: {
            name: `AY_${runSuffix}`,
            startDate: new Date('2026-09-01'),
            endDate: new Date('2027-06-30'),
            isCurrent: true,
          },
        });
        yearId = activeYear.id;
      }
      activeTerm = await prisma.academicTerm.create({
        data: {
          academicYearId: activeYear.id,
          name: `Term1_${runSuffix}`,
          termType: 'FALL',
          semesterNumber: 1,
          startDate: new Date('2026-09-01'),
          endDate: new Date('2027-01-31'),
          isCurrent: true,
        },
        include: { academicYear: true },
      });
      activeTermId = activeTerm.id;
    }

    const pastTerm = await prisma.academicTerm.create({
      data: {
        academicYearId: activeTerm.academicYearId,
        name: `TermPast_${runSuffix}`,
        termType: 'SPRING',
        semesterNumber: 2,
        startDate: new Date('2026-02-01'),
        endDate: new Date('2026-06-30'),
        isCurrent: false,
      },
    });
    pastTermId = pastTerm.id;

    // 3. Setup Courses & Enrollments
    const courseA = await prisma.course.create({
      data: {
        courseCode: `CRSA_${runSuffix}`,
        name: 'Math 101',
        credits: 3,
        departmentId: department.id,
        year: 1,
        semester: 1,
        isPublished: true,
      },
    });
    courseAId = courseA.id;

    const courseB = await prisma.course.create({
      data: {
        courseCode: `CRSB_${runSuffix}`,
        name: 'Physics 102',
        credits: 3,
        departmentId: department.id,
        year: 1,
        semester: 2,
        isPublished: true,
      },
    });
    courseBId = courseB.id;

    // Enroll in active term
    await prisma.enrollment.create({
      data: {
        studentId: student.id,
        courseId: courseA.id,
        semester: 1,
        academicYear: 2026,
        termId: activeTerm.id,
        status: 'ENROLLED',
      },
    });

    // Enroll in past term
    await prisma.enrollment.create({
      data: {
        studentId: student.id,
        courseId: courseB.id,
        semester: 2,
        academicYear: 2026,
        termId: pastTerm.id,
        status: 'COMPLETED',
      },
    });

    // 4. Test default active term dashboard
    const defaultRes = await fetch(`${baseUrl}/dashboard/student`, {
      headers: { authorization: `Bearer ${studentToken}` },
    });
    assert.equal(defaultRes.status, 200);
    const defaultJson = await defaultRes.json();
    assert.equal(defaultJson.success, true);
    assert.equal(defaultJson.data.profile.currentTerm?.id, activeTerm.id);
    assert.ok(Array.isArray(defaultJson.data.currentEnrollments), 'Must return currentEnrollments array');
    assert.equal(defaultJson.data.currentEnrollments.length, 1);
    assert.equal(defaultJson.data.currentEnrollments[0].courseId, courseA.id);

    // 5. Test history filter with ?termId=pastTermId
    const pastRes = await fetch(`${baseUrl}/dashboard/student?termId=${pastTerm.id}`, {
      headers: { authorization: `Bearer ${studentToken}` },
    });
    assert.equal(pastRes.status, 200);
    const pastJson = await pastRes.json();
    assert.equal(pastJson.success, true);
    assert.equal(pastJson.data.currentEnrollments.length, 1);
    assert.equal(pastJson.data.currentEnrollments[0].courseId, courseB.id);

    // 6. Test guardrail: ?termId= (empty string) returns 200 without 422
    const emptyFilterRes = await fetch(`${baseUrl}/dashboard/student?termId=`, {
      headers: { authorization: `Bearer ${studentToken}` },
    });
    assert.equal(emptyFilterRes.status, 200);

    // 7. Test invalid filter: ?termId=abc returns 422
    const invalidFilterRes = await fetch(`${baseUrl}/dashboard/student?termId=abc`, {
      headers: { authorization: `Bearer ${studentToken}` },
    });
    assert.equal(invalidFilterRes.status, 422);

    // 8. Test non-existent term: ?termId=99999 returns 404 Not Found
    const nonExistentRes = await fetch(`${baseUrl}/dashboard/student?termId=99999`, {
      headers: { authorization: `Bearer ${studentToken}` },
    });
    assert.equal(nonExistentRes.status, 404, 'Expected 404 when termId does not exist');
    const nonExistentJson = await nonExistentRes.json();
    assert.equal(nonExistentJson.success, false);
    assert.match(nonExistentJson.message, /academic term not found/i);

    // 9. Test no-current-term case: returns currentEnrollments = [] and status NO_ACTIVE_TERM without leaking across terms
    const origFindFirst = prisma.academicTerm.findFirst;
    try {
      (prisma.academicTerm as any).findFirst = async () => null;
      const noCurrentTermRes = await fetch(`${baseUrl}/dashboard/student`, {
        headers: { authorization: `Bearer ${studentToken}` },
      });
      assert.equal(noCurrentTermRes.status, 200);
      const noCurrentTermJson = await noCurrentTermRes.json();
      assert.equal(noCurrentTermJson.success, true);
      assert.equal(noCurrentTermJson.data.profile.status, 'NO_ACTIVE_TERM');
      assert.equal(noCurrentTermJson.data.profile.currentTerm, null);
      assert.ok(Array.isArray(noCurrentTermJson.data.currentEnrollments));
      assert.equal(noCurrentTermJson.data.currentEnrollments.length, 0, 'Must not leak enrollments when there is no active term');
    } finally {
      (prisma.academicTerm as any).findFirst = origFindFirst;
    }

  } finally {
    try {
      if (studentId) {
        await prisma.enrollment.deleteMany({ where: { studentId } });
        await prisma.student.deleteMany({ where: { id: studentId } });
      }
      if (courseAId) await prisma.course.deleteMany({ where: { id: courseAId } });
      if (courseBId) await prisma.course.deleteMany({ where: { id: courseBId } });
      if (activeTermId) await prisma.academicTerm.deleteMany({ where: { id: activeTermId } });
      if (pastTermId) await prisma.academicTerm.deleteMany({ where: { id: pastTermId } });
      if (yearId) await prisma.academicYear.deleteMany({ where: { id: yearId } });
      if (departmentId) await prisma.department.deleteMany({ where: { id: departmentId } });
      if (collegeId) await prisma.college.deleteMany({ where: { id: collegeId } });
      if (userId) await prisma.user.deleteMany({ where: { id: userId } });
    } catch {
      // ignore teardown
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
  }
});
