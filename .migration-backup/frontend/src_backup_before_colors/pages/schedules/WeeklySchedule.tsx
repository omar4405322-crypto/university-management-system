// @ts-nocheck
import React, { useState, useEffect } from 'react';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import {
  Clock,
  MapPin,
  User,
  ChevronLeft,
  ChevronRight,
  Calendar,
  AlertCircle,
  FileText,
  Building2,
  GraduationCap,
  Printer,
} from 'lucide-react';
import schedulesService from '../../services/schedules.service';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { PageHeader } from '../../components/ui/PageHeader';
import { SkeletonTable } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { logger } from '../../lib/logger';

const WeeklySchedule = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [timetable, setTimetable] = useState(null);
  const [error, setError] = useState(null);

  const isRTL = i18n.language === 'ar';
  const days = isRTL
    ? ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
    : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const [selectedDay, setSelectedDay] = useState(days[0]);

  // Update selected day if days array order changes due to language
  useEffect(() => {
    setSelectedDay(days[0]);
  }, [i18n.language]);

  const times = [
    '08:00',
    '09:00',
    '10:00',
    '11:00',
    '12:00',
    '13:00',
    '14:00',
    '15:00',
    '16:00',
    '17:00',
  ];

  useEffect(() => {
    fetchTargetedTimetable();
  }, []);

  const fetchTargetedTimetable = async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await schedulesService.getWeeklyTimetable();
      if (result.success && result.data) {
        setTimetable(result.data);
      } else {
        setTimetable(null);
      }
    } catch (err: any) {
      logger.error('Error fetching timetable:', err);
      setError(t('common.errorFetching'));
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? t('common.pm') || 'PM' : t('common.am') || 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getEntriesForTimeSlot = (day, time) => {
    if (!timetable || !timetable[day]) return [];

    return timetable[day].filter((s) => {
      const startHour = parseInt(s.startTime.split(':')[0]);
      const currentHour = parseInt(time.split(':')[0]);
      return startHour === currentHour;
    });
  };

  if (loading) {
    return <SkeletonTable rows={7} />;
  }

  if (error) {
    return (
      <div className="space-y-6 animate-in fade-in duration-700 pb-10">
        <PageHeader
          title={t('timetables.title')}
          subtitle={t('timetables.subtitle')}
          action={{
            label: t('common.print', 'Print'),
            icon: Printer,
            onClick: () => window.print(),
          }}
        />
        <Card className="flex flex-col items-center justify-center py-20 text-center border-l-0">
          <div className="h-20 w-20 rounded-full bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center mb-6 border border-rose-200 dark:border-rose-700">
            <AlertCircle size={40} className="text-rose-500" />
          </div>
          <h3 className="text-2xl font-black text-brand-text-main">{error}</h3>
          <button
            onClick={fetchTargetedTimetable}
            className="mt-4 px-6 py-2.5 rounded-xl bg-brand-primary-500 text-white font-black text-xs uppercase tracking-widest hover:opacity-90 transition-opacity"
          >
            {t('common.retry', 'Retry')}
          </button>
        </Card>
      </div>
    );
  }

  if (!timetable || Object.keys(timetable).length === 0) {
    return (
      <div className="space-y-6 animate-in fade-in duration-700">
        <PageHeader
          title={t('timetables.title')}
          subtitle={t('timetables.subtitle')}
          action={{
            label: t('common.print', 'Print'),
            icon: Printer,
            onClick: () => window.print(),
          }}
        />

        <Card className="flex flex-col items-center justify-center py-20 text-center border-l-0">
          <div className="h-20 w-20 rounded-full bg-brand-yellow/10 flex items-center justify-center mb-6 border border-brand-yellow/20">
            <Calendar size={40} className="text-brand-yellow" />
          </div>
          <h3 className="text-2xl font-black text-brand-text-main">{t('common.noData')}</h3>
          <p className="text-brand-text-sub font-bold mt-2 max-w-md mx-auto">
            {t('timetables.noSlots')}
          </p>
        </Card>
      </div>
    );
  }

  // Extract metadata from first available schedule entry
  const firstEntry = Object.values(timetable).flat().find(Boolean);
    const departmentName = (firstEntry as unknown as Record<string, unknown>)?.course?.department
    ?.name;
    const academicYear = (firstEntry as unknown as Record<string, unknown>)?.course?.year;
    const semester = (firstEntry as unknown as Record<string, unknown>)?.course?.semester;
    const collegeName = (firstEntry as unknown as Record<string, unknown>)?.course?.department
    ?.college?.name;

  return (
    <div className="section-gap animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex flex-col gap-2">
          {/* Use department name as the primary title if available */}
          <h1 className="text-3xl font-black text-brand-text-main tracking-tight">
            {departmentName ? `${departmentName} - ` : ''}
            {t('timetables.title')}
          </h1>
          <div className="flex flex-wrap items-center gap-3">
            {academicYear && (
              <Badge variant="info" className="font-black uppercase tracking-widest">
                {t('auth.year')} {academicYear}
              </Badge>
            )}
            {semester && (
              <Badge variant="neutral" className="font-black uppercase tracking-widest">
                {t('timetables.semester')} {semester}
              </Badge>
            )}
            {collegeName && (
              <>
                <span className="text-brand-text-muted hidden md:inline">•</span>
                <div className="flex items-center gap-1.5 text-xs font-bold text-brand-text-sub">
                  <Building2 size={14} /> {collegeName}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 p-4 bg-brand-navy text-white rounded-2xl shadow-xl">
          <Calendar size={24} className="text-brand-green" />
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-brand-gray/60">
              {t('common.today')}
            </p>
            <p className="text-sm font-black">
              {new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>
      </div>

      {/* Mobile Day Selector */}
      <div className="flex gap-2 overflow-x-auto pb-4 md:hidden custom-scrollbar">
        {days.map((day) => (
          <button
            key={day}
            onClick={() => setSelectedDay(day)}
            className={`flex-shrink-0 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-sm ${
              selectedDay === day
                ? 'bg-brand-primary-500 text-white shadow-brand-primary-500/20'
                : 'bg-surface-subtle text-brand-text-secondary hover:bg-brand-primary-500/10'
            }`}
          >
            {t(`days.${day.toLowerCase()}`) || day.slice(0, 3)}
          </button>
        ))}
      </div>

      {/* Desktop View */}
      <div className="hidden md:block">
        <Card noPadding className="overflow-hidden border-l-0 shadow-soft">
          <div className="overflow-x-auto">
            <div className="min-w-[1000px]">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-brand-navy/5 border-b border-brand-border">
                    <th className="p-4 w-24 border-r border-brand-border"></th>
                    {days.map((day) => (
                      <th
                        key={day}
                        className="p-4 text-xs font-black text-brand-text-main uppercase tracking-widest border-r border-brand-border last:border-r-0"
                      >
                        {t(`days.${day.toLowerCase()}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border">
                  {times.map((time) => (
                    <tr key={time} className="group">
                      <td className="p-4 text-[10px] font-black text-brand-text-muted text-center bg-brand-navy/[0.02] border-r border-brand-border">
                        {formatTime(time)}
                      </td>
                      {days.map((day) => {
                        const entries = getEntriesForTimeSlot(day, time);
                        return (
                          <td
                            key={`${day}-${time}`}
                            className="p-2 border-r border-brand-border last:border-r-0 align-top group-hover:bg-brand-navy/[0.01] transition-colors"
                          >
                            {entries.length > 0 ? (
                              <div className="space-y-2">
                                {entries.map((entry, idx) => (
                                  <div
                                    key={idx}
                                    className="rounded-2xl p-4 border border-brand-border shadow-sm transition-all hover:shadow-lg hover:scale-[1.02] bg-brand-bg-card dark:bg-brand-bg-elevated group/entry"
                                  >
                                    <div className="flex justify-between items-start mb-2">
                                      <Badge
                                        variant="info"
                                        className="text-[9px] font-black px-2 py-0.5"
                                      >
                                        {entry.startTime} - {entry.endTime}
                                      </Badge>
                                    </div>
                                    <p className="text-sm font-black text-brand-text-main leading-tight group-hover/entry:text-brand-green transition-colors">
                                      {entry.course?.name}
                                    </p>
                                    <div className="mt-3 space-y-2">
                                      <div className="flex items-center gap-2 text-[10px] font-bold text-brand-text-sub">
                                        <div className="p-1 bg-brand-navy/5 rounded-md">
                                          <MapPin size={10} />
                                        </div>
                                        {entry.room || t('common.tba', 'TBA')}
                                      </div>
                                      <div className="flex items-center gap-2 text-[10px] font-bold text-brand-text-sub">
                                        <div className="p-1 bg-brand-navy/5 rounded-md">
                                          <User size={10} />
                                        </div>
                                        {entry.course?.doctor
                                          ? `${entry.course.doctor.firstName} ${entry.course.doctor.lastName}`
                                          : t('common.staff', 'Staff')}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="h-20 rounded-2xl border border-dashed border-brand-border/50 flex items-center justify-center opacity-30 hover:opacity-60 transition-opacity">
                                <span className="label-stat">{t('common.noData')}</span>
                              </div>
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

      {/* Mobile View */}
      <div className="md:hidden space-y-4">
        <p className="text-[10px] font-black uppercase text-brand-text-muted text-center tracking-widest animate-pulse">
          {t('schedule.swipeHint', 'Swipe to see other days')}
        </p>
        {times.flatMap((time) => getEntriesForTimeSlot(selectedDay, time)).length > 0 ? (
          times
            .flatMap((time) => getEntriesForTimeSlot(selectedDay, time))
            .map((entry, idx) => (
              <Card
                key={idx}
                className="p-5 border-l-4 border-l-brand-primary-500 shadow-soft animate-in slide-in-from-bottom-2 duration-300"
              >
                <div className="flex justify-between items-start mb-4">
                  <Badge variant="info" className="text-[10px] font-black px-3 py-1">
                    {entry.startTime} - {entry.endTime}
                  </Badge>
                  <div className="flex items-center gap-1.5 text-[10px] font-black text-brand-text-muted bg-surface-subtle px-2 py-1 rounded-lg">
                    <MapPin size={12} className="text-brand-primary-500" />
                    {entry.room || t('common.tba', 'TBA')}
                  </div>
                </div>

                <h3 className="text-lg font-black text-brand-text-main leading-tight mb-4">
                  {entry.course?.name}
                </h3>

                <div className="pt-4 border-t border-brand-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-brand-navy/5 flex items-center justify-center">
                      <User size={14} className="text-brand-navy" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-brand-text-muted uppercase tracking-widest">
                        {t('courses.instructor')}
                      </span>
                      <span className="text-xs font-bold text-brand-text-main">
                        {entry.course?.doctor
                          ? `${entry.course.doctor.firstName} ${entry.course.doctor.lastName}`
                          : t('common.staff', 'Staff')}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            ))
        ) : (
          <EmptyState
            icon={<Calendar size={40} />}
            title={t('common.noData')}
            subtitle={t('timetables.noSlots')}
          />
        )}
      </div>
    </div>
  );
};

export default WeeklySchedule;
