import React from 'react';

const Input = ({ label, error, className = '', ...props }) => {
  return (
    <div className="form-field">
      {label && (
        <label className="label-stat text-brand-text-secondary ms-1">
          {label}
        </label>
      )}
      <input
        className={`px-4 py-2.5 bg-brand-bg-card border rounded-xl text-sm text-brand-text-primary transition-all duration-200
          focus:outline-none focus:ring-4 focus:ring-brand-primary-500/10 focus:border-brand-primary-500
          placeholder:text-brand-text-muted
          disabled:bg-surface-subtle disabled:text-brand-text-muted disabled:cursor-not-allowed
          ${error ? 'border-error ring-error/10' : 'border-brand-border hover:border-brand-text-muted'}`}
        {...props}
      />
      {error && (
        <p className="text-xs text-error font-medium mt-1.5 ms-1">{error}</p>
      )}
    </div>
  );
};

export default Input;
