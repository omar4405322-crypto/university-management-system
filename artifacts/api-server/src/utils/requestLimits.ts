export const MAX_PAGE_SIZE = 100;
export const MAX_PAGE_NUMBER = 1_000_000;

export const MAX_ANSWER_ITEMS = 200;
export const MAX_ANSWER_LENGTH = 4_000;
export const MAX_QUESTION_ID_LENGTH = 64;

export const MAX_ATTENDANCE_RECORDS = 500;
export const MAX_ATTENDANCE_REMARKS_LENGTH = 1_000;

export const MAX_ANTI_CHEAT_LOGS = 500;
export const MAX_ANTI_CHEAT_TYPE_LENGTH = 64;
export const MAX_ANTI_CHEAT_DETAILS_LENGTH = 2_000;
export const MAX_EXAM_CANCEL_REASON_LENGTH = 1_000;

export const MAX_SCHEDULE_SYNC_SLOTS = 500;
export const MAX_SCHEDULE_TEXT_LENGTH = 200;

const DECIMAL_INTEGER = /^\d+$/;

export function isBoundedPositiveInteger(value: unknown, maximum: number): boolean {
  if (typeof value !== 'string' && typeof value !== 'number') return false;

  const normalized = String(value);
  if (!DECIMAL_INTEGER.test(normalized)) return false;

  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= maximum;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isBoundedAnswer(value: unknown): boolean {
  if (value === null || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  return typeof value === 'string' && value.length <= MAX_ANSWER_LENGTH;
}

function isQuestionId(value: unknown): boolean {
  return (
    (typeof value === 'string' || typeof value === 'number') &&
    String(value).length <= MAX_QUESTION_ID_LENGTH &&
    isBoundedPositiveInteger(value, Number.MAX_SAFE_INTEGER)
  );
}

export function isBoundedAnswerCollection(value: unknown): boolean {
  if (Array.isArray(value)) {
    if (value.length > MAX_ANSWER_ITEMS) return false;

    return value.every((entry) => {
      if (!isPlainObject(entry)) return false;
      const keys = Object.keys(entry);
      if (keys.some((key) => key !== 'questionId' && key !== 'answer')) return false;
      return isQuestionId(entry.questionId) && isBoundedAnswer(entry.answer);
    });
  }

  if (!isPlainObject(value)) return false;
  const entries = Object.entries(value);
  return (
    entries.length <= MAX_ANSWER_ITEMS &&
    entries.every(([questionId, answer]) => isQuestionId(questionId) && isBoundedAnswer(answer))
  );
}

export function isBoundedAntiCheatLogCollection(value: unknown): boolean {
  if (!Array.isArray(value) || value.length > MAX_ANTI_CHEAT_LOGS) return false;

  return value.every((entry) => {
    if (!isPlainObject(entry)) return false;
    const keys = Object.keys(entry);
    if (keys.some((key) => !['type', 'details', 'occurredAt'].includes(key))) return false;

    if (
      typeof entry.type !== 'string' ||
      entry.type.length < 1 ||
      entry.type.length > MAX_ANTI_CHEAT_TYPE_LENGTH
    ) {
      return false;
    }
    if (
      entry.details !== undefined &&
      (typeof entry.details !== 'string' ||
        entry.details.length > MAX_ANTI_CHEAT_DETAILS_LENGTH)
    ) {
      return false;
    }
    if (
      entry.occurredAt !== undefined &&
      (typeof entry.occurredAt !== 'string' ||
        entry.occurredAt.length > 64 ||
        !Number.isFinite(Date.parse(entry.occurredAt)))
    ) {
      return false;
    }

    return true;
  });
}
