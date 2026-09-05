import assert from 'node:assert/strict';
import {
  getScopeWhere,
  STRICT_SCOPE_ENTITIES,
  type StrictScopeEntity,
} from '../src/utils/strictScope.utils';

const DENY_ALL = {
  AND: [{ id: { equals: 0 } }, { id: { not: 0 } }],
};

function assertDenied(user: Record<string, any> | null | undefined, entity: unknown) {
  assert.deepEqual(
    getScopeWhere(user, entity as StrictScopeEntity),
    DENY_ALL,
    `Expected ${String(user?.role)} on ${String(entity)} to fail closed`
  );
}

function runStrictScopeSecurityTests() {
  console.log('--- Starting Strict Scope Security Verification Suite ---');

  for (const entity of STRICT_SCOPE_ENTITIES) {
    assertDenied(null, entity);
    assert.deepEqual(getScopeWhere({ role: 'SUPER_ADMIN' }, entity), {});
  }

  assertDenied({ role: 'SUPER_ADMIN' }, undefined);
  assertDenied({ role: 'SUPER_ADMIN' }, 'futureEntity');
  assertDenied({ role: 'super_admin' }, 'course');
  assertDenied({ role: 'UNKNOWN_ROLE' }, 'course');

  assertDenied({ role: 'COLLEGE_ADMIN' }, 'course');
  assertDenied({ role: 'DEPARTMENT_ADMIN' }, 'course');
  assertDenied({ role: 'ADMIN' }, 'course');
  assertDenied({ role: 'DOCTOR', doctor: {} }, 'course');
  assertDenied({ role: 'TEACHING_ASSISTANT', teachingAssistant: {} }, 'course');
  assertDenied({ role: 'STUDENT' }, 'course');

  assertDenied({ role: 'super_admin' }, 'enrollment');
  assertDenied({ role: 'UNKNOWN_ROLE' }, 'enrollment');
  assertDenied({ role: 'COLLEGE_ADMIN' }, 'enrollment');
  assertDenied({ role: 'DEPARTMENT_ADMIN' }, 'enrollment');
  assertDenied({ role: 'ADMIN' }, 'enrollment');
  assertDenied({ role: 'DOCTOR', doctor: {} }, 'enrollment');
  assertDenied({ role: 'TEACHING_ASSISTANT', teachingAssistant: {} }, 'enrollment');
  assertDenied({ role: 'STUDENT' }, 'enrollment');

  assert.deepEqual(
    getScopeWhere({ role: 'COLLEGE_ADMIN', managedCollegeId: 4 }, 'course'),
    { department: { collegeId: 4 } }
  );
  assert.deepEqual(
    getScopeWhere({ role: 'DEPARTMENT_ADMIN', managedDepartmentId: 8 }, 'exam'),
    { course: { departmentId: 8 } }
  );
  assert.deepEqual(
    getScopeWhere({ role: 'ADMIN', managedCollegeId: 4 }, 'payment'),
    { student: { department: { collegeId: 4 } } }
  );
  assert.deepEqual(
    getScopeWhere({ role: 'DOCTOR', doctor: { id: 12 } }, 'student'),
    {
      enrollments: {
        some: { course: { scheduleSlots: { some: { doctorId: 12 } } } },
      },
    }
  );
  assert.deepEqual(
    getScopeWhere(
      { role: 'TEACHING_ASSISTANT', teachingAssistant: { id: 15, departmentId: 8 } },
      'course'
    ),
    {
      OR: [
        { scheduleSlots: { some: { teachingAssistantId: 15 } } },
        { departmentId: 8 },
      ],
    }
  );
  assert.deepEqual(
    getScopeWhere({ role: 'STUDENT', student: { id: 21, departmentId: 8, year: 2 } }, 'course'),
    {
      OR: [
        { departmentId: 8, year: 2 },
        { enrollments: { some: { studentId: 21 } } },
      ],
    }
  );

  // ── Enrollment scoped-where assertions ──
  assert.deepEqual(
    getScopeWhere({ role: 'COLLEGE_ADMIN', managedCollegeId: 4 }, 'enrollment'),
    { course: { department: { collegeId: 4 } } }
  );
  assert.deepEqual(
    getScopeWhere({ role: 'DEPARTMENT_ADMIN', managedDepartmentId: 8 }, 'enrollment'),
    { course: { departmentId: 8 } }
  );
  assert.deepEqual(
    getScopeWhere({ role: 'ADMIN', managedCollegeId: 4 }, 'enrollment'),
    { course: { department: { collegeId: 4 } } }
  );
  assert.deepEqual(
    getScopeWhere({ role: 'DOCTOR', doctor: { id: 12 } }, 'enrollment'),
    { course: { scheduleSlots: { some: { doctorId: 12 } } } }
  );
  assert.deepEqual(
    getScopeWhere(
      { role: 'TEACHING_ASSISTANT', teachingAssistant: { id: 15, departmentId: 8 } },
      'enrollment'
    ),
    {
      OR: [
        { course: { scheduleSlots: { some: { teachingAssistantId: 15 } } } },
        { course: { departmentId: 8 } },
      ],
    }
  );
  // TA without departmentId — only slot-based scope, no department fallback
  assert.deepEqual(
    getScopeWhere(
      { role: 'TEACHING_ASSISTANT', teachingAssistant: { id: 15 } },
      'enrollment'
    ),
    {
      OR: [
        { course: { scheduleSlots: { some: { teachingAssistantId: 15 } } } },
      ],
    }
  );
  assert.deepEqual(
    getScopeWhere({ role: 'STUDENT', student: { id: 21, departmentId: 8, year: 2 } }, 'enrollment'),
    { studentId: 21 }
  );

  const mutableResult = getScopeWhere(null, 'department');
  mutableResult.AND.length = 0;
  assert.deepEqual(
    getScopeWhere(null, 'department'),
    DENY_ALL,
    'Each denial must return a fresh filter that cannot be weakened by another caller'
  );

  const mutableEnrollment = getScopeWhere(null, 'enrollment');
  mutableEnrollment.AND.length = 0;
  assert.deepEqual(
    getScopeWhere(null, 'enrollment'),
    DENY_ALL,
    'Each denial for enrollment must return a fresh filter that cannot be weakened by another caller'
  );

  console.log('✓ Strict scope fail-closed checks passed');
}

runStrictScopeSecurityTests();
