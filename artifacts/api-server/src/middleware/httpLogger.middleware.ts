import { Request, Response, NextFunction } from "express";
import logger from "../utils/logger";
import { normalizeRoute } from "../utils/metrics";

/**
 * Structured HTTP request completion logger.
 * Never logs request bodies, auth tokens, passwords, or cookies.
 */
export const httpLoggerMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Skip logging internal health checks unless debug logging is enabled
  const isHealthCheck = req.path === "/api/health" || req.path === "/api/healthz" || req.path === "/api/ready";
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    if (isHealthCheck && res.statusCode === 200 && process.env.NODE_ENV === "production") {
      return;
    }

    const end = process.hrtime.bigint();
    const durationMs = Number((end - start) / BigInt(1_000_000));
    const normalized = normalizeRoute(req.baseUrl + (req.route?.path || req.path));
    const actorId = (req as any).user?.id ? String((req as any).user.id) : undefined;
    const actorRole = (req as any).user?.role ? String((req as any).user.role) : undefined;

    const logData = {
      requestId: req.id || res.locals.requestId,
      method: req.method,
      path: req.originalUrl?.split("?")[0] || req.path,
      route: normalized,
      status: res.statusCode,
      durationMs,
      actorId,
      actorRole,
      ip: req.ip || req.socket.remoteAddress,
    };

    if (res.statusCode >= 500) {
      logger.error(`[HTTP] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${durationMs}ms)`, logData);
    } else if (res.statusCode >= 400) {
      logger.warn(`[HTTP] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${durationMs}ms)`, logData);
    } else {
      logger.info(`[HTTP] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${durationMs}ms)`, logData);
    }
  });

  next();
};

export default httpLoggerMiddleware;
