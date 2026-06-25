import React from 'react';
import { Search, X } from 'lucide-react';

interface FilterBarProps {
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  children?: React.ReactNode;
  onClear?: () => void;
}

const FilterBar: React.FC<FilterBarProps> = ({
  search = '',
  onSearchChange,
  searchPlaceholder,
  children,
  onClear,
}) => {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between px-6 py-4 bg-surface-subtle/50 border-b border-brand-border">
      <div className="relative flex-grow md:max-w-sm w-full group">
        <Search
          className="absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-text-muted group-focus-within:text-brand-primary-600 transition-colors"
          size={16}
        />
        <input
          type="text"
          placeholder={searchPlaceholder || 'Search...'}
          className="w-full ps-10 pe-4 h-10 rounded-xl border border-brand-border bg-brand-bg-card dark:bg-brand-bg-elevated text-sm font-semibold text-brand-text-primary placeholder:text-brand-text-muted focus:outline-none focus:ring-2 focus:ring-brand-primary-600/20 focus:border-brand-primary-600 transition-all"
          value={search}
          onChange={(e) => {
            onSearchChange?.(e.target.value);
          }}
        />
        {search && (
          <button
            onClick={() => {
              onSearchChange?.('');
              onClear?.();
            }}
            className="absolute end-3 top-1/2 -translate-y-1/2 p-0.5 rounded text-brand-text-muted hover:text-brand-text-primary transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>
      {children && <div className="flex items-center gap-2 flex-shrink-0">{children}</div>}
    </div>
  );
};

export default FilterBar;
