// FIXED: Fallback for unmatched nested routes (prevents blank AppShell content) - Phase 1
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FileQuestion } from 'lucide-react';
import Button from './ui/button';

const NotFoundPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-8 animate-page">
      <div className="w-24 h-24 rounded-[2.5rem] bg-surface-subtle flex items-center justify-center mb-6 border-2 border-dashed border-brand-border">
        <FileQuestion size={48} className="text-brand-text-muted opacity-60" />
      </div>
      <h2 className="text-2xl font-black text-brand-text-main tracking-tight uppercase mb-2">
        {t('common.pageNotFound', 'Page not found')}
      </h2>
      <p className="text-brand-text-sub font-bold max-w-sm mb-6">
        {t('common.pageNotFoundDesc', 'The page you requested does not exist or was moved.')}
      </p>
      <Button onClick={() => navigate('/dashboard')}>
        {t('common.backToDashboard', 'Back to dashboard')}
      </Button>
    </div>
  );
};

export default NotFoundPage;
