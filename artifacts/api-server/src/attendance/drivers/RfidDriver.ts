/**
 * RFID Hardware Attendance Protocol Contract (ESP32 + Reader)
 * =============================================================
 * Target Hardware: ESP32 microcontroller paired with RFID/NFC reader (RC522 / PN532).
 * Hardware provisions: Each reader is assigned a unique device identifier (`deviceId`)
 * and a 32-byte cryptographic signing key generated server-side during provisioning.
 *
 * Endpoint:
 *   POST /api/attendance/rfid
 *   Content-Type: application/json
 *
 * Request Payload Fields:
 *   - deviceId  (string, required): Hardware identifier matching RfidDevice.roomId (e.g. "ROOM-101")
 *   - rfidTag   (string, required): UID read from student RFID card/fob (e.g. "E280116060000204")
 *   - timestamp (number|string, required): Current epoch in seconds or milliseconds
 *   - nonce     (string, required): Unique random nonce (UUID or >=16 hex chars; anti-replay)
 *   - signature (string, required): HMAC-SHA256 signature (hex or base64)
 *
 * Header Fallbacks:
 *   X-Timestamp, X-Nonce, X-Signature (or X-HMAC)
 *
 * Canonical Signing String:
 *   `${deviceId}:${rfidTag}:${timestamp}:${nonce}`
 *
 * Signing Algorithm:
 *   HMAC-SHA256(signingKey, `${deviceId}:${rfidTag}:${timestamp}:${nonce}`)
 *   The signature should be formatted as a lowercase hex string (or standard Base64).
 *
 * Security Model:
 *   1. Zero Secret Transmission: The device NEVER transmits its raw secret/key over the network.
 *   2. Cryptographic Authentication: The server retrieves the device's signing key (encrypted at rest
 *      with AES-256-GCM), decrypts it, and verifies the HMAC using constant-time comparison.
 *   3. Timestamp Freshness: Requests outside the allowed ±60s clock skew window are rejected (401).
 *   4. Anti-Replay Ledger: Nonces are tracked in Redis (or memory fallback) with a 120s TTL (SET NX EX).
 *      Repeated nonces for the same device within the TTL are rejected as replays (401).
 */

import { AttendanceMethod, AttendanceStatus } from '@prisma/client';
import crypto from 'crypto';
import {
  IAttendanceDriver,
  DriverValidationContext,
  DriverValidationResult,
  AttendanceIntent,
} from './IAttendanceDriver';
import { AppError } from '../../utils/appError';
import prisma from '../../utils/prismaClient';
import { setIfNotExists, redis } from '../../utils/redis.utils';
import { decrypt } from '../../utils/encryption.utils';
import logger from '../../utils/logger';

// In-memory fallback for non-Redis environments (testing/local development)
const usedRfidNonces = new Set<string>();

export class RfidDriver implements IAttendanceDriver {
  readonly method: AttendanceMethod = AttendanceMethod.RFID;

  async validate(
    rawPayload: Record<string, any>,
    ctx: DriverValidationContext
  ): Promise<DriverValidationResult> {
    const { deviceId, rfidTag, timestamp, nonce, signature, hmac } = rawPayload;
    const reqSignature = signature || hmac;

    if (!deviceId) {
      return {
        valid: false,
        errorCode: 'MISSING_DEVICE_ID',
        errorMessage: 'Device ID is required',
      };
    }

    if (!rfidTag) {
      return {
        valid: false,
        errorCode: 'MISSING_RFID_TAG',
        errorMessage: 'RFID tag is required',
      };
    }

    if (timestamp === undefined || timestamp === null || timestamp === '') {
      return {
        valid: false,
        errorCode: 'MISSING_TIMESTAMP',
        errorMessage: 'Request timestamp is required',
      };
    }

    if (!nonce || typeof nonce !== 'string' || nonce.trim().length === 0) {
      return {
        valid: false,
        errorCode: 'MISSING_NONCE',
        errorMessage: 'Request nonce is required',
      };
    }

    if (!reqSignature || typeof reqSignature !== 'string' || reqSignature.trim().length === 0) {
      return {
        valid: false,
        errorCode: 'MISSING_SIGNATURE',
        errorMessage: 'Request signature is required',
      };
    }

    // 1. Timestamp freshness check (±60 seconds window)
    const now = Date.now();
    let reqTimestampMs: number;

    if (typeof timestamp === 'number') {
      reqTimestampMs = timestamp < 1e11 ? timestamp * 1000 : timestamp;
    } else if (typeof timestamp === 'string') {
      const num = Number(timestamp);
      if (!isNaN(num) && isFinite(num)) {
        reqTimestampMs = num < 1e11 ? num * 1000 : num;
      } else {
        reqTimestampMs = new Date(timestamp).getTime();
      }
    } else {
      reqTimestampMs = NaN;
    }

    if (isNaN(reqTimestampMs)) {
      return {
        valid: false,
        errorCode: 'INVALID_TIMESTAMP',
        errorMessage: 'Invalid timestamp format',
      };
    }

    const clockSkewMs = Math.abs(now - reqTimestampMs);
    if (clockSkewMs > 60 * 1000) {
      return {
        valid: false,
        errorCode: 'TIMESTAMP_OUT_OF_WINDOW',
        errorMessage: 'Request timestamp is outside the allowed ±60s window',
      };
    }

    // 2. Device lookup
    const device = await prisma.rfidDevice.findUnique({
      where: { roomId: deviceId },
    });

    if (!device) {
      return {
        valid: false,
        errorCode: 'UNKNOWN_DEVICE',
        errorMessage: 'Unauthorized RFID device',
      };
    }

    if (!device.isActive) {
      return {
        valid: false,
        errorCode: 'DEVICE_INACTIVE',
        errorMessage: 'RFID device is not active',
      };
    }

    if (!device.signingKeyEncrypted) {
      logger.error(`[RFID] Device missing encrypted signing key: ${deviceId}`);
      return {
        valid: false,
        errorCode: 'DEVICE_KEY_ERROR',
        errorMessage: 'Device authentication configuration error',
      };
    }

    // 3. Decrypt stored signing key
    let signingKey: string;
    try {
      signingKey = decrypt(device.signingKeyEncrypted);
    } catch (decryptErr) {
      logger.error(`[RFID] Failed to decrypt device signing key for ${deviceId}: ${decryptErr}`);
      return {
        valid: false,
        errorCode: 'DEVICE_KEY_ERROR',
        errorMessage: 'Device authentication configuration error',
      };
    }

    // 4. Per-device HMAC request signature verification (timing-safe)
    const cleanNonce = nonce.trim();
    const canonicalString = `${deviceId}:${rfidTag}:${timestamp}:${cleanNonce}`;
    const expectedSigHex = crypto
      .createHmac('sha256', signingKey)
      .update(canonicalString)
      .digest('hex');
    const expectedSigBase64 = crypto
      .createHmac('sha256', signingKey)
      .update(canonicalString)
      .digest('base64');

    const cleanSig = reqSignature.trim();
    let isSigValid = false;

    try {
      const sigBuf = Buffer.from(cleanSig.toLowerCase(), 'hex');
      const expBuf = Buffer.from(expectedSigHex.toLowerCase(), 'hex');
      if (sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf)) {
        isSigValid = true;
      } else if (cleanSig === expectedSigBase64) {
        isSigValid = true;
      }
    } catch {
      isSigValid = false;
    }

