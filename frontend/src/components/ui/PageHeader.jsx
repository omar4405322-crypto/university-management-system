import React from 'react';
import Button from './Button';
import { Plus } from 'lucide-react';

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 animate-page">
      <div className="flex flex-col text-start max-w-2xl">
        <h1 className="heading-display mb-2">
          {title}
        </h1>
        {subtitle && (
          <p className="text-brand-text-sub font-medium text-sm leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>

      {action && (
        <div className="flex items-center gap-3 shrink-0">
          <Button
            onClick={action.onClick}
            variant="primary"
            size="lg"
            className="shadow-overlay shadow-brand-primary-500/20 hover:shadow-brand-primary-500/30 px-8 py-3.5"
          >
            <Plus size={20} className="mr-2 rtl:ml-2 rtl:mr-0" />
            <span className="text-xs font-black uppercase tracking-widest">{action.label}</span>
          </Button>
        </div>
      )}
    </div>
  );
}
