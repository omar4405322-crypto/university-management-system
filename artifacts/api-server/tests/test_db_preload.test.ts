import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../..');
const preloadArg = './scripts/test-preload.mjs';

const SENSITIVE_PASSWORD = 'PreloadSecretPass987!';
const VALID_TEST_URL = `postgresql://test_user:${SENSITIVE_PASSWORD}@localhost:5433/unicore_test?schema=public`;
const DEV_URL = `postgresql://dev_user:${SENSITIVE_PASSWORD}@localhost:5432/university_dev?schema=public`;
const DISALLOWED_TEST_URL = `postgresql://test_user:${SENSITIVE_PASSWORD}@localhost:5433/university?schema=public`;

const trivialScript = 'console.log(process.env.DATABASE_URL || "");\n';

function runPreloadChild(env: Record<string, string | undefined>) {
  const childEnv: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined && k !== 'DATABASE_URL' && k !== 'TEST_DATABASE_URL' && k !== 'CI') {
      childEnv[k] = v;
    }
  }
  for (const [k, v] of Object.entries(env)) {
    if (v !== undefined) {
      childEnv[k] = v;
    } else {
      delete childEnv[k];
    }
  }

  return spawnSync(
    process.execPath,
    ['--import', preloadArg, '-'],
    {
      cwd: rootDir,
      input: trivialScript,
      env: childEnv,
      encoding: 'utf8',
      timeout: 10000,
    }
  );
}

describe('Test Database Preload Isolation Guard (test-preload.mjs)', () => {
  it('(a) only TEST set -> exit 0 and child sees TEST_DATABASE_URL', () => {
    const res = runPreloadChild({
      NODE_ENV: 'test',
      TEST_DATABASE_URL: VALID_TEST_URL,
    });
    assert.equal(res.status, 0, `Expected exit 0, got ${res.status}. stderr: ${res.stderr}`);
    assert.equal(res.stdout.trim(), VALID_TEST_URL);
    assert.equal(res.stderr.includes(SENSITIVE_PASSWORD), false);
  });

  it('(b) DATABASE_URL = TEST (same, valid name) -> exit 0 and child sees TEST_DATABASE_URL', () => {
    const res = runPreloadChild({
      NODE_ENV: 'test',
      DATABASE_URL: VALID_TEST_URL,
      TEST_DATABASE_URL: VALID_TEST_URL,
    });
    assert.equal(res.status, 0, `Expected exit 0, got ${res.status}. stderr: ${res.stderr}`);
    assert.equal(res.stdout.trim(), VALID_TEST_URL);
    assert.equal(res.stderr.includes(SENSITIVE_PASSWORD), false);
  });

  it('(c) DATABASE_URL = a different dev-looking URL -> exit 0 and child sees the TEST value', () => {
    const res = runPreloadChild({
      NODE_ENV: 'test',
      DATABASE_URL: DEV_URL,
      TEST_DATABASE_URL: VALID_TEST_URL,
    });
    assert.equal(res.status, 0, `Expected exit 0, got ${res.status}. stderr: ${res.stderr}`);
    assert.equal(res.stdout.trim(), VALID_TEST_URL, 'Pre-set DATABASE_URL must be overridden by TEST_DATABASE_URL');
    assert.equal(res.stderr.includes(SENSITIVE_PASSWORD), false);
  });

  it('(d) TEST missing -> non-zero exit code', () => {
    const res1 = runPreloadChild({
      NODE_ENV: 'test',
      TEST_DATABASE_URL: '',
    });
    assert.notEqual(res1.status, 0, 'Expected non-zero exit when TEST_DATABASE_URL is missing');
    assert.equal(res1.stderr.includes(SENSITIVE_PASSWORD), false);

    const res2 = runPreloadChild({
      NODE_ENV: 'test',
      DATABASE_URL: VALID_TEST_URL,
      TEST_DATABASE_URL: '',
    });
    assert.notEqual(res2.status, 0, 'Expected non-zero exit when TEST_DATABASE_URL is missing even if DATABASE_URL is set');
    assert.equal(res2.stderr.includes(SENSITIVE_PASSWORD), false);
  });

  it('(e) TEST with db name "university" -> non-zero exit code', () => {
    const res = runPreloadChild({
      NODE_ENV: 'test',
      TEST_DATABASE_URL: DISALLOWED_TEST_URL,
    });
    assert.notEqual(res.status, 0, 'Expected non-zero exit when TEST_DATABASE_URL uses disallowed db name "university"');
    assert.equal(res.stderr.includes(SENSITIVE_PASSWORD), false);
  });

  it('(f) stderr never contains the password across all failure cases', () => {
    const failureConfigs = [
      { TEST_DATABASE_URL: DISALLOWED_TEST_URL },
      { TEST_DATABASE_URL: `postgresql://user:${SENSITIVE_PASSWORD}@remote-db.railway.internal:5432/unicore_test?schema=public`, CI: 'false' },
      { TEST_DATABASE_URL: `postgresql://user:${SENSITIVE_PASSWORD}@localhost:5433/production?schema=public` },
      { TEST_DATABASE_URL: `postgresql://user:${SENSITIVE_PASSWORD}@localhost:5433/dev_db?schema=public` },
    ];

    for (const cfg of failureConfigs) {
      const res = runPreloadChild({
        NODE_ENV: 'test',
        ...cfg,
      });
      assert.notEqual(res.status, 0, 'Expected non-zero exit for invalid config');
      assert.equal(
        res.stderr.includes(SENSITIVE_PASSWORD),
        false,
        `stderr must never leak database password. Found in stderr: ${res.stderr}`
      );
    }
  });
});

