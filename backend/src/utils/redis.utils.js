const Redis = require('ioredis');
const logger = require('./logger');

let redis = null;

if (process.env.REDIS_URL) {
  redis = new Redis(process.env.REDIS_URL);
  
  redis.on('connect', () => logger.info('[REDIS] Connected to instance'));
  redis.on('error', (err) => logger.error(`[REDIS] Error: ${err.message}`));
}

/**
 * Cache data with a TTL
 */
const setCache = async (key, value, ttlSeconds = 300) => {
  if (!redis) return;
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch (err) {
    logger.error(`[REDIS] Set error for ${key}: ${err.message}`);
  }
};

/**
 * Get data from cache
 */
const getCache = async (key) => {
  if (!redis) return null;
  try {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    logger.error(`[REDIS] Get error for ${key}: ${err.message}`);
    return null;
  }
};

/**
 * Invalidate cache by pattern
 */
const invalidateCache = async (pattern) => {
  if (!redis) return;
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
      logger.info(`[REDIS] Invalidated ${keys.length} keys matching ${pattern}`);
    }
  } catch (err) {
    logger.error(`[REDIS] Invalidation error for ${pattern}: ${err.message}`);
  }
};

module.exports = {
  setCache,
  getCache,
  invalidateCache,
  redis
};
