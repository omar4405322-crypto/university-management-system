import { AttendanceMethod, AttendanceStatus } from '@prisma/client';
import {
  IAttendanceDriver,
  DriverValidationContext,
  DriverValidationResult,
  AttendanceIntent,
} from './IAttendanceDriver';
import { AppError } from '../../utils/appError';
import prisma from '../../utils/prismaClient';

export class GpsDriver implements IAttendanceDriver {
  readonly method: AttendanceMethod = AttendanceMethod.GPS;

  async validate(
    rawPayload: Record<string, any>,
    ctx: DriverValidationContext
  ): Promise<DriverValidationResult> {
    const sessionId = rawPayload.sessionId;

    if (!sessionId) {
      return {
        valid: false,
        errorCode: 'MISSING_SESSION_ID',
        errorMessage: 'معرف الجلسة مطلوب لتسجيل الحضور عبر GPS',
      };
    }

    const session = await prisma.attendanceSession.findUnique({
      where: { id: parseInt(sessionId as any) },
      include: { scheduleSlot: { include: { course: true } } },
    });

    if (!session || !session.isActive) {
      return {
        valid: false,
        errorCode: 'SESSION_INACTIVE',
        errorMessage: 'الجلسة غير موجودة أو غير نشطة',
      };
    }

    if (session.expiresAt && new Date() > session.expiresAt) {
      return {
        valid: false,
        errorCode: 'SESSION_EXPIRED',
        errorMessage: 'انتهت صلاحية هذه الجلسة',
      };
    }

    if (session.latitude == null || session.longitude == null) {
      return {
        valid: false,
        errorCode: 'SESSION_LOCATION_NOT_CONFIGURED',
        errorMessage: 'موقع الجلسة غير محدد من قبل المحاضر',
      };
    }

    const latitude = rawPayload.latitude != null ? parseFloat(rawPayload.latitude) : null;
    const longitude = rawPayload.longitude != null ? parseFloat(rawPayload.longitude) : null;
    const accuracy =
      rawPayload.accuracy != null && !isNaN(parseFloat(rawPayload.accuracy))
        ? parseFloat(rawPayload.accuracy)
        : null;

    if (latitude == null || longitude == null || isNaN(latitude) || isNaN(longitude)) {
      return {
        valid: false,
        errorCode: 'MISSING_LOCATION_DATA',
        errorMessage: 'موقع الجهاز مطلوب لتسجيل الحضور',
      };
    }

    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return {
        valid: false,
        errorCode: 'INVALID_COORDINATES',
        errorMessage: 'إحداثيات الموقع خارج النطاق المسموح به (-90 إلى 90 لخط العرض، -180 إلى 180 لخط الطول)',
      };
    }

    return {
      valid: true,
      metadata: { session, latitude, longitude, accuracy },
    };
  }

  async buildIntent(
    rawPayload: Record<string, any>,
    ctx: DriverValidationContext
  ): Promise<AttendanceIntent> {
    const validation = await this.validate(rawPayload, ctx);
    if (!validation.valid) {
      throw new AppError(validation.errorMessage || 'Invalid GPS attendance payload', 400);
    }

    const { session, latitude, longitude, accuracy } = validation.metadata!;
    const { deviceId } = rawPayload;

    // Haversine formula matching QrDriver geofencing logic
    const R = 6371e3; // Earth radius in meters
    const φ1 = (session.latitude * Math.PI) / 180;
    const φ2 = (latitude * Math.PI) / 180;
    const Δφ = ((latitude - session.latitude) * Math.PI) / 180;
    const Δλ = ((longitude - session.longitude) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    const now = new Date();
    const sessionStartTime = new Date(session.createdAt).getTime();
    const elapsedMinutes = (now.getTime() - sessionStartTime) / (1000 * 60);
    const gracePeriodMinutes = session.gracePeriodMins ?? 15;
    const computedStatus: AttendanceStatus =
      elapsedMinutes <= gracePeriodMinutes ? 'PRESENT' : 'LATE';

    // Out of range check:
    // When distance exceeds session.radius (default 120):
    // - status is set to PENDING_REVIEW (not counted as present or absent)
    // - would-be status (computedStatus) stored in pendingApprovedStatus
    // - locationFlagged is set to true for visibility and admin review
    // Poor accuracy alone does NOT auto-forgive an out-of-range distance.
    const isOutOfRange = distance > (session.radius || 120);
    let locationFlagged = false;
    let finalStatus: AttendanceStatus = computedStatus;
    let pendingApprovedStatus: AttendanceStatus | null = null;

    if (isOutOfRange) {
      locationFlagged = true;
      finalStatus = 'PENDING_REVIEW' as AttendanceStatus;
      pendingApprovedStatus = computedStatus;
    }

    const attendanceDate = new Date(session.createdAt);
    attendanceDate.setHours(0, 0, 0, 0);

    return {
      studentId: ctx.studentId!,
      method: this.method,
      sessionId: session.id,
      courseId: session.scheduleSlot.courseId,
      scheduleSlotId: session.scheduleSlot.id,
      status: finalStatus,
      pendingApprovedStatus,
      ipAddress: ctx.ipAddress || null,
      deviceId: deviceId || null,
      locationData: { lat: latitude, lng: longitude, accuracy },
      locationFlagged,
      date: attendanceDate,
    };
  }
}

