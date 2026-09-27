import { toZonedTime, fromZonedTime, format } from 'date-fns-tz';

export const CAIRO_TIMEZONE = 'Africa/Cairo';

/**
 * Convert any Date, ISO string, or timestamp into the Africa/Cairo timezone Date.
 */
export function toCairoTime(date: Date | string | number = new Date()): Date {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  return toZonedTime(d, CAIRO_TIMEZONE);
}

/**
 * Interpret a calendar date/time as an Africa/Cairo local instant and convert to absolute UTC Date.
 */
export function fromCairoTime(date: Date | string | number): Date {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  return fromZonedTime(d, CAIRO_TIMEZONE);
}

/**
 * Format a timestamp using an explicit format pattern in the Africa/Cairo timezone.
 */
export function formatCairoDateTime(
  date: Date | string | number,
  formatStr: string = 'yyyy-MM-dd HH:mm:ss'
): string {
  const cairoDate = toCairoTime(date);
  return format(cairoDate, formatStr, { timeZone: CAIRO_TIMEZONE });
}

/**
 * Extract Cairo local calendar components (year, month 1-12, day, hours, minutes, seconds).
 */
export function getCairoCalendarParts(date: Date | string | number = new Date()): {
  year: number;
  month: number;
  day: number;
  hours: number;
  minutes: number;
  seconds: number;
  monthKey: string;
} {
  const formatted = formatCairoDateTime(date, 'yyyy-MM-dd-HH-mm-ss');
  const [yearStr, monthStr, dayStr, hourStr, minStr, secStr] = formatted.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);
  const hours = parseInt(hourStr, 10);
  const minutes = parseInt(minStr, 10);
  const seconds = parseInt(secStr, 10);
  const monthKey = `${yearStr}-${monthStr}`;

  return { year, month, day, hours, minutes, seconds, monthKey };
}

/**
 * Get Cairo Month Key in format "YYYY-MM" (authoritative for financial grouping).
 */
export function getCairoMonthKey(date: Date | string | number = new Date()): string {
  return formatCairoDateTime(date, 'yyyy-MM');
}

/**
 * Returns the UTC Date representing 00:00:00.000 in Cairo on the given date's Cairo calendar day.
 */
export function getCairoStartOfDay(date: Date | string | number = new Date()): Date {
  const { year, month, day } = getCairoCalendarParts(date);
  const isoStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00.000`;
  return fromCairoTime(isoStr);
}

/**
 * Returns the UTC Date representing 23:59:59.999 in Cairo on the given date's Cairo calendar day.
 */
export function getCairoEndOfDay(date: Date | string | number = new Date()): Date {
  const { year, month, day } = getCairoCalendarParts(date);
  const isoStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T23:59:59.999`;
  return fromCairoTime(isoStr);
}

/**
 * Returns UTC boundaries for a Cairo calendar month (1-indexed month, e.g., 9 for September).
 */
export function getCairoMonthBoundaries(
  year: number,
  month: number
): { startUtc: Date; endUtc: Date; monthKey: string } {
  const monthKey = `${year}-${String(month).padStart(2, '0')}`;
  const startIso = `${monthKey}-01T00:00:00.000`;
  const startUtc = fromCairoTime(startIso);

  // Next month calculation
  let nextYear = year;
  let nextMonth = month + 1;
  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear += 1;
  }
  const nextMonthKey = `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
  const endIso = `${nextMonthKey}-01T00:00:00.000`;
  const nextMonthStartUtc = fromCairoTime(endIso);
  const endUtc = new Date(nextMonthStartUtc.getTime() - 1);

  return { startUtc, endUtc, monthKey };
}
