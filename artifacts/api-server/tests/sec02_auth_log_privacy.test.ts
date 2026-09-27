import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pseudonymizeEmail, logAuthEvent, AUTH_EVENT } from '../src/utils/authLog.utils.js';
import logger from '../src/utils/logger.js';

describe('SEC-002: Authentication Log Privacy', () => {
  it('pseudonymizes email addresses into stable opaque hashes without exposing domain or localpart', () => {
    const email1 = 'student.john.doe@university.edu';
    const email2 = 'STUDENT.JOHN.DOE@university.edu';
    const email3 = 'attacker@malicious.com';

    const ref1 = pseudonymizeEmail(email1);
    const ref2 = pseudonymizeEmail(email2);
    const ref3 = pseudonymizeEmail(email3);

    // Opaque prefix + hex hash
    assert.match(ref1, /^usr_[0-9a-f]{16}$/);
    assert.equal(ref1, ref2, 'Email normalization must ensure case insensitivity in hash');
    assert.notEqual(ref1, ref3, 'Different emails must produce different account refs');

    // Never contain original components
    assert.ok(!ref1.includes('student'));
    assert.ok(!ref1.includes('john'));
    assert.ok(!ref1.includes('university.edu'));
  });

  it('safely handles empty or missing email inputs', () => {
    assert.equal(pseudonymizeEmail(undefined), 'usr_anonymous');
    assert.equal(pseudonymizeEmail(''), 'usr_anonymous');
    assert.equal(pseudonymizeEmail('   '), 'usr_anonymous');
  });

  it('scrubs sensitive credentials from logged event contexts', () => {
    const captured: string[] = [];
    const originalInfo = logger.info;
    const originalWarn = logger.warn;

    try {
      logger.info = ((msg: string, meta?: any) => {
        captured.push(JSON.stringify({ msg, meta }));
      }) as any;
      logger.warn = ((msg: string, meta?: any) => {
        captured.push(JSON.stringify({ msg, meta }));
      }) as any;

      // 1. Login success with scrubbed context
      logAuthEvent(AUTH_EVENT.LOGIN_SUCCESS, {
        accountRef: pseudonymizeEmail('admin@university.edu'),
        userId: 'usr-12345',
        password: 'SuperSecretPassword123!',
        token: 'ey.secret.jwt',
        refreshToken: 'rt-secret-value',
        cookie: 'sessionId=abc',
        authorization: 'Bearer secret',
      });

      // 2. Login failure
      logAuthEvent(AUTH_EVENT.LOGIN_FAILURE, {
        accountRef: pseudonymizeEmail('victim@university.edu'),
        reason: 'PASSWORD_MISMATCH',
        password: 'AttemptedPassword',
      });

      // 3. MFA failure
      logAuthEvent(AUTH_EVENT.MFA_FAILURE, {
        accountRef: pseudonymizeEmail('prof@university.edu'),
        userId: 'usr-999',
        reason: 'INVALID_TOTP',
        totpToken: '123456',
        secret: 'base32secret',
      });

      // 4. Refresh rejected
      logAuthEvent(AUTH_EVENT.REFRESH_REJECTED, {
        reason: 'TOKEN_FAMILY_REVOKED',
        token: 'rt-revoked-token',
      });

      // 5. Session revoked
      logAuthEvent(AUTH_EVENT.SESSION_REVOKED, {
        userId: 'usr-12345',
        reason: 'LOGOUT_ALL',
      });

      const combinedLogs = captured.join('\n');

      // Assert zero leaks of sensitive fields
      assert.ok(!combinedLogs.includes('SuperSecretPassword123!'), 'Plaintext password must not be logged');
      assert.ok(!combinedLogs.includes('AttemptedPassword'), 'Attempted password must not be logged');
      assert.ok(!combinedLogs.includes('ey.secret.jwt'), 'JWT must not be logged');
      assert.ok(!combinedLogs.includes('rt-secret-value'), 'Refresh token must not be logged');
      assert.ok(!combinedLogs.includes('123456'), 'TOTP token must not be logged');
      assert.ok(!combinedLogs.includes('base32secret'), 'TOTP secret must not be logged');
      assert.ok(!combinedLogs.includes('admin@university.edu'), 'Raw email must not be logged');
      assert.ok(!combinedLogs.includes('victim@university.edu'), 'Raw email must not be logged');
      assert.ok(!combinedLogs.includes('prof@university.edu'), 'Raw email must not be logged');

      // Assert required event markers are present
      assert.ok(combinedLogs.includes('AUTH_LOGIN_SUCCESS'));
      assert.ok(combinedLogs.includes('AUTH_LOGIN_FAILURE'));
      assert.ok(combinedLogs.includes('AUTH_MFA_FAILURE'));
      assert.ok(combinedLogs.includes('AUTH_REFRESH_REJECTED'));
      assert.ok(combinedLogs.includes('AUTH_SESSION_REVOKED'));
      assert.ok(combinedLogs.includes('PASSWORD_MISMATCH'));
      assert.ok(combinedLogs.includes('INVALID_TOTP'));
      assert.ok(combinedLogs.includes('TOKEN_FAMILY_REVOKED'));
    } finally {
      logger.info = originalInfo;
      logger.warn = originalWarn;
    }
  });
});
