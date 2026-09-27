import assert from 'node:assert/strict';
import prisma from '../src/utils/prismaClient';
import { TaskService } from '../src/services/task.service';

const originals = {
  taskFindMany: prisma.task.findMany,
  taskCount: prisma.task.count,
};

try {
  let findManyArgs: any;
  let countArgs: any;

  (prisma.task.findMany as any) = async (args: any) => {
    findManyArgs = args;
    return [{ id: 49, title: 'Bounded page' }];
  };
  (prisma.task.count as any) = async (args: any) => {
    countArgs = args;
    return 61;
  };

  const result = await TaskService.getTasks(
    { id: 1, role: 'SUPER_ADMIN' },
    undefined,
    { page: 3, limit: 24, search: 'bounded' }
  );

  assert.equal(findManyArgs.skip, 48, 'F1: page 3 must skip exactly two bounded pages');
  assert.equal(findManyArgs.take, 24, 'F1: the database query must enforce the requested page size');
  assert.deepEqual(countArgs.where, findManyArgs.where, 'F1: rows and total must use identical filters');
  assert.deepEqual(result.pagination, {
    page: 3,
    limit: 24,
    totalCount: 61,
    totalPages: 3,
  });
  assert.equal(result.rows.length, 1);

  console.log('F1 task-list pagination regression checks passed');
} finally {
  prisma.task.findMany = originals.taskFindMany;
  prisma.task.count = originals.taskCount;
}
