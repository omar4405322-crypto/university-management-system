import { ValidationError } from './appError';

export const ALLOWED_EXAM_TYPE = 'QUIZ' as const;
export type AllowedExamType = typeof ALLOWED_EXAM_TYPE;

/**
 * Shared strict check: only exact string 'QUIZ' is allowed as an exam type.
 * All other values (including MIDTERM, FINAL, case-variations, non-strings) are rejected.
 */
export function isAllowedExamType(value: unknown): value is 'QUIZ' {
  return typeof value === 'string' && value === ALLOWED_EXAM_TYPE;
}

/**
 * Asserts that the provided exam type is valid when present (optional guard).
 * Throws a ValidationError (HTTP 422) if present and not exactly 'QUIZ'.
 */
export function assertAllowedExamType(type: unknown): asserts type is 'QUIZ' | undefined {
  if (type !== undefined && !isAllowedExamType(type)) {
    throw new ValidationError('Invalid exam type: only QUIZ is supported');
  }
}
