import assert from 'node:assert/strict';
import prisma from '../src/utils/prismaClient';
import { getAllStudents } from '../src/controllers/students.controller';

async function invokeController(controller: any, request: Record<string, unknown>) {
  return new Promise<any>((resolve, reject) => {
    const response: any = {
      status: (code: number) => {
        response.statusCode = code;
        return response;
      },
      json: (body: unknown) => resolve({ statusCode: response.statusCode || 200, body }),
    };
    controller(request, response, (error?: unknown) => reject(error));
  });
}

async function runStudentSearchRegressionTests() {
  const originalFindMany = prisma.student.findMany;
  const originalCount = prisma.student.count;
  const originalRequestCount = prisma.registrationRequest.count;

  const capturedQueries: any[] = [];

  const mockStudents = [
    {
      id: 101,
      studentId: 'STU-2026-001',
      firstName: 'Alice',
      lastName: 'Johnson',
      departmentId: 10,
      gender: 'FEMALE',
      year: 2,
      isActive: true,
      user: {
        email: 'alice.johnson@university.test',
        profilePicture: null,
        isActive: true,
      },
      department: {
        id: 10,
        name: 'Computer Science',
        nameAr: 'علوم الحاسب',
        college: { id: 1, name: 'Faculty of Engineering', nameAr: 'كلية الهندسة' },
      },
      group: null,
    },
    {
      id: 102,
      studentId: 'STU-2026-002',
      firstName: 'Bob',
      lastName: 'Smith',
      departmentId: 20,
      gender: 'MALE',
      year: 3,
      isActive: true,
      user: {
        email: 'bob.smith@med.test',
        profilePicture: null,
        isActive: true,
      },
      department: {
        id: 20,
        name: 'Surgery',
        nameAr: 'جراحة',
        college: { id: 2, name: 'Faculty of Medicine', nameAr: 'كلية الطب' },
      },
      group: null,
    },
  ];

  try {
    (prisma.student as any).count = async () => 2;
    (prisma.registrationRequest as any).count = async () => 0;

    (prisma.student as any).findMany = async (args: any) => {
      capturedQueries.push(args);

      // Verify that Prisma never receives nationalId
      const whereStr = JSON.stringify(args?.where || {});
      if (whereStr.includes('nationalId')) {
        throw new Error('PrismaClientValidationError: Unknown field `nationalId` on Student model');
      }

      // Filter in-memory for realistic end-to-end evaluation
      const andClauses = args?.where?.AND || [];
      const searchClause = andClauses.find((c: any) => Array.isArray(c.OR));
      const scopeClause = andClauses.find((c: any) => c.department?.collegeId !== undefined);

      let filtered = [...mockStudents];

      if (scopeClause) {
        filtered = filtered.filter(s => s.department.college.id === scopeClause.department.collegeId);
      }

      if (searchClause) {
        filtered = filtered.filter(s => {
          return searchClause.OR.some((cond: any) => {
            if (cond.firstName?.contains) {
              return s.firstName.toLowerCase().includes(cond.firstName.contains.toLowerCase());
            }
            if (cond.lastName?.contains) {
              return s.lastName.toLowerCase().includes(cond.lastName.contains.toLowerCase());
            }
            if (cond.studentId?.contains) {
              return s.studentId.toLowerCase().includes(cond.studentId.contains.toLowerCase());
            }
            if (cond.user?.email?.contains) {
              return s.user.email.toLowerCase().includes(cond.user.email.contains.toLowerCase());
            }
            return false;
          });
        });
      }

      return filtered;
    };

    const actorSuperAdmin = { role: 'SUPER_ADMIN' };

    // 1. Search by firstName works
    const resFirstName = await invokeController(getAllStudents, {
      user: actorSuperAdmin,
      query: { search: 'Alice' },
    });
    assert.equal(resFirstName.statusCode, 200);
    assert.equal(resFirstName.body.success, true);
    assert.equal(resFirstName.body.data.students.length, 1);
    assert.equal(resFirstName.body.data.students[0].firstName, 'Alice');

    // 2. Search by lastName works
    const resLastName = await invokeController(getAllStudents, {
      user: actorSuperAdmin,
      query: { search: 'Smith' },
    });
    assert.equal(resLastName.statusCode, 200);
    assert.equal(resLastName.body.success, true);
    assert.equal(resLastName.body.data.students.length, 1);
    assert.equal(resLastName.body.data.students[0].lastName, 'Smith');

    // 3. Search by studentId works
    const resStudentId = await invokeController(getAllStudents, {
      user: actorSuperAdmin,
      query: { search: 'STU-2026-001' },
    });
    assert.equal(resStudentId.statusCode, 200);
    assert.equal(resStudentId.body.success, true);
    assert.equal(resStudentId.body.data.students.length, 1);
    assert.equal(resStudentId.body.data.students[0].studentId, 'STU-2026-001');

    // 4. Search by email works
    const resEmail = await invokeController(getAllStudents, {
      user: actorSuperAdmin,
      query: { search: 'bob.smith@med.test' },
    });
    assert.equal(resEmail.statusCode, 200);
    assert.equal(resEmail.body.success, true);
    assert.equal(resEmail.body.data.students.length, 1);
    assert.equal(resEmail.body.data.students[0].user.email, 'bob.smith@med.test');

    // 5. Search with no matches returns valid empty result instead of throwing 500
    const resNoMatch = await invokeController(getAllStudents, {
      user: actorSuperAdmin,
      query: { search: 'nonexistent-student-query' },
    });
    assert.equal(resNoMatch.statusCode, 200);
    assert.equal(resNoMatch.body.success, true);
    assert.deepEqual(resNoMatch.body.data.students, []);
    assert.equal(resNoMatch.body.data.pagination.page, 1);

    // 6. Authorization / tenant scope still applies to search results
    // College 1 Admin searching for 'Smith' (who belongs to College 2)
    const actorCollege1Admin = { role: 'COLLEGE_ADMIN', managedCollegeId: 1 };
    const resScopedBlocked = await invokeController(getAllStudents, {
      user: actorCollege1Admin,
      query: { search: 'Smith' },
    });
    assert.equal(resScopedBlocked.statusCode, 200);
    assert.equal(resScopedBlocked.body.data.students.length, 0, 'Cross-college search must return no matches');

    // College 1 Admin searching for 'Alice' (who belongs to College 1)
    const resScopedAllowed = await invokeController(getAllStudents, {
      user: actorCollege1Admin,
      query: { search: 'Alice' },
    });
    assert.equal(resScopedAllowed.statusCode, 200);
    assert.equal(resScopedAllowed.body.data.students.length, 1);
    assert.equal(resScopedAllowed.body.data.students[0].firstName, 'Alice');

    // 7. Verify no nationalId was ever queried across all executions
    for (const q of capturedQueries) {
      assert.equal(
        JSON.stringify(q.where).includes('nationalId'),
        false,
        'nationalId must never appear in where query'
      );
    }

    console.log('✓ All student search regression tests passed');
  } finally {
    (prisma.student as any).findMany = originalFindMany;
    (prisma.student as any).count = originalCount;
    (prisma.registrationRequest as any).count = originalRequestCount;
  }
}

await runStudentSearchRegressionTests();
