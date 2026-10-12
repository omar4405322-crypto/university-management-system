import winston from 'winston';

const SENSITIVE_KEYS = new Set([
  'password',
  'newpassword',
  'currentpassword',
  'token',
  'accesstoken',
  'refreshtoken',
  'twofactorsecret',
  'secret',
  'secretkey',
  'authorization',
  'cookie',
  'cookies',
  'setcookie',
  'setcookies',
  'nationalid',
  'creditcard',
  'cvv',
]);

function normalizeKey(key: string): string {
  return key.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function redactObject(obj: unknown, depth = 0): unknown {
  if (depth > 6 || !obj) return obj;
  if (Array.isArray(obj)) {
    return obj.map((item) => redactObject(item, depth + 1));
  }
  if (typeof obj !== 'object') return obj;

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(normalizeKey(key))) {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      result[key] = redactObject(value, depth + 1);
    } else if (typeof value === 'string' && /^bearer\s+[a-z0-9._-]+$/i.test(value.trim())) {
      result[key] = '[REDACTED]';
    } else {
      result[key] = value;
    }
  }
  return result;
}

export const redactSensitiveFormat = winston.format((info) => {
  const redacted = redactObject(info) as Record<string, unknown>;
  for (const key of Object.keys(info)) {
    if (key in redacted) {
      info[key] = redacted[key];
    }
  }
  return info;
});

const defaultLogLevel =
  process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

const logger: winston.Logger = winston.createLogger({
  level: defaultLogLevel,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    redactSensitiveFormat(),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'university-management-system' },
  transports: [
    new winston.transports.Console({
      format:
        process.env.NODE_ENV === 'production'
          ? winston.format.combine(redactSensitiveFormat(), winston.format.json())
          : winston.format.combine(
              redactSensitiveFormat(),
              winston.format.colorize(),
              winston.format.simple(),
              winston.format.printf((info) => {
                const { level, message, timestamp, stack } = info as {
                  level: string;
                  message: string;
                  timestamp?: string;
                  stack?: string;
                };
                if (stack) return `${timestamp} ${level}: ${message} - ${stack}`;
                return `${timestamp} ${level}: ${message}`;
              })
            ),
    }),
  ],
});

export default logger;
