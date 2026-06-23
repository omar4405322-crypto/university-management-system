import React from 'react';

const Card = ({ children, title, subtitle, footer, className = '', noPadding = false, borderLeft = false, variant = 'default', ...props }) => {
  const variants = {
    elevated: 'card-elevated hover:shadow-elevated',
    default: 'card-default hover:shadow-card',
    subtle: 'card-subtle',
  };

  return (
    <div
      className={`${variants[variant]} overflow-hidden ${borderLeft ? 'border-r-4 border-r-brand-primary-500 rtl:border-l-4 rtl:border-l-brand-primary-500 rtl:border-r-0' : ''} ${className}`}
      {...props}
    >
      {(title || subtitle) && (
        <div className="card-header">
          {title && (
            <h3 className="heading-2 m-0">{title}</h3>
          )}
          {subtitle && (
            <p className="text-caption mt-1.5">{subtitle}</p>
          )}
        </div>
      )}
      <div className={noPadding ? '' : 'card-body'}>
        {children}
      </div>
      {footer && (
        <div className="card-footer">
          {footer}
        </div>
      )}
    </div>
  );
};

export default Card;
