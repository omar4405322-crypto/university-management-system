import assert from 'node:assert/strict';
import prisma from '../src/utils/prismaClient';
import { AuthorizationError, NotFoundError } from '../src/utils/appError';
import { getDepartmentById } from '../src/controllers/department.controller';

async function invokeController(
  controller: any,
  request: Record<string, unknown>
): Promise<{ error?: unknown; body?: any }> {
  return new Promise((resolve) => {
    const response: any = {
      status: () => response,
      json: (body: any) => resolve({ body }),
    };
    controller(request, response, (error?: unknown) => resolve({ error }));
  });
}

async function runDepartmentRosterScopeSecurityTests() {
  const originalFindUnique = prisma.department.findUnique;
  let capturedQueryArgs: any = null;

  try {
    // 1. Unknown role fails closed
    const unknownRoleRes = await invokeController(getDepartmentById, {
      params: { id: '5' },
      user: { id: 1, role: 'GUEST' },
    });
    assert.ok(unknownRoleRes.error instanceof AuthorizationError, 'Unknown role must fail closed with AuthorizationError');

    // 2. Missing user (unauthenticated) fails closed
    const unauthRes = await invokeController(getDepartmentById, {
      params: { id: '5' },
      user: undefined,
    });
    assert.ok(unauthRes.error instanceof AuthorizationError, 'Unauthenticated request must fail closed with AuthorizationError');

    // 3. STUDENT receives only permitted metadata (safe projection, sensitive relations not queried)
    (prisma.department as any).findUnique = async (args: any) => {
      capturedQueryArgs = args;
      return {
        id: 5,
        name: 'Computer Science',
        nameAr: 'علوم الحاسب',
        collegeId: 1,
        college: { id: 1, name: 'Faculty of Engineering', nameAr: 'كلية الهندسة' },
      };
    };

    const studentRes = await invokeController(getDepartmentById, {
      params: { id: '5' },
      user: { id: 10, role: 'STUDENT', student: { id: 101, departmentId: 5 } },
    });
    assert.equal(studentRes.error, undefined);
    assert.ok(capturedQueryArgs.select, 'Student query must use explicit select projection');
    assert.equal(capturedQueryArgs.select.students, undefined, 'Student query must not include students relation');
    assert.equal(capturedQueryArgs.select.doctors, undefined, 'Student query must not include doctors relation');
    assert.equal(capturedQueryArgs.select.courses, undefined, 'Student query must not include courses relation');
    assert.equal(capturedQueryArgs.select._count, undefined, 'Student query must not include _count relation');
    assert.equal(studentRes.body.data.id, 5);
    assert.equal(studentRes.body.data.students, undefined);
    assert.equal(studentRes.body.data.doctors, undefined);

    // 4. DOCTOR receives only permitted metadata (cannot retrieve arbitrary rosters)
    capturedQueryArgs = null;
    const doctorRes = await invokeController(getDepartmentById, {
      params: { id: '5' },
      user: { id: 20, role: 'DOCTOR', doctor: { id: 201 } },
    });
    assert.equal(doctorRes.error, undefined);
    assert.ok(capturedQueryArgs.select, 'Doctor query must use explicit select projection');
    assert.equal(capturedQueryArgs.select.students, undefined, 'Doctor query must not include students relation');
    assert.equal(capturedQueryArgs.select.doctors, undefined, 'Doctor query must not include doctors relation');
    assert.equal(doctorRes.body.data.students, undefined);
    assert.equal(doctorRes.body.data.doctors, undefined);

    // 5. TEACHING_ASSISTANT receives only permitted metadata
    capturedQueryArgs = null;
    const taRes = await invokeController(getDepartmentById, {
      params: { id: '5' },
      user: { id: 30, role: 'TEACHING_ASSISTANT' },
    });
    assert.equal(taRes.error, undefined);
    assert.ok(capturedQueryArgs.select, 'TA query must use explicit select projection');
    assert.equal(capturedQueryArgs.select.students, undefined);
    assert.equal(capturedQueryArgs.select.doctors, undefined);

    // 6. COLLEGE_ADMIN cannot retrieve another college's private data (out-of-scope rejected)
    (prisma.department as any).findUnique = async (args: any) => {
      capturedQueryArgs = args;
      return {
        id: 5,
        name: 'Computer Science',
        collegeId: 2, // Belongs to college 2
        students: [{ id: 101, firstName: 'John' }],
        doctors: [{ id: 201, firstName: 'Dr. Smith' }],
      };
    };

    const outOfScopeCollegeAdminRes = await invokeController(getDepartmentById, {
      params: { id: '5' },
      user: { id: 40, role: 'COLLEGE_ADMIN', managedCollegeId: 1 }, // Admin for college 1
    });
    assert.ok(
      outOfScopeCollegeAdminRes.error instanceof AuthorizationError,
      'COLLEGE_ADMIN must be rejected when accessing another college department'
    );

    // 7. DEPARTMENT_ADMIN cannot retrieve another department's private data
    const outOfScopeDeptAdminRes = await invokeController(getDepartmentById, {
      params: { id: '5' },
      user: { id: 50, role: 'DEPARTMENT_ADMIN', managedDepartmentId: 9 }, // Admin for department 9
    });
    assert.ok(
      outOfScopeDeptAdminRes.error instanceof AuthorizationError,
      'DEPARTMENT_ADMIN must be rejected when accessing another department'
    );

    // 8. Legacy ADMIN with missing required scope fails closed
    const legacyAdminNoScopeRes = await invokeController(getDepartmentById, {
      params: { id: '5' },
      user: { id: 60, role: 'ADMIN', managedCollegeId: undefined },
    });
    assert.ok(
      legacyAdminNoScopeRes.error instanceof AuthorizationError,
      'Legacy ADMIN with missing managedCollegeId must fail closed'
    );

    // 9. Legacy ADMIN with mismatched managedCollegeId fails closed
    const legacyAdminMismatchedRes = await invokeController(getDepartmentById, {
      params: { id: '5' },
      user: { id: 60, role: 'ADMIN', managedCollegeId: 99 },
    });
    assert.ok(
      legacyAdminMismatchedRes.error instanceof AuthorizationError,
      'Legacy ADMIN with mismatched managedCollegeId must fail closed'
    );

    // 10. In-scope COLLEGE_ADMIN retains legitimate access
    (prisma.department as any).findUnique = async (args: any) => {
      capturedQueryArgs = args;
      return {
        id: 5,
        name: 'Computer Science',
        collegeId: 1,
        students: [{ id: 101, firstName: 'John' }],
        doctors: [{ id: 201, firstName: 'Dr. Smith' }],
        courses: [],
        _count: { students: 1, doctors: 1, courses: 0 },
      };
    };

    const inScopeCollegeAdminRes = await invokeController(getDepartmentById, {
      params: { id: '5' },
      user: { id: 40, role: 'COLLEGE_ADMIN', managedCollegeId: 1 },
    });
    assert.equal(inScopeCollegeAdminRes.error, undefined);
    assert.equal(inScopeCollegeAdminRes.body.data.id, 5);
    assert.equal(inScopeCollegeAdminRes.body.data.students.length, 1);

    // 11. In-scope DEPARTMENT_ADMIN retains legitimate access
    const inScopeDeptAdminRes = await invokeController(getDepartmentById, {
      params: { id: '5' },
      user: { id: 50, role: 'DEPARTMENT_ADMIN', managedDepartmentId: 5 },
    });
    assert.equal(inScopeDeptAdminRes.error, undefined);
    assert.equal(inScopeDeptAdminRes.body.data.id, 5);

    // 12. SUPER_ADMIN retains institution-wide legitimate access
    const superAdminRes = await invokeController(getDepartmentById, {
      params: { id: '5' },
      user: { id: 999, role: 'SUPER_ADMIN' },
    });
    assert.equal(superAdminRes.error, undefined);
    assert.equal(superAdminRes.body.data.id, 5);
    assert.equal(superAdminRes.body.data.students.length, 1);

    // 13. Non-existent department returns 404
    (prisma.department as any).findUnique = async () => null;
    const notFoundRes = await invokeController(getDepartmentById, {
      params: { id: '99999' },
      user: { id: 10, role: 'STUDENT' },
    });
    assert.ok(notFoundRes.error instanceof NotFoundError, 'Non-existent department must return NotFoundError');

    console.log('All 13 Department Roster Scope Security (SEC-02) tests passed successfully.');
  } finally {
    (prisma.department as any).findUnique = originalFindUnique;
  }
}

runDepartmentRosterScopeSecurityTests().catch((err) => {
  console.error('Department roster scope security tests failed:', err);
  process.exit(1);
});
