/**
 * Utility functions for parsing and validating allowed origins for CORS
 * and sensitive auth endpoints (e.g. POST /api/auth/refresh).
 */

/**
 * Returns the exact list of configured allowed origins.
 */
export const getAllowedOrigins = (): string[] => {
  const envOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
    : [];

  const isProd = process.env.NODE_ENV === 'production';

  const origins = [
    ...envOrigins,
    process.env.FRONTEND_URL?.trim(),
    ...(isProd
      ? []
      : [
          process.env.FRONTEND_NETWORK_URL?.trim(),
          'http://localhost:5173',
          'http://localhost:3000',
          'http://localhost:3001',
        ]),
  ].filter((v, i, arr): v is string => Boolean(v) && arr.indexOf(v) === i);

  return origins;
};

/**
 * Validates whether an incoming origin header is allowed.
 * - In production: strictly matches against the explicit allowlist with strict string equality.
 *   No wildcard subdomains and no LAN exceptions.
 * - In development: permits configured origins, localhost on any port, and local network IPs.
 */
export const isOriginAllowed = (origin: string | undefined): boolean => {
  if (!origin) {
    return false;
  }

  const allowedOrigins = getAllowedOrigins();

  // Strict equality check against configured allowed origins
  if (allowedOrigins.includes(origin)) {
    return true;
  }

  // Development-only exceptions: localhost ports and local LAN IPs
  if (process.env.NODE_ENV !== 'production') {
    const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    const isLocalNetwork = /^https?:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+)(:\d+)?$/.test(origin);
    if (isLocalhost || isLocalNetwork) {
      return true;
    }
  }

  return false;
};
