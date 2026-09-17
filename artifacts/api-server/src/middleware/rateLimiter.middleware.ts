import "../config/loadEnvironment";
import type { RequestHandler } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { RedisStore, type RedisReply } from "rate-limit-redis";
import { redis } from "../utils/redis.utils";
import logger from "../utils/logger";

export const shouldFailClosedRateLimiter = (
  env: { NODE_ENV?: string } = process.env,
): boolean => env.NODE_ENV?.trim().toLowerCase() === "production";

export const rateLimiterPassOnStoreError = !shouldFailClosedRateLimiter();

// Emit explicit warning on boot when Redis is not available for rate limiting
if (!redis && process.env.NODE_ENV?.trim() !== "test") {
  logger.warn(
    "[RATE-LIMITER] Redis is not configured or unavailable (REDIS_URL unset). Auth-critical rate limiters (auth, login, 2fa, pwd_reset) are falling back to in-memory store and will not share state across horizontal replicas.",
  );
} else if (redis) {
  logger.info(
    "[RATE-LIMITER] Redis-backed rate limiting enabled for auth, login, 2fa, and password reset endpoints.",
  );
}

/**
 * Helper to build a RedisStore connected to the existing shared ioredis client.
 * If Redis is not connected/configured, falls back cleanly to undefined (MemoryStore).
 * Development and tests fall back to a local in-memory map. Production throws
 * on shared-store failure so rate limits cannot be bypassed across replicas.
 */
export const createRedisStore = (prefix: string) => {
  if (!redis) return undefined;

  const fallbackStore = new Map<string, { hits: number; resetTime: number }>();

  const handleFallback = (command: string, ...args: string[]): RedisReply => {
    const now = Date.now();
    const upperCommand = command.toUpperCase();

    if (upperCommand === "SCRIPT" && args[0]?.toUpperCase() === "LOAD") {
      return "fallback_sha";
    }

    if (upperCommand === "EVALSHA" || upperCommand === "EVAL") {
      // rate-limit-redis sends: EVALSHA sha 1 key [windowMs]
      const key = args[2] || "unknown";
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

    if (upperCommand === "DECR") {
      const key = args[0] || "unknown";
      const record = fallbackStore.get(key);
      if (record) record.hits = Math.max(0, record.hits - 1);
      return 1 as any;
    }

    if (upperCommand === "DEL") {
      const key = args[0] || "unknown";
      fallbackStore.delete(key);
      return 1 as any;
    }

    return 1 as any;
  };

  return new RedisStore({
    sendCommand: async (command: string, ...args: string[]) => {
      if (!redis) {
        if (shouldFailClosedRateLimiter()) {
          throw new Error("Shared rate-limit store is unavailable");
        }
        return handleFallback(command, ...args);
      }
      try {
        return (await (redis as any).call(command, ...args)) as RedisReply;
      } catch (err: any) {
        if (shouldFailClosedRateLimiter()) {
          throw err;
        }
        logger.warn(
          `[RATE-LIMITER] Redis command failed on store '${prefix}', falling back to memory: ${err.message}`,
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
  message: { success: false, message: "Too many auth attempts" },
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: rateLimiterPassOnStoreError,
  store: createRedisStore("auth"),
});

/**
 * 2a. loginIpLimiter: First layer of defense for POST /api/auth/login.
 * Window: 15 minutes, Max: 20 attempts per client IP across all accounts.
 * Throttles single-source credential spraying across multiple accounts.
 */
export const loginIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: {
    success: false,
    message: "Too many login attempts, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: rateLimiterPassOnStoreError,
  store: createRedisStore("login_ip"),
  validate: { keyGeneratorIpFallback: false },
  keyGenerator: (req) => {
    return ipKeyGenerator(
      (req.ip || req.socket?.remoteAddress || "unknown").trim(),
    );
  },
});

/**
 * 2b. loginAccountLimiter: Second layer of defense for POST /api/auth/login.
 * Window: 15 minutes, Max: 5 attempts per (client IP + normalized email).
 * Throttles single-source password guessing against a single account without
 * creating a global account-wide denial of service for other client IPs.
 */
export const loginAccountLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    message: "Too many login attempts, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: rateLimiterPassOnStoreError,
  store: createRedisStore("login_account"),
  validate: { keyGeneratorIpFallback: false },
  keyGenerator: (req) => {
    const email =
      typeof req.body?.email === "string"
        ? req.body.email.toLowerCase().trim()
        : "";
    const clientIp = ipKeyGenerator(
      (req.ip || req.socket?.remoteAddress || "unknown").trim(),
    );
    return email ? `${clientIp}:${email}` : clientIp;
  },
});

/**
 * 2. loginLimiter: Layered composite limiter for POST /api/auth/login.
 * Combines IP-level spraying protection (20 attempts / 15m) and (IP + account)
 * brute-force protection (5 attempts / 15m).
 * Eliminates the global email-only account lockout vulnerability (SEC-04).
 */
export const loginLimiter: RequestHandler = (req, res, next) => {
  loginIpLimiter(req, res, (err) => {
    if (err) return next(err);
    loginAccountLimiter(req, res, next);
  });
};

// Introspection and compatibility properties
(loginLimiter as any).passOnStoreError = rateLimiterPassOnStoreError;
(loginLimiter as any).ipLimiter = loginIpLimiter;
(loginLimiter as any).accountLimiter = loginAccountLimiter;
(loginLimiter as any).keyGenerator = (req: any) => {
  const email =
    typeof req.body?.email === "string"
      ? req.body.email.toLowerCase().trim()
      : "";
  const clientIp = ipKeyGenerator(
    (req.ip || req.socket?.remoteAddress || "unknown").trim(),
  );
  return email ? `${clientIp}:${email}` : clientIp;
};

/**
 * 3. twoFactorLimiter: Dedicated strict limiter for 2FA verification endpoints (/2fa/enable, /2fa/disable)
 * Window: 15 minutes, Max: 5 attempts per IP
 */
export const twoFactorLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    message: "Too many 2FA verification attempts, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: rateLimiterPassOnStoreError,
  store: createRedisStore("2fa"),
});

/**
 * 4. passwordResetLimiter: Used for student, doctor, TA, and user password resets
 * Window: 15 minutes, Max: 5 attempts per IP
 */
export const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    message: "Too many password reset attempts, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: rateLimiterPassOnStoreError,
  store: createRedisStore("pwd_reset"),
});
