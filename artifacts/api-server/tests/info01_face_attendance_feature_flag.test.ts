import assert from 'node:assert/strict';
import http from 'node:http';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'face-attendance-feature-flag-test-secret-2026';
delete process.env.ENABLE_FACE_ATTENDANCE;

const [
  { default: app },
  { default: prisma },
  { generateAccessToken },
  { FaceDriver },
] = await Promise.all([
  import('../src/app'),
  import('../src/utils/prismaClient'),
  import('../src/utils/jwt.utils'),
  import('../src/attendance/drivers/FaceDriver'),
]);

const originalUserFindUnique = prisma.user.findUnique;
(prisma.user.findUnique as any) = async () => ({
  id: 101,
  email: 'student@example.test',
  role: 'STUDENT',
  adminRole: null,
  collegeId: 1,
  departmentId: 1,
  managedCollegeId: null,
  managedDepartmentId: null,
  tokenVersion: 0,
  profilePicture: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  isActive: true,
  student: { id: 101 },
  doctor: null,
  teachingAssistant: null,
});

const server = http.createServer(app);
await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
assert.ok(address && typeof address === 'object');
const baseUrl = `http://127.0.0.1:${address.port}/api`;
const token = generateAccessToken(101, 0);

try {
  // Test 1: By default, ENABLE_FACE_ATTENDANCE is disabled -> 403 FEATURE_DISABLED
  delete process.env.ENABLE_FACE_ATTENDANCE;
  const resDisabled = await fetch(`${baseUrl}/attendance/face`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ sessionId: 1, faceDescriptor: [0.1, 0.2] }),
  });
  assert.equal(resDisabled.status, 403, 'Disabled face route must return 403');
  const bodyDisabled = (await resDisabled.json()) as any;
  assert.equal(bodyDisabled.success, false);
  assert.equal(bodyDisabled.error?.code, 'FEATURE_DISABLED');

  // Test 2: FaceDriver unit checks when flag is disabled
  const faceDriver = new FaceDriver();
  const valDisabled = await faceDriver.validate({}, {} as any);
  assert.equal(valDisabled.valid, false);
  assert.equal(valDisabled.errorCode, 'FEATURE_DISABLED');
  await assert.rejects(
    async () => faceDriver.buildIntent({}, {} as any),
    (err: any) => err.statusCode === 403 && err.message.includes('disabled by default')
  );

  // Test 3: When explicitly enabled via ENABLE_FACE_ATTENDANCE=true
  process.env.ENABLE_FACE_ATTENDANCE = 'true';
  const valEnabled = await faceDriver.validate({}, {} as any);
  assert.equal(valEnabled.valid, false);
  assert.equal(valEnabled.errorCode, 'NOT_IMPLEMENTED');
  await assert.rejects(
    async () => faceDriver.buildIntent({}, {} as any),
    (err: any) => err.statusCode === 501 && err.message.includes('not yet implemented')
  );

  // Test 4: Existing RFID / manual routes unaffected
  // POST /attendance/rfid without signature still undergoes signature check, not blocked by face flag
  const resRfid = await fetch(`${baseUrl}/attendance/rfid`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ rfidTag: 'TAG-12345' }),
  });
  // Should fail validation due to missing hmac signature, not feature disabled
  assert.equal(resRfid.status, 422, 'RFID route must remain active and enforce validation');

  console.log('INFO-001 face attendance feature flag security and isolation tests passed');
} finally {
  delete process.env.ENABLE_FACE_ATTENDANCE;
  (prisma.user.findUnique as any) = originalUserFindUnique;
  await new Promise<void>((resolve) => server.close(() => resolve()));
}
