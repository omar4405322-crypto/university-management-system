import crypto from 'crypto';
import logger from './logger';

/**
 * SEC-002: Irreversible pseudonymous reference for an email address (e.g. "usr_a1b2c3d4e5f6").
 * Uses truncated SHA-256 hash so plaintext emails are never indexed or exposed in authentication log stores.
 */
export function pseudonymizeEmail(email: string | null | undefined): string {
  if (!email || !String(email).trim()) return 'usr_anonymous';
  const clean = String(email).trim().toLowerCase();
  const hash = crypto.createHash('sha256').update(clean).digest('hex').substring(0, 16);
  return `usr_${hash}`;
}

export const AUTH_EVENT = {
  LOGIN_ATTEMPT: 'AUTH_LOGIN_ATTEMPT',
  LOGIN_SUCCESS: 'AUTH_LOGIN_SUCCESS',
  LOGIN_FAILURE: 'AUTH_LOGIN_FAILURE',
  ACCOUNT_DENIED: 'AUTH_ACCOUNT_DENIED',
  MFA_REQUIRED: 'AUTH_MFA_REQUIRED',
  MFA_FAILURE: 'AUTH_MFA_FAILURE',
  REFRESH_SUCCESS: 'AUTH_REFRESH_SUCCESS',
  REFRESH_REJECTED: 'AUTH_REFRESH_REJECTED',
  SESSION_REVOKED: 'AUTH_SESSION_REVOKED',
  REGISTRATION_SUBMITTED: 'AUTH_REGISTRATION_SUBMITTED',
  REGISTRATION_DUPLICATE: 'AUTH_REGISTRATION_DUPLICATE',
} as const;

export function logAuthEvent(
  event: string,
  data: {
    accountRef?: string;
    userId?: number | string | null;
    reason?: string;
    ip?: string;
    [key: string]: any;
  }
) {
  // Defensive scrub: ensure no credentials or tokens are ever logged
  const sanitized = { ...data };
  const sensitiveKeys = [
    'password',
    'pass',
    'token',
    'totp',
    'totpToken',
    'twoFactorSecret',
    'secret',
    'refreshToken',
    'refresh_token',
    'accessToken',
    'access_token',
    'cookie',
    'cookies',
    'authorization',
    'email',
  ];
  for (const key of sensitiveKeys) {
    delete sanitized[key];
  }

  const isWarning =
    event.includes('FAILURE') || event.includes('DENIED') || event.includes('REJECTED');

  const logFn = isWarning ? logger.warn : logger.info;
  logFn(`[AUTH] ${event}`, sanitized);
}
