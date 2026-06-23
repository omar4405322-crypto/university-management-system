import React from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Printer } from 'lucide-react';
import type { Department, TimetableFilters } from '../../types/timetable.types';
import { Select } from '../../components/ui/Select';

const YEARS = ['1', '2', '3', '4', '5'] as const;
const SEMS = ['1', '2'] as const;

interface TimetableFiltersBarProps {
  filters: TimetableFilters;
  departments: Department[];
  loadingDepts: boolean;
  isDeptAdminLocked: boolean;
  saving: boolean;
  loadingSlots: boolean;
  onChange: (next: TimetableFilters) => void;
  onSave: () => void;
}

const SELECT_CLASS =
  'h-11 px-4 bg-brand-bg-card border border-brand-border rounded-xl text-sm font-semibold text-brand-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 focus:border-brand-primary-500 transition-all appearance-none cursor-pointer disabled:opacity-50';

/**
 * Renders the filter bar (department selector, year picker, semester picker)
 * and the Print / Save action buttons that sit above the timetable grid.
 * All label strings come from the i18n layer via t().
 */
export default function TimetableFiltersBar({
  filters,
  departments,
  loadingDepts,
  isDeptAdminLocked,
  saving,
  loadingSlots,
  onChange,
  onSave,
}: TimetableFiltersBarProps) {
  const { t } = useTranslation();

  const update = (field: keyof TimetableFilters, value: string) => {
    onChange({ ...filters, [field]: value });
  };

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 flex-wrap">
      {/* ── Selects ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 flex-wrap flex-1">
        {/* Department */}
        <Select
          className={`w-full md:w-56 ${SELECT_CLASS}`}
          value={filters.departmentId}
          onChange={(e) => update('departmentId', e.target.value)}
          disabled={isDeptAdminLocked}
          aria-label={t('timetables.selectDept', 'Select Department')}
        >
          <option value="">
            {loadingDepts
              ? t('common.loading', 'Loading...')
              : t('timetables.selectDept', 'Select Department')}
          </option>
          {departments.map((d) => (
            <option key={d.id} value={String(d.id)}>
              {d.name}
            </option>
          ))}
        </Select>

        {/* Academic Year */}
        <Select
          className={`w-full md:w-36 ${SELECT_CLASS}`}
          value={filters.academicYear}
          onChange={(e) => update('academicYear', e.target.value)}
          aria-label={t('timetables.academicYear', 'Academic Year')}
        >
          {YEARS.map((y) => (
            <option key={y} value={y}>
              {t('common.year', 'Year')} {y}
            </option>
          ))}
        </Select>

        {/* Semester */}
        <Select
          className={`w-full md:w-36 ${SELECT_CLASS}`}
          value={filters.semester}
          onChange={(e) => update('semester', e.target.value)}
          aria-label={t('timetables.semester', 'Semester')}
        >
          {SEMS.map((s) => (
            <option key={s} value={s}>
              {t('timetables.semester', 'Semester')} {s}
            </option>
          ))}
        </Select>
      </div>

      {/* ── Actions ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => window.print()}
          aria-label={t('common.print', 'Print')}
          className="print:hidden px-4 py-2.5 bg-brand-bg-card hover:bg-surface-subtle border border-brand-border text-brand-text-primary font-black text-xs uppercase tracking-widest rounded-xl transition-all flex items-center gap-2"
        >
          <Printer size={16} />
          {t('common.print', 'Print')}
        </button>

        <button
          onClick={onSave}
          disabled={saving || loadingSlots}
          aria-label={t('common.save', 'Save Timetable')}
          className="print:hidden px-6 py-2.5 bg-brand-primary-500 hover:bg-brand-primary-600 disabled:opacity-50 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-md flex items-center gap-2"
        >
          {saving && <Loader2 size={16} className="animate-spin" />}
          {t('common.save', 'Save Timetable')}
        </button>
      </div>
    </div>
  );
}
