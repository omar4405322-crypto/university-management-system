import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import app from '../src/app';
import prisma from '../src/utils/prismaClient';
import { generateAccessToken } from '../src/utils/jwt.utils';

test('F-01 / T4b: Enrollment created in term T is found by quiz in same term even when calendar year differs', async () => {
  const runSuffix = `term_link_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${address.port}/api`;

  let collegeId: number | undefined;
  let deptId: number | undefined;
  let doctorUserId: number | undefined;
  let doctorId: number | undefined;
  let studentUserId: number | undefined;
  let studentId: number | undefined;
  let courseId: number | undefined;
  let yearId: number | undefined;
  let termId: number | undefined;
  let quizId: number | undefined;

  try {
    // 1. Setup College and Department
    const college = await prisma.college.create({ data: { name: `Col_${runSuffix}` } });
    collegeId = college.id;

    const dept = await prisma.department.create({ data: { name: `Dept_${runSuffix}`, collegeId: college.id } });
    deptId = dept.id;

    // 2. Setup Doctor
    const doctorUser = await prisma.user.create({
      data: {
        email: `doc_${runSuffix}@test.local`,
        password: 'hashed-password-fixture',
        role: 'DOCTOR',
        isActive: true,
      },
    });
    doctorUserId = doctorUser.id;

    const doctor = await prisma.doctor.create({
      data: {
        userId: doctorUser.id,
        firstName: 'Prof',
        lastName: 'Link',
        doctorId: `DOC_${runSuffix}`,
        departmentId: dept.id,
      },
    });
    doctorId = doctor.id;

    // 3. Setup Student
    const studentUser = await prisma.user.create({
      data: {
        email: `stu_${runSuffix}@test.local`,
        password: 'hashed-password-fixture',
        role: 'STUDENT',
        isActive: true,
      },
    });
    studentUserId = studentUser.id;

    const student = await prisma.student.create({
      data: {
        userId: studentUser.id,
        firstName: 'Test',
        lastName: 'Student',
        studentId: `STU_${runSuffix}`,
        year: 1,
        departmentId: dept.id,
      },
    });
    studentId = student.id;

    const studentToken = generateAccessToken(studentUser.id, studentUser.tokenVersion || 0);

    // 4. Setup Course
    const course = await prisma.course.create({
      data: {
        courseCode: `CS_${runSuffix}`,
        name: `Course ${runSuffix}`,
        departmentId: dept.id,
        year: 1,
        semester: 1,
        isPublished: true,
      },
    });
    courseId = course.id;

    // 5. Setup Academic Year and Term T
    const year = await prisma.academicYear.create({
      data: {
        name: `2035-2036_${runSuffix}`,
        startDate: new Date('2035-09-01T00:00:00.000Z'),
        endDate: new Date('2036-06-30T23:59:59.999Z'),
        isCurrent: false,
      },
    });
    yearId = year.id;

    const termT = await prisma.academicTerm.create({
      data: {
        academicYearId: year.id,
        name: `Fall 2035_${runSuffix}`,
        termType: 'FALL',
        semesterNumber: 1,
        startDate: new Date('2035-09-01T00:00:00.000Z'),
        endDate: new Date('2036-01-31T23:59:59.999Z'),
        isCurrent: false,
      },
    });
    termId = termT.id;

    // 6. Enroll student in Course for Term T with academicYear = 2035
    await prisma.enrollment.create({
      data: {
        studentId: student.id,
        courseId: course.id,
        semester: 1,
        academicYear: 2035,
        termId: termT.id,
        status: 'ENROLLED',
      },
    });

    // 7. Create a Quiz in Term T, BUT with differing calendar year 2036
    const quiz = await prisma.quiz.create({
      data: {
        title: `Quiz In Term T_${runSuffix}`,
        courseId: course.id,
        doctorId: doctor.id,
        semester: 1,
        academicYear: 2036, // Differing calendar year!
        termId: termT.id,   // Same term!
        duration: 30,
        startTime: new Date(Date.now() - 60_000),
        endTime: new Date(Date.now() + 3600_000),
      },
    });
    quizId = quiz.id;

    // 8. Student requests the quiz
    const getQuizRes = await fetch(`${baseUrl}/quizzes/${quiz.id}`, {
      headers: {
        authorization: `Bearer ${studentToken}`,
      },
    });

    // Expecting 200 OK because both enrollment and quiz belong to the exact same term T
    assert.equal(
      getQuizRes.status,
      200,
      `Expected 200 OK when enrollment and quiz share termId ${termT.id}, got ${getQuizRes.status}`
    );
    const quizJson = await getQuizRes.json();
    assert.equal(quizJson.success, true);
    assert.equal(quizJson.data.id, quiz.id);

  } finally {
    try {
      if (quizId) {
        await prisma.quiz.deleteMany({ where: { id: quizId } });
      }
      if (studentId) {
        await prisma.enrollment.deleteMany({ where: { studentId } });
        await prisma.student.deleteMany({ where: { id: studentId } });
      }
      if (studentUserId) {
        await prisma.user.deleteMany({ where: { id: studentUserId } });
      }
      if (doctorId) {
        await prisma.doctor.deleteMany({ where: { id: doctorId } });
      }
      if (doctorUserId) {
        await prisma.user.deleteMany({ where: { id: doctorUserId } });
      }
      if (courseId) {
        await prisma.course.deleteMany({ where: { id: courseId } });
      }
      if (termId) {
        await prisma.academicTerm.deleteMany({ where: { id: termId } });
      }
      if (yearId) {
        await prisma.academicYear.deleteMany({ where: { id: yearId } });
      }
      if (deptId) {
        await prisma.department.deleteMany({ where: { id: deptId } });
      }
      if (collegeId) {
        await prisma.college.deleteMany({ where: { id: collegeId } });
      }
    } catch {
      // ignore teardown errors
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await prisma.$disconnect();
    }
  }
});
