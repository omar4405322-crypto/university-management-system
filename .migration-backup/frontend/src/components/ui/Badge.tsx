import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'primary';
  className?: string;
}

const Badge: React.FC<BadgeProps> = ({ children, variant = 'info', className = '' }) => {
  const variants = {
    success:
      'bg-success/10 text-success border-success/20 dark:bg-success/10 dark:text-success dark:border-success/20',
    warning:
      'bg-warning/10 text-warning border-warning/20 dark:bg-warning/10 dark:text-warning dark:border-warning/20',
    danger:
      'bg-error/10 text-error border-error/20 dark:bg-error/10 dark:text-error dark:border-error/20',
    info: 'bg-info/10 text-info border-info/20 dark:bg-info/10 dark:text-info dark:border-info/20',
    neutral:
      'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600',
    primary:
      'bg-brand-primary-50 text-brand-primary-700 border-brand-primary-100 dark:bg-brand-brand-green-dark/10 dark:text-brand-brand-green dark:border-brand-brand-green-dark/20',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border uppercase tracking-wider ${variants[variant]} ${className}`}
    >
      {children}
    </span>
  );
};

export default Badge;
