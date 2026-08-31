import Redis from 'ioredis';
import logger from './logger';

let redis: Redis | null = null;

if (process.env.REDIS_URL && process.env.NODE_ENV?.trim() !== 'test') {
  redis = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy(times: number) {
      return Math.min(times * 50, 2000);
    },
  });

  redis.on('connect', () => logger.info('[REDIS] Connected to instance'));
  redis.on('error', (err: Error) => logger.error(`[REDIS] Error: ${err.message}`));
} else if (process.env.NODE_ENV?.trim() !== 'test') {
  logger.warn('[REDIS] REDIS_URL is not set. TOTP replay protection will not be shared across instances and relies only on in-memory process state.');
}

/**
 * Get current Redis connection and configuration status
 */
export const getRedisStatus = () => {
  return {
    configured: Boolean(process.env.REDIS_URL),
    connected: redis ? redis.status === 'ready' : false,
    status: redis ? redis.status : 'disabled',
  };
};

/**
 * Cache data with a TTL
 */
export const setCache = async (
  key: string,
  value: any,
  ttlSeconds: number = 300
): Promise<void> => {
  if (!redis) return;
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch (err: any) {
    logger.error(`[REDIS] Set error for ${key}: ${err.message}`);
  }
};

/**
 * Get data from cache
 */
export const getCache = async (key: string): Promise<any | null> => {
  if (!redis) return null;
  try {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  } catch (err: any) {
    logger.error(`[REDIS] Get error for ${key}: ${err.message}`);
    return null;
  }
};

/**
 * Invalidate cache by pattern
 */
export const invalidateCache = async (pattern: string): Promise<void> => {
  if (!redis) return;
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
      logger.info(`[REDIS] Invalidated ${keys.length} keys matching ${pattern}`);
    }
  } catch (err: any) {
    logger.error(`[REDIS] Invalidation error for ${pattern}: ${err.message}`);
  }
};

/**
 * Atomically set a key only if it does not exist (NX) with TTL in seconds (EX).
 * Returns true if the key was set (did not exist before), false if it already exists or on error.
 */
export const setIfNotExists = async (
  key: string,
  value: string | number | object,
  ttlSeconds: number = 300
): Promise<boolean> => {
  if (!redis) return false;
  try {
    const stringVal = typeof value === 'string' ? value : JSON.stringify(value);
    const result = await redis.set(key, stringVal, 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`[REDIS] setIfNotExists error for ${key}: ${msg}`);
    return false;
  }
};

export { redis };
