import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import speakeasy from 'speakeasy';
import prisma from '../src/utils/prismaClient';
import { login } from '../src/controllers/auth.controller';
import { disable2FA } from '../src/controllers/user.controller';
import { AuthenticationError, AuthorizationError } from '../src/utils/appError';
import { encrypt } from '../src/utils/encryption.utils';
import { isMandatory2FARole, MANDATORY_2FA_ROLES } from '../src/utils/twoFactorConfig';

interface InvocationResult {
  statusCode: number;
  body?: any;
  error?: any;
  cookies: Array<{ name: string; val: unknown; options?: unknown }>;
}

async function invokeController(
  controller: any,
  req: {
    body?: Record<string, unknown>;
    user?: Record<string, unknown>;
    cookies?: Record<string, string>;
    headers?: Record<string, string>;
    ip?: string;
  }
): Promise<InvocationResult> {
  return new Promise<InvocationResult>((resolve, reject) => {
    const result: InvocationResult = {
      statusCode: 200,
      cookies: [],
    };
    const response: any = {
      status(code: number) {
        result.statusCode = code;
        return response;
      },
      json(payload: unknown) {
        result.body = payload;
        resolve(result);
        return response;
      },
      cookie(name: string, val: unknown, options?: unknown) {
        result.cookies.push({ name, val, options });
        return response;
      },
    };
    const request = {
      body: req.body || {},
      user: req.user,
      cookies: req.cookies || {},
      headers: req.headers || {},
      ip: req.ip || '127.0.0.1',
      socket: {},
      get: (header: string) => req.headers?.[header.toLowerCase()],
    };
    Promise.resolve(
      controller(request, response, (error?: unknown) => {
        result.error = error;
        resolve(result);
      })
    ).catch(reject);
  });
}

