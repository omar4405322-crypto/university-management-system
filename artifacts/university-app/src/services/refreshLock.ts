/**
 * Cross-tab refresh coordinator using the Web Locks API.
 * Ensures only one tab/worker initiates a token refresh at a time within the same origin.
 * Safely falls back to direct execution if Web Locks are unavailable.
 *
 * navigator.locks is typed as `LockManager` in the "dom.iterable" lib
 * (included via tsconfig). We use a type guard to avoid direct `as any` casts
 * while remaining safe when the API is absent (older browsers / non-secure origins).
 */

function hasLockManager(nav: Navigator): nav is Navigator & { locks: LockManager } {
  return 'locks' in nav && typeof (nav as Navigator & { locks?: { request?: unknown } }).locks?.request === 'function';
}

export const withCrossTabRefreshLock = async <T>(fn: () => Promise<T>): Promise<T> => {
  if (typeof navigator !== 'undefined' && hasLockManager(navigator)) {
    return navigator.locks.request('auth-token-refresh', fn);
  }
  return fn();
};
