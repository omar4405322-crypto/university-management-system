import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import Button from './Button';

const ErrorState = ({
  title = 'Something went wrong',
  message = 'We encountered an error while loading this content.',
  onRetry,
  className = ''
}) => {
  return (
    <div className={`flex flex-col items-center justify-center p-12 text-center gap-6 rounded-3xl bg-error/5 border-2 border-dashed border-error/20 ${className}`}>
      <div className="p-4 bg-error/10 text-error rounded-full">
        <AlertCircle size={40} />
      </div>

      <div className="space-y-2 max-w-md">
        <h3 className="text-xl font-black text-brand-text-primary tracking-tight">{title}</h3>
        <p className="text-brand-text-secondary font-medium leading-relaxed">{message}</p>
      </div>

      {onRetry && (
        <Button
          onClick={onRetry}
          variant="outline"
          className="flex items-center gap-2"
        >
          <RefreshCw size={18} />
          Try Again
        </Button>
      )}
    </div>
  );
};

export default ErrorState;
