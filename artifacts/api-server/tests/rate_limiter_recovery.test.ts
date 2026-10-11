import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRedisStore } from '../src/middleware/rateLimiter.middleware';

class FakeRedisClient {
  public status: string = 'connecting';
  public scripts = new Map<string, string>();
  public counters = new Map<string, { count: number; expires: number }>();

  async call(command: string, ...args: any[]) {
    const cmd = command.toUpperCase();
    if (cmd === 'SCRIPT' && args[0]?.toUpperCase() === 'LOAD') {
      const script = args[1];
      const sha = 'b4a2f80123456789abcdef0123456789abcdef01';
      this.scripts.set(sha, script);
      return sha;
    }
    if (cmd === 'EVALSHA') {
      const sha = args[0];
      if (!this.scripts.has(sha)) {
        throw new Error('NOSCRIPT No matching script. Please use EVAL.');
      }
      const key = args[2];
      const windowMs = parseInt(args[3], 10) || 60000;
      let record = this.counters.get(key);
      if (!record || record.expires <= Date.now()) {
        record = { count: 1, expires: Date.now() + windowMs };
        this.counters.set(key, record);
        return [1, windowMs];
      }
      record.count += 1;
      return [record.count, Math.max(0, record.expires - Date.now())];
    }
    throw new Error(`Unsupported command ${command}`);
  }
}

describe('Rate Limiter Redis Store Recovery', () => {
  it('survives not-ready client at boot, fails-closed when disconnected, and recovers via NOSCRIPT reload once ready', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
      const fakeClient = new FakeRedisClient();
      fakeClient.status = 'connecting';

      const store = createRedisStore('recovery_test', fakeClient as any);
      assert.ok(store, 'Store should be instantiated with client');

      // 1. Initial boot: init() loads script while client is connecting
      await store.init({ windowMs: 60000 });

      // 2. Request while still connecting must fail-closed in production
      await assert.rejects(
        async () => {
          await store.increment('test_user');
        },
        {
          name: 'Error',
          message: 'Shared rate-limit store is unavailable',
        },
      );

      // 3. Client transitions to ready
      fakeClient.status = 'ready';

      // 4. First request gets NOSCRIPT on placeholder SHA, reloads script, and succeeds
      const firstResult = await store.increment('test_user');
      assert.equal(firstResult.totalHits, 1);

      // 5. Subsequent request succeeds using the reloaded script SHA
      const secondResult = await store.increment('test_user');
      assert.equal(secondResult.totalHits, 2);
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });
});
