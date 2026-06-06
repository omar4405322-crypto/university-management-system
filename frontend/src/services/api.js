import axios from 'axios';

/**
 * Enterprise-grade Axios instance with interceptors
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api', 
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 15000,
  withCredentials: true,
});

// Response interceptor for global error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle 401 Unauthorized globally (session expired)
    if (error.response?.status === 401) {
      // Clear local auth state if any
      localStorage.removeItem('user');
      
      // We can't use useNavigate here since it's not a component
      // but we can redirect to login with a query param
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login?expired=true';
      }
    }
    
    return Promise.reject({
      message: error.response?.data?.message || 'Something went wrong',
      status: error.response?.status,
      data: error.response?.data
    });
  }
);

export default api;
