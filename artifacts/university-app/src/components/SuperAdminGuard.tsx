// FIXED: No longer redirects — all routes accessible; use SuperAdminTwoFactorBanner for reminder
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const SuperAdminGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // NOTE: This guard currently allows all authenticated roles through.
  // Specific route protection is handled by individual ProtectedRoute components.
  return children;
};

export default SuperAdminGuard;
