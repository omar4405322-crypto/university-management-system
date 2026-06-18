import React, { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, User, MapPin, X, Beaker, Users, MonitorPlay } from 'lucide-react';
import type { SlotEntry } from '../../types/timetable.types';

interface TimeSlotCellProps {
  /** Populated slot data, or null when the cell is empty. */
  entry: SlotEntry | null;
  day: string;
  slot: string;
  canEdit: boolean;
  onAdd: () => void;
  onDelete: (day: string, slot: string) => void;
  onEdit: (day: string, slot: string) => void;
}

/** Maps a sessionType to its Tailwind color classes. */
const SESSION_COLORS: Record<string, string> = {
  LAB: 'bg-green-50 border-green-200 dark:bg-green-900/10 dark:border-green-700/30',
  SEMINAR: 'bg-purple-50 border-purple-200 dark:bg-purple-900/10 dark:border-purple-700/30',
  LECTURE: 'bg-blue-50 border-blue-200 dark:bg-blue-900/10 dark:border-blue-700/30',
};

const SESSION_ICONS: Record<string, React.ReactNode> = {
  LAB: <Beaker size={10} />,
  SEMINAR: <Users size={10} />,
  LECTURE: <MonitorPlay size={10} />,
};

/**
 * Renders a single timetable grid cell.
 * Wrapped in React.memo so it only re-renders when its own props change —
 * clicking "delete" on one cell will not re-render all 30 sibling cells.
 * onDelete and onEdit are passed as stable references from the parent
 * (created with useCallback there) to avoid breaking memoization.
 */
const TimeSlotCell = memo(function TimeSlotCell({
  entry,
  day,
  slot,
  canEdit,
  onAdd,
  onDelete,
  onEdit,
}: TimeSlotCellProps) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language?.startsWith('ar');

  const handleDelete = useCallback(() => {
    onDelete(day, slot);
  }, [onDelete, day, slot]);

  const handleEdit = useCallback(() => {
    onEdit(day, slot);
  }, [onEdit, day, slot]);

  if (!entry) {
    return (
      <button
        onClick={onAdd}
        disabled={!canEdit}
        aria-label={t('timetable.addSlot', 'Add class slot')}
        className="w-full h-20 flex items-center justify-center text-brand-text-muted/30 hover:text-brand-primary-500 hover:bg-brand-primary-500/5 hover:border-brand-primary-500/30 border-2 border-dashed border-brand-border rounded-xl transition-all text-xl font-bold disabled:opacity-30 disabled:pointer-events-none"
      >
        <span className="text-2xl leading-none">+</span>
      </button>
    );
  }

  const colorClass = SESSION_COLORS[entry.sessionType] ?? SESSION_COLORS.LECTURE;
  const icon = SESSION_ICONS[entry.sessionType] ?? SESSION_ICONS.LECTURE;

  return (
    <div
      className={`rounded-xl p-3 text-xs space-y-2 border transition-all shadow-sm ${colorClass} relative group`}
    >
      {/* Delete button — only visible on hover */}
      <button
        onClick={handleDelete}
        aria-label={t('timetable.deleteSlot', 'Delete slot')}
        className={`absolute top-2 ${isRTL ? 'left-2' : 'right-2'} p-1 text-brand-text-muted hover:text-rose-500 bg-white/50 hover:bg-rose-50 dark:bg-rose-900/20 rounded-lg transition-all opacity-0 group-hover:opacity-100`}
      >
        <X size={14} />
      </button>

      {/* Course name */}
      <p
        className={`font-black text-brand-text-main tracking-tight line-clamp-2 ${isRTL ? 'pl-6' : 'pr-6'} flex items-start gap-1.5`}
      >
        <BookOpen size={14} className="mt-0.5 shrink-0 text-brand-primary-500" />
        {entry.courseName}
      </p>

      {/* Doctor */}
      <p className="font-bold text-brand-text-sub flex items-center gap-1.5">
        <User size={12} className="text-brand-text-muted shrink-0" />
        <span className="opacity-75 truncate">
          {entry.doctorName || t('common.staff', 'Staff')}
        </span>
      </p>

      {/* Room */}
      <p className="font-bold text-brand-text-muted flex items-center gap-1.5">
        <MapPin size={12} className="shrink-0" />
        <span className="uppercase tracking-wider truncate">
          {entry.room || t('common.tba', 'TBA')}
        </span>
      </p>

      {/* Footer: session type badge + edit */}
      <div className="pt-2 flex justify-between items-center border-t border-brand-border/40">
        <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-white/50 border border-brand-border/50 flex items-center gap-1">
          {icon}
          {t(
            `schedule.${(entry.sessionType ?? 'LECTURE').toLowerCase()}`,
            entry.sessionType ?? 'LECTURE'
          )}
        </span>
        <button
          onClick={handleEdit}
          className="text-brand-primary-500 hover:text-brand-primary-600 font-black text-[10px] uppercase tracking-wider transition-colors shrink-0"
        >
          {t('common.edit', 'Edit')}
        </button>
      </div>
    </div>
  );
});

export default TimeSlotCell;
