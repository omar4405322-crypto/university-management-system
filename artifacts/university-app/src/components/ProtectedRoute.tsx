// FIXED: Avoid indefinite blank spinner when session has token but no user - Phase 1
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import LoadingState from './ui/LoadingState';
import Button from './ui/Button';

const ProtectedRoute = ({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles?: string[];
}) => {
  const { user, token, loading } = useAuth();
  const location = useLocation();
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingState message={t('common.loading', 'Loading...')} fullPage />
      </div>
    );
  }

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-8 text-center">
        <p className="text-brand-text-sub font-bold">
          {t('common.sessionExpired', 'Your session could not be verified.')}
        </p>
        <Button
          onClick={() => {
            window.location.href = '/login';
          }}
        >
          {t('auth.login', 'Sign in')}
        </Button>
      </div>
    );
  }

  if (allowedRoles && !allowedRoles.includes(user.role) && user.role !== 'SUPER_ADMIN') {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
