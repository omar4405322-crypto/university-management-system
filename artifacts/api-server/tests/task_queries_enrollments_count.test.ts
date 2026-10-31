import assert from 'node:assert/strict';
import test from 'node:test';
import prisma from '../src/utils/prismaClient';
import { TaskQueriesService } from '../src/services/task/taskQueries.service';

test('Item E: TaskQueriesService.getTasks returns real count of ENROLLED course enrollments', async () => {
  const SUFFIX = 'te_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);
  const collegeIds: number[] = [];
  const departmentIds: number[] = [];
  const userIds: number[] = [];
  const doctorIds: number[] = [];
  const studentIds: number[] = [];
  const courseIds: number[] = [];
  const enrollmentIds: number[] = [];
  const taskIds: number[] = [];

  try {
    const college = await prisma.college.create({
      data: { name: `Col_${SUFFIX}` },
    });
    collegeIds.push(college.id);

    const department = await prisma.department.create({
      data: { name: `Dept_${SUFFIX}`, collegeId: college.id },
    });
    departmentIds.push(department.id);

    const doctorUser = await prisma.user.create({
      data: {
        email: `doc_${SUFFIX}@example.test`,
        password: 'hash',
        role: 'DOCTOR',
        tokenVersion: 0,
        isActive: true,
      },
    });
    userIds.push(doctorUser.id);

    const doctor = await prisma.doctor.create({
      data: {
        userId: doctorUser.id,
        firstName: 'Doctor',
        lastName: `Test_${SUFFIX}`,
        departmentId: department.id,
      },
    });
    doctorIds.push(doctor.id);

    const course = await prisma.course.create({
      data: {
        name: `Course_${SUFFIX}`,
        courseCode: `C_${SUFFIX.toUpperCase().slice(0, 10)}`,
        credits: 3,
        departmentId: department.id,
      },
    });
    courseIds.push(course.id);

    const academicYear = 2026;
    const semester = 1;

    // Create 3 students: 2 ENROLLED, 1 WITHDRAWN
    for (let i = 0; i < 3; i++) {
      const studentUser = await prisma.user.create({
        data: {
          email: `stu_${i}_${SUFFIX}@example.test`,
          password: 'hash',
          role: 'STUDENT',
          tokenVersion: 0,
          isActive: true,
        },
      });
      userIds.push(studentUser.id);

      const student = await prisma.student.create({
        data: {
          userId: studentUser.id,
          firstName: `Student${i}`,
          lastName: `Test_${SUFFIX}`,
          studentId: `STU_${i}_${SUFFIX}`,
          departmentId: department.id,
          year: 1,
        },
      });
      studentIds.push(student.id);

      const enrollment = await prisma.enrollment.create({
        data: {
          studentId: student.id,
          courseId: course.id,
          academicYear,
          semester,
          status: i === 2 ? 'WITHDRAWN' : 'ENROLLED',
        },
      });
      enrollmentIds.push(enrollment.id);
    }

    const task = await prisma.task.create({
      data: {
        title: `Task_${SUFFIX}`,
        description: 'Test task',
        courseId: course.id,
        doctorId: doctor.id,
        academicYear,
        semester,
        dueDate: new Date(Date.now() + 86400000 * 7),
        maxScore: 100,
      },
    });
    taskIds.push(task.id);

    const authActor = {
      id: doctorUser.id,
      role: 'DOCTOR' as const,
      email: doctorUser.email,
      doctor: { id: doctor.id },
    };

    const result = await TaskQueriesService.getTasks(authActor as any, course.id);

    assert.equal(result.rows.length, 1, 'expected 1 task in query result');
    const returnedTask = result.rows[0];
    const courseAny = returnedTask.course as any;
    assert.ok(courseAny._count, 'task.course must include _count');
    assert.equal(courseAny._count.enrollments, 2, 'task.course._count.enrollments must equal 2 ENROLLED students (excluding DROPPED)');
  } finally {
    if (taskIds.length > 0) {
      await prisma.taskSubmission.deleteMany({ where: { taskId: { in: taskIds } } }).catch(() => {});
      await prisma.task.deleteMany({ where: { id: { in: taskIds } } }).catch(() => {});
    }
    if (enrollmentIds.length > 0) {
      await prisma.enrollment.deleteMany({ where: { id: { in: enrollmentIds } } }).catch(() => {});
    }
    if (studentIds.length > 0) {
      await prisma.student.deleteMany({ where: { id: { in: studentIds } } }).catch(() => {});
    }
    if (doctorIds.length > 0) {
      await prisma.doctor.deleteMany({ where: { id: { in: doctorIds } } }).catch(() => {});
    }
    if (courseIds.length > 0) {
      await prisma.course.deleteMany({ where: { id: { in: courseIds } } }).catch(() => {});
    }
    if (userIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: userIds } } }).catch(() => {});
    }
    if (departmentIds.length > 0) {
      await prisma.department.deleteMany({ where: { id: { in: departmentIds } } }).catch(() => {});
    }
    if (collegeIds.length > 0) {
      await prisma.college.deleteMany({ where: { id: { in: collegeIds } } }).catch(() => {});
    }
  }
});
