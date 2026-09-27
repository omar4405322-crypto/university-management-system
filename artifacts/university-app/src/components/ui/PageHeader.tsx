import React from 'react';
import Button from './button';
import { Plus, Loader2 } from 'lucide-react';

export interface PageHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: {
    icon?: React.ElementType | null;
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
    label?: string;
  };
  extraActions?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, action, extraActions }) => {
  const Icon = action?.icon || Plus;

  return (
    <div className="page-header-row mb-6 animate-page w-full min-w-0">
      <div className="flex flex-col text-start max-w-full md:max-w-2xl min-w-0">
        <h1 className="page-title break-words">{title}</h1>
        {subtitle && (
          <p className="page-subtitle break-words">{subtitle}</p>
        )}
      </div>

      {(action || extraActions) && (
        <div className="flex items-center gap-3 shrink-0">
          {extraActions}
          {action && (
            <Button
              onClick={action.onClick}
              variant="default"
              size="lg"
              disabled={action.disabled}
              className={`shadow-md shadow-brand-primary-600/20 hover:shadow-brand-primary-600/30 ${action.className || ''}`}
            >
              {action.icon !== null && (
                <Icon
                  size={20}
                  className={`mr-2 rtl:ml-2 rtl:mr-0 ${action.icon === Loader2 ? 'animate-spin' : ''}`}
                />
              )}
              <span className="text-xs font-black uppercase tracking-widest">{action.label}</span>
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default PageHeader;
