import React from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Printer, ShieldAlert } from 'lucide-react';
import type { Department, TimetableFilters, College } from '../../types/timetable.types';

const YEARS = ['1', '2', '3', '4', '5'] as const;
const SEMS = ['1', '2', '3'] as const;

interface TimetableFiltersBarProps {
  filters: TimetableFilters;
  departments: Department[];
  colleges: College[];
  loadingColleges: boolean;
  isCollegeAdmin: boolean;
  loadingDepts: boolean;
  isDeptAdminLocked: boolean;
  saving: boolean;
  loadingSlots: boolean;
  auditingConflicts?: boolean;
  onChange: (next: TimetableFilters) => void;
  onSave: () => void;
  onAuditConflicts?: () => void;
}

const SELECT_CLASS =
  'h-11 px-4 bg-brand-bg-card border border-brand-border rounded-xl text-sm font-semibold text-brand-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 focus:border-brand-primary-500 transition-all appearance-none cursor-pointer disabled:opacity-50';

/**
 * Renders the filter bar (department selector, year picker, semester picker)
 * and the Print / Audit Conflicts / Save action buttons that sit above the timetable grid.
 * All label strings come from the i18n layer via t().
 */
export default function TimetableFiltersBar({
  filters,
  colleges = [],
  departments,
  loadingColleges,
  isCollegeAdmin,
  loadingDepts,
  isDeptAdminLocked,
  saving,
  loadingSlots,
  auditingConflicts = false,
  onChange,
  onSave,
  onAuditConflicts,
}: TimetableFiltersBarProps) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language?.startsWith('ar');

  const update = (field: keyof TimetableFilters, value: string) => {
    if (field === 'collegeId') {
      onChange({ ...filters, collegeId: value, departmentId: '' });
    } else {
      onChange({ ...filters, [field]: value });
    }
  };

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 flex-wrap">
      {/* ── Selects ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 flex-wrap flex-1">
        {!isCollegeAdmin && (
          <select
            className={`w-full md:w-56 ${SELECT_CLASS}`}
            value={filters.collegeId || ''}
            onChange={(e) => update('collegeId', e.target.value)}
            aria-label={t('timetables.selectCollege', 'Select College')}
          >
            <option value="">
              {loadingColleges
                ? t('common.loading', 'Loading...')
                : t('timetables.selectCollege', 'All Colleges')}
            </option>
            {colleges.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {isRTL ? c.nameAr || c.name : c.name}
              </option>
            ))}
          </select>
        )}

        {/* Department */}
        <select
          className={`w-full md:w-56 ${SELECT_CLASS}`}
          value={filters.departmentId}
          onChange={(e) => update('departmentId', e.target.value)}
          disabled={isDeptAdminLocked || (!isCollegeAdmin && !filters.collegeId)}
          aria-label={t('timetables.selectDept', 'Select Department')}
        >
          <option value="">
            {loadingDepts
              ? t('common.loading', 'Loading...')
              : t('timetables.selectDept', 'Select Department')}
          </option>
          {departments.map((d) => (
            <option key={d.id} value={String(d.id)}>
              {isRTL ? d.nameAr || d.name : d.name}
            </option>
          ))}
        </select>

        {/* Academic Year */}
        <select
          className={`w-full md:w-44 ${SELECT_CLASS}`}
          value={filters.academicYear}
          onChange={(e) => update('academicYear', e.target.value)}
          aria-label={t('timetables.academicYear', 'Academic Year')}
        >
          {YEARS.map((y) => (
            <option key={y} value={y}>
              {t(`students.year${y}`, t(`common.YEAR${y}`, `${t('common.year', 'Year')} ${y}`))}
            </option>
          ))}
        </select>

        {/* Semester */}
        <select
          className={`w-full md:w-36 ${SELECT_CLASS}`}
          value={filters.semester}
          onChange={(e) => update('semester', e.target.value)}
          aria-label={t('timetables.semester', 'Semester')}
        >
          {SEMS.map((s) => (
            <option key={s} value={s}>
              {t(`schedule.semester${s}`, s === '3' ? 'Summer Semester' : `Semester ${s}`)}
            </option>
          ))}
        </select>
      </div>

      {/* ── Actions ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        {onAuditConflicts && (
          <button
            onClick={onAuditConflicts}
            disabled={auditingConflicts || loadingSlots}
            aria-label={t('timetable.auditConflicts', 'Audit Conflicts')}
            className="print:hidden px-4 py-2.5 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/60 border border-amber-300 dark:border-amber-700/60 text-amber-800 dark:text-amber-300 font-bold text-xs rounded-xl transition-all flex items-center gap-2 shadow-sm"
          >
            {auditingConflicts ? (
              <Loader2 size={16} className="animate-spin text-amber-600 dark:text-amber-400" />
            ) : (
              <ShieldAlert size={16} className="text-amber-600 dark:text-amber-400" />
            )}
            {t('timetable.auditConflicts', 'فحص التعارضات')}
          </button>
        )}

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
