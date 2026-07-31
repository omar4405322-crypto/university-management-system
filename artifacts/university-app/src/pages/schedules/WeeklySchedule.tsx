// @ts-nocheck
import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { SkeletonTable } from '../../components/ui/skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { logger } from '../../lib/logger';
import FilterBar from '../../components/ui/FilterBar';
import { ScheduleView } from '../../components/timetable/ScheduleView';
import collegeService from '../../services/college.service';
import departmentService from '../../services/department.service';
import useScope from '../../hooks/useScope';

const getSessionBadgeColor = (type: string) => {
  switch (type) {
    case 'LECTURE': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800';
    case 'LAB': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800';
    case 'SECTION': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800';
    default: return 'bg-slate-100 text-slate-700 dark:bg-slate-800/40 dark:text-slate-300';
  }
};

const WeeklySchedule = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [timetable, setTimetable] = useState(null);
  const [error, setError] = useState(null);

  const { scopeParams, isCollegeAdmin } = useScope();
  const [colleges, setColleges] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selectedCollege, setSelectedCollege] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedSemester, setSelectedSemester] = useState('');
  const canManage = ['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'].includes(user?.role);

  const isRTL = i18n.language === 'ar';
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
    if (canManage) {
      collegeService.getColleges().then(res => {
        if (res.success) setColleges(Array.isArray(res.data) ? res.data : res.data?.data || []);
      }).catch(() => { });
    }
  }, [canManage]);

  const handleCollegeChange = (val) => {
    setSelectedCollege(val);
    setSelectedDept('');
    if (val) {
      departmentService.getDepartments({ collegeId: val }).then(res => {
        if (res.success) setDepartments(Array.isArray(res.data) ? res.data : res.data?.data || []);
      }).catch(() => { });
    } else {
      setDepartments([]);
    }
  };

  useEffect(() => {
    fetchTargetedTimetable();
    
    // Poll for schedule changes every 10 seconds to ensure immediate updates
    const interval = setInterval(() => {
      fetchTargetedTimetable(true); // Pass a flag to avoid setting loading=true
    }, 10000);
    
    return () => clearInterval(interval);
  }, [selectedDept, selectedYear, selectedSemester, scopeParams]);

  useEffect(() => {
    const mainEl = document.querySelector('main');
    if (mainEl) {
      mainEl.classList.add('bg-slate-50', 'dark:bg-slate-900');
      return () => {
        mainEl.classList.remove('bg-slate-50', 'dark:bg-slate-900');
      };
    }
  }, []);

  const fetchTargetedTimetable = async (isPolling = false) => {
    try {
      if (!isPolling) setLoading(true);
      if (!isPolling) setError(null);

      const params: any = { ...scopeParams };
      if (!isCollegeAdmin) {
        if (selectedCollege) params.collegeId = selectedCollege;
        if (selectedDept) params.departmentId = selectedDept;
      }
      if (selectedYear) params.year = selectedYear;
      if (selectedSemester) params.semester = selectedSemester;

      const result = await schedulesService.getWeeklyTimetable(params);
      if (result.success && result.data && Array.isArray(result.data)) {
        const grouped = result.data.reduce((acc: any, slot: any) => {
          if (!slot.dayOfWeek) return acc;
          const dayName = slot.dayOfWeek.charAt(0).toUpperCase() + slot.dayOfWeek.slice(1).toLowerCase();
          if (!acc[dayName]) acc[dayName] = [];
          acc[dayName].push(slot);
          return acc;
        }, {});
        setTimetable(grouped);
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
          title={!canManage ? t('schedule.mySchedule', t('nav.schedule')) : t('timetables.title')}
          subtitle={t('timetables.subtitle')}
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

  // Extract metadata from first available schedule entry
  const firstEntry = timetable ? Object.values(timetable).flat().find(Boolean) as any : null;
  const departmentName = firstEntry?.course?.department?.name;
  const academicYear = firstEntry?.course?.year;
  const semester = firstEntry?.course?.semester;
  const collegeName = firstEntry?.course?.department?.college?.name;

  return (
    <div className="section-gap animate-in fade-in duration-700">
      <PageHeader
        title={!canManage ? t('schedule.mySchedule', t('nav.schedule')) : t('timetables.title')}
        subtitle={t('timetables.subtitle')}
        action={{
          label: t('common.print', 'Print'),
          icon: Printer,
          onClick: () => window.print(),
        }}
      />

      {canManage && (
        <Card className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden p-0 mb-6">
          <FilterBar
            search=""
            onSearchChange={() => { }}
            searchPlaceholder=""
            hideSearch={true}
          >
            {!isCollegeAdmin && (
              <>
                <select
                  value={selectedCollege}
                  onChange={(e) => handleCollegeChange(e.target.value)}
                  className="h-10 px-4 bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-brand-text-primary dark:text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 transition-all cursor-pointer flex-shrink-0"
                >
                  <option value="">{t('common.allColleges', 'All Colleges')}</option>
                  {colleges.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {isRTL ? c.nameAr || c.name : c.name}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  disabled={!selectedCollege}
                  className="h-10 px-4 bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-brand-text-primary dark:text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 transition-all cursor-pointer flex-shrink-0 disabled:opacity-50"
                >
                  <option value="">{t('common.allDepartments', 'All Departments')}</option>
                  {departments.map((d: any) => (
                    <option key={d.id} value={d.id}>
                      {isRTL ? d.nameAr || d.name : d.name}
                    </option>
                  ))}
                </select>
              </>
            )}
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="h-10 px-4 bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-brand-text-primary dark:text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 transition-all cursor-pointer flex-shrink-0"
            >
              <option value="">{t('common.allYears', 'All Years')}</option>
              {[1, 2, 3, 4, 5].map((y) => (
                <option key={y} value={y.toString()}>
                  {t('common.year', 'Year')} {y}
                </option>
              ))}
            </select>
            <select
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(e.target.value)}
              className="h-10 px-4 bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-brand-text-primary dark:text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 transition-all cursor-pointer flex-shrink-0"
            >
              <option value="">{t('schedule.allSemesters', 'All Semesters')}</option>
              <option value="1">{t('schedule.semester1', 'Semester 1')}</option>
              <option value="2">{t('schedule.semester2', 'Semester 2')}</option>
              <option value="3">{t('schedule.semester3', 'Summer Semester')}</option>
            </select>
          </FilterBar>
        </Card>
      )}

      {(!timetable || Object.keys(timetable).length === 0) ? (

        <Card className="flex flex-col items-center justify-center py-20 text-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="h-20 w-20 rounded-full bg-brand-yellow/10 flex items-center justify-center mb-6 border border-brand-yellow/20">
            <Calendar size={40} className="text-brand-yellow" />
          </div>
          <h3 className="text-2xl font-black text-brand-text-main">{t('common.noData')}</h3>
          <p className="text-brand-text-sub font-semibold mt-2 max-w-md mx-auto">
            {t('timetables.noSlots')}
          </p>
        </Card>
      ) : (
        <>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
            <div className="flex flex-col gap-2">
              {/* Use department name as the primary title if available */}
              <h1 className="text-3xl font-black text-brand-text-main tracking-tight">
                {departmentName ? `${departmentName} - ` : ''}
                {!canManage ? t('schedule.mySchedule', t('nav.schedule')) : t('timetables.title')}
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

            <div className="flex items-center gap-4 p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 border-s-4 border-s-brand-primary-500 shadow-sm transition-all hover:shadow-md hover:scale-[1.01]">
              <div className="p-2.5 bg-brand-primary-500/10 dark:bg-brand-primary-500/20 text-brand-primary-600 dark:text-brand-primary-400 rounded-xl shrink-0">
                <Calendar size={24} />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  {t('common.today')}
                </p>
                <p className="text-sm font-black text-brand-text-primary dark:text-brand-text-main mt-0.5">
                  {new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                </p>
              </div>
            </div>
          </div>

          <ScheduleView 
            timetable={timetable} 
            role="STUDENT" 
            selectedDay={selectedDay} 
            setSelectedDay={setSelectedDay} 
            days={days} 
            times={times} 
            formatTime={formatTime} 
            canManage={canManage} 
          />
        </>
      )}
    </div>
  );
};

export default WeeklySchedule;
