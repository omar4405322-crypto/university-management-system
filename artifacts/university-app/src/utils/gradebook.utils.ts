import type {
  SaveGradebookDraftEntry,
  GradeComponentSource,
  GradeStructureData,
  GradeStructureRowDraft,
  GradeStructureRowValidation,
  GradeStructureValidationResult,
  UpdateGradeStructurePayload,
  GradeStructureComponentInput,
} from '../types/gradebook';

/**
 * Pinned constants from backend validations:
 * artifacts/api-server/src/validations/gradebook.validation.ts:4
 * artifacts/api-server/src/validations/gradeStructure.validation.ts:3
 */
export const MAX_DECIMAL_PLACES = 2;
export const MIN_CORRECTION_REASON_LENGTH = 5;
export const MAX_CORRECTION_REASON_LENGTH = 500;
export const MAX_POINTS_TECHNICAL_CEILING = 10000;
export const MAX_COMPONENT_NAME_LENGTH = 100;
export const ALLOWED_GRADE_COMPONENT_SOURCES: readonly GradeComponentSource[] = [
  'MANUAL',
  'AUTO_QUIZ',
  'AUTO_ATTENDANCE',
] as const;

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

/**
 * Maps backend grade structure error messages and status codes to localized i18n keys.
 */
export function mapGradeStructureError(rawError: unknown, status?: number): string {
  const msg = typeof rawError === 'string' ? rawError : String((rawError as any)?.message || '');

  // 1. Published grades lock (409)
  if (msg.includes('published grades exist for this course in this term')) {
    return 'gradeStructure.errors.publishedGradesExist';
  }

  // 2. Term immutability: past term or locked term (409)
  if (msg.includes('academic term is in the past')) {
    return 'gradeStructure.errors.pastTerm';
  }
  if (msg.includes('academic term is locked')) {
    return 'gradeStructure.errors.lockedTerm';
  }

  // 3. Draft entries invariants (409)
  if (msg.includes('Cannot remove component') && msg.includes('grade entries exist')) {
    return 'gradeStructure.errors.cannotRemoveWithEntries';
  }
  if (msg.includes('Cannot change source of component') && msg.includes('grade entries exist')) {
    return 'gradeStructure.errors.cannotChangeSourceWithEntries';
  }
  if (msg.includes('Cannot reduce maxPoints below existing draft score')) {
    return 'gradeStructure.errors.cannotReduceMaxPointsBelowDraft';
  }

  // 4. Transaction conflict (409)
  if (msg.includes('Transaction conflict during grade structure update')) {
    return 'gradeStructure.errors.transactionConflict';
  }

  // 5. Duplicate component name: P2002 unique constraint (409) or validator (422)
  if (
    msg.includes('Duplicate value for') ||
    msg.includes('Unique constraint failed') ||
    msg.includes('Duplicate component name') ||
    (status === 409 && msg.toLowerCase().includes('duplicate'))
  ) {
    return 'gradeStructure.errors.duplicateComponentName';
  }

  // 6. Component ID payload errors (422)
  if (msg.includes('does not belong to this course grade structure')) {
    return 'gradeStructure.errors.componentNotBelong';
  }
  if (msg.includes('Duplicate component id')) {
    return 'gradeStructure.errors.duplicateComponentId';
  }

  // 7. Authorization & administrative scope (403)
  if (msg.includes('Course is outside your administrative scope')) {
    return 'gradeStructure.errors.outsideAdminScope';
  }
  if (msg.includes('Staff member is not assigned to this course in this term')) {
    return 'gradeStructure.errors.staffNotAssigned';
  }
  if (
    msg.includes('Teaching assistants are not permitted to modify course grade structures') ||
    msg.includes('Doctors are not permitted to modify course grade structures') ||
    msg.includes('Students are not permitted to modify course grade structures') ||
    msg.includes('Student is not enrolled in this course in this term') ||
    msg.includes('Access denied to course grade structure') ||
    status === 403
  ) {
    return 'gradeStructure.errors.forbidden';
  }

  // 8. Term & course resolution (404 / 422)
  if (msg.includes('No active academic term found')) {
    return 'gradeStructure.errors.noActiveTerm';
  }
  if (msg.includes('Academic term not found')) {
    return 'gradeStructure.errors.termNotFound';
  }
  if (msg.includes('Course not found')) {
    return 'gradeStructure.errors.courseNotFound';
  }

  // 9. Validator errors (422)
  if (msg.includes('At most one component with source AUTO_QUIZ')) {
    return 'gradeStructure.errors.duplicateAutoQuiz';
  }
  if (msg.includes('At most one component with source AUTO_ATTENDANCE')) {
    return 'gradeStructure.errors.duplicateAutoAttendance';
  }
  if (msg.includes('cannot exceed total course points')) {
    return 'gradeStructure.errors.passMarkExceedsTotal';
  }
  if (msg.includes('passMark must be a positive finite number')) {
    return 'gradeStructure.errors.invalidPassMark';
  }
  if (msg.includes('maxPoints exceeds technical ceiling')) {
    return 'gradeStructure.errors.exceedsCeiling';
  }
  if (msg.includes('can have at most 2 decimal places')) {
    return 'gradeStructure.errors.maxDecimals';
  }
  if (msg.includes('maxPoints must be a strictly positive finite number')) {
    return 'gradeStructure.errors.invalidMaxPoints';
  }
  if (msg.includes('Components must be a non-empty array')) {
    return 'gradeStructure.errors.minOneComponent';
  }
  if (msg.includes('must have a non-empty name')) {
    return 'gradeStructure.errors.nameRequired';
  }
  if (msg.includes('exceeds 100 characters') || msg.includes('up to 100 characters')) {
    return 'gradeStructure.errors.nameMaxLength';
  }
  if (msg.includes('cannot contain angle brackets')) {
    return 'gradeStructure.errors.nameNoAngleBrackets';
  }
  if (msg.includes('contains forbidden control characters')) {
    return 'gradeStructure.errors.nameNoControlChars';
  }
  if (
    msg.includes('Invalid term ID format') ||
    msg.includes('Invalid course ID format') ||
    msg.includes('Course ID is required')
  ) {
    return 'gradeStructure.errors.invalidIdFormat';
  }

  if (msg) {
    console.warn('[GradeStructureService] Unmapped error received:', { status, message: msg });
  }
  return 'gradeStructure.errors.generic';
}

