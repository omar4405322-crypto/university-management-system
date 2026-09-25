import assert from 'node:assert/strict';
import http from 'node:http';
import prisma from '../src/utils/prismaClient';
import app, { createPublicReadinessHandler } from '../src/app';

async function run(): Promise<void> {
  const originalQueryRaw = (prisma as any).$queryRaw;

  try {
    const invokePublicReadiness = async (
      redisStatus: { configured: boolean; connected: boolean; status: string },
      isShuttingDown: boolean = false
    ) => {
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

      const handler = createPublicReadinessHandler(
        () => redisStatus,
        () => isShuttingDown
      );
      await handler({} as any, response as any);
      return { statusCode, body };
    };

    // 1. Shutting down returns 503
    const shuttingDown = await invokePublicReadiness(
      { configured: true, connected: true, status: 'ready' },
      true
    );
    assert.equal(shuttingDown.statusCode, 503);
    assert.deepEqual(shuttingDown.body, { status: 'shutting_down' });

    // 2. Database available, Redis connected -> 200 ready
    (prisma as any).$queryRaw = async () => [{ result: 1 }];
    const healthy = await invokePublicReadiness({
      configured: true,
      connected: true,
      status: 'ready',
    });
    assert.equal(healthy.statusCode, 200);
    assert.deepEqual(healthy.body, {
      status: 'ready',
      checks: { database: true, redis: true },
    });

    // 3. Database available, Redis unconfigured (e.g. dev/test) -> 200 ready
    const noRedis = await invokePublicReadiness({
      configured: false,
      connected: false,
      status: 'disabled',
    });
    assert.equal(noRedis.statusCode, 200);
    assert.deepEqual(noRedis.body, {
      status: 'ready',
      checks: { database: true, redis: true },
    });

    // 4. Database available, Redis configured BUT disconnected -> 503 not_ready
    const disconnectedRedis = await invokePublicReadiness({
      configured: true,
      connected: false,
      status: 'reconnecting',
    });
    assert.equal(disconnectedRedis.statusCode, 503);
    assert.deepEqual(disconnectedRedis.body, {
      status: 'not_ready',
      checks: { database: true, redis: false },
    });

    // 5. Database down -> 503 not_ready
    (prisma as any).$queryRaw = async () => {
      throw new Error('connection refused');
    };
    const dbDown = await invokePublicReadiness({
      configured: true,
      connected: true,
      status: 'ready',
    });
    assert.equal(dbDown.statusCode, 503);
    assert.deepEqual(dbDown.body, {
      status: 'not_ready',
      checks: { database: false },
    });

    // 6. Live HTTP endpoint check
    (prisma as any).$queryRaw = async () => [{ result: 1 }];
    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    assert(address && typeof address !== 'string');
    const baseUrl = `http://127.0.0.1:${address.port}`;

    try {
      const liveRes = await fetch(`${baseUrl}/api/ready`);
      assert.equal(liveRes.status, 200);
      const json = await liveRes.json();
      assert.equal(json.status, 'ready');
      assert.equal(json.checks.database, true);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }

    console.log('OPS-001: /api/ready dependency verification checks passed');
  } finally {
    (prisma as any).$queryRaw = originalQueryRaw;
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
