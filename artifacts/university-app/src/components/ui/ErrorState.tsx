import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Button from './button';

const ErrorState = ({
  title,
  message,
  onRetry,
  className = '',
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}) => {
  const { t } = useTranslation();

  const displayTitle = title || t('errors.somethingWentWrong', t('common.somethingWentWrong', 'Something went wrong'));
  const displayMessage = message || t('errors.unexpectedErrorDesc', t('common.errorOccurred', 'We encountered an error while loading this content.'));

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`flex flex-col items-center justify-center p-12 text-center gap-6 rounded-3xl bg-error/5 border-2 border-dashed border-error/20 ${className}`}
    >
      <div className="p-4 bg-error/10 text-error rounded-full">
        <AlertCircle size={40} />
      </div>

      <div className="space-y-2 max-w-md">
        <h3 className="text-xl font-black text-brand-text-primary tracking-tight">{displayTitle}</h3>
        <p className="text-brand-text-secondary font-medium leading-relaxed">{displayMessage}</p>
      </div>

      {onRetry && (
        <Button onClick={onRetry} variant="outline" className="flex items-center gap-2">
          <RefreshCw size={18} />
          {t('common.tryAgain', 'Try Again')}
        </Button>
      )}
    </div>
  );
};

export default ErrorState;
