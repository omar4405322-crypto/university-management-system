import assert from 'node:assert/strict';
import http from 'node:http';

async function run(): Promise<void> {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'health-security-test-secret-that-is-long-enough';

  const [{ default: app }, { default: prisma }, { generateAccessToken }] = await Promise.all([
    import('../src/app'),
    import('../src/utils/prismaClient'),
    import('../src/utils/jwt.utils'),
  ]);

  const originalFindUnique = prisma.user.findUnique;
  const originalQueryRaw = (prisma as any).$queryRaw;
  let readinessQueries = 0;

  (prisma as any).$queryRaw = async () => {
    readinessQueries += 1;
    return [{ result: 1 }];
  };

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  assert(address && typeof address !== 'string');
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    for (const path of ['/api/health', '/api/healthz']) {
      const response = await fetch(`${baseUrl}${path}`);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { status: 'ok' });
      assert(response.headers.has('ratelimit-policy'));
    }
    assert.equal(readinessQueries, 0, 'Public liveness must not query dependencies');

    const unauthenticated = await fetch(`${baseUrl}/api/health/readiness`);
    assert.equal(unauthenticated.status, 401);
    assert.equal(readinessQueries, 0, 'Unauthorized readiness must not query dependencies');

    const token = generateAccessToken(1, 0);
    (prisma.user as any).findUnique = async () => ({
      id: 1,
      email: 'operator@example.invalid',
      role: 'SUPER_ADMIN',
      adminRole: null,
      collegeId: null,
      departmentId: null,
      managedCollegeId: null,
      managedDepartmentId: null,
      tokenVersion: 0,
      profilePicture: null,
      createdAt: new Date(),
      isActive: true,
      student: null,
      doctor: null,
      teachingAssistant: null,
    });

    const authorized = await fetch(`${baseUrl}/api/health/readiness`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(authorized.status, 200);
    assert.deepEqual(await authorized.json(), {
      status: 'ready',
      checks: { database: true, redis: true },
    });
    assert.equal(readinessQueries, 1);

    (prisma.user as any).findUnique = async () => ({
      id: 2,
      role: 'STUDENT',
      tokenVersion: 0,
      isActive: true,
    });
    const studentToken = generateAccessToken(2, 0);
    const forbidden = await fetch(`${baseUrl}/api/health/readiness`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(forbidden.status, 403);
    assert.equal(readinessQueries, 1, 'Forbidden readiness must not query dependencies');

    (prisma.user as any).findUnique = async () => ({
      id: 1,
      role: 'SUPER_ADMIN',
      tokenVersion: 0,
      isActive: true,
    });
    (prisma as any).$queryRaw = async () => {
      readinessQueries += 1;
      throw new Error('sensitive database detail');
    };
    const unavailable = await fetch(`${baseUrl}/api/health/readiness`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(unavailable.status, 503);
    const unavailableText = await unavailable.text();
    assert(!unavailableText.includes('sensitive database detail'));
    assert.deepEqual(JSON.parse(unavailableText), {
      status: 'not_ready',
      checks: { database: false },
    });

    let limitedStatus = 200;
    for (let attempt = 0; attempt < 60 && limitedStatus !== 429; attempt += 1) {
      limitedStatus = (await fetch(`${baseUrl}/api/health`)).status;
    }
    assert.equal(limitedStatus, 429, 'Health endpoints must enforce their dedicated rate limit');
  } finally {
    (prisma.user as any).findUnique = originalFindUnique;
    (prisma as any).$queryRaw = originalQueryRaw;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
