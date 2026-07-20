import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, X } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  sublabel?: string;
  group?: string;
}

interface SearchableSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  isRTL?: boolean;
  className?: string;
  icon?: React.ReactNode;
}

export default function SearchableSelect({
  options = [],
  value,
  onChange,
  placeholder = 'Select option...',
  searchPlaceholder = 'Search...',
  emptyText = 'No options found',
  disabled = false,
  isRTL = false,
  className = '',
  icon
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = useMemo(() => {
    return options.find(opt => String(opt.value) === String(value));
  }, [options, value]);

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;
    const term = search.toLowerCase().trim();
    return options.filter(opt =>
      opt.label.toLowerCase().includes(term) ||
      (opt.sublabel && opt.sublabel.toLowerCase().includes(term)) ||
      (opt.group && opt.group.toLowerCase().includes(term))
    );
  }, [options, search]);

  // Group options if group property exists
  const groupedOptions = useMemo(() => {
    const groups: Record<string, SelectOption[]> = {};
    let hasGroup = false;

    filteredOptions.forEach(opt => {
      const groupName = opt.group || 'General';
      if (opt.group) hasGroup = true;
      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName].push(opt);
    });

    return { groups, hasGroup };
  }, [filteredOptions]);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    setSearch('');
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 text-brand-text-primary dark:text-brand-text-main flex items-center justify-between gap-2 text-sm font-semibold transition-all shadow-sm ${
          isOpen ? 'ring-2 ring-brand-primary-500/20 border-brand-primary-500' : 'hover:border-slate-300 dark:hover:border-slate-600'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <div className="flex items-center gap-2 overflow-hidden truncate">
          {icon && <span className="text-slate-400 shrink-0">{icon}</span>}
          <span className={`truncate ${!selectedOption ? 'text-slate-400 font-normal' : ''}`}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>
        <ChevronDown size={16} className={`text-slate-400 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute z-50 mt-1.5 w-full bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in duration-150">
          {/* Search Box */}
          <div className="p-2 border-b border-slate-100 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-900/40 flex items-center gap-2">
            <Search size={16} className="text-slate-400 shrink-0 ms-2" />
            <input
              type="text"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full bg-transparent text-sm py-1.5 px-1 text-brand-text-primary dark:text-brand-text-main placeholder-slate-400 focus:outline-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Options List */}
          <div className="max-h-60 overflow-y-auto p-1.5 space-y-1">
            {filteredOptions.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400 font-medium">
                {emptyText}
              </div>
            ) : groupedOptions.hasGroup ? (
              Object.entries(groupedOptions.groups).map(([groupName, groupOpts]) => (
                <div key={groupName} className="space-y-1">
                  <div className="px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-brand-primary-600 dark:text-brand-primary-400 bg-brand-primary-50/50 dark:bg-brand-primary-950/30 rounded-lg">
                    {groupName}
                  </div>
                  {groupOpts.map((opt) => {
                    const isSelected = String(opt.value) === String(value);
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => handleSelect(opt.value)}
                        className={`w-full text-start px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition-colors ${
                          isSelected
                            ? 'bg-brand-primary-500 text-white font-bold'
                            : 'text-brand-text-primary dark:text-brand-text-main hover:bg-slate-100 dark:hover:bg-slate-700/60'
                        }`}
                      >
                        <div className="flex flex-col">
                          <span>{opt.label}</span>
                          {opt.sublabel && (
                            <span className={`text-[10px] ${isSelected ? 'text-white/80' : 'text-slate-400'}`}>
                              {opt.sublabel}
                            </span>
                          )}
                        </div>
                        {isSelected && <Check size={14} className="shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              ))
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = String(opt.value) === String(value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSelect(opt.value)}
                    className={`w-full text-start px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition-colors ${
                      isSelected
                        ? 'bg-brand-primary-500 text-white font-bold'
                        : 'text-brand-text-primary dark:text-brand-text-main hover:bg-slate-100 dark:hover:bg-slate-700/60'
                    }`}
                  >
                    <div className="flex flex-col">
                      <span>{opt.label}</span>
                      {opt.sublabel && (
                        <span className={`text-[10px] ${isSelected ? 'text-white/80' : 'text-slate-400'}`}>
                          {opt.sublabel}
                        </span>
                      )}
                    </div>
                    {isSelected && <Check size={14} className="shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
