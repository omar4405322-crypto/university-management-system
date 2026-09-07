import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import prisma from '../src/utils/prismaClient';
import { login, logout, refresh } from '../src/controllers/auth.controller';
import {
  createRefreshTokenValue,
  generateRefreshToken,
  hashRefreshToken,
  parseRefreshTokenMetadata,
} from '../src/utils/jwt.utils';
import { replacePasswordAndRevokeAllUserSessions } from '../src/services/session.service';

type RefreshRow = {
  id: number;
  token: string;
  familyId?: string;
  userId: number;
  expiresAt: Date;
  createdAt: Date;
};

type InvocationResult = {
  body?: any;
  error?: any;
  statusCode: number;
  cookies: Array<{ name: string; value: string; options: any }>;
  clearedCookies: Array<{ name: string; options: any }>;
};

const user: any = {
  id: 7,
  email: 'victim@example.test',
  password: 'old-hashed-password',
  role: 'STUDENT',
  tokenVersion: 0,
  isActive: true,
  twoFactorEnabled: false,
  twoFactorSecret: null,
  student: null,
  doctor: null,
  managedCollege: null,
};

let rows: RefreshRow[] = [];
let nextId = 1;
let sessionLocks = 0;

const matchesWhere = (row: RefreshRow, where: any): boolean => {
  if (where.id !== undefined && row.id !== where.id) return false;
  if (where.userId !== undefined && row.userId !== where.userId) return false;
  if (where.familyId !== undefined && row.familyId !== where.familyId) return false;
  if (where.expiresAt instanceof Date && row.expiresAt.getTime() !== where.expiresAt.getTime()) {
    return false;
  }
  if (typeof where.token === 'string' && row.token !== where.token) return false;
  if (
    typeof where.token === 'object' &&
    where.token?.startsWith &&
    !row.token.startsWith(where.token.startsWith)
  ) {
    return false;
  }
  return true;
};

const fakeRefreshToken = {
  async findUnique({ where }: any) {
    const row = rows.find((candidate) => candidate.token === where.token);
    return row ? { ...row, user: { ...user } } : null;
  },
  async create({ data }: any) {
    const row: RefreshRow = {
      id: nextId++,
      token: data.token,
      familyId: data.familyId,
      userId: data.userId,
      expiresAt: data.expiresAt,
      createdAt: new Date(),
    };
    rows.push(row);
    return row;
  },
  async deleteMany({ where }: any) {
    const before = rows.length;
    rows = rows.filter((row) => !matchesWhere(row, where));
    return { count: before - rows.length };
  },
  async updateMany({ where, data }: any) {
    let count = 0;
    rows = rows.map((row) => {
      if (!matchesWhere(row, where)) return row;
      count += 1;
      return { ...row, ...data };
    });
    return { count };
  },
};

const fakeUser = {
  async findUnique() {
    return { ...user };
  },
  async update({ where, data }: any) {
    assert.equal(where.id, user.id);
    if (data.password !== undefined) user.password = data.password;
    if (data.tokenVersion?.increment) user.tokenVersion += data.tokenVersion.increment;
    return { ...user };
  },
};

function invoke(handler: any, request: any): Promise<InvocationResult> {
  return new Promise((resolve, reject) => {
    const cookies: InvocationResult['cookies'] = [];
    const clearedCookies: InvocationResult['clearedCookies'] = [];
    let statusCode = 200;
    const response: any = {
      cookie(name: string, value: string, options: any) {
        cookies.push({ name, value, options });
        return response;
      },
      clearCookie(name: string, options: any) {
        clearedCookies.push({ name, options });
        return response;
      },
      status(code: number) {
        statusCode = code;
        return response;
      },
      json(body: any) {
        resolve({ body, statusCode, cookies, clearedCookies });
        return response;
      },
    };

    handler(request, response, (error: any) => {
      resolve({ error, statusCode, cookies, clearedCookies });
    });

    setTimeout(() => reject(new Error('Session controller test timed out')), 2_000);
  });
}

const currentRefreshCookie = (result: InvocationResult): string => {
  const cookie = result.cookies.find(({ name }) => name === 'refresh_token');
  assert.ok(cookie, 'A successful refresh must set its rotated refresh cookie');
  return cookie.value;
};

