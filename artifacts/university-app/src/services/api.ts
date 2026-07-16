import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios';

/**
 * Enterprise-grade Axios instance with interceptors
 */
const api: AxiosInstance = axios.create({
  baseURL: (import.meta as any).env.VITE_BACKEND_URL || '/api',
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
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null): void => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });

  failedQueue = [];
};

// Request interceptor to add auth token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
    if (_accessToken) {
      config.headers.Authorization = `Bearer ${_accessToken}`;
    }
    return config;
  },
  (error: any) => Promise.reject(error)
);

// Response interceptor for global error handling
api.interceptors.response.use(
  (response: AxiosResponse): AxiosResponse => response,
  async (error: any) => {
    const originalRequest = error.config;

    // Handle 401 Unauthorized (expired access token)
    if (error.response?.status === 401 && !originalRequest._retry) {
      // If the failing request was already a refresh attempt, don't retry
      if (originalRequest.url?.includes('/auth/refresh')) {
        localStorage.removeItem('user');
        setAccessToken(null);
        const isPublicPage = window.location.pathname.includes('/login') || window.location.pathname.includes('/register');
        if (!isPublicPage && !(window as any).__isRedirecting) {
          (window as any).__isRedirecting = true;
          window.location.href = '/login?expired=true';
        }
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise(function (resolve, reject) {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = 'Bearer ' + token;
            return api(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Try to refresh the token using a separate axios instance to avoid interceptor loops
        const response = await axios.post(
          `${api.defaults.baseURL}/auth/refresh`,
          {},
          {
            withCredentials: true,
            // Prevent this request from being intercepted by the global instance if somehow it would be
          }
        );

        const { accessToken } = response.data.data;

        // Save new token in memory
        setAccessToken(accessToken);
        processQueue(null, accessToken);

        // Update header and retry
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);

        // Refresh failed - logout
        localStorage.removeItem('user');
        setAccessToken(null);

        // Only redirect if we are not already on a public page
        // and only do it once to avoid ERR_ABORTED in console
        const isPublicPage = window.location.pathname.includes('/login') || window.location.pathname.includes('/register');
        if (!isPublicPage && !(window as any).__isRedirecting) {
          (window as any).__isRedirecting = true;
          window.location.href = '/login?expired=true';
        }
      } finally {
        isRefreshing = false;
      }
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
