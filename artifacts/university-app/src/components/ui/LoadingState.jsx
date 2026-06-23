import React from 'react';
import { Loader2 } from 'lucide-react';

const LoadingState = ({ message = 'Loading...', fullPage = false }) => {
  const content = (
    <div className="flex flex-col items-center justify-center p-8 gap-4 animate-in fade-in duration-500">
      <Loader2 className="animate-spin text-brand-primary-500" size={40} />
      <p className="text-brand-text-secondary font-black label-stat">{message}</p>
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
