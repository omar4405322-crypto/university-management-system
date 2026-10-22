export interface TermLockable {
  isCurrent: boolean;
  endDate: Date | string;
  status?: string | null;
}

/**
 * Returns true if the academic term is in the past (not current and endDate < now).
 */
export function isTermPast(term: TermLockable | null | undefined, now: Date = new Date()): boolean {
  if (!term) return false;
  return !term.isCurrent && new Date(term.endDate) < now;
}

/**
 * Returns true if the academic term is locked for modifications:
 * either because it is in the past or its status is explicitly 'LOCKED'.
 */
export function isTermLocked(term: TermLockable | null | undefined, now: Date = new Date()): boolean {
  if (!term) return false;
  return isTermPast(term, now) || term.status === 'LOCKED';
}
