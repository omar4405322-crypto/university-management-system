import React from 'react';

const Input = ({ label, error, className = '', ...props }) => {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {label}
        </label>
      )}
      <input
        className={`px-3 py-2 bg-white dark:bg-slate-900 border rounded-lg text-sm transition-all duration-200 
          focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500
          text-slate-900 dark:text-white
          disabled:bg-slate-50 disabled:text-slate-500 dark:disabled:bg-slate-800 dark:disabled:text-slate-400
          ${error ? 'border-rose-500' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'}`}
        {...props}
      />
      {error && (
        <p className="text-xs text-rose-500 mt-1">{error}</p>
      )}
    </div>
  );
};

export default Input;
