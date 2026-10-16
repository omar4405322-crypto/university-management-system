import React from 'react';
import { useTranslation } from 'react-i18next';
import { Search, X, LayoutGrid, ListOrdered } from 'lucide-react';
import Button from '../ui/button';

export interface ScheduleToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchPlaceholder?: string;
  hasActiveFilters?: boolean;
  onResetFilters?: () => void;
  viewMode?: 'grid' | 'agenda';
  scheduleViewMode?: 'grid' | 'agenda';
  onViewModeChange?: (mode: 'grid' | 'agenda') => void;
  setScheduleViewMode?: (mode: 'grid' | 'agenda') => void;
  children?: React.ReactNode;
}

export const ScheduleToolbar: React.FC<ScheduleToolbarProps> = ({
  searchQuery,
  onSearchChange,
  searchPlaceholder,
  hasActiveFilters = false,
  onResetFilters,
  viewMode,
  scheduleViewMode,
  onViewModeChange,
  setScheduleViewMode,
  children,
}) => {
  const { t } = useTranslation();
  const currentViewMode = scheduleViewMode ?? viewMode ?? 'grid';
  const handleViewModeChange = (mode: 'grid' | 'agenda') => {
    if (onViewModeChange) onViewModeChange(mode);
    if (setScheduleViewMode) setScheduleViewMode(mode);
  };

  return (
    <div className="p-2 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-700 shadow-2xs flex flex-wrap items-center gap-2">
      {/* Search Input */}
      <div className="relative flex-1 min-w-[170px]">
        <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder || t('schedules.searchSchedulePlaceholder')}
          className="w-full h-8.5 ps-8 pe-8 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-1.5 focus:ring-brand-primary-500 outline-none bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            aria-label={t('schedules.clearFilters')}
            className="absolute end-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Page-Specific Filters Slot */}
      {children}

      {/* Clear Filters Button */}
      {hasActiveFilters && onResetFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onResetFilters}
          aria-label={t('schedules.clearFilters', 'Clear filters')}
          className="h-8.5 min-h-[40px] px-2.5 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl font-bold cursor-pointer flex items-center"
        >
          <X size={13} className="me-1" />
          <span>{t('schedules.clearFilters', 'Clear')}</span>
        </Button>
      )}

      {/* View Switcher (Grid vs Agenda) outside filter card */}
      <div className="ms-auto flex items-center p-0.5 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
        <button
          type="button"
          onClick={() => handleViewModeChange('grid')}
          aria-label={t('schedule.gridView', 'Weekly Grid')}
          className={`min-h-[40px] flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            currentViewMode === 'grid'
              ? 'bg-white dark:bg-slate-800 text-brand-primary-600 dark:text-brand-primary-400 shadow-xs'
              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <LayoutGrid size={13} />
          <span>{t('schedule.gridView', 'Weekly Grid')}</span>
        </button>
        <button
          type="button"
          onClick={() => handleViewModeChange('agenda')}
          aria-label={t('schedule.agendaView', 'Agenda View')}
          className={`min-h-[40px] flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            currentViewMode === 'agenda'
              ? 'bg-white dark:bg-slate-800 text-brand-primary-600 dark:text-brand-primary-400 shadow-xs'
              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <ListOrdered size={13} />
          <span>{t('schedule.agendaView', 'Agenda View')}</span>
        </button>
      </div>
    </div>
  );
};

export default ScheduleToolbar;
