import test from 'node:test';
import assert from 'node:assert';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { EXAM_SUBMISSION_GRACE_MS } from '../src/utils/examTiming.utils';
import { buildExamWindow, msUntilOpenWindowPossible, CAIRO_TZ } from './wp4_exam_window_helper';

function reReadInstant(date: Date, timeStr: string): Date {
  const [h, m] = timeStr.split(':').map(Number);
  const z = toZonedTime(date, CAIRO_TZ);
  z.setHours(h, m, 0, 0);
  return fromZonedTime(z, CAIRO_TZ);
}

test('msUntilOpenWindowPossible: injected instants return 0 or ms until next day 00:00:05 Cairo', async () => {
  // 1. 23:58:59 Cairo -> 0
  const inst235859 = fromZonedTime('2026-10-24 23:58:59', CAIRO_TZ);
  assert.strictEqual(
    msUntilOpenWindowPossible(inst235859),
    0,
    '23:58:59 Cairo must return 0 ms'
  );

  // 2. 23:59:00 Cairo -> expected value computed with independent Date arithmetic
  const inst235900 = fromZonedTime('2026-10-24 23:59:00', CAIRO_TZ);
  const targetNextDay235900 = fromZonedTime('2026-10-25 00:00:05', CAIRO_TZ);
  const expectedMs235900 = targetNextDay235900.getTime() - inst235900.getTime(); // 65000 ms
  assert.strictEqual(
    msUntilOpenWindowPossible(inst235900),
    expectedMs235900,
    '23:59:00 Cairo must return exact ms until 00:00:05 Cairo next day'
  );

  // 3. 23:59:30 Cairo -> expected value computed with independent Date arithmetic
  const inst235930 = fromZonedTime('2026-10-24 23:59:30', CAIRO_TZ);
  const targetNextDay235930 = fromZonedTime('2026-10-25 00:00:05', CAIRO_TZ);
  const expectedMs235930 = targetNextDay235930.getTime() - inst235930.getTime(); // 35000 ms
  assert.strictEqual(
    msUntilOpenWindowPossible(inst235930),
    expectedMs235930,
    '23:59:30 Cairo must return exact ms until 00:00:05 Cairo next day'
  );
});

test('buildExamWindow: injected instants verify grace, closed, and open windows with independent Date arithmetic', async (t) => {
  const injectedInstants = [
    { label: '23:30:00 Cairo', instant: fromZonedTime('2026-10-24 23:30:00', CAIRO_TZ) },
    { label: '23:59:30 Cairo', instant: fromZonedTime('2026-10-24 23:59:30', CAIRO_TZ) },
    { label: '00:00:30 Cairo', instant: fromZonedTime('2026-10-25 00:00:30', CAIRO_TZ) },
    { label: '00:01:00 Cairo', instant: fromZonedTime('2026-10-25 00:01:00', CAIRO_TZ) },
    { label: '12:00:00 Cairo', instant: fromZonedTime('2026-10-25 12:00:00', CAIRO_TZ) },
    { label: 'DST Spring Forward 30s before transition (2026-04-23 23:59:30 UTC)', instant: new Date('2026-04-23T23:59:30.000Z') },
    { label: 'DST Spring Forward 30s after transition (2026-04-24 00:00:30 UTC)', instant: new Date('2026-04-24T00:00:30.000Z') },
    { label: 'DST Fall Back 30s before transition (2026-10-29 22:59:30 UTC)', instant: new Date('2026-10-29T22:59:30.000Z') },
    { label: 'DST Fall Back inside repeated hour (2026-10-29 22:30:00 UTC)', instant: new Date('2026-10-29T22:30:00.000Z') },
    { label: 'DST Fall Back 30s after transition (2026-10-29 23:00:30 UTC)', instant: new Date('2026-10-29T23:00:30.000Z') },
  ];

  for (const { label, instant } of injectedInstants) {
    await t.test(`grace window at ${label}`, () => {
      const window = buildExamWindow(instant, 'grace');
      const reReadEnd = reReadInstant(window.date, window.endTime);

      // Independent arithmetic: end must be exactly instant - 1 minute (floored to minute)
      const expectedEndMs = Math.floor(instant.getTime() / 60000) * 60000 - 1 * 60000;
      const expectedEnd = new Date(expectedEndMs);

      assert.strictEqual(
        reReadEnd.getTime(),
        expectedEnd.getTime(),
        `re-read grace end (${reReadEnd.toISOString()}) must equal instant - 1 minute (${expectedEnd.toISOString()}) for ${label}`
      );

      // Invariant: endTime is in past of instant, but within 3-minute grace
      assert.ok(
        instant.getTime() >= reReadEnd.getTime(),
        `instant must be at or after reReadEnd for ${label}`
      );
      assert.ok(
        instant.getTime() < reReadEnd.getTime() + EXAM_SUBMISSION_GRACE_MS,
        `instant must be within 3-minute grace period for ${label}`
      );
    });

    await t.test(`closed window at ${label}`, () => {
      const window = buildExamWindow(instant, 'closed');
      const reReadEnd = reReadInstant(window.date, window.endTime);

      // Independent arithmetic: end must be exactly instant - 5 minutes (floored to minute)
      const expectedEndMs = Math.floor(instant.getTime() / 60000) * 60000 - 5 * 60000;
      const expectedEnd = new Date(expectedEndMs);

      assert.strictEqual(
        reReadEnd.getTime(),
        expectedEnd.getTime(),
        `re-read closed end (${reReadEnd.toISOString()}) must equal instant - 5 minutes (${expectedEnd.toISOString()}) for ${label}`
      );

      // Invariant: grace period has fully expired
      assert.ok(
        instant.getTime() >= reReadEnd.getTime() + EXAM_SUBMISSION_GRACE_MS,
        `instant must be at or past end + grace period for ${label}`
      );
    });

    await t.test(`open window at ${label}`, () => {
      const msUntil = msUntilOpenWindowPossible(instant);
      const effectiveInstant = new Date(instant.getTime() + msUntil);
      const window = buildExamWindow(effectiveInstant, 'open');
      const reReadStart = reReadInstant(window.date, window.startTime);
      const reReadEnd = reReadInstant(window.date, window.endTime);

      // Invariant: now is inside [start, end)
      assert.ok(
        effectiveInstant.getTime() >= reReadStart.getTime(),
        `effective instant (${effectiveInstant.toISOString()}) must be >= start (${reReadStart.toISOString()}) for ${label}`
      );
      assert.ok(
        effectiveInstant.getTime() < reReadEnd.getTime(),
        `effective instant (${effectiveInstant.toISOString()}) must be < end (${reReadEnd.toISOString()}) for ${label}`
      );

      // Calendar date of window must match effective instant's Cairo date
      const instantCairo = toZonedTime(effectiveInstant, CAIRO_TZ);
      const windowCairo = toZonedTime(window.date, CAIRO_TZ);
      assert.strictEqual(windowCairo.getFullYear(), instantCairo.getFullYear(), `Year must match for ${label}`);
      assert.strictEqual(windowCairo.getMonth(), instantCairo.getMonth(), `Month must match for ${label}`);
      assert.strictEqual(windowCairo.getDate(), instantCairo.getDate(), `Date must match for ${label}`);
    });
  }
});
