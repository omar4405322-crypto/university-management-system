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

let outageLogged = false;

const logRedisError = (message: string) => {
  if (!outageLogged) {
    logger.error(message);
    outageLogged = true;
  }
};

const configuredRedisUrl = process.env.REDIS_URL;
if (shouldInitializeRedis() && configuredRedisUrl) {
  redis = new Redis(configuredRedisUrl, {
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: 2000,
    commandTimeout: 1000,
    retryStrategy(times: number) {
      return Math.min(times * 50, 2000);
    },
  });

  redis.on("connect", () => {
    if (outageLogged) {
      logger.info("[REDIS] Connected to instance (service restored)");
    } else {
      logger.info("[REDIS] Connected to instance");
    }
    outageLogged = false;
  });
  redis.on("ready", () => {
    outageLogged = false;
  });
  redis.on("error", (err: Error) =>
    logRedisError(`[REDIS] Error: ${err.message}`),
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
  if ((client as any).status !== undefined && (client as any).status !== "ready") {
    return;
  }
  try {
    await client.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch (err: any) {
    logRedisError(`[REDIS] Set error for ${key}: ${err.message}`);
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
  if ((client as any).status !== undefined && (client as any).status !== "ready") {
    return null;
  }
  try {
    const data = await client.get(key);
    return data ? JSON.parse(data) : null;
  } catch (err: any) {
    logRedisError(`[REDIS] Get error for ${key}: ${err.message}`);
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
  if ((client as any).status !== undefined && (client as any).status !== "ready") {
    return;
  }
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
    logRedisError(`[REDIS] Invalidation error for ${pattern}: ${err.message}`);
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
  if ((client as any).status !== undefined && (client as any).status !== "ready") {
    throw new RedisOperationError();
  }
  try {
    const stringVal = typeof value === "string" ? value : JSON.stringify(value);
    const result = await client.set(key, stringVal, "EX", ttlSeconds, "NX");
    return result === "OK";
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logRedisError(`[REDIS] setIfNotExists failed: ${msg}`);
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

export interface RedisTelemetry {
  connected: boolean;
  status: string;
  usedMemoryBytes: number;
  usedMemoryHuman: string;
  connectedClients: number;
  blockedClients: number;
  instantaneousOpsPerSec: number;
  keyspaceHits: number;
  keyspaceMisses: number;
  hitRatio: number;
}

export const getRedisTelemetry = async (
  client: Redis | null = redis,
): Promise<RedisTelemetry> => {
  const fallback: RedisTelemetry = {
    connected: false,
    status: client ? client.status : "disabled",
    usedMemoryBytes: 0,
    usedMemoryHuman: "0B",
    connectedClients: 0,
    blockedClients: 0,
    instantaneousOpsPerSec: 0,
    keyspaceHits: 0,
    keyspaceMisses: 0,
    hitRatio: 0,
  };

  if (!client || client.status !== "ready") {
    return fallback;
  }

  try {
    const rawInfo = await client.info();
    const infoMap: Record<string, string> = {};
    for (const line of rawInfo.split("\r\n")) {
      if (line && !line.startsWith("#")) {
        const [k, v] = line.split(":");
        if (k && v !== undefined) {
          infoMap[k.trim()] = v.trim();
        }
      }
    }

    const usedMemoryBytes = Number(infoMap["used_memory"] || 0);
    const usedMemoryHuman = infoMap["used_memory_human"] || "0B";
    const connectedClients = Number(infoMap["connected_clients"] || 0);
    const blockedClients = Number(infoMap["blocked_clients"] || 0);
    const instantaneousOpsPerSec = Number(infoMap["instantaneous_ops_per_sec"] || 0);
    const keyspaceHits = Number(infoMap["keyspace_hits"] || 0);
    const keyspaceMisses = Number(infoMap["keyspace_misses"] || 0);
    const totalHitsMisses = keyspaceHits + keyspaceMisses;
    const hitRatio = totalHitsMisses > 0 ? keyspaceHits / totalHitsMisses : 1.0;

    return {
      connected: true,
      status: client.status,
      usedMemoryBytes,
      usedMemoryHuman,
      connectedClients,
      blockedClients,
      instantaneousOpsPerSec,
      keyspaceHits,
      keyspaceMisses,
      hitRatio,
    };
  } catch (err: any) {
    logRedisError(`[REDIS] Failed to collect telemetry: ${err.message}`);
    return fallback;
  }
};

export const getRedisSlowlog = async (
  limit: number = 10,
  client: Redis | null = redis,
): Promise<any[]> => {
  if (!client || client.status !== "ready") {
    return [];
  }
  try {
    return await (client as any).slowlog("GET", limit);
  } catch (err: any) {
    logRedisError(`[REDIS] Failed to get slowlog: ${err.message}`);
    return [];
  }
};

export { redis };
