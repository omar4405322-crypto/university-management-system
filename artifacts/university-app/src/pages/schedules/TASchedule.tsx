// @ts-nocheck
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
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
  Sparkles,
  Building,
  AlertCircle
} from 'lucide-react';
import schedulesService from '../../services/schedules.service';
import teachingAssistantsService from '../../services/teachingAssistants.service';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import SearchableSelect from '../../components/ui/SearchableSelect';
import { ScheduleView } from '../../components/timetable/ScheduleView';
import { generateHourlyTimes } from '../../utils/scheduleConfig';
import { logger } from '../../lib/logger';

const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

const TASchedule = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const isAr = i18n.language?.startsWith('ar');

  const [loading, setLoading] = useState(true);
  const [timetable, setTimetable] = useState({});
  const [error, setError] = useState(null);

  const [taList, setTaList] = useState<any[]>([]);
  const [selectedTAId, setSelectedTAId] = useState<string>(
    searchParams.get('taId') || ''
  );

  const isAdmin = ['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'].includes(user?.role);

  useEffect(() => {
    if (isAdmin || searchParams.get('taId')) {
      teachingAssistantsService.getTeachingAssistants({ limit: 100 }).then((res: any) => {
        if (res.success && res.data) {
          const list = Array.isArray(res.data) ? res.data : res.data.tas || res.data.data || [];
          setTaList(list);
          if (!selectedTAId && list.length > 0) {
            setSelectedTAId(String(list[0].id));
          }
        }
      }).catch(() => {});
    }
  }, [isAdmin, searchParams]);

  const activeTA = useMemo(() => {
    if (selectedTAId && taList.length > 0) {
      return taList.find((t) => String(t.id) === String(selectedTAId));
    }
    return null;
  }, [selectedTAId, taList]);

  const taOptions = useMemo(() => {
    return taList.map((ta) => ({
      value: String(ta.id),
      label: `${ta.firstName} ${ta.lastName}`,
      sublabel: ta.department?.name || '',
      group: ta.department?.name || t('schedule.taTitle', 'معيد / مساعد تدريس')
    }));
  }, [taList, t]);

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

  const fetchTargetedTimetable = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params: Record<string, unknown> = {};
      if (selectedTAId) params.teachingAssistantId = selectedTAId;
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
      setTimetable(data);
    } catch (err: any) {
      logger.error('Error fetching timetable:', err);
      setError(err.message || t('common.fetchError', 'Failed to load schedule'));
    } finally {
      setLoading(false);
    }
  }, [selectedTAId, selectedYear, selectedSemester, t]);

  useEffect(() => {
    fetchTargetedTimetable();
  }, [fetchTargetedTimetable]);

  const allSlots = useMemo(() => {
    return Object.values(timetable || {}).flat().filter(Boolean);
  }, [timetable]);

  const totalSlots = allSlots.length;
  const distinctCourses = useMemo(() => new Set(allSlots.map((s: any) => s.course?.id || s.course?.name).filter(Boolean)).size, [allSlots]);
  const distinctRooms = useMemo(() => new Set(allSlots.map((s: any) => s.room).filter(Boolean)).size, [allSlots]);
  const distinctGroups = useMemo(() => new Set(allSlots.map((s: any) => s.groupId || s.group?.name).filter(Boolean)).size, [allSlots]);

  const taNameDisplay = activeTA
    ? `${activeTA.firstName} ${activeTA.lastName}`
    : `${user?.firstName || ''} ${user?.lastName || ''}`;

  const deptNameDisplay = activeTA?.department?.name || user?.department?.name || user?.managedDepartmentName || '';

  return (
    <div className="section-gap animate-in fade-in duration-700 space-y-6">
      {/* 👑 PRO TA PROFILE BANNER (Clean Light/Dark Theme Matched) */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 text-slate-800 dark:text-white">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            {/* Avatar Badge */}
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-2xl font-black text-white shadow-md shadow-purple-500/20 shrink-0">
              {taNameDisplay.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-800 dark:text-white">
                  {taNameDisplay}
                </h1>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 flex items-center gap-1.5">
                  <Sparkles size={12} className="text-amber-500" />
                  {t('schedule.taTitle', 'معيد / مساعد تدريس')}
                </span>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1 flex items-center gap-2">
                <Building size={14} className="text-purple-500" />
                {deptNameDisplay ? `${deptNameDisplay}` : t('schedule.universityFaculty', 'جامعة 6 أكتوبر التكنولوجية')}
              </p>
            </div>
          </div>

          {/* Controls & Searchable TA Switcher */}
          <div className="flex items-center gap-3 flex-wrap">
            {(isAdmin || taList.length > 0) && (
              <div className="min-w-[240px] sm:min-w-[280px]">
                <SearchableSelect
                  options={taOptions}
                  value={selectedTAId}
                  onChange={(val) => {
                    setSelectedTAId(val);
                    setSearchParams({ taId: val });
                  }}
                  placeholder={t('teachingAssistants.selectTA', 'اختر المعيد')}
                  searchPlaceholder={t('teachingAssistants.searchTA', 'ابحث عن اسم المعيد...')}
                  emptyText={t('teachingAssistants.noTAsFound', 'لم يتم العثور على أي معيد')}
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
              onClick={fetchTargetedTimetable}
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
        <Card className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm relative overflow-hidden group hover:border-purple-500/40 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {t('schedule.totalSessions', 'إجمالي الحصص والمعامل')}
              </p>
              <h3 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-white mt-1">
                {loading ? '...' : totalSlots}
              </h3>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-500 flex items-center justify-center font-bold text-xl shrink-0">
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
                {t('schedule.assignedRooms', 'المعامل والقاعات')}
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

        <Card className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm relative overflow-hidden group hover:border-blue-500/40 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {t('schedule.targetGroups', 'المجموعات الطلابية')}
              </p>
              <h3 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-white mt-1">
                {loading ? '...' : distinctGroups > 0 ? distinctGroups : t('common.all', 'الكل')}
              </h3>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold text-xl shrink-0">
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
              <Filter size={16} className="text-purple-500" />
              {t('common.filters', 'التصفية')}
            </div>

            {/* Academic Year */}
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="h-10 px-4 bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 cursor-pointer"
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
              className="h-10 px-4 bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 cursor-pointer"
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
          <Loader2 size={36} className="animate-spin text-purple-500 mb-3" />
          <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
            {t('common.loadingSchedule', 'جاري تحميل جدول المعيد...')}
          </p>
        </Card>
      )}

      {/* Error */}
      {!loading && error && (
        <Card className="p-16 flex flex-col items-center justify-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm text-center">
          <div className="w-16 h-16 rounded-full bg-rose-50 dark:bg-rose-900/20 text-rose-500 flex items-center justify-center mb-4 border border-rose-200 dark:border-rose-800">
            <AlertCircle size={32} />
          </div>
          <p className="text-red-500 font-bold mb-3">{error}</p>
          <button
            onClick={fetchTargetedTimetable}
            className="px-5 py-2 bg-purple-500 text-white font-bold rounded-xl text-xs hover:bg-purple-600 transition-all shadow-md"
          >
            {t('common.retry', 'إعادة المحاولة')}
          </button>
        </Card>
      )}

      {/* No schedule */}
      {!loading && !error && totalSlots === 0 && (
        <Card className="p-16 flex flex-col items-center justify-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm text-center">
          <div className="w-20 h-20 rounded-full bg-purple-50 dark:bg-purple-900/20 text-purple-500 flex items-center justify-center text-3xl mb-4 border border-purple-200 dark:border-purple-800">
            📅
          </div>
          <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-1">
            {t('schedule.noSchedule', 'لا توجد سكاشن أو معامل مجدولة لهاته الفترة')}
          </h3>
          <p className="text-xs text-slate-400 font-medium max-w-sm">
            {t('schedule.noScheduleDesc', 'لم يتم العثور على أي جلسات تدريس مسندة للمعيد حسب الفلاتر المحددة.')}
          </p>
        </Card>
      )}

      {/* Schedule Grid */}
      {!loading && !error && Number(totalSlots) > 0 && (
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
      )}
    </div>
  );
};

export default TASchedule;
