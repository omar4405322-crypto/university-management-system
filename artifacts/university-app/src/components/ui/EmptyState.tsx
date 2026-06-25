import React from 'react';
import Button from './Button';

export function EmptyState({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: React.ReactNode;
  title: string | React.ReactNode;
  subtitle: string | React.ReactNode;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center animate-in fade-in zoom-in duration-500 bg-brand-bg-card/30 rounded-[2rem] border-2 border-dashed border-brand-border">
      <div className="w-20 h-20 bg-brand-primary-50 text-brand-primary-600 rounded-3xl flex items-center justify-center mb-6 shadow-inner">
        {icon}
      </div>

      <h3 className="text-xl font-black text-brand-text-primary tracking-tight uppercase mb-2">
        {title}
      </h3>

      <p className="text-brand-text-secondary font-bold max-w-sm mb-8 leading-relaxed">
        {subtitle}
      </p>

      {action && (
        <Button
          onClick={action.onClick}
          className="shadow-xl shadow-brand-primary-600/20 font-black uppercase tracking-widest text-xs px-8"
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}
