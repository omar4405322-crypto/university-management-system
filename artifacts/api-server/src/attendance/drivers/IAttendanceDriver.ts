import { AttendanceMethod, AttendanceStatus } from '@prisma/client';
import type { UserScope } from '../../utils/scope.utils';

export interface DriverValidationContext {
  studentId?: number;
  userId?: number;
  sessionId?: number;
  ipAddress?: string;
  userAgent?: string;
  semester?: number;
  courseId?: number;
  actor?: UserScope;
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
  locationData?: { lat?: number | null; lng?: number | null; accuracy?: number | null } | null;
  locationFlagged?: boolean;
  pendingApprovedStatus?: AttendanceStatus | null;
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