describe('AUTH-001 Mandatory 2FA Regression Suite', () => {
  const originalEnvRequire2FA = process.env.REQUIRE_2FA;
  const originalJwtSecret = process.env.JWT_SECRET;
  const originalEncryptionKey = process.env.ENCRYPTION_KEY;

  const originalUserFindUnique = prisma.user.findUnique;
  const originalUserUpdate = prisma.user.update;
  const originalRegReqFindUnique = prisma.registrationRequest.findUnique;
  const originalRefreshTokenCreate = prisma.refreshToken.create;
  const originalTransaction = prisma.$transaction;
  const originalCompare = bcrypt.compare;

  before(() => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-with-sufficient-length-1234567890';
    process.env.ENCRYPTION_KEY =
      process.env.ENCRYPTION_KEY || '9cf47d854120aa8b156fca5d30380dff669751b910f127c98b6a02886755c572';
  });

  after(() => {
    if (originalEnvRequire2FA === undefined) {
      delete process.env.REQUIRE_2FA;
    } else {
      process.env.REQUIRE_2FA = originalEnvRequire2FA;
    }

    if (originalJwtSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalJwtSecret;
    }

    if (originalEncryptionKey === undefined) {
      delete process.env.ENCRYPTION_KEY;
    } else {
      process.env.ENCRYPTION_KEY = originalEncryptionKey;
    }
  });

  beforeEach(() => {
    process.env.REQUIRE_2FA = 'true';
    (prisma.registrationRequest as any).findUnique = async () => null;
    (prisma.refreshToken as any).create = async () => ({});
  });

  afterEach(() => {
    (prisma.user as any).findUnique = originalUserFindUnique;
    (prisma.user as any).update = originalUserUpdate;
    (prisma.registrationRequest as any).findUnique = originalRegReqFindUnique;
    (prisma.refreshToken as any).create = originalRefreshTokenCreate;
    (prisma as any).$transaction = originalTransaction;
    (bcrypt as any).compare = originalCompare;
  });

  it('1. Mandatory-2FA user with twoFactorEnabled=false receives requiresTwoFactorSetup=true and NO tokens or cookies under REQUIRE_2FA', async () => {
    assert.ok(MANDATORY_2FA_ROLES.includes('SUPER_ADMIN'));

    for (const mandatoryRole of MANDATORY_2FA_ROLES) {
      const mockUser = {
        id: 101,
        email: `${mandatoryRole.toLowerCase()}@university.test`,
        password: '$2b$10$hashedpasswordstringforauth001test',
        role: mandatoryRole,
        twoFactorEnabled: false,
        twoFactorSecret: null,
        isActive: true,
        tokenVersion: 1,
        student: null,
        doctor: null,
        managedCollege: null,
      };

      (prisma.user as any).findUnique = async () => mockUser;
      (bcrypt as any).compare = async () => true;

      const res = await invokeController(login, {
        body: { email: mockUser.email, password: 'Password123!' },
      });

      assert.equal(res.statusCode, 200, `Expected 200 for ${mandatoryRole}`);
      assert.equal(res.body?.success, true);
      assert.equal(
        res.body?.requiresTwoFactorSetup,
        true,
        `Expected requiresTwoFactorSetup=true for role ${mandatoryRole}`
      );
      assert.match(
        res.body?.message || '',
        /Two-factor authentication is mandatory for your role/i
      );

      // Verify zero tokens leaked in body or cookies
      assert.equal(res.body?.data, undefined, 'Access token / user data must not be returned');
      assert.equal(
        res.cookies.length,
        0,
        'No refresh cookies must be set when 2FA setup is required'
      );
      assert.equal(res.error, undefined);
    }
  });

  it('2. Mandatory-2FA user with twoFactorEnabled=true still undergoes normal TOTP challenge flow', async () => {
    const secret = speakeasy.generateSecret({ length: 20 }).base32;
    const encryptedSecret = encrypt(secret);

    const mockAdminUser = {
      id: 202,
      email: 'superadmin.totp@university.test',
      password: '$2b$10$hashedpasswordstringforauth001test',
      role: 'SUPER_ADMIN',
      twoFactorEnabled: true,
      twoFactorSecret: encryptedSecret,
      isActive: true,
      tokenVersion: 1,
      student: null,
      doctor: null,
      managedCollege: null,
    };

    (prisma.user as any).findUnique = async () => mockAdminUser;
    (bcrypt as any).compare = async () => true;

    // 2a. Prompt when totpToken is missing
    const promptRes = await invokeController(login, {
      body: { email: mockAdminUser.email, password: 'Password123!' },
    });
    assert.equal(promptRes.statusCode, 200);
    assert.equal(promptRes.body?.success, true);
    assert.equal(promptRes.body?.requires2FA, true);
    assert.equal(promptRes.body?.requiresTwoFactorSetup, undefined);
    assert.equal(promptRes.body?.data, undefined);
    assert.equal(promptRes.cookies.length, 0);

    // 2b. Rejection on invalid totpToken
    const invalidRes = await invokeController(login, {
      body: { email: mockAdminUser.email, password: 'Password123!', totpToken: '000000' },
    });
    assert.ok(
      invalidRes.error instanceof AuthenticationError,
      'Invalid TOTP must reject with AuthenticationError'
    );
    assert.equal(invalidRes.error.statusCode, 401);
    assert.equal(invalidRes.cookies.length, 0);

    // 2c. Successful completion with valid totpToken
    const validTotp = speakeasy.totp({
      secret,
      encoding: 'base32',
    });

    const successRes = await invokeController(login, {
      body: { email: mockAdminUser.email, password: 'Password123!', totpToken: validTotp },
    });
    assert.equal(successRes.statusCode, 200);
    assert.equal(successRes.body?.success, true);
    assert.equal(typeof successRes.body?.data?.accessToken, 'string');
    assert.equal(successRes.body?.data?.user?.role, 'SUPER_ADMIN');
    assert.ok(
      successRes.cookies.some((c) => c.name === 'refresh_token'),
      'Must set refresh_token cookie on successful 2FA login'
    );
  });

  it('3. Mandatory-2FA user attempting disable2FA while REQUIRE_2FA is enforced gets rejected (403)', async () => {
    let updateCalled = false;
    (prisma.user as any).update = async () => {
      updateCalled = true;
      return {};
    };

    for (const mandatoryRole of MANDATORY_2FA_ROLES) {
      updateCalled = false;
      const res = await invokeController(disable2FA, {
        user: { id: 303, role: mandatoryRole },
        body: { token: '123456', password: 'Password123!' },
      });

      assert.ok(
        res.error instanceof AuthorizationError,
        `Expected AuthorizationError for ${mandatoryRole}`
      );
      assert.equal(res.error.statusCode, 403);
      assert.match(
        res.error.message,
        /Two-factor authentication is mandatory for your role and cannot be disabled/
      );
      assert.equal(updateCalled, false, 'prisma.user.update must never be called');
    }

    // Defense-in-depth: Even if req.user.role was not populated, DB lookup guard enforces 403
    updateCalled = false;
    (prisma.user as any).findUnique = async () => ({
      id: 304,
      role: 'SUPER_ADMIN',
      twoFactorEnabled: true,
      twoFactorSecret: encrypt('TESTSECRET20CHARS12'),
      password: '$2b$10$hashed',
    });

    const dbGuardRes = await invokeController(disable2FA, {
      user: { id: 304 }, // role omitted on req.user
      body: { token: '123456', password: 'Password123!' },
    });

    assert.ok(
      dbGuardRes.error instanceof AuthorizationError,
      'DB lookup fallback must enforce 403 for mandatory roles'
    );
    assert.equal(dbGuardRes.error.statusCode, 403);
    assert.equal(updateCalled, false);
  });

  it('4. Non-mandatory roles (STUDENT, DOCTOR, TEACHING_ASSISTANT) are unaffected by mandatory-2FA restrictions', async () => {
    const nonMandatoryRoles = ['STUDENT', 'DOCTOR', 'TEACHING_ASSISTANT'];
    for (const role of nonMandatoryRoles) {
      assert.equal(
        isMandatory2FARole(role),
        false,
        `${role} must be confirmed as non-mandatory role`
      );
    }

    // 4a. Non-mandatory role login with twoFactorEnabled=false logs in directly without setup prompt
    const mockDoctor = {
      id: 401,
      email: 'doctor@university.test',
      password: '$2b$10$hashedpasswordstringforauth001test',
      role: 'DOCTOR',
      twoFactorEnabled: false,
      twoFactorSecret: null,
      isActive: true,
      tokenVersion: 1,
      student: null,
      doctor: { id: 1, firstName: 'Jane', lastName: 'Doc' },
      managedCollege: null,
    };

    (prisma.user as any).findUnique = async () => mockDoctor;
    (bcrypt as any).compare = async () => true;

    const doctorLoginRes = await invokeController(login, {
      body: { email: mockDoctor.email, password: 'Password123!' },
    });

    assert.equal(doctorLoginRes.statusCode, 200);
    assert.equal(doctorLoginRes.body?.success, true);
    assert.equal(
      doctorLoginRes.body?.requiresTwoFactorSetup,
      undefined,
      'Non-mandatory role must not receive requiresTwoFactorSetup'
    );
    assert.equal(typeof doctorLoginRes.body?.data?.accessToken, 'string');
    assert.ok(doctorLoginRes.cookies.some((c) => c.name === 'refresh_token'));

    // 4b. Non-mandatory role can disable 2FA with valid password and TOTP token
    const docSecret = speakeasy.generateSecret({ length: 20 }).base32;
    const docEncryptedSecret = encrypt(docSecret);
    let doctorUpdated = false;

    (prisma.user as any).findUnique = async () => ({
      id: 401,
      email: 'doctor@university.test',
      role: 'DOCTOR',
      password: '$2b$10$hashedpasswordstringforauth001test',
      twoFactorEnabled: true,
      twoFactorSecret: docEncryptedSecret,
    });
    (prisma.user as any).update = async () => {
      doctorUpdated = true;
      return {};
    };
    (prisma as any).auditLog = { create: async () => ({}) };
    (prisma as any).$transaction = async (cb: any) =>
      cb({
        user: prisma.user,
        auditLog: { create: async () => ({}) },
      });

    const validDoctorTotp = speakeasy.totp({
      secret: docSecret,
      encoding: 'base32',
    });

    const disableRes = await invokeController(disable2FA, {
      user: { id: 401, role: 'DOCTOR' },
      body: { token: validDoctorTotp, password: 'Password123!' },
    });

    assert.equal(disableRes.error, undefined);
    assert.equal(disableRes.statusCode, 200);
    assert.equal(disableRes.body?.success, true);
    assert.equal(disableRes.body?.message, '2FA disabled successfully');
    assert.equal(doctorUpdated, true, 'Non-mandatory role must successfully disable 2FA');
  });
});
