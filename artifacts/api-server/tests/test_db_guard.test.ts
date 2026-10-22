import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assertTestDatabase } from '../src/config/testDbGuard';

describe('Test Database Safety Guard (T-DB-1)', () => {
  const SENSITIVE_PASSWORD = 'TestSuperSecretPassword987!';
  const DUMMY_DEV_URL = `postgresql://test_user:${SENSITIVE_PASSWORD}@localhost:5432/university?schema=public`;

  it('1. Throws when TEST_DATABASE_URL is missing or empty in test environment', () => {
    assert.throws(
      () => assertTestDatabase({ NODE_ENV: 'test' }),
      (err: Error) => {
        assert.match(err.message, /TEST_DATABASE_URL/i);
        assert.equal(err.message.includes(SENSITIVE_PASSWORD), false);
        assert.equal(err.message.includes('postgresql://'), false);
        return true;
      }
    );

    assert.throws(
      () => assertTestDatabase({ NODE_ENV: 'test', TEST_DATABASE_URL: '   ' }),
      (err: Error) => {
        assert.match(err.message, /TEST_DATABASE_URL/i);
        return true;
      }
    );

    assert.throws(
      () =>
        assertTestDatabase({
          NODE_ENV: 'test',
          DATABASE_URL: `postgresql://test_user:${SENSITIVE_PASSWORD}@localhost:5433/unicore_test?schema=public`,
        }),
      (err: Error) => {
        assert.match(err.message, /TEST_DATABASE_URL/i);
        return true;
      }
    );
  });

  it('2. Throws when TEST_DATABASE_URL equals a pre-set dev DATABASE_URL with non-test db name', () => {
    assert.throws(
      () =>
        assertTestDatabase({
          NODE_ENV: 'test',
          DATABASE_URL: DUMMY_DEV_URL,
          TEST_DATABASE_URL: DUMMY_DEV_URL,
        }),
      (err: Error) => {
        assert.match(err.message, /development|separate|dev DATABASE_URL/i);
        assert.equal(err.message.includes(SENSITIVE_PASSWORD), false);
        assert.equal(err.message.includes('postgresql://'), false);
        return true;
      }
    );
  });

  it('2b. Permits when DATABASE_URL equals TEST_DATABASE_URL with a valid test db name', () => {
    const validTestUrl = `postgresql://test_user:${SENSITIVE_PASSWORD}@localhost:5433/unicore_test?schema=public`;
    const res = assertTestDatabase({
      NODE_ENV: 'test',
      DATABASE_URL: validTestUrl,
      TEST_DATABASE_URL: validTestUrl,
    });
    assert.equal(res.databaseName, 'unicore_test');
    assert.equal(res.isLocal, true);
  });

  it('2c. Throws when DATABASE_URL is set but differs from TEST_DATABASE_URL in test environment', () => {
    const validTestUrl = `postgresql://test_user:${SENSITIVE_PASSWORD}@127.0.0.1:1/unicore_test?schema=public`;
    const differentDbUrl = `postgresql://test_user:${SENSITIVE_PASSWORD}@127.0.0.1:1/university?schema=public`;

    assert.throws(
      () =>
        assertTestDatabase({
          NODE_ENV: 'test',
          DATABASE_URL: differentDbUrl,
          TEST_DATABASE_URL: validTestUrl,
        }),
      (err: Error) => {
        assert.match(err.message, /DATABASE_URL.*TEST_DATABASE_URL|differs|separate/i);
        assert.equal(err.message.includes(SENSITIVE_PASSWORD), false, 'Error must not include password');
        assert.equal(err.message.includes('test_user'), false, 'Error must not include username');
        assert.equal(err.message.includes('postgresql://'), false, 'Error must not include full URL');
        return true;
      }
    );
  });

  it('3. Throws when database name is disallowed or does not match test pattern (university, neondb, postgres, dev)', () => {
    const disallowedNames = ['university', 'neondb', 'postgres', 'production', 'dev_university', 'mydb'];

    for (const dbName of disallowedNames) {
      const url = `postgresql://test_user:${SENSITIVE_PASSWORD}@localhost:5433/${dbName}?schema=public`;
      assert.throws(
        () =>
          assertTestDatabase({
            NODE_ENV: 'test',
            TEST_DATABASE_URL: url,
          }),
        (err: Error) => {
          assert.match(err.message, /database name/i);
          assert.equal(err.message.includes(SENSITIVE_PASSWORD), false);
          assert.equal(err.message.includes('postgresql://'), false);
          return true;
        },
        `Expected failure for disallowed/non-test database name: ${dbName}`
      );
    }
  });

  it('4. Throws for remote host when CI is false or undefined', () => {
    const remoteUrl = `postgresql://test_user:${SENSITIVE_PASSWORD}@remote-db.railway.internal:5432/unicore_test?schema=public`;

    assert.throws(
      () =>
        assertTestDatabase({
          NODE_ENV: 'test',
          TEST_DATABASE_URL: remoteUrl,
          CI: 'false',
        }),
      (err: Error) => {
        assert.match(err.message, /local host|local interface|CI/i);
        assert.equal(err.message.includes(SENSITIVE_PASSWORD), false);
        assert.equal(err.message.includes('postgresql://'), false);
        return true;
      }
    );

    assert.throws(
      () =>
        assertTestDatabase({
          NODE_ENV: 'test',
          TEST_DATABASE_URL: remoteUrl,
        }),
      (err: Error) => {
        assert.match(err.message, /local host|local interface|CI/i);
        return true;
      }
    );
  });

  it('5. Permits remote host when CI=true and database name matches *_test pattern', () => {
    const remoteTestUrl = `postgresql://test_user:${SENSITIVE_PASSWORD}@remote-db.railway.internal:5432/unicore_test?schema=public`;

    const result = assertTestDatabase({
      NODE_ENV: 'test',
      TEST_DATABASE_URL: remoteTestUrl,
      CI: 'true',
    });

    assert.equal(result.databaseName, 'unicore_test');
    assert.equal(result.isLocal, false);
    assert.equal(result.isCI, true);
  });

  it('6. Permits valid local hosts (localhost, 127.0.0.1, [::1]) with valid test names (_test, test_*)', () => {
    const localCases = [
      { url: `postgresql://test_user:${SENSITIVE_PASSWORD}@localhost:5433/unicore_test?schema=public`, expectedDb: 'unicore_test' },
      { url: `postgresql://test_user:${SENSITIVE_PASSWORD}@127.0.0.1:5433/test_app?schema=public`, expectedDb: 'test_app' },
      { url: `postgresql://test_user:${SENSITIVE_PASSWORD}@[::1]:5433/university_management_test?schema=public`, expectedDb: 'university_management_test' },
    ];

    for (const { url, expectedDb } of localCases) {
      const result = assertTestDatabase({
        NODE_ENV: 'test',
        TEST_DATABASE_URL: url,
        CI: 'false',
      });
      assert.equal(result.databaseName, expectedDb);
      assert.equal(result.isLocal, true);
    }
  });

  it('7. When NODE_ENV is not test, does not enforce test-only naming restrictions', () => {
    const devUrl = `postgresql://dev_user:${SENSITIVE_PASSWORD}@localhost:5432/university?schema=public`;
    const result = assertTestDatabase({
      NODE_ENV: 'development',
      DATABASE_URL: devUrl,
    });
    assert.equal(result.databaseName, 'university');
    assert.equal(result.isTestEnv, false);
  });

  it('8. Guarantees error messages never contain raw password, credentials, or full connection URLs', () => {
    const badUrls = [
      `postgresql://leaked_user:${SENSITIVE_PASSWORD}@evil-host.com:5432/university?schema=public`,
      `postgresql://leaked_user:${SENSITIVE_PASSWORD}@localhost:5432/postgres?schema=public`,
      `postgresql://leaked_user:${SENSITIVE_PASSWORD}@localhost:5432/not_a_test_db?schema=public`,
    ];

    for (const url of badUrls) {
      try {
        assertTestDatabase({
          NODE_ENV: 'test',
          TEST_DATABASE_URL: url,
        });
        assert.fail('Expected assertTestDatabase to throw');
      } catch (err: any) {
        assert.equal(err.message.includes(SENSITIVE_PASSWORD), false, 'Error message must not include password');
        assert.equal(err.message.includes('leaked_user'), false, 'Error message must not include username');
        assert.equal(err.message.includes('postgresql://'), false, 'Error message must not include full URL');
      }
    }
  });
});
