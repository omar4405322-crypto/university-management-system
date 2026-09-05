import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import prisma from '../src/utils/prismaClient';
import { login, register } from '../src/controllers/auth.controller';

interface InvocationResult {
  statusCode: number;
  body?: any;
  error?: any;
}

async function invoke(controller: any, body: Record<string, unknown>) {
  return new Promise<InvocationResult>((resolve, reject) => {
    const result: InvocationResult = { statusCode: 200 };
    const response = {
      status(code: number) {
        result.statusCode = code;
        return response;
      },
      json(payload: unknown) {
        result.body = payload;
        resolve(result);
        return response;
      },
      cookie() {
        return response;
      },
    };
    Promise.resolve(
      controller(
        { body, cookies: {}, ip: '127.0.0.1', socket: {} },
        response,
        (error?: unknown) => {
          result.error = error;
          resolve(result);
        }
      )
    ).catch(reject);
  });
}

async function runAuthStateUniformitySecurityTests() {
  const originalUserFindUnique = prisma.user.findUnique;
  const originalStudentFindUnique = prisma.student.findUnique;
  const originalRequestFindUnique = prisma.registrationRequest.findUnique;
  const originalRequestCreate = prisma.registrationRequest.create;
  const originalHash = bcrypt.hash;
  const originalCompare = bcrypt.compare;

  let userRecord: any = null;
  let studentRecord: any = null;
  let requestRecord: any = null;
  let hashCalls = 0;
  let compareCalls = 0;
  let passwordMatches = false;
  let creates = 0;

  try {
    (prisma.user as any).findUnique = async () => userRecord;
    (prisma.student as any).findUnique = async () => studentRecord;
    (prisma.registrationRequest as any).findUnique = async () => requestRecord;
    (prisma.registrationRequest as any).create = async () => {
      creates += 1;
      return {
        id: 99,
        departmentId: null,
        role: 'STUDENT',
        firstName: 'Test',
        lastName: 'Student',
      };
    };
    (bcrypt as any).hash = async () => {
      hashCalls += 1;
      return 'hashed-password';
    };
    (bcrypt as any).compare = async () => {
      compareCalls += 1;
      return passwordMatches;
    };

    const registrationBody = {
      email: 'state@example.test',
      password: 'Password123!',
      firstName: 'Test',
      lastName: 'Student',
      studentId: 'S-1',
    };
    const registrationResults: InvocationResult[] = [];
    for (const state of [
      { user: { id: 1 }, student: null, request: null },
      { user: null, student: { id: 2 }, request: null },
      { user: null, student: null, request: { id: 3, status: 'PENDING' } },
      { user: null, student: null, request: { id: 4, status: 'REJECTED' } },
      { user: null, student: null, request: null },
    ]) {
      userRecord = state.user;
      studentRecord = state.student;
      requestRecord = state.request;
      registrationResults.push(await invoke(register, registrationBody));
    }

    const registrationProjection = registrationResults.map(result => ({
      statusCode: result.statusCode,
      body: result.body,
      error: result.error,
    }));
    assert.equal(hashCalls, registrationResults.length);
    assert.equal(creates, 1);
    for (const result of registrationProjection) {
      assert.deepEqual(result, registrationProjection[0]);
    }
    assert.equal(registrationProjection[0].statusCode, 202);
    assert.equal(registrationProjection[0].body.success, true);
    assert.equal('data' in registrationProjection[0].body, false);

    const loginResults: InvocationResult[] = [];
    for (const state of [
      { user: null, request: null, matches: false },
      { user: null, request: { status: 'PENDING' }, matches: false },
      { user: null, request: { status: 'REJECTED' }, matches: false },
      {
        user: { password: 'hash', isActive: false },
        request: null,
        matches: true,
      },
      {
        user: { password: 'hash', isActive: true },
        request: null,
        matches: false,
      },
    ]) {
      userRecord = state.user;
      requestRecord = state.request;
      passwordMatches = state.matches;
      loginResults.push(
        await invoke(login, {
          email: 'state@example.test',
          password: 'Password123!',
        })
      );
    }

    assert.equal(compareCalls, loginResults.length);
    for (const result of loginResults) {
      assert.equal(result.error?.statusCode, 401);
      assert.equal(result.error?.message, 'Invalid email or password');
      assert.equal(result.body, undefined);
    }
  } finally {
    (prisma.user as any).findUnique = originalUserFindUnique;
    (prisma.student as any).findUnique = originalStudentFindUnique;
    (prisma.registrationRequest as any).findUnique = originalRequestFindUnique;
    (prisma.registrationRequest as any).create = originalRequestCreate;
    (bcrypt as any).hash = originalHash;
    (bcrypt as any).compare = originalCompare;
  }
}

await runAuthStateUniformitySecurityTests();
console.log('Authentication state uniformity security checks passed');
