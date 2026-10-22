import { param, query } from 'express-validator';
import { ValidationError } from '../utils/appError';

export const MAX_DECIMAL_PLACES = 2;

export const gradebookGetValidation = [
  param('courseId')
    .notEmpty()
    .withMessage('Course ID is required')
    .isInt({ min: 1 })
    .withMessage('Invalid course ID format'),
  query('termId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Invalid term ID format'),
];

export const gradebookPostDraftValidation = [
  param('courseId')
    .notEmpty()
    .withMessage('Course ID is required')
    .isInt({ min: 1 })
    .withMessage('Invalid course ID format'),
  query('termId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Invalid term ID format'),
];

export interface GradeDraftEntryInput {
  enrollmentId: number;
  componentId: number;
  score: number | null;
  isAbsent: boolean;
  version?: number;
  notes?: string | null;
}

export interface SaveGradebookDraftInput {
  entries: GradeDraftEntryInput[];
}

/**
 * Validates the draft entries array per WP-4 T-3 rules D1, D2, D4.
 */
export function validateSaveGradebookDraftInput(body: unknown): SaveGradebookDraftInput {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('Request body must be a JSON object');
  }

  const { entries } = body as { entries?: unknown };

  if (!Array.isArray(entries) || entries.length === 0) {
    throw new ValidationError('entries must be a non-empty array');
  }

  const seenPairs = new Set<string>();
  const validatedEntries: GradeDraftEntryInput[] = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (!entry || typeof entry !== 'object') {
      throw new ValidationError(`Entry at index ${i} must be an object`);
    }

    const { enrollmentId, componentId, score, isAbsent, version, notes } = entry as Record<string, unknown>;

    // 1. enrollmentId & componentId
    if (typeof enrollmentId !== 'number' || !Number.isSafeInteger(enrollmentId) || enrollmentId <= 0) {
      throw new ValidationError(`Entry at index ${i}: enrollmentId must be a positive integer`);
    }
    if (typeof componentId !== 'number' || !Number.isSafeInteger(componentId) || componentId <= 0) {
      throw new ValidationError(`Entry at index ${i}: componentId must be a positive integer`);
    }

    // Duplicate check in payload (D4)
    const pairKey = `${enrollmentId}:${componentId}`;
    if (seenPairs.has(pairKey)) {
      throw new ValidationError(`Duplicate enrollmentId ${enrollmentId} and componentId ${componentId} in payload`);
    }
    seenPairs.add(pairKey);

    // 2. isAbsent
    if (typeof isAbsent !== 'boolean') {
      throw new ValidationError(`Entry at index ${i}: isAbsent must be a boolean`);
    }

    // 3. score (D2: JSON number, strings rejected, finite, >= 0, at most 2 decimals)
    let validatedScore: number | null = null;
    if (isAbsent) {
      if (score !== null && score !== undefined) {
        throw new ValidationError(`Entry at index ${i}: isAbsent true requires score to be null`);
      }
      validatedScore = null;
    } else {
      if (score !== null && score !== undefined) {
        if (typeof score !== 'number' || !Number.isFinite(score) || Number.isNaN(score)) {
          throw new ValidationError(`Entry at index ${i}: score must be a finite number`);
        }
        if (score < 0) {
          throw new ValidationError(`Entry at index ${i}: score must be greater than or equal to 0`);
        }

        const scoreStr = score.toString();
        const parts = scoreStr.split('.');
        if (parts.length > 1 && parts[1].length > MAX_DECIMAL_PLACES) {
          throw new ValidationError(`Entry at index ${i}: score cannot exceed ${MAX_DECIMAL_PLACES} decimal places`);
        }
        validatedScore = score;
      } else {
        validatedScore = null;
      }
    }

    // 4. version (optional on create, required on update)
    let validatedVersion: number | undefined = undefined;
    if (version !== undefined && version !== null) {
      if (typeof version !== 'number' || !Number.isSafeInteger(version) || version <= 0) {
        throw new ValidationError(`Entry at index ${i}: version must be a positive integer`);
      }
      validatedVersion = version;
    }

    // 5. notes (plain text without control characters or angle brackets)
    let validatedNotes: string | null = null;
    if (notes !== undefined && notes !== null) {
      if (typeof notes !== 'string') {
        throw new ValidationError(`Entry at index ${i}: notes must be a string`);
      }
      if (/[\x00-\x1F\x7F]/.test(notes)) {
        throw new ValidationError(`Entry at index ${i}: notes contains invalid control characters`);
      }
      if (/[<>]/.test(notes)) {
        throw new ValidationError(`Entry at index ${i}: notes contains angle brackets`);
      }
      if (notes.length > 500) {
        throw new ValidationError(`Entry at index ${i}: notes must not exceed 500 characters`);
      }
      validatedNotes = notes.trim() === '' ? null : notes.trim();
    }

    validatedEntries.push({
      enrollmentId,
      componentId,
      score: validatedScore,
      isAbsent,
      version: validatedVersion,
      notes: validatedNotes,
    });
  }

  return { entries: validatedEntries };
}

