import { ConflictError, ValidationError } from './appError';
import { MAX_POINTS_TECHNICAL_CEILING } from '../validations/gradeStructure.validation';
import type { Prisma } from '@prisma/client';

export { MAX_POINTS_TECHNICAL_CEILING };

export const MAX_QUESTION_TEXT_LENGTH = 4000;
export const MAX_OPTION_TEXT_LENGTH = 1000;
export const MAX_EXAM_TITLE_LENGTH = 200;
export const MAX_EXAM_ROOM_LENGTH = 100;
export const MAX_EXAM_TIME_LENGTH = 20;

const TAG_LIKE_PATTERN = /<[A-Za-z/!?]/;
const DANGEROUS_URI_PATTERN = /(?:javascript\s*:|data\s*:\s*text\/html)/i;
const CONTROL_CHAR_PATTERN = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/;

/**
 * Validates text inputs against tag-like HTML patterns, dangerous URI schemes,
 * ASCII control characters, and length ceilings.
 * Does not mutate stored data.
 */
export function validateGuardedText(
  value: unknown,
  fieldName: string,
  maxLength: number,
  isRequired: boolean = false,
): string | null {
  if (value === undefined || value === null) {
    if (isRequired) {
      throw new ValidationError(`${fieldName} is required`);
    }
    return null;
  }

  if (typeof value !== 'string') {
    throw new ValidationError(`${fieldName} must be a string`);
  }

  const str = value;

  if (isRequired && str.trim().length === 0) {
    throw new ValidationError(`${fieldName} cannot be empty`);
  }

  if (CONTROL_CHAR_PATTERN.test(str)) {
    throw new ValidationError(`${fieldName} contains forbidden control characters`);
  }

  if (TAG_LIKE_PATTERN.test(str)) {
    throw new ValidationError(`${fieldName} contains forbidden HTML tag or markup pattern`);
  }

  if (DANGEROUS_URI_PATTERN.test(str)) {
    throw new ValidationError(`${fieldName} contains forbidden script or data URI pattern`);
  }

  if (str.length > maxLength) {
    throw new ValidationError(
      `${fieldName} exceeds maximum allowed length of ${maxLength} characters (received ${str.length})`,
    );
  }

  return str;
}

/**
 * Validates points to ensure finite integer between 0 and MAX_POINTS_TECHNICAL_CEILING.
 */
export function validateQuizPoints(
  value: unknown,
  isRequired: boolean = false,
): number | undefined {
  if (value === undefined || value === null) {
    if (isRequired) {
      throw new ValidationError('Points are required');
    }
    return undefined;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
      throw new ValidationError('Points must be a finite integer');
    }
    if (value < 0 || value > MAX_POINTS_TECHNICAL_CEILING) {
      throw new ValidationError(
        `Points must be between 0 and ${MAX_POINTS_TECHNICAL_CEILING} (received ${value})`,
      );
    }
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '' || !/^-?\d+$/.test(trimmed)) {
      throw new ValidationError('Points must be a valid integer');
    }
    const num = Number(trimmed);
    if (!Number.isSafeInteger(num)) {
      throw new ValidationError('Points must be a finite integer');
    }
    if (num < 0 || num > MAX_POINTS_TECHNICAL_CEILING) {
      throw new ValidationError(
        `Points must be between 0 and ${MAX_POINTS_TECHNICAL_CEILING} (received ${num})`,
      );
    }
    return num;
  }

  throw new ValidationError('Points must be a finite integer');
}

/**
 * Asserts that an exam has no existing attempts before modifying questions or deleting the exam.
 * If any ExamSubmission exists, throws ConflictError (409) with QUIZ_LOCKED_AFTER_ATTEMPT: prefix.
 */
export async function assertExamNotLockedAfterAttempt(
  tx: Prisma.TransactionClient,
  examId: number,
  actionDescription: string,
): Promise<void> {
  const existingSubmission = await tx.examSubmission.findFirst({
    where: { examId },
    select: { id: true },
  });

  if (existingSubmission) {
    throw new ConflictError(
      `QUIZ_LOCKED_AFTER_ATTEMPT: Cannot ${actionDescription}: student attempts already exist for this exam.`,
    );
  }
}
