import { Router, Request, Response, type IRouter } from "express";
import { register, updateInfrastructureMetrics } from "../utils/metrics";

const router: IRouter = Router();

export const metricsAuthMiddleware = (req: Request, res: Response, next: () => void): void => {
  const configuredToken = process.env.METRICS_TOKEN;

  // 1. Check Bearer token or header
  const authHeader = req.headers.authorization;
  const headerToken = req.headers["x-metrics-token"] as string | undefined;

  let providedToken: string | undefined;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    providedToken = authHeader.slice(7).trim();
  } else if (headerToken) {
    providedToken = headerToken.trim();
  }

  if (configuredToken && providedToken === configuredToken) {
    return next();
  }

  // 2. Allow authenticated SUPER_ADMIN user
  if ((req as any).user?.role === "SUPER_ADMIN") {
    return next();
  }

  // 3. Allow development/test access if token is unconfigured
  if (process.env.NODE_ENV !== "production" && !configuredToken) {
    return next();
  }

  res.status(401).json({
    status: "unauthorized",
    message: "Metrics endpoint requires authorization token",
  });
};

router.get("/metrics", metricsAuthMiddleware, async (_req: Request, res: Response): Promise<void> => {
  try {
    await updateInfrastructureMetrics();
    res.setHeader("Content-Type", register.contentType);
    const metrics = await register.metrics();
    res.send(metrics);
  } catch (err: any) {
    res.status(500).send(`Error collecting metrics: ${err.message}`);
  }
});

export default router;
