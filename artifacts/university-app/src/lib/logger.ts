const isDev = import.meta.env.DEV;

export const logger = {
  log: (...args: unknown[]): void => {
    if (isDev) console.log('[LOG]', ...args);
  },
  error: (...args: unknown[]): void => {
    if (isDev) console.error('[ERR]', ...args);
  },
  warn: (...args: unknown[]): void => {
    if (isDev) console.warn('[WARN]', ...args);
  },
  info: (...args: unknown[]): void => {
    if (isDev) console.info('[INFO]', ...args);
  },
};
