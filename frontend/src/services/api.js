import axios from 'axios';

/**
 * Enterprise-grade Axios instance with interceptors
 */
const api = axios.create({ 
  baseURL: import.meta.env.VITE_API_URL || '/api', 
  headers: { 
    'Content-Type': 'application/json' 
  },
  timeout: 15000, // 15 seconds timeout
});

// Interceptor to add token to headers
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for global error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const { response, config } = error;
    const requestUrl = config?.url || '';
    const isAuthAttempt =
      requestUrl.includes('/auth/login') || requestUrl.includes('/auth/register');

    // Do not clear session on failed login/register (401 is expected for bad credentials)
    if (response?.status === 401 && !isAuthAttempt) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');

      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login?expired=true';
      }
    }

    const message =
      response?.data?.message ||
      (error.code === 'ECONNABORTED'
        ? 'Request timed out. Please try again.'
        : error.message === 'Network Error'
          ? 'Cannot reach the server. Ensure the backend is running.'
          : 'A network error occurred. Please try again.');

    return Promise.reject({
      message,
      status: response?.status,
      success: false,
      errors: response?.data?.errors || [],
    });
  }
);

export default api;