    if (!isSigValid) {
      return {
        valid: false,
        errorCode: 'INVALID_SIGNATURE',
        errorMessage: 'Invalid request signature',
      };
    }

    // 5. Redis-backed nonce ledger (SET key NX EX 120) to reject replayed requests
    const nonceKey = `attendance:rfid_nonce:${device.roomId}:${cleanNonce}`;
    const ttlSeconds = 120;

    if (redis) {
      const nonceClaimed = await setIfNotExists(nonceKey, '1', ttlSeconds);
      if (!nonceClaimed) {
        return {
          valid: false,
          errorCode: 'NONCE_REUSED',
          errorMessage: 'Replay detected: Nonce has already been used',
        };
      }
    } else {
      if (usedRfidNonces.has(nonceKey)) {
        return {
          valid: false,
          errorCode: 'NONCE_REUSED',
          errorMessage: 'Replay detected: Nonce has already been used',
        };
      }
      usedRfidNonces.add(nonceKey);
      setTimeout(() => usedRfidNonces.delete(nonceKey), ttlSeconds * 1000);
    }

    // 6. Student lookup by tag
    const student = await prisma.student.findUnique({
      where: { rfidTag },
    });

    if (!student) {
      return {
        valid: false,
        errorCode: 'UNKNOWN_RFID_TAG',
        errorMessage: 'Unknown RFID tag',
      };
    }

    // 7. Active session lookup for the room
    const session = await prisma.attendanceSession.findFirst({
      where: {
        isActive: true,
        scheduleSlot: {
          room: device.roomId,
        },
      },
      include: { scheduleSlot: true },
    });

    if (!session) {
      return {
        valid: false,
        errorCode: 'NO_ACTIVE_SESSION',
        errorMessage: 'No active session for this room',
      };
    }

    return {
      valid: true,
      metadata: { device, student, session },
    };
  }

  async buildIntent(
    rawPayload: Record<string, any>,
    ctx: DriverValidationContext
  ): Promise<AttendanceIntent> {
    const validation = await this.validate(rawPayload, ctx);
    if (!validation.valid) {
      const authErrorCodes = [
        'UNKNOWN_DEVICE',
        'INVALID_SIGNATURE',
        'TIMESTAMP_OUT_OF_WINDOW',
        'NONCE_REUSED',
        'MISSING_SIGNATURE',
        'MISSING_TIMESTAMP',
        'MISSING_NONCE',
        'DEVICE_INACTIVE',
        'DEVICE_KEY_ERROR',
      ];
      const isAuthError = authErrorCodes.includes(validation.errorCode || '');
      throw new AppError(
        validation.errorMessage || 'RFID validation failed',
        isAuthError ? 401 : 400
      );
    }

    const { student, session } = validation.metadata!;

    const attendanceDate = new Date(session.createdAt);
    attendanceDate.setHours(0, 0, 0, 0);

    let recordedById: number | null = null;
    if (session?.scheduleSlot?.doctorId) {
      const doctor = await prisma.doctor.findUnique({
        where: { id: session.scheduleSlot.doctorId },
        select: { userId: true },
      });
      recordedById = doctor?.userId ?? null;
    }

    return {
      studentId: student.id,
      method: this.method,
      sessionId: session.id,
      courseId: session.scheduleSlot.courseId,
      scheduleSlotId: session.scheduleSlot.id,
      status: 'PRESENT' as AttendanceStatus,
      recordedById,
      ipAddress: ctx.ipAddress || null,
      deviceId: rawPayload.deviceId || null,
      date: attendanceDate,
    };
  }
}
