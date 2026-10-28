import type { SaveGradebookDraftEntry } from '../types/gradebook';

/**
 * Pinned constant from backend validation:
 * artifacts/api-server/src/validations/gradebook.validation.ts:4
 */
export const MAX_DECIMAL_PLACES = 2;
export const MIN_CORRECTION_REASON_LENGTH = 5;
export const MAX_CORRECTION_REASON_LENGTH = 500;

/**
 * Maps backend error strings & HTTP status codes to localized translation keys.
 * Raw unexpected errors are logged to console.warn.
 */
export function mapGradebookError(rawError: unknown, status?: number): string {
  const msg = typeof rawError === 'string' ? rawError : String((rawError as any)?.message || '');

  // 1. Optimistic lock failure
  if (
    msg.includes('Optimistic lock failure') ||
    msg.includes('Optimistic locking conflict') ||
    (status === 409 && msg.toLowerCase().includes('version'))
  ) {
    return 'gradebook.errors.optimisticLock';
  }

  // 2. Pass mark not set
  if (msg.includes('PASSMARK_NOT_SET')) {
    return 'gradebook.errors.passMarkNotSet';
  }

  // 3. Auto calculator errors
  if (msg.includes('AUTO_CALCULATOR_UNAVAILABLE')) {
    return 'gradebook.errors.autoCalculatorUnavailable';
  }
  if (msg.includes('AUTO_CALCULATOR_INVALID_RESULT')) {
    return 'gradebook.errors.autoCalculatorInvalidResult';
  }

  // 4. Concurrent modification conflict
  if (msg.includes('Concurrent modification conflict')) {
    return 'gradebook.errors.concurrentConflict';
  }

  // 5. Past or locked academic term (publish, draft or correct)
  if (
    msg.includes('Cannot modify gradebook draft for past or locked academic term') ||
    msg.includes('Cannot publish gradebook for past or locked academic term') ||
    msg.includes('Cannot correct grades for past or locked academic term') ||
    (status === 409 && msg.toLowerCase().includes('locked academic term'))
  ) {
    return 'gradebook.errors.pastTerm';
  }

  // 6. PUBLISHED entry cannot be modified as draft
  if (msg.includes('is PUBLISHED and cannot be modified as a draft') || (status === 409 && msg.includes('PUBLISHED') && !msg.includes('Only PUBLISHED'))) {
    return 'gradebook.errors.publishedCell';
  }

  // 7. Correction constraints: manual only, published only, withdrawn/blocked
  if (msg.includes('Only MANUAL components can be corrected directly')) {
    return 'gradebook.errors.manualOnlyCorrection';
  }
  if (msg.includes('Only PUBLISHED grade entries can be corrected')) {
    return 'gradebook.errors.publishedOnlyCorrection';
  }
  if (msg.includes('Cannot correct grade for')) {
    return 'gradebook.errors.withdrawnOrBlocked';
  }

  // 8. Missing / undefined grade structure
  if (
    msg.includes('Grade structure has not been defined for this course and term') ||
    msg.includes('Grade structure must be defined before publishing grades') ||
    msg.includes('Grade structure must be defined before correcting grades') ||
    (status === 409 && msg.toLowerCase().includes('grade structure must be defined')) ||
    (status === 409 && msg.toLowerCase().includes('grade structure has not been defined'))
  ) {
    return 'gradebook.errors.structureUndefined';
  }

  // 9. Teaching Assistant out of group scope
  if (msg.includes('Teaching Assistant is not authorized to grade enrollment') || (status === 403 && msg.toLowerCase().includes('outside assigned student group'))) {
    return 'gradebook.errors.taOutOfGroup';
  }

  // 10. Withdrawn student
  if (msg.includes('has status WITHDRAWN and cannot be graded') || (status === 422 && msg.includes('WITHDRAWN'))) {
    return 'gradebook.errors.withdrawn';
  }

  // Fallback: log raw unexpected message and return generic error key
  if (msg) {
    console.warn('[GradebookService] Unmapped error received:', { status, message: msg });
  }
  return 'gradebook.errors.generic';
}

