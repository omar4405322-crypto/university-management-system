import rateLimit from 'express-rate-limit';
import { RedisStore, type RedisReply } from 'rate-limit-redis';
import { redis } from '../utils/redis.utils';
import logger from '../utils/logger';

// Emit explicit warning on boot when Redis is not available for rate limiting
if (!redis && process.env.NODE_ENV?.trim() !== 'test') {
  logger.warn(
    '[RATE-LIMITER] Redis is not configured or unavailable (REDIS_URL unset). Auth-critical rate limiters (auth, login, 2fa, pwd_reset) are falling back to in-memory store and will not share state across horizontal replicas.'
  );
} else if (redis) {
  logger.info(
    '[RATE-LIMITER] Redis-backed rate limiting enabled for auth, login, 2fa, and password reset endpoints.'
  );
}

/**
 * Helper to build a RedisStore connected to the existing shared ioredis client.
 * If Redis is not connected/configured, falls back cleanly to undefined (MemoryStore).
 * If Redis disconnects at runtime, sendCommand catches the failure and simulates
 * the hit increment/query in a local in-memory fallback map so requests continue
 * to be rate-limited and never throw an unhandled rejection / 500 error.
 */
export const createRedisStore = (prefix: string) => {
  if (!redis) return undefined;

  const fallbackStore = new Map<string, { hits: number; resetTime: number }>();

  const handleFallback = (command: string, ...args: string[]): RedisReply => {
    const now = Date.now();
    const upperCommand = command.toUpperCase();

    if (upperCommand === 'SCRIPT' && args[0]?.toUpperCase() === 'LOAD') {
      return 'fallback_sha';
    }

    if (upperCommand === 'EVALSHA' || upperCommand === 'EVAL') {
      // rate-limit-redis sends: EVALSHA sha 1 key [windowMs]
      const key = args[2] || 'unknown';
      const windowMs = parseInt(args[3], 10) || 15 * 60 * 1000;

      const record = fallbackStore.get(key);
      if (!record || record.resetTime <= now) {
        fallbackStore.set(key, { hits: 1, resetTime: now + windowMs });
        return [1, windowMs] as any;
      }

      record.hits += 1;
      const remainingMs = Math.max(0, record.resetTime - now);
      return [record.hits, remainingMs] as any;
    }

    if (upperCommand === 'DECR') {
      const key = args[0] || 'unknown';
      const record = fallbackStore.get(key);
      if (record) record.hits = Math.max(0, record.hits - 1);
      return 1 as any;
    }

    if (upperCommand === 'DEL') {
      const key = args[0] || 'unknown';
      fallbackStore.delete(key);
      return 1 as any;
    }

    return 1 as any;
  };

  return new RedisStore({
    sendCommand: async (command: string, ...args: string[]) => {
      if (!redis || (redis.status !== 'ready' && redis.status !== 'connect')) {
        return handleFallback(command, ...args);
      }
      try {
        return (await (redis as any).call(command, ...args)) as RedisReply;
      } catch (err: any) {
        logger.warn(
          `[RATE-LIMITER] Redis command failed on store '${prefix}', falling back to memory: ${err.message}`
        );
        return handleFallback(command, ...args);
      }
    },
    prefix: `rl:${prefix}:`,
  });
};

/**
 * 1. authLimiter: Used on /api/auth router mount (register, refresh, logout)
 * Window: 15 minutes, Max: 100 requests per IP
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: 'Too many auth attempts' },
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: true,
  store: createRedisStore('auth'),
});

/**
 * 2. loginLimiter: Dedicated strict limiter for POST /api/auth/login
 * Window: 15 minutes, Max: 5 attempts per IP
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'Too many login attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: true,
  store: createRedisStore('login'),
});

/**
 * 3. twoFactorLimiter: Dedicated strict limiter for 2FA verification endpoints (/2fa/enable, /2fa/disable)
 * Window: 15 minutes, Max: 5 attempts per IP
 */
export const twoFactorLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'Too many 2FA verification attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: true,
  store: createRedisStore('2fa'),
});

/**
 * 4. passwordResetLimiter: Used for student, doctor, TA, and user password resets
 * Window: 15 minutes, Max: 5 attempts per IP
 */
export const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'Too many password reset attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: true,
  store: createRedisStore('pwd_reset'),
});
