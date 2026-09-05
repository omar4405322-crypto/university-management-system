import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { AppError } from '../src/utils/appError';
import {
  assertPasswordStrength,
  generateStrongTemporaryPassword,
  isPasswordStrong,
  PASSWORD_STRENGTH_MESSAGE,
} from '../src/utils/passwordPolicy';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(testDir, '..');

function runPasswordPolicySeedGuardSecurityTests() {
  for (const weakPassword of [
    undefined,
    '',
    'Short1A',
    'alllowercase1',
    'ALLUPPERCASE1',
    'NoDigitsHere',
  ]) {
    assert.equal(isPasswordStrong(weakPassword), false);
    assert.throws(
      () => assertPasswordStrength(weakPassword),
      (error: unknown) =>
        error instanceof AppError &&
        error.statusCode === 400 &&
        error.message === PASSWORD_STRENGTH_MESSAGE
    );
  }

  assert.equal(isPasswordStrong('StrongPass1'), true);
  for (let index = 0; index < 25; index += 1) {
    assert.equal(isPasswordStrong(generateStrongTemporaryPassword()), true);
  }

  const controllerExpectations: Array<[string, number]> = [
    ['src/controllers/auth.controller.ts', 1],
    ['src/controllers/doctors.controller.ts', 2],
    ['src/controllers/teachingAssistants.controller.ts', 2],
    ['src/controllers/students.controller.ts', 2],
    ['src/controllers/user.controller.ts', 3],
  ];
  for (const [relativePath, minimumCalls] of controllerExpectations) {
    const source = readFileSync(path.join(apiRoot, relativePath), 'utf8');
    const calls = source.match(/assertPasswordStrength\(/g)?.length ?? 0;
    assert.ok(
      calls >= minimumCalls,
      `${relativePath} must enforce the shared rule on every create/reset path`
    );
    assert.doesNotMatch(source, /Password must be at least 6 characters/);
  }

  for (const relativePath of [
    'src/validations/auth.validation.ts',
    'src/validations/admin.validation.ts',
    'src/validations/academic.validation.ts',
  ]) {
    const source = readFileSync(path.join(apiRoot, relativePath), 'utf8');
    assert.match(source, /passwordStrengthValidator/);
  }

  for (const relativePath of [
    'prisma/seed.cjs',
    'prisma/seed.ts',
    'prisma/seed-timetable.ts',
  ]) {
    const source = readFileSync(path.join(apiRoot, relativePath), 'utf8');
    const guardIndex = source.indexOf("NODE_ENV?.trim().toLowerCase() === 'production'");
    const clientIndex = source.indexOf('new PrismaClient()');
    assert.ok(guardIndex >= 0, `${relativePath} must contain a production guard`);
    assert.ok(
      clientIndex >= 0 && guardIndex < clientIndex,
      `${relativePath} must refuse production before constructing a database client`
    );
  }
}

runPasswordPolicySeedGuardSecurityTests();
console.log('Password policy and seed guard security checks passed');
