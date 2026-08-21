import { AttendanceMethod, AttendanceStatus } from '@prisma/client';

export interface DriverValidationContext {
  studentId?: number;
  userId?: number;
  sessionId?: number;
  ipAddress?: string;
  userAgent?: string;
  semester?: number;
  prismaTransaction?: any;
}

export interface DriverValidationResult {
  valid: boolean;
  errorCode?: string;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

export interface AttendanceIntent {
  studentId: number;
  method: AttendanceMethod;
  sessionId?: number | null;
  courseId?: number | null;
  scheduleSlotId?: number | null;
  status?: AttendanceStatus;
  remarks?: string | null;
  recordedById?: number | null;
  ipAddress?: string | null;
  deviceId?: string | null;
  locationData?: { lat?: number | null; lng?: number | null } | null;
  locationFlagged?: boolean;
  date?: Date;
}

export interface IAttendanceDriver {
  readonly method: AttendanceMethod;

  validate(
    rawPayload: Record<string, any>,
    ctx: DriverValidationContext
  ): Promise<DriverValidationResult>;

  buildIntent(
    rawPayload: Record<string, any>,
    ctx: DriverValidationContext
  ): Promise<AttendanceIntent>;
}
