import { Request, Response, NextFunction } from 'express';
import { isOriginAllowed } from '../utils/corsOrigins';
import { AuthorizationError } from '../utils/appError';
import logger from '../utils/logger';

/**
 * Middleware that strictly verifies the Origin or Referer header for the
 * POST /api/auth/refresh endpoint.
 *
 * Rejects requests from non-allowlisted origins or requests with missing origins
 * to mitigate CSRF attacks and unauthorized cross-origin session refresh.
 */
export const validateRefreshOrigin = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let candidateOrigin: string | undefined;

  if (typeof req.headers.origin === 'string' && req.headers.origin.trim().length > 0) {
    candidateOrigin = req.headers.origin.trim();
  } else if (typeof req.headers.referer === 'string' && req.headers.referer.trim().length > 0) {
    try {
      candidateOrigin = new URL(req.headers.referer).origin;
    } catch {
      candidateOrigin = undefined;
    }
  }

  if (!candidateOrigin || !isOriginAllowed(candidateOrigin)) {
    logger.warn(
      `[SECURITY] Blocked POST /api/auth/refresh from unauthorized or missing origin: ${candidateOrigin || 'none'}`
    );
    return next(new AuthorizationError('Unauthorized origin for token refresh'));
  }

  next();
};

export default validateRefreshOrigin;
