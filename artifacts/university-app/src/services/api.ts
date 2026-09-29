import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios';

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

// ── Response interceptor: global 401 / error normalisation ───────────────────
api.interceptors.response.use(
  (response: AxiosResponse): AxiosResponse => response,
  async (error: AxiosError<{ message?: string }>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Handle 401 Unauthorized (expired access token)
    if (error.response?.status === 401 && !originalRequest._retry) {
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

    return Promise.reject({
      message:
        error.response?.data?.message ||
        (error.code === 'ERR_NETWORK'
          ? 'Unable to connect to server. Please ensure the backend is running.'
          : 'Something went wrong'),
      status: error.response?.status,
      data: error.response?.data,
    });
  }
);

export default api;
