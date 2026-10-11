import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import prisma from '../src/utils/prismaClient';
import { generateAccessToken } from '../src/utils/jwt.utils';

test('HTTP Deletion Guards: Real HTTP 409 Conflict and structured messages', async () => {
  const { default: app } = await import('../src/app');
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const baseUrl = `http://127.0.0.1:${address.port}/api`;

  const admin = await prisma.user.findFirst({
    where: { role: 'SUPER_ADMIN', isActive: true },
  });
  assert.ok(admin, 'Active super admin required');
  const token = generateAccessToken(admin.id, admin.tokenVersion);

  const runSuffix = `del_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  let testCollegeId: number | undefined;
  let testDeptId: number | undefined;
  let testCourseId: number | undefined;
  let testUserId: number | undefined;
  let testStudentId: number | undefined;
  let testEnrollmentId: number | undefined;

  try {
    // 1. Setup isolated test college and department
    const college = await prisma.college.create({
      data: {
        name: `College ${runSuffix}`,
        nameAr: `كلية ${runSuffix}`,
      },
    });
    testCollegeId = college.id;

    const dept = await prisma.department.create({
      data: {
        name: `Dept ${runSuffix}`,
        nameAr: `قسم ${runSuffix}`,
        collegeId: college.id,
      },
    });
    testDeptId = dept.id;

    // Create a student in this department
    const user = await prisma.user.create({
      data: {
        email: `${runSuffix}@student.test`,
        password: 'hashed-password-fixture',
        role: 'STUDENT',
        isActive: true,
      },
    });
    testUserId = user.id;

    const student = await prisma.student.create({
      data: {
        userId: user.id,
        firstName: 'Test',
        lastName: 'Student',
        studentId: `STU_${runSuffix}`,
        year: 1,
        departmentId: dept.id,
      },
    });
    testStudentId = student.id;

    // Create a course in this department
    const course = await prisma.course.create({
      data: {
        courseCode: `C_${runSuffix.slice(-6).toUpperCase()}`,
        name: `Course ${runSuffix}`,
        credits: 3,
        departmentId: dept.id,
        year: 1,
        semester: 1,
      },
    });
    testCourseId = course.id;

    // Create an enrollment linking student to course
    const enrollment = await prisma.enrollment.create({
      data: {
        studentId: student.id,
        courseId: course.id,
        semester: 1,
        academicYear: 2026,
        status: 'COMPLETED',
      },
    });
    testEnrollmentId = enrollment.id;

    // -------------------------------------------------------------
    // Test A: DELETE /api/departments/:id with active student/course -> HTTP 409 Conflict
    // -------------------------------------------------------------
    const resDeptConflict = await fetch(`${baseUrl}/departments/${dept.id}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${token}` },
    });

    assert.equal(
      resDeptConflict.status,
      409,
      `DELETE department with active roster must return HTTP 409, got ${resDeptConflict.status}`,
    );
    const jsonDeptConflict = await resDeptConflict.json();
    assert.equal(jsonDeptConflict.success, false);
    assert.ok(
      jsonDeptConflict.message.includes('Cannot delete department: linked records remain'),
      `Expected conflict explanation in message, got: ${jsonDeptConflict.message}`,
    );

    // Verify department still exists in database
    const deptStillExists = await prisma.department.findUnique({ where: { id: dept.id } });
    assert.ok(deptStillExists, 'Department must not be deleted on 409 Conflict');

    // -------------------------------------------------------------
    // Test B: DELETE /api/courses/:id with active enrollment -> HTTP 409 Conflict
    // -------------------------------------------------------------
    const resCourseConflict = await fetch(`${baseUrl}/courses/${course.id}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${token}` },
    });

    assert.equal(
      resCourseConflict.status,
      409,
      `DELETE course with active enrollment must return HTTP 409, got ${resCourseConflict.status}`,
    );
    const jsonCourseConflict = await resCourseConflict.json();
    assert.equal(jsonCourseConflict.success, false);
    assert.ok(
      jsonCourseConflict.message.includes('Cannot delete course with enrollment history'),
      `Expected enrollment history conflict message, got: ${jsonCourseConflict.message}`,
    );

    // Verify course still exists in database
    const courseStillExists = await prisma.course.findUnique({ where: { id: course.id } });
    assert.ok(courseStillExists, 'Course must not be deleted on 409 Conflict');

    // -------------------------------------------------------------
    // Test C: DELETE /api/students/:id with completed enrollment -> HTTP 409 Conflict
    // -------------------------------------------------------------
    const resStudentConflict = await fetch(`${baseUrl}/students/${student.id}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${token}` },
    });

    assert.equal(
      resStudentConflict.status,
      409,
      `DELETE student with academic history must return HTTP 409, got ${resStudentConflict.status}`,
    );
    const jsonStudentConflict = await resStudentConflict.json();
    assert.equal(jsonStudentConflict.success, false);
    assert.ok(
      jsonStudentConflict.message.includes('Cannot delete student: retained academic or financial records exist'),
      `Expected student academic records conflict message, got: ${jsonStudentConflict.message}`,
    );

    // Verify student still exists
    const studentStillExists = await prisma.student.findUnique({ where: { id: student.id } });
    assert.ok(studentStillExists, 'Student must not be deleted on 409 Conflict');

    // -------------------------------------------------------------
    // Test D: Clean cascade release -> Successful HTTP 200 deletion
    // -------------------------------------------------------------
    // Remove the blocking enrollment
    await prisma.enrollment.delete({ where: { id: enrollment.id } });
    testEnrollmentId = undefined;

    // Course deletion now succeeds cleanly with HTTP 200
    const resCourseClean = await fetch(`${baseUrl}/courses/${course.id}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(resCourseClean.status, 200, `DELETE unreferenced course must return 200, got ${resCourseClean.status}`);
    testCourseId = undefined;

    // Student deletion now succeeds cleanly with HTTP 200 and removes student+user
    const resStudentClean = await fetch(`${baseUrl}/students/${student.id}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(resStudentClean.status, 200, `DELETE student without retained records must return 200, got ${resStudentClean.status}`);
    testStudentId = undefined;
    testUserId = undefined;

    // Department deletion now succeeds cleanly with HTTP 200
    const resDeptClean = await fetch(`${baseUrl}/departments/${dept.id}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(resDeptClean.status, 200, `DELETE empty department must return 200, got ${resDeptClean.status}`);
    testDeptId = undefined;
  } finally {
    // Teardown HTTP server
    await new Promise<void>((resolve) => server.close(() => resolve()));

    // Strict cleanup of any remaining test rows
    if (testEnrollmentId) {
      await prisma.enrollment.deleteMany({ where: { id: testEnrollmentId } }).catch(() => {});
    }
    if (testCourseId) {
      await prisma.course.deleteMany({ where: { id: testCourseId } }).catch(() => {});
    }
    if (testStudentId) {
      await prisma.student.deleteMany({ where: { id: testStudentId } }).catch(() => {});
    }
    if (testUserId) {
      await prisma.user.deleteMany({ where: { id: testUserId } }).catch(() => {});
    }
    if (testDeptId) {
      await prisma.department.deleteMany({ where: { id: testDeptId } }).catch(() => {});
    }
    if (testCollegeId) {
      await prisma.college.deleteMany({ where: { id: testCollegeId } }).catch(() => {});
    }
  }
});
