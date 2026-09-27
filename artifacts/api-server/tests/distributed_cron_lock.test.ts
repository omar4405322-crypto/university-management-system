import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  acquireJobLease,
  releaseJobLease,
  withDistributedJobLease,
  CRON_TIMEZONE,
  generateOwnerToken,
} from '../src/utils/distributedLock.utils';
import { readFileSync } from 'node:fs';

/**
 * In-memory Mock Redis Client that faithful implements:
 * 1. set key val EX ttl NX
 * 2. eval Lua release script (atomic get and del)
 */
class MockRedisClient {
  private store = new Map<string, { value: string; expiresAt: number }>();

  async set(key: string, value: string, mode1?: string, ttlSeconds?: number, mode2?: string): Promise<string | null> {
    const now = Date.now();
    const existing = this.store.get(key);

    // Check expiration
    if (existing && existing.expiresAt <= now) {
      this.store.delete(key);
    }

    if (mode2 === 'NX' && this.store.has(key)) {
      return null;
    }

    const ttlMs = (ttlSeconds ?? 60) * 1000;
    this.store.set(key, { value, expiresAt: now + ttlMs });
    return 'OK';
  }

  async get(key: string): Promise<string | null> {
    const now = Date.now();
    const existing = this.store.get(key);
    if (!existing) return null;
    if (existing.expiresAt <= now) {
      this.store.delete(key);
      return null;
    }
    return existing.value;
  }

  async eval(script: string, numKeys: number, key: string, arg: string): Promise<number> {
    const now = Date.now();
    const existing = this.store.get(key);
    if (!existing || existing.expiresAt <= now) {
      this.store.delete(key);
      return 0;
    }

    if (existing.value === arg) {
      this.store.delete(key);
      return 1;
    }
    return 0;
  }

  // Helper for testing expiration
  expireNow(key: string) {
    const existing = this.store.get(key);
    if (existing) {
      existing.expiresAt = Date.now() - 1000;
    }
  }

  getRaw(key: string) {
    return this.store.get(key);
  }
}

test('REL-001: Two simulated replicas attempt the same job -> only one owns lease, second skips', async () => {
  const mockRedis = new MockRedisClient();
  let replica1Executed = false;
  let replica2Executed = false;

  // Replica 1 acquires lease for 60 seconds
  const promise1 = withDistributedJobLease(
    'risk-detection',
    60,
    async () => {
      replica1Executed = true;
      return 'done-replica-1';
    },
    { redisClient: mockRedis, isProduction: true }
  );

  // Replica 2 attempts simultaneously while Replica 1 is executing
  const promise2 = withDistributedJobLease(
    'risk-detection',
    60,
    async () => {
      replica2Executed = true;
      return 'done-replica-2';
    },
    { redisClient: mockRedis, isProduction: true }
  );

  // Note: promise1 will acquire, run, and release in finally.
  // To test mutual exclusion when both run concurrently:
  const [res1, res2] = await Promise.all([
    // Replica A manually acquires lease
    (async () => {
      const leaseA = await acquireJobLease('mutual-exclusion-test', 60, { redisClient: mockRedis });
      assert.equal(leaseA.acquired, true, 'Replica A must acquire lease');

      // While Replica A holds it, Replica B attempts
      const leaseB = await acquireJobLease('mutual-exclusion-test', 60, { redisClient: mockRedis });
      assert.equal(leaseB.acquired, false, 'Replica B must fail to acquire while Replica A holds it');

      // Replica B running through wrapper returns LOCK_HELD
      const resB = await withDistributedJobLease(
        'mutual-exclusion-test',
        60,
        async () => {
          replica2Executed = true;
        },
        { redisClient: mockRedis, isProduction: true }
      );
      assert.equal(resB.executed, false);
      assert.equal(resB.reason, 'LOCK_HELD');
      assert.equal(replica2Executed, false, 'Replica 2 callback must NOT execute');

      // Release Replica A
      await releaseJobLease(leaseA.leaseKey, leaseA.ownerToken, { redisClient: mockRedis });
      return true;
    })(),
    promise1
  ]);

  assert.equal(res1, true);
  const result1 = await promise1;
  assert.equal(result1.executed, true);
  assert.equal(replica1Executed, true);
});

test('REL-001: An expired lease can later be acquired by another worker', async () => {
  const mockRedis = new MockRedisClient();

  const lease1 = await acquireJobLease('expiry-test', 1, { redisClient: mockRedis });
  assert.equal(lease1.acquired, true);

  // Expire the key in mock redis
  mockRedis.expireNow(lease1.leaseKey);

  // Worker 2 attempts acquisition after expiration
  const lease2 = await acquireJobLease('expiry-test', 60, { redisClient: mockRedis });
  assert.equal(lease2.acquired, true, 'Worker 2 must successfully acquire previously expired lease');
  assert.notEqual(lease1.ownerToken, lease2.ownerToken);

  await releaseJobLease(lease2.leaseKey, lease2.ownerToken, { redisClient: mockRedis });
});

