import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';

const { QrDriver } = await import('../src/attendance/drivers/QrDriver');
const prisma = (await import('../src/utils/prismaClient')).default;
const driver = new QrDriver();

const missingSession = await driver.validate(
  { token: '123456', deviceId: 'browser-device-123' },
  { studentId: 7, userId: 9 }
);
assert.equal(missingSession.valid, false);
assert.equal(missingSession.errorCode, 'SESSION_REQUIRED');

const missingDevice = await driver.validate(
  { token: '123456', sessionId: 41 },
  { studentId: 7, userId: 9 }
);
assert.equal(missingDevice.valid, false);
assert.equal(missingDevice.errorCode, 'DEVICE_REQUIRED');

for (const invalidSessionId of [true, [41], '0x29', '4.1', '1e2', ' 41 ']) {
  const result = await driver.validate(
    { token: '123456', sessionId: invalidSessionId, deviceId: 'browser-device-123' },
    { studentId: 7, userId: 9 }
  );
  assert.equal(result.errorCode, 'SESSION_REQUIRED');
}

const originalFindUnique = prisma.attendanceSession.findUnique;
const originalFindMany = prisma.attendanceSession.findMany;
let globalScanAttempted = false;
(prisma.attendanceSession as any).findUnique = async () => null;
(prisma.attendanceSession as any).findMany = async () => {
  globalScanAttempted = true;
  return [];
};
try {
  const wrongSession = await driver.validate(
    { token: '123456', sessionId: 999, deviceId: 'browser-device-123' },
    { studentId: 7, userId: 9 }
  );
  assert.equal(wrongSession.errorCode, 'INVALID_TOKEN');
  assert.equal(globalScanAttempted, false, 'Wrong session IDs must not trigger a global session scan');
} finally {
  (prisma.attendanceSession as any).findUnique = originalFindUnique;
  (prisma.attendanceSession as any).findMany = originalFindMany;
}

console.log('QR session and device binding security checks passed');
