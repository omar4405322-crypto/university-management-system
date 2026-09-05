import assert from 'node:assert/strict';
import prisma from '../src/utils/prismaClient';
import {
  approveRequest,
  createRequest,
  getRequests,
  rejectRequest,
} from '../src/controllers/requests.controller';
import { AuthorizationError } from '../src/utils/appError';

async function captureControllerError(controller: any, request: Record<string, unknown>) {
  return new Promise<unknown>((resolve, reject) => {
    const response = {
      status: () => response,
      json: () => reject(new Error('Expected the request operation to be rejected')),
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

async function runScheduleRequestScopeSecurityTests() {
  const originalCourseFindFirst = prisma.course.findFirst;
  const originalSlotFindFirst = prisma.scheduleSlot.findFirst;
  const originalRequestCreate = prisma.scheduleChangeRequest.create;
  const originalRequestFindFirst = prisma.scheduleChangeRequest.findFirst;
  const originalRequestFindMany = prisma.scheduleChangeRequest.findMany;
  const originalTransaction = prisma.$transaction;
  let capturedSlotWhere: unknown;
  let capturedRequestWhere: unknown;
  let createCalled = false;
  let mutationCalled = false;
  let findManyCalled = false;

  try {
    (prisma.scheduleSlot as any).findFirst = async (args: any) => {
      capturedSlotWhere = args.where;
      return null;
    };
    (prisma.scheduleChangeRequest as any).create = async () => {
      createCalled = true;
      return { id: 1 };
    };

    const doctorError = await captureControllerError(createRequest, {
      user: { id: 99, role: 'DOCTOR', doctor: { id: 12 } },
      body: {
        type: 'UPDATE_SLOT',
        courseId: 41,
        scheduleSlotId: 5,
        proposedData: { room: 'A1' },
      },
    });
    assert.ok(doctorError instanceof AuthorizationError);
    assert.deepEqual(capturedSlotWhere, {
      id: 5,
      courseId: 41,
      doctorId: 12,
    });
    assert.equal(createCalled, false);

    const taError = await captureControllerError(createRequest, {
      user: {
        id: 100,
        role: 'TEACHING_ASSISTANT',
        teachingAssistant: { id: 'ta-12' },
      },
      body: {
        type: 'DELETE_SLOT',
        courseId: 41,
        scheduleSlotId: 5,
        proposedData: {},
      },
    });
    assert.ok(taError instanceof AuthorizationError);
    assert.deepEqual(capturedSlotWhere, {
      id: 5,
      courseId: 41,
      teachingAssistantId: 'ta-12',
    });
    assert.equal(createCalled, false);

    (prisma.scheduleChangeRequest as any).findMany = async (args: any) => {
      findManyCalled = true;
      capturedRequestWhere = args.where;
      return [];
    };

    const unscopedListError = await captureControllerError(getRequests, {
      user: { id: 1, role: 'COLLEGE_ADMIN', managedCollegeId: null },
      query: {},
    });
    assert.ok(unscopedListError instanceof AuthorizationError);
    assert.equal(findManyCalled, false, 'Missing managed scope must stop before the list query');

    const listResult = await invokeController(getRequests, {
      user: { id: 1, role: 'DEPARTMENT_ADMIN', managedDepartmentId: 7 },
      query: {},
    });
    assert.equal(listResult.success, true);
    assert.deepEqual(capturedRequestWhere, { course: { departmentId: 7 } });

    (prisma.scheduleChangeRequest as any).findFirst = async (args: any) => {
      capturedRequestWhere = args.where;
      return {
        id: 20,
        type: 'DELETE_SLOT',
        status: 'PENDING',
        requesterId: 99,
        courseId: 41,
        scheduleSlotId: 5,
        proposedData: {},
        reason: null,
        course: { id: 41, departmentId: 7 },
      };
    };
    (prisma as any).$transaction = async (callback: any) => callback({
      scheduleSlot: {
        findFirst: async (args: any) => {
          capturedSlotWhere = args.where;
          return null;
        },
        delete: async () => {
          mutationCalled = true;
        },
      },
    });

    const approveError = await captureControllerError(approveRequest, {
      params: { id: '20' },
      user: { id: 1, role: 'DEPARTMENT_ADMIN', managedDepartmentId: 7 },
      body: {},
    });
    assert.ok(approveError instanceof AuthorizationError);
    assert.deepEqual(capturedRequestWhere, {
      AND: [{ id: 20 }, { course: { departmentId: 7 } }],
    });
    assert.deepEqual(capturedSlotWhere, {
      AND: [
        { id: 5, courseId: 41 },
        { course: { departmentId: 7 } },
      ],
    });
    assert.equal(mutationCalled, false, 'A foreign/mismatched slot must not be deleted');

    (prisma.scheduleChangeRequest as any).findFirst = async (args: any) => {
      capturedRequestWhere = args.where;
      return null;
    };
    const rejectError = await captureControllerError(rejectRequest, {
      params: { id: '20' },
      user: { id: 1, role: 'COLLEGE_ADMIN', managedCollegeId: 4 },
      body: {},
    });
    assert.ok(rejectError instanceof Error);
    assert.deepEqual(capturedRequestWhere, {
      AND: [{ id: 20 }, { course: { department: { collegeId: 4 } } }],
    });
  } finally {
    (prisma.course as any).findFirst = originalCourseFindFirst;
    (prisma.scheduleSlot as any).findFirst = originalSlotFindFirst;
    (prisma.scheduleChangeRequest as any).create = originalRequestCreate;
    (prisma.scheduleChangeRequest as any).findFirst = originalRequestFindFirst;
    (prisma.scheduleChangeRequest as any).findMany = originalRequestFindMany;
    (prisma as any).$transaction = originalTransaction;
  }
}

await runScheduleRequestScopeSecurityTests();
console.log('Schedule request scope security checks passed');
