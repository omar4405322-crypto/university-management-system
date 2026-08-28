import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import Modal from '../ui/Modal';
import {
  MapPin,
  User,
  Calendar,
  Plus,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  LayoutGrid,
  ListOrdered,
  Clock,
  BookOpen,
  Sparkles,
  Layers,
  GraduationCap
} from 'lucide-react';
import { TimeRange } from '../ui/TimeRange';
import { EmptyState } from '../ui/EmptyState';

const getSessionBadgeColor = (type: string) => {
  switch (type) {
    case 'LECTURE':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800';
    case 'LAB':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800';
    case 'SECTION':
    case 'TUTORIAL':
      return 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800';
    default:
      return 'bg-slate-100 text-slate-700 dark:bg-slate-800/40 dark:text-slate-300';
  }
};

export interface ScheduleViewProps {
  timetable: Record<string, any[]>;
  role?: 'STUDENT' | 'DOCTOR' | 'TA' | 'ALL';
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
  role = 'ALL',
  selectedDay,
  setSelectedDay,
  days,
  times,
  formatTime,
  canManage = false,
  onAddSlot,
  onSlotClick,
}: ScheduleViewProps) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language?.startsWith('ar');

  // View Mode: 'grid' | 'agenda'
  const [scheduleViewMode, setScheduleViewMode] = useState<'grid' | 'agenda'>('grid');

  // Conflict Modal State
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [activeConflictData, setActiveConflictData] = useState<{
    day: string;
    time: string;
    entries: any[];
  } | null>(null);

  const getEntriesForTimeSlot = (day: string, time: string) => {
    if (!timetable || !timetable[day]) return [];
    return timetable[day].filter((s) => {
      const startHour = parseInt(s.startTime?.split(':')[0] || '0', 10);
      const currentHour = parseInt(time?.split(':')[0] || '0', 10);
      return startHour === currentHour;
    });
  };

  // Open Conflict Detail Modal
  const handleOpenConflictModal = (day: string, time: string, entries: any[]) => {
    setActiveConflictData({ day, time, entries });
    setConflictModalOpen(true);
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
      case 'DOCTOR':
        return t('schedule.noClassesForDoctor', 'No teaching sessions scheduled for this day');
      case 'TA':
        return t('schedule.noClassesForTA', 'No section or lab sessions scheduled for this day');
      default:
        return t('schedule.noClassesForStudent', 'No classes scheduled for this day');
    }
  };

  // Determine today's day name for highlighting
  const todayDayName = useMemo(() => {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return dayNames[new Date().getDay()];
  }, []);

  // Format Doctor Name Cleanly
  const getDoctorName = (entry: any) => {
    if (entry.doctor) {
      const raw = `${entry.doctor.firstName || ''} ${entry.doctor.lastName || ''}`.replace(/^(Dr\.|د\.)\s*/i, '').trim();
      return `${t('common.dr', 'Dr.')} ${raw}`;
    }
    if (entry.doctorName) {
      return entry.doctorName.replace(/^(Dr\.|د\.)\s*/i, '').trim();
    }
    return '';
  };

  // Render a Single Clean Session Card
  const renderEntryCard = (entry: any, isCompact = false) => {
    const isLecture = entry.slotType === 'LECTURE';
    const isLab = entry.slotType === 'LAB';
    const docName = getDoctorName(entry);

    const cardBgClass = isLecture
      ? 'bg-blue-50/80 dark:bg-blue-950/30 border-s-blue-500 border-blue-200/70 dark:border-blue-900/40 text-blue-900 dark:text-blue-100'
      : isLab
      ? 'bg-amber-50/80 dark:bg-amber-950/30 border-s-amber-500 border-amber-200/70 dark:border-amber-900/40 text-amber-900 dark:text-amber-100'
      : 'bg-purple-50/80 dark:bg-purple-950/30 border-s-purple-500 border-purple-200/70 dark:border-purple-900/40 text-purple-900 dark:text-purple-100';

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
        <div className="flex justify-between items-center gap-1 mb-1.5">
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/90 dark:bg-slate-800/90 shadow-xs border border-slate-200/60 dark:border-slate-700/60 text-slate-700 dark:text-slate-200 backdrop-blur-xs">
              <TimeRange start={entry.startTime} end={entry.endTime} />
            </span>
            {entry.isTemporarilyModified && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500 text-white shadow-xs">
                {t('schedule.temporaryChange', 'Temporary')}
              </span>
            )}
          </div>
          {entry.slotType && (
            <span
              className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${getSessionBadgeColor(
                entry.slotType
              )}`}
            >
              {String(t(`schedule.${entry.slotType.toLowerCase()}`, entry.slotType))}
            </span>
          )}
        </div>

        {/* Course Code & Name */}
        <p className="text-xs font-bold text-slate-800 dark:text-white leading-snug transition-colors group-hover/entry:text-brand-primary-600 dark:group-hover/entry:text-brand-primary-400">
          {entry.course?.courseCode && (
            <span className="text-brand-primary-600 dark:text-brand-primary-400 me-1.5 font-black text-[11px] bg-brand-primary-500/10 px-1.5 py-0.5 rounded">
              {entry.course.courseCode}
            </span>
          )}
          {entry.course?.name || entry.courseName}
        </p>

        {/* Doctor Name Display */}
        {docName && (
          <div className="mt-1.5 flex items-center gap-1 text-[11px] font-bold text-slate-700 dark:text-slate-300">
            <User size={11} className="text-brand-primary-500 shrink-0" />
            <span className="truncate">{docName}</span>
          </div>
        )}

        {/* Group Badge */}
        {entry.group?.name && (
          <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-200/70 dark:bg-slate-700/70 text-[10px] font-bold text-slate-700 dark:text-slate-300">
            <span>{t('common.group', 'Group:')}</span>
            <span className="text-brand-primary-600 dark:text-brand-primary-400">{entry.group.name}</span>
          </div>
        )}

        {/* Hall & TA footer */}
        <div className="mt-2 pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-[10px] text-slate-600 dark:text-slate-300 font-semibold gap-2">
          <div className="flex items-center gap-1 truncate">
            <MapPin size={11} className="text-amber-500 shrink-0" />
            <span className="truncate">{entry.room || t('common.tba', 'TBA')}</span>
          </div>
          {entry.teachingAssistant && (
            <div className="flex items-center gap-1 truncate text-purple-600 dark:text-purple-300 text-[10px]">
              <span className="truncate">
                {t('schedule.ta', 'TA:')} {entry.teachingAssistant.firstName} {entry.teachingAssistant.lastName}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Top Controls: View Switcher (Grid vs Agenda) */}
      <div className="flex items-center justify-between flex-wrap gap-3 pb-1">
        <div className="flex items-center gap-2">
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700 shadow-xs">
            <button
              type="button"
              onClick={() => setScheduleViewMode('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                scheduleViewMode === 'grid'
                  ? 'bg-white dark:bg-slate-700 text-brand-primary-600 dark:text-brand-primary-300 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
              }`}
            >
              <LayoutGrid size={14} />
              <span>{t('schedule.gridView', 'Weekly Grid')}</span>
            </button>
            <button
              type="button"
              onClick={() => setScheduleViewMode('agenda')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                scheduleViewMode === 'agenda'
                  ? 'bg-white dark:bg-slate-700 text-brand-primary-600 dark:text-brand-primary-300 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
              }`}
            >
              <ListOrdered size={14} />
              <span>{t('schedule.agendaView', 'Agenda View')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* VIEW A: AGENDA / DAILY LIST VIEW */}
      {scheduleViewMode === 'agenda' ? (
        <div className="space-y-4">
          {days.map((day) => {
            const dayEntries = timetable[day] || [];
            const isToday = day.toLowerCase() === todayDayName.toLowerCase();

            // Sort day entries by startTime
            const sortedEntries = [...dayEntries].sort((a, b) =>
              (a.startTime || '').localeCompare(b.startTime || '')
            );

            return (
              <Card
                key={day}
                className={`rounded-2xl border p-5 transition-all ${
                  isToday
                    ? 'border-brand-primary-500/50 bg-brand-primary-500/[0.02] dark:bg-brand-primary-500/[0.04] shadow-sm'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                }`}
              >
                {/* Day Header */}
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-700">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm ${
                        isToday
                          ? 'bg-brand-primary-500 text-white shadow-sm shadow-brand-primary-500/30'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <Calendar size={16} />
                    </div>
                    <h3 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
                      {t(`days.${day.toLowerCase()}`, day)}
                      {isToday && (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-brand-primary-500 text-white">
                          {t('common.today', 'Today')}
                        </span>
                      )}
                    </h3>
                  </div>
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    {sortedEntries.length} {t('schedule.totalSlots', 'Sessions')}
                  </span>
                </div>

                {/* Day Sessions Timeline */}
                {sortedEntries.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center">
                    {t('schedule.noSlotsForDay', 'No sessions scheduled for this day')}
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {sortedEntries.map((entry) => renderEntryCard(entry, false))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      ) : (
        /* VIEW B: WEEKLY TIMETABLE GRID (WITH SMART CONFLICT COLLAPSING) */
        <div>
          {/* Mobile Day Selector */}
          <div className="flex gap-2 overflow-x-auto pb-4 md:hidden custom-scrollbar">
            {days.map((day) => {
              const isToday = day.toLowerCase() === todayDayName.toLowerCase();
              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  className={`flex-shrink-0 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-xs flex items-center gap-2 ${
                    selectedDay === day
                      ? 'bg-brand-primary-600 text-white shadow-brand-primary-600/20'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {isToday && <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />}
                  {t(`days.${day.toLowerCase()}`) || day.slice(0, 3)}
                </button>
              );
            })}
          </div>

          {/* Grid Container (Desktop & Tablet) */}
          <div className="hidden md:block">
            <Card className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden p-0">
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
                  {t(`days.${visibleDays[0]?.toLowerCase()}`)} - {t(`days.${visibleDays[visibleDays.length - 1]?.toLowerCase()}`)}
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
                  <table className="w-full border-collapse table-fixed">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700">
                        <th className="p-3.5 w-24 text-center text-xs font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">
                          <Clock size={13} className="inline me-1" />
                          {t('common.time', 'Time')}
                        </th>
                        {days.map((day) => {
                          const isToday = day.toLowerCase() === todayDayName.toLowerCase();
                          return (
                            <th
                              key={day}
                              className={`p-3.5 text-xs font-extrabold uppercase tracking-wider text-center ${
                                visibleDays.includes(day) ? 'table-cell lg:table-cell' : 'hidden lg:table-cell'
                              } ${
                                isToday
                                  ? 'bg-brand-primary-500/10 text-brand-primary-600 dark:text-brand-primary-400 border-b-2 border-b-brand-primary-500'
                                  : 'text-slate-700 dark:text-slate-200'
                              }`}
                            >
                              <div className="flex items-center justify-center gap-1.5">
                                {isToday && <span className="w-2 h-2 rounded-full bg-brand-primary-500 animate-ping" />}
                                <span>{t(`days.${day.toLowerCase()}`, day)}</span>
                                {isToday && (
                                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-brand-primary-500 text-white ms-1">
                                    {t('common.today', 'Today')}
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
                        <tr
                          key={time}
                          className="group hover:bg-slate-50/40 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="p-3 text-[11px] font-black text-slate-500 dark:text-slate-400 text-center bg-slate-50/50 dark:bg-slate-900/30 whitespace-nowrap border-e border-slate-200/60 dark:border-slate-700/60">
                            {formatTime(time)}
                          </td>
                          {days.map((day) => {
                            const entries = getEntriesForTimeSlot(day, time);
                            const isToday = day.toLowerCase() === todayDayName.toLowerCase();

                            return (
                              <td
                                key={`${day}-${time}`}
                                className={`p-2 align-top transition-colors relative group/cell border-e border-slate-200/40 dark:border-slate-700/40 h-28 max-h-36 ${
                                  visibleDays.includes(day) ? 'table-cell lg:table-cell' : 'hidden lg:table-cell'
                                } ${isToday ? 'bg-brand-primary-500/[0.02] dark:bg-brand-primary-500/[0.04]' : ''}`}
                              >
                                {entries.length === 0 ? (
                                  <div className="h-full flex items-center justify-center text-slate-300 dark:text-slate-600 select-none">
                                    <span className="text-xs opacity-40">—</span>
                                  </div>
                                ) : entries.length === 1 ? (
                                  /* Single Session Card */
                                  renderEntryCard(entries[0], true)
                                ) : (
                                  /* Multi-Session / Conflict Collapsed View */
                                  <div className="space-y-1.5">
                                    {/* Primary Session Card */}
                                    {renderEntryCard(entries[0], true)}

                                    {/* Conflict Warning Pill */}
                                    <button
                                      type="button"
                                      onClick={() => handleOpenConflictModal(day, time, entries)}
                                      className="w-full flex items-center justify-between px-2.5 py-1 rounded-xl bg-amber-500/15 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60 font-bold text-[10px] hover:bg-amber-500/25 transition-all shadow-xs cursor-pointer"
                                      title={t('schedule.viewAllSlots', 'View all overlapping sessions')}
                                    >
                                      <span className="flex items-center gap-1 truncate">
                                        <AlertTriangle size={12} className="shrink-0 text-amber-500" />
                                        <span>
                                          +{entries.length - 1} {t('schedule.conflictsDetected', 'Conflicts')}
                                        </span>
                                      </span>
                                      {isRTL ? <ChevronLeft size={13} /> : <ChevronRight size={13} />}
                                    </button>
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
                subtitle={t('schedule.noSlotsForDay', 'No sessions scheduled for this day')}
              />
            )}
          </div>
        </div>
      )}

      {/* Conflict Detail Modal */}
      <Modal
        isOpen={conflictModalOpen}
        onClose={() => setConflictModalOpen(false)}
        title={`${t('schedule.conflictModalTitle', 'Overlapping Sessions')}: ${
          activeConflictData ? `${t(`days.${activeConflictData.day.toLowerCase()}`, activeConflictData.day)} (${formatTime(activeConflictData.time)})` : ''
        }`}
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-xl text-amber-800 dark:text-amber-300 text-xs font-medium">
            <AlertTriangle size={18} className="shrink-0 mt-0.5 text-amber-500" />
            <p>{t('schedule.conflictModalDesc', 'Multiple sessions are scheduled concurrently at this time slot.')}</p>
          </div>

          <div className="space-y-2.5 max-h-[60vh] overflow-y-auto custom-scrollbar p-1">
            {activeConflictData?.entries.map((entry, idx) => (
              <div key={entry.id || idx} className="relative">
                {renderEntryCard(entry, false)}
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setConflictModalOpen(false)}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all"
            >
              {t('common.close', 'Close')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default ScheduleView;
