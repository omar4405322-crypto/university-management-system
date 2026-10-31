/**
 * Task technical validation ceilings (technical limits, not policy).
 */
export const MAX_TASK_TITLE_LENGTH = 255;
export const MAX_TASK_DESCRIPTION_LENGTH = 5000;
export const MAX_TASK_NOTES_LENGTH = 5000;
export const MAX_TASK_FEEDBACK_LENGTH = 5000;

/**
 * Pure function to check whether a task's due date has passed.
 * Evaluates strictly with UTC milliseconds/instants without time zone shifting.
 * Returns false when nowMs <= dueMs (at the due instant or before),
 * and true when nowMs > dueMs (past due).
 */
export function isTaskPastDue(
  dueDate: Date | string | number | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  if (dueDate === null || dueDate === undefined) {
    return false;
  }
  const dueMs = dueDate instanceof Date ? dueDate.getTime() : new Date(dueDate).getTime();
  if (Number.isNaN(dueMs)) {
    return false;
  }
  return nowMs > dueMs;
}
