import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { assertTestRunnerEnvironment } from '../src/config/testDbGuard';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('assertTestRunnerEnvironment (T-DB-2 fail-closed test guard)', () => {
  it('throws when NODE_TEST_CONTEXT is set and NODE_ENV is unset', () => {
    assert.throws(
      () =>
        assertTestRunnerEnvironment({
          env: { NODE_TEST_CONTEXT: 'test-context-1' },
          argv: ['node', 'index.js'],
          execArgv: [],
        }),
      /Refusing database connection: test runner execution detected but NODE_ENV is not "test"/i
    );
  });

  it('throws when NODE_TEST_CONTEXT is set and NODE_ENV is production', () => {
    assert.throws(
      () =>
        assertTestRunnerEnvironment({
          env: { NODE_TEST_CONTEXT: 'test-context-1', NODE_ENV: 'production' },
          argv: ['node', 'index.js'],
          execArgv: [],
        }),
      /Refusing database connection: test runner execution detected but NODE_ENV is not "test"/i
    );
  });

  it('throws when --test is in execArgv and NODE_ENV is not test', () => {
    assert.throws(
      () =>
        assertTestRunnerEnvironment({
          env: { NODE_ENV: 'development' },
          argv: ['node', 'index.js'],
          execArgv: ['--test'],
        }),
      /Refusing database connection: test runner execution detected but NODE_ENV is not "test"/i
    );
  });

  it('throws when argv contains a script path ending in .test.ts', () => {
    assert.throws(
      () =>
        assertTestRunnerEnvironment({
          env: { NODE_ENV: 'development' },
          argv: ['node', 'artifacts/api-server/tests/my_suite.test.ts'],
          execArgv: [],
        }),
      /Refusing database connection: test runner execution detected but NODE_ENV is not "test"/i
    );

    assert.throws(
      () =>
        assertTestRunnerEnvironment({
          env: { NODE_ENV: 'development' },
          argv: ['node', 'artifacts/university-app/tests/web.test.mjs'],
          execArgv: [],
        }),
      /Refusing database connection: test runner execution detected but NODE_ENV is not "test"/i
    );

    assert.throws(
      () =>
        assertTestRunnerEnvironment({
          env: {},
          argv: ['node', 'sample.test.js'],
          execArgv: [],
        }),
      /Refusing database connection: test runner execution detected but NODE_ENV is not "test"/i
    );
  });

  it('passes when NODE_ENV is test', () => {
    assert.doesNotThrow(() =>
      assertTestRunnerEnvironment({
        env: { NODE_ENV: 'test', NODE_TEST_CONTEXT: 'child-v8' },
        argv: ['node', 'sample.test.ts'],
        execArgv: ['--test'],
      })
    );
  });

  it('passes for plain development or production run without test signals', () => {
    assert.doesNotThrow(() =>
      assertTestRunnerEnvironment({
        env: { NODE_ENV: 'development' },
        argv: ['node', 'src/index.ts'],
        execArgv: [],
      })
    );

    assert.doesNotThrow(() =>
      assertTestRunnerEnvironment({
        env: { NODE_ENV: 'production' },
        argv: ['node', 'dist/index.mjs'],
        execArgv: [],
      })
    );
  });

  it('normalizes NODE_ENV with case and surrounding whitespace', () => {
    assert.doesNotThrow(() =>
      assertTestRunnerEnvironment({
        env: { NODE_ENV: '  TEST  ', NODE_TEST_CONTEXT: 'test-ctx' },
        argv: ['node', 'foo.test.ts'],
        execArgv: ['--test'],
      })
    );

    assert.doesNotThrow(() =>
      assertTestRunnerEnvironment({
        env: { NODE_ENV: 'TeSt\t' },
        argv: ['node', 'foo.test.ts'],
        execArgv: ['--test'],
      })
    );
  });

  it('error message contains none of the env values or secrets', () => {
    const sensitiveEnv = {
      NODE_ENV: 'SUPER_SECRET_ENV_NAME',
      NODE_TEST_CONTEXT: 'SUPER_SECRET_CTX_ID',
      DATABASE_URL: 'postgresql://super_secret_user:super_secret_pass@127.0.0.1:5432/super_secret_db',
    };

    let caughtError: Error | null = null;
    try {
      assertTestRunnerEnvironment({
        env: sensitiveEnv,
        argv: ['node', 'test.test.ts'],
        execArgv: ['--test'],
      });
    } catch (err: any) {
      caughtError = err;
    }

    assert.ok(caughtError, 'Expected an error to be thrown');
    assert.ok(!caughtError.message.includes('SUPER_SECRET_ENV_NAME'));
    assert.ok(!caughtError.message.includes('SUPER_SECRET_CTX_ID'));
    assert.ok(!caughtError.message.includes('super_secret_user'));
    assert.ok(!caughtError.message.includes('super_secret_pass'));
    assert.ok(!caughtError.message.includes('super_secret_db'));
  });

  it('integration: child process importing prismaClient with NODE_TEST_CONTEXT and unset NODE_ENV fails before DB connection', () => {
    const tsxLoaderPath = path.resolve(__dirname, '../node_modules/tsx/dist/loader.mjs');
    const prismaClientPath = path.resolve(__dirname, '../src/utils/prismaClient.ts');

    const result = spawnSync(
      process.execPath,
      ['--import', pathToFileURL(tsxLoaderPath).href, prismaClientPath],
      {
        cwd: path.resolve(__dirname, '..'),
        env: {
          PATH: process.env.PATH,
          NODE_TEST_CONTEXT: 'child-v8',
          DATABASE_URL: 'postgresql://guard_probe@127.0.0.1:9/guard_probe',
          // NODE_ENV explicitly unset
        },
        encoding: 'utf8',
        timeout: 10000,
      }
    );

    assert.notEqual(result.status, 0, `Expected non-zero exit, got ${result.status}`);
    assert.match(
      result.stderr,
      /Refusing database connection: test runner execution detected but NODE_ENV is not "test"/i,
      `Expected guard message in stderr, got:\n${result.stderr}`
    );
  });
});