/**
 * Validates a correction justification reason per backend constraints (5-500 chars, no angle brackets, no control chars).
 */
export function validateCorrectionReason(reason: unknown): { valid: boolean; errorKey: string | null } {
  if (typeof reason !== 'string') {
    return { valid: false, errorKey: 'gradebook.validation.reasonMinLength' };
  }
  const trimmed = reason.trim();
  if (trimmed.length < MIN_CORRECTION_REASON_LENGTH) {
    return { valid: false, errorKey: 'gradebook.validation.reasonMinLength' };
  }
  if (trimmed.length > MAX_CORRECTION_REASON_LENGTH) {
    return { valid: false, errorKey: 'gradebook.validation.reasonMaxLength' };
  }
  if (/[<>]/.test(trimmed)) {
    return { valid: false, errorKey: 'gradebook.validation.reasonNoAngleBrackets' };
  }
  if (/[\x00-\x1F\x7F]/.test(trimmed)) {
    return { valid: false, errorKey: 'gradebook.validation.reasonNoControlChars' };
  }
  return { valid: true, errorKey: null };
}

/**
 * Validates a numeric score against component maxPoints and decimal places rules.
 */
export function validateGradeScore(
  score: number | null,
  maxPoints: number,
  isAbsent: boolean
): { valid: boolean; errorKey: string | null } {
  if (isAbsent) {
    return { valid: true, errorKey: null };
  }

  if (score === null || score === undefined) {
    return { valid: true, errorKey: null };
  }

  if (typeof score !== 'number' || !Number.isFinite(score) || Number.isNaN(score)) {
    return { valid: false, errorKey: 'gradebook.validation.invalidNumber' };
  }

  if (score < 0) {
    return { valid: false, errorKey: 'gradebook.validation.negativeScore' };
  }

  if (score > maxPoints) {
    return { valid: false, errorKey: 'gradebook.validation.exceedsMaxPoints' };
  }

  const scoreStr = score.toString();
  const parts = scoreStr.split('.');
  if (parts.length > 1 && parts[1].length > MAX_DECIMAL_PLACES) {
    return { valid: false, errorKey: 'gradebook.validation.maxDecimals' };
  }

  return { valid: true, errorKey: null };
}

/**
 * Extracts only modified gradebook cells to be sent in the draft save payload.
 * Preserves the cell version when present on an existing entry.
 */
export function extractChangedDraftEntries(
  originalCells: Array<{
    enrollmentId: number;
    componentId: number;
    score: number | null;
    isAbsent: boolean;
    version?: number | null;
    source?: string;
    notes?: string | null;
  }>,
  edits: Record<string, { score: number | null; isAbsent: boolean; notes?: string | null }>
): SaveGradebookDraftEntry[] {
  const result: SaveGradebookDraftEntry[] = [];

  for (const cell of originalCells) {
    if (cell.source && cell.source !== 'MANUAL') {
      continue; // Skip automatic columns
    }

    const key = `${cell.enrollmentId}:${cell.componentId}`;
    const edit = edits[key];
    if (!edit) continue;

    const originalScore = cell.score ?? null;
    const currentScore = edit.score ?? null;
    const originalAbsent = Boolean(cell.isAbsent);
    const currentAbsent = Boolean(edit.isAbsent);
    const originalNotes = cell.notes ?? null;
    const currentNotes = edit.notes ?? null;

    const isScoreChanged = originalScore !== currentScore;
    const isAbsentChanged = originalAbsent !== currentAbsent;
    const isNotesChanged = originalNotes !== currentNotes;

    if (isScoreChanged || isAbsentChanged || isNotesChanged) {
      const entry: SaveGradebookDraftEntry = {
        enrollmentId: cell.enrollmentId,
        componentId: cell.componentId,
        score: currentAbsent ? null : currentScore,
        isAbsent: currentAbsent,
      };

      if (cell.version !== null && cell.version !== undefined) {
        entry.version = cell.version;
      }

      if (currentNotes !== null && currentNotes !== undefined) {
        entry.notes = currentNotes;
      }

      result.push(entry);
    }
  }

  return result;
}