/**
 * Checks whether a numeric string or number has more than MAX_DECIMAL_PLACES (2) decimals,
 * mirroring backend `Math.round(points * 100) !== points * 100`.
 */
function exceedsMaxDecimals(rawStr: string, num: number): boolean {
  const parts = rawStr.split('.');
  if (parts.length > 1 && parts[1].length > MAX_DECIMAL_PLACES) {
    return true;
  }
  return Math.round(num * 100) !== num * 100;
}

/**
 * Computes the live total of positive finite maxPoints across component rows.
 */
export function computeLiveTotalPoints(
  rows: Array<{ maxPointsInput: string | number | null | undefined }>
): number {
  let sum = 0;
  for (const row of rows) {
    const raw =
      typeof row.maxPointsInput === 'number'
        ? String(row.maxPointsInput)
        : String(row.maxPointsInput ?? '').trim();
    if (raw === '') continue;
    const num = Number(raw);
    if (Number.isFinite(num) && num > 0) {
      sum = Math.round((sum + num) * 100) / 100;
    }
  }
  return sum;
}

/**
 * Validates the entire grade structure draft (passMark and components[]) mirroring
 * artifacts/api-server/src/validations/gradeStructure.validation.ts.
 */
export function validateGradeStructureDraft(
  passMarkInput: string | number | null | undefined,
  rows: GradeStructureRowDraft[]
): GradeStructureValidationResult {
  const totalPoints = computeLiveTotalPoints(rows);

  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      valid: false,
      formErrorKey: 'gradeStructure.validation.minOneComponent',
      passMarkErrorKey: null,
      rowErrors: [],
      totalPoints: 0,
    };
  }

  const rowErrors: GradeStructureRowValidation[] = rows.map(() => ({
    nameErrorKey: null,
    nameArErrorKey: null,
    maxPointsErrorKey: null,
    sourceErrorKey: null,
  }));

  const seenNames = new Map<string, number[]>();
  const autoQuizIndices: number[] = [];
  const autoAttendanceIndices: number[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const trimmedName = String(row.name ?? '').trim();

    // 1. Validate name
    if (trimmedName.length === 0) {
      rowErrors[i].nameErrorKey = 'gradeStructure.validation.nameRequired';
    } else if (trimmedName.length > MAX_COMPONENT_NAME_LENGTH) {
      rowErrors[i].nameErrorKey = 'gradeStructure.validation.nameMaxLength';
    } else if (/[\x00-\x1F\x7F]/.test(trimmedName)) {
      rowErrors[i].nameErrorKey = 'gradeStructure.validation.nameNoControlChars';
    } else if (/[<>]/.test(trimmedName)) {
      rowErrors[i].nameErrorKey = 'gradeStructure.validation.nameNoAngleBrackets';
    } else {
      const lower = trimmedName.toLowerCase();
      const existing = seenNames.get(lower) || [];
      existing.push(i);
      seenNames.set(lower, existing);
    }

    // 2. Validate optional nameAr
    const rawNameAr = String(row.nameAr ?? '');
    if (rawNameAr.length > MAX_COMPONENT_NAME_LENGTH) {
      rowErrors[i].nameArErrorKey = 'gradeStructure.validation.nameArMaxLength';
    } else if (/[\x00-\x1F\x7F]/.test(rawNameAr)) {
      rowErrors[i].nameArErrorKey = 'gradeStructure.validation.nameNoControlChars';
    } else if (/[<>]/.test(rawNameAr)) {
      rowErrors[i].nameArErrorKey = 'gradeStructure.validation.nameNoAngleBrackets';
    }

    // 3. Validate maxPoints
    const rawPoints = String(row.maxPointsInput ?? '').trim();
    if (rawPoints === '') {
      rowErrors[i].maxPointsErrorKey = 'gradeStructure.validation.pointsRequired';
    } else {
      const num = Number(rawPoints);
      if (!Number.isFinite(num) || Number.isNaN(num)) {
        rowErrors[i].maxPointsErrorKey = 'gradeStructure.validation.invalidNumber';
      } else if (num < 0) {
        rowErrors[i].maxPointsErrorKey = 'gradeStructure.validation.negativePoints';
      } else if (num === 0) {
        rowErrors[i].maxPointsErrorKey = 'gradeStructure.validation.positivePoints';
      } else if (num > MAX_POINTS_TECHNICAL_CEILING) {
        rowErrors[i].maxPointsErrorKey = 'gradeStructure.validation.exceedsCeiling';
      } else if (exceedsMaxDecimals(rawPoints, num)) {
        rowErrors[i].maxPointsErrorKey = 'gradeStructure.validation.maxDecimals';
      }
    }

    // 4. Validate source
    if (!ALLOWED_GRADE_COMPONENT_SOURCES.includes(row.source)) {
      rowErrors[i].sourceErrorKey = 'gradeStructure.validation.invalidSource';
    } else {
      if (row.source === 'AUTO_QUIZ') autoQuizIndices.push(i);
      if (row.source === 'AUTO_ATTENDANCE') autoAttendanceIndices.push(i);
    }
  }

  // Case-insensitive duplicate name check across rows
  seenNames.forEach((indices) => {
    if (indices.length > 1) {
      for (const idx of indices) {
        if (!rowErrors[idx].nameErrorKey) {
          rowErrors[idx].nameErrorKey = 'gradeStructure.validation.duplicateName';
        }
      }
    }
  });

  // At most one AUTO_QUIZ and one AUTO_ATTENDANCE per course
  if (autoQuizIndices.length > 1) {
    for (const idx of autoQuizIndices) {
      rowErrors[idx].sourceErrorKey = 'gradeStructure.validation.duplicateAutoQuiz';
    }
  }
  if (autoAttendanceIndices.length > 1) {
    for (const idx of autoAttendanceIndices) {
      rowErrors[idx].sourceErrorKey = 'gradeStructure.validation.duplicateAutoAttendance';
    }
  }

  // 5. Validate passMark (optional, nullable; if provided must be > 0, <= 2 decimals, <= totalPoints)
  let passMarkErrorKey: string | null = null;
  const rawPassMark =
    passMarkInput === null || passMarkInput === undefined
      ? ''
      : String(passMarkInput).trim();

  if (rawPassMark !== '') {
    const pm = Number(rawPassMark);
    if (!Number.isFinite(pm) || Number.isNaN(pm)) {
      passMarkErrorKey = 'gradeStructure.validation.invalidNumber';
    } else if (pm < 0) {
      passMarkErrorKey = 'gradeStructure.validation.negativePoints';
    } else if (pm === 0) {
      passMarkErrorKey = 'gradeStructure.validation.positivePassMark';
    } else if (exceedsMaxDecimals(rawPassMark, pm)) {
      passMarkErrorKey = 'gradeStructure.validation.maxDecimals';
    } else if (pm > totalPoints) {
      passMarkErrorKey = 'gradeStructure.validation.passMarkExceedsTotal';
    }
  }

  const hasRowError = rowErrors.some(
    (r) =>
      Boolean(r.nameErrorKey) ||
      Boolean(r.nameArErrorKey) ||
      Boolean(r.maxPointsErrorKey) ||
      Boolean(r.sourceErrorKey)
  );

  return {
    valid: !hasRowError && !passMarkErrorKey,
    formErrorKey: null,
    passMarkErrorKey,
    rowErrors,
    totalPoints,
  };
}

