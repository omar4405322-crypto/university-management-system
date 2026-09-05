import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import speakeasy from 'speakeasy';
import prisma from '../src/utils/prismaClient';
import { setup2FA } from '../src/controllers/user.controller';
import { AuthenticationError } from '../src/utils/appError';
import { RedisOperationError } from '../src/utils/redis.utils';
import {
  claimTotpCounter,
  verifyTOTP,
} from '../src/utils/twoFactor.utils';
import { getTwoFactorConfigError } from '../src/utils/twoFactorConfig';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(testDir, '..');

async function invoke(controller: any, request: Record<string, unknown>) {
  return new Promise<any>((resolve, reject) => {
    const response = {
      json: (body: unknown) => resolve({ body }),
      status: () => response,
    };
    Promise.resolve(
      controller(request, response, (error?: unknown) => resolve({ error }))
    ).catch(reject);
  });
}

async function runTwoFactorSecurityTests() {
  const secret = speakeasy.generateSecret({ length: 20 }).base32;
  const nowSeconds = Math.floor(Date.now() / 1000);
  const currentToken = speakeasy.totp({
    secret,
    encoding: 'base32',
    time: nowSeconds,
  });
  const previousToken = speakeasy.totp({
    secret,
    encoding: 'base32',
    time: nowSeconds - 30,
  });

  assert.equal(await verifyTOTP(secret, currentToken, 910_001), true);
  assert.equal(
    await verifyTOTP(secret, currentToken, 910_001),
    false,
    'The same counter must be accepted only once per user'
  );
  assert.equal(
    await verifyTOTP(secret, previousToken, 910_001),
    false,
    'An older adjacent-window counter must not be accepted after a newer one'
  );
  assert.equal(
    await verifyTOTP(secret, currentToken, 910_002),
    true,
    'Replay state must be isolated per user'
  );

  let evalArgs: unknown[] = [];
  assert.equal(
    await claimTotpCounter(5, 100, {
      eval: async (...args: unknown[]) => {
        evalArgs = args;
        return 1;
      },
    } as any),
    true
  );
  assert.match(String(evalArgs[0]), /previous.*>=/s);
  assert.deepEqual(evalArgs.slice(1), [
    1,
    'auth:totp:last-counter:5:current',
    '100',
    '300',
  ]);
  assert.equal(
    await claimTotpCounter(5, 100, { eval: async () => 0 } as any),
    false
  );

  assert.equal(
    await verifyTOTP(secret, currentToken, 910_001 + 10),
    true
  );
  const replacementSecret = speakeasy.generateSecret({ length: 20 }).base32;
  const replacementToken = speakeasy.totp({
    secret: replacementSecret,
    encoding: 'base32',
    time: nowSeconds,
  });
  assert.equal(
    await verifyTOTP(replacementSecret, replacementToken, 910_001 + 10),
    true,
    'Replacing a secret must not inherit the prior secret counter'
  );
  await assert.rejects(
    claimTotpCounter(5, 100, {
      eval: async () => {
        throw new Error('redis down');
      },
    } as any),
    (error: unknown) =>
      error instanceof RedisOperationError && error.statusCode === 503
  );

  assert.match(
    getTwoFactorConfigError(' production ', ' FALSE ') || '',
    /forbidden/
  );
  assert.equal(getTwoFactorConfigError('development', 'false'), null);
  assert.equal(getTwoFactorConfigError('production', undefined), null);

  const originalUserFindUnique = prisma.user.findUnique;
  const originalUserUpdate = prisma.user.update;
  const originalCompare = bcrypt.compare;
  let updateCalled = false;
  try {
    (prisma.user as any).findUnique = async () => ({
      id: 5,
      email: 'user@example.test',
      password: 'hash',
      twoFactorEnabled: false,
    });
    (prisma.user as any).update = async () => {
      updateCalled = true;
      return {};
    };
    (bcrypt as any).compare = async () => false;

    const result = await invoke(setup2FA, {
      user: { id: 5 },
      body: { currentPassword: 'wrong' },
    });
    assert.ok(result.error instanceof AuthenticationError);
    assert.equal(updateCalled, false, 'A secret must not be stored without password confirmation');
  } finally {
    (prisma.user as any).findUnique = originalUserFindUnique;
    (prisma.user as any).update = originalUserUpdate;
    (bcrypt as any).compare = originalCompare;
  }

  const routes = readFileSync(path.join(apiRoot, 'src/routes/users.routes.ts'), 'utf8');
  assert.match(routes, /\/2fa\/setup[\s\S]*currentPassword/);
  assert.match(routes, /\/2fa\/enable[\s\S]*currentPassword/);

  for (const entryPoint of ['src/index.ts', 'src/server.ts']) {
    const source = readFileSync(path.join(apiRoot, entryPoint), 'utf8');
    assert.match(source, /getTwoFactorConfigError/);
    assert.match(source, /process\.exit\(1\)/);
  }
}

await runTwoFactorSecurityTests();
console.log('Two-factor security checks passed');
