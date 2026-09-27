import assert from 'node:assert/strict';
import express, { Request, Response } from 'express';
import {
  authLimiter,
  loginLimiter,
  loginIpLimiter,
  loginAccountLimiter,
  createRedisStore,
} from '../src/middleware/rateLimiter.middleware';

async function runSec04LoginLimiterSecurityTests() {
  console.log('=== SEC-04: Login Limiter Security & Anti-Lockout Verification Suite ===');

  // =========================================================================
  // 1. Missing or malformed email handling
  // =========================================================================
  const accountKeyGen = (loginLimiter as any).keyGenerator;
  assert.equal(
    accountKeyGen({ body: { email: null }, ip: '10.0.0.1' }),
    '10.0.0.1',
    'Null email must fall back to IP'
  );
  assert.equal(
    accountKeyGen({ body: { email: 12345 }, ip: '10.0.0.1' }),
    '10.0.0.1',
    'Numeric email must fall back to IP'
  );
  assert.equal(
    accountKeyGen({ body: undefined, ip: '10.0.0.1' }),
    '10.0.0.1',
    'Undefined body must fall back to IP'
  );
  assert.equal(
    accountKeyGen({ body: { email: '  Admin@Uni.EDU  ' }, ip: '10.0.0.1' }),
    '10.0.0.1:admin@uni.edu',
    'Email must be trimmed and lowercased'
  );

  // =========================================================================
  // 2. IPv4 and IPv6 handling with express-rate-limit ipKeyGenerator
  // =========================================================================
  const ipv6Client1 = '2001:0db8:85a3:0000:0000:8a2e:0370:7334';
  const ipv6Client2 = '2001:0db8:85a3:0000:0000:8a2e:0370:ffff'; // Same /56 subnet
  const ipv6Key1 = accountKeyGen({ body: { email: 'user@uni.edu' }, ip: ipv6Client1 });
  const ipv6Key2 = accountKeyGen({ body: { email: 'user@uni.edu' }, ip: ipv6Client2 });
  assert.equal(ipv6Key1, '2001:db8:85a3::/56:user@uni.edu', 'IPv6 address must be normalized to /56 subnet');
  assert.equal(ipv6Key1, ipv6Key2, 'IPv6 addresses in the same /56 subnet must share rate limit bucket to prevent rotation bypass');

  const ipv4Mapped = '::ffff:192.168.1.100';
  const mappedKey = accountKeyGen({ body: { email: 'user@uni.edu' }, ip: ipv4Mapped });
  assert.equal(mappedKey, '192.168.1.100:user@uni.edu', 'IPv4-mapped IPv6 must normalize to canonical IPv4');

  const localhostIpv6 = '::1';
  const localhostKey = accountKeyGen({ body: { email: 'user@uni.edu' }, ip: localhostIpv6 });
  assert.equal(localhostKey, '::/56:user@uni.edu', 'Localhost IPv6 must normalize to /56 subnet');

  // =========================================================================
  // 3. Complete authentication middleware chain test with Express
  // =========================================================================
  // Setup isolated Express application matching app.ts mounting structure
  const testApp = express();
  testApp.set('trust proxy', 1); // Exact Railway reverse-proxy trust configuration
  testApp.use(express.json());

  // Mount authLimiter on /api/auth and loginLimiter on /api/auth/login
  const authRouter = express.Router();
  authRouter.post('/login', loginLimiter, (req: Request, res: Response) => {
    res.status(200).json({ success: true, message: 'Authentication reached' });
  });
  testApp.use('/api/auth', authLimiter, authRouter);

  // Helper to dispatch request through testApp
  const dispatch = (
    ip: string,
    email: string,
    forwardedFor?: string
  ): Promise<{ status: number; body: any }> => {
    return new Promise((resolve) => {
      const headers: Record<string, string> = {
        'content-type': 'application/json',
      };
      if (forwardedFor) {
        headers['x-forwarded-for'] = forwardedFor;
      }

      // Mock request and response objects for Express pipeline
      const req: any = {
        method: 'POST',
        url: '/api/auth/login',
        body: { email, password: 'password123' },
        headers,
        connection: { remoteAddress: ip },
        socket: { remoteAddress: ip },
        ip,
      };

      const res: any = {
        statusCode: 200,
        headers: {},
        setHeader(name: string, value: string) {
          this.headers[name] = value;
        },
        getHeader(name: string) {
          return this.headers[name];
        },
        status(code: number) {
          this.statusCode = code;
          return this;
        },
        json(body: any) {
          resolve({ status: this.statusCode, body });
        },
        send(body: any) {
          try {
            resolve({ status: this.statusCode, body: JSON.parse(body) });
          } catch {
            resolve({ status: this.statusCode, body });
          }
        },
      };

      testApp.handle(req, res, () => {
        resolve({ status: 404, body: { message: 'Not found' } });
      });
    });
  };

  const victim = 'dean_of_engineering@university.edu';
  const attacker = '198.51.100.55';
  const victimHome = '203.0.113.88';

  // Attacker does 5 login attempts
  for (let i = 1; i <= 5; i++) {
    const res = await dispatch(attacker, victim);
    assert.equal(res.status, 200, `Attacker attempt ${i} reaches auth controller`);
  }

  // Attacker 6th attempt is blocked with 429 and uniform response
  const attackerBlocked = await dispatch(attacker, victim);
  assert.equal(attackerBlocked.status, 429, 'Attacker 6th attempt is throttled');
  assert.equal(attackerBlocked.body.success, false);
  assert.equal(
    attackerBlocked.body.message,
    'Too many login attempts, please try again later',
    'Uniform 429 response message'
  );

  // Legitimate user from victimHome logs in: MUST NOT be blocked!
  const victimLogin = await dispatch(victimHome, victim);
  assert.equal(
    victimLogin.status,
    200,
    'CRITICAL: Legitimate user from victimHome is NOT locked out by attacker failed attempts'
  );
  assert.equal(victimLogin.body.success, true);

  // =========================================================================
  // 4. authLimiter does not create account lockout
  // =========================================================================
  // authLimiter operates on IP level (100 reqs/15m) and does NOT key on email.
  assert.equal(typeof authLimiter, 'function');
  assert.equal(
    (authLimiter as any).keyGenerator,
    undefined,
    'authLimiter must not have a custom email key generator'
  );

  // =========================================================================
  // 5. Redis fallback store behavior
  // =========================================================================
  // When Redis is unavailable or command fails, createRedisStore returns in-memory fallback
  // with passOnStoreError preventing 500 crashes
  const memStore = createRedisStore('test_store');
  // When REDIS_URL is unset in test, createRedisStore cleanly returns undefined (MemoryStore)
  assert.equal(memStore, undefined, 'When REDIS_URL is unset, store falls back cleanly to undefined');

  console.log('All SEC-04 Login Limiter & Anti-Lockout Security tests passed successfully.');
}

runSec04LoginLimiterSecurityTests().catch((err) => {
  console.error('SEC-04 tests failed:', err);
  process.exit(1);
});
