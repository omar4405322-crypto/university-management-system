import { AttendanceMethod, AttendanceStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import {
  IAttendanceDriver,
  DriverValidationContext,
  DriverValidationResult,
  AttendanceIntent,
} from './IAttendanceDriver';
import { AppError } from '../../utils/appError';
import prisma from '../../utils/prismaClient';

export class RfidDriver implements IAttendanceDriver {
  readonly method: AttendanceMethod = AttendanceMethod.RFID;

  async validate(
    rawPayload: Record<string, any>,
    ctx: DriverValidationContext
  ): Promise<DriverValidationResult> {
    const { deviceId, rfidTag, secret } = rawPayload;

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

    if (!secret) {
      return {
        valid: false,
        errorCode: 'MISSING_DEVICE_SECRET',
        errorMessage: 'Device secret is required for authentication',
      };
    }

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

    const validSecret = await bcrypt.compare(secret, device.secretHash);
    if (!validSecret) {
      return {
        valid: false,
        errorCode: 'INVALID_SECRET',
        errorMessage: 'Unauthorized RFID device',
      };
    }

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
      throw new AppError(validation.errorMessage || 'RFID validation failed', validation.errorCode === 'UNKNOWN_DEVICE' || validation.errorCode === 'INVALID_SECRET' ? 401 : 400);
    }

    const { student, session } = validation.metadata!;

    const attendanceDate = new Date(session.createdAt);
    attendanceDate.setHours(0, 0, 0, 0);

    return {
      studentId: student.id,
      method: this.method,
      sessionId: session.id,
      courseId: session.scheduleSlot.courseId,
      scheduleSlotId: session.scheduleSlot.id,
      status: 'PRESENT' as AttendanceStatus,
      recordedById: null,
      ipAddress: ctx.ipAddress || null,
      deviceId: rawPayload.deviceId || null,
      date: attendanceDate,
    };
  }
}
