import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import { MapPin, User, Calendar, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { TimeRange } from '../ui/TimeRange';
import { EmptyState } from '../ui/EmptyState';

const getSessionBadgeColor = (type: string) => {
  switch (type) {
    case 'LECTURE': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800';
    case 'LAB': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800';
    case 'SECTION': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800';
    default: return 'bg-slate-100 text-slate-700 dark:bg-slate-800/40 dark:text-slate-300';
  }
};

export interface ScheduleViewProps {
  timetable: Record<string, any[]>;
  role: 'STUDENT' | 'DOCTOR' | 'TA';
  selectedDay: string;
  setSelectedDay: (day: string) => void;
  days: string[];
  times: string[];
  formatTime: (time: string) => string;
  canManage?: boolean;
  onAddSlot?: (day: string, time: string) => void;
  onSlotClick?: (entry: any) => void;
}

export function ScheduleView({
  timetable,
  role,
  selectedDay,
  setSelectedDay,
  days,
  times,
  formatTime,
  canManage = false,
  onAddSlot,
  onSlotClick
}: ScheduleViewProps) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const getEntriesForTimeSlot = (day: string, time: string) => {
    if (!timetable || !timetable[day]) return [];
    return timetable[day].filter((s) => {
      const startHour = parseInt(s.startTime.split(':')[0]);
      const currentHour = parseInt(time.split(':')[0]);
      return startHour === currentHour;
    });
  };

  // Tablet View Logic
  const selectedIndex = useMemo(() => Math.max(0, days.indexOf(selectedDay)), [days, selectedDay]);

  const visibleStartIndex = useMemo(() => {
    if (selectedIndex === -1) return 0;
    const idealStart = selectedIndex - 1;
    return Math.max(0, Math.min(idealStart, days.length - 3));
  }, [selectedIndex, days.length]);

  const visibleDays = days.slice(visibleStartIndex, visibleStartIndex + 3);

  const handlePrevTablet = () => {
    const newIndex = Math.max(selectedIndex - 3, 0);
    setSelectedDay(days[newIndex]);
  };

  const handleNextTablet = () => {
    const newIndex = Math.min(selectedIndex + 3, days.length - 1);
    setSelectedDay(days[newIndex]);
  };
  
  const canGoPrev = visibleStartIndex > 0;
  const canGoNext = visibleStartIndex < days.length - 3;

  // Empty State keys based on role
  const getEmptyStateTitle = () => {
    switch (role) {
      case 'DOCTOR': return t('schedule.noClassesForDoctor', 'No teaching sessions scheduled for this day');
      case 'TA': return t('schedule.noClassesForTA', 'No section or lab sessions scheduled for this day');
      default: return t('schedule.noClassesForStudent', 'No classes scheduled for this day');
    }
  };

  const renderEntryCard = (entry: any, isDesktop = false) => (
    <div
      key={entry.id || Math.random()}
      onClick={() => {
        if (canManage) onSlotClick?.(entry);
      }}
      className={`rounded-xl p-3 border-s-4 shadow-sm transition-all hover:shadow-md hover:scale-[1.01] border border-y-slate-200/50 border-e-slate-200/50 dark:border-y-slate-700/50 dark:border-e-slate-700/50 relative group/entry ${
        entry.isTemporarilyModified
          ? 'border-s-amber-500 bg-amber-500/5 dark:bg-amber-500/10'
          : 'border-s-brand-primary-500 bg-brand-primary-500/5 dark:bg-brand-primary-500/10'
      } ${!isDesktop ? 'bg-white dark:bg-slate-800' : ''} ${
        canManage ? 'cursor-pointer' : ''
      }`}
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex flex-col gap-1">
          <Badge
            variant="info"
            className="text-[9px] font-medium px-1.5 py-0.5 bg-brand-primary-100 dark:bg-brand-primary-900/40 text-brand-primary-700 dark:text-brand-primary-300"
          >
            <TimeRange start={entry.startTime} end={entry.endTime} />
          </Badge>
          {entry.isTemporarilyModified && (
            <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800 w-fit">
              {t('schedule.temporaryChange', '⊠ تعديل مؤقت')}
            </span>
          )}
        </div>
        {entry.slotType && (
          <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider ${getSessionBadgeColor(entry.slotType)}`}>
            {t(`schedule.${entry.slotType.toLowerCase()}`, entry.slotType)}
          </span>
        )}
      </div>
      
      <p className="text-xs font-medium text-brand-text-primary dark:text-brand-text-main leading-tight transition-colors group-hover/entry:text-brand-primary-600">
        {entry.course?.code && (
          <span className="text-brand-primary-600 dark:text-brand-primary-400 mr-2 text-[10px]">
            {entry.course.code}
          </span>
        )}
        {entry.course?.name}
      </p>
      
      {entry.group?.name && (
        <p className="text-[10px] font-bold text-slate-400 mt-0.5">
          {t('common.group', 'Group:')} {entry.group.name}
        </p>
      )}
      
      <div className="mt-2 space-y-1 text-[10px] text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-1.5 font-normal">
          <MapPin size={10} className="text-slate-400 shrink-0" />
          <span>{entry.room || t('common.tba', 'TBA')}</span>
        </div>
        <div className="flex items-center gap-1.5 font-normal">
          <User size={10} className="text-slate-400 shrink-0" />
          <span>
            {entry.doctor
              ? `${entry.doctor.firstName || ''} ${entry.doctor.lastName || ''}`
              : t('common.staff', 'Staff')}
          </span>
        </div>
        {entry.teachingAssistant && (
          <div className="flex items-center gap-1.5 font-normal ml-4 text-[9px] text-slate-400">
            <span>{t('schedule.ta', 'TA:')} {entry.teachingAssistant.firstName} {entry.teachingAssistant.lastName}</span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Day Selector (Visible only on standard mobile < md) */}
      <div className="flex gap-2 overflow-x-auto pb-4 md:hidden custom-scrollbar">
        {days.map((day) => (
          <button
            key={day}
            onClick={() => setSelectedDay(day)}
            className={`flex-shrink-0 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-sm ${selectedDay === day
              ? 'bg-brand-primary-600 text-white shadow-brand-primary-600/20'
              : 'bg-surface-subtle text-brand-text-secondary hover:bg-brand-primary-600/10'
              }`}
          >
            {t(`days.${day.toLowerCase()}`) || day.slice(0, 3)}
          </button>
        ))}
      </div>

      {/* Grid container (Desktop & Tablet) */}
      <div className="hidden md:block">
        <Card className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden p-0 lg:p-6">
          
          {/* Tablet specific headers with arrows */}
          <div className="flex items-center justify-between p-4 lg:hidden border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40">
            <button 
              onClick={isRTL ? handleNextTablet : handlePrevTablet}
              disabled={isRTL ? !canGoNext : !canGoPrev}
              className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 disabled:opacity-50 text-slate-500 hover:text-brand-primary-600"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="text-sm font-bold text-slate-700 dark:text-slate-300">
              {t(`days.${visibleDays[0]?.toLowerCase()}`)} - {t(`days.${visibleDays[visibleDays.length-1]?.toLowerCase()}`)}
            </div>
            <button 
              onClick={isRTL ? handlePrevTablet : handleNextTablet}
              disabled={isRTL ? !canGoPrev : !canGoNext}
              className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 disabled:opacity-50 text-slate-500 hover:text-brand-primary-600"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          <div className="overflow-x-auto custom-scrollbar">
            <div className="min-w-full">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-700">
                    <th className="p-4 w-24"></th>
                    {days.map((day) => (
                      <th
                        key={day}
                        className={`p-4 text-xs font-semibold text-brand-text-primary dark:text-brand-text-main uppercase tracking-widest ${
                          visibleDays.includes(day) ? 'table-cell lg:table-cell' : 'hidden lg:table-cell'
                        }`}
                      >
                        {t(`days.${day.toLowerCase()}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {times.map((time) => (
                    <tr key={time} className="group hover:bg-slate-50/10 dark:hover:bg-slate-800/5">
                      <td className="p-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 text-center bg-slate-50/50 dark:bg-slate-900/10">
                        {formatTime(time)}
                      </td>
                      {days.map((day) => {
                        const entries = getEntriesForTimeSlot(day, time);
                        return (
                          <td
                            key={`${day}-${time}`}
                            className={`p-2 align-top transition-colors relative group/cell ${
                              visibleDays.includes(day) ? 'table-cell lg:table-cell' : 'hidden lg:table-cell'
                            }`}
                          >
                            {entries.length > 0 ? (
                              <div className="space-y-2">
                                {entries.map((entry) => renderEntryCard(entry, true))}
                              </div>
                            ) : (
                              <div className="h-16 flex items-center justify-center text-slate-300 dark:text-slate-600 select-none">
                                <span>—</span>
                              </div>
                            )}

                            {/* "Add Lesson" button for empty slots */}
                            {canManage && entries.length === 0 && (
                              <button
                                onClick={() => onAddSlot?.(day, time)}
                                className="absolute inset-1 m-1 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl flex items-center justify-center text-slate-400 
                                opacity-100 hover:opacity-100 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-brand-primary-400 hover:text-brand-primary-500
                                [@media(hover:hover)and(pointer:fine)]:opacity-0 [@media(hover:hover)and(pointer:fine)]:group-hover/cell:opacity-100 transition-all duration-200"
                              >
                                <Plus size={20} />
                              </button>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      </div>

      {/* Mobile Stacked View */}
      <div className="md:hidden space-y-4">
        <p className="text-[10px] font-black uppercase text-brand-text-muted text-center tracking-widest animate-pulse">
          {t('schedule.swipeHint', 'Swipe to see other days')}
        </p>
        {times.flatMap((time) => getEntriesForTimeSlot(selectedDay, time)).length > 0 ? (
          <div className="space-y-3">
            {times
              .flatMap((time) => getEntriesForTimeSlot(selectedDay, time))
              .map((entry) => renderEntryCard(entry, false))}
          </div>
        ) : (
          <EmptyState
            icon={<Calendar size={40} />}
            title={getEmptyStateTitle()}
          />
        )}
      </div>
    </>
  );
}

export default ScheduleView;