test('REL-001: Safe release: a process cannot delete or release another owner lease', async () => {
  const mockRedis = new MockRedisClient();

  const ownerA = 'owner-host-A:pid1:token-A';
  const ownerB = 'owner-host-B:pid2:token-B';

  // Worker A acquires lease
  const leaseA = await acquireJobLease('ownership-test', 60, {
    redisClient: mockRedis,
    ownerToken: ownerA,
  });
  assert.equal(leaseA.acquired, true);

  // Worker B attempts to release Worker A's lease
  const releasedByB = await releaseJobLease(leaseA.leaseKey, ownerB, { redisClient: mockRedis });
  assert.equal(releasedByB, false, 'Worker B must NOT be able to release Worker A lease');

  // Verify Worker A's lease is STILL held in Redis
  const rawKey = mockRedis.getRaw(leaseA.leaseKey);
  assert.ok(rawKey !== undefined, 'Lease key must still exist in Redis');
  assert.equal(rawKey?.value, ownerA, 'Lease value must still be Worker A');

  // Worker A releases own lease
  const releasedByA = await releaseJobLease(leaseA.leaseKey, ownerA, { redisClient: mockRedis });
  assert.equal(releasedByA, true, 'Worker A can cleanly release own lease');
  assert.equal(mockRedis.getRaw(leaseA.leaseKey), undefined, 'Lease key must now be deleted');
});

test('REL-001: Production fail-safe: Redis outage does not result in uncontrolled duplicate runs', async () => {
  // Faulty client that throws network/connection errors
  const brokenRedis = {
    async set() {
      throw new Error('ECONNREFUSED 127.0.0.1:6379');
    },
    async eval() {
      throw new Error('ECONNREFUSED');
    }
  };

  let callbackRan = false;

  // In production, when Redis fails, job must be SKIPPED safely
  const result = await withDistributedJobLease(
    'fail-safe-job',
    60,
    async () => {
      callbackRan = true;
    },
    { redisClient: brokenRedis, isProduction: true }
  );

  assert.equal(result.executed, false, 'Must not execute in production when Redis fails');
  assert.equal(result.reason, 'REDIS_UNAVAILABLE_PRODUCTION');
  assert.equal(callbackRan, false, 'Task callback must NEVER run during Redis failure in production');
});

test('REL-001: Non-production fallback: allows local execution when Redis is not configured', async () => {
  let callbackRan = false;

  const result = await withDistributedJobLease(
    'dev-local-job',
    60,
    async () => {
      callbackRan = true;
      return 'local-result';
    },
    { redisClient: null, isProduction: false }
  );

  assert.equal(result.executed, true);
  assert.equal(result.result, 'local-result');
  assert.equal(callbackRan, true);
});

test('REL-001: Cron timezone is explicitly Africa/Cairo on all schedules', () => {
  assert.equal(CRON_TIMEZONE, 'Africa/Cairo', 'Authoritative institution timezone must be Africa/Cairo');

  const cronSource = readFileSync(
    new URL('../src/utils/cron.ts', import.meta.url),
    'utf8'
  );

  // Check import
  assert.match(cronSource, /import\s*\{[^}]*withDistributedJobLease[^}]*CRON_TIMEZONE[^}]*\}\s*from\s*['"]\.\/distributedLock\.utils['"]/);

  // Check that all 3 start* jobs specify { timezone: CRON_TIMEZONE }
  const riskMatch = cronSource.match(/export const startRiskDetectionJob =[\s\S]*?\{ timezone: CRON_TIMEZONE \}/);
  assert.ok(riskMatch, 'startRiskDetectionJob must configure { timezone: CRON_TIMEZONE }');

  const sessionMatch = cronSource.match(/export const startSessionAutoExpiryJob =[\s\S]*?\{ timezone: CRON_TIMEZONE \}/);
  assert.ok(sessionMatch, 'startSessionAutoExpiryJob must configure { timezone: CRON_TIMEZONE }');

  const pendingMatch = cronSource.match(/export const startPendingReviewAutoResolveJob =[\s\S]*?\{ timezone: CRON_TIMEZONE \}/);
  assert.ok(pendingMatch, 'startPendingReviewAutoResolveJob must configure { timezone: CRON_TIMEZONE }');
});
