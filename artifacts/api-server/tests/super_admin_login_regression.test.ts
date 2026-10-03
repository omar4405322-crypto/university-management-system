import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import prisma from '../src/utils/prismaClient';
import { login } from '../src/controllers/auth.controller';
import { AuthenticationError } from '../src/utils/appError';

function invokeLogin(email: string, password: string): Promise<any> {
  return new Promise((resolve, reject) => {
    let statusCode = 200;
    const cookies: string[] = [];
    const response: any = {
      status(code: number) {
        statusCode = code;
        return response;
      },
      cookie(name: string) {
        cookies.push(name);
        return response;
      },
      json(body: unknown) {
        resolve({ statusCode, body, cookies });
        return response;
      },
    };
    const request: any = { body: { email, password }, cookies: {}, headers: {}, socket: {} };
    Promise.resolve(
      login(request, response, (error?: unknown) => resolve({ statusCode, error, cookies }))
    ).catch(reject);
  });
}

describe('SuperAdmin login regression', () => {
  const originalRequire2FA = process.env.REQUIRE_2FA;
  const originalJwtSecret = process.env.JWT_SECRET;
  const originalUserFindUnique = prisma.user.findUnique;
  const originalRegistrationFindUnique = prisma.registrationRequest.findUnique;
  const originalRefreshCreate = prisma.refreshToken.create;

  before(() => {
    process.env.REQUIRE_2FA = 'false';
    process.env.JWT_SECRET = 'super-admin-login-regression-secret-1234567890';
  });

  after(() => {
    if (originalRequire2FA === undefined) delete process.env.REQUIRE_2FA;
    else process.env.REQUIRE_2FA = originalRequire2FA;
    if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalJwtSecret;
    (prisma.user as any).findUnique = originalUserFindUnique;
    (prisma.registrationRequest as any).findUnique = originalRegistrationFindUnique;
    (prisma.refreshToken as any).create = originalRefreshCreate;
  });

  it('issues tokens for an active SUPER_ADMIN with the correct bcrypt password', async () => {
    const password = 'RestoredAdmin123!';
    const passwordHash = await bcrypt.hash(password, 4);
    (prisma.registrationRequest as any).findUnique = async () => null;
    (prisma.user as any).findUnique = async () => ({
      id: 193,
      email: 'superadmin@university.com',
      password: passwordHash,
      role: 'SUPER_ADMIN',
      adminRole: null,
      isActive: true,
      tokenVersion: 2,
      twoFactorEnabled: false,
      twoFactorSecret: null,
      student: null,
      doctor: null,
      managedCollege: null,
      managedCollegeId: null,
    });
    (prisma.refreshToken as any).create = async () => ({});

    const result = await invokeLogin('SUPERADMIN@UNIVERSITY.COM', password);

    assert.equal(result.statusCode, 200);
    assert.equal(result.body.success, true);
    assert.equal(result.body.data.user.role, 'SUPER_ADMIN');
    assert.equal(typeof result.body.data.accessToken, 'string');
    assert.ok(result.cookies.includes('refresh_token'));
  });

  it('preserves login behavior for scoped admins, Doctor, TA, and Student roles', async () => {
    const password = 'ExistingRole123!';
    const passwordHash = await bcrypt.hash(password, 4);
    const roles = [
      'COLLEGE_ADMIN',
      'DEPARTMENT_ADMIN',
      'DOCTOR',
      'TEACHING_ASSISTANT',
      'STUDENT',
    ];

    for (const [index, role] of roles.entries()) {
      (prisma.user as any).findUnique = async () => ({
        id: 300 + index,
        email: `${role.toLowerCase()}@university.test`,
        password: passwordHash,
        role,
        adminRole: null,
        isActive: true,
        tokenVersion: 0,
        twoFactorEnabled: false,
        twoFactorSecret: null,
        student: null,
        doctor: null,
        managedCollege: null,
        managedCollegeId: role === 'COLLEGE_ADMIN' ? 1 : null,
      });

      const result = await invokeLogin(`${role.toLowerCase()}@university.test`, password);
      assert.equal(result.statusCode, 200, `${role} should still log in`);
      assert.equal(result.body.data.user.role, role);
      assert.equal(typeof result.body.data.accessToken, 'string');
    }
  });

  it('keeps a wrong SuperAdmin password behind the generic authentication error', async () => {
    (prisma.user as any).findUnique = async () => ({
      id: 193,
      email: 'superadmin@university.com',
      password: await bcrypt.hash('CorrectAdmin123!', 4),
      role: 'SUPER_ADMIN',
      isActive: true,
      tokenVersion: 0,
      twoFactorEnabled: false,
      twoFactorSecret: null,
      student: null,
      doctor: null,
      managedCollege: null,
      managedCollegeId: null,
    });
    const result = await invokeLogin('superadmin@university.com', 'WrongPassword123!');

    assert.ok(result.error instanceof AuthenticationError);
    assert.equal(result.error.statusCode, 401);
    assert.equal(result.error.message, 'Invalid email or password');
    assert.equal(result.cookies.length, 0);
  });
});
