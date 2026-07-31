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

  // Determine today's day name for highlighting
  const todayDayName = useMemo(() => {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return dayNames[new Date().getDay()];
  }, []);

  const renderEntryCard = (entry: any, isDesktop = false) => {
    const isLecture = entry.slotType === 'LECTURE';
    const isLab = entry.slotType === 'LAB';

    const cardBgClass = isLecture
      ? 'bg-blue-50/70 dark:bg-blue-950/20 border-s-blue-500 border-blue-200/60 dark:border-blue-900/40 text-blue-900 dark:text-blue-100'
      : isLab
      ? 'bg-amber-50/70 dark:bg-amber-950/20 border-s-amber-500 border-amber-200/60 dark:border-amber-900/40 text-amber-900 dark:text-amber-100'
      : 'bg-purple-50/70 dark:bg-purple-950/20 border-s-purple-500 border-purple-200/60 dark:border-purple-900/40 text-purple-900 dark:text-purple-100';

    return (
      <div
        key={entry.id || Math.random()}
        onClick={() => {
          if (canManage) onSlotClick?.(entry);
        }}
        className={`rounded-2xl p-3 border-s-4 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 relative group/entry ${cardBgClass} ${
          canManage ? 'cursor-pointer' : ''
        }`}
      >
        <div className="flex justify-between items-center gap-1 mb-2">
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/80 dark:bg-slate-800/80 shadow-xs border border-slate-200/60 dark:border-slate-700/60 text-slate-700 dark:text-slate-200 backdrop-blur-xs">
              <TimeRange start={entry.startTime} end={entry.endTime} />
            </span>
            {entry.isTemporarilyModified && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500 text-white shadow-xs">
                {t('schedule.temporaryChange', 'تعديل مؤقت')}
              </span>
            )}
          </div>
          {entry.slotType && (
            <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${getSessionBadgeColor(entry.slotType)}`}>
              {String(t(`schedule.${entry.slotType.toLowerCase()}`, entry.slotType))}
            </span>
          )}
        </div>
        
        <p className="text-xs font-bold text-slate-800 dark:text-white leading-snug transition-colors group-hover/entry:text-brand-primary-600 dark:group-hover/entry:text-brand-primary-400">
          {entry.course?.courseCode && (
            <span className="text-brand-primary-600 dark:text-brand-primary-400 me-1.5 font-black text-[11px] bg-brand-primary-500/10 px-1.5 py-0.5 rounded">
              {entry.course.courseCode}
            </span>
          )}
          {entry.course?.name || entry.courseName}
        </p>
        
        {entry.group?.name && (
          <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-200/60 dark:bg-slate-700/60 text-[10px] font-bold text-slate-700 dark:text-slate-300">
            <span>{t('common.group', 'المجموعة:')}</span>
            <span className="text-brand-primary-600 dark:text-brand-primary-400">{entry.group.name}</span>
          </div>
        )}
        
        <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 space-y-1 text-[10px] text-slate-600 dark:text-slate-300 font-semibold">
          <div className="flex items-center gap-1.5">
            <MapPin size={11} className="text-amber-500 shrink-0" />
            <span className="truncate">{entry.room || t('common.tba', 'TBA')}</span>
          </div>
          {role !== 'DOCTOR' && (
            <div className="flex items-center gap-1.5">
              <User size={11} className="text-brand-primary-500 shrink-0" />
              <span className="truncate">
                {entry.doctor
                  ? `${entry.doctor.firstName || ''} ${entry.doctor.lastName || ''}`
                  : entry.doctorName || t('common.staff', 'Staff')}
              </span>
            </div>
          )}
          {entry.teachingAssistant && (
            <div className="flex items-center gap-1.5 text-[9.5px] text-purple-600 dark:text-purple-300">
              <User size={10} className="text-purple-400 shrink-0" />
              <span className="truncate">{t('schedule.ta', 'المعيد:')} {entry.teachingAssistant.firstName} {entry.teachingAssistant.lastName}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Mobile Day Selector (Visible only on standard mobile < md) */}
      <div className="flex gap-2 overflow-x-auto pb-4 md:hidden custom-scrollbar">
        {days.map((day) => {
          const isToday = day.toLowerCase() === todayDayName.toLowerCase();
          return (
            <button
              key={day}
              onClick={() => setSelectedDay(day)}
              className={`flex-shrink-0 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-sm flex items-center gap-2 ${selectedDay === day
                ? 'bg-brand-primary-600 text-white shadow-brand-primary-600/20'
                : 'bg-surface-subtle text-brand-text-secondary hover:bg-brand-primary-600/10'
                }`}
            >
              {isToday && <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />}
              {t(`days.${day.toLowerCase()}`) || day.slice(0, 3)}
            </button>
          );
        })}
      </div>

      {/* Grid container (Desktop & Tablet) */}
      <div className="hidden md:block">
        <Card className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden p-0 lg:p-6">
          
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
                  <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700">
                    <th className="p-4 w-28 text-center text-xs font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">
                      ⏰ {t('common.time', 'الوقت')}
                    </th>
                    {days.map((day) => {
                      const isToday = day.toLowerCase() === todayDayName.toLowerCase();
                      return (
                        <th
                          key={day}
                          className={`p-4 text-xs font-extrabold uppercase tracking-widest text-center ${
                            visibleDays.includes(day) ? 'table-cell lg:table-cell' : 'hidden lg:table-cell'
                          } ${isToday ? 'bg-brand-primary-500/10 text-brand-primary-600 dark:text-brand-primary-400 border-b-2 border-b-brand-primary-500' : 'text-slate-700 dark:text-slate-200'}`}
                        >
                          <div className="flex items-center justify-center gap-1.5">
                            {isToday && <span className="w-2 h-2 rounded-full bg-brand-primary-500 animate-ping" />}
                            {t(`days.${day.toLowerCase()}`)}
                            {isToday && (
                              <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-brand-primary-500 text-white ms-1">
                                {t('common.today', 'اليوم')}
                              </span>
                            )}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/80 dark:divide-slate-700/80">
                  {times.map((time) => (
                    <tr key={time} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="p-3 text-[11px] font-black text-slate-500 dark:text-slate-400 text-center bg-slate-50/60 dark:bg-slate-900/30 whitespace-nowrap border-e border-slate-200/60 dark:border-slate-700/60">
                        {formatTime(time)}
                      </td>
                      {days.map((day) => {
                        const entries = getEntriesForTimeSlot(day, time);
                        const isToday = day.toLowerCase() === todayDayName.toLowerCase();
                        return (
                          <td
                            key={`${day}-${time}`}
                            className={`p-2 align-top transition-colors relative group/cell border-e border-slate-200/40 dark:border-slate-700/40 min-w-[170px] ${
                              visibleDays.includes(day) ? 'table-cell lg:table-cell' : 'hidden lg:table-cell'
                            } ${isToday ? 'bg-brand-primary-500/[0.02] dark:bg-brand-primary-500/[0.04]' : ''}`}
                          >
                            {entries.length > 0 ? (
                              <div className="space-y-2">
                                {entries.map((entry) => renderEntryCard(entry, true))}
                              </div>
                            ) : (
                              <div className="h-16 flex items-center justify-center text-slate-300 dark:text-slate-600 select-none">
                                <span className="text-xs opacity-40">—</span>
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
            subtitle={t('schedule.noSlotsForDay', 'لا توجد حصص مجدولة لهذا اليوم')}
          />
        )}
      </div>
    </>
  );
}

export default ScheduleView;
