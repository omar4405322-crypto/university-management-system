import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import http from 'node:http';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'scan-qr-validation-test-secret-2026';

const [{ default: app }, { default: prisma }, { generateAccessToken }] =
  await Promise.all([
    import('../src/app'),
    import('../src/utils/prismaClient'),
    import('../src/utils/jwt.utils'),
  ]);

const testDir = path.dirname(fileURLToPath(import.meta.url));
const routesPath = path.resolve(testDir, '../src/routes/attendance.routes.ts');
const routesSource = readFileSync(routesPath, 'utf8');

// 1. Source parity checks
assert.match(
  routesSource,
  /router\.post\(\s*["']\/scan-qr["'][\s\S]*?body\(["']token["']\)/,
  '/scan-qr must validate token'
);
assert.match(
  routesSource,
  /router\.post\(\s*["']\/scan-qr["'][\s\S]*?body\(["']sessionId["']\)\.isInt/,
  '/scan-qr must validate sessionId as integer'
);
assert.match(
  routesSource,
  /router\.post\(\s*["']\/scan-qr["'][\s\S]*?body\(["']deviceId["']\)/,
  '/scan-qr must validate deviceId'
);
assert.match(
  routesSource,
  /router\.post\(\s*["']\/scan-qr["'][\s\S]*?validate,[\s\S]*?attendanceController\.recordAttendanceQr/,
  '/scan-qr must invoke validate middleware before calling controller'
);

// 2. Behavioral verification
const originalUserFindUnique = prisma.user.findUnique;
const originalStudentFindUnique = prisma.student.findUnique;

(prisma.user.findUnique as any) = async () => ({
  id: 10,
  email: 'student@example.test',
  role: 'STUDENT',
  tokenVersion: 0,
  isActive: true,
});

(prisma.student.findUnique as any) = async () => ({
  id: 20,
  userId: 10,
});

const server = http.createServer(app);
await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address() as any;
const baseUrl = `http://127.0.0.1:${address.port}/api`;
const token = generateAccessToken(10, 0);

try {
  // Empty payload
  const resEmpty = await fetch(`${baseUrl}/attendance/scan-qr`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({}),
  });
  assert.equal(resEmpty.status, 422, 'Empty payload to /scan-qr must yield 422 validation failure');
  const jsonEmpty = (await resEmpty.json()) as any;
  assert.equal(jsonEmpty.success, false);

  // Missing deviceId
  const resNoDevice = await fetch(`${baseUrl}/attendance/scan-qr`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ token: '123456', sessionId: 1 }),
  });
  assert.equal(resNoDevice.status, 422, 'Missing deviceId must yield 422 validation failure');

  // Invalid sessionId
  const resBadSession = await fetch(`${baseUrl}/attendance/scan-qr`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      token: '123456',
      sessionId: 'not-a-number',
      deviceId: 'device-12345678',
    }),
  });
  assert.equal(resBadSession.status, 422, 'Invalid sessionId must yield 422 validation failure');

  // Verify /qr endpoint exhibits identical validation parity
  const resQrEmpty = await fetch(`${baseUrl}/attendance/qr`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({}),
  });
  assert.equal(resQrEmpty.status, 422, '/qr must also yield 422 on empty payload');
} finally {
  prisma.user.findUnique = originalUserFindUnique;
  prisma.student.findUnique = originalStudentFindUnique;
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve()))
  );
}

console.log('BUG-1: /scan-qr validation parity checks passed');
