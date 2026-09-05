import assert from 'node:assert/strict';
import {
  RedisOperationError,
  setIfNotExists,
} from '../src/utils/redis.utils';

async function runQrRedisReplaySecurityTests() {
  const claimed = await setIfNotExists(
    'test:token',
    '1',
    30,
    { set: async () => 'OK' } as any
  );
  assert.equal(claimed, true);

  const alreadyExists = await setIfNotExists(
    'test:token',
    '1',
    30,
    { set: async () => null } as any
  );
  assert.equal(alreadyExists, false, 'Only an existing key is a replay');

  await assert.rejects(
    setIfNotExists(
      'test:token',
      '1',
      30,
      {
        set: async () => {
          throw new Error('backend unavailable');
        },
      } as any
    ),
    (error: unknown) =>
      error instanceof RedisOperationError && error.statusCode === 503
  );

  await assert.rejects(
    setIfNotExists('test:token', '1', 30, null),
    (error: unknown) =>
      error instanceof RedisOperationError && error.statusCode === 503
  );
}

await runQrRedisReplaySecurityTests();
console.log('QR Redis replay security checks passed');
