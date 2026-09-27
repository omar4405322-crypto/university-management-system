import crypto from 'crypto';
import prisma from '../utils/prismaClient';
import { AppError } from '../utils/appError';
import { encrypt } from '../utils/encryption.utils';

export class AttendanceDeviceService {
  /**
   * Provisions a new physical RFID scanning device for a room.
   * Generates a unique 256-bit cryptographically secure signing key, encrypts it
   * at rest using AES-256-GCM, and returns the raw plaintext key exactly once
   * for flashing into device firmware.
   */
  static async provisionRfidDevice(data: { roomId: string; label?: string }) {
    const roomId = data.roomId?.trim();
    if (!roomId) {
      throw new AppError('Room ID (device identifier) is required', 400);
    }

    const existing = await prisma.rfidDevice.findUnique({
      where: { roomId },
    });
    if (existing) {
      throw new AppError(`An RFID device is already provisioned for room: ${roomId}`, 409);
    }

    // Generate 32-byte (256-bit) cryptographically strong signing key
    const signingKey = crypto.randomBytes(32).toString('hex');
    const signingKeyEncrypted = encrypt(signingKey);

    const device = await prisma.rfidDevice.create({
      data: {
        roomId,
        label: data.label?.trim() || null,
        signingKeyEncrypted,
        isActive: true,
      },
      select: {
        id: true,
        roomId: true,
        label: true,
        isActive: true,
        createdAt: true,
      },
    });

    return {
      ...device,
      signingKey, // Returned exactly once in provisioning response!
      warning:
        'Store this signing key securely and flash it directly into device firmware. The plaintext key is encrypted at rest and cannot be retrieved again.',
    };
  }

  /**
   * Lists provisioned RFID devices (never exposes signing keys).
   */
  static async listRfidDevices() {
    return prisma.rfidDevice.findMany({
      select: {
        id: true,
        roomId: true,
        label: true,
        isActive: true,
        lastSeenAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}

export default AttendanceDeviceService;
