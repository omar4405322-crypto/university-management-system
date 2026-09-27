/**
 * Cross-tab refresh coordinator using the Web Locks API.
 * Ensures only one tab/worker initiates a token refresh at a time within the same origin.
 * Safely falls back to direct execution if Web Locks are unavailable.
 */
export const withCrossTabRefreshLock = async <T>(fn: () => Promise<T>): Promise<T> => {
  if (
    typeof navigator !== 'undefined' &&
    'locks' in navigator &&
    typeof (navigator as any).locks?.request === 'function'
  ) {
    return (navigator as any).locks.request('auth-token-refresh', fn);
  }
  return fn();
};
