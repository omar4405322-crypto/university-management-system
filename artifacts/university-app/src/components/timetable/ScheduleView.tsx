import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Card from '../ui/card';
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
  viewMode?: 'grid' | 'agenda';
  onViewModeChange?: (mode: 'grid' | 'agenda') => void;
}

interface SlotCellProps {
  day: string;
  time: string;
  entries: any[];
  isToday: boolean;
  isVisible: boolean;
  canManage: boolean;
  onAddSlot?: (day: string, time: string) => void;
  renderEntryCard: (entry: any, isCompact?: boolean) => React.ReactNode;
  hasRealConflict: (entries: any[]) => boolean;
  onOpenConflictModal: (day: string, time: string, entries: any[]) => void;
  t: any;
  isRTL: boolean;
}

function SlotCell({
  day,
  time,
  entries,
  isToday,
  isVisible,
  canManage,
  onAddSlot,
  renderEntryCard,
  hasRealConflict,
  onOpenConflictModal,
  t,
  isRTL,
}: SlotCellProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const safeIndex = currentIndex < entries.length ? currentIndex : 0;
  const isMulti = entries.length > 1;
  const isConflicted = hasRealConflict(entries);
  const currentEntry = entries[safeIndex];

  return (
    <td
      className={`p-2 align-top transition-colors relative group/cell border-e border-slate-200/40 dark:border-slate-700/40 min-h-[140px] ${
        isVisible ? 'table-cell lg:table-cell' : 'hidden lg:table-cell'
      } ${isToday ? 'bg-brand-primary-500/[0.02] dark:bg-brand-primary-500/[0.04]' : ''}`}
    >
      {entries.length === 0 ? (
        <>
          <div className="h-full min-h-[110px] flex items-center justify-center text-slate-300 dark:text-slate-600 select-none">
            <span className="text-xs opacity-40">—</span>
          </div>
          {canManage && (
            <button
              onClick={() => onAddSlot?.(day, time)}
              className="absolute inset-1 m-1 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl flex items-center justify-center text-slate-400 
              opacity-100 hover:opacity-100 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-brand-primary-400 hover:text-brand-primary-500
              [@media(hover:hover)and(pointer:fine)]:opacity-0 [@media(hover:hover)and(pointer:fine)]:group-hover/cell:opacity-100 transition-all duration-200"
            >
              <Plus size={20} />
            </button>
          )}
        </>
      ) : (
        <div className="space-y-1.5 flex flex-col h-full justify-between">
          {/* Multi-Session Navigator Bar */}
          {isMulti && (
            <div className="flex items-center justify-between gap-1 px-2 py-1 rounded-xl bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 text-[10px] font-bold shadow-2xs">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex((prev) => (prev > 0 ? prev - 1 : entries.length - 1));
                }}
                className="w-5 h-5 flex items-center justify-center rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-all cursor-pointer shadow-2xs"
                title={isRTL ? 'المحاضرة السابقة' : 'Previous session'}
              >
                {isRTL ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenConflictModal(day, time, entries);
                }}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded-lg font-black text-[10px] transition-all hover:opacity-80 cursor-pointer ${
                  isConflicted
                    ? 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50'
                    : 'text-brand-primary-600 dark:text-brand-primary-400 bg-brand-primary-50 dark:bg-brand-primary-950/50'
                }`}
                title={isRTL ? 'انقر لعرض القائمة الشاملة' : 'Click to view full list'}
              >
                {isConflicted ? (
                  <AlertTriangle size={11} className="shrink-0 text-rose-500" />
                ) : (
                  <Layers size={11} className="shrink-0 text-brand-primary-500" />
                )}
                <span>
                  {safeIndex + 1} / {entries.length}
                </span>
                <span className="text-[9px] font-semibold opacity-75 ms-0.5">
                  {isConflicted ? (isRTL ? 'تعارض' : 'Conflict') : (isRTL ? 'متزامنة' : 'Parallel')}
                </span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex((prev) => (prev < entries.length - 1 ? prev + 1 : 0));
                }}
                className="w-5 h-5 flex items-center justify-center rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-all cursor-pointer shadow-2xs"
                title={isRTL ? 'المحاضرة التالية' : 'Next session'}
              >
                {isRTL ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
              </button>
            </div>
          )}

          {/* Conflict Alert Banner if non-multi collision */}
          {isConflicted && !isMulti && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-xl bg-rose-500/15 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-700/60 font-bold text-[10px] shadow-2xs">
              <AlertTriangle size={11} className="shrink-0 text-rose-500" />
              <span className="truncate">{t('schedule.conflictsDetected', 'Conflict Detected')}</span>
            </div>
          )}

          {/* Active Card */}
          <div key={currentEntry?.id || `${day}_${time}_${safeIndex}`} className="animate-in fade-in duration-150 flex-1">
            {renderEntryCard(currentEntry, isMulti)}
          </div>

          {/* Dot Pagination indicators if <= 6 sessions */}
          {isMulti && entries.length <= 6 && (
            <div className="flex items-center justify-center gap-1 pt-0.5">
              {entries.map((_, dotIdx) => (
                <button
                  key={dotIdx}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentIndex(dotIdx);
                  }}
                  className={`h-1.5 rounded-full transition-all cursor-pointer ${
                    dotIdx === safeIndex
                      ? 'w-3.5 bg-brand-primary-500'
                      : 'w-1.5 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </td>
  );
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
  viewMode,
  onViewModeChange,
}: ScheduleViewProps) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language?.startsWith('ar');

  // Internal View Mode state if not controlled externally
  const [internalViewMode, setInternalViewMode] = useState<'grid' | 'agenda'>('grid');
  const currentViewMode = viewMode !== undefined ? viewMode : internalViewMode;
  const setScheduleViewMode = onViewModeChange || setInternalViewMode;

  // Conflict / Multi-Session Modal State
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [activeConflictData, setActiveConflictData] = useState<{
    day: string;
    time: string;
    entries: any[];
    isConflicted: boolean;
  } | null>(null);

  const hasRealConflict = (slots: any[]): boolean => {
    if (!slots || slots.length <= 1) return false;
    for (let i = 0; i < slots.length; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        const s1 = slots[i];
        const s2 = slots[j];

        // 1. Same Room Collision
        if (s1.room && s2.room && String(s1.room).trim() && String(s2.room).trim()) {
          if (String(s1.room).trim().toLowerCase() === String(s2.room).trim().toLowerCase()) {
            return true;
          }
        }

        // 2. Same Doctor Collision
        const doc1 = String(s1.doctorId || s1.doctor?.id || '').trim();
        const doc2 = String(s2.doctorId || s2.doctor?.id || '').trim();
        if (doc1 && doc2 && doc1 === doc2) {
          return true;
        }

        // 3. Same TA Collision
        const ta1 = String(s1.teachingAssistantId || s1.teachingAssistant?.id || '').trim();
        const ta2 = String(s2.teachingAssistantId || s2.teachingAssistant?.id || '').trim();
        if (ta1 && ta2 && ta1 === ta2) {
          return true;
        }

        // 4. Same Group Collision
        const g1 = String(s1.groupId || s1.group?.id || '').trim();
        const g2 = String(s2.groupId || s2.group?.id || '').trim();
        if (g1 && g2 && g1 === g2) {
          return true;
        }
      }
    }
    return false;
  };

  const getEntriesForTimeSlot = (day: string, time: string) => {
    if (!timetable || !timetable[day]) return [];
    return timetable[day].filter((s) => {
      const startHour = parseInt(s.startTime?.split(':')[0] || '0', 10);
      const currentHour = parseInt(time?.split(':')[0] || '0', 10);
      return startHour === currentHour;
    });
  };

  // Open Multi-Session / Conflict Detail Modal
  const handleOpenConflictModal = (day: string, time: string, entries: any[]) => {
    const isConflicted = hasRealConflict(entries);
    setActiveConflictData({ day, time, entries, isConflicted });
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

        {/* Instructor Name Display based on Role */}
        {role === 'TA' ? (
          (entry.teachingAssistant || entry.teachingAssistantName) && (
            <div className="mt-1.5 flex items-center gap-1 text-[11px] font-bold text-purple-700 dark:text-purple-300">
              <User size={11} className="text-purple-500 shrink-0" />
              <span className="truncate">
                {entry.teachingAssistant
                  ? `${entry.teachingAssistant.firstName || ''} ${entry.teachingAssistant.lastName || ''}`.trim()
                  : entry.teachingAssistantName}
              </span>
            </div>
          )
        ) : (
          docName && (
            <div className="mt-1.5 flex items-center gap-1 text-[11px] font-bold text-slate-700 dark:text-slate-300">
              <User size={11} className="text-brand-primary-500 shrink-0" />
              <span className="truncate">{docName}</span>
            </div>
          )
        )}

        {/* Group Badge */}
        {entry.group?.name && (
          <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-200/70 dark:bg-slate-700/70 text-[10px] font-bold text-slate-700 dark:text-slate-300">
            <span>{t('common.group', 'Group:')}</span>
            <span className="text-brand-primary-600 dark:text-brand-primary-400">{entry.group.name}</span>
          </div>
        )}

        {/* Hall & Secondary Instructor footer */}
        <div className="mt-2 pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-[10px] text-slate-600 dark:text-slate-300 font-semibold gap-2">
          <div className="flex items-center gap-1 truncate">
            <MapPin size={11} className="text-amber-500 shrink-0" />
            <span className="truncate">{entry.room || t('common.tba', 'TBA')}</span>
          </div>
          {role === 'TA' ? (
            docName ? (
              <div className="flex items-center gap-1 truncate text-slate-500 dark:text-slate-400 text-[10px]">
                <span className="truncate">{docName}</span>
              </div>
            ) : null
          ) : (
            entry.teachingAssistant && (
              <div className="flex items-center gap-1 truncate text-purple-600 dark:text-purple-300 text-[10px]">
                <span className="truncate">
                  {t('schedule.ta', 'TA:')} {entry.teachingAssistant.firstName} {entry.teachingAssistant.lastName}
                </span>
              </div>
            )
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Top Controls: View Switcher (Only shown if not controlled externally in parent toolbar) */}
      {viewMode === undefined && (
        <div className="flex items-center justify-between flex-wrap gap-3 pb-1">
          <div className="flex items-center gap-2">
            <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700 shadow-xs">
              <button
                type="button"
                onClick={() => setScheduleViewMode('grid')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  currentViewMode === 'grid'
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
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  currentViewMode === 'agenda'
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
      )}

      {/* VIEW A: AGENDA / DAILY LIST VIEW */}
      {currentViewMode === 'agenda' ? (
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
                              const isVisible = visibleDays.includes(day);

                              return (
                                <SlotCell
                                  key={`${day}-${time}`}
                                  day={day}
                                  time={time}
                                  entries={entries}
                                  isToday={isToday}
                                  isVisible={isVisible}
                                  canManage={canManage}
                                  onAddSlot={onAddSlot}
                                  renderEntryCard={renderEntryCard}
                                  hasRealConflict={hasRealConflict}
                                  onOpenConflictModal={handleOpenConflictModal}
                                  t={t}
                                  isRTL={isRTL}
                                />
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

      {/* Conflict / Parallel Sessions Detail Modal */}
      <Modal
        isOpen={conflictModalOpen}
        onClose={() => setConflictModalOpen(false)}
        title={`${
          activeConflictData?.isConflicted
            ? isRTL
              ? 'تعارض في المواعيد'
              : t('schedule.conflictModalTitle', 'Schedule Conflict')
            : isRTL
            ? 'المحاضرات المتزامنة في هذا الموعد'
            : 'Parallel Sessions'
        }: ${
          activeConflictData
            ? `${t(`days.${activeConflictData.day.toLowerCase()}`, activeConflictData.day)} (${formatTime(
                activeConflictData.time
              )})`
            : ''
        }`}
      >
        <div className="space-y-4">
          {activeConflictData?.isConflicted ? (
            <div className="flex items-start gap-3 p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/40 rounded-xl text-rose-800 dark:text-rose-300 text-xs font-medium">
              <AlertTriangle size={18} className="shrink-0 mt-0.5 text-rose-500" />
              <p>
                {isRTL
                  ? 'تم رصد تعارض في المواعيد: توجد جلسات تشترك في نفس القاعة أو لنفس المحاضر في نفس التوقيت.'
                  : t('schedule.conflictModalDesc', 'Overlapping sessions detected for the same room or instructor.')}
              </p>
            </div>
          ) : (
            <div className="flex items-start gap-3 p-3 bg-brand-primary-500/10 dark:bg-brand-primary-900/20 border border-brand-primary-500/20 dark:border-brand-primary-800/40 rounded-xl text-brand-primary-800 dark:text-brand-primary-300 text-xs font-medium">
              <Layers size={18} className="shrink-0 mt-0.5 text-brand-primary-500" />
              <p>
                {isRTL
                  ? 'توجد عدة محاضرات متزامنة بنجاح في قاعات مختلفة ومع أساتذة مختلفين في نفس التوقيت.'
                  : 'Multiple concurrent sessions running in different lecture halls with different instructors.'}
              </p>
            </div>
          )}

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
              className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
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
