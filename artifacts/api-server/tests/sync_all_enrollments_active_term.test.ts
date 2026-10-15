import { test } from 'node:test';
import assert from 'node:assert/strict';
import prisma from '../src/utils/prismaClient';
import { EnrollmentService } from '../src/services/enrollment.service';

test('C3 / T5: syncAllEnrollments scoped to active term, SUPER_ADMIN guard, and AuditLog', async () => {
  const runSuffix = `sync_term_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  let collegeId: number | undefined;
  let departmentId: number | undefined;
  let adminUserId: number | undefined;
  let studentUserId: number | undefined;
  let studentId: number | undefined;
  let course1Id: number | undefined;
  let course2Id: number | undefined;
  let yearId: number | undefined;
  let termId: number | undefined;
  let prevActiveYearId: number | undefined;
  let prevActiveTermId: number | undefined;

  try {
    // 1. Setup isolated College, Department, Courses (Sem 1 and Sem 2)
    const college = await prisma.college.create({
      data: { name: `College_${runSuffix}` },
    });
    collegeId = college.id;

    const department = await prisma.department.create({
      data: { name: `Dept_${runSuffix}`, collegeId: college.id },
    });
    departmentId = department.id;

    const course1 = await prisma.course.create({
      data: {
        courseCode: `C1_${runSuffix}`,
        name: `Course_Sem1_${runSuffix}`,
        departmentId: department.id,
        year: 1,
        semester: 1,
        isPublished: true,
      },
    });
    course1Id = course1.id;

    const course2 = await prisma.course.create({
      data: {
        courseCode: `C2_${runSuffix}`,
        name: `Course_Sem2_${runSuffix}`,
        departmentId: department.id,
        year: 1,
        semester: 2,
        isPublished: true,
      },
    });
    course2Id = course2.id;

    // 2. Isolate existing active term
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

    // 3. Create active academic year & term (Active Term = Semester 1)
    const year = await prisma.academicYear.create({
      data: {
        name: `2034-2035_${runSuffix}`,
        startDate: new Date('2034-09-01'),
        endDate: new Date('2035-06-30'),
        isCurrent: true,
      },
    });
    yearId = year.id;

    const term = await prisma.academicTerm.create({
      data: {
        academicYearId: year.id,
        name: `Fall 2034_${runSuffix}`,
        termType: 'FALL',
        semesterNumber: 1,
        startDate: new Date('2034-09-01'),
        endDate: new Date('2035-01-31'),
        isCurrent: true,
      },
    });
    termId = term.id;

    // 4. Create Super Admin User fixture
    const adminUser = await prisma.user.create({
      data: {
        email: `super_${runSuffix}@unicore.edu`,
        password: 'hashed-password-fixture',
        role: 'SUPER_ADMIN',
        isActive: true,
      },
    });
    adminUserId = adminUser.id;

    // 5. Create Student
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
        firstName: 'SyncStudent',
        lastName: 'Test',
        studentId: `ST_SYNC_${runSuffix}`,
        year: 1,
        departmentId: department.id,
        isActive: true,
      },
    });
    studentId = student.id;

    // 6. Test service-level RBAC guard if non-super-admin actor provided
    await assert.rejects(
      async () => {
        await EnrollmentService.syncAllEnrollments({
          actor: { id: 999, role: 'COLLEGE_ADMIN', email: 'admin@test.local' },
        });
      },
      /Super Admin/i,
      'Expected syncAllEnrollments to reject non-SUPER_ADMIN actors'
    );

    // 7. Execute syncAllEnrollments with valid SUPER_ADMIN actor
    const result = await EnrollmentService.syncAllEnrollments({
      actor: { id: adminUser.id, role: adminUser.role, email: adminUser.email },
    });

    assert.ok(result.totalEnrolled >= 1, 'Expected at least 1 enrollment created');

    // 8. Verify student was enrolled ONLY in Semester 1 course, and termId is stamped
    const studentEnrollments = await prisma.enrollment.findMany({
      where: { studentId: student.id },
    });
    assert.equal(studentEnrollments.length, 1, 'Student must only be enrolled in Semester 1 course');
    assert.equal(studentEnrollments[0].courseId, course1.id, 'Must be Semester 1 course');
    assert.equal(studentEnrollments[0].termId, term.id, 'termId must match active term');

    // 9. Verify AuditLog entry was written
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        action: 'SYNC_ALL_ENROLLMENTS',
        entity: 'Enrollment',
      },
      orderBy: { timestamp: 'desc' },
      take: 1,
    });
    assert.equal(auditLogs.length, 1, 'Expected an AuditLog entry for SYNC_ALL_ENROLLMENTS');
    assert.equal(auditLogs[0].userRole, 'SUPER_ADMIN');

  } finally {
    try {
      if (termId) {
        await prisma.enrollment.deleteMany({ where: { termId } });
      }
      if (studentId) {
        await prisma.enrollment.deleteMany({ where: { studentId } });
      }
      if (course1Id) {
        await prisma.course.deleteMany({ where: { id: course1Id } });
      }
      if (course2Id) {
        await prisma.course.deleteMany({ where: { id: course2Id } });
      }
      if (studentId) {
        await prisma.student.deleteMany({ where: { id: studentId } });
      }
      if (studentUserId) {
        await prisma.user.deleteMany({ where: { id: studentUserId } });
      }
      if (adminUserId) {
        await prisma.auditLog.deleteMany({ where: { userId: adminUserId } });
        await prisma.user.deleteMany({ where: { id: adminUserId } });
      }
      if (departmentId) {
        await prisma.department.deleteMany({ where: { id: departmentId } });
      }
      if (collegeId) {
        await prisma.college.deleteMany({ where: { id: collegeId } });
      }
      if (termId) {
        await prisma.academicTerm.deleteMany({ where: { id: termId } });
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
    } catch {
      // ignore teardown errors
    }
    await prisma.$disconnect();
  }
});
