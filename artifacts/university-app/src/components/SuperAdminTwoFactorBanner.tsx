// FIXED: Non-blocking 2FA reminder for super admins (no route redirect)
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Shield, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { FEATURE_FLAGS } from '../constants/featureFlags';

const SuperAdminTwoFactorBanner = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [isDismissed, setIsDismissed] = useState(false);

  // TEMP-DISABLED-2FA: Check REQUIRE_2FA feature flag to temporarily disable warnings.
  // Re-enable this before production launch — see Task 53 in UI-UX-IMPROVEMENT-LOG.md
  if (!FEATURE_FLAGS.REQUIRE_2FA || user?.role !== 'SUPER_ADMIN' || user?.twoFactorEnabled || isDismissed) {
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
      <button 
        onClick={() => setIsDismissed(true)} 
        className="p-1 hover:bg-amber-100 dark:hover:bg-amber-800/50 rounded-lg text-amber-700/60 hover:text-amber-700 transition-colors shrink-0"
        aria-label="Dismiss"
      >
        <X size={18} />
      </button>
    </div>
  );
};

export default SuperAdminTwoFactorBanner;
