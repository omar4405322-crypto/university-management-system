import assert from 'node:assert/strict';
import crypto from 'crypto';
import speakeasy from 'speakeasy';
import {
  createRefreshTokenValue,
  generateRefreshToken,
  hashRefreshToken,
  parseRefreshTokenMetadata,
} from '../src/utils/jwt.utils';
import { encrypt, decrypt } from '../src/utils/encryption.utils';
import prisma from '../src/utils/prismaClient';
import { QrDriver } from '../src/attendance/drivers/QrDriver';

async function runSec24Tests() {
  console.log('--- Starting SEC-24 Verification Test Suite ---');

  // ==========================================
  // Test 1: RefreshToken.token SHA-256 Hashing & familyId
  // ==========================================
  console.log('\n[Test 1] Testing RefreshToken hashing and familyId propagation...');
  const userId = 42;
  const tokenVersion = 0;
  const initialFamilyId = crypto.randomBytes(24).toString('hex');

  const rawToken = createRefreshTokenValue(userId, tokenVersion, initialFamilyId);
  const hashed = hashRefreshToken(rawToken);

  assert.notEqual(rawToken, hashed, 'Stored token must NOT be plaintext raw token');
  assert.equal(hashed.length, 64, 'Hashed token must be 64-hex-char SHA-256');
  assert.equal(
    hashRefreshToken(rawToken),
    hashed,
    'Hashing must be deterministic'
  );

  const parsed = parseRefreshTokenMetadata(rawToken);
  assert.ok(parsed, 'Raw token must be parseable');
  assert.equal(parsed.userId, userId);
  assert.equal(parsed.familyId, initialFamilyId);

  // In-memory simulation of DB store
  let dbRefreshToken = {
    id: 1,
    token: hashed,
    familyId: initialFamilyId,
    userId,
    expiresAt: new Date(Date.now() + 86400000),
  };

  // Lookup by incoming raw token
  const incomingRaw = rawToken;
  const lookupHash = hashRefreshToken(incomingRaw);
  assert.equal(dbRefreshToken.token, lookupHash, 'DB lookup by hashRefreshToken must match');

  // Rotation: propagate the same familyId
  const rotatedRaw = createRefreshTokenValue(userId, tokenVersion, dbRefreshToken.familyId);
  const rotatedParsed = parseRefreshTokenMetadata(rotatedRaw);
  assert.equal(
    rotatedParsed?.familyId,
    dbRefreshToken.familyId,
    'Rotated token must retain identical familyId'
  );
  console.log('✓ RefreshToken hashing and familyId verified');

  // ==========================================
  // Test 2: User.twoFactorSecret AES-256-GCM
  // ==========================================
  console.log('\n[Test 2] Testing User.twoFactorSecret AES-256-GCM encryption/decryption...');
  const originalSecret = speakeasy.generateSecret({ length: 20 }).base32;
  const encryptedSecret = encrypt(originalSecret);

  assert.notEqual(encryptedSecret, originalSecret, 'Stored secret must not be plaintext');
  const parts = encryptedSecret.split(':');
  assert.equal(parts.length, 3, 'Ciphertext format must be iv:authTag:ciphertext');
  assert.equal(parts[0].length, 24, 'IV must be 12 bytes (24 hex chars)');
  assert.equal(parts[1].length, 32, 'AuthTag must be 16 bytes (32 hex chars)');

  const decryptedSecret = decrypt(encryptedSecret);
  assert.equal(decryptedSecret, originalSecret, 'Decrypted secret must match original base32');

  // Generate TOTP with original and verify with decrypted
  const now = Math.floor(Date.now() / 1000);
  const totpCode = speakeasy.totp({
    secret: originalSecret,
    encoding: 'base32',
    time: now,
  });

  const isValidTotp = speakeasy.totp.verify({
    secret: decrypt(encryptedSecret),
    encoding: 'base32',
    token: totpCode,
    time: now,
    window: 1,
  });
  assert.equal(isValidTotp, true, 'TOTP verification with decrypted secret must succeed');
  console.log('✓ User.twoFactorSecret encryption and TOTP verification verified');

  // ==========================================
  // Test 3: AttendanceSession.secretKey AES-256-GCM
  // ==========================================
  console.log('\n[Test 3] Testing AttendanceSession.secretKey encryption and QrDriver decryption...');
  const sessionSecret = speakeasy.generateSecret({ length: 20 }).base32;
  const encryptedSessionKey = encrypt(sessionSecret);

  assert.notEqual(encryptedSessionKey, sessionSecret, 'Session secretKey must be encrypted at rest');
  const decryptedSessionKey = decrypt(encryptedSessionKey);
  assert.equal(decryptedSessionKey, sessionSecret, 'Decrypted session key must match original');

  // Test QrDriver TOTP verification with encrypted secretKey
  const qrDriver = new QrDriver();
  const sessionStep = 20;
  const currentSessionToken = speakeasy.totp({
    secret: sessionSecret,
    encoding: 'base32',
    step: sessionStep,
  });

  // Mock session record as stored in DB
  const mockSession = {
    id: 101,
    secretKey: encryptedSessionKey, // Encrypted at rest!
    codeStepSeconds: sessionStep,
    isActive: true,
    latitude: 30.0444,
    longitude: 31.2357,
    radius: 100,
    scheduleSlot: {
      id: 202,
      course: { id: 303, code: 'CS101' },
    },
  };

  // Temporarily stub prisma.attendanceSession.findUnique
  const origFindUnique = prisma.attendanceSession.findUnique;
  (prisma.attendanceSession as any).findUnique = async () => mockSession;

  try {
    const result = await qrDriver.validate(
      {
        sessionId: '101',
        token: currentSessionToken,
        studentId: 999,
        latitude: 30.0444,
        longitude: 31.2357,
      },
      { studentId: 999, ipAddress: '127.0.0.1' } as any
    );

    assert.equal(result.valid, true, 'QrDriver must validate TOTP against decrypted secretKey');
    assert.equal(result.metadata?.session.id, 101);
  } finally {
    (prisma.attendanceSession as any).findUnique = origFindUnique;
  }
  console.log('✓ AttendanceSession.secretKey encryption and QrDriver decryption verified');

  console.log('\n🎉 ALL SEC-24 ENCRYPTION & HASHING TESTS PASSED CLEANLY! 🎉');
}

runSec24Tests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
