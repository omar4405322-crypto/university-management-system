import assert from 'node:assert/strict';
import prisma from '../src/utils/prismaClient';
import {
  deleteGroup,
  getAllGroups,
  getGroupsByDepartment,
  manualOverrideGroup,
  splitGroup,
} from '../src/controllers/studentGroups.controller';
import { AuthorizationError, ValidationError } from '../src/utils/appError';
import {
  denyAllStudentGroups,
  resolveStudentGroupReadScopeWhere,
} from '../src/utils/studentGroupScope.utils';

async function captureControllerError(controller: any, request: Record<string, unknown>) {
  return new Promise<unknown>((resolve, reject) => {
    const response = {
      status: () => response,
      json: () => reject(new Error('Expected the operation to be rejected')),
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

async function runStudentGroupScopeSecurityTests() {
  assert.deepEqual(
    await resolveStudentGroupReadScopeWhere({
      role: 'STUDENT',
      student: { id: 5, departmentId: 7, year: 3 },
    }),
    { departmentId: 7, year: 3 }
  );
  assert.deepEqual(
    await resolveStudentGroupReadScopeWhere({ role: 'STUDENT', student: { id: 5 } }),
    denyAllStudentGroups()
  );
  assert.deepEqual(
    await resolveStudentGroupReadScopeWhere({
      role: 'COLLEGE_ADMIN',
      collegeId: 4,
      managedCollegeId: null,
    }),
    denyAllStudentGroups(),
    'Profile membership must not substitute for managed admin scope'
  );

  const staffQueries: any[] = [];
  const staffClient = {
    scheduleSlot: {
      findMany: async (args: any) => {
        staffQueries.push(args);
        return [
          { course: { departmentId: 7, year: 2 } },
          { course: { departmentId: 7, year: 2 } },
          { course: { departmentId: 8, year: 4 } },
        ];
      },
    },
  };
  assert.deepEqual(
    await resolveStudentGroupReadScopeWhere(
      { role: 'DOCTOR', doctor: { id: 12 } },
      staffClient
    ),
    { OR: [{ departmentId: 7, year: 2 }, { departmentId: 8, year: 4 }] }
  );
  assert.deepEqual(staffQueries[0], {
    where: { doctorId: 12 },
    select: { course: { select: { departmentId: true, year: true } } },
  });

  const originalGroupFindFirst = prisma.studentGroup.findFirst;
  const originalGroupFindMany = prisma.studentGroup.findMany;
  const originalScheduleFindMany = prisma.scheduleSlot.findMany;
  const originalTransaction = prisma.$transaction;
  let capturedGroupWhere: unknown;
  let transactionCalled = false;

  try {
    (prisma.studentGroup as any).findFirst = async (args: any) => {
      capturedGroupWhere = args.where;
      return null;
    };
    (prisma.studentGroup as any).findMany = async (args: any) => {
      capturedGroupWhere = args.where;
      return [];
    };
    (prisma as any).$transaction = async () => {
      transactionCalled = true;
    };

    const splitError = await captureControllerError(splitGroup, {
      params: { groupId: '30' },
      user: { role: 'DEPARTMENT_ADMIN', managedDepartmentId: 7 },
      body: { numberOfSubgroups: 2 },
    });
    assert.ok(splitError instanceof AuthorizationError);
    assert.deepEqual(capturedGroupWhere, {
      AND: [{ id: 30 }, { departmentId: 7 }],
    });
    assert.equal(transactionCalled, false);

    const deleteError = await captureControllerError(deleteGroup, {
      params: { groupId: '30' },
      user: { role: 'COLLEGE_ADMIN', managedCollegeId: 4 },
      body: { confirmed: true },
    });
    assert.ok(deleteError instanceof AuthorizationError);
    assert.deepEqual(capturedGroupWhere, {
      AND: [{ id: 30 }, { department: { collegeId: 4 } }],
    });
    assert.equal(transactionCalled, false);

    const listResult = await invokeController(getAllGroups, {
      user: { role: 'STUDENT', student: { id: 5, departmentId: 7, year: 3 } },
      query: {},
    });
    assert.equal(listResult.success, true);
    assert.deepEqual(capturedGroupWhere, {
      AND: [{}, { departmentId: 7, year: 3 }],
    });

    const treeResult = await invokeController(getGroupsByDepartment, {
      params: { departmentId: '7' },
      query: { year: '3' },
      user: { role: 'STUDENT', student: { id: 5, departmentId: 7, year: 3 } },
    });
    assert.equal(treeResult.success, true);
    assert.deepEqual(capturedGroupWhere, {
      AND: [{ departmentId: 7, year: 3 }, { departmentId: 7, year: 3 }],
    });

    let studentUpdateCalled = false;
    (prisma as any).$transaction = async (callback: any) => {
      transactionCalled = true;
      return callback({
        student: {
          findFirst: async (args: any) => {
            assert.deepEqual(args.where, {
              AND: [{ id: 5 }, { departmentId: 7 }],
            });
            return { id: 5, departmentId: 7, year: 2 };
          },
          update: async () => {
            studentUpdateCalled = true;
          },
        },
        studentGroup: {
          findFirst: async (args: any) => {
            assert.deepEqual(args.where, {
              AND: [{ id: 30 }, { departmentId: 7 }],
            });
            return { id: 30, departmentId: 7, year: 3 };
          },
        },
      });
    };

    const incompatibleGroupError = await captureControllerError(manualOverrideGroup, {
      params: { studentId: '5' },
      user: { role: 'DEPARTMENT_ADMIN', managedDepartmentId: 7 },
      body: { groupId: 30 },
    });
    assert.ok(incompatibleGroupError instanceof ValidationError);
    assert.equal(transactionCalled, true);
    assert.equal(studentUpdateCalled, false);
  } finally {
    (prisma.studentGroup as any).findFirst = originalGroupFindFirst;
    (prisma.studentGroup as any).findMany = originalGroupFindMany;
    (prisma.scheduleSlot as any).findMany = originalScheduleFindMany;
    (prisma as any).$transaction = originalTransaction;
  }
}

await runStudentGroupScopeSecurityTests();
console.log('Student-group scope security checks passed');
