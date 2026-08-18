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
 */
export const createRedisStore = (prefix: string) => {
  if (!redis) return undefined;
  return new RedisStore({
    sendCommand: (command: string, ...args: string[]) =>
      (redis as any).call(command, ...args) as Promise<RedisReply>,
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
  store: createRedisStore('pwd_reset'),
});
