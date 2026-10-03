import React, { createContext, useState, useEffect, useContext, useCallback, useRef } from 'react';
import api, { setAccessToken } from '../services/api';

// ── Domain types ──────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  role: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  twoFactorEnabled?: boolean;
  // Profile fields returned by /auth/me or /auth/refresh
  avatar?: string;
  profilePicture?: string;
  phone?: string;
  address?: string;
  bio?: string;
  gender?: string;
  birthDate?: string;
  createdAt?: string;
  // College/department IDs (from session)
  collegeId?: string | number;
  departmentId?: string | number;
  managedCollegeId?: string | number;
  managedDepartmentId?: string | number;
  studentId?: string;
  year?: number;
  // Nested objects returned by /auth/me on some server versions
  college?: { id: number; name: string; nameAr?: string } | null;
  department?: { id: number; name: string; nameAr?: string } | null;
  managedCollege?: { id: number; name: string; nameAr?: string } | null;
  // Doctor profile (present when role === 'DOCTOR')
  doctor?: { id: number; firstName?: string; lastName?: string; departmentId?: number } | null;
  // Teaching assistant profile (present when role === 'TEACHING_ASSISTANT')
  teachingAssistant?: { id: number; firstName?: string; lastName?: string; departmentId?: number } | null;
  // Student profile (present when role === 'STUDENT')
  student?: { id?: number; firstName?: string; lastName?: string; year?: number; [key: string]: unknown } | null;
  // Nested profile sub-object used by some endpoints
  profile?: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    avatar?: string;
    address?: string;
    bio?: string;
    gender?: string;
    birthDate?: string;
  } | null;
  [key: string]: unknown; // allow additional server fields without losing assignability
}

/** Payload accepted by the registration endpoint. */
export interface RegisterPayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: string;
  departmentId?: string | number;
  studentId?: string;
  year?: number;
  phone?: string;
  [key: string]: unknown; // allow additional fields the backend may accept
}

export interface AuthContextType {
  user: User | null;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  token: string | null;
  loading: boolean;
  error: string | null;
  login: (
    email: string,
    password: string,
    totpToken?: string | null
  ) => Promise<{
    success: boolean;
    user?: User;
    requires2FA?: boolean;
    message?: string;
    status?: number;
  }>;
  register: (data: RegisterPayload) => Promise<{ success: boolean; message: string }>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      console.error('Logout API call failed:', err);
    } finally {
      localStorage.removeItem('user');
      setToken(null);
      setUser(null);
      setError(null);
    }
  }, []);

  const initPromiseRef = useRef<Promise<void> | null>(null);

  const initAuth = useCallback(async () => {
    if (initPromiseRef.current) {
      return initPromiseRef.current;
    }

    const promise = (async () => {
      setLoading(true);
      try {
        // Try to get a new access token via the httpOnly refresh cookie
        const refreshResponse = await api.post('/auth/refresh');
        const { accessToken, user: userData } = refreshResponse.data.data as {
          accessToken: string;
          user?: User;
        };
        setToken(accessToken);

        if (userData) {
          // User profile returned directly from /auth/refresh — skip /auth/me
          setUser({ ...userData, twoFactorEnabled: Boolean(userData.twoFactorEnabled) });
        } else {
          // Fallback: concurrent-rotation edge case may not include user data
          const meResponse = await api.get('/auth/me');
          const me = meResponse.data.data as User;
          setUser({ ...me, twoFactorEnabled: Boolean(me.twoFactorEnabled) });
        }
      } catch (err) {
        // No valid refresh cookie — user must log in
        setToken(null);
        setUser(null);
        localStorage.removeItem('user');
      } finally {
        setLoading(false);
        initPromiseRef.current = null;
      }
    })();

    initPromiseRef.current = promise;
    return promise;
  }, []);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  useEffect(() => {
    setAccessToken(token);
  }, [token]);

  const login = useCallback(async (email: string, password: string, totpToken: string | null = null) => {
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

      const { accessToken, user: userData } = response.data.data as {
        accessToken: string;
        user: User;
      };

      const normalizedUser: User = {
        ...userData,
        twoFactorEnabled: Boolean(userData.twoFactorEnabled),
      };
      setToken(accessToken);
      setUser(normalizedUser);
      setLoading(false);

      return { success: true, user: normalizedUser };
    } catch (err: unknown) {
      const normalized = err as { message?: string; status?: number };
      const message = normalized.message || 'Login failed';
      const status = normalized.status;
      setError(message);
      return { success: false, message, status };
    }
  }, []);

  const register = useCallback(async (data: RegisterPayload) => {
    try {
      // NOTE: Do NOT touch `loading` here — it's reserved for session hydration (initAuth).
      // Toggling it during registration causes re-renders that unmount the Register page prematurely.
      setError(null);
      const response = await api.post('/auth/register', data);
      return { success: true, message: response.data.message as string };
    } catch (err: unknown) {
      const normalized = err as { message?: string };
      const message = normalized.message || 'Registration failed';
      setError(message);
      return { success: false, message };
    }
  }, []);

  const value = React.useMemo<AuthContextType>(() => ({
    user,
    setUser,
    token,
    loading,
    error,
    login,
    register,
    logout,
    isAuthenticated: !!token && !!user,
  }), [user, token, loading, error, login, register, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
