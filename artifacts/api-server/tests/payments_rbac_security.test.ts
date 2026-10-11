import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import app from '../src/app';
import prisma from '../src/utils/prismaClient';
import { generateAccessToken } from '../src/utils/jwt.utils';

test('Payments RBAC Security: Table-driven matrix across all 6 roles and unauthenticated', async () => {
  const runSuffix = `pay_rbac_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${address.port}/api`;

  const createdUserIds: number[] = [];
  let testStudentId: number | undefined;

  try {
    // Helper to create test user fixture
    const createTestUser = async (role: any) => {
      const user = await prisma.user.create({
        data: {
          email: `${role.toLowerCase()}_${runSuffix}@university.test`,
          password: 'hashed-password-fixture',
          role,
          isActive: true,
        },
      });
      createdUserIds.push(user.id);
      return user;
    };

    // 1. Create fixtures for each of the 6 roles
    const superAdmin = await createTestUser('SUPER_ADMIN');
    const collegeAdmin = await createTestUser('COLLEGE_ADMIN');
    const deptAdmin = await createTestUser('DEPARTMENT_ADMIN');
    const doctor = await createTestUser('DOCTOR');
    const ta = await createTestUser('TEACHING_ASSISTANT');
    const studentUser = await createTestUser('STUDENT');

    // Create student profile record for the STUDENT role
    const studentRecord = await prisma.student.create({
      data: {
        userId: studentUser.id,
        studentId: `STU_${runSuffix.substring(0, 10)}`,
        firstName: 'Test',
        lastName: 'Student',
        year: 1,
      },
    });
    testStudentId = studentRecord.id;

    // Tokens map
    const tokens: Record<string, string> = {
      SUPER_ADMIN: generateAccessToken(superAdmin.id, 0),
      COLLEGE_ADMIN: generateAccessToken(collegeAdmin.id, 0),
      DEPARTMENT_ADMIN: generateAccessToken(deptAdmin.id, 0),
      DOCTOR: generateAccessToken(doctor.id, 0),
      TA: generateAccessToken(ta.id, 0),
      STUDENT: generateAccessToken(studentUser.id, 0),
    };

    // 2. Define the complete 6-role + unauthenticated matrix
    // Expected statuses derived directly from payments.routes.ts route guards:
    // - GET /api/payments: authorize('SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN')
    // - GET /api/payments/my: authorize('STUDENT') (SUPER_ADMIN bypasses authorize via god-mode, returns 404 in controller due to no Student profile)
    // - POST /api/payments (write endpoint with invalid body {}):
    //     Non-admin roles rejected by authorize() -> 403
    //     Admin roles pass authorize() then rejected by paymentValidation -> 422
    // - Unauthenticated (no token) -> 401
    type MatrixRow = {
      role: 'SUPER_ADMIN' | 'COLLEGE_ADMIN' | 'DEPARTMENT_ADMIN' | 'DOCTOR' | 'TA' | 'STUDENT' | 'UNAUTHENTICATED';
      token: string | null;
      expectedGetList: number;
      expectedGetMy: number;
      expectedPostInvalidWrite: number;
    };

    const matrix: MatrixRow[] = [
      {
        role: 'SUPER_ADMIN',
        token: tokens.SUPER_ADMIN,
        expectedGetList: 200,
        expectedGetMy: 404, // Bypasses authorize('STUDENT'), returns 404 since no student profile exists
        expectedPostInvalidWrite: 422,
      },
      {
        role: 'COLLEGE_ADMIN',
        token: tokens.COLLEGE_ADMIN,
        expectedGetList: 200,
        expectedGetMy: 403,
        expectedPostInvalidWrite: 422,
      },
      {
        role: 'DEPARTMENT_ADMIN',
        token: tokens.DEPARTMENT_ADMIN,
        expectedGetList: 200,
        expectedGetMy: 403,
        expectedPostInvalidWrite: 422,
      },
      {
        role: 'DOCTOR',
        token: tokens.DOCTOR,
        expectedGetList: 403,
        expectedGetMy: 403,
        expectedPostInvalidWrite: 403,
      },
      {
        role: 'TA',
        token: tokens.TA,
        expectedGetList: 403,
        expectedGetMy: 403,
        expectedPostInvalidWrite: 403,
      },
      {
        role: 'STUDENT',
        token: tokens.STUDENT,
        expectedGetList: 403,
        expectedGetMy: 200,
        expectedPostInvalidWrite: 403,
      },
      {
        role: 'UNAUTHENTICATED',
        token: null,
        expectedGetList: 401,
        expectedGetMy: 401,
        expectedPostInvalidWrite: 401,
      },
    ];

    for (const entry of matrix) {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (entry.token) {
        headers.authorization = `Bearer ${entry.token}`;
      }

      // Test 1: GET /api/payments
      const resList = await fetch(`${baseUrl}/payments`, { headers });
      assert.equal(
        resList.status,
        entry.expectedGetList,
        `GET /payments for role ${entry.role} must return ${entry.expectedGetList}, got ${resList.status}`,
      );

      // Test 2: GET /api/payments/my
      const resMy = await fetch(`${baseUrl}/payments/my`, { headers });
      assert.equal(
        resMy.status,
        entry.expectedGetMy,
        `GET /payments/my for role ${entry.role} must return ${entry.expectedGetMy}, got ${resMy.status}`,
      );

      // Test 3: POST /api/payments with empty payload {} (write rejected pre-mutation)
      const resWrite = await fetch(`${baseUrl}/payments`, {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      });
      assert.equal(
        resWrite.status,
        entry.expectedPostInvalidWrite,
        `POST /payments with empty payload for role ${entry.role} must return ${entry.expectedPostInvalidWrite}, got ${resWrite.status}`,
      );
    }
  } finally {
    // Teardown HTTP server
    await new Promise<void>((resolve) => server.close(() => resolve()));

    // Strict teardown in reverse relation order
    if (testStudentId) {
      await prisma.student.deleteMany({ where: { id: testStudentId } }).catch(() => {});
    }
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } }).catch(() => {});
    }
  }
});
