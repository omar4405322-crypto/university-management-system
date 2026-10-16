import React from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, Building, Layers, Printer, RotateCw } from 'lucide-react';
import Badge from '../ui/badge';
import Button from '../ui/button';

export interface ScheduleHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  roleBadge?: React.ReactNode;
  statusBadge?: React.ReactNode;
  currentTermName?: string;
  canManage?: boolean;
  onManage?: () => void;
  showPrint?: boolean;
  onPrint?: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const ScheduleHeader: React.FC<ScheduleHeaderProps> = ({
  title,
  subtitle,
  icon,
  roleBadge,
  statusBadge,
  currentTermName,
  canManage = false,
  onManage,
  showPrint = true,
  onPrint,
  onRefresh,
  isRefreshing = false,
}) => {
  const { t } = useTranslation();

  const renderIcon = () => {
    if (typeof icon === 'string' && icon.trim().length > 0) {
      return icon.trim()[0];
    }
    if (icon) {
      return icon;
    }
    return <Calendar size={22} />;
  };

  const defaultSubtitle = t('schedules.universityFallback', '6th of October Technological University');

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-700 p-4 shadow-2xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Left / Leading: Avatar / Icon + Titles + Badges */}
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-primary-500 to-brand-primary-700 text-white font-bold text-lg flex items-center justify-center shadow-xs shrink-0">
            {renderIcon()}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                {title}
              </h1>
              {roleBadge && (
                typeof roleBadge === 'string' ? (
                  <Badge variant="info" className="text-[10px] font-bold">
                    {roleBadge}
                  </Badge>
                ) : (
                  roleBadge
                )
              )}
              {statusBadge}
              {currentTermName && (
                <Badge variant="neutral" className="text-[10px] font-bold">
                  {currentTermName}
                </Badge>
              )}
            </div>
            <p className="text-xs text-slate-400 font-semibold mt-0.5 flex items-center gap-1.5">
              <Building size={13} className="text-brand-primary-500 shrink-0" />
              <span>{subtitle || defaultSubtitle}</span>
            </p>
          </div>
        </div>

        {/* Right / Trailing: Action Buttons with >= 40px touch targets */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {canManage && onManage && (
            <Button
              size="sm"
              onClick={onManage}
              aria-label={t('schedules.manageTimetables', 'Manage Timetables')}
              className="min-h-[40px] min-w-[40px] px-3.5 rounded-xl text-xs font-bold bg-brand-primary-600 hover:bg-brand-primary-700 text-white border-0 gap-1.5 cursor-pointer shadow-xs hover:shadow-sm transition-all flex items-center"
            >
              <Layers size={14} className="text-white" />
              <span>{t('schedules.manageTimetables', 'Manage Timetables')}</span>
            </Button>
          )}

          {showPrint && (
            <Button
              size="sm"
              onClick={onPrint || (() => window.print())}
              aria-label={t('common.print', 'Print')}
              className="min-h-[40px] min-w-[40px] px-3.5 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-white border-0 gap-1.5 cursor-pointer shadow-xs hover:shadow-sm transition-all flex items-center"
            >
              <Printer size={14} className="text-white" />
              <span>{t('common.print', 'Print')}</span>
            </Button>
          )}

          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="min-h-[40px] min-w-[40px] h-10 w-10 flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer shadow-2xs transition-all"
              title={t('common.refresh', 'Refresh')}
              aria-label={t('schedules.refreshSchedule', 'Refresh schedule')}
            >
              <RotateCw size={14} className={isRefreshing ? 'animate-spin' : ''} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScheduleHeader;
