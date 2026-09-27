import http from "node:http";
import logger from "./logger";
import prisma from "./prismaClient";
import { closeRedis } from "./redis.utils";
import { stopAllCronJobs } from "./cron";
import { closeSocket } from "./socket";

import { isShuttingDown, setShuttingDown, resetShutdownState as resetLifecycle } from "./lifecycleState";

export { isShuttingDown, setShuttingDown };

export interface ShutdownDependencies {
  server?: http.Server | null;
  stopCron?: () => Promise<void> | void;
  closeSockets?: () => Promise<void> | void;
  disconnectPrisma?: () => Promise<void> | void;
  closeRedisConnections?: () => Promise<void> | void;
  flushLogs?: () => Promise<void> | void;
  exit?: (code: number) => void;
  timeoutMs?: number;
}

let shutdownPromise: Promise<void> | null = null;

export const resetShutdownState = (): void => {
  resetLifecycle();
  shutdownPromise = null;
};

/**
 * Centralized, idempotent shutdown coordinator.
 * Executes graceful drain of HTTP, WebSockets, Cron, DB, and Redis connections
 * within a configurable timeout deadline.
 */
export const gracefulShutdown = (
  reason: string,
  exitCode: number = 0,
  deps: ShutdownDependencies = {}
): Promise<void> => {
  if (shutdownPromise) {
    logger.info(`[SHUTDOWN] Graceful shutdown already in progress. Ignoring duplicate call (${reason}).`);
    return shutdownPromise;
  }

  setShuttingDown(true);
  logger.info(`[SHUTDOWN] Starting graceful shutdown [reason=${reason}, exitCode=${exitCode}]`);

  const timeoutMs =
    deps.timeoutMs ??
    (process.env.SHUTDOWN_TIMEOUT_MS ? Number(process.env.SHUTDOWN_TIMEOUT_MS) : 10000);

  const exit = deps.exit ?? process.exit;

  shutdownPromise = new Promise<void>((resolve, reject) => {
    // 1. Enforce hard timeout deadline
    const timer = setTimeout(() => {
      logger.error(`[SHUTDOWN] Forced shutdown: deadline of ${timeoutMs}ms exceeded [reason=${reason}].`);
      exit(1);
      resolve();
    }, timeoutMs);

    (async () => {
      try {
        // Step 1: Stop scheduled jobs first to prevent new background executions
        logger.info("[SHUTDOWN] 1/6 Stopping scheduled cron jobs...");
        if (deps.stopCron) {
          await deps.stopCron();
        } else {
          stopAllCronJobs();
        }

        // Step 2: Stop accepting new HTTP requests and drain active requests
        logger.info("[SHUTDOWN] 2/6 Closing HTTP server...");
        if (deps.server) {
          await new Promise<void>((res) => {
            deps.server!.close((err) => {
              if (err) {
                logger.warn(`[SHUTDOWN] HTTP server close error: ${err.message}`);
              }
              res();
            });
            // If server has closeIdleConnections, invoke it
            if (typeof (deps.server as any).closeIdleConnections === "function") {
              (deps.server as any).closeIdleConnections();
            }
          });
        }

        // Step 3: Close Socket.IO connections and adapter pub/sub
        logger.info("[SHUTDOWN] 3/6 Closing Socket.IO server & clients...");
        if (deps.closeSockets) {
          await deps.closeSockets();
        } else {
          await closeSocket();
        }

        // Step 4: Disconnect Prisma database client
        logger.info("[SHUTDOWN] 4/6 Disconnecting Prisma client...");
        if (deps.disconnectPrisma) {
          await deps.disconnectPrisma();
        } else {
          await prisma.$disconnect();
        }

        // Step 5: Close Redis connections
        logger.info("[SHUTDOWN] 5/6 Closing Redis connections...");
        if (deps.closeRedisConnections) {
          await deps.closeRedisConnections();
        } else {
          await closeRedis();
        }

        // Step 6: Flush logs
        logger.info("[SHUTDOWN] 6/6 Flushing logs...");
        if (deps.flushLogs) {
          await deps.flushLogs();
        }

        clearTimeout(timer);
        logger.info(`[SHUTDOWN] Graceful shutdown completed cleanly [reason=${reason}].`);
        exit(exitCode);
        resolve();
      } catch (error: any) {
        clearTimeout(timer);
        logger.error(`[SHUTDOWN] Error during graceful shutdown: ${error?.message || error}`, {
          stack: error?.stack,
        });
        exit(1);
        reject(error);
      }
    })();
  });

  return shutdownPromise;
};

/**
 * Attach OS signal listeners and runtime exception handlers to the server.
 */
export const registerShutdownSignals = (
  server: http.Server,
  customDeps?: Partial<ShutdownDependencies>
): void => {
  const deps: ShutdownDependencies = {
    server,
    ...customDeps,
  };

  const onSignal = (signal: string) => {
    logger.info(`[SHUTDOWN] Received ${signal} signal.`);
    gracefulShutdown(signal, 0, deps).catch(() => {});
  };

  process.on("SIGTERM", () => onSignal("SIGTERM"));
  process.on("SIGINT", () => onSignal("SIGINT"));

  process.on("unhandledRejection", (err: any) => {
    console.error("[FATAL] Unhandled Rejection:", err);
    logger.error(`[FATAL] Unhandled Rejection: ${err?.message}`, { stack: err?.stack });
    gracefulShutdown("unhandledRejection", 1, deps).catch(() => {});
  });

  process.on("uncaughtException", (err: any) => {
    console.error("[FATAL] Uncaught Exception:", err);
    logger.error(`[FATAL] Uncaught Exception: ${err?.message}`, { stack: err?.stack });
    gracefulShutdown("uncaughtException", 1, deps).catch(() => {});
  });
};
