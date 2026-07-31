// @ts-nocheck
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import {
  Calendar,
  Loader2,
  Filter,
  User,
  BookOpen,
  MapPin,
  Users,
  Printer,
  RotateCw,
  Award,
  Sparkles,
  Building,
  CheckCircle2
} from 'lucide-react';
import schedulesService from '../../services/schedules.service';
import doctorsService from '../../services/doctors.service';
import { Select } from '../../components/ui/Select';
import { logger } from '../../lib/logger';
import SearchableSelect from '../../components/ui/SearchableSelect';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';

import { TimeRange } from '../../components/ui/TimeRange';
import { ScheduleView } from '../../components/timetable/ScheduleView';
import { generateHourlyTimes } from '../../utils/scheduleConfig';

const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

const DoctorSchedule = () => {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const isAr = i18n.language?.startsWith('ar');

  const [doctorsList, setDoctorsList] = useState<any[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>(
    searchParams.get('doctorId') || ''
  );

  const isAdmin = ['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'].includes(user?.role);

  useEffect(() => {
    if (isAdmin || searchParams.get('doctorId')) {
      doctorsService.getDoctors({ limit: 100 }).then((res: any) => {
        if (res.success && res.data) {
          const list = Array.isArray(res.data) ? res.data : res.data.doctors || res.data.data || [];
          setDoctorsList(list);
          if (!selectedDoctorId && list.length > 0) {
            setSelectedDoctorId(String(list[0].id));
          }
        }
      }).catch(() => {});
    }
  }, [isAdmin, searchParams]);

  const activeDoctor = useMemo(() => {
    if (selectedDoctorId && doctorsList.length > 0) {
      return doctorsList.find((d) => String(d.id) === String(selectedDoctorId));
    }
    return null;
  }, [selectedDoctorId, doctorsList]);

  const doctorOptions = useMemo(() => {
    return doctorsList.map((doc) => ({
      value: String(doc.id),
      label: `Dr. ${doc.firstName} ${doc.lastName}`,
      sublabel: doc.department?.name || '',
      group: doc.department?.name || t('schedule.doctorTitle', 'عضو هيئة التدريس')
    }));
  }, [doctorsList, t]);

  const [schedule, setSchedule] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const days = isAr
    ? ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
    : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const getTodayDayName = useCallback((availableDays: string[]) => {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const todayName = dayNames[new Date().getDay()];
    return availableDays.includes(todayName) ? todayName : availableDays[0];
  }, []);

  const [selectedDay, setSelectedDay] = useState(() => getTodayDayName(days));

  useEffect(() => {
    setSelectedDay((prev) => (days.includes(prev) ? prev : getTodayDayName(days)));
  }, [i18n.language, days, getTodayDayName]);

  const [times, setTimes] = useState<string[]>(generateHourlyTimes());

  useEffect(() => {
    const handleConfigChange = () => {
      setTimes(generateHourlyTimes());
    };
    window.addEventListener('scheduleConfigChanged', handleConfigChange);
    return () => window.removeEventListener('scheduleConfigChanged', handleConfigChange);
  }, []);

  const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? t('common.pm') || 'مساءً' : t('common.am') || 'صباحاً';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  // Filter state
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedSemester, setSelectedSemester] = useState('');

  const fetchSchedule = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, unknown> = {};
      if (selectedDoctorId) params.doctorId = selectedDoctorId;
      if (selectedYear) params.year = selectedYear;
      if (selectedSemester) params.semester = selectedSemester;
      const result = await schedulesService.getWeeklyTimetable(params);
      let data = result?.data || result || {};
      if (Array.isArray(data)) {
        data = data.reduce((acc: any, slot: any) => {
          if (!slot.dayOfWeek) return acc;
          const dayName = slot.dayOfWeek.charAt(0).toUpperCase() + slot.dayOfWeek.slice(1).toLowerCase();
          if (!acc[dayName]) acc[dayName] = [];
          acc[dayName].push(slot);
          return acc;
        }, {});
      }
      setSchedule(data);
    } catch (err: any) {
      logger.error('Error fetching schedule:', err);
      setError(err.message || t('common.fetchError', 'Failed to load schedule'));
    } finally {
      setLoading(false);
    }
  }, [selectedDoctorId, selectedYear, selectedSemester, t]);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  const allSlots = useMemo(() => {
    return Object.values(schedule || {}).flat().filter(Boolean);
  }, [schedule]);

  const totalClasses = allSlots.length;
  const distinctCourses = useMemo(() => new Set(allSlots.map((s: any) => s.course?.id || s.course?.name).filter(Boolean)).size, [allSlots]);
  const distinctRooms = useMemo(() => new Set(allSlots.map((s: any) => s.room).filter(Boolean)).size, [allSlots]);
  const distinctGroups = useMemo(() => new Set(allSlots.map((s: any) => s.groupId || s.group?.name).filter(Boolean)).size, [allSlots]);

  const doctorNameDisplay = activeDoctor
    ? `${activeDoctor.firstName} ${activeDoctor.lastName}`
    : `${user?.firstName || ''} ${user?.lastName || ''}`;

  const deptNameDisplay = activeDoctor?.department?.name || user?.department?.name || user?.managedDepartmentName || '';

  return (
    <div className="section-gap animate-in fade-in duration-700 space-y-6">
      {/* 👑 PRO DOCTOR PROFILE BANNER (Clean Light/Dark Theme Matched) */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 text-slate-800 dark:text-white">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            {/* Avatar Badge */}
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-primary-500 to-indigo-600 flex items-center justify-center text-2xl font-black text-white shadow-md shadow-brand-primary-500/20 shrink-0">
              {doctorNameDisplay.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-800 dark:text-white">
                  {t('common.dr', 'Dr.')} {doctorNameDisplay}
                </h1>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-brand-primary-50 dark:bg-brand-primary-950/40 text-brand-primary-700 dark:text-brand-primary-300 border border-brand-primary-200 dark:border-brand-primary-800 flex items-center gap-1.5">
                  <Sparkles size={12} className="text-amber-500" />
                  {t('schedule.doctorTitle', 'عضو هيئة التدريس')}
                </span>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1 flex items-center gap-2">
                <Building size={14} className="text-brand-primary-500" />
                {deptNameDisplay ? `${deptNameDisplay}` : t('schedule.universityFaculty', 'جامعة 6 أكتوبر التكنولوجية')}
              </p>
            </div>
          </div>

          {/* Controls & Searchable Doctor Switcher */}
          <div className="flex items-center gap-3 flex-wrap">
            {(isAdmin || doctorsList.length > 0) && (
              <div className="min-w-[240px] sm:min-w-[280px]">
                <SearchableSelect
                  options={doctorOptions}
                  value={selectedDoctorId}
                  onChange={(val) => {
                    setSelectedDoctorId(val);
                    setSearchParams({ doctorId: val });
                  }}
                  placeholder={t('doctors.selectDoctor', 'اختر الدكتور / المحاضر')}
                  searchPlaceholder={t('doctors.searchDoctor', 'ابحث عن اسم الدكتور...')}
                  emptyText={t('doctors.noDoctorsFound', 'لم يتم العثور على أي دكتور')}
                  icon={<User size={16} />}
                  isRTL={isAr}
                />
              </div>
            )}

            <button
              onClick={() => window.print()}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-xs flex items-center gap-2 transition-all border border-slate-200 dark:border-slate-600 shadow-xs active:scale-95 cursor-pointer"
            >
              <Printer size={15} />
              <span className="hidden sm:inline">{t('common.print', 'طباعة الجدول')}</span>
            </button>

            <button
              onClick={fetchSchedule}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-xs transition-all border border-slate-200 dark:border-slate-600 shadow-xs active:scale-95 cursor-pointer"
              title={t('common.refresh', 'تحديث')}
            >
              <RotateCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* 📊 SUMMARY STATS DASHBOARD BAR (4 CARDS) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm relative overflow-hidden group hover:border-brand-primary-500/40 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {t('schedule.totalSessions', 'إجمالي الحصص الأسبوعية')}
              </p>
              <h3 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-white mt-1">
                {loading ? '...' : totalClasses}
              </h3>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-brand-primary-500/10 text-brand-primary-500 flex items-center justify-center font-bold text-xl shrink-0">
              <Calendar size={24} />
            </div>
          </div>
        </Card>

        <Card className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm relative overflow-hidden group hover:border-indigo-500/40 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {t('schedule.assignedCourses', 'المقررات المسندة')}
              </p>
              <h3 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-white mt-1">
                {loading ? '...' : distinctCourses}
              </h3>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center font-bold text-xl shrink-0">
              <BookOpen size={24} />
            </div>
          </div>
        </Card>

        <Card className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm relative overflow-hidden group hover:border-amber-500/40 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {t('schedule.assignedRooms', 'القاعات والمدرجات')}
              </p>
              <h3 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-white mt-1">
                {loading ? '...' : distinctRooms}
              </h3>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold text-xl shrink-0">
              <MapPin size={24} />
            </div>
          </div>
        </Card>

        <Card className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm relative overflow-hidden group hover:border-purple-500/40 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {t('schedule.targetGroups', 'المجموعات الطلابية')}
              </p>
              <h3 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-white mt-1">
                {loading ? '...' : distinctGroups > 0 ? distinctGroups : t('common.all', 'الكل')}
              </h3>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-500 flex items-center justify-center font-bold text-xl shrink-0">
              <Users size={24} />
            </div>
          </div>
        </Card>
      </div>

      {/* 🎛️ CUSTOM FILTER BAR */}
      <Card className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-widest me-2">
              <Filter size={16} className="text-brand-primary-500" />
              {t('common.filters', 'التصفية')}
            </div>

            {/* Academic Year */}
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="h-10 px-4 bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 cursor-pointer"
            >
              <option value="">{t('schedule.academicYear', 'جميع السنوات الأكاديمية')}</option>
              {yearOptions.map((yr) => (
                <option key={yr} value={yr}>
                  {t('common.year', 'سنة')} {yr}
                </option>
              ))}
            </select>

            {/* Semester */}
            <select
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(e.target.value)}
              className="h-10 px-4 bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 cursor-pointer"
            >
              <option value="">{t('schedule.allSemesters', 'جميع الفصول الدراسية')}</option>
              <option value="1">{t('schedule.semester1', 'الفصل الدراسي الأول')}</option>
              <option value="2">{t('schedule.semester2', 'الفصل الدراسي الثاني')}</option>
              <option value="3">{t('schedule.semester3', 'الفصل الصيفي')}</option>
            </select>
          </div>

          {(selectedYear || selectedSemester) && (
            <button
              onClick={() => {
                setSelectedYear('');
                setSelectedSemester('');
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 transition-colors"
            >
              ✕ {t('common.resetFilters', 'إلغاء الفلترة')}
            </button>
          )}
        </div>
      </Card>

      {/* Loading */}
      {loading && (
        <Card className="p-16 flex flex-col items-center justify-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm text-center">
          <Loader2 size={36} className="animate-spin text-brand-primary-500 mb-3" />
          <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
            {t('common.loadingSchedule', 'جاري تحميل جدول المحاضرات...')}
          </p>
        </Card>
      )}

      {/* Error */}
      {!loading && error && (
        <Card className="p-16 flex flex-col items-center justify-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm text-center">
          <p className="text-red-500 font-bold mb-3">{error}</p>
          <button
            onClick={fetchSchedule}
            className="px-5 py-2 bg-brand-primary-500 text-white font-bold rounded-xl text-xs hover:bg-brand-primary-600 transition-all shadow-md"
          >
            {t('common.retry', 'إعادة المحاولة')}
          </button>
        </Card>
      )}

      {/* No schedule */}
      {!loading && !error && totalClasses === 0 && (
        <Card className="p-16 flex flex-col items-center justify-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm text-center">
          <div className="w-20 h-20 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-500 flex items-center justify-center text-3xl mb-4 border border-blue-200 dark:border-blue-800">
            📅
          </div>
          <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-1">
            {t('schedule.noSchedule', 'لا توجد محاضرات مجدولة لهاته الفترة')}
          </h3>
          <p className="text-xs text-slate-400 font-medium max-w-sm">
            {t('schedule.noScheduleDesc', 'لم يتم العثور على أي جلسات تدريس مجدولة حسب الفلاتر المحددة.')}
          </p>
        </Card>
      )}

      {/* Schedule Grid */}
      {!loading && !error && Number(totalClasses) > 0 && (
        <ScheduleView 
          timetable={schedule} 
          role="DOCTOR" 
          selectedDay={selectedDay} 
          setSelectedDay={setSelectedDay} 
          days={days} 
          times={times} 
          formatTime={formatTime} 
          canManage={false} 
        />
      )}
    </div>
  );
};

export default DoctorSchedule;
