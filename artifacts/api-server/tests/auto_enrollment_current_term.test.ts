import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import app from '../src/app';
import prisma from '../src/utils/prismaClient';
import { EnrollmentService } from '../src/services/enrollment.service';
import { generateAccessToken } from '../src/utils/jwt.utils';

test('Auto-Enrollment Current Term Only & Elimination of Month Heuristics (T4)', async () => {
  const runSuffix = `auto_enr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${address.port}/api`;

  let collegeId: number | undefined;
  let departmentId: number | undefined;
  let studentUserId: number | undefined;
  let studentId: number | undefined;
  let course1Id: number | undefined;
  let course2Id: number | undefined;
  let yearId: number | undefined;
  let termId: number | undefined;
  let prevActiveYearId: number | undefined;
  let prevActiveTermId: number | undefined;

  try {
    // 1. Setup College and Department
    const college = await prisma.college.create({
      data: { name: `College_${runSuffix}` },
    });
    collegeId = college.id;

    const department = await prisma.department.create({
      data: { name: `Dept_${runSuffix}`, collegeId: college.id },
    });
    departmentId = department.id;

    // 2. Setup Semester 1 Course and Semester 2 Course (Same dept, year 1)
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

    // 3. Safely isolate from pre-existing active year/term
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

    // Setup Academic Year and Term (Active Term is Semester 1)
    const year = await prisma.academicYear.create({
      data: {
        name: `2032-2033_${runSuffix}`,
        startDate: new Date('2032-09-01'),
        endDate: new Date('2033-06-30'),
        isCurrent: true,
      },
    });
    yearId = year.id;

    const term = await prisma.academicTerm.create({
      data: {
        academicYearId: year.id,
        name: `Fall 2032_${runSuffix}`,
        termType: 'FALL',
        semesterNumber: 1,
        startDate: new Date('2032-09-01'),
        endDate: new Date('2033-01-31'),
        isCurrent: true,
      },
    });
    termId = term.id;

    // 4. Create Student
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
        firstName: 'AutoEnroll',
        lastName: 'Student',
        studentId: `ST_${runSuffix}`,
        year: 1,
        departmentId: department.id,
        isActive: true,
      },
    });
    studentId = student.id;

    // 5. Trigger auto-enrollment for student
    const result = await EnrollmentService.autoEnrollStudent(student.id);
    assert.equal(result.enrolledCount, 1, 'Expected auto-enroll to enroll in exactly 1 course (Semester 1)');

    // Verify student is enrolled in Semester 1 course, and NOT enrolled in Semester 2 course
    const enrollments = await prisma.enrollment.findMany({
      where: { studentId: student.id },
    });
    assert.equal(enrollments.length, 1, 'Expected exactly 1 enrollment record');
    assert.equal(enrollments[0].courseId, course1.id, 'Expected enrollment to be for course1 (Semester 1)');
    assert.equal(enrollments[0].termId, term.id, 'Expected enrollment to have termId set');
    assert.equal(enrollments[0].semester, 1, 'Expected enrollment to be semester 1');

    // 6. Verify Dashboard Returns Active Term Semester
    const token = generateAccessToken(studentUser.id, studentUser.tokenVersion || 0);
    const dashRes = await fetch(`${baseUrl}/dashboard/student`, {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(dashRes.status, 200);
    const dashJson = await dashRes.json();
    assert.equal(dashJson.success, true);
    assert.equal(dashJson.data.profile.semester, 1, 'Dashboard profile semester must match active term semester');

  } finally {
    try {
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

    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
  }
});
