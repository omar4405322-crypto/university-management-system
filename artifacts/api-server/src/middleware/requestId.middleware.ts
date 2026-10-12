import { Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";
import * as Sentry from "@sentry/node";
import logger from "../utils/logger";
import type winston from "winston";

const SAFE_REQUEST_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;

declare global {
  namespace Express {
    interface Request {
      id?: string;
      log?: winston.Logger;
    }
  }
}

/**
 * Validates or generates a strict correlation ID for each incoming HTTP request.
 * Propagates valid incoming headers or generates a random UUID v4.
 * Attaches a correlated child logger (req.log) to the request.
 */
export const requestIdMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const incomingId =
    (req.headers["x-request-id"] as string) ||
    (req.headers["x-correlation-id"] as string);

  let validId: string;
  if (incomingId && typeof incomingId === "string" && SAFE_REQUEST_ID_REGEX.test(incomingId)) {
    validId = incomingId;
  } else {
    validId = randomUUID();
  }

  req.id = validId;
  req.log = logger.child({ requestId: validId });
  res.locals.requestId = validId;
  res.setHeader("X-Request-Id", validId);

  // Bind correlation ID to Sentry tag for tracing
  try {
    Sentry.setTag("requestId", validId);
  } catch {
    // Ignore if Sentry is not initialized
  }

  next();
};

export default requestIdMiddleware;