/**
 * Determines whether the current editor state differs from the loaded grade structure.
 */
export function isGradeStructureDirty(
  original: GradeStructureData | null,
  passMarkInput: string,
  rows: GradeStructureRowDraft[]
): boolean {
  if (!original) return false;

  const trimmedPass = (passMarkInput ?? '').trim();
  const origPass = original.passMark ?? null;
  if (trimmedPass === '') {
    if (origPass !== null) return true;
  } else {
    const parsedPass = Number(trimmedPass);
    if (origPass === null || Number.isNaN(parsedPass) || parsedPass !== origPass) {
      return true;
    }
  }

  const origComponents = original.components || [];
  if (rows.length !== origComponents.length) return true;

  for (let i = 0; i < rows.length; i++) {
    const curr = rows[i];
    const orig = origComponents[i];

    if ((curr.id ?? undefined) !== (orig.id ?? undefined)) return true;
    if (curr.name.trim() !== orig.name.trim()) return true;

    const currNameAr = curr.nameAr.trim() === '' ? null : curr.nameAr.trim();
    const origNameAr = orig.nameAr && orig.nameAr.trim() !== '' ? orig.nameAr.trim() : null;
    if (currNameAr !== origNameAr) return true;

    if (curr.source !== orig.source) return true;

    const trimmedPts = String(curr.maxPointsInput ?? '').trim();
    if (trimmedPts === '') return true;
    const parsedPts = Number(trimmedPts);
    if (Number.isNaN(parsedPts) || parsedPts !== orig.maxPoints) return true;
  }

  return false;
}

/**
 * Builds the exact PUT payload expected by PUT /api/courses/:courseId/grade-structure.
 */
export function buildGradeStructurePutPayload(
  passMarkInput: string,
  rows: GradeStructureRowDraft[]
): UpdateGradeStructurePayload {
  const trimmedPassMark = (passMarkInput ?? '').trim();
  const passMark = trimmedPassMark === '' ? null : Number(trimmedPassMark);

  const components: GradeStructureComponentInput[] = rows.map((row, idx) => {
    const comp: GradeStructureComponentInput = {
      name: row.name.trim(),
      nameAr: row.nameAr && row.nameAr.trim().length > 0 ? row.nameAr.trim() : null,
      maxPoints: Number(String(row.maxPointsInput).trim()),
      source: row.source,
      displayOrder: idx + 1,
    };
    if (typeof row.id === 'number' && Number.isInteger(row.id) && row.id >= 1) {
      comp.id = row.id;
    }
    return comp;
  });

  return {
    passMark,
    components,
  };
}

