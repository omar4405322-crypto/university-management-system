import { AttendanceMethod, AttendanceStatus } from "@prisma/client";
import speakeasy from "speakeasy";
import bcrypt from "bcryptjs";
import {
  IAttendanceDriver,
  DriverValidationContext,
  DriverValidationResult,
  AttendanceIntent,
} from "./IAttendanceDriver";
import { AppError } from "../../utils/appError";
import prisma from "../../utils/prismaClient";
import { setIfNotExists, redis } from "../../utils/redis.utils";
import { decrypt } from "../../utils/encryption.utils";
import type Redis from "ioredis";

type RedisSetClient = Pick<Redis, "set">;
type ClaimQrToken = (tokenKey: string, ttlSeconds: number) => Promise<boolean>;

export const claimQrToken = async (
  tokenKey: string,
  ttlSeconds: number,
  client: RedisSetClient | null = redis,
): Promise<boolean> => {
  return setIfNotExists(tokenKey, "1", ttlSeconds, client);
};

const normalizeArabicNumerals = (token: string): string => {
  return token
    .replace(/[٠۰]/g, "0")
    .replace(/[١۱]/g, "1")
    .replace(/[٢۲]/g, "2")
    .replace(/[٣۳]/g, "3")
    .replace(/[٤۴]/g, "4")
    .replace(/[٥۵]/g, "5")
    .replace(/[٦۶]/g, "6")
    .replace(/[٧۷]/g, "7")
    .replace(/[٨۸]/g, "8")
    .replace(/[٩۹]/g, "9");
};

export class QrDriver implements IAttendanceDriver {
  readonly method: AttendanceMethod = AttendanceMethod.QR;

  constructor(private readonly claimToken: ClaimQrToken = claimQrToken) {}

  async validate(
    rawPayload: Record<string, any>,
    ctx: DriverValidationContext,
  ): Promise<DriverValidationResult> {
    const rawToken = String(rawPayload.token || "").trim();
    const cleanToken = normalizeArabicNumerals(rawToken);

    if (!cleanToken) {
      return {
        valid: false,
        errorCode: "MISSING_TOKEN",
        errorMessage: "يرجى إدخال الرمز الخاص بالمحاضرة",
      };
    }

    const rawSessionId = rawPayload.sessionId;
    const requiredSessionId =
      typeof rawSessionId === "number"
        ? rawSessionId
        : typeof rawSessionId === "string" && /^[1-9]\d*$/.test(rawSessionId)
          ? Number(rawSessionId)
          : Number.NaN;
    if (!Number.isSafeInteger(requiredSessionId) || requiredSessionId <= 0) {
      return {
        valid: false,
        errorCode: "SESSION_REQUIRED",
        errorMessage: "معرف جلسة الحضور مطلوب.",
      };
    }

    const requiredDeviceId =
      typeof rawPayload.deviceId === "string"
        ? rawPayload.deviceId.trim().toLowerCase()
        : "";
    if (requiredDeviceId.length < 8 || requiredDeviceId.length > 255) {
      return {
        valid: false,
        errorCode: "DEVICE_REQUIRED",
        errorMessage: "معرف الجهاز مطلوب لتسجيل الحضور.",
      };
    }

    if (rawPayload.latitude != null) {
      const lat = parseFloat(rawPayload.latitude);
      if (isNaN(lat) || lat < -90 || lat > 90) {
        return {
          valid: false,
          errorCode: "INVALID_COORDINATES",
          errorMessage:
            "إحداثيات الموقع خارج النطاق المسموح به (-90 إلى 90 لخط العرض)",
        };
      }
    }

    if (rawPayload.longitude != null) {
      const lng = parseFloat(rawPayload.longitude);
      if (isNaN(lng) || lng < -180 || lng > 180) {
        return {
          valid: false,
          errorCode: "INVALID_COORDINATES",
          errorMessage:
            "إحداثيات الموقع خارج النطاق المسموح به (-180 إلى 180 لخط الطول)",
        };
      }
    }

    const verifyTokenForSession = (s: any) => {
      let secret = s.secretKey;
      try {
        secret = decrypt(s.secretKey);
      } catch {
        return false;
      }
      return speakeasy.totp.verify({
        secret,
        encoding: "base32",
        token: cleanToken,
        step: s.codeStepSeconds || 20,
        window: 1,
      });
    };

    const foundSession = await prisma.attendanceSession.findUnique({
      where: { id: requiredSessionId },
      include: { scheduleSlot: { include: { course: true } } },
    });
    const session =
      foundSession &&
      foundSession.isActive &&
      verifyTokenForSession(foundSession)
        ? foundSession
        : null;

    if (!session) {
      return {
        valid: false,
        errorCode: "INVALID_TOKEN",
        errorMessage:
          "الرمز اليدوي غير صحيح أو انتهت صلاحيته. يرجى تجربة الرمز الظاهر حالياً على الشاشة.",
      };
    }

    const studentId = ctx.studentId ?? rawPayload.studentId;
    if (!studentId) {
      return {
        valid: false,
        errorCode: "STUDENT_REQUIRED",
        errorMessage: "معرف الطالب مطلوب لتسجيل الحضور.",
      };
    }

    const tokenKey = `attendance:used_token:${session.id}:${studentId}:${cleanToken}`;
    const ttlSeconds = (session.codeStepSeconds || 20) * 3;

    const tokenClaimed = await this.claimToken(tokenKey, ttlSeconds);
    if (!tokenClaimed) {
      return {
        valid: false,
        errorCode: "TOKEN_REUSED",
        errorMessage: "تم استخدام هذا الرمز بالفعل، يرجى انتظار الرمز التالي.",
      };
    }

    if (!session.isActive) {
      return {
        valid: false,
        errorCode: "SESSION_INACTIVE",
        errorMessage: "انتهت صلاحية هذه الجلسة.",
      };
    }

    if (session.expiresAt && new Date() > session.expiresAt) {
      return {
        valid: false,
        errorCode: "SESSION_EXPIRED",
        errorMessage: "انتهت صلاحية هذه الجلسة.",
      };
    }

    return {
      valid: true,
      metadata: { session, cleanToken, deviceId: requiredDeviceId },
    };
  }

