export type NormalizedSlotType = 'LECTURE' | 'LAB';

/**
 * Normalizes any slot type value to 'LECTURE' or 'LAB'.
 * Per schema unification, 'LECTURE' remains 'LECTURE', and any other value
 * (including legacy 'SECTION' or 'TUTORIAL') becomes 'LAB'.
 */
export function normalizeSlotType(value: string | null | undefined): NormalizedSlotType {
  if (!value) return 'LAB';
  return String(value).trim().toUpperCase() === 'LECTURE' ? 'LECTURE' : 'LAB';
}
