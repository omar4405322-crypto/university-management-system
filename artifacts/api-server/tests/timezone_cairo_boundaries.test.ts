import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CAIRO_TIMEZONE,
  toCairoTime,
  fromCairoTime,
  formatCairoDateTime,
  getCairoCalendarParts,
  getCairoMonthKey,
  getCairoStartOfDay,
  getCairoEndOfDay,
  getCairoMonthBoundaries,
} from '../src/utils/timezone.utils';
import { CRON_TIMEZONE } from '../src/utils/cron';

test('DATE-001: Cairo timezone constant is authoritative Africa/Cairo', () => {
  assert.equal(CAIRO_TIMEZONE, 'Africa/Cairo');
  assert.equal(CRON_TIMEZONE, 'Africa/Cairo');
});

test('DATE-001: UTC vs Cairo date difference across UTC midnight', () => {
  // During Daylight Saving / UTC+3 in Egypt:
  // 2026-09-16 22:30:00 UTC corresponds to 2026-09-17 01:30:00 Cairo!
  // The UTC date is 16th, but Cairo date is 17th.
  const utcInstant = new Date('2026-09-16T22:30:00.000Z');

  const cairoParts = getCairoCalendarParts(utcInstant);
  assert.equal(cairoParts.day, 17, 'Cairo calendar day must be 17th, not 16th');
  assert.equal(cairoParts.hours, 1, 'Cairo local hour must be 01:30');
  assert.equal(cairoParts.minutes, 30);
  assert.equal(cairoParts.monthKey, '2026-09');
});

test('DATE-001: Just before and just after Cairo midnight', () => {
  // 1 second before Cairo midnight: 2026-05-10 23:59:59 Cairo
  const beforeMidnight = fromCairoTime('2026-05-10T23:59:59.000');
  const beforeParts = getCairoCalendarParts(beforeMidnight);
  assert.equal(beforeParts.year, 2026);
  assert.equal(beforeParts.month, 5);
  assert.equal(beforeParts.day, 10);
  assert.equal(beforeParts.hours, 23);
  assert.equal(beforeParts.minutes, 59);
  assert.equal(beforeParts.seconds, 59);

  // 2 seconds later (1 second after Cairo midnight): 2026-05-11 00:00:01 Cairo
  const afterMidnight = new Date(beforeMidnight.getTime() + 2000);
  const afterParts = getCairoCalendarParts(afterMidnight);
  assert.equal(afterParts.year, 2026);
  assert.equal(afterParts.month, 5);
  assert.equal(afterParts.day, 11, 'Calendar day must have incremented to 11');
  assert.equal(afterParts.hours, 0);
  assert.equal(afterParts.minutes, 0);
  assert.equal(afterParts.seconds, 1);
});

test('DATE-001: Month boundary transition in Cairo calendar', () => {
  // End of January in Cairo: 2026-01-31 23:59:59
  const janEnd = fromCairoTime('2026-01-31T23:59:59.000');
  const janParts = getCairoCalendarParts(janEnd);
  assert.equal(janParts.month, 1);
  assert.equal(janParts.day, 31);
  assert.equal(getCairoMonthKey(janEnd), '2026-01');

  // 2 seconds later: 2026-02-01 00:00:01
  const febStart = new Date(janEnd.getTime() + 2000);
  const febParts = getCairoCalendarParts(febStart);
  assert.equal(febParts.month, 2, 'Month must transition to February');
  assert.equal(febParts.day, 1, 'Day must reset to 1');
  assert.equal(getCairoMonthKey(febStart), '2026-02');
});

test('DATE-001: Year boundary transition in Cairo calendar', () => {
  // End of Year in Cairo: 2026-12-31 23:59:59
  const yearEnd = fromCairoTime('2026-12-31T23:59:59.000');
  const endParts = getCairoCalendarParts(yearEnd);
  assert.equal(endParts.year, 2026);
  assert.equal(endParts.month, 12);
  assert.equal(endParts.day, 31);
  assert.equal(getCairoMonthKey(yearEnd), '2026-12');

  // 2 seconds later: 2027-01-01 00:00:01
  const newYear = new Date(yearEnd.getTime() + 2000);
  const newYearParts = getCairoCalendarParts(newYear);
  assert.equal(newYearParts.year, 2027, 'Year must increment to 2027');
  assert.equal(newYearParts.month, 1, 'Month must reset to 1');
  assert.equal(newYearParts.day, 1, 'Day must reset to 1');
  assert.equal(getCairoMonthKey(newYear), '2027-01');
});

test('DATE-001: Start and end of Cairo calendar day boundaries', () => {
  const sample = fromCairoTime('2026-04-15T14:35:22.000');

  const startOfDayUtc = getCairoStartOfDay(sample);
  const startParts = getCairoCalendarParts(startOfDayUtc);
  assert.equal(startParts.day, 15);
  assert.equal(startParts.hours, 0);
  assert.equal(startParts.minutes, 0);
  assert.equal(startParts.seconds, 0);

  const endOfDayUtc = getCairoEndOfDay(sample);
  const endParts = getCairoCalendarParts(endOfDayUtc);
  assert.equal(endParts.day, 15);
  assert.equal(endParts.hours, 23);
  assert.equal(endParts.minutes, 59);
  assert.equal(endParts.seconds, 59);
});

test('DATE-001: Cairo month boundary range calculation', () => {
  const { startUtc, endUtc, monthKey } = getCairoMonthBoundaries(2026, 9);
  assert.equal(monthKey, '2026-09');

  const startParts = getCairoCalendarParts(startUtc);
  assert.equal(startParts.year, 2026);
  assert.equal(startParts.month, 9);
  assert.equal(startParts.day, 1);
  assert.equal(startParts.hours, 0);
  assert.equal(startParts.minutes, 0);

  const endParts = getCairoCalendarParts(endUtc);
  assert.equal(endParts.year, 2026);
  assert.equal(endParts.month, 9);
  assert.equal(endParts.day, 30);
  assert.equal(endParts.hours, 23);
  assert.equal(endParts.minutes, 59);
  assert.equal(endParts.seconds, 59);
});
