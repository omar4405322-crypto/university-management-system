import assert from 'node:assert/strict';
import prisma from '../src/utils/prismaClient';
import { createCourse } from '../src/controllers/courses.controller';
import { createStudent } from '../src/controllers/students.controller';
import { createDepartment } from '../src/controllers/department.controller';
import { AuthorizationError } from '../src/utils/appError';
import {
  canManageUnassignedAdminResource,
  getAdminMutationScopeWhere,
  getAdminMutationTargetWhere,
} from '../src/utils/adminMutationScope.utils';

const DENY_ALL = {
  AND: [{ id: { equals: 0 } }, { id: { not: 0 } }],
};

async function captureControllerError(controller: any, request: Record<string, unknown>) {
  return new Promise<unknown>((resolve, reject) => {
    const response = {
      status: () => response,
      json: () => reject(new Error('Expected the mutation to be rejected')),
    };
    controller(request, response, (error?: unknown) => resolve(error));
  });
}

async function runAdminMutationScopeSecurityTests() {
  assert.deepEqual(getAdminMutationScopeWhere(undefined, 'course'), DENY_ALL);
  assert.deepEqual(getAdminMutationScopeWhere({ role: 'UNKNOWN' }, 'student'), DENY_ALL);
  assert.deepEqual(getAdminMutationScopeWhere({ role: 'ADMIN' }, 'department'), DENY_ALL);
  assert.deepEqual(getAdminMutationScopeWhere({ role: 'COLLEGE_ADMIN' }, 'course'), DENY_ALL);
  assert.deepEqual(getAdminMutationScopeWhere({ role: 'DEPARTMENT_ADMIN' }, 'student'), DENY_ALL);
  assert.deepEqual(
    getAdminMutationScopeWhere({ role: 'COLLEGE_ADMIN', collegeId: 4 }, 'course'),
    DENY_ALL,
    'A profile collegeId must not substitute for the required managedCollegeId'
  );
  assert.deepEqual(
    getAdminMutationScopeWhere({ role: 'DEPARTMENT_ADMIN', departmentId: 7 }, 'student'),
    DENY_ALL,
    'A profile departmentId must not substitute for the required managedDepartmentId'
  );

  assert.deepEqual(
    getAdminMutationTargetWhere(
      { role: 'COLLEGE_ADMIN', managedCollegeId: 4 },
      'department',
      9
    ),
    { AND: [{ id: 9 }, { collegeId: 4 }] }
  );
  assert.deepEqual(
    getAdminMutationTargetWhere(
      { role: 'DEPARTMENT_ADMIN', managedDepartmentId: 7 },
      'course',
      12
    ),
    { AND: [{ id: 12 }, { departmentId: 7 }] }
  );
  assert.deepEqual(
    getAdminMutationTargetWhere({ role: 'ADMIN', managedCollegeId: 4 }, 'student', 15),
    { AND: [{ id: 15 }, { department: { collegeId: 4 } }] }
  );
  assert.deepEqual(
    getAdminMutationTargetWhere({ role: 'SUPER_ADMIN' }, 'college', 3),
    { AND: [{ id: 3 }, {}] }
  );

  assert.equal(canManageUnassignedAdminResource({ role: 'SUPER_ADMIN' }), true);
  assert.equal(canManageUnassignedAdminResource({ role: 'ADMIN', managedCollegeId: 4 }), false);
  assert.equal(canManageUnassignedAdminResource({ role: 'COLLEGE_ADMIN', managedCollegeId: 4 }), false);
  assert.equal(
    canManageUnassignedAdminResource({ role: 'DEPARTMENT_ADMIN', managedDepartmentId: 7 }),
    false
  );

  const originalDepartmentFindFirst = prisma.department.findFirst;
  const originalCollegeFindFirst = prisma.college.findFirst;
  const originalCourseCreate = prisma.course.create;
  const originalTransaction = prisma.$transaction;
  let capturedWhere: unknown;
  let mutationCalled = false;

  try {
    (prisma.department as any).findFirst = async (args: any) => {
      capturedWhere = args.where;
      return null;
    };
    (prisma.course as any).create = async () => {
      mutationCalled = true;
      return { id: 1 };
    };

    const courseError = await captureControllerError(createCourse, {
      user: { role: 'DEPARTMENT_ADMIN', managedDepartmentId: 7 },
      body: { name: 'Other tenant', courseCode: 'X', credits: 3, departmentId: 8 },
    });
    assert.ok(courseError instanceof AuthorizationError);
    assert.deepEqual(capturedWhere, { AND: [{ id: 8 }, { id: 7 }] });
    assert.equal(mutationCalled, false);

    (prisma as any).$transaction = async () => {
      mutationCalled = true;
      return { id: 1 };
    };
    const studentError = await captureControllerError(createStudent, {
      user: { role: 'COLLEGE_ADMIN', managedCollegeId: 4 },
      body: {
        email: 'student@example.test',
        firstName: 'Test',
        lastName: 'Student',
        studentId: 'S-1',
        year: 1,
        departmentId: 9,
      },
    });
    assert.ok(studentError instanceof AuthorizationError);
    assert.deepEqual(capturedWhere, { AND: [{ id: 9 }, { collegeId: 4 }] });
    assert.equal(mutationCalled, false);

    (prisma.college as any).findFirst = async (args: any) => {
      capturedWhere = args.where;
      return null;
    };
    const departmentError = await captureControllerError(createDepartment, {
      user: { role: 'COLLEGE_ADMIN', collegeId: 4, managedCollegeId: null },
      body: { name: 'Out of scope', collegeId: 4 },
    });
    assert.ok(departmentError instanceof AuthorizationError);
    assert.deepEqual(capturedWhere, { AND: [{ id: 4 }, DENY_ALL] });
    assert.equal(mutationCalled, false);
  } finally {
    (prisma.department as any).findFirst = originalDepartmentFindFirst;
    (prisma.college as any).findFirst = originalCollegeFindFirst;
    (prisma.course as any).create = originalCourseCreate;
    (prisma as any).$transaction = originalTransaction;
  }
}

await runAdminMutationScopeSecurityTests();
console.log('Admin mutation scope security checks passed');
