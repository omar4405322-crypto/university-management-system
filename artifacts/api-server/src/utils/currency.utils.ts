import { Prisma } from '@prisma/client';
import { ValidationError } from './appError';

// DECIMAL(12, 2) allows up to 10 integer digits and 2 fractional digits
export const MAX_MONETARY_AMOUNT = new Prisma.Decimal('9999999999.99');
export const MIN_MONETARY_AMOUNT = new Prisma.Decimal('0.01');

/**
 * Normalizes any input amount into a precise Prisma.Decimal with exactly 2 decimal places
 * rounded using ROUND_HALF_UP.
 *
 * Enforces business constraints:
 * - Rejects NaN, Infinity, null, undefined, empty strings.
 * - Rejects amounts <= 0.
 * - Rejects amounts exceeding DECIMAL(12, 2) maximum (9,999,999,999.99).
 */
export function normalizeMonetaryAmount(
  value: number | string | Prisma.Decimal | null | undefined
): Prisma.Decimal {
  if (value === null || value === undefined || value === '') {
    throw new ValidationError('Payment amount is required');
  }

  let dec: Prisma.Decimal;
  try {
    if (value instanceof Prisma.Decimal) {
      dec = value;
    } else if (typeof value === 'number') {
      if (!Number.isFinite(value) || Number.isNaN(value)) {
        throw new ValidationError('Invalid payment amount format');
      }
      // Convert number to string safely without scientific notation where possible
      dec = new Prisma.Decimal(value.toString());
    } else if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed || !/^-?\d+(\.\d+)?$/.test(trimmed)) {
        throw new ValidationError('Invalid payment amount format: must be a valid numeric value');
      }
      dec = new Prisma.Decimal(trimmed);
    } else {
      throw new ValidationError('Unsupported payment amount format');
    }
  } catch (err: any) {
    if (err instanceof ValidationError) throw err;
    throw new ValidationError('Failed to parse monetary amount: ' + (err?.message || 'invalid input'));
  }

  // Apply ROUND_HALF_UP to exactly 2 decimal places
  const roundedStr = dec.toFixed(2, Prisma.Decimal.ROUND_HALF_UP);
  const normalized = new Prisma.Decimal(roundedStr);

  if (normalized.isNegative() || normalized.isZero()) {
    throw new ValidationError('Payment amount must be greater than 0');
  }

  if (normalized.greaterThan(MAX_MONETARY_AMOUNT)) {
    throw new ValidationError('Payment amount exceeds maximum allowed limit of 9,999,999,999.99');
  }

  return normalized;
}

/**
 * Formats a monetary value to a consistent two-decimal string representation (e.g. "1500.50").
 */
export function formatMonetaryAmount(
  value: number | string | Prisma.Decimal | null | undefined,
  currencySuffix?: string
): string {
  if (value === null || value === undefined) return '0.00';
  let dec: Prisma.Decimal;
  try {
    dec = value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value.toString());
  } catch {
    return '0.00';
  }
  const str = dec.toFixed(2, Prisma.Decimal.ROUND_HALF_UP);
  return currencySuffix ? `${str} ${currencySuffix}` : str;
}

/**
 * Decimal-safe addition of an array of amounts without floating-point drift.
 */
export function sumMonetaryAmounts(
  amounts: (number | string | Prisma.Decimal | null | undefined)[]
): Prisma.Decimal {
  let total = new Prisma.Decimal(0);
  for (const amt of amounts) {
    if (amt === null || amt === undefined || amt === '') continue;
    try {
      const dec = amt instanceof Prisma.Decimal ? amt : new Prisma.Decimal(amt.toString());
      total = total.add(dec);
    } catch {
      // ignore or propagate
    }
  }
  return new Prisma.Decimal(total.toFixed(2, Prisma.Decimal.ROUND_HALF_UP));
}
