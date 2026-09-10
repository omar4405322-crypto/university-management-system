export const MAX_CUSTOM_ABSENCE_THRESHOLD_PERCENT = 25;

export function validateCustomAbsenceThreshold(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > MAX_CUSTOM_ABSENCE_THRESHOLD_PERCENT
  ) {
    return `customAbsenceThreshold must be null or a number between 0 and ${MAX_CUSTOM_ABSENCE_THRESHOLD_PERCENT}`;
  }
  return null;
}
