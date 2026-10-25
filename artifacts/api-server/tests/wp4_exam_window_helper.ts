import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { EXAM_SUBMISSION_GRACE_MS } from '../src/utils/examTiming.utils';

export const CAIRO_TZ = 'Africa/Cairo';

export interface ExamWindowFixture {
  date: Date;
  startTime: string;
  endTime: string;
}

/**
 * Pure function to construct a consistent Cairo exam window { date, startTime, endTime }
 * derived from computed instants, preventing midnight clock-drift bugs.
 *
 * @param instant Reference instant (e.g. now / injected instant)
 * @param kind 'open' (active exam session), 'grace' (ended 1m ago, review gated), 'closed' (review allowed)
 */
export function buildExamWindow(
  instant: Date,
  kind: 'open' | 'grace' | 'closed'
): ExamWindowFixture {
  const instantCairo = toZonedTime(instant, CAIRO_TZ);

  if (kind === 'open') {
    // Window active today enveloping instant: startTime 00:00, endTime 23:59
    const date = fromZonedTime(
      new Date(
        instantCairo.getFullYear(),
        instantCairo.getMonth(),
        instantCairo.getDate(),
        0,
        0,
        0,
        0
      ),
      CAIRO_TZ
    );
    return {
      date,
      startTime: '00:00',
      endTime: '23:59',
    };
  }

  // Minute-floored reference to ensure integer HH:mm representations
  const baseMs = Math.floor(instant.getTime() / 60000) * 60000;

  // For grace: end was 1 minute before now (inside the 3-minute grace)
  // For closed: end was before now minus grace (5 minutes before now)
  const offsetMs =
    kind === 'grace'
      ? -1 * 60000
      : -(EXAM_SUBMISSION_GRACE_MS + 2 * 60000); // 3m grace + 2m = 5m ago

  const targetEnd = new Date(baseMs + offsetMs);
  const endCairo = toZonedTime(targetEnd, CAIRO_TZ);

  const date = fromZonedTime(
    new Date(
      endCairo.getFullYear(),
      endCairo.getMonth(),
      endCairo.getDate(),
      0,
      0,
      0,
      0
    ),
    CAIRO_TZ
  );

  const endTime = `${String(endCairo.getHours()).padStart(2, '0')}:${String(
    endCairo.getMinutes()
  ).padStart(2, '0')}`;

  return {
    date,
    startTime: '00:00',
    endTime,
  };
}

/**
 * Pure function to compute milliseconds until an open exam window is possible.
 * If Cairo time-of-day is >= 23:59:00, an exam window ending at 23:59 is already closed/expired.
 * Returns 0 unless Cairo time-of-day >= 23:59:00, else ms until 00:00:05 Cairo of the next day.
 *
 * @param instant Reference instant
 */
export function msUntilOpenWindowPossible(instant: Date): number {
  const instantCairo = toZonedTime(instant, CAIRO_TZ);
  if (instantCairo.getHours() === 23 && instantCairo.getMinutes() === 59) {
    const nextDayCairo = new Date(
      instantCairo.getFullYear(),
      instantCairo.getMonth(),
      instantCairo.getDate() + 1,
      0,
      0,
      5,
      0
    );
    const nextDayTarget = fromZonedTime(nextDayCairo, CAIRO_TZ);
    return Math.max(0, nextDayTarget.getTime() - instant.getTime());
  }
  return 0;
}

