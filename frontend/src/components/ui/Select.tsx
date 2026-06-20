import React from 'react';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: React.ReactNode;
  error?: string;
  options?: SelectOption[];
  placeholder?: string;
  children?: React.ReactNode;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(({
  label,
  error,
  options,
  placeholder,
  className = '',
  children,
  ...props
}, ref) => {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
          {props.required && <span className="text-red-500 ms-1">*</span>}
        </label>
      )}
      <select
        ref={ref}
        className={`
          w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm
          focus:outline-none focus:ring-2 focus:ring-primary
          dark:bg-gray-800 dark:border-gray-600 dark:text-white
          disabled:opacity-50 disabled:cursor-not-allowed
          ${error ? 'border-red-500 focus:ring-red-500' : ''}
          ${className}
        `}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options ? options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        )) : children}
      </select>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
});