export const MIN_CORRECTION_REASON_LENGTH = 5;
export const MAX_CORRECTION_REASON_LENGTH = 500;

export interface PublishGradebookInput {
  enrollmentIds?: number[];
}

export function validatePublishGradebookInput(body: unknown): PublishGradebookInput {
  if (!body || typeof body !== 'object') {
    return {};
  }
  const { enrollmentIds } = body as { enrollmentIds?: unknown };
  if (enrollmentIds === undefined || enrollmentIds === null) {
    return {};
  }
  if (!Array.isArray(enrollmentIds)) {
    throw new ValidationError('enrollmentIds must be an array of positive integers');
  }
  const validatedIds: number[] = [];
  for (const id of enrollmentIds) {
    if (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0) {
      throw new ValidationError('Each enrollmentId must be a positive integer');
    }
    validatedIds.push(id);
  }
  return { enrollmentIds: validatedIds };
}

export interface GradeCorrectionEntryInput {
  enrollmentId: number;
  componentId: number;
  score: number | null;
  isAbsent: boolean;
  version: number;
  reason: string;
}

export interface CorrectGradebookInput {
  corrections: GradeCorrectionEntryInput[];
}

export function validateCorrectionReason(reason: unknown, index?: number): string {
  const prefix = index !== undefined ? `Correction at index ${index}: ` : '';
  if (typeof reason !== 'string') {
    throw new ValidationError(`${prefix}reason is required and must be a string`);
  }
  const trimmed = reason.trim();
  if (
    trimmed.length < MIN_CORRECTION_REASON_LENGTH ||
    trimmed.length > MAX_CORRECTION_REASON_LENGTH
  ) {
    throw new ValidationError(
      `${prefix}reason must be between ${MIN_CORRECTION_REASON_LENGTH} and ${MAX_CORRECTION_REASON_LENGTH} characters`
    );
  }
  if (/[\x00-\x1F\x7F]/.test(trimmed)) {
    throw new ValidationError(`${prefix}reason contains invalid control characters`);
  }
  if (/[<>]/.test(trimmed)) {
    throw new ValidationError(`${prefix}reason must not contain angle brackets`);
  }
  return trimmed;
}

export function validateCorrectGradebookInput(body: unknown): CorrectGradebookInput {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('Request body must be a JSON object');
  }

  const { corrections } = body as { corrections?: unknown };
  if (!Array.isArray(corrections) || corrections.length === 0) {
    throw new ValidationError('corrections must be a non-empty array');
  }

  const validatedCorrections: GradeCorrectionEntryInput[] = [];
  const seenPairs = new Set<string>();

  for (let i = 0; i < corrections.length; i++) {
    const item = corrections[i];
    if (!item || typeof item !== 'object') {
      throw new ValidationError(`Correction at index ${i} must be an object`);
    }

    const { enrollmentId, componentId, score, isAbsent, version, reason } = item as Record<string, unknown>;

    if (typeof enrollmentId !== 'number' || !Number.isSafeInteger(enrollmentId) || enrollmentId <= 0) {
      throw new ValidationError(`Correction at index ${i}: enrollmentId must be a positive integer`);
    }
    if (typeof componentId !== 'number' || !Number.isSafeInteger(componentId) || componentId <= 0) {
      throw new ValidationError(`Correction at index ${i}: componentId must be a positive integer`);
    }

    const pairKey = `${enrollmentId}:${componentId}`;
    if (seenPairs.has(pairKey)) {
      throw new ValidationError(`Duplicate enrollmentId ${enrollmentId} and componentId ${componentId} in corrections`);
    }
    seenPairs.add(pairKey);

    if (typeof version !== 'number' || !Number.isSafeInteger(version) || version <= 0) {
      throw new ValidationError(`Correction at index ${i}: version is required and must be a positive integer`);
    }

    const validatedReason = validateCorrectionReason(reason, i);

    const validatedIsAbsent = isAbsent === true;
    let validatedScore: number | null = null;

    if (validatedIsAbsent) {
      if (score !== null && score !== undefined) {
        throw new ValidationError(`Correction at index ${i}: isAbsent true requires score to be null`);
      }
      validatedScore = null;
    } else {
      if (score === null || score === undefined) {
        throw new ValidationError(`Correction at index ${i}: score is required when isAbsent is false`);
      }
      if (typeof score !== 'number' || !Number.isFinite(score) || Number.isNaN(score)) {
        throw new ValidationError(`Correction at index ${i}: score must be a finite number`);
      }
      if (score < 0) {
        throw new ValidationError(`Correction at index ${i}: score must be greater than or equal to 0`);
      }
      const scoreStr = score.toString();
      const parts = scoreStr.split('.');
      if (parts.length > 1 && parts[1].length > MAX_DECIMAL_PLACES) {
        throw new ValidationError(`Correction at index ${i}: score cannot exceed ${MAX_DECIMAL_PLACES} decimal places`);
      }
      validatedScore = score;
    }

    validatedCorrections.push({
      enrollmentId,
      componentId,
      score: validatedScore,
      isAbsent: validatedIsAbsent,
      version,
      reason: validatedReason,
    });
  }

  return { corrections: validatedCorrections };
}
