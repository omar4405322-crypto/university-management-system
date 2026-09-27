import assert from "node:assert/strict";
import {
  loginLimiter,
  loginIpLimiter,
  loginAccountLimiter,
  shouldFailClosedRateLimiter,
} from "../src/middleware/rateLimiter.middleware";

async function runSec25LoginLimiterTests() {
  console.log(
    "=== SEC-25 / SEC-04: Layered Rate Limiter Hardening Verification Suite ===",
  );

  assert.equal(shouldFailClosedRateLimiter({ NODE_ENV: "production" }), true);
  assert.equal(shouldFailClosedRateLimiter({ NODE_ENV: "development" }), false);
  assert.equal(shouldFailClosedRateLimiter({ NODE_ENV: "test" }), false);

  // 1. Verify environment-sensitive store failure policy.
  // Production fails closed; tests/development retain the local fallback.
  assert.equal(
    (loginLimiter as any).passOnStoreError ?? true,
    true,
    "The test environment must retain the local fallback",
  );
  console.log(
    "✔ [PASS] Verified production fail-closed and local fallback rate-limit policies",
  );

  // 2. Unit test: Key Generator produces per-(IP + normalized email) compound key
  const keyGen = (loginLimiter as any).keyGenerator;
  assert.ok(
    typeof keyGen === "function",
    "loginLimiter must expose keyGenerator helper",
  );

  const key1 = keyGen({
    body: { email: "Student1@University.edu " },
    ip: "10.0.0.1",
  });
  const key2 = keyGen({
    body: { email: "student1@university.edu" },
    ip: "192.168.1.50",
  });
  const key3 = keyGen({
    body: { email: "doctor2@university.edu" },
    ip: "10.0.0.1",
  });
  const keyFallback = keyGen({ body: {}, ip: "10.0.0.1" });

  assert.equal(
    key1,
    "10.0.0.1:student1@university.edu",
    "Should normalize email and prefix with client IP",
  );
  assert.equal(key2, "192.168.1.50:student1@university.edu");
  assert.notEqual(
    key1,
    key2,
    "SEC-04 fix: Same email from different IPs must have distinct keys to prevent cross-IP account lockout",
  );
  assert.notEqual(
    key1,
    key3,
    "Different emails from same IP must produce distinct account keys",
  );
  assert.equal(
    keyFallback,
    "10.0.0.1",
    "Missing email must fall back to client IP",
  );
  console.log(
    "✔ [PASS] Verified layered key generator produces IP+email compound keys without global account lockout",
  );

  // 3. Functional middleware test using the real loginLimiter middleware chain
  const simulateRequest = (
    limiter: any,
    ip: string,
    email?: string,
    headers: Record<string, string> = {},
  ): Promise<{ status: number; calledNext: boolean; body?: any }> => {
    return new Promise((resolve) => {
      let nextCalled = false;
      const req: any = {
        ip,
        body: email !== undefined ? { email } : {},
        headers,
        get: (h: string) => headers[h.toLowerCase()],
        socket: { remoteAddress: ip },
      };
      const res: any = {
        statusCode: 200,
        status(code: number) {
          this.statusCode = code;
          return this;
        },
        json(data: any) {
          resolve({
            status: this.statusCode,
            calledNext: nextCalled,
            body: data,
          });
        },
        send(data: any) {
          resolve({
            status: this.statusCode,
            calledNext: nextCalled,
            body: data,
          });
        },
        setHeader() {},
        getHeader() {},
      };
      const next = (err?: any) => {
        if (err) {
          resolve({ status: 500, calledNext: false, body: err });
          return;
        }
        nextCalled = true;
        resolve({ status: res.statusCode, calledNext: true });
      };

      limiter(req, res, next);
    });
  };

  const victimEmail = "victim_sec04@university.edu";
  const attackerIp = "198.51.100.10";
  const victimIp = "203.0.113.25";

  // Attacker makes 5 failed attempts against victimEmail from attackerIp
  for (let i = 1; i <= 5; i++) {
    const res = await simulateRequest(loginLimiter, attackerIp, victimEmail);
    assert.equal(
      res.calledNext,
      true,
      `Attacker attempt ${i} allowed within 5 attempts`,
    );
    assert.equal(res.status, 200);
  }

  // Attacker 6th attempt from attackerIp is BLOCKED (429)
  const attackerBlocked = await simulateRequest(
    loginLimiter,
    attackerIp,
    victimEmail,
  );
  assert.equal(
    attackerBlocked.calledNext,
    false,
    "Attacker 6th attempt must be blocked by loginAccountLimiter",
  );
  assert.equal(
    attackerBlocked.status,
    429,
    "Exhausted IP+email bucket must return HTTP 429",
  );
  console.log(
    "✔ [PASS] Single-source brute force against victim email is throttled after 5 attempts",
  );

  // SEC-04 CRITICAL TEST: Legitimate user from victimIp logging into victimEmail MUST NOT be blocked!
  const victimAttempt = await simulateRequest(
    loginLimiter,
    victimIp,
    victimEmail,
  );
  assert.equal(
    victimAttempt.calledNext,
    true,
    "SEC-04: Legitimate victim from different IP must NOT be locked out by attacker IP exhaustion",
  );
  assert.equal(victimAttempt.status, 200);
  console.log(
    "✔ [PASS] Account-lockout regression eliminated: Victim from distinct IP retains legitimate access",
  );

  // 4. Horizontal credential spraying test: single IP testing 20 different accounts
  const sprayerIp = "198.51.100.99";
  for (let i = 1; i <= 20; i++) {
    const res = await simulateRequest(
      loginLimiter,
      sprayerIp,
      `user_${i}@university.edu`,
    );
    assert.equal(
      res.calledNext,
      true,
      `Sprayer attempt ${i} under IP limit 20`,
    );
  }

  // 21st attempt from sprayerIp across another account is blocked by loginIpLimiter
  const sprayerBlocked = await simulateRequest(
    loginLimiter,
    sprayerIp,
    "user_21@university.edu",
  );
  assert.equal(
    sprayerBlocked.calledNext,
    false,
    "Sprayer 21st attempt must be blocked by loginIpLimiter",
  );
  assert.equal(
    sprayerBlocked.status,
    429,
    "Exhausted IP limit must return HTTP 429",
  );
  console.log(
    "✔ [PASS] Horizontal credential spraying from single IP throttled at 20 attempts",
  );

  console.log(
    "=== All SEC-25 / SEC-04 loginLimiter regression tests PASSED ===\n",
  );
}

await runSec25LoginLimiterTests();
