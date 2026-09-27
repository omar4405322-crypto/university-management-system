import { randomUUID } from "node:crypto";
import os from "node:os";
import process from "node:process";
import { redis as defaultRedis, RedisOperationError } from "./redis.utils";
import logger from "./logger";
import { isShuttingDown } from "./lifecycleState";

export const CRON_TIMEZONE = "Africa/Cairo";

const LUA_SAFE_RELEASE_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;

export interface LeaseResult {
  acquired: boolean;
  ownerToken: string;
  leaseKey: string;
}

export interface DistributedJobExecutionResult<T = unknown> {
  executed: boolean;
  result?: T;
  reason?: "LOCK_HELD" | "REDIS_UNAVAILABLE_PRODUCTION" | "ERROR" | "SHUTTING_DOWN";
  ownerToken?: string;
}

export interface DistributedLockOptions {
  redisClient?: any;
  ownerToken?: string;
  isProduction?: boolean;
}

export function generateOwnerToken(): string {
  return `${os.hostname()}:${process.pid}:${randomUUID()}`;
}

/**
 * Attempt to acquire an atomic distributed lease for a scheduled job.
 */
export async function acquireJobLease(
  jobName: string,
  ttlSeconds: number,
  options: DistributedLockOptions = {}
): Promise<LeaseResult> {
  const client = options.redisClient ?? defaultRedis;
  const ownerToken = options.ownerToken ?? generateOwnerToken();
  const leaseKey = `lock:cron:${jobName}`;

  if (!client) {
    throw new RedisOperationError(`Redis client not available for job lease ${jobName}`);
  }

  try {
    const response = await client.set(leaseKey, ownerToken, "EX", ttlSeconds, "NX");
    const acquired = response === "OK";
    if (acquired) {
      logger.info(`[LOCK] Acquired lease for job "${jobName}" [owner=${ownerToken}, ttl=${ttlSeconds}s]`);
    } else {
      logger.debug(`[LOCK] Lease for job "${jobName}" is currently held by another worker`);
    }
    return { acquired, ownerToken, leaseKey };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`[LOCK] Error acquiring lease for job "${jobName}": ${message}`);
    throw new RedisOperationError(message);
  }
}

/**
 * Safely release an acquired lease. Only releases if the ownerToken matches.
 */
export async function releaseJobLease(
  leaseKey: string,
  ownerToken: string,
  options: DistributedLockOptions = {}
): Promise<boolean> {
  const client = options.redisClient ?? defaultRedis;
  if (!client) return false;

  try {
    const result = await client.eval(LUA_SAFE_RELEASE_SCRIPT, 1, leaseKey, ownerToken);
    const released = result === 1;
    if (released) {
      logger.debug(`[LOCK] Released lease "${leaseKey}" [owner=${ownerToken}]`);
    } else {
      logger.warn(`[LOCK] Lease "${leaseKey}" was not released: token mismatch or already expired`);
    }
    return released;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`[LOCK] Error releasing lease "${leaseKey}": ${message}`);
    return false;
  }
}

/**
 * Execute a scheduled task inside a distributed lease.
 * Production Fail-Safe: If Redis is unavailable in production, skips execution to prevent duplicate execution across replicas.
 * Development Fallback: In non-production environments without Redis configured, allows local standalone execution.
 */
export async function withDistributedJobLease<T>(
  jobName: string,
  ttlSeconds: number,
  task: (lease: { ownerToken: string; leaseKey: string }) => Promise<T>,
  options: DistributedLockOptions = {}
): Promise<DistributedJobExecutionResult<T>> {
  if (isShuttingDown()) {
    logger.info(`[CRON] Server is shutting down. Skipping execution of job "${jobName}".`);
    return { executed: false, reason: "SHUTTING_DOWN" };
  }

  const client = options.redisClient ?? defaultRedis;
  const isProduction = options.isProduction ?? (process.env.NODE_ENV === "production");

  // If no Redis client is available
  if (!client) {
    if (isProduction) {
      logger.error(
        `[CRON] CRITICAL: Redis coordination is unavailable in production for job "${jobName}". ` +
        `Skipping execution to guarantee zero duplicate executions across replicas.`
      );
      return { executed: false, reason: "REDIS_UNAVAILABLE_PRODUCTION" };
    }

    // Development/test fallback when REDIS_URL is not set
    logger.info(`[CRON] Standalone local execution of job "${jobName}" (Redis unconfigured)`);
    try {
      const result = await task({ ownerToken: "local-standalone", leaseKey: `lock:cron:${jobName}` });
      return { executed: true, result, ownerToken: "local-standalone" };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`[CRON] Error during local standalone execution of "${jobName}": ${message}`);
      return { executed: false, reason: "ERROR" };
    }
  }

  // Redis is configured: acquire atomic lease
  let lease: LeaseResult;
  try {
    lease = await acquireJobLease(jobName, ttlSeconds, options);
  } catch (err: unknown) {
    if (isProduction) {
      logger.error(
        `[CRON] CRITICAL: Failed to communicate with Redis for job "${jobName}". ` +
        `Skipping execution to avoid concurrent duplicate runs.`
      );
      return { executed: false, reason: "REDIS_UNAVAILABLE_PRODUCTION" };
    }
    logger.warn(`[CRON] Redis error in non-production for job "${jobName}". Skipping.`);
    return { executed: false, reason: "ERROR" };
  }

  if (!lease.acquired) {
    logger.info(`[CRON] Job "${jobName}" lease is held by another instance. Skipping execution on this replica.`);
    return { executed: false, reason: "LOCK_HELD" };
  }

  try {
    const result = await task({ ownerToken: lease.ownerToken, leaseKey: lease.leaseKey });
    return { executed: true, result, ownerToken: lease.ownerToken };
  } finally {
    await releaseJobLease(lease.leaseKey, lease.ownerToken, options);
  }
}
