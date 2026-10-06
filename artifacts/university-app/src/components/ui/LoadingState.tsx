import React from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const LoadingState = ({ message, fullPage = false }: { message?: string; fullPage?: boolean }) => {
  const { t } = useTranslation();
  const displayMessage = message || t('common.loading', 'Loading...');

  const content = (
    <div className="flex flex-col items-center justify-center p-8 gap-4 animate-in fade-in duration-500">
      <Loader2 className="animate-spin text-brand-primary-600" size={40} />
      <p className="text-brand-text-secondary font-black label-stat">{displayMessage}</p>
    </div>
  );

  if (fullPage) {
    return (
      <div className="fixed inset-0 bg-brand-bg-card/80 dark:bg-brand-bg-page/80 backdrop-blur-sm z-50 flex items-center justify-center">
        {content}
      </div>
    );
  }

  return content;
};

export default LoadingState;
