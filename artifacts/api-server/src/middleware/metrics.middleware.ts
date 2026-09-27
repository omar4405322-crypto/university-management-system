import { Request, Response, NextFunction } from "express";
import {
  httpRequestCounter,
  httpRequestDurationHistogram,
  httpActiveConnectionsGauge,
  normalizeRoute,
} from "../utils/metrics";

/**
 * Middleware measuring HTTP request counts and latencies without unbounded cardinality.
 */
export const metricsMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Avoid collecting metrics for the metrics endpoint itself
  if (req.path === "/metrics") {
    return next();
  }

  httpActiveConnectionsGauge.inc();
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    httpActiveConnectionsGauge.dec();
    const end = process.hrtime.bigint();
    const durationSeconds = Number(end - start) / 1_000_000_000;

    const route = normalizeRoute(req.baseUrl + (req.route?.path || req.path));
    const statusCode = String(res.statusCode);
    const method = req.method;

    httpRequestCounter.inc({ method, route, status_code: statusCode });
    httpRequestDurationHistogram.observe({ method, route, status_code: statusCode }, durationSeconds);
  });

  next();
};

export default metricsMiddleware;
