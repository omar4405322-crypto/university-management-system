export const MAX_STUDENT_GROUPS_PER_REQUEST = 500;

export function validatePositiveSafeInteger(
  value: unknown,
  fieldName: string
): string | null {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    return `${fieldName} must be a positive safe integer`;
  }
  return null;
}

export function validateRequestedGroupCount(
  requestedGroupCount: number,
  studentCount: number
): string | null {
  const maximum = Math.min(studentCount, MAX_STUDENT_GROUPS_PER_REQUEST);
  if (requestedGroupCount > maximum) {
    return `Requested group count cannot exceed ${maximum} for this student cohort`;
  }
  return null;
}
