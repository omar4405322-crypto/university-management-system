import assert from 'node:assert/strict';
import speakeasy from 'speakeasy';

process.env.NODE_ENV = 'test';

const [
  redisUtils,
  twoFactorUtils,
  qrModule,
  analyticsModule,
  appModule,
  prismaModule,
] = await Promise.all([
  import('../src/utils/redis.utils'),
  import('../src/utils/twoFactor.utils'),
  import('../src/attendance/drivers/QrDriver'),
  import('../src/controllers/analytics.controller'),
  import('../src/app'),
  import('../src/utils/prismaClient'),
]);

const {
  getCache,
  invalidateCache,
  setCache,
  shouldInitializeRedis,
  RedisOperationError,
} = redisUtils;
const { claimTotpCounter, verifyTOTP } = twoFactorUtils;
const { claimQrToken } = qrModule;
const { withAnalyticsCache } = analyticsModule;
const { createReadinessHandler } = appModule;
const prisma = prismaModule.default;

assert.equal(
  shouldInitializeRedis({ NODE_ENV: 'production', REDIS_URL: 'redis://test-instance' }),
  true,
  'A production process with REDIS_URL must initialize Redis'
);
assert.equal(
  shouldInitializeRedis({ NODE_ENV: 'test', REDIS_URL: 'redis://test-instance' }),
  false,
  'Unit tests must not open an external Redis connection'
);
assert.equal(shouldInitializeRedis({ NODE_ENV: 'production' }), false);

const values = new Map<string, string>();
const setCalls: unknown[][] = [];
const fakeRedis = {
  get: async (key: string) => values.get(key) ?? null,
  set: async (...args: unknown[]) => {
    setCalls.push(args);
    const [key, value, , , mode] = args as [string, string, string, number, string?];
    if (mode === 'NX' && values.has(key)) return null;
    values.set(key, value);
    return 'OK';
  },
  eval: async (
    _script: string,
    _keyCount: number,
    key: string,
    counter: string
  ) => {
    const previous = values.get(key);
    if (previous !== undefined && Number(previous) >= Number(counter)) return 0;
    values.set(key, counter);
    return 1;
  },
};

assert.equal(await claimTotpCounter(41, 100, fakeRedis as any, 'secret-a'), true);
assert.equal(await claimTotpCounter(41, 100, fakeRedis as any, 'secret-a'), false);
assert.equal(values.get('auth:totp:last-counter:41:secret-a'), '100');

const secret = speakeasy.generateSecret({ length: 20 }).base32;
const nowSeconds = Math.floor(Date.now() / 1000);
const token = speakeasy.totp({ secret, encoding: 'base32', time: nowSeconds });
assert.equal(await verifyTOTP(secret, token, 42, fakeRedis as any), true);
assert.equal(
  await verifyTOTP(secret, token, 42, fakeRedis as any),
  false,
  'verifyTOTP must reject token reuse via Redis counter check'
);

await assert.rejects(
  claimTotpCounter(41, 101, {
    eval: async () => { throw new Error('redis connection timeout'); },
  } as any, 'secret-a'),
  (err: unknown) => err instanceof RedisOperationError && err.statusCode === 503,
  'claimTotpCounter must fail-closed on Redis failure'
);

const qrKey = 'attendance:used_token:7:41:123456';
assert.equal(await claimQrToken(qrKey, 60, fakeRedis as any), true);
assert.equal(await claimQrToken(qrKey, 60, fakeRedis as any), false);
assert.deepEqual(setCalls.at(-1), [qrKey, '1', 'EX', 60, 'NX']);

await assert.rejects(
  claimQrToken(qrKey, 60, {
    set: async () => { throw new Error('redis network error'); },
  } as any),
  (err: unknown) => err instanceof RedisOperationError && err.statusCode === 503,
  'claimQrToken must fail-closed on Redis failure'
);

let analyticsLoads = 0;
const redisCacheAdapter = {
  get: (key: string) => getCache(key, fakeRedis as any),
  set: (key: string, value: unknown, ttl: number) =>
    setCache(key, value, ttl, fakeRedis as any),
};
const loadAnalytics = async () => {
  analyticsLoads += 1;
  return { enrollmentTrends: [{ name: 'Jan', count: 8 }] };
};
const firstAnalytics = await withAnalyticsCache(
  'dashboard:analytics:test',
  loadAnalytics,
  redisCacheAdapter
);
const secondAnalytics = await withAnalyticsCache(
  'dashboard:analytics:test',
  loadAnalytics,
  redisCacheAdapter
);
assert.deepEqual(secondAnalytics, firstAnalytics);
assert.equal(analyticsLoads, 1, 'The second analytics request must be a Redis cache hit');
assert.ok(
  setCalls.some((call) => call[0] === 'dashboard:analytics:test' && call[2] === 'EX'),
  'Analytics data must be written with a Redis TTL'
);

const scanCalls: string[] = [];
const deletedBatches: string[][] = [];
const scanClient = {
  scan: async (cursor: string) => {
    scanCalls.push(cursor);
    return cursor === '0'
      ? ['9', ['dashboard:a', 'dashboard:b']]
      : ['0', ['dashboard:c']];
  },
  del: async (...keys: string[]) => {
    deletedBatches.push(keys);
    return keys.length;
  },
};
await invalidateCache('dashboard:*', scanClient as any);
assert.deepEqual(scanCalls, ['0', '9']);
assert.deepEqual(deletedBatches, [
  ['dashboard:a', 'dashboard:b'],
  ['dashboard:c'],
]);

const originalQueryRaw = (prisma as any).$queryRaw;
(prisma as any).$queryRaw = async () => [{ result: 1 }];
try {
  const invokeReadiness = async (status: {
    configured: boolean;
    connected: boolean;
    status: string;
  }) => {
    let statusCode = 0;
    let body: any;
    const response = {
      status(code: number) {
        statusCode = code;
        return response;
      },
      json(value: unknown) {
        body = value;
        return response;
      },
    };
    await createReadinessHandler(() => status)({} as any, response as any);
    return { statusCode, body };
  };

  const healthy = await invokeReadiness({
    configured: true,
    connected: true,
    status: 'ready',
  });
  assert.equal(healthy.statusCode, 200);
  assert.deepEqual(healthy.body, {
    status: 'ready',
    checks: {
      database: true,
      redis: true,
      dashboardCache: { configured: true, operational: true, state: 'ready' },
    },
  });

  const absent = await invokeReadiness({
    configured: false,
    connected: false,
    status: 'disabled',
  });
  assert.equal(absent.statusCode, 200);
  assert.deepEqual(absent.body, {
    status: 'ready',
    checks: {
      database: true,
      redis: true,
      dashboardCache: { configured: false, operational: false, state: 'degraded' },
    },
  });

  const disconnected = await invokeReadiness({
    configured: true,
    connected: false,
    status: 'reconnecting',
  });
  assert.equal(disconnected.statusCode, 503);
  assert.deepEqual(disconnected.body, {
    status: 'not_ready',
    checks: {
      database: true,
      redis: false,
      dashboardCache: { configured: true, operational: false, state: 'degraded' },
    },
  });
} finally {
  (prisma as any).$queryRaw = originalQueryRaw;
}

console.log('Redis runtime integration checks passed');
