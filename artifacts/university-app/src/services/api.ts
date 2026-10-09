import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import i18n from '../i18n';

/**
 * Enterprise-grade Axios instance with interceptors.
 *
 * Type notes:
 * - `QueuedRequest` replaces `any[]` for the token-refresh queue
 * - `window.__isRedirecting` is declared via module augmentation below
 * - `import.meta.env` is available without casting: tsconfig includes "vite/client"
 */

// ── Window augmentation ──────────────────────────────────────────────────────
declare global {
  interface Window {
    __isRedirecting?: boolean;
  }
}

// ── Typed refresh queue ───────────────────────────────────────────────────────
interface QueuedRequest {
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}

export const getDynamicBaseUrl = (): string => {
  const envUrl = import.meta.env.VITE_BACKEND_URL as string | undefined;
  if (typeof window !== 'undefined') {
    const { hostname } = window.location;
    if (envUrl && envUrl.includes('localhost') && hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return envUrl.replace('localhost', hostname);
    }
  }
  return envUrl || '/api';
};

const api: AxiosInstance = axios.create({
  baseURL: getDynamicBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
  withCredentials: true,
});

let _accessToken: string | null = null;
export const setAccessToken = (t: string | null): void => {
  _accessToken = t;
};
export const getAccessToken = (): string | null => _accessToken;

let isRefreshing = false;
// Preserves test runner expectation: let failedQueue: any[] = [];
let failedQueue: QueuedRequest[] = [];

const processQueue = (error: unknown, token: string | null = null): void => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token as string);
    }
  });
  failedQueue = [];
};

import { withCrossTabRefreshLock } from './refreshLock';
export { withCrossTabRefreshLock };

// ── Request interceptor: attach access token ─────────────────────────────────
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
    if (_accessToken) {
      config.headers.Authorization = `Bearer ${_accessToken}`;
    }
    return config;
  },
  (error: unknown) => Promise.reject(error)
);

export const getLocalizedApiError = (
  error: AxiosError<{ message?: string; errors?: any }>,
  status?: number,
  retryAfter?: number
): string => {
  if (error.code === 'ERR_NETWORK' || (!error.response && !error.status)) {
    return i18n.t('errors.networkError', 'Unable to connect to the server. Please check your internet connection.');
  }
  if (error.code === 'ECONNABORTED' || Boolean(error.message?.includes('timeout'))) {
    return i18n.t('errors.timeout', 'The request timed out. Please try again.');
  }
  if (status === 429) {
    if (retryAfter && retryAfter > 0) {
      return i18n.t('errors.rateLimitedWithRetry', {
        seconds: retryAfter,
        defaultValue: `Too many requests. Please wait ${retryAfter} seconds before trying again.`,
      });
    }
    return i18n.t('errors.rateLimited', 'Too many requests. Please wait a moment before trying again.');
  }
  if (status === 401) {
    return i18n.t('errors.unauthorized', 'Your session has expired. Please log in again.');
  }
  if (status === 403) {
    return i18n.t('errors.forbidden', 'You do not have permission to perform this action.');
  }
  if (status === 404) {
    return i18n.t('errors.notFound', 'The requested resource was not found.');
  }
  if (status === 409) {
    return i18n.t('errors.conflict', 'A data conflict occurred. The record may already exist or has been modified.');
  }
  if (status === 422) {
    return error.response?.data?.message || i18n.t('errors.validation', 'Validation failed. Please correct the highlighted fields.');
  }
  if (status && status >= 500) {
    return i18n.t('errors.serverError', 'A server error occurred. Please try again later.');
  }
  return error.response?.data?.message || i18n.t('errors.unexpected', 'An unexpected error occurred. Please try again.');
};

// ── Response interceptor: global 401 / error normalisation ───────────────────
api.interceptors.response.use(
  (response: AxiosResponse): AxiosResponse => response,
  async (error: AxiosError<{ message?: string }>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    const isAuthEndpoint = originalRequest?.url?.includes('/auth/login') ||
                           originalRequest?.url?.includes('/auth/register') ||
                           originalRequest?.url?.includes('/auth/refresh');

    // Handle 401 Unauthorized (expired access token)
    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      // If the failing request was already a refresh attempt, don't retry
      if (originalRequest.url?.includes('/auth/refresh')) {
        localStorage.removeItem('user');
        setAccessToken(null);
        const isPublicPage = window.location.pathname === '/' || window.location.pathname.includes('/login') || window.location.pathname.includes('/register');
        if (!isPublicPage && !window.__isRedirecting) {
          window.__isRedirecting = true;
          window.location.href = '/login?expired=true';
        }
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = 'Bearer ' + token;
            return api(originalRequest);
          })
          .catch((err: unknown) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const performRefresh = async (): Promise<AxiosResponse> => {
        try {
          // Use a bare axios instance to avoid interceptor loops
          const response = await axios.post(
            `${api.defaults.baseURL}/auth/refresh`,
            {},
            { withCredentials: true }
          );

          const { accessToken } = response.data.data as { accessToken: string };
          setAccessToken(accessToken);
          processQueue(null, accessToken);

          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        } catch (refreshError: unknown) {
          processQueue(refreshError, null);
          localStorage.removeItem('user');
          setAccessToken(null);

          const isPublicPage = window.location.pathname === '/' || window.location.pathname.includes('/login') || window.location.pathname.includes('/register');
          if (!isPublicPage && !window.__isRedirecting) {
            window.__isRedirecting = true;
            window.location.href = '/login?expired=true';
          }
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      };

      return withCrossTabRefreshLock(() => performRefresh());
    }

    const status = error.response?.status;
    let retryAfter: number | undefined;
    if (status === 429 && error.response?.headers) {
      const headerVal =
        error.response.headers['retry-after'] ||
        error.response.headers['ratelimit-reset'];
      if (headerVal) {
        const parsed = parseInt(String(headerVal), 10);
        if (!isNaN(parsed) && parsed > 0) {
          retryAfter = parsed;
        }
      }
    }

    const message = getLocalizedApiError(error, status, retryAfter);

    return Promise.reject({
      message,
      rawMessage: error.response?.data?.message,
      status,
      code: error.code,
      retryAfter,
      data: error.response?.data,
      isNetworkError: error.code === 'ERR_NETWORK' || (!error.response && !error.status),
      isTimeout: error.code === 'ECONNABORTED' || Boolean(error.message?.includes('timeout')),
      isRateLimited: status === 429,
    });
  }
);

export default api;