  async buildIntent(
    rawPayload: Record<string, any>,
    ctx: DriverValidationContext,
  ): Promise<AttendanceIntent> {
    const validation = await this.validate(rawPayload, ctx);
    if (!validation.valid) {
      throw new AppError(validation.errorMessage || "Invalid QR token", 400);
    }

    const { session, deviceId } = validation.metadata!;

    const latitude =
      rawPayload.latitude != null && !isNaN(parseFloat(rawPayload.latitude))
        ? parseFloat(rawPayload.latitude)
        : null;
    const longitude =
      rawPayload.longitude != null && !isNaN(parseFloat(rawPayload.longitude))
        ? parseFloat(rawPayload.longitude)
        : null;
    const accuracy =
      rawPayload.accuracy != null && !isNaN(parseFloat(rawPayload.accuracy))
        ? parseFloat(rawPayload.accuracy)
        : null;

    let isOutOfRange = false;
    let locationFlagged = false;

    if (session.latitude != null && session.longitude != null) {
      if (latitude != null && longitude != null) {
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
          isOutOfRange = true;
          locationFlagged = true;
        }
      } else {
        // Geofenced session but student request missing coordinates
        isOutOfRange = true;
        locationFlagged = true;
      }
    }

    const now = new Date();
    const sessionStartTime = new Date(session.createdAt).getTime();
    const elapsedMinutes = (now.getTime() - sessionStartTime) / (1000 * 60);
    const gracePeriodMinutes = session.gracePeriodMins ?? 15;
    const computedStatus: AttendanceStatus =
      elapsedMinutes <= gracePeriodMinutes ? "PRESENT" : "LATE";

    let finalStatus: AttendanceStatus = computedStatus;
    let pendingApprovedStatus: AttendanceStatus | null = null;

    if (isOutOfRange) {
      locationFlagged = true;
      finalStatus = "PENDING_REVIEW" as AttendanceStatus;
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
