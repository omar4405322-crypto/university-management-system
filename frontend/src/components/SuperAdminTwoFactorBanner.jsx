// FIXED: Non-blocking 2FA reminder for super admins (no route redirect)
import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Shield } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';

const SuperAdminTwoFactorBanner = () => {
  const { user } = useAuth();
  const { t } = useTranslation();

  if (user?.role !== 'SUPER_ADMIN' || user?.twoFactorEnabled) {
    return null;
  }

  return (
    <div
      className="mb-6 flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-amber-900"
      role="status"
    >
      <div className="flex items-start gap-3 flex-1">
        <AlertTriangle size={20} className="shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-black">{t('profile.twoFactorRequired')}</p>
          <p className="text-xs font-semibold mt-0.5 opacity-90">
            {t('profile.twoFactorRequiredDesc')}
          </p>
        </div>
      </div>
      <Link
        to="/profile?prompt=enable-2fa"
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-green px-4 py-2 text-xs font-black text-white hover:opacity-90 transition-opacity shrink-0"
      >
        <Shield size={16} />
        {t('profile.enable2fa')}
      </Link>
    </div>
  );
};

export default SuperAdminTwoFactorBanner;
