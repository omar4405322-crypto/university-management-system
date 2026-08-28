// @ts-nocheck
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../context/LanguageContext';
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
  AlertCircle,
  Search,
  X,
  GraduationCap,
  Layers,
} from 'lucide-react';
import schedulesService from '../../services/schedules.service';
import teachingAssistantsService from '../../services/teachingAssistants.service';
import collegeService from '../../services/college.service';
import departmentService from '../../services/department.service';
import SearchableSelect from '../../components/ui/SearchableSelect';
import { ScheduleView } from '../../components/timetable/ScheduleView';
import { generateHourlyTimes } from '../../utils/scheduleConfig';
import { logger } from '../../lib/logger';
import Button from '../../components/ui/button';
import Badge from '../../components/ui/Badge';

const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

export function TASchedule() {
  const { t, i18n } = useTranslation();
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Metadata Lists
  const [taList, setTaList] = useState<any[]>([]);
  const [collegesList, setCollegesList] = useState<any[]>([]);
  const [departmentsList, setDepartmentsList] = useState<any[]>([]);

  // Filter States
  const [selectedTAId, setSelectedTAId] = useState<string>(
    searchParams.get('taId') || (user?.role === 'TEACHING_ASSISTANT' ? String(user.teachingAssistant?.id || user.id) : 'all')
  );
  const [selectedCollegeId, setSelectedCollegeId] = useState<string>('all');
  const [selectedDeptId, setSelectedDeptId] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedSemester, setSelectedSemester] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Raw Schedule Data
  const [rawSlots, setRawSlots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = ['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'].includes(user?.role);

  // 1. Fetch TA, College, and Department Metadata
  useEffect(() => {
    Promise.all([
      teachingAssistantsService.getTeachingAssistants({ limit: 200 }).catch(() => ({ data: [] })),
      collegeService.getColleges({ limit: 100 }).catch(() => ({ data: [] })),
      departmentService.getDepartments({ limit: 200 }).catch(() => ({ data: [] })),
    ]).then(([taRes, colRes, deptRes]) => {
      const tas = Array.isArray(taRes?.data)
        ? taRes.data
        : taRes?.data?.teachingAssistants || taRes?.data?.tas || taRes?.data?.data || [];
      const cols = Array.isArray(colRes?.data) ? colRes.data : colRes?.data?.data || [];
      const depts = Array.isArray(deptRes?.data) ? deptRes.data : [];

      setTaList(tas);
      setCollegesList(cols);
      setDepartmentsList(depts);

      // Auto-set TA if logged in as TA
      if (user?.role === 'TEACHING_ASSISTANT') {
        const myTA = tas.find((t: any) => t.userId === user.id || t.id === user.teachingAssistant?.id);
        if (myTA) setSelectedTAId(String(myTA.id));
      }
    });
  }, [user]);

  // TA Select Options
  const taOptions = useMemo(() => {
    const opts = [
      {
        label: isRTL ? 'الكل — الجدول الشامل لجميع المعيدين' : 'All TAs (University Master TA Schedule)',
        value: 'all',
      },
    ];
    taList.forEach((ta) => {
      opts.push({
        label: `${ta.firstName} ${ta.lastName}`,
        value: String(ta.id),
        sublabel: ta.department?.name || '',
        group: ta.department?.name || (isRTL ? 'معيد / مساعد تدريس' : 'Teaching Assistant'),
      });
    });
    return opts;
  }, [taList, isRTL]);

  const activeTA = useMemo(() => {
    if (selectedTAId && selectedTAId !== 'all' && taList.length > 0) {
      return taList.find((t) => String(t.id) === String(selectedTAId));
    }
    return null;
  }, [selectedTAId, taList]);

  // Days & Time configuration
  const days = isRTL
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
    const ampm = hour >= 12 ? (isRTL ? 'مساءً' : 'PM') : (isRTL ? 'صباحاً' : 'AM');
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  // 2. Fetch Raw Timetable Data
  const fetchScheduleData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params: Record<string, unknown> = {};
      if (selectedTAId && selectedTAId !== 'all') {
        params.teachingAssistantId = selectedTAId;
      }
      if (selectedYear) params.year = selectedYear;
      if (selectedSemester) params.semester = selectedSemester;

      const result = await schedulesService.getWeeklyTimetable(params);
      let data = result?.data || result || {};

      let slots: any[] = [];
      if (Array.isArray(data)) {
        slots = data;
      } else if (typeof data === 'object' && data !== null) {
        slots = Object.values(data).flat().filter(Boolean);
      }

      setRawSlots(slots);
    } catch (err: any) {
      logger.error('Error fetching TA schedule:', err);
      setError(err.message || t('common.fetchError', 'Failed to load schedule'));
    } finally {
      setLoading(false);
    }
  }, [selectedTAId, selectedYear, selectedSemester, t]);

  useEffect(() => {
    fetchScheduleData();
  }, [fetchScheduleData]);

  // 3. Client-Side Filtering
  const filteredSlots = useMemo(() => {
    return rawSlots.filter((slot) => {
      // If specific TA selected
      if (selectedTAId && selectedTAId !== 'all') {
        const slotTaId = String(slot.teachingAssistantId || slot.teachingAssistant?.id || '');
        if (slotTaId !== selectedTAId) return false;
      }

      // College Filter
      if (selectedCollegeId && selectedCollegeId !== 'all') {
        const colId = slot.course?.department?.collegeId || slot.course?.department?.college?.id;
        if (String(colId) !== String(selectedCollegeId)) return false;
      }

      // Department Filter
      if (selectedDeptId && selectedDeptId !== 'all') {
        const deptId = slot.course?.departmentId || slot.course?.department?.id;
        if (String(deptId) !== String(selectedDeptId)) return false;
      }

      // Academic Year Filter
      if (selectedYear) {
        const yr = parseInt(selectedYear, 10);
        if (slot.course?.year !== yr && slot.year !== yr) return false;
      }

      // Semester Filter
      if (selectedSemester) {
        const sem = parseInt(selectedSemester, 10);
        if (slot.course?.semester !== sem && slot.semester !== sem) return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const courseName = (slot.course?.name || '').toLowerCase();
        const courseCode = (slot.course?.courseCode || '').toLowerCase();
        const taFull = `${slot.teachingAssistant?.firstName || ''} ${slot.teachingAssistant?.lastName || ''}`.toLowerCase();
        const roomName = (slot.room || '').toLowerCase();
        const groupName = (slot.group?.name || '').toLowerCase();

        const matches =
          courseName.includes(q) ||
          courseCode.includes(q) ||
          taFull.includes(q) ||
          roomName.includes(q) ||
          groupName.includes(q);

        if (!matches) return false;
      }

      return true;
    });
  }, [rawSlots, selectedTAId, selectedCollegeId, selectedDeptId, selectedYear, selectedSemester, searchQuery]);

  // Group filtered slots into Days Record for ScheduleView
  const timetableRecord = useMemo(() => {
    return filteredSlots.reduce((acc: Record<string, any[]>, slot: any) => {
      if (!slot.dayOfWeek) return acc;
      const dayName = slot.dayOfWeek.charAt(0).toUpperCase() + slot.dayOfWeek.slice(1).toLowerCase();
      if (!acc[dayName]) acc[dayName] = [];
      acc[dayName].push(slot);
      return acc;
    }, {});
  }, [filteredSlots]);

  // Statistics
  const totalSlots = filteredSlots.length;
  const distinctCourses = useMemo(
    () => new Set(filteredSlots.map((s) => s.course?.id || s.course?.name).filter(Boolean)).size,
    [filteredSlots]
  );
  const distinctRooms = useMemo(
    () => new Set(filteredSlots.map((s) => s.room).filter(Boolean)).size,
    [filteredSlots]
  );
  const distinctGroups = useMemo(
    () => new Set(filteredSlots.map((s) => s.groupId || s.group?.name).filter(Boolean)).size,
    [filteredSlots]
  );

  const taNameDisplay = activeTA
    ? `${activeTA.firstName} ${activeTA.lastName}`
    : selectedTAId === 'all'
    ? isRTL ? 'الجدول الشامل لسكاشن ومعامل المعيدين' : 'Master Teaching Assistants Schedule'
    : `${user?.firstName || ''} ${user?.lastName || ''}`;

  const deptNameDisplay =
    activeTA?.department?.name ||
    (selectedTAId === 'all'
      ? isRTL ? 'جميع الكليات والأقسام التكنولوجية' : 'All Departments & Labs'
      : user?.department?.name || '');

  const resetFilters = () => {
    setSelectedTAId(user?.role === 'TEACHING_ASSISTANT' ? String(user.teachingAssistant?.id || user.id) : 'all');
    setSelectedCollegeId('all');
    setSelectedDeptId('all');
    setSelectedYear('');
    setSelectedSemester('');
    setSearchQuery('');
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* ========================================================================= */}
      {/* 1. EXECUTIVE IDENTITY HERO CARD                                           */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-700 p-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-primary-500 to-brand-primary-700 text-white font-bold text-lg flex items-center justify-center shadow-xs shrink-0">
              {activeTA ? activeTA.firstName?.[0] : <Calendar size={22} />}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  {taNameDisplay}
                </h1>
                <Badge variant="info" className="text-[10px] font-bold">
                  {isRTL ? 'معيد / مساعد تدريس' : 'Teaching Assistant'}
                </Badge>
              </div>
              <p className="text-xs text-slate-400 font-semibold mt-0.5 flex items-center gap-1.5">
                <Building size={13} className="text-brand-primary-500" />
                <span>{deptNameDisplay || (isRTL ? 'جامعة 6 أكتوبر التكنولوجية' : '6th of October Technological University')}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="h-8 px-3 rounded-lg text-xs font-semibold border-slate-200 dark:border-slate-700 gap-1.5 cursor-pointer shadow-2xs"
            >
              <Printer size={13} />
              <span>{isRTL ? 'طباعة' : 'Print'}</span>
            </Button>

            <button
              onClick={fetchScheduleData}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 cursor-pointer shadow-2xs"
              title={isRTL ? 'تحديث' : 'Refresh'}
            >
              <RotateCw size={13} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. EXECUTIVE 4-METRIC RIBBON                                              */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {/* Total Sessions */}
        <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-semibold block">
              {isRTL ? 'إجمالي السكاشن والمعامل' : 'Total Sessions'}
            </span>
            <span className="text-lg font-black text-slate-900 dark:text-white block mt-0.5">
              {loading ? '...' : totalSlots}
            </span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 flex items-center justify-center shrink-0">
            <Calendar size={16} />
          </div>
        </div>

        {/* Assigned Courses */}
        <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-semibold block">
              {isRTL ? 'المقررات المسندة' : 'Assigned Courses'}
            </span>
            <span className="text-lg font-black text-brand-primary-600 dark:text-brand-primary-400 block mt-0.5">
              {loading ? '...' : distinctCourses}
            </span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-brand-primary-50 dark:bg-brand-primary-950/50 text-brand-primary-600 flex items-center justify-center shrink-0">
            <BookOpen size={16} />
          </div>
        </div>

        {/* Assigned Labs / Rooms */}
        <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-semibold block">
              {isRTL ? 'المعامل والقاعات' : 'Assigned Labs'}
            </span>
            <span className="text-lg font-black text-amber-600 dark:text-amber-400 block mt-0.5">
              {loading ? '...' : distinctRooms}
            </span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center shrink-0">
            <MapPin size={16} />
          </div>
        </div>

        {/* Student Cohorts */}
        <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-semibold block">
              {isRTL ? 'المجموعات والسكاشن' : 'Student Groups'}
            </span>
            <span className="text-lg font-black text-blue-600 dark:text-blue-400 block mt-0.5">
              {loading ? '...' : distinctGroups > 0 ? distinctGroups : isRTL ? 'الكل' : 'All'}
            </span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center shrink-0">
            <Users size={16} />
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. UNIFIED 44px COMPACT FILTER TOOLBAR                                    */}
      {/* ========================================================================= */}
      <div className="p-2 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-700 shadow-2xs flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isRTL ? 'بحث بالمقرر، المعيد، القاعة أو السكشن...' : 'Search course, TA, room, or group...'}
            className="w-full h-8.5 ps-8 pe-8 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-1.5 focus:ring-brand-primary-500 outline-none bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute end-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Searchable TA Switcher (Admins & Staff) */}
        {(isAdmin || user?.role !== 'TEACHING_ASSISTANT') && (
          <div className="w-56">
            <SearchableSelect
              options={taOptions}
              value={selectedTAId}
              onChange={(val) => {
                setSelectedTAId(val);
                setSearchParams(val !== 'all' ? { taId: val } : {});
              }}
              placeholder={isRTL ? 'اختر المعيد' : 'Select TA'}
              searchPlaceholder={isRTL ? 'ابحث عن اسم المعيد...' : 'Search TA...'}
              emptyText={isRTL ? 'لم يتم العثور على أي معيد' : 'No TAs found'}
              icon={<User size={14} />}
              isRTL={isRTL}
            />
          </div>
        )}

        {/* College Filter */}
        <select
          value={selectedCollegeId}
          onChange={(e) => {
            setSelectedCollegeId(e.target.value);
            setSelectedDeptId('all');
          }}
          className="h-8.5 px-3 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-brand-primary-500 cursor-pointer"
        >
          <option value="all">{isRTL ? 'كل الكليات' : 'All Colleges'}</option>
          {collegesList.map((col) => (
            <option key={col.id} value={col.id}>
              {isRTL ? col.nameAr || col.name : col.name}
            </option>
          ))}
        </select>

        {/* Academic Year */}
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(e.target.value)}
          className="h-8.5 px-3 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-brand-primary-500 cursor-pointer"
        >
          <option value="">{isRTL ? 'كل السنوات' : 'All Years'}</option>
          {[1, 2, 3, 4].map((yr) => (
            <option key={yr} value={yr}>
              {isRTL ? `الفرقة ${yr}` : `Year ${yr}`}
            </option>
          ))}
        </select>

        {/* Semester */}
        <select
          value={selectedSemester}
          onChange={(e) => setSelectedSemester(e.target.value)}
          className="h-8.5 px-3 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-brand-primary-500 cursor-pointer"
        >
          <option value="">{isRTL ? 'كل الفصول' : 'All Semesters'}</option>
          <option value="1">{isRTL ? 'الفصل 1' : 'Sem 1'}</option>
          <option value="2">{isRTL ? 'الفصل 2' : 'Sem 2'}</option>
          <option value="3">{isRTL ? 'الصيفي' : 'Summer'}</option>
        </select>

        {/* Clear Filters */}
        {(selectedTAId !== 'all' || selectedCollegeId !== 'all' || selectedDeptId !== 'all' || selectedYear || selectedSemester || searchQuery) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={resetFilters}
            className="h-8.5 px-2.5 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl font-bold cursor-pointer"
          >
            <X size={13} className="me-1" />
            {isRTL ? 'مسح' : 'Clear'}
          </Button>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 4. SCHEDULE TIMETABLE GRID                                                */}
      {/* ========================================================================= */}
      {loading ? (
        <div className="p-12 text-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-700 shadow-2xs">
          <Loader2 size={32} className="animate-spin text-brand-primary-600 mx-auto mb-2" />
          <p className="text-xs text-slate-400 font-semibold">
            {isRTL ? 'جاري تحميل جدول المعيد...' : 'Fetching TA schedule...'}
          </p>
        </div>
      ) : error ? (
        <div className="p-8 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-700 shadow-2xs text-center">
          <AlertCircle size={32} className="text-rose-500 mx-auto mb-2" />
          <p className="text-xs font-bold text-rose-600 mb-3">{error}</p>
          <Button size="sm" onClick={fetchScheduleData} className="text-xs font-bold">
            {isRTL ? 'إعادة المحاولة' : 'Retry'}
          </Button>
        </div>
      ) : totalSlots === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-700 shadow-2xs">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 flex items-center justify-center mx-auto mb-3">
            <Calendar size={24} />
          </div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
            {isRTL ? 'لا توجد سكاشن أو معامل مسجلة' : 'No Scheduled Sections Found'}
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {isRTL
              ? 'لم يتم العثور على أي حصص أو معامل مسندة للمعيد وفقاً لمعايير التصفية الحالية.'
              : 'No scheduled labs or section sessions were found matching your current filters.'}
          </p>
        </div>
      ) : (
        <ScheduleView
          timetable={timetableRecord}
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
}

export default TASchedule;
