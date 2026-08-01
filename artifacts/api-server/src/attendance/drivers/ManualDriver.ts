import { AttendanceMethod, AttendanceStatus } from '@prisma/client';
import {
  IAttendanceDriver,
  DriverValidationContext,
  DriverValidationResult,
  AttendanceIntent,
} from './IAttendanceDriver';
import { AppError } from '../../utils/appError';

export class ManualDriver implements IAttendanceDriver {
  readonly method: AttendanceMethod = AttendanceMethod.MANUAL;

  async validate(
    rawPayload: Record<string, any>,
    ctx: DriverValidationContext
  ): Promise<DriverValidationResult> {
    const { studentId, status } = rawPayload;

    if (!studentId) {
      return {
        valid: false,
        errorCode: 'MISSING_STUDENT_ID',
        errorMessage: 'Student ID is required for manual attendance',
      };
    }

    if (typeof studentId !== 'number' && isNaN(parseInt(studentId))) {
      return {
        valid: false,
        errorCode: 'INVALID_STUDENT_ID',
        errorMessage: 'Student ID must be a valid integer',
      };
    }

    if (status && !['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'].includes(status)) {
      return {
        valid: false,
        errorCode: 'INVALID_STATUS',
        errorMessage: 'Status must be one of: PRESENT, ABSENT, LATE, EXCUSED',
      };
    }

    return { valid: true, metadata: {} };
  }

  async buildIntent(
    rawPayload: Record<string, any>,
    ctx: DriverValidationContext
  ): Promise<AttendanceIntent> {
    const validation = await this.validate(rawPayload, ctx);
    if (!validation.valid) {
      throw new AppError(validation.errorMessage || 'Validation failed', 400);
    }

    const intent: AttendanceIntent = {
      studentId: parseInt(rawPayload.studentId),
      method: this.method,
      status: (rawPayload.status as AttendanceStatus) || 'PRESENT',
      remarks: rawPayload.remarks || null,
      recordedById: ctx.userId || null,
      ipAddress: ctx.ipAddress || null,
      deviceId: rawPayload.deviceId || null,
      sessionId: rawPayload.sessionId || ctx.sessionId || null,
      date: rawPayload.date ? new Date(rawPayload.date) : undefined,
    };

    return intent;
  }
}