async function runSessionRevocationSecurityTests() {
  const originalTransaction = (prisma as any).$transaction;
  const originalRefreshCreate = (prisma.refreshToken as any).create;
  const originalRefreshDeleteMany = (prisma.refreshToken as any).deleteMany;
  const originalUserFindUnique = (prisma.user as any).findUnique;

  try {
    (prisma as any).$transaction = async (callback: any) =>
      callback({
        refreshToken: fakeRefreshToken,
        user: fakeUser,
        $queryRaw: async () => {
          sessionLocks += 1;
          return [{ id: user.id }];
        },
      });
    (prisma.refreshToken as any).create = fakeRefreshToken.create;
    (prisma.refreshToken as any).deleteMany = fakeRefreshToken.deleteMany;
    (prisma.user as any).findUnique = fakeUser.findUnique;

    const token = createRefreshTokenValue(user.id, user.tokenVersion);
    const metadata = parseRefreshTokenMetadata(token);
    assert.deepEqual(
      { userId: metadata?.userId, tokenVersion: metadata?.tokenVersion },
      { userId: user.id, tokenVersion: user.tokenVersion },
      'Refresh tokens must carry authenticated user and session-epoch metadata'
    );
    assert.equal(
      parseRefreshTokenMetadata(`${token.slice(0, -1)}${token.endsWith('0') ? '1' : '0'}`),
      null,
      'Tampered refresh-token metadata must fail authentication'
    );

    rows = [];
    const originalToken = await generateRefreshToken(user.id, user.tokenVersion);
    const firstUse = await invoke(refresh, { cookies: { refresh_token: originalToken } });
    assert.equal(firstUse.body?.success, true, 'The original refresh should succeed');
    assert.ok(sessionLocks > 0, 'Refresh rotation must acquire the user session lock');
    const rotatedToken = currentRefreshCookie(firstUse);

    const locksBeforeReplay = sessionLocks;
    const replay = await invoke(refresh, { cookies: { refresh_token: originalToken } });
    assert.equal(replay.body, undefined, 'A consumed token must not receive a response containing tokens');
    assert.equal(replay.error?.statusCode, 401, 'A consumed token replay must be rejected');
    assert.ok(sessionLocks > locksBeforeReplay, 'Replay handling must acquire the same user session lock');
    assert.equal(rows.some((row) => row.token === hashRefreshToken(rotatedToken)), false, 'Replay must revoke its token family');

    rows = [];
    process.env.REQUIRE_2FA = 'false';
    user.password = await bcrypt.hash('CorrectPassword1', 4);
    const loginResult = await invoke(login, {
      body: { email: user.email, password: 'CorrectPassword1' },
    });
    assert.equal(loginResult.body?.success, true, 'Normal password login must remain valid');
    const sequentialToken = currentRefreshCookie(loginResult);
    const sequentialFirst = await invoke(refresh, { cookies: { refresh_token: sequentialToken } });
    const sequentialRotated = currentRefreshCookie(sequentialFirst);
    const sequentialSecond = await invoke(refresh, { cookies: { refresh_token: sequentialRotated } });
    const currentToken = currentRefreshCookie(sequentialSecond);
    assert.equal(sequentialSecond.body?.success, true, 'Sequential single-device rotation must remain valid');

    const versionBeforeLogout = user.tokenVersion;
    const logoutResult = await invoke(logout, { cookies: { refresh_token: currentToken }, user });
    assert.equal(logoutResult.body?.success, true, 'Normal authenticated logout must still succeed');
    assert.equal(rows.length, 0, 'Logout must revoke every refresh session for the user');
    assert.equal(user.tokenVersion, versionBeforeLogout + 1, 'Logout must advance the session epoch');
    assert.equal(logoutResult.clearedCookies[0]?.name, 'refresh_token');

    rows = [];
    const deviceOneToken = await generateRefreshToken(user.id, user.tokenVersion);
    const deviceTwoToken = await generateRefreshToken(user.id, user.tokenVersion);
    const versionBeforePasswordChange = user.tokenVersion;
    await replacePasswordAndRevokeAllUserSessions(user.id, 'new-hashed-password');
    assert.equal(user.password, 'new-hashed-password');
    assert.equal(user.tokenVersion, versionBeforePasswordChange + 1);
    assert.equal(rows.length, 0, 'Password replacement must revoke tokens from every device');

    for (const oldToken of [deviceOneToken, deviceTwoToken]) {
      const oldSession = await invoke(refresh, { cookies: { refresh_token: oldToken } });
      assert.equal(oldSession.error?.statusCode, 401, 'Every pre-password-change token must stay unusable');
    }

    rows = [];
    const staleEpochToken = await generateRefreshToken(user.id, user.tokenVersion);
    user.tokenVersion += 1;
    const staleEpochResult = await invoke(refresh, { cookies: { refresh_token: staleEpochToken } });
    assert.equal(staleEpochResult.error?.statusCode, 401, 'A refresh token from an old epoch must be rejected');
    assert.equal(rows.length, 0, 'An old-epoch token family must be revoked');

    rows = [];
    const legacyToken = 'a'.repeat(80);
    await fakeRefreshToken.create({
      data: {
        token: hashRefreshToken(legacyToken),
        familyId: 'legacy-family',
        userId: user.id,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    const legacyFirstUse = await invoke(refresh, { cookies: { refresh_token: legacyToken } });
    assert.equal(legacyFirstUse.body?.success, true, 'An existing legacy token must rotate once');
    const legacyReplay = await invoke(refresh, { cookies: { refresh_token: legacyToken } });
    assert.equal(legacyReplay.error?.statusCode, 401, 'A rotated legacy token must also be single-use');
    assert.equal(rows.length, 0, 'Legacy-token replay must revoke all surviving user refresh sessions');

    console.log('✓ Session revocation and refresh-token replay security checks passed');
  } finally {
    (prisma as any).$transaction = originalTransaction;
    (prisma.refreshToken as any).create = originalRefreshCreate;
    (prisma.refreshToken as any).deleteMany = originalRefreshDeleteMany;
    (prisma.user as any).findUnique = originalUserFindUnique;
  }
}

runSessionRevocationSecurityTests()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
