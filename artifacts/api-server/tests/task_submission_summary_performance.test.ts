import assert from 'node:assert/strict';
import prisma from '../src/utils/prismaClient';
import { TaskService } from '../src/services/task.service';

const originals = {
  taskFindUnique: prisma.task.findUnique,
  enrollmentCount: prisma.enrollment.count,
  enrollmentFindMany: prisma.enrollment.findMany,
  submissionCount: prisma.taskSubmission.count,
  submissionFindMany: prisma.taskSubmission.findMany,
};

const dueDate = new Date('2026-09-01T10:00:00.000Z');

const student = {
  id: 1,
  studentId: 'S1',
  firstName: 'Student',
  lastName: 'One',
  year: 2,
};

try {
  const enrollmentFindManyQueries: any[] = [];
  const submissionCountQueries: any[] = [];
  const submissionFindManyQueries: any[] = [];

  (prisma.task.findUnique as any) = async () => ({
    id: 10,
    doctorId: 5,
    dueDate,
    course: {
      id: 7,
      name: 'Course 7',
      year: 2,
      departmentId: 3,
      department: { id: 3, collegeId: 2 },
    },
  });
  (prisma.enrollment.count as any) = async () => 250;
  (prisma.enrollment.findMany as any) = async (args: any) => {
    enrollmentFindManyQueries.push(args);
    if (args.take) {
      return [{ id: 11, studentId: 1, student }];
    }
    return [{ studentId: 1 }];
  };
  (prisma.taskSubmission.count as any) = async (args: any) => {
    submissionCountQueries.push(args);
    if (args.where?.submittedAt?.gt) return 1;
    if (args.where?.score?.not === null) return 1;
    if (args.where?.student?.enrollments?.none) return 1;
    if (args.where?.studentId?.notIn) return 1;
    return 2;
  };
  (prisma.taskSubmission.findMany as any) = async (args: any) => {
    submissionFindManyQueries.push(args);
    if (args.select?.submittedAt) {
      return [
        { submittedAt: new Date('2026-09-01T09:00:00.000Z') },
        { submittedAt: new Date('2026-09-01T11:00:00.000Z') },
      ];
    }
    if (args.where?.studentId?.in) {
      return [{
        id: 21,
        taskId: 10,
        studentId: 1,
        student,
        submittedAt: new Date('2026-09-01T09:00:00.000Z'),
        score: null,
      }];
    }
    return [];
  };

  const result = await TaskService.getTaskSubmissions(
    { role: 'SUPER_ADMIN', id: 1 },
    10,
    { status: 'ALL', page: 1, limit: 25 }
  );

  assert.equal(result.summary.late, 1);
  assert.equal(
    submissionCountQueries.filter(
      (args) => args.where?.taskId === 10 && args.where?.submittedAt?.gt
    ).length,
    1,
    'late summary must execute exactly one bounded count query'
  );
  assert.ok(
    submissionCountQueries.some(
      (args) =>
        args.where?.taskId === 10 &&
        args.where?.submittedAt?.gt?.getTime() === dueDate.getTime()
    ),
    'late total must be a database count filtered by the task due date'
  );
  assert.equal(
    submissionFindManyQueries.some((args) => args.select?.submittedAt),
    false,
    'late totals must not load every submittedAt value'
  );

  assert.equal(
    enrollmentFindManyQueries.some(
      (args) => args.select?.studentId && args.take === undefined
    ),
    false,
    'orphan detection must not load every enrolled student ID'
  );
  assert.equal(
    enrollmentFindManyQueries.length,
    1,
    'the ALL path must only read the bounded enrollment page'
  );
  assert.equal(enrollmentFindManyQueries[0].take, 25);
  assert.ok(
    submissionCountQueries.some(
      (args) =>
        args.where?.taskId === 10 &&
        args.where?.student?.enrollments?.none?.courseId === 7 &&
        args.where?.student?.enrollments?.none?.status === 'ENROLLED'
    ),
    'orphan detection must use a database anti-relation filter'
  );

  console.log('Task submission summary performance checks passed');
} finally {
  prisma.task.findUnique = originals.taskFindUnique;
  prisma.enrollment.count = originals.enrollmentCount;
  prisma.enrollment.findMany = originals.enrollmentFindMany;
  prisma.taskSubmission.count = originals.submissionCount;
  prisma.taskSubmission.findMany = originals.submissionFindMany;
}
