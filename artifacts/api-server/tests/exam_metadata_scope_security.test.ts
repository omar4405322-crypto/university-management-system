import assert from 'node:assert/strict';
import prisma from '../src/utils/prismaClient';
import { getExamById } from '../src/controllers/exams.controller';
import { getScopeWhere } from '../src/utils/scope.utils';

const originalFindFirst = prisma.exam.findFirst;

try {
  const roles = [
    { role: 'COLLEGE_ADMIN', managedCollegeId: 2 },
    { role: 'DEPARTMENT_ADMIN', managedDepartmentId: 3 },
    { role: 'DOCTOR', doctor: { id: 4 } },
    { role: 'TEACHING_ASSISTANT', teachingAssistant: { id: 5, departmentId: 6 } },
    { role: 'STUDENT', student: { id: 7, departmentId: 8, year: 2 } },
  ];

  for (const user of roles) {
    let capturedWhere: any;
    (prisma.exam as any).findFirst = async (args: any) => {
      capturedWhere = args.where;
      return { id: 41, course: {}, questions: [] };
    };
    let responseBody: any;
    await (getExamById as any)(
      { params: { id: '41' }, user },
      { json: (body: any) => { responseBody = body; } },
      (error: unknown) => { throw error; }
    );
    assert.deepEqual(capturedWhere, {
      AND: [{ id: 41 }, getScopeWhere(user, 'exam')],
    });
    assert.equal(responseBody.data.id, 41);
  }

  let nextError: any;
  (prisma.exam as any).findFirst = async () => null;
  await (getExamById as any)(
    { params: { id: '99' }, user: roles[2] },
    { json: () => assert.fail('Out-of-scope exam must not be returned') },
    (error: unknown) => { nextError = error; }
  );
  assert.equal(nextError?.statusCode, 404);
} finally {
  (prisma.exam as any).findFirst = originalFindFirst;
}

console.log('✓ Exam metadata uses the complete role-aware exam scope');
