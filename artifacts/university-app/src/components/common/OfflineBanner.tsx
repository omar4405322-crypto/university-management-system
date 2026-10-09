import React, { useState, useEffect } from 'react';
import { WifiOff, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const OfflineBanner: React.FC = () => {
  const { t } = useTranslation();
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showRestored, setShowRestored] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      setShowRestored(true);
      const timer = setTimeout(() => {
        setShowRestored(false);
      }, 4000);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOffline(true);
      setShowRestored(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline && !showRestored) {
    return null;
  }

  if (showRestored) {
    return (
      <aside
        role="status"
        aria-live="polite"
        className="w-full bg-emerald-600 text-white px-4 py-2 text-sm font-medium flex items-center justify-center gap-2 shadow-md transition-all duration-300 z-50 sticky top-0"
      >
        <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span>
          <strong>{t('errors.onlineTitle')}:</strong> {t('errors.onlineMessage')}
        </span>
      </aside>
    );
  }

  return (
    <aside
      role="alert"
      aria-live="assertive"
      className="w-full bg-amber-600 text-white px-4 py-2.5 text-sm font-medium flex items-center justify-between gap-3 shadow-md transition-all duration-300 z-50 sticky top-0"
    >
      <div className="flex items-center gap-2 max-w-4xl mx-auto flex-1 justify-center text-center">
        <WifiOff className="w-4 h-4 shrink-0 animate-pulse" aria-hidden="true" />
        <span>
          <strong>{t('errors.offlineTitle')}:</strong> {t('errors.offlineMessage')}
        </span>
      </div>
    </aside>
  );
};

export default OfflineBanner;
