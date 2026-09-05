import assert from 'node:assert/strict';
import prisma from '../src/utils/prismaClient';
import {
  createOverride,
  deleteOverride,
  getOverrides,
  updateOverride,
} from '../src/controllers/overrides.controller';
import { AuthorizationError, NotFoundError } from '../src/utils/appError';
import {
  getScheduleSlotOverrideAccessWhere,
  getScopedScheduleOverrideWhere,
} from '../src/utils/scheduleOverrideScope.utils';

const DENY_ALL = {
  AND: [{ id: { equals: 0 } }, { id: { not: 0 } }],
};

async function captureControllerError(controller: any, request: Record<string, unknown>) {
  return new Promise<unknown>((resolve, reject) => {
    const response = {
      status: () => response,
      json: () => reject(new Error('Expected the override operation to be rejected')),
    };
    controller(request, response, (error?: unknown) => resolve(error));
  });
}

async function invokeController(controller: any, request: Record<string, unknown>) {
  return new Promise<any>((resolve, reject) => {
    const response = {
      status: () => response,
      json: (body: unknown) => resolve(body),
    };
    controller(request, response, (error?: unknown) => reject(error));
  });
}

async function runScheduleOverrideScopeSecurityTests() {
  assert.deepEqual(
    getScheduleSlotOverrideAccessWhere({ role: 'DOCTOR', doctor: { id: 12 } }),
    { doctorId: 12 }
  );
  assert.deepEqual(
    getScheduleSlotOverrideAccessWhere({
      role: 'TEACHING_ASSISTANT',
      teachingAssistant: { id: 'ta-12' },
    }),
    { teachingAssistantId: 'ta-12' }
  );
  assert.deepEqual(
    getScheduleSlotOverrideAccessWhere({ role: 'STUDENT', student: { id: 5 } }),
    {
      course: {
        enrollments: { some: { studentId: 5, status: 'ENROLLED' } },
      },
    }
  );
  assert.deepEqual(
    getScheduleSlotOverrideAccessWhere({
      role: 'COLLEGE_ADMIN',
      collegeId: 4,
      managedCollegeId: null,
    }),
    { course: DENY_ALL },
    'Profile membership must not substitute for managed admin scope'
  );
  assert.deepEqual(
    getScopedScheduleOverrideWhere(
      { role: 'DEPARTMENT_ADMIN', managedDepartmentId: 7 },
      20
    ),
    {
      AND: [
        { id: 20 },
        { scheduleSlot: { course: { departmentId: 7 } } },
      ],
    }
  );

  const originalSlotFindFirst = prisma.scheduleSlot.findFirst;
  const originalOverrideFindFirst = prisma.scheduleOverride.findFirst;
  const originalOverrideFindMany = prisma.scheduleOverride.findMany;
  const originalOverrideDelete = prisma.scheduleOverride.delete;
  const originalTransaction = prisma.$transaction;
  let capturedWhere: unknown;
  let mutationCalled = false;

  try {
    (prisma.scheduleOverride as any).findMany = async (args: any) => {
      capturedWhere = args.where;
      return [];
    };
    const readResult = await invokeController(getOverrides, {
      params: { slotId: '5' },
      user: { role: 'STUDENT', student: { id: 9 } },
      body: {},
    });
    assert.equal(readResult.success, true);
    assert.deepEqual(capturedWhere, {
      scheduleSlotId: 5,
      scheduleSlot: {
        course: {
          enrollments: { some: { studentId: 9, status: 'ENROLLED' } },
        },
      },
    });

    (prisma.scheduleOverride as any).findFirst = async (args: any) => {
      capturedWhere = args.where;
      return null;
    };
    (prisma as any).$transaction = async () => {
      mutationCalled = true;
    };

    const adminUpdateError = await captureControllerError(updateOverride, {
      params: { overrideId: '20' },
      user: { role: 'COLLEGE_ADMIN', managedCollegeId: 4 },
      body: {},
    });
    assert.ok(adminUpdateError instanceof NotFoundError);
    assert.deepEqual(capturedWhere, {
      AND: [
        { id: 20 },
        {
          scheduleSlot: {
            course: { department: { collegeId: 4 } },
          },
        },
      ],
    });
    assert.equal(mutationCalled, false);

    const adminDeleteError = await captureControllerError(deleteOverride, {
      params: { overrideId: '20' },
      user: { role: 'DEPARTMENT_ADMIN', managedDepartmentId: 7 },
      body: {},
    });
    assert.ok(adminDeleteError instanceof NotFoundError);
    assert.deepEqual(capturedWhere, {
      AND: [
        { id: 20 },
        { scheduleSlot: { course: { departmentId: 7 } } },
      ],
    });
    assert.equal(mutationCalled, false);

    (prisma.scheduleSlot as any).findFirst = async (args: any) => {
      capturedWhere = args.where;
      if ('AND' in args.where) {
        return {
          id: 5,
          courseId: 41,
          doctorId: 12,
          teachingAssistantId: null,
          groupId: null,
          dayOfWeek: 'MONDAY',
          startTime: '09:00',
          endTime: '10:00',
          room: null,
          course: { id: 41, departmentId: 7 },
        };
      }
      return null;
    };
    (prisma.scheduleOverride as any).findFirst = async () => null;
    (prisma as any).$transaction = async (callback: any) => callback({
      scheduleSlot: {
        findFirst: async (args: any) => {
          capturedWhere = args.where;
          return null;
        },
      },
      scheduleOverride: {
        create: async () => {
          mutationCalled = true;
        },
      },
    });

    mutationCalled = false;
    const replacementError = await captureControllerError(createOverride, {
      params: { slotId: '5' },
      user: { id: 1, role: 'SUPER_ADMIN' },
      body: {
        startDate: '2026-09-10',
        endDate: '2026-09-11',
        teachingAssistantId: 'ta-foreign',
      },
    });
    assert.ok(replacementError instanceof AuthorizationError);
    assert.deepEqual(capturedWhere, {
      courseId: 41,
      teachingAssistantId: 'ta-foreign',
      teachingAssistant: { is: {} },
    });
    assert.equal(mutationCalled, false, 'An unassigned replacement TA must not be written');
  } finally {
    (prisma.scheduleSlot as any).findFirst = originalSlotFindFirst;
    (prisma.scheduleOverride as any).findFirst = originalOverrideFindFirst;
    (prisma.scheduleOverride as any).findMany = originalOverrideFindMany;
    (prisma.scheduleOverride as any).delete = originalOverrideDelete;
    (prisma as any).$transaction = originalTransaction;
  }
}

await runScheduleOverrideScopeSecurityTests();
console.log('Schedule override scope security checks passed');
