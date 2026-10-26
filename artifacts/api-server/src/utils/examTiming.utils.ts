import { toZonedTime, fromZonedTime } from 'date-fns-tz';

export const CAIRO_TZ = 'Africa/Cairo';

/**
 * Exam Submission Timing & Grace Utilities
 *
 * D1: Unified 3-minute grace period used for both exam end window and student attempt duration deadline.
 */
export const EXAM_SUBMISSION_GRACE_MINUTES = 3;
export const EXAM_SUBMISSION_GRACE_MS = EXAM_SUBMISSION_GRACE_MINUTES * 60 * 1000;

export interface ExamTimingContext {
  date?: Date | string | null;
  endTime?: string | null;
  durationMinutes?: number | null;
}

/**
 * Calculates the exact attempt deadline in milliseconds without grace:
 * min(exam window end in Cairo, startedAt + durationMinutes)
 */
export function calculateAttemptDeadlineMs(
  exam: ExamTimingContext,
  startedAt?: Date | string | null,
): number {
  let windowEndMs: number | null = null;
  if (exam.date && exam.endTime) {
    const [h, m] = String(exam.endTime).split(':').map(Number);
    if (!isNaN(h) && !isNaN(m)) {
      const zonedDate = toZonedTime(new Date(exam.date), CAIRO_TZ);
      zonedDate.setHours(h, m, 0, 0);
      windowEndMs = fromZonedTime(zonedDate, CAIRO_TZ).getTime();
    }
  }

  const durationMinutes = Number(exam.durationMinutes) || 120;
  const startedAtMs = startedAt ? new Date(startedAt).getTime() : Date.now();
  const durationEndMs = startedAtMs + durationMinutes * 60 * 1000;

  return windowEndMs !== null ? Math.min(windowEndMs, durationEndMs) : durationEndMs;
}

/**
 * Returns the attempt deadline as an ISO string without grace.
 */
export function calculateAttemptEndsAt(
  exam: ExamTimingContext,
  startedAt?: Date | string | null,
): string {
  const deadlineMs = calculateAttemptDeadlineMs(exam, startedAt);
  return new Date(deadlineMs).toISOString();
}

