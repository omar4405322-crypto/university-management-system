// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { Calendar, Loader2, Filter } from 'lucide-react';
import schedulesService from '../../services/schedules.service';
import { Select } from '../../components/ui/Select';
import { logger } from '../../lib/logger';

const DAYS_EN = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];

const DAYS_AR = {
  Saturday: 'السبت',
  Sunday: 'الأحد',
  Monday: 'الاثنين',
  Tuesday: 'الثلاثاء',
  Wednesday: 'الأربعاء',
  Thursday: 'الخميس',
};

const DAY_COLORS = {
  Saturday: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700',
  Sunday: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-700',
  Monday: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700',
  Tuesday: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-700',
  Wednesday: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-700',
  Thursday: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700',
};

const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

const DoctorSchedule = () => {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith('ar');

  const [schedule, setSchedule] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter state
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedSemester, setSelectedSemester] = useState('');

  const fetchSchedule = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, unknown> = {};
      if (selectedYear) params.year = selectedYear;
      if (selectedSemester) params.semester = selectedSemester;
      const result = await schedulesService.getWeeklyTimetable(params);
      setSchedule(result?.data || result || {});
    } catch (err: any) {
      logger.error('Error fetching schedule:', err);
      setError(err.message || t('common.fetchError', 'Failed to load schedule'));
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedSemester]);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  const totalClasses = Object.values(schedule).reduce(
        (sum: number, day: Record<string, unknown>) => sum + (Array.isArray(day) ? day.length : 0),
    0
  );

  const selectClass = `
    appearance-none rounded-xl border border-slate-200 dark:border-slate-600
    bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200
    text-sm font-semibold px-4 py-2.5 pr-10 rtl:pr-4 rtl:pl-10
    focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400
    transition-all duration-200 cursor-pointer min-w-[160px]
  `;

  return (
    <div className="section-gap animate-in fade-in duration-700">
      {/* Header */}
      <div className="mb-6 p-5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
              <Calendar size={24} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-700 dark:text-slate-200">
                {t('schedule.doctorScheduleTitle')}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                {t('common.dr', 'Dr.')} {user?.firstName} {user?.lastName} —{' '}
                {t('schedule.doctorScheduleSubtitle')}: {loading ? '...' : totalClasses}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="mb-6 p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <Filter size={16} />
            <span className="text-xs font-bold uppercase tracking-widest">
              {t('common.filters', 'Filters')}
            </span>
          </div>

          <div className="flex items-center gap-3 flex-wrap flex-1">
            {/* Academic Year */}
            <div className="relative">
              <Select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className={selectClass}
              >
                <option value="">{t('schedule.academicYear')}</option>
                {yearOptions.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </Select>
              <div className="pointer-events-none absolute inset-y-0 right-3 rtl:right-auto rtl:left-3 flex items-center">
                <svg
                  className="h-4 w-4 text-slate-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
            </div>

            {/* Semester */}
            <div className="relative">
              <Select
                value={selectedSemester}
                onChange={(e) => setSelectedSemester(e.target.value)}
                className={selectClass}
              >
                <option value="">{t('schedule.allSemesters')}</option>
                <option value="1">{t('schedule.semester1')}</option>
                <option value="2">{t('schedule.semester2')}</option>
              </Select>
              <div className="pointer-events-none absolute inset-y-0 right-3 rtl:right-auto rtl:left-3 flex items-center">
                <svg
                  className="h-4 w-4 text-slate-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
            </div>

            {/* Reset */}
            {(selectedYear || selectedSemester) && (
              <button
                onClick={() => {
                  setSelectedYear('');
                  setSelectedSemester('');
                }}
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 uppercase tracking-widest transition-colors"
              >
                {t('common.resetFilters', 'Reset')}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center h-64">
          <Loader2 size={32} className="animate-spin text-blue-500" />
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="text-center py-16">
          <p className="text-red-500 font-medium mb-3">{error}</p>
          <button
            onClick={fetchSchedule}
            className="text-sm font-bold text-blue-600 dark:text-blue-400 hover:underline"
          >
            {t('common.retry', 'Retry')}
          </button>
        </div>
      )}

      {/* No schedule */}
      {!loading && !error && totalClasses === 0 && (
        <div className="text-center py-16 text-slate-400 dark:text-slate-500">
          <p className="text-5xl mb-4">📅</p>
          <p className="text-lg font-medium">{t('schedule.noSchedule')}</p>
        </div>
      )}

      {/* Schedule Grid */}
      {!loading && !error && Number(totalClasses) > 0 && (
        <div className="grid gap-4">
          {DAYS_EN.map((eng) => {
            const entries = schedule[eng] || [];
            if (entries.length === 0) return null;
            return (
              <div key={eng} className={`rounded-2xl border p-4 ${DAY_COLORS[eng]}`}>
                <h3 className="font-bold text-slate-700 dark:text-slate-200 mb-3 text-lg">
                  {isAr ? DAYS_AR[eng] : eng}
                </h3>
                <div className="grid gap-2">
                  {entries.map((entry, i) => (
                    <div
                      key={i}
                      className="bg-white dark:bg-slate-800 rounded-xl p-3 flex flex-col md:flex-row md:items-center gap-2 shadow-sm"
                    >
                      <span className="text-blue-600 dark:text-blue-400 font-bold text-sm min-w-[120px]">
                        {entry.startTime} - {entry.endTime}
                      </span>
                      <span className="font-semibold text-slate-700 dark:text-slate-200 flex-1">
                        {entry.course?.name || entry.courseName}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400 text-sm">
                        {entry.room || t('schedule.noRoom')}
                      </span>
                      <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-1 rounded-lg">
                        {entry.course?.department?.name || ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DoctorSchedule;
