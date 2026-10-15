import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import app from '../src/app';
import prisma from '../src/utils/prismaClient';
import { generateAccessToken } from '../src/utils/jwt.utils';

test('Term Switch Preview & Atomic Activation Test Suite (T3)', async () => {
  const runSuffix = `term_switch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${address.port}/api`;

  let superAdminId: number | undefined;
  let collegeId: number | undefined;
  let departmentId: number | undefined;
  let studentUserId: number | undefined;
  let studentId: number | undefined;
  let courseId: number | undefined;
  let yearId: number | undefined;
  let term1Id: number | undefined;
  let term2Id: number | undefined;
  let prevActiveYearId: number | undefined;
  let prevActiveTermId: number | undefined;

  try {
    // 1. Create Super Admin
    const superAdmin = await prisma.user.create({
      data: {
        email: `superadmin_${runSuffix}@test.local`,
        password: 'hashed-password-fixture',
        role: 'SUPER_ADMIN',
        isActive: true,
      },
    });
    superAdminId = superAdmin.id;
    const superAdminToken = generateAccessToken(superAdmin.id, superAdmin.tokenVersion || 0);

    // 2. Setup College and Department
    const college = await prisma.college.create({
      data: { name: `College_${runSuffix}` },
    });
    collegeId = college.id;

    const department = await prisma.department.create({
      data: { name: `Dept_${runSuffix}`, collegeId: college.id },
    });
    departmentId = department.id;

    // 3. Create Student (Year 1, Dept)
    const studentUser = await prisma.user.create({
      data: {
        email: `student_${runSuffix}@test.local`,
        password: 'hashed-password-fixture',
        role: 'STUDENT',
        isActive: true,
      },
    });
    studentUserId = studentUser.id;

    const student = await prisma.student.create({
      data: {
        userId: studentUser.id,
        firstName: 'SwitchTest',
        lastName: 'Student',
        studentId: `ST_${runSuffix}`,
        year: 1,
        departmentId: department.id,
        isActive: true,
      },
    });
    studentId = student.id;

    // 4. Create Course (Dept, Year 1, Semester 2)
    const course = await prisma.course.create({
      data: {
        courseCode: `CS_${runSuffix}`,
        name: `Course_${runSuffix}`,
        departmentId: department.id,
        year: 1,
        semester: 2,
        isPublished: true,
      },
    });
    courseId = course.id;

    // 5. Safely isolate from pre-existing active year/term
    const prevActiveYear = await prisma.academicYear.findFirst({ where: { isCurrent: true } });
    const prevActiveTerm = await prisma.academicTerm.findFirst({ where: { isCurrent: true } });
    if (prevActiveTerm) {
      prevActiveTermId = prevActiveTerm.id;
      await prisma.academicTerm.update({ where: { id: prevActiveTerm.id }, data: { isCurrent: false } });
    }
    if (prevActiveYear) {
      prevActiveYearId = prevActiveYear.id;
      await prisma.academicYear.update({ where: { id: prevActiveYear.id }, data: { isCurrent: false } });
    }

    // Create Academic Year and two terms (Term 1 active, Term 2 inactive)
    const year = await prisma.academicYear.create({
      data: {
        name: `2030-2031_${runSuffix}`,
        startDate: new Date('2030-09-01'),
        endDate: new Date('2031-06-30'),
        isCurrent: true,
      },
    });
    yearId = year.id;

    const term1 = await prisma.academicTerm.create({
      data: {
        academicYearId: year.id,
        name: `Fall 2030_${runSuffix}`,
        termType: 'FALL',
        semesterNumber: 1,
        startDate: new Date('2030-09-01'),
        endDate: new Date('2031-01-31'),
        isCurrent: true,
      },
    });
    term1Id = term1.id;

    const term2 = await prisma.academicTerm.create({
      data: {
        academicYearId: year.id,
        name: `Spring 2031_${runSuffix}`,
        termType: 'SPRING',
        semesterNumber: 2,
        startDate: new Date('2031-02-01'),
        endDate: new Date('2031-06-30'),
        isCurrent: false,
      },
    });
    term2Id = term2.id;

    // 6. Test Preview Endpoint for Term 2 (Read-only)
    const previewRes = await fetch(`${baseUrl}/academic-terms/${term2.id}/activate-preview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authorization: `Bearer ${superAdminToken}`,
      },
    });
    assert.equal(previewRes.status, 200, `Expected 200 for preview, got ${previewRes.status}`);
    const previewJson = await previewRes.json();
    assert.equal(previewJson.success, true);
    assert.equal(previewJson.data.targetTerm.id, term2.id);
    assert.ok(previewJson.data.eligibleStudentsCount >= 1, 'Expected at least 1 eligible student');
    assert.ok(previewJson.data.matchingCoursesCount >= 1, 'Expected at least 1 matching course');
    assert.ok(previewJson.data.newEnrollmentsCount >= 1, 'Expected at least 1 new enrollment to be created');

    // Confirm preview did NOT change term1 or term2 isCurrent state
    const t1Check = await prisma.academicTerm.findUnique({ where: { id: term1.id } });
    const t2Check = await prisma.academicTerm.findUnique({ where: { id: term2.id } });
    assert.equal(t1Check?.isCurrent, true, 'Preview must not alter term1 isCurrent');
    assert.equal(t2Check?.isCurrent, false, 'Preview must not alter term2 isCurrent');

    // 7. Test Activate Endpoint for Term 2 (Atomic Switch + Auto-Enroll)
    const activateRes = await fetch(`${baseUrl}/academic-terms/${term2.id}/activate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authorization: `Bearer ${superAdminToken}`,
      },
    });
    assert.equal(activateRes.status, 200, `Expected 200 for activate, got ${activateRes.status}`);
    const activateJson = await activateRes.json();
    assert.equal(activateJson.success, true);

    // Verify DB state
    const t1After = await prisma.academicTerm.findUnique({ where: { id: term1.id } });
    const t2After = await prisma.academicTerm.findUnique({ where: { id: term2.id } });
    assert.equal(t1After?.isCurrent, false, 'Term 1 must be deactivated');
    assert.equal(t2After?.isCurrent, true, 'Term 2 must be activated');

    // Verify student was auto-enrolled into course for Term 2
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        studentId: student.id,
        courseId: course.id,
        termId: term2.id,
      },
    });
    assert.ok(enrollment, 'Expected student to be auto-enrolled in semester 2 course with termId');
    assert.equal(enrollment?.semester, 2);

    // Verify audit logs
    const switchAudit = await prisma.auditLog.findFirst({
      where: {
        action: 'TERM_SWITCHED',
        entity: 'AcademicTerm',
        entityId: String(term2.id),
      },
    });
    assert.ok(switchAudit, 'Expected AuditLog entry for TERM_SWITCHED');

    const autoEnrollAudit = await prisma.auditLog.findFirst({
      where: {
        action: 'AUTO_ENROLLMENT_TRIGGERED',
        entity: 'Enrollment',
      },
    });
    assert.ok(autoEnrollAudit, 'Expected AuditLog entry for AUTO_ENROLLMENT_TRIGGERED');

  } finally {
    try {
      if (studentId && courseId) {
        await prisma.enrollment.deleteMany({ where: { studentId } });
      }
      if (courseId) {
        await prisma.course.deleteMany({ where: { id: courseId } });
      }
      if (studentId) {
        await prisma.student.deleteMany({ where: { id: studentId } });
      }
      if (studentUserId) {
        await prisma.user.deleteMany({ where: { id: studentUserId } });
      }
      if (departmentId) {
        await prisma.department.deleteMany({ where: { id: departmentId } });
      }
      if (collegeId) {
        await prisma.college.deleteMany({ where: { id: collegeId } });
      }
      if (term2Id) {
        await prisma.academicTerm.deleteMany({ where: { id: term2Id } });
      }
      if (term1Id) {
        await prisma.academicTerm.deleteMany({ where: { id: term1Id } });
      }
      if (yearId) {
        await prisma.academicYear.deleteMany({ where: { id: yearId } });
      }
      if (prevActiveYearId) {
        await prisma.academicYear.update({ where: { id: prevActiveYearId }, data: { isCurrent: true } }).catch(() => {});
      }
      if (prevActiveTermId) {
        await prisma.academicTerm.update({ where: { id: prevActiveTermId }, data: { isCurrent: true } }).catch(() => {});
      }
      if (superAdminId) {
        await prisma.auditLog.deleteMany({ where: { userId: superAdminId } });
        await prisma.user.deleteMany({ where: { id: superAdminId } });
      }
    } catch {
      // ignore teardown errors
    }

    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
  }
});
