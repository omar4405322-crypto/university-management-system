import "../config/loadEnvironment";
import Redis from "ioredis";
import logger from "./logger";
import { AppError } from "./appError";

export class RedisOperationError extends AppError {
  constructor(message: string = "Cache service is temporarily unavailable") {
    super(message, 503);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

type RedisSetClient = Pick<Redis, "set">;
type RedisCacheClient = Pick<Redis, "get" | "set">;
type RedisInvalidationClient = Pick<Redis, "scan" | "del">;

let redis: Redis | null = null;

export const shouldInitializeRedis = (
  env: { REDIS_URL?: string; NODE_ENV?: string } = process.env,
): boolean => Boolean(env.REDIS_URL) && env.NODE_ENV?.trim() !== "test";

const configuredRedisUrl = process.env.REDIS_URL;
if (shouldInitializeRedis() && configuredRedisUrl) {
  redis = new Redis(configuredRedisUrl, {
    maxRetriesPerRequest: 3,
    retryStrategy(times: number) {
      return Math.min(times * 50, 2000);
    },
  });

  redis.on("connect", () => logger.info("[REDIS] Connected to instance"));
  redis.on("error", (err: Error) =>
    logger.error(`[REDIS] Error: ${err.message}`),
  );
} else if (process.env.NODE_ENV?.trim() !== "test") {
  logger.warn(
    "[REDIS] REDIS_URL is not set. Replay protection and dashboard caching are unavailable.",
  );
}

/**
 * Get current Redis connection and configuration status
 */
export const getRedisStatus = () => {
  return {
    configured: Boolean(process.env.REDIS_URL),
    connected: redis ? redis.status === "ready" : false,
    status: redis ? redis.status : "disabled",
  };
};

export const getDashboardCacheHealth = (
  status: ReturnType<typeof getRedisStatus> = getRedisStatus(),
) => ({
  configured: status.configured,
  operational: status.configured && status.connected,
  state: status.configured && status.connected ? "ready" : "degraded",
});

/**
 * Cache data with a TTL
 */
export const setCache = async (
  key: string,
  value: any,
  ttlSeconds: number = 300,
  client: RedisCacheClient | null = redis,
): Promise<void> => {
  if (!client) return;
  try {
    await client.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch (err: any) {
    logger.error(`[REDIS] Set error for ${key}: ${err.message}`);
  }
};

/**
 * Get data from cache
 */
export const getCache = async (
  key: string,
  client: RedisCacheClient | null = redis,
): Promise<any | null> => {
  if (!client) return null;
  try {
    const data = await client.get(key);
    return data ? JSON.parse(data) : null;
  } catch (err: any) {
    logger.error(`[REDIS] Get error for ${key}: ${err.message}`);
    return null;
  }
};

/**
 * Invalidate cache by pattern
 */
export const invalidateCache = async (
  pattern: string,
  client: RedisInvalidationClient | null = redis,
): Promise<void> => {
  if (!client) return;
  try {
    let cursor = "0";
    let invalidatedCount = 0;
    do {
      const [nextCursor, keys] = await client.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        100,
      );
      cursor = nextCursor;
      if (keys.length > 0) {
        await client.del(keys[0], ...keys.slice(1));
        invalidatedCount += keys.length;
      }
    } while (cursor !== "0");

    if (invalidatedCount > 0) {
      logger.info(
        `[REDIS] Invalidated ${invalidatedCount} keys matching ${pattern}`,
      );
    }
  } catch (err: any) {
    logger.error(`[REDIS] Invalidation error for ${pattern}: ${err.message}`);
  }
};

/**
 * Atomically set a key only if it does not exist (NX) with TTL in seconds (EX).
 * Returns true if the key was set and false only when the key already exists.
 * Backend/configuration failures are surfaced as service errors so callers cannot
 * mistake infrastructure failure for a replay.
 */
export const setIfNotExists = async (
  key: string,
  value: string | number | object,
  ttlSeconds: number = 300,
  client: RedisSetClient | null = redis,
): Promise<boolean> => {
  if (!client) {
    throw new RedisOperationError();
  }
  try {
    const stringVal = typeof value === "string" ? value : JSON.stringify(value);
    const result = await client.set(key, stringVal, "EX", ttlSeconds, "NX");
    return result === "OK";
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`[REDIS] setIfNotExists failed: ${msg}`);
    throw new RedisOperationError();
  }
};

export const closeRedis = async (client: Redis | null = redis): Promise<void> => {
  if (!client) return;
  try {
    if (client.status === "ready" || client.status === "connecting") {
      await client.quit();
    } else {
      client.disconnect();
    }
    logger.info("[REDIS] Disconnected cleanly");
  } catch (err: any) {
    logger.warn(`[REDIS] Error during quit, forcing disconnect: ${err.message}`);
    try {
      client.disconnect();
    } catch {
      // Ignore force disconnect error
    }
  }
};

export { redis };
