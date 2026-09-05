import assert from 'node:assert/strict';
import prisma from '../src/utils/prismaClient';
import { getRequests } from '../src/controllers/auth.controller';

type SelectShape = Record<string, true | { select: SelectShape }>;

function applySelect(record: Record<string, any> | null, select: SelectShape): Record<string, any> | null {
  if (record === null) return null;

  return Object.fromEntries(
    Object.entries(select).map(([key, selection]) => {
      if (selection === true) return [key, record[key]];
      return [key, applySelect(record[key], selection.select)];
    })
  );
}

async function invokeGetRequests(user: Record<string, any>, query: Record<string, any> = {}) {
  let responseBody: any;

  await new Promise<void>((resolve, reject) => {
    getRequests(
      { user, query } as any,
      {
        json: (body: any) => {
          responseBody = body;
          resolve();
        },
      } as any,
      (error?: unknown) => (error ? reject(error) : resolve())
    );
  });

  return responseBody;
}

async function runRegistrationRequestSecurityTests() {
  console.log('--- Starting Registration Request Security Verification Suite ---');

  const originalFindMany = prisma.registrationRequest.findMany.bind(prisma.registrationRequest);
  const capturedQueries: any[] = [];
  const storedRequest = {
    id: 91,
    email: 'pending@example.test',
    password: '$2b$10$SEC05-regression-hash',
    futureSensitiveField: 'must-not-leak',
    role: 'STUDENT',
    firstName: 'Pending',
    lastName: 'Student',
    studentId: 'S-91',
    year: 1,
    phone: '+20-100-000-0091',
    departmentId: 3,
    status: 'PENDING',
    rejectionReason: null,
    createdAt: new Date('2026-09-03T00:00:00.000Z'),
    department: {
      id: 3,
      name: 'Computer Science',
      nameAr: 'علوم الحاسب',
      collegeId: 1,
      createdAt: new Date('2025-01-01T00:00:00.000Z'),
      college: {
        id: 1,
        name: 'Engineering',
        nameAr: 'الهندسة',
        description: 'Engineering college',
        descriptionAr: 'كلية الهندسة',
        createdAt: new Date('2025-01-01T00:00:00.000Z'),
      },
    },
  };

  try {
    (prisma.registrationRequest.findMany as any) = async (args: { select?: SelectShape }) => {
      capturedQueries.push(args);
      assert.ok(args.select, 'Registration requests must use an explicit Prisma select');
      return [applySelect(storedRequest, args.select)];
    };

    const response = await invokeGetRequests({ role: 'SUPER_ADMIN' });
    const request = response.data[0];
    const select = capturedQueries[0].select;

    assert.equal(
      Object.hasOwn(select, 'password'),
      false,
      'The database projection must never read RegistrationRequest.password'
    );
    assert.equal(
      Object.hasOwn(request, 'password'),
      false,
      'The API response must never expose the stored password hash'
    );
    assert.equal(
      Object.hasOwn(request, 'futureSensitiveField'),
      false,
      'Unlisted future model fields must not enter the response automatically'
    );
    assert.deepEqual(Object.keys(request).sort(), [
      'createdAt',
      'department',
      'departmentId',
      'email',
      'firstName',
      'id',
      'lastName',
      'phone',
      'rejectionReason',
      'role',
      'status',
      'studentId',
      'year',
    ]);
    assert.equal(request.department.college.name, 'Engineering');

    await invokeGetRequests(
      { role: 'COLLEGE_ADMIN', managedCollegeId: 1 },
      { status: 'PENDING' }
    );
    assert.deepEqual(capturedQueries[1].where, {
      status: 'PENDING',
      department: { collegeId: 1 },
    });

    await invokeGetRequests({ role: 'DEPARTMENT_ADMIN', managedDepartmentId: 3 });
    assert.deepEqual(capturedQueries[2].where, { departmentId: 3 });

    console.log('✓ Registration request password disclosure checks passed');
  } finally {
    (prisma.registrationRequest.findMany as any) = originalFindMany;
    await prisma.$disconnect();
  }
}

runRegistrationRequestSecurityTests().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
