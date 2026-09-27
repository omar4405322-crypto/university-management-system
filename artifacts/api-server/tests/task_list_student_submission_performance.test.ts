import assert from 'node:assert/strict';
import prisma from '../src/utils/prismaClient';
import { TaskService } from '../src/services/task.service';

const originals = {
  taskFindMany: prisma.task.findMany,
  taskCount: prisma.task.count,
  studentFindUnique: prisma.student.findUnique,
  enrollmentFindMany: prisma.enrollment.findMany,
};

try {
  let taskQueries = 0;
  let findManyArgs: any;

  (prisma.student.findUnique as any) = async () => ({ id: 7, userId: 70 });
  (prisma.enrollment.findMany as any) = async () => [
    { id: 1, courseId: 10, academicYear: 2026, semester: 1 },
  ];
  (prisma.task.findMany as any) = async (args: any) => {
    taskQueries += 1;
    findManyArgs = args;
    return [
      {
        id: 11,
        title: 'One request',
        submissions: [{ id: 101, taskId: 11, studentId: 7, score: 18 }],
      },
      { id: 12, title: 'Still one request', submissions: [] },
    ];
  };
  (prisma.task.count as any) = async () => 2;

  const result = await TaskService.getTasks(
    { id: 70, role: 'STUDENT' },
    undefined,
    { page: 1, limit: 24 }
  );

  assert.equal(taskQueries, 1, 'F2: task rows and own submissions must be loaded in one bounded service query');
  assert.deepEqual(findManyArgs.include.submissions, {
    where: { studentId: 7 },
    orderBy: { submittedAt: 'desc' },
    take: 1,
  });
  assert.equal(result.rows[0].mySubmission.id, 101);
  assert.equal(result.rows[1].mySubmission, null);
  assert.equal('submissions' in result.rows[0], false, 'F2: the private relation array must not leak into the response');

  console.log('F2 student task-submission N+1 regression checks passed');
} finally {
  prisma.task.findMany = originals.taskFindMany;
  prisma.task.count = originals.taskCount;
  prisma.student.findUnique = originals.studentFindUnique;
  prisma.enrollment.findMany = originals.enrollmentFindMany;
}
