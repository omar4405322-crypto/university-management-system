import { MAX_DECIMAL_PLACES } from './gradebook.utils';

export interface SessionPointsValidationResult {
  valid: boolean;
  value: number | undefined;
  errorKey: string | null;
}

const SESSION_POINTS_PATTERN = new RegExp(`^\\d+(\\.\\d{1,${MAX_DECIMAL_PLACES}})?$`);

export function validateSessionPoints(raw: string): SessionPointsValidationResult {
  const trimmed = (raw ?? '').trim();
  if (trimmed === '') {
    return {
      valid: true,
      value: undefined,
      errorKey: null,
    };
  }

  if (!SESSION_POINTS_PATTERN.test(trimmed)) {
    return {
      valid: false,
      value: undefined,
      errorKey: 'attendance.sessionPointsInvalid',
    };
  }

  const numericValue = Number(trimmed);
  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return {
      valid: false,
      value: undefined,
      errorKey: 'attendance.sessionPointsInvalid',
    };
  }

  return {
    valid: true,
    value: numericValue,
    errorKey: null,
  };
}

export function mapAttendanceStartError(
  rawMessage?: string | null,
  status?: number
): string {
  const msg = typeof rawMessage === 'string' ? rawMessage.trim() : '';

  if (status === 404 && msg.includes('ScheduleSlot')) {
    return 'attendance.noScheduleSlot';
  }

  if (msg.includes('Cumulative sessionPoints')) {
    return 'attendance.sessionPointsCumulativeExceeded';
  }

  if (msg.includes('exceeds AUTO_ATTENDANCE component maxPoints')) {
    return 'attendance.sessionPointsExceedsMax';
  }

  if (msg.includes('does not have an AUTO_ATTENDANCE component')) {
    return 'attendance.noAutoAttendanceComponent';
  }

  if (msg.includes('sessionPoints must be a finite number')) {
    return 'attendance.sessionPointsInvalid';
  }

  if (msg.length > 0) {
    return msg;
  }

  return 'attendance.startSessionError';
}

