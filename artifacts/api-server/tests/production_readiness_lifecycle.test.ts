import assert from 'node:assert/strict';
import { test } from 'node:test';
import http from 'node:http';
import app from '../src/app';
import prisma from '../src/utils/prismaClient';
import { getMissingRuntimeEnvVars } from '../src/utils/runtimeEnvironment';
import { getJwtSecretValidationError } from '../src/utils/jwtSecretValidation';
import { getTwoFactorConfigError } from '../src/utils/twoFactorConfig';
import { isShuttingDown, setShuttingDown } from '../src/utils/shutdown';

test('PROD-001: Root and /api/ health and readiness endpoints respond correctly', async () => {
  const originalQueryRaw = (prisma as any).$queryRaw;
  (prisma as any).$queryRaw = async () => [{ result: 1 }];

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  assert(address && typeof address !== 'string');
  const port = address.port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. Root /health
    const resHealthRoot = await fetch(`${baseUrl}/health`);
    assert.equal(resHealthRoot.status, 200, 'GET /health must return 200');
    const jsonHealthRoot = await resHealthRoot.json();
    assert.deepEqual(jsonHealthRoot, { status: 'ok' });

    // 2. Root /healthz
    const resHealthzRoot = await fetch(`${baseUrl}/healthz`);
    assert.equal(resHealthzRoot.status, 200, 'GET /healthz must return 200');
    const jsonHealthzRoot = await resHealthzRoot.json();
    assert.deepEqual(jsonHealthzRoot, { status: 'ok' });

    // 3. Root /ready
    const resReadyRoot = await fetch(`${baseUrl}/ready`);
    assert.equal(resReadyRoot.status, 200, 'GET /ready must return 200');
    const jsonReadyRoot = await resReadyRoot.json();
    assert.equal(jsonReadyRoot.status, 'ready');
    assert.equal(jsonReadyRoot.checks.database, true);

    // 4. API /api/health
    const resHealthApi = await fetch(`${baseUrl}/api/health`);
    assert.equal(resHealthApi.status, 200, 'GET /api/health must return 200');
    const jsonHealthApi = await resHealthApi.json();
    assert.deepEqual(jsonHealthApi, { status: 'ok' });

    // 5. API /api/ready
    const resReadyApi = await fetch(`${baseUrl}/api/ready`);
    assert.equal(resReadyApi.status, 200, 'GET /api/ready must return 200');
    const jsonReadyApi = await resReadyApi.json();
    assert.equal(jsonReadyApi.status, 'ready');
  } finally {
    (prisma as any).$queryRaw = originalQueryRaw;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('PROD-002: Production error handler returns sanitized error payload with zero stack or internal leak', async () => {
  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  assert(address && typeof address !== 'string');
  const port = address.port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const res = await fetch(`${baseUrl}/api/non-existent-route-for-production-test`);
    assert.equal(res.status, 404);
    const body = await res.json();

    assert.equal(body.success, false);
    assert.equal(body.status, 'fail');
    assert.ok(body.message, 'Must contain sanitized error message');
    assert.ok(body.errorId, 'Must contain traceable errorId');
    assert.equal(body.stack, undefined, 'Must NEVER leak stack trace in production');
    assert.equal(body.error, undefined, 'Must NEVER leak raw error object in production');
    assert.ok(res.headers.get('x-request-id'), 'Must provide X-Request-Id header');
  } finally {
    process.env.NODE_ENV = originalEnv;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('PROD-003: Production fail-fast env validation checks all required secrets and configuration', () => {
  // 1. Missing required variables in production
  const missing = getMissingRuntimeEnvVars({ NODE_ENV: 'production' });
  assert.ok(missing.includes('DATABASE_URL'));
  assert.ok(missing.includes('JWT_SECRET'));
  assert.ok(missing.includes('ENCRYPTION_KEY'));
  assert.ok(missing.includes('REDIS_URL'));

  // 2. Weak or short JWT secrets
  assert.ok(getJwtSecretValidationError('short-secret', 32));
  assert.ok(getJwtSecretValidationError('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', 32));
  assert.equal(getJwtSecretValidationError('c4b7260842db13a1e9c5f88421b9daec47a321908bf6ea245c71b6951fe21b6d', 32), null);

  // 3. 2FA configuration in production
  assert.ok(getTwoFactorConfigError('production', 'false'));
  assert.equal(getTwoFactorConfigError('production', 'true'), null);
});

test('PROD-004: Readiness probes immediately fail with 503 during graceful shutdown while liveness persists', async () => {
  const originalQueryRaw = (prisma as any).$queryRaw;
  (prisma as any).$queryRaw = async () => [{ result: 1 }];

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  assert(address && typeof address !== 'string');
  const port = address.port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    setShuttingDown(true);

    // Readiness must immediately report 503 shutting_down
    const resReady = await fetch(`${baseUrl}/ready`);
    assert.equal(resReady.status, 503);
    const bodyReady = await resReady.json();
    assert.equal(bodyReady.status, 'shutting_down');

    // Liveness must remain 200 during connection draining
    const resHealth = await fetch(`${baseUrl}/health`);
    assert.equal(resHealth.status, 200);
    const bodyHealth = await resHealth.json();
    assert.equal(bodyHealth.status, 'ok');
  } finally {
    setShuttingDown(false);
    (prisma as any).$queryRaw = originalQueryRaw;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
