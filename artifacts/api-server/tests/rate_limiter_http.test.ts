import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import app from '../src/app';

test('HTTP Rate Limiter: Real HTTP 429 on credential brute-force and IP/account isolation', async () => {
  const runSuffix = `rl_http_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${address.port}/api`;

  try {
    const victimEmail = `victim_${runSuffix}@university.test`;
    const attackerIp = `198.51.100.${Math.floor(Math.random() * 200) + 10}`;
    const bystanderIp = `203.0.113.${Math.floor(Math.random() * 200) + 10}`;

    const makeLoginRequest = async (ip: string, email: string, password = 'wrong_password_123') => {
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': ip,
        },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => null);
      return { status: res.status, data };
    };

    // 1. Attacker makes 5 consecutive failed login attempts against victimEmail
    for (let i = 1; i <= 5; i++) {
      const res = await makeLoginRequest(attackerIp, victimEmail);
      assert.equal(
        res.status,
        401,
        `Attempt ${i} within 5 allowed attempts should return 401 Invalid credentials, got ${res.status}`,
      );
      assert.equal(res.data?.success, false);
    }

    // 2. Attacker makes 6th attempt from attackerIp against victimEmail -> must return HTTP 429
    const blockedRes = await makeLoginRequest(attackerIp, victimEmail);
    assert.equal(
      blockedRes.status,
      429,
      `6th brute-force attempt from same IP must trigger rate limit and return HTTP 429, got ${blockedRes.status}`,
    );
    assert.equal(blockedRes.data?.success, false);
    assert.ok(
      blockedRes.data?.message?.includes('Too many login attempts'),
      `Expected rate limit message, got: ${blockedRes.data?.message}`,
    );

    // 3. SEC-04 account-lockout isolation: Bystander from different IP targeting same email is NOT blocked
    const bystanderRes = await makeLoginRequest(bystanderIp, victimEmail);
    assert.equal(
      bystanderRes.status,
      401,
      `Bystander from distinct IP must not be locked out by attacker IP exhaustion, got ${bystanderRes.status}`,
    );
    assert.equal(bystanderRes.data?.success, false);

    // 4. Different account from attackerIp is not blocked by single-account bucket (until IP limit)
    const otherEmail = `other_${runSuffix}@university.test`;
    const otherAccountRes = await makeLoginRequest(attackerIp, otherEmail);
    assert.equal(
      otherAccountRes.status,
      401,
      `Different email from attacker IP must not be blocked by victim's account bucket, got ${otherAccountRes.status}`,
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
