// @ts-nocheck
import { logger } from '../lib/logger';
const isDev = import.meta.env.DEV;

export const logger = {
  log: (...args: unknown[]): void => {
    if (isDev) logger.log('[LOG]', ...args);
  },
  error: (...args: unknown[]): void => {
    if (isDev) logger.error('[ERR]', ...args);
  },
  warn: (...args: unknown[]): void => {
    if (isDev) logger.warn('[WARN]', ...args);
  },
  info: (...args: unknown[]): void => {
    if (isDev) logger.info('[INFO]', ...args);
  },
};
