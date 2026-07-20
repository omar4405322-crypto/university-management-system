// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { generateHourlyTimes } from '../../utils/scheduleConfig';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import {
  Clock,
  MapPin,
  User,
  Calendar,
  AlertCircle,
  Building2,
  Printer,
  BookOpen,
  Layers
} from 'lucide-react';
import schedulesService from '../../services/schedules.service';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { PageHeader } from '../../components/ui/PageHeader';
import { SkeletonTable } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { logger } from '../../lib/logger';
import { TimeRange } from '../../components/ui/TimeRange';
import { ScheduleView } from '../../components/timetable/ScheduleView';

const getSessionBadgeColor = (type: string) => {
  switch (type) {
    case 'LECTURE': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800';
    case 'LAB': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800';
    case 'SECTION': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800';
    default: return 'bg-slate-100 text-slate-700 dark:bg-slate-800/40 dark:text-slate-300';
  }
};

const TASchedule = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [timetable, setTimetable] = useState(null);
  const [error, setError] = useState(null);

  const isRTL = i18n.language?.startsWith('ar');
  const days = isRTL
    ? ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
    : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const getTodayDayName = useCallback((availableDays: string[]) => {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const todayName = dayNames[new Date().getDay()];
    return availableDays.includes(todayName) ? todayName : availableDays[0];
  }, []);

  const [selectedDay, setSelectedDay] = useState(() => getTodayDayName(days));

  // Maintain selected day or recalculate today on language change
  useEffect(() => {
    setSelectedDay((prev) => (days.includes(prev) ? prev : getTodayDayName(days)));
  }, [i18n.language, days, getTodayDayName]);

  const [times, setTimes] = useState<string[]>(generateHourlyTimes);

  useEffect(() => {
    const handleConfigChange = () => {
      setTimes(generateHourlyTimes());
    };
    window.addEventListener('scheduleConfigChanged', handleConfigChange);
    return () => window.removeEventListener('scheduleConfigChanged', handleConfigChange);
  }, []);

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
          title={t('schedule.taScheduleTitle', 'Teaching Assistant Schedule')}
          subtitle={t('schedule.taScheduleSubtitle', 'Assigned sessions this week')}
          action={{
            label: t('common.print', 'Print'),
            icon: Printer,
            onClick: () => window.print(),
          }}
        />
        <Card className="flex flex-col items-center justify-center py-20 text-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="h-20 w-20 rounded-full bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center mb-6 border border-rose-200 dark:border-rose-700">
            <AlertCircle size={40} className="text-rose-500" />
          </div>
          <h3 className="text-2xl font-black text-brand-text-main">{error}</h3>
          <button
            onClick={fetchTargetedTimetable}
            className="mt-4 px-6 py-2.5 rounded-xl bg-brand-primary-500 text-white font-semibold text-xs uppercase tracking-widest hover:opacity-90 transition-opacity"
          >
            {t('common.retry', 'Retry')}
          </button>
        </Card>
      </div>
    );
  }

  // Compute Stats
  const allEntries = Object.values(timetable || {}).flat().filter(Boolean);
  const totalSlots = allEntries.length;
  const distinctCourses = new Set(allEntries.map((e: any) => e.course?.id)).size;
  const distinctGroups = new Set(allEntries.map((e: any) => e.groupId)).size;

  if (totalSlots === 0) {
    return (
      <div className="space-y-6 animate-in fade-in duration-700">
        <PageHeader
          title={t('schedule.taScheduleTitle', 'Teaching Assistant Schedule')}
          subtitle={t('schedule.taScheduleSubtitle', 'Assigned sessions this week')}
        />
        <Card className="flex flex-col items-center justify-center py-20 text-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="h-20 w-20 rounded-full bg-brand-yellow/10 flex items-center justify-center mb-6 border border-brand-yellow/20">
            <Calendar size={40} className="text-brand-yellow" />
          </div>
          <h3 className="text-2xl font-black text-brand-text-main">{t('common.noData')}</h3>
          <p className="text-brand-text-sub font-semibold mt-2 max-w-md mx-auto">
            {t('timetables.noSlots')}
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="section-gap animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-black text-brand-text-main tracking-tight">
            {t('schedule.taScheduleTitle', 'Teaching Assistant Schedule')}
          </h1>
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
             {t('common.welcome', 'Welcome')}, {user?.firstName} {user?.lastName}
          </p>
        </div>

        <div className="flex items-center gap-4 p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 border-s-4 border-s-brand-primary-500 shadow-sm">
          <div className="p-2.5 bg-brand-primary-500/10 dark:bg-brand-primary-500/20 text-brand-primary-600 dark:text-brand-primary-400 rounded-xl shrink-0">
            <Calendar size={24} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {t('common.today')}
            </p>
            <p className="text-sm font-black text-brand-text-primary dark:text-brand-text-main mt-0.5">
              {new Date().toLocaleDateString(i18n.language || 'en-US', { month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>
      </div>

      {/* Summary Stat Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <Calendar size={24} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">{t('schedule.totalSlots', 'Total Slots')}</p>
            <h3 className="text-2xl font-black text-slate-700 dark:text-slate-200">{totalSlots}</h3>
          </div>
        </Card>
        <Card className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center text-purple-600 dark:text-purple-400">
            <BookOpen size={24} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">{t('schedule.distinctCourses', 'Distinct Courses')}</p>
            <h3 className="text-2xl font-black text-slate-700 dark:text-slate-200">{distinctCourses}</h3>
          </div>
        </Card>
        <Card className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-green-50 dark:bg-green-900/20 flex items-center justify-center text-green-600 dark:text-green-400">
            <Layers size={24} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">{t('schedule.distinctSections', 'Distinct Sections')}</p>
            <h3 className="text-2xl font-black text-slate-700 dark:text-slate-200">{distinctSections}</h3>
          </div>
        </Card>
      </div>

      <ScheduleView 
        timetable={timetable} 
        role="TA" 
        selectedDay={selectedDay} 
        setSelectedDay={setSelectedDay} 
        days={days} 
        times={times} 
        formatTime={formatTime} 
        canManage={false} 
      />
    </div>
  );
};

export default TASchedule;
