export interface QuizLockCandidate {
  status?: number;
  message?: string | null;
  rawMessage?: string | null;
}

export function isQuizLockedError(res: QuizLockCandidate | null | undefined): boolean {
  if (!res || res.status !== 409) {
    return false;
  }
  const msg =
    typeof res.message === 'string' && res.message.length > 0
      ? res.message
      : typeof res.rawMessage === 'string'
        ? res.rawMessage
        : '';
  return msg.includes('QUIZ_LOCKED_AFTER_ATTEMPT');
}