describe('Permanent Seed Isolation Safety Tests (seed.test-baseline.cjs)', () => {
  const seedPath = path.resolve(rootDir, 'artifacts/api-server/prisma/seed.test-baseline.cjs');
  const SENSITIVE_USER = 'seed_guard_user';
  const SENSITIVE_PASS = 'SeedGuardSecretPass123!';
  const UNREACHABLE_DEV_URL = `postgresql://${SENSITIVE_USER}:${SENSITIVE_PASS}@127.0.0.1:1/university?schema=public`;
  const UNREACHABLE_VALID_TEST_URL = `postgresql://${SENSITIVE_USER}:${SENSITIVE_PASS}@127.0.0.1:1/unicore_test?schema=public`;

  function runSeedChild(env: Record<string, string | undefined>) {
    const childEnv: Record<string, string> = {};
    for (const [k, v] of Object.entries(process.env)) {
      if (v !== undefined && k !== 'DATABASE_URL' && k !== 'TEST_DATABASE_URL' && k !== 'CI') {
        childEnv[k] = v;
      }
    }
    for (const [k, v] of Object.entries(env)) {
      if (v !== undefined) {
        childEnv[k] = v;
      } else {
        delete childEnv[k];
      }
    }

    return spawnSync(
      process.execPath,
      [seedPath],
      {
        cwd: rootDir,
        env: childEnv,
        encoding: 'utf8',
        timeout: 10000,
      }
    );
  }

  it('A: db name "university" -> non-zero exit, stderr contains "Refusing", no credentials/protocol leak, no P1001', () => {
    const res = runSeedChild({
      NODE_ENV: 'test',
      DATABASE_URL: UNREACHABLE_DEV_URL,
      TEST_DATABASE_URL: UNREACHABLE_DEV_URL,
    });
    assert.notEqual(res.status, 0, 'Expected non-zero exit code when seed targets disallowed db name "university"');
    assert.ok(res.stderr.includes('Refusing'), `stderr must contain "Refusing", got:\n${res.stderr}`);
    assert.ok(!res.stderr.includes(SENSITIVE_PASS), 'stderr must not leak database password');
    assert.ok(!res.stderr.includes(SENSITIVE_USER), 'stderr must not leak database username');
    assert.ok(!res.stderr.includes('postgresql://'), 'stderr must not leak connection protocol "postgresql://"');
    assert.ok(!res.stderr.includes("Can't reach database"), 'Guard must fail closed before Prisma reaches database connection');
    assert.ok(!res.stderr.includes('P1001'), 'Guard must fail closed before Prisma error code P1001 is thrown');
  });

  it('B: positive control with valid name unicore_test -> stderr does NOT contain "Refusing"', () => {
    const res = runSeedChild({
      NODE_ENV: 'test',
      DATABASE_URL: UNREACHABLE_VALID_TEST_URL,
      TEST_DATABASE_URL: UNREACHABLE_VALID_TEST_URL,
    });
    assert.ok(!res.stderr.includes('Refusing'), `stderr must NOT contain "Refusing" for valid test db, got:\n${res.stderr}`);
  });

  it('C: TEST_DATABASE_URL missing -> non-zero exit and stderr contains "Refusing"', () => {
    const res = runSeedChild({
      NODE_ENV: 'test',
      DATABASE_URL: '',
      TEST_DATABASE_URL: '',
    });
    assert.notEqual(res.status, 0, 'Expected non-zero exit code when TEST_DATABASE_URL is missing');
    assert.ok(res.stderr.includes('Refusing'), `stderr must contain "Refusing", got:\n${res.stderr}`);
  });
});

