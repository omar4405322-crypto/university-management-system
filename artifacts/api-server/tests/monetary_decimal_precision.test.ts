import test from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import {
  normalizeMonetaryAmount,
  formatMonetaryAmount,
  sumMonetaryAmounts,
  MAX_MONETARY_AMOUNT,
  MIN_MONETARY_AMOUNT,
} from '../src/utils/currency.utils';
import { ValidationError } from '../src/utils/appError';

test('DB-001: 0.10 + 0.20 precision arithmetic has zero binary drift', () => {
  const a = normalizeMonetaryAmount('0.10');
  const b = normalizeMonetaryAmount('0.20');
  const sum = a.add(b);

  // In binary IEEE-754: 0.1 + 0.2 === 0.30000000000000004
  // In Prisma.Decimal: exactly 0.3
  assert.equal(sum.toString(), '0.3');
  assert.equal(sum.toFixed(2), '0.30');
  assert.equal(formatMonetaryAmount(sum), '0.30');
});

test('DB-001: Accepts valid representative monetary amounts', () => {
  const p1 = normalizeMonetaryAmount('0.10');
  assert.equal(p1.toFixed(2), '0.10');

  const p2 = normalizeMonetaryAmount('0.20');
  assert.equal(p2.toFixed(2), '0.20');

  const p3 = normalizeMonetaryAmount('100.01');
  assert.equal(p3.toFixed(2), '100.01');

  const large = normalizeMonetaryAmount('5000000.75');
  assert.equal(large.toFixed(2), '5000000.75');
});

test('DB-001: Maximum allowed amount enforcement (9,999,999,999.99)', () => {
  const max = normalizeMonetaryAmount('9999999999.99');
  assert.equal(max.toFixed(2), '9999999999.99');
  assert.equal(max.equals(MAX_MONETARY_AMOUNT), true);

  // Exceeding maximum by 0.01 must throw ValidationError
  assert.throws(
    () => normalizeMonetaryAmount('10000000000.00'),
    (err: any) => err instanceof ValidationError && err.message.includes('exceeds maximum allowed limit')
  );

  assert.throws(
    () => normalizeMonetaryAmount('9999999999.995'), // Rounds up to 10000000000.00
    (err: any) => err instanceof ValidationError && err.message.includes('exceeds maximum allowed limit')
  );
});

test('DB-001: Zero and negative amounts are strictly rejected at application boundary', () => {
  assert.throws(
    () => normalizeMonetaryAmount(0),
    (err: any) => err instanceof ValidationError && err.message.includes('greater than 0')
  );

  assert.throws(
    () => normalizeMonetaryAmount('0.00'),
    (err: any) => err instanceof ValidationError && err.message.includes('greater than 0')
  );

  assert.throws(
    () => normalizeMonetaryAmount('-10.50'),
    (err: any) => err instanceof ValidationError && err.message.includes('greater than 0')
  );

  assert.throws(
    () => normalizeMonetaryAmount(-0.01),
    (err: any) => err instanceof ValidationError && err.message.includes('greater than 0')
  );
});

test('DB-001: ROUND_HALF_UP rounding policy boundaries', () => {
  // 1.004 -> 1.00 (round down)
  const r1 = normalizeMonetaryAmount('1.004');
  assert.equal(r1.toFixed(2), '1.00');

  // 1.005 -> 1.01 (round up on half)
  const r2 = normalizeMonetaryAmount('1.005');
  assert.equal(r2.toFixed(2), '1.01');

  // 1.006 -> 1.01 (round up)
  const r3 = normalizeMonetaryAmount('1.006');
  assert.equal(r3.toFixed(2), '1.01');

  // Additional boundary checks
  assert.equal(normalizeMonetaryAmount('2.345').toFixed(2), '2.35');
  assert.equal(normalizeMonetaryAmount('2.344').toFixed(2), '2.34');
  assert.equal(normalizeMonetaryAmount('2.34500001').toFixed(2), '2.35');
});

test('DB-001: Rejection of malformed inputs (NaN, non-numeric strings, empty)', () => {
  assert.throws(() => normalizeMonetaryAmount(''), ValidationError);
  assert.throws(() => normalizeMonetaryAmount(NaN), ValidationError);
  assert.throws(() => normalizeMonetaryAmount(Infinity), ValidationError);
  assert.throws(() => normalizeMonetaryAmount('abc'), ValidationError);
  assert.throws(() => normalizeMonetaryAmount('12.34.56'), ValidationError);
  assert.throws(() => normalizeMonetaryAmount(null), ValidationError);
  assert.throws(() => normalizeMonetaryAmount(undefined), ValidationError);
});

test('DB-001: Summation over many fractional payments has zero rounding drift', () => {
  // Sum 1,000 payments of 0.10: in floating point: 1000 * 0.1 = 99.99999999999999
  const amounts = Array(1000).fill('0.10');
  const total = sumMonetaryAmounts(amounts);

  assert.equal(total.toString(), '100');
  assert.equal(total.toFixed(2), '100.00');

  // Alternating 0.10 and 0.20 payments
  const mixedAmounts = [];
  for (let i = 0; i < 500; i++) {
    mixedAmounts.push('0.10', '0.20');
  }
  const mixedTotal = sumMonetaryAmounts(mixedAmounts);
  // 500 * (0.10 + 0.20) = 150.00
  assert.equal(mixedTotal.toFixed(2), '150.00');
});

test('DB-001: formatMonetaryAmount returns consistent two-decimal string format', () => {
  assert.equal(formatMonetaryAmount(new Prisma.Decimal('1500')), '1500.00');
  assert.equal(formatMonetaryAmount(new Prisma.Decimal('1500.5')), '1500.50');
  assert.equal(formatMonetaryAmount('250.75'), '250.75');
  assert.equal(formatMonetaryAmount(100), '100.00');
  assert.equal(formatMonetaryAmount('1500.50', 'EGP'), '1500.50 EGP');
  assert.equal(formatMonetaryAmount(null), '0.00');
});
