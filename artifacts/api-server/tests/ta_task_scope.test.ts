import assert from 'node:assert/strict';
import { test } from 'node:test';
import prisma from '../src/utils/prismaClient';
import { TaskService } from '../src/services/task.service';

test('T1 BLOCKER: TA task leak - TA with schedule slots only sees courses where assigned', async () => {
  const originals = {
    taskFindMany: prisma.task.findMany,
    taskCount: prisma.task.count,
    taFindUnique: prisma.teachingAssistant.findUnique,
    slotCount: prisma.scheduleSlot.count,
  };

  try {
    let capturedWhere: any = null;
    (prisma.task.findMany as any) = async (args: any) => {
      capturedWhere = args.where;
      return [];
    };
    (prisma.task.count as any) = async (args: any) => 0;
    (prisma.teachingAssistant.findUnique as any) = async () => ({ id: 'ta-cuid-101' });
    (prisma.scheduleSlot.count as any) = async () => 1;

    const user = {
      id: 50,
      role: 'TEACHING_ASSISTANT',
      teachingAssistant: { id: 'ta-cuid-101', employeeId: 'TA-101' },
    };

    await TaskService.getTasks(user as any);

    assert.ok(capturedWhere, 'Query where clause must be constructed');
    assert.deepEqual(
      capturedWhere.course?.scheduleSlots,
      { some: { teachingAssistantId: 'ta-cuid-101' } },
      'TA task query must strictly filter courses with schedule slots for that TA'
    );
  } finally {
    prisma.task.findMany = originals.taskFindMany;
    prisma.task.count = originals.taskCount;
    prisma.teachingAssistant.findUnique = originals.taFindUnique;
    prisma.scheduleSlot.count = originals.slotCount;
  }
});

test('T1 BLOCKER: TA task leak - TA with no schedule slots receives empty list and 0 total', async () => {
  const originals = {
    taskFindMany: prisma.task.findMany,
    taskCount: prisma.task.count,
    taFindUnique: prisma.teachingAssistant.findUnique,
    slotCount: prisma.scheduleSlot.count,
  };

  try {
    let capturedFindManyWhere: any = null;
    let capturedCountWhere: any = null;

    (prisma.task.findMany as any) = async (args: any) => {
      capturedFindManyWhere = args.where;
      return [];
    };
    (prisma.task.count as any) = async (args: any) => {
      capturedCountWhere = args.where;
      return 0;
    };
    (prisma.teachingAssistant.findUnique as any) = async () => ({ id: 'ta-cuid-noslots' });
    (prisma.scheduleSlot.count as any) = async () => 0;

    const user = {
      id: 51,
      role: 'TEACHING_ASSISTANT',
      teachingAssistant: { id: 'ta-cuid-noslots', employeeId: 'TA-NOSLOTS' },
    };

    const res = await TaskService.getTasks(user as any);

    assert.equal(res.rows.length, 0);
    assert.equal(res.pagination.totalCount, 0);
    assert.equal(res.pagination.totalPages, 0);
    // Either where.id === -1 or course.scheduleSlots is applied
    const isFiltered =
      capturedFindManyWhere?.id === -1 ||
      capturedFindManyWhere?.course?.scheduleSlots?.some?.teachingAssistantId === 'ta-cuid-noslots';
    assert.ok(isFiltered, 'Query must be restricted for TA with no slots');
  } finally {
    prisma.task.findMany = originals.taskFindMany;
    prisma.task.count = originals.taskCount;
    prisma.teachingAssistant.findUnique = originals.taFindUnique;
    prisma.scheduleSlot.count = originals.slotCount;
  }
});

test('T1: Preserves Doctor and Admin scoping behavior', async () => {
  const originals = {
    taskFindMany: prisma.task.findMany,
    taskCount: prisma.task.count,
    doctorFindUnique: prisma.doctor.findUnique,
  };

  try {
    let doctorWhere: any = null;
    (prisma.task.findMany as any) = async (args: any) => {
      doctorWhere = args.where;
      return [];
    };
    (prisma.task.count as any) = async () => 0;
    (prisma.doctor.findUnique as any) = async () => ({ id: 77 });

    await TaskService.getTasks({ id: 10, role: 'DOCTOR' } as any);
    assert.equal(doctorWhere?.doctorId, 77, 'Doctor is filtered by doctorId');

    let collegeAdminWhere: any = null;
    (prisma.task.findMany as any) = async (args: any) => {
      collegeAdminWhere = args.where;
      return [];
    };

    await TaskService.getTasks({
      id: 20,
      role: 'COLLEGE_ADMIN',
      managedCollegeId: 701,
    } as any);
    assert.deepEqual(
      collegeAdminWhere?.course?.department,
      { is: { collegeId: 701 } },
      'College admin is filtered by college'
    );
  } finally {
    prisma.task.findMany = originals.taskFindMany;
    prisma.task.count = originals.taskCount;
    prisma.doctor.findUnique = originals.doctorFindUnique;
  }
});
