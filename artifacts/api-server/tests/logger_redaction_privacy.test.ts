import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { redactSensitiveFormat } from '../src/utils/logger';

describe('SEC-LOGGER: Winston Logger Sensitive Redaction', () => {
  it('redacts Set-Cookie headers in various casings and hyphens', () => {
    const formatter = redactSensitiveFormat();

    // 1. Pascal-Kebab Case 'Set-Cookie'
    const info1 = {
      level: 'info',
      message: 'HTTP response headers',
      'Set-Cookie': 'refreshToken=super_secret_cookie_token; Path=/; HttpOnly',
    };
    const result1: any = formatter.transform(info1, {});
    assert.equal(result1['Set-Cookie'], '[REDACTED]', 'Set-Cookie must be redacted');

    // 2. Lowercase 'set-cookie'
    const info2 = {
      level: 'info',
      message: 'HTTP headers',
      'set-cookie': 'refreshToken=another_secret; HttpOnly',
    };
    const result2: any = formatter.transform(info2, {});
    assert.equal(result2['set-cookie'], '[REDACTED]', 'set-cookie must be redacted');

    // 3. Lowercase concatenated 'setcookie'
    const info3 = {
      level: 'info',
      message: 'Processed cookie context',
      setcookie: 'some_sensitive_cookie',
    };
    const result3: any = formatter.transform(info3, {});
    assert.equal(result3.setcookie, '[REDACTED]', 'setcookie must be redacted');
  });

  it('redacts standard authorization and cookie keys', () => {
    const formatter = redactSensitiveFormat();
    const info = {
      level: 'info',
      message: 'Request auth',
      authorization: 'Bearer secret_token_123',
      cookie: 'sessionId=secret_session',
      password: 'mypassword',
    };
    const result: any = formatter.transform(info, {});
    assert.equal(result.authorization, '[REDACTED]');
    assert.equal(result.cookie, '[REDACTED]');
    assert.equal(result.password, '[REDACTED]');
  });
});
