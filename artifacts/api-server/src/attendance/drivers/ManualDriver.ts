import { AttendanceMethod, AttendanceStatus } from '@prisma/client';
import {
  IAttendanceDriver,
  DriverValidationContext,
  DriverValidationResult,
  AttendanceIntent,
} from './IAttendanceDriver';
import { AppError } from '../../utils/appError';
import { requireManualAttendanceAccess } from '../../utils/manualAttendanceScope.utils';
import prisma from '../../utils/prismaClient';
import { getEffectiveActiveStudentWhere } from '../../utils/scope.utils';

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

    // Preserve the authorization-first ordering from the manual attendance
    // scope guard before revealing whether the target student is active.
    await requireManualAttendanceAccess(rawPayload, ctx);

    const activeStudent = await prisma.student.findFirst({
      where: getEffectiveActiveStudentWhere({ id: parseInt(studentId) }),
      select: { id: true },
    });
    if (!activeStudent) {
      return {
        valid: false,
        errorCode: 'STUDENT_INACTIVE',
        errorMessage: 'Student account is inactive',
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

    const access = await requireManualAttendanceAccess(rawPayload, ctx);
    const intent: AttendanceIntent = {
      studentId: parseInt(rawPayload.studentId),
      method: this.method,
      status: (rawPayload.status as AttendanceStatus) || 'PRESENT',
      remarks: rawPayload.remarks || null,
      recordedById: ctx.userId || null,
      ipAddress: ctx.ipAddress || null,
      deviceId: rawPayload.deviceId || null,
      courseId: access.courseId,
      sessionId: access.sessionId || null,
      date: rawPayload.date ? new Date(rawPayload.date) : undefined,
    };

    return intent;
  }
}
