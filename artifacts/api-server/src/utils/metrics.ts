import client from "prom-client";
import logger from "./logger";
import prisma from "./prismaClient";
import { getRedisStatus } from "./redis.utils";
import { getIO } from "./socket";

// Create a dedicated Registry for the application metrics
export const register = new client.Registry();

// Add default recommended NodeJS runtime metrics (memory, event loop, CPU, GC)
client.collectDefaultMetrics({
  register,
  prefix: "ums_",
});

// 1. HTTP Request Metrics (Bounded Cardinality)
export const httpRequestCounter = new client.Counter({
  name: "ums_http_requests_total",
  help: "Total number of HTTP requests processed",
  labelNames: ["method", "route", "status_code"],
  registers: [register],
});

export const httpRequestDurationHistogram = new client.Histogram({
  name: "ums_http_request_duration_seconds",
  help: "HTTP request latency in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

export const httpActiveConnectionsGauge = new client.Gauge({
  name: "ums_http_active_connections",
  help: "Number of currently active HTTP requests being handled",
  registers: [register],
});

// 2. Socket.IO Metrics
export const socketConnectedClientsGauge = new client.Gauge({
  name: "ums_socketio_connected_clients",
  help: "Number of active Socket.IO client connections",
  registers: [register],
  collect() {
    try {
      const io = getIO();
      const count = io.sockets?.sockets?.size ?? 0;
      this.set(count);
    } catch {
      this.set(0);
    }
  },
});

// 3. Cron Job Metrics
export const cronExecutionCounter = new client.Counter({
  name: "ums_cron_job_executions_total",
  help: "Total count of cron job runs by status",
  labelNames: ["job_name", "status"],
  registers: [register],
});

export const cronDurationHistogram = new client.Histogram({
  name: "ums_cron_job_duration_seconds",
  help: "Duration of cron job runs in seconds",
  labelNames: ["job_name"],
  buckets: [0.1, 0.5, 1, 5, 15, 30, 60, 120, 300, 600],
  registers: [register],
});

// 4. Infrastructure Dependency Gauges
export const databaseUpGauge = new client.Gauge({
  name: "ums_database_up",
  help: "Database connectivity indicator (1 = up, 0 = down)",
  registers: [register],
});

export const redisUpGauge = new client.Gauge({
  name: "ums_redis_up",
  help: "Redis connectivity indicator (1 = up, 0 = down)",
  registers: [register],
});

/**
 * Route normalizer to eliminate high-cardinality URL parameters.
 * Replaces UUIDs, integer IDs, and hashes with placeholders.
 */
export const normalizeRoute = (path: string): string => {
  if (!path) return "unknown";
  return path
    .split("?")[0]
    // Replace standard UUIDs
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ":id")
    // Replace MongoDB ObjectIDs or 24-32 char hex hashes
    .replace(/\b[0-9a-fA-F]{24,32}\b/g, ":id")
    // Replace numeric IDs in path segments
    .replace(/\/\d+(?=\/|$)/g, "/:id");
};

/**
 * Probe infrastructure status and update metric gauges.
 */
export const updateInfrastructureMetrics = async (): Promise<void> => {
  try {
    await (prisma as any).$queryRaw`SELECT 1`;
    databaseUpGauge.set(1);
  } catch (err) {
    databaseUpGauge.set(0);
  }

  try {
    const redisStatus = getRedisStatus();
    redisUpGauge.set(redisStatus.connected ? 1 : 0);
  } catch {
    redisUpGauge.set(0);
  }
};
