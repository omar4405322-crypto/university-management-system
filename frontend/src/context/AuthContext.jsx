// FIXED: Session init vs login loading; parse standardized API errors - login fix
import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import api, { setAccessToken } from '../services/api';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const logout = useCallback(() => {
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    setError(null);
  }, []);

  const initAuth = useCallback(async () => {
    setLoading(true);
    try {
      // Try to get a new access token via the httpOnly refresh cookie
      const refreshResponse = await api.post('/auth/refresh');
      const { accessToken } = refreshResponse.data.data;
      setToken(accessToken);
      
      // Now fetch the user profile
      const meResponse = await api.get('/auth/me');
      const me = meResponse.data.data;
      setUser({ ...me, twoFactorEnabled: Boolean(me.twoFactorEnabled) });
    } catch (err) {
      // No valid refresh cookie — user must log in
      setToken(null);
      setUser(null);
      localStorage.removeItem('user');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  useEffect(() => {
    setAccessToken(token);
  }, [token]);

  const login = async (email, password, totpToken = null) => {
    try {
      setError(null);
      const normalizedEmail = email.trim().toLowerCase();
      const response = await api.post('/auth/login', {
        email: normalizedEmail,
        password,
        totpToken,
      });

      if (response.data.requires2FA) {
        return { success: false, requires2FA: true };
      }

      const { accessToken, user: userData } = response.data.data;

      const normalizedUser = {
        ...userData,
        twoFactorEnabled: Boolean(userData.twoFactorEnabled),
      };
      setToken(accessToken);
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
