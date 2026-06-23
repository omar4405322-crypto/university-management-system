import React, { InputHTMLAttributes } from 'react';

interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {}

const Checkbox: React.FC<CheckboxProps> = ({ className = '', ...props }) => {
  return (
    <input
      type="checkbox"
      className={`h-4 w-4 rounded border-brand-border text-brand-primary-500 focus:ring-brand-primary-500/20 focus:ring-offset-0 bg-surface-subtle cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      {...props}
    />
  );
};

export default Checkbox;
