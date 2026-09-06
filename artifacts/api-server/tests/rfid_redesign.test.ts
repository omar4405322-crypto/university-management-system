import assert from 'node:assert/strict';
import crypto from 'crypto';
import { RfidDriver } from '../src/attendance/drivers/RfidDriver';
import { encrypt, decrypt, generateEncryptionKey } from '../src/utils/encryption.utils';
import prisma from '../src/utils/prismaClient';

async function runRfidRedesignTests() {
  console.log('--- Starting Self-Contained RFID Redesign Test Suite ---');

  // 1. Test Encryption Utility
  console.log('Testing AES-256-GCM encryption utility...');
  const testSecret = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const encrypted = encrypt(testSecret);
  assert.notEqual(encrypted, testSecret);
  assert.equal(encrypted.split(':').length, 3, 'Must have iv:authTag:ciphertext');
  const decrypted = decrypt(encrypted);
  assert.equal(decrypted, testSecret, 'Decrypted text must match original secret');

  // Tamper test
  const parts = encrypted.split(':');
  const tampered = `${parts[0]}:${parts[1]}:${parts[2].slice(0, -2)}ff`;
  assert.throws(() => decrypt(tampered), /Decryption failed/, 'Tampered ciphertext must fail auth check');

  // 2. Setup mock environment for Driver
  const driver = new RfidDriver();
  const testRoomId = 'ROOM-LAB-404';
  const testTag = 'TAG-RFID-ALICE-123';
  const rawSigningKey = crypto.randomBytes(32).toString('hex');
  const storedEncryptedKey = encrypt(rawSigningKey);

  const originalFindUniqueDevice = prisma.rfidDevice.findUnique;
  const originalFindUniqueStudent = prisma.student.findUnique;
  const originalFindFirstSession = prisma.attendanceSession.findFirst;

  try {
    (prisma.rfidDevice as any).findUnique = async ({ where }: any) => {
      if (where.roomId === testRoomId) {
        return {
          id: 101,
          roomId: testRoomId,
          signingKeyEncrypted: storedEncryptedKey,
          label: 'Lab 404',
          isActive: true,
          createdAt: new Date(),
        };
      }
      if (where.roomId === 'ROOM-INACTIVE') {
        return {
          id: 102,
          roomId: 'ROOM-INACTIVE',
          signingKeyEncrypted: storedEncryptedKey,
          label: 'Inactive Room',
          isActive: false,
          createdAt: new Date(),
        };
      }
      if (where.roomId === 'ROOM-CORRUPT-KEY') {
        return {
          id: 103,
          roomId: 'ROOM-CORRUPT-KEY',
          signingKeyEncrypted: 'invalid:iv:ciphertext',
          label: 'Corrupt Key Room',
          isActive: true,
          createdAt: new Date(),
        };
      }
      return null;
    };

    (prisma.student as any).findUnique = async ({ where }: any) => {
      if (where.rfidTag === testTag) {
        return {
          id: 77,
          studentId: 'STU-00077',
          firstName: 'Alice',
          lastName: 'Smith',
          rfidTag: testTag,
        };
      }
      return null;
    };

    (prisma.attendanceSession as any).findFirst = async ({ where }: any) => {
      if (where.scheduleSlot?.room === testRoomId) {
        return {
          id: 99,
          isActive: true,
          createdAt: new Date(),
          scheduleSlot: {
            id: 303,
            courseId: 12,
            room: testRoomId,
            doctorId: 5,
          },
        };
      }
      return null;
    };

    // 3. Test Valid Request (No Secret Transmitted)
    console.log('Testing valid RFID request signing & verification...');
    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = 'nonce-' + crypto.randomBytes(16).toString('hex');
    const canonicalString = `${testRoomId}:${testTag}:${timestamp}:${nonce}`;
    const signature = crypto
      .createHmac('sha256', rawSigningKey)
      .update(canonicalString)
      .digest('hex');

    const validPayload = {
      deviceId: testRoomId,
      rfidTag: testTag,
      timestamp,
      nonce,
      signature,
      // NO SECRET FIELD!
    };

    const validResult = await driver.validate(validPayload, {});
    assert.equal(validResult.valid, true, `Validation failed: ${validResult.errorMessage}`);
    assert.equal(validResult.metadata?.student.id, 77);
    assert.equal(validResult.metadata?.session.id, 99);
    console.log('  -> Valid signed request successfully verified');

    // 4. Test Replay Detection
    console.log('Testing anti-replay protection with identical nonce...');
    const replayResult = await driver.validate(validPayload, {});
    assert.equal(replayResult.valid, false);
    assert.equal(replayResult.errorCode, 'NONCE_REUSED');
    console.log('  -> Replay correctly rejected with NONCE_REUSED');

    // 5. Test Invalid Signature Rejection
    console.log('Testing rejection of forged signature...');
    const freshNonce = 'nonce-' + crypto.randomBytes(16).toString('hex');
    const forgedResult = await driver.validate({
      deviceId: testRoomId,
      rfidTag: testTag,
      timestamp: Math.floor(Date.now() / 1000),
      nonce: freshNonce,
      signature: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    }, {});
    assert.equal(forgedResult.valid, false);
    assert.equal(forgedResult.errorCode, 'INVALID_SIGNATURE');
    console.log('  -> Forged signature correctly rejected with INVALID_SIGNATURE');

    // 6. Test Timestamp Skew Outside ±60s Window
    console.log('Testing timestamp freshness rejection (>60s skew)...');
    const oldTimestamp = Math.floor(Date.now() / 1000) - 100;
    const skewNonce = 'nonce-' + crypto.randomBytes(16).toString('hex');
    const skewCanonical = `${testRoomId}:${testTag}:${oldTimestamp}:${skewNonce}`;
    const skewSig = crypto
      .createHmac('sha256', rawSigningKey)
      .update(skewCanonical)
      .digest('hex');

    const skewResult = await driver.validate({
      deviceId: testRoomId,
      rfidTag: testTag,
      timestamp: oldTimestamp,
      nonce: skewNonce,
      signature: skewSig,
    }, {});
    assert.equal(skewResult.valid, false);
    assert.equal(skewResult.errorCode, 'TIMESTAMP_OUT_OF_WINDOW');
    console.log('  -> Stale timestamp correctly rejected with TIMESTAMP_OUT_OF_WINDOW');

    // 7. Test Inactive Device Rejection
    console.log('Testing inactive device rejection...');
    const inactiveNonce = 'nonce-' + crypto.randomBytes(16).toString('hex');
    const inactiveResult = await driver.validate({
      deviceId: 'ROOM-INACTIVE',
      rfidTag: testTag,
      timestamp: Math.floor(Date.now() / 1000),
      nonce: inactiveNonce,
      signature: 'dummy-sig',
    }, {});
    assert.equal(inactiveResult.valid, false);
    assert.equal(inactiveResult.errorCode, 'DEVICE_INACTIVE');
    console.log('  -> Inactive device correctly rejected with DEVICE_INACTIVE');

    // 8. Test Unknown Device Rejection
    console.log('Testing unknown device rejection...');
    const unknownNonce = 'nonce-' + crypto.randomBytes(16).toString('hex');
    const unknownResult = await driver.validate({
      deviceId: 'ROOM-NONEXISTENT',
      rfidTag: testTag,
      timestamp: Math.floor(Date.now() / 1000),
      nonce: unknownNonce,
      signature: 'dummy-sig',
    }, {});
    assert.equal(unknownResult.valid, false);
    assert.equal(unknownResult.errorCode, 'UNKNOWN_DEVICE');
    console.log('  -> Unknown device correctly rejected with UNKNOWN_DEVICE');

    // 9. Test Corrupted Signing Key Handling
    console.log('Testing corrupted signing key in database...');
    const corruptNonce = 'nonce-' + crypto.randomBytes(16).toString('hex');
    const corruptResult = await driver.validate({
      deviceId: 'ROOM-CORRUPT-KEY',
      rfidTag: testTag,
      timestamp: Math.floor(Date.now() / 1000),
      nonce: corruptNonce,
      signature: 'dummy-sig',
    }, {});
    assert.equal(corruptResult.valid, false);
    assert.equal(corruptResult.errorCode, 'DEVICE_KEY_ERROR');
    console.log('  -> Corrupt key correctly caught with DEVICE_KEY_ERROR');

    // 10. Test buildIntent AttendanceIntent generation
    console.log('Testing buildIntent generation...');
    const intentNonce = 'nonce-' + crypto.randomBytes(16).toString('hex');
    const intentTs = Math.floor(Date.now() / 1000);
    const intentSig = crypto
      .createHmac('sha256', rawSigningKey)
      .update(`${testRoomId}:${testTag}:${intentTs}:${intentNonce}`)
      .digest('hex');

    const intent = await driver.buildIntent({
      deviceId: testRoomId,
      rfidTag: testTag,
      timestamp: intentTs,
      nonce: intentNonce,
      signature: intentSig,
    }, { ipAddress: '10.0.0.5' });

    assert.equal(intent.method, 'RFID');
    assert.equal(intent.studentId, 77);
    assert.equal(intent.sessionId, 99);
    assert.equal(intent.courseId, 12);
    assert.equal(intent.status, 'PRESENT');
    assert.equal(intent.ipAddress, '10.0.0.5');
    console.log('  -> AttendanceIntent built with correct status and student mapping');

    console.log('\n🎉 ALL 10 RFID REDESIGN VALIDATION TESTS PASSED CLEANLY! 🎉');
    process.exit(0);
  } finally {
    (prisma.rfidDevice as any).findUnique = originalFindUniqueDevice;
    (prisma.student as any).findUnique = originalFindUniqueStudent;
    (prisma.attendanceSession as any).findFirst = originalFindFirstSession;
  }
}

runRfidRedesignTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
