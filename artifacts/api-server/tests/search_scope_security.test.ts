import assert from 'node:assert/strict';
import prisma from '../src/utils/prismaClient';
import { globalSearch } from '../src/controllers/search.controller';
import { AuthorizationError } from '../src/utils/appError';
import { getSearchScopes } from '../src/utils/searchScope.utils';

async function invokeSearch(request: Record<string, unknown>): Promise<{ error?: unknown; body?: any }> {
  return new Promise((resolve) => {
    const response = { json: (body: any) => resolve({ body }) };
    globalSearch(request as any, response as any, (error?: unknown) => resolve({ error }));
  });
}

async function runSearchScopeSecurityTests() {
  assert.equal(getSearchScopes(undefined), null);
  assert.equal(getSearchScopes({ role: 'STUDENT', student: { id: 1 } }), null);
  assert.equal(getSearchScopes({ role: 'UNKNOWN' }), null);
  assert.equal(getSearchScopes({ role: 'ADMIN', managedCollegeId: null, collegeId: 4 }), null);
  assert.equal(
    getSearchScopes({ role: 'DEPARTMENT_ADMIN', managedDepartmentId: null, departmentId: 7 }),
    null
  );
  assert.equal(getSearchScopes({ role: 'DOCTOR' }), null);
  assert.equal(getSearchScopes({ role: 'TEACHING_ASSISTANT' }), null);

  assert.deepEqual(getSearchScopes({ role: 'DEPARTMENT_ADMIN', managedDepartmentId: 7 }), {
    student: { departmentId: 7 },
    doctor: { departmentId: 7 },
    course: { departmentId: 7 },
    college: { departments: { some: { id: 7 } } },
    department: { id: 7 },
  });

  assert.deepEqual(getSearchScopes({ role: 'ADMIN', managedCollegeId: 4 }), {
    student: { department: { collegeId: 4 } },
    doctor: { department: { collegeId: 4 } },
    course: { department: { collegeId: 4 } },
    college: { id: 4 },
    department: { collegeId: 4 },
  });

  assert.deepEqual(getSearchScopes({ role: 'DOCTOR', doctor: { id: 12 } }), {
    student: {
      enrollments: {
        some: { course: { scheduleSlots: { some: { doctorId: 12 } } } },
      },
    },
    doctor: { id: -1 },
    course: { scheduleSlots: { some: { doctorId: 12 } } },
    college: { id: -1 },
    department: { id: -1 },
  });

  assert.deepEqual(
    getSearchScopes({
      role: 'TEACHING_ASSISTANT',
      teachingAssistant: { id: 15, departmentId: 7 },
    }),
    {
      student: {
        OR: [
          {
            enrollments: {
              some: {
                course: { scheduleSlots: { some: { teachingAssistantId: 15 } } },
              },
            },
          },
          { departmentId: 7 },
        ],
      },
      doctor: { id: -1 },
      course: {
        OR: [
          { scheduleSlots: { some: { teachingAssistantId: 15 } } },
          { departmentId: 7 },
        ],
      },
      college: { id: -1 },
      department: { id: -1 },
    }
  );

  const delegates = [
    prisma.student,
    prisma.doctor,
    prisma.course,
    prisma.college,
    prisma.department,
  ] as any[];
  const originals = delegates.map((delegate) => delegate.findMany);
  const captured: any[] = [];
  try {
    delegates.forEach((delegate) => {
      delegate.findMany = async (args: any) => {
        captured.push(args);
        return [];
      };
    });

    const denied = await invokeSearch({ user: { role: 'STUDENT' }, query: { q: 'ab' } });
    assert.ok(denied.error instanceof AuthorizationError);
    assert.equal(captured.length, 0, 'Denied roles must not execute any search query');

    const response = await invokeSearch({
      user: { role: 'COLLEGE_ADMIN', managedCollegeId: 4 },
      query: { q: 'smith' },
    });
    assert.equal(response.error, undefined);
    assert.equal(captured.length, 5);
    assert.deepEqual(captured[0].where.AND[1], { department: { collegeId: 4 } });
    assert.deepEqual(captured[1].where.AND[1], { department: { collegeId: 4 } });
    assert.deepEqual(captured[2].where.AND[1], { department: { collegeId: 4 } });
    assert.deepEqual(captured[3].where.AND[1], { id: 4 });
    assert.deepEqual(captured[4].where.AND[1], { collegeId: 4 });
  } finally {
    delegates.forEach((delegate, index) => {
      delegate.findMany = originals[index];
    });
  }
}

await runSearchScopeSecurityTests();
console.log('Search scope security checks passed');
