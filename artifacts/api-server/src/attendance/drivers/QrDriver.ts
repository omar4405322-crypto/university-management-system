import { AttendanceMethod, AttendanceStatus } from '@prisma/client';
import speakeasy from 'speakeasy';
import bcrypt from 'bcryptjs';
import {
  IAttendanceDriver,
  DriverValidationContext,
  DriverValidationResult,
  AttendanceIntent,
} from './IAttendanceDriver';
import { AppError } from '../../utils/appError';
import prisma from '../../utils/prismaClient';
import { getCache, setCache } from '../../utils/redis.utils';
import logger from '../../utils/logger';

const usedTokens = new Set<string>();

const normalizeArabicNumerals = (token: string): string => {
  return token
    .replace(/[٠۰]/g, '0')
    .replace(/[١۱]/g, '1')
    .replace(/[٢۲]/g, '2')
    .replace(/[٣۳]/g, '3')
    .replace(/[٤۴]/g, '4')
    .replace(/[٥۵]/g, '5')
    .replace(/[٦۶]/g, '6')
    .replace(/[٧۷]/g, '7')
    .replace(/[٨۸]/g, '8')
    .replace(/[٩۹]/g, '9');
};

export class QrDriver implements IAttendanceDriver {
  readonly method: AttendanceMethod = AttendanceMethod.QR;

  async validate(
    rawPayload: Record<string, any>,
    ctx: DriverValidationContext
  ): Promise<DriverValidationResult> {
    const rawToken = String(rawPayload.token || '').trim();
    const cleanToken = normalizeArabicNumerals(rawToken);

    if (!cleanToken) {
      return {
        valid: false,
        errorCode: 'MISSING_TOKEN',
        errorMessage: 'يرجى إدخال الرمز الخاص بالمحاضرة',
      };
    }

    let sessionId = rawPayload.sessionId;
    let session: any = null;

    const verifyTokenForSession = (s: any) => {
      return speakeasy.totp.verify({
        secret: s.secretKey,
        encoding: 'base32',
        token: cleanToken,
        step: s.codeStepSeconds || 20,
        window: 1,
      });
    };

    if (sessionId) {
      const foundSession = await prisma.attendanceSession.findUnique({
        where: { id: parseInt(sessionId) },
        include: { scheduleSlot: { include: { course: true } } },
      });

      if (foundSession && foundSession.isActive) {
        const isValid = verifyTokenForSession(foundSession);
        if (isValid) {
          session = foundSession;
        }
      }
    }

    if (!session) {
      const activeSessions = await prisma.attendanceSession.findMany({
        where: { isActive: true },
        include: { scheduleSlot: { include: { course: true } } },
      });

      for (const s of activeSessions) {
        if (verifyTokenForSession(s)) {
          session = s;
          sessionId = s.id;
          break;
        }
      }
    }

    if (!session) {
      return {
        valid: false,
        errorCode: 'INVALID_TOKEN',
        errorMessage:
          'الرمز اليدوي غير صحيح أو انتهت صلاحيته. يرجى تجربة الرمز الظاهر حالياً على الشاشة.',
      };
    }

    const tokenKey = `attendance:used_token:${session.id}:${cleanToken}`;
    const isUsedCache = await getCache(tokenKey);

    if (isUsedCache || usedTokens.has(tokenKey)) {
      return {
        valid: false,
        errorCode: 'TOKEN_REUSED',
        errorMessage: 'تم استخدام هذا الرمز بالفعل، يرجى انتظار الرمز التالي.',
      };
    }

    usedTokens.add(tokenKey);
    setTimeout(
      () => usedTokens.delete(tokenKey),
      (session.codeStepSeconds || 20) * 3000
    );
    await setCache(tokenKey, '1', (session.codeStepSeconds || 20) * 3);

    if (!session.isActive) {
      return {
        valid: false,
        errorCode: 'SESSION_INACTIVE',
        errorMessage: 'انتهت صلاحية هذه الجلسة.',
      };
    }

    if (session.expiresAt && new Date() > session.expiresAt) {
      return {
        valid: false,
        errorCode: 'SESSION_EXPIRED',
        errorMessage: 'انتهت صلاحية هذه الجلسة.',
      };
    }

    return {
      valid: true,
      metadata: { session, cleanToken },
    };
  }

  async buildIntent(
    rawPayload: Record<string, any>,
    ctx: DriverValidationContext
  ): Promise<AttendanceIntent> {
    const validation = await this.validate(rawPayload, ctx);
    if (!validation.valid) {
      throw new AppError(validation.errorMessage || 'Invalid QR token', 400);
    }

    const { session } = validation.metadata!;
    const { latitude, longitude, deviceId } = rawPayload;

    let locationFlagged = false;
    if (session.latitude && session.longitude && latitude && longitude) {
      const R = 6371e3;
      const φ1 = (session.latitude * Math.PI) / 180;
      const φ2 = (latitude * Math.PI) / 180;
      const Δφ = ((latitude - session.latitude) * Math.PI) / 180;
      const Δλ = ((longitude - session.longitude) * Math.PI) / 180;

      const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c;

      if (distance > (session.radius || 120)) {
        locationFlagged = true;
      }
    } else if (session.latitude && session.longitude) {
      locationFlagged = true;
    }

    const now = new Date();
    const sessionStartTime = new Date(session.createdAt).getTime();
    const elapsedMinutes = (now.getTime() - sessionStartTime) / (1000 * 60);
    const gracePeriodMinutes = session.gracePeriodMins ?? 15;
    const computedStatus: AttendanceStatus =
      elapsedMinutes <= gracePeriodMinutes ? 'PRESENT' : 'LATE';

    const attendanceDate = new Date(session.createdAt);
    attendanceDate.setHours(0, 0, 0, 0);

    return {
      studentId: ctx.studentId!,
      method: this.method,
      sessionId: session.id,
      courseId: session.scheduleSlot.courseId,
      scheduleSlotId: session.scheduleSlot.id,
      status: computedStatus,
      ipAddress: ctx.ipAddress || null,
      deviceId: deviceId || null,
      locationData: { lat: latitude || null, lng: longitude || null },
      locationFlagged,
      date: attendanceDate,
    };
  }
}
