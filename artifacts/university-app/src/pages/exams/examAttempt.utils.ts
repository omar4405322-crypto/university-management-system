export type McqDisplayLetter = 'A' | 'B' | 'C' | 'D';
export type McqOriginalKey = 'A' | 'B' | 'C' | 'D';

export interface McqOptionItem {
  displayLetter: McqDisplayLetter;
  originalKey: McqOriginalKey;
  text: string;
}

const POSITIONAL_LETTERS: McqDisplayLetter[] = ['A', 'B', 'C', 'D'];

/**
 * Extracts and maps MCQ options into positional order with display letters A-D,
 * while preserving the original server key ('A', 'B', 'C', 'D') for correct answer submission.
 */
export function getMcqDisplayOptions(question: any): McqOptionItem[] {
  if (!question) return [];

  if (Array.isArray(question.optionOrder) && question.optionOrder.length > 0) {
    const items: McqOptionItem[] = [];
    question.optionOrder.forEach((orderKey: unknown, index: number) => {
      if (typeof orderKey !== 'string') return;
      const keyStr = orderKey.trim();
      let originalKey: McqOriginalKey = 'A';
      if (keyStr.toLowerCase().startsWith('option')) {
        const rawLetter = keyStr.slice(6).toUpperCase();
        if (['A', 'B', 'C', 'D'].includes(rawLetter)) {
          originalKey = rawLetter as McqOriginalKey;
        }
      } else {
        const rawLetter = keyStr.toUpperCase();
        if (['A', 'B', 'C', 'D'].includes(rawLetter)) {
          originalKey = rawLetter as McqOriginalKey;
        }
      }

      const text =
        question[keyStr] ||
        question[`option${originalKey}`] ||
        question[`option_${originalKey.toLowerCase()}`] ||
        '';

      const displayLetter = POSITIONAL_LETTERS[index] || ('A' as McqDisplayLetter);
      items.push({
        displayLetter,
        originalKey,
        text: String(text),
      });
    });

    if (items.length > 0) {
      return items;
    }
  }

  // Fallback: legacy static options A-D
  return POSITIONAL_LETTERS.map((letter) => {
    const text =
      question[`option${letter}`] ||
      question[`option_${letter.toLowerCase()}`] ||
      '';
    return {
      displayLetter: letter,
      originalKey: letter,
      text: String(text),
    };
  });
}

/**
 * Computes remaining seconds for an exam attempt using a monotonic clock (performance.now),
 * eliminating vulnerability to OS system clock changes or jumps.
 */
export function calculateRemainingSeconds(
  attemptEndsAt: string | Date,
  serverNow: string | Date,
  clientReceivedPerfMs: number,
  currentClientPerfMs: number = (typeof performance !== 'undefined' ? performance.now() : Date.now())
): number {
  const endsAtMs = new Date(attemptEndsAt).getTime();
  const serverNowMs = new Date(serverNow).getTime();

  if (isNaN(endsAtMs) || isNaN(serverNowMs)) return 0;

  const totalAllowedMs = endsAtMs - serverNowMs;
  const elapsedMs = Math.max(0, currentClientPerfMs - clientReceivedPerfMs);
  const remainingMs = totalAllowedMs - elapsedMs;

  return Math.max(0, Math.floor(remainingMs / 1000));
}

/**
 * Checks whether questions must be refetched on page reload.
 * Returns true if the attempt is PENDING and the questions list is empty.
 */
export function shouldRefetchQuestions(
  questions: unknown[] | null | undefined,
  submissionStatus: string | null | undefined
): boolean {
  return (
    submissionStatus === 'PENDING' &&
    (!questions || !Array.isArray(questions) || questions.length === 0)
  );
}

export type ExamAttemptView =
  | 'PREPARING'
  | 'IN_PROGRESS'
  | 'COMPLETING'
  | 'COMPLETED'
  | 'CANCELLED';

/**
 * Pure mapping from server submission status to the client attempt view.
 * - PENDING -> 'IN_PROGRESS'
 * - COMPLETED / SUBMITTED / GRADED -> 'COMPLETED'
 * - CANCELLED_CHEATING and any other cancelled status -> 'CANCELLED'
 * - null / undefined / empty -> 'PREPARING'
 */
export function resolveAttemptView(
  submissionStatus: string | null | undefined
): ExamAttemptView {
  if (!submissionStatus) return 'PREPARING';
  const s = String(submissionStatus).trim().toUpperCase();
  if (s === 'PENDING') return 'IN_PROGRESS';
  if (s === 'COMPLETED' || s === 'SUBMITTED' || s === 'GRADED') return 'COMPLETED';
  if (s.includes('CANCEL')) return 'CANCELLED';
  return 'PREPARING';
}

/**
 * Determines whether the Start button should render.
 * The Start button renders ONLY when there is no existing submission and the view is PREPARING.
 */
export function canStartExam(
  hasSubmission: boolean,
  view: ExamAttemptView
): boolean {
  return !hasSubmission && view === 'PREPARING';
}
