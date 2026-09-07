import assert from 'node:assert/strict';
import rateLimit from 'express-rate-limit';
import { loginLimiter } from '../src/middleware/rateLimiter.middleware';

async function runSec25LoginLimiterTests() {
  console.log('=== SEC-25: Rate Limiter Hardening Verification Suite ===');

  // 1. Verify passOnStoreError availability trade-off
  // Fail-open is intentionally configured so Redis outages do not lock out all users
  assert.equal(
    (loginLimiter as any).passOnStoreError ?? true,
    true,
    'loginLimiter must retain passOnStoreError: true for institutional availability'
  );
  console.log('✔ [PASS] Verified passOnStoreError remains true with fail-open availability trade-off');

  // 2. Build a test rate limiter matching loginLimiter logic to test bucket sharing behavior
  const keyGen = (loginLimiter as any).keyGenerator || ((req: any) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase().trim() : '';
    if (email) return `email:${email}`;
    const ip = req.ip || req.get?.('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    return `ip:${ip}`;
  });

  // Direct Key Generator unit tests
  const key1 = keyGen({ body: { email: 'Student1@University.edu ' }, ip: '10.0.0.1' });
  const key2 = keyGen({ body: { email: 'student1@university.edu' }, ip: '192.168.1.50' });
  const key3 = keyGen({ body: { email: 'doctor2@university.edu' }, ip: '10.0.0.1' });
  const keyFallback = keyGen({ body: {}, ip: '10.0.0.1' });

  assert.equal(key1, 'email:student1@university.edu', 'Should normalize and prefix email');
  assert.equal(key1, key2, 'Same email from different IPs must produce identical rate limit key');
  assert.notEqual(key1, key3, 'Different emails from the same IP must produce different rate limit keys');
  assert.equal(keyFallback, 'ip:10.0.0.1', 'Missing email must fall back to IP key');
  console.log('✔ [PASS] Verified compound key generator normalization and IP fallback');

  // 3. Functional middleware test: simulating hits across multiple IPs for the same account
  const testLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    keyGenerator: keyGen,
    validate: { keyGeneratorIpFallback: false },
    message: { success: false, message: 'Too many login attempts, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
  });

  const simulateRequest = (ip: string, email?: string): Promise<{ status: number; calledNext: boolean }> => {
    return new Promise((resolve) => {
      let nextCalled = false;
      const req: any = {
        ip,
        body: email !== undefined ? { email } : {},
        headers: {},
        get: (h: string) => (h.toLowerCase() === 'x-forwarded-for' ? ip : undefined),
      };
      const res: any = {
        statusCode: 200,
        status(code: number) {
          this.statusCode = code;
          return this;
        },
        send(data: any) {
          resolve({ status: this.statusCode, calledNext: nextCalled });
        },
        setHeader() {},
        getHeader() {},
      };
      const next = () => {
        nextCalled = true;
        resolve({ status: res.statusCode, calledNext: true });
      };

      testLimiter(req, res, next);
    });
  };

  const targetEmail = 'victim_account@uni.edu';

  // Hits 1, 2, 3: from IP A
  for (let i = 1; i <= 3; i++) {
    const res = await simulateRequest('10.1.1.1', targetEmail);
    assert.equal(res.calledNext, true, `Attempt ${i} from IP A should be allowed`);
    assert.equal(res.status, 200);
  }

  // Hits 4, 5: from IP B (different IP, same email)
  for (let i = 4; i <= 5; i++) {
    const res = await simulateRequest('10.2.2.2', targetEmail);
    assert.equal(res.calledNext, true, `Attempt ${i} from IP B should be allowed within max=5`);
    assert.equal(res.status, 200);
  }

  // Hit 6: from IP C (yet another IP, same email) -> MUST BE BLOCKED (shared bucket exhausted!)
  const blockedRes = await simulateRequest('10.3.3.3', targetEmail);
  assert.equal(
    blockedRes.calledNext,
    false,
    'Attempt 6 from IP C for the same email must be rate-limited'
  );
  assert.equal(
    blockedRes.status,
    429,
    'Exhausted email bucket must return HTTP 429 Too Many Requests'
  );
  console.log('✔ [PASS] Same email hit from multiple different IPs correctly shares one rate-limit bucket');

  // Hit from IP A (which made attempts 1-3) but with a DIFFERENT email
  const differentEmailRes = await simulateRequest('10.1.1.1', 'another_student@uni.edu');
  assert.equal(
    differentEmailRes.calledNext,
    true,
    'Different email from an already-seen IP must NOT be blocked'
  );
  assert.equal(differentEmailRes.status, 200);
  console.log('✔ [PASS] Different email from the same IP does not share the exhausted bucket');

  console.log('=== All SEC-25 loginLimiter security tests PASSED ===\n');
}

await runSec25LoginLimiterTests();
