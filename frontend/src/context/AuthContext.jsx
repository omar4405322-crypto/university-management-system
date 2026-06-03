// FIXED: Session init vs login loading; parse standardized API errors - login fix
import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import api from '../services/api';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(!!localStorage.getItem('token'));
  const [error, setError] = useState(null);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    setError(null);
  }, []);

  const initAuth = useCallback(async () => {
    if (token) {
      setLoading(true);
      setError(null);
      try {
        const response = await api.get('/auth/me');
        const me = response.data.data;
        setUser({
          ...me,
          twoFactorEnabled: Boolean(me.twoFactorEnabled),
        });
      } catch (err) {
        console.error('Session verification failed:', err.message);
        logout();
      } finally {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, [token, logout]);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  const login = async (email, password) => {
    try {
      setError(null);
      const normalizedEmail = email.trim().toLowerCase();
      const response = await api.post('/auth/login', {
        email: normalizedEmail,
        password,
      });
      const { token: newToken, user: userData } = response.data.data;

      localStorage.setItem('token', newToken);

      const normalizedUser = {
        ...userData,
        twoFactorEnabled: Boolean(userData.twoFactorEnabled),
      };
      setToken(newToken);
      setUser(normalizedUser);
      localStorage.setItem('user', JSON.stringify(normalizedUser));
      setLoading(false);

      return { success: true, user: normalizedUser };
    } catch (err) {
      const message = err.message || 'Login failed';
      const status = err.status;
      setError(message);
      return { success: false, message, status };
    }
  };

  const register = async (data) => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.post('/auth/register', data);
      return { success: true, message: response.data.message };
    } catch (err) {
      const message = err.message || 'Registration failed';
      setError(message);
      return { success: false, message };
    } finally {
      setLoading(false);
    }
  };

  const value = {
    user,
    setUser,
    token,
    loading,
    error,
    login,
    register,
    logout,
    isAuthenticated: !!token && !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
