import React from 'react';
import { Filter, Clock, ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface TimelineFilterBarProps {
  selectedSeverity: string;
  selectedEventType: string;
  onSeverityChange: (severity: string) => void;
  onEventTypeChange: (eventType: string) => void;
}

export const TimelineFilterBar: React.FC<TimelineFilterBarProps> = ({
  selectedSeverity,
  selectedEventType,
  onSeverityChange,
  onEventTypeChange,
}) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-surface-subtle dark:bg-slate-800/50 rounded-2xl border border-brand-border mb-4">
      <div className="flex items-center gap-2">
        <Filter size={14} className="text-brand-text-muted shrink-0" />
        <span className="text-[10px] font-black uppercase tracking-widest text-brand-text-muted">
          {t('timeline.filters', 'Filters:')}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Severity Filter Chips */}
        <div className="flex items-center gap-1 bg-brand-bg-card p-1 rounded-xl border border-brand-border">
          <button
            type="button"
            onClick={() => onSeverityChange('ALL')}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
              selectedSeverity === 'ALL'
                ? 'bg-brand-primary-500 text-white shadow-sm'
                : 'text-brand-text-sub hover:text-brand-text-primary'
            }`}
          >
            {t('timeline.allSeverities', 'All Severities')}
          </button>
          <button
            type="button"
            onClick={() => onSeverityChange('IMPORTANT')}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all ${
              selectedSeverity === 'IMPORTANT'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30'
            }`}
          >
            <Clock size={10} /> {t('timeline.important', 'Important')}
          </button>
          <button
            type="button"
            onClick={() => onSeverityChange('WARNING')}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all ${
              selectedSeverity === 'WARNING'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30'
            }`}
          >
            <ShieldAlert size={10} /> {t('timeline.warnings', 'Warnings')}
          </button>
        </div>

        {/* Event Type Filter Chips */}
        <div className="flex items-center gap-1 bg-brand-bg-card p-1 rounded-xl border border-brand-border">
          <button
            type="button"
            onClick={() => onEventTypeChange('ALL')}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
              selectedEventType === 'ALL'
                ? 'bg-brand-primary-500 text-white shadow-sm'
                : 'text-brand-text-sub hover:text-brand-text-primary'
            }`}
          >
            {t('timeline.allEvents', 'All Events')}
          </button>
          <button
            type="button"
            onClick={() => onEventTypeChange('DEADLINE_EXTENDED')}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
              selectedEventType === 'DEADLINE_EXTENDED'
                ? 'bg-brand-primary-500 text-white shadow-sm'
                : 'text-brand-text-sub hover:text-brand-text-primary'
            }`}
          >
            {t('timeline.deadlineExtensions', 'Deadline Extensions')}
          </button>
          <button
            type="button"
            onClick={() => onEventTypeChange('PORTAL_CLOSED')}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
              selectedEventType === 'PORTAL_CLOSED'
                ? 'bg-brand-primary-500 text-white shadow-sm'
                : 'text-brand-text-sub hover:text-brand-text-primary'
            }`}
          >
            {t('timeline.portalLocks', 'Portal Locks')}
          </button>
        </div>
      </div>
    </div>
  );
};
