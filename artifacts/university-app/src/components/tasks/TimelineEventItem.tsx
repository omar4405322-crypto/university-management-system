import React, { useState } from 'react';
import {
  Clock,
  Lock,
  Unlock,
  Sparkles,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  User,
  Calendar,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface TimelineEventItemProps {
  event: {
    id: number;
    eventType: string;
    severity: string;
    visibility: string;
    title: string;
    summary: string;
    actor: {
      id: number | null;
      name: string;
      role: string;
    };
    diff?: Record<string, any> | null;
    createdAt: string;
  };
}

export const TimelineEventItem: React.FC<TimelineEventItemProps> = ({
  event,
}) => {
  const { t, i18n } = useTranslation();
  const [showDiff, setShowDiff] = useState(false);

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleString(i18n.language || 'en', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch (e) {
      return dateStr;
    }
  };

  // Severity styling configuration
  const getSeverityBadge = () => {
    switch (event.severity) {
      case 'CRITICAL':
        return (
          <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
            {t('timeline.critical', 'Critical')}
          </span>
        );
      case 'IMPORTANT':
        return (
          <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
            {t('timeline.important', 'Important')}
          </span>
        );
      case 'WARNING':
        return (
          <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
            {t('timeline.warnings', 'Warning')}
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
            {t('timeline.info', 'Info')}
          </span>
        );
    }
  };

  // Event icon rendering
  const getEventIcon = () => {
    switch (event.eventType) {
      case 'PORTAL_CLOSED':
        return <Lock size={16} className="text-amber-600 dark:text-amber-400" />;
      case 'PORTAL_OPENED':
        return <Unlock size={16} className="text-emerald-600 dark:text-emerald-400" />;
      case 'DEADLINE_EXTENDED':
      case 'DEADLINE_SHORTENED':
        return <Clock size={16} className="text-indigo-600 dark:text-indigo-400" />;
      case 'ASSIGNMENT_CREATED':
      case 'ASSIGNMENT_PUBLISHED':
        return <Sparkles size={16} className="text-brand-primary-600 dark:text-brand-primary-400" />;
      default:
        return <AlertCircle size={16} className="text-slate-500" />;
    }
  };

  return (
    <div className="relative pl-6 rtl:pl-0 rtl:pr-6 pb-6 last:pb-0 border-l-2 rtl:border-l-0 rtl:border-r-2 border-brand-border dark:border-slate-700 group">
      {/* Event Timeline Bullet Point */}
      <div className="absolute -left-[9px] rtl:-left-auto rtl:-right-[9px] top-0 w-4 h-4 rounded-full bg-brand-bg-card border-2 border-brand-primary-500 flex items-center justify-center group-hover:scale-125 transition-transform" />

      <div className="bg-brand-bg-card p-4 rounded-2xl border border-brand-border shadow-sm hover:shadow-md transition-shadow space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-surface-subtle dark:bg-slate-800">
              {getEventIcon()}
            </div>
            <h4 className="font-extrabold text-xs text-brand-text-primary dark:text-brand-text-main">
              {event.title}
            </h4>
          </div>
          <div className="flex items-center gap-2">
            {getSeverityBadge()}
            <span className="text-[10px] font-bold text-brand-text-muted flex items-center gap-1">
              <Calendar size={10} />
              {formatDate(event.createdAt)}
            </span>
          </div>
        </div>

        <p className="text-xs font-semibold leading-relaxed text-brand-text-sub dark:text-slate-300">
          {event.summary}
        </p>

        {/* Actor Info */}
        <div className="flex items-center justify-between text-[10px] text-brand-text-muted pt-1 border-t border-brand-border/60">
          <div className="flex items-center gap-1.5 font-bold">
            <User size={12} className="text-brand-primary-500" />
            <span>
              {event.actor.name} ({event.actor.role})
            </span>
          </div>

          {/* Expandable Diff Payload Trigger */}
          {event.diff && Object.keys(event.diff).length > 0 && (
            <button
              type="button"
              onClick={() => setShowDiff(!showDiff)}
              className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-brand-primary-600 hover:underline"
            >
              {showDiff ? t('timeline.hideDetails', 'Hide Details') : t('timeline.viewDetails', 'View Details')}
              {showDiff ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          )}
        </div>

        {/* Expandable Diff Payload Box */}
        {showDiff && event.diff && (
          <div className="mt-2 p-3 bg-surface-subtle dark:bg-slate-900/60 rounded-xl border border-brand-border text-xs space-y-1 font-mono">
            {event.diff.previousDueDate && (
              <div className="flex justify-between">
                <span className="text-rose-600 font-bold">{t('timeline.previousDueDate', 'Previous Due Date:')}</span>
                <span>{formatDate(event.diff.previousDueDate)}</span>
              </div>
            )}
            {event.diff.newDueDate && (
              <div className="flex justify-between">
                <span className="text-emerald-600 font-bold">{t('timeline.newDueDate', 'New Due Date:')}</span>
                <span>{formatDate(event.diff.newDueDate)}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
