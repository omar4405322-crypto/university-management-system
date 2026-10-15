import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import app from '../src/app';
import prisma from '../src/utils/prismaClient';
import { generateAccessToken } from '../src/utils/jwt.utils';

test('Manual Enrollment Guard: Super Admin Only, Mandatory Reason, and Audit Log (T5)', async () => {
  const runSuffix = `man_enr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${address.port}/api`;

  let superAdminId: number | undefined;
  let collegeAdminId: number | undefined;
  let collegeId: number | undefined;
  let departmentId: number | undefined;
  let studentUserId: number | undefined;
  let studentId: number | undefined;
  let courseId: number | undefined;
  let createdEnrollmentId: number | undefined;

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

    // 2. Create College, Department, and Scoped College Admin
    const college = await prisma.college.create({
      data: { name: `College_${runSuffix}` },
    });
    collegeId = college.id;

    const department = await prisma.department.create({
      data: { name: `Dept_${runSuffix}`, collegeId: college.id },
    });
    departmentId = department.id;

    const collegeAdmin = await prisma.user.create({
      data: {
        email: `collegeadmin_${runSuffix}@test.local`,
        password: 'hashed-password-fixture',
        role: 'COLLEGE_ADMIN',
        collegeId: college.id,
        managedCollegeId: college.id,
        isActive: true,
      },
    });
    collegeAdminId = collegeAdmin.id;
    const collegeAdminToken = generateAccessToken(collegeAdmin.id, collegeAdmin.tokenVersion || 0);

    // 3. Create Student
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
        firstName: 'Manual',
        lastName: 'Student',
        studentId: `ST_${runSuffix}`,
        year: 1,
        departmentId: department.id,
        isActive: true,
      },
    });
    studentId = student.id;

    // 4. Create Course
    const course = await prisma.course.create({
      data: {
        courseCode: `CS_M_${runSuffix}`,
        name: `Course_Manual_${runSuffix}`,
        departmentId: department.id,
        year: 1,
        semester: 1,
        isPublished: true,
      },
    });
    courseId = course.id;

    const currentYear = new Date().getFullYear();

    // 5. College Admin is rejected with 403 Forbidden
    const forbiddenRes = await fetch(`${baseUrl}/enrollments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authorization: `Bearer ${collegeAdminToken}`,
      },
      body: JSON.stringify({
        studentId: student.id,
        courseId: course.id,
        semester: 1,
        academicYear: currentYear,
        reason: 'Attempted by college admin',
      }),
    });
    assert.equal(forbiddenRes.status, 403, `College admin must be rejected with 403, got ${forbiddenRes.status}`);

    // 6. Super Admin without reason is rejected with 422 Unprocessable Entity
    const noReasonRes = await fetch(`${baseUrl}/enrollments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        studentId: student.id,
        courseId: course.id,
        semester: 1,
        academicYear: currentYear,
      }),
    });
    assert.equal(noReasonRes.status, 422, `Super admin without reason must get 422, got ${noReasonRes.status}`);

    // 7. Super Admin with valid reason succeeds (201) and logs audit
    const successRes = await fetch(`${baseUrl}/enrollments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        studentId: student.id,
        courseId: course.id,
        semester: 1,
        academicYear: currentYear,
        reason: 'Special Dean exception approval for prerequisite waiver',
      }),
    });
    assert.equal(successRes.status, 201, `Super admin with reason must succeed with 201, got ${successRes.status}`);
    const successJson = await successRes.json();
    assert.equal(successJson.success, true);
    createdEnrollmentId = successJson.data.id;

    // Verify AuditLog was recorded
    const createAudit = await prisma.auditLog.findFirst({
      where: {
        action: 'MANUAL_ENROLLMENT_CREATED',
        entity: 'Enrollment',
        entityId: String(createdEnrollmentId),
      },
    });
    assert.ok(createAudit, 'Expected AuditLog for MANUAL_ENROLLMENT_CREATED');
    assert.match(JSON.stringify(createAudit.details), /Dean exception approval/);

    // 8. Delete / Drop without reason is rejected with 422
    const dropNoReasonRes = await fetch(`${baseUrl}/enrollments/${createdEnrollmentId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({}),
    });
    assert.equal(dropNoReasonRes.status, 422, 'Drop without reason must return 422');

    // 9. Delete / Drop with reason succeeds (200) and logs audit
    const dropRes = await fetch(`${baseUrl}/enrollments/${createdEnrollmentId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        reason: 'Student requested withdrawal due to medical circumstances',
      }),
    });
    assert.equal(dropRes.status, 200, 'Drop with reason must succeed with 200');

    const dropAudit = await prisma.auditLog.findFirst({
      where: {
        action: 'MANUAL_ENROLLMENT_DROPPED',
        entity: 'Enrollment',
        entityId: String(createdEnrollmentId),
      },
    });
    assert.ok(dropAudit, 'Expected AuditLog for MANUAL_ENROLLMENT_DROPPED');

  } finally {
    try {
      if (studentId) {
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
      if (collegeAdminId) {
        await prisma.user.deleteMany({ where: { id: collegeAdminId } });
      }
      if (departmentId) {
        await prisma.department.deleteMany({ where: { id: departmentId } });
      }
      if (collegeId) {
        await prisma.college.deleteMany({ where: { id: collegeId } });
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
