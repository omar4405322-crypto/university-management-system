import React, { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
}

const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center rounded-xl font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97]';

  const sizes = {
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-5 py-2.5 text-sm gap-2',
    lg: 'px-6 py-3 text-sm gap-2.5',
  };

  const variants = {
    primary: 'btn-primary focus:ring-brand-primary-500/40',
    secondary: 'btn-secondary focus:ring-brand-navy-500/30',
    outline: 'btn-outline focus:ring-brand-primary-500/20',
    ghost: 'btn-ghost focus:ring-brand-primary-500/20',
    danger: 'btn-danger focus:ring-error/30',
    success: 'btn-success focus:ring-success/30',
  };

  return (
    <button className={`${baseStyles} ${sizes[size]} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};

export default Button;
