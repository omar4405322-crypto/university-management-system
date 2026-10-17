import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  LayoutGrid,
  ListOrdered,
} from 'lucide-react';
import schedulesService from '../../services/schedules.service';
import teachingAssistantsService from '../../services/teachingAssistants.service';
import collegeService from '../../services/college.service';
import departmentService from '../../services/department.service';
import SearchableSelect, { SelectOption } from '../../components/ui/SearchableSelect';
import { ScheduleView } from '../../components/timetable/ScheduleView';
import { generateHourlyTimes, deriveHourlyTimesFromData } from '../../utils/scheduleConfig';
import { logger } from '../../lib/logger';
import Button from '../../components/ui/button';
import Badge from '../../components/ui/badge';
import ScheduleHeader from '../../components/timetable/ScheduleHeader';
import ScheduleToolbar from '../../components/timetable/ScheduleToolbar';
import useScope from '../../hooks/useScope';
import { getScheduleFilterPermissions, API_SCHEDULE_DAYS } from '../../utils/scheduleFilterRules';

const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

export interface TAScheduleSlot {
  id?: number | string;
  dayOfWeek: string;
  startTime: string;
  endTime?: string;
  room?: string | null;
  slotType?: string;
  year?: number;
  semester?: number;
  teachingAssistantId?: string;
  teachingAssistant?: {
    id?: string | number;
    firstName?: string;
    lastName?: string;
  } | null;
  courseId?: number | string;
  course?: {
    id?: number | string;
    name?: string;
    courseCode?: string;
    year?: number;
    semester?: number;
    departmentId?: number;
    department?: {
      id?: number;
      name?: string;
      nameAr?: string;
      collegeId?: number;
      college?: { id?: number; name?: string };
    } | null;
  } | null;
  groupId?: number | string | null;
  group?: {
    id?: number | string;
    name?: string;
  } | null;
}

export type TATimetableDayRecord = Record<string, TAScheduleSlot[]>;

export function TASchedule() {
  const { t, i18n } = useTranslation();
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { hideCollegeSelector, hideDepartmentSelector } = useScope();

  const filterPermissions = useMemo(() => getScheduleFilterPermissions(user?.role), [user?.role]);

  // Metadata Lists
  const [taList, setTaList] = useState<any[]>([]);
  const [collegesList, setCollegesList] = useState<any[]>([]);
  const [departmentsList, setDepartmentsList] = useState<any[]>([]);

  // Filter States
  const [selectedTAId, setSelectedTAId] = useState<string>(
    searchParams.get('taId') || (user?.role === 'TEACHING_ASSISTANT' && user.teachingAssistant?.id ? String(user.teachingAssistant.id) : 'all')
  );
  const [selectedCollegeId, setSelectedCollegeId] = useState<string>('all');
  const [selectedDeptId, setSelectedDeptId] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedSemester, setSelectedSemester] = useState<string>('');
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [selectedDayFilter, setSelectedDayFilter] = useState<string>('');
  const [selectedSlotType, setSelectedSlotType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [scheduleViewMode, setScheduleViewMode] = useState<'grid' | 'agenda'>('grid');

  // Raw Schedule Data
  const [rawSlots, setRawSlots] = useState<TAScheduleSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = user?.role ? ['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'].includes(user.role) : false;

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

      // Auto-set TA if logged in as TEACHING_ASSISTANT
      if (user?.role === 'TEACHING_ASSISTANT') {
        const myTA = tas.find((t: any) => 
          (user.teachingAssistant?.id && String(t.id) === String(user.teachingAssistant.id)) ||
          (user.id && String(t.userId) === String(user.id))
        );
        if (myTA) {
          setSelectedTAId(String(myTA.id));
        } else if (user.teachingAssistant?.id) {
          setSelectedTAId(String(user.teachingAssistant.id));
        }
      }
    });
  }, [user]);

  // Options for TA Select
  const taOptions = useMemo(() => {
    const opts: SelectOption[] = [
      {
        label: isRTL ? 'الكل — جدول جميع المعيدين والسكاشن' : 'All Teaching Assistants (Master Schedule)',
        value: 'all',
      },
    ];
    taList.forEach((ta) => {
      opts.push({
        label: `${ta.firstName || ''} ${ta.lastName || ''}`.trim(),
        value: String(ta.id),
        sublabel: ta.department?.name || '',
        group: ta.department?.name || (isRTL ? 'معيد' : 'Teaching Assistant'),
      });
    });
    return opts;
  }, [taList, isRTL]);

  // Cascading departments for selected college
  const filteredDepartments = useMemo(() => {
    if (!selectedCollegeId || selectedCollegeId === 'all') return departmentsList;
    const colId = parseInt(selectedCollegeId, 10);
    return departmentsList.filter((d) => d.collegeId === colId);
  }, [departmentsList, selectedCollegeId]);

  const activeTA = useMemo(() => {
    if (selectedTAId && selectedTAId !== 'all' && taList.length > 0) {
      return taList.find((t) => String(t.id) === String(selectedTAId));
    }
    return null;
  }, [selectedTAId, taList]);

  // Days & Time configuration
  const days = useMemo(
    () =>
      isRTL
        ? ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
        : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    [isRTL]
  );

  const getTodayDayName = useCallback((availableDays: string[]) => {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const todayName = dayNames[new Date().getDay()];
    return availableDays.includes(todayName) ? todayName : availableDays[0];
  }, []);

  const [selectedDay, setSelectedDay] = useState(() => getTodayDayName(days));

  useEffect(() => {
    setSelectedDay((prev) => (days.includes(prev) ? prev : getTodayDayName(days)));
  }, [i18n.language, days, getTodayDayName]);

  const times = useMemo(() => {
    return deriveHourlyTimesFromData(rawSlots);
  }, [rawSlots]);

  const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? (isRTL ? 'مساءً' : 'PM') : (isRTL ? 'صباحاً' : 'AM');
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  // 2. Fetch Raw Timetable Data (Strictly Practical Lessons, Sections & Labs)
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

      const result = await schedulesService.getAllWeeklyTimetable(params);
      let data = result?.data || result || {};

      let slots: any[] = [];
      if (Array.isArray(data)) {
        slots = data;
      } else if (typeof data === 'object' && data !== null) {
        slots = Object.values(data).flat().filter(Boolean);
      }

      // Filter to strictly Practical lessons and Labs (exclude pure doctor lectures)
      const practicalSlots = slots.filter((slot: any) => {
        const isLab = slot.slotType === 'LAB';
        const hasTA = Boolean(slot.teachingAssistantId || slot.teachingAssistant?.id);
        return isLab || hasTA;
      });

      setRawSlots(practicalSlots);
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

  // Distinct courses assigned in the loaded schedule slots
  const assignedCourses = useMemo(() => {
    const courseMap = new Map<string, { id: string | number; name: string; courseCode?: string }>();
    rawSlots.forEach((slot) => {
      const c = slot.course;
      if (c && (c.id || c.name)) {
        const key = String(c.id || c.name);
        if (!courseMap.has(key)) {
          courseMap.set(key, {
            id: c.id ?? key,
            name: c.name || c.courseCode || String(c.id),
            courseCode: c.courseCode,
          });
        }
      }
    });
    return Array.from(courseMap.values());
  }, [rawSlots]);

  // 3. Client-Side Filtering
  const filteredSlots = useMemo(() => {
    return rawSlots.filter((slot) => {
      // Must be a lab session or have a TA assigned
      const isLab = slot.slotType === 'LAB';
      const hasTA = Boolean(slot.teachingAssistantId || slot.teachingAssistant?.id);
      if (!isLab && !hasTA) return false;

      // If specific TA selected (for admin/master view)
      if (filterPermissions.teachingAssistant && selectedTAId && selectedTAId !== 'all') {
        const slotTaId = String(slot.teachingAssistantId || slot.teachingAssistant?.id || '');
        if (slotTaId !== selectedTAId) return false;
      }

      // College Filter
      if (filterPermissions.college && !hideCollegeSelector && selectedCollegeId && selectedCollegeId !== 'all') {
        const colId = slot.course?.department?.collegeId || slot.course?.department?.college?.id;
        if (String(colId) !== String(selectedCollegeId)) return false;
      }

      // Department Filter
      if (filterPermissions.department && !hideDepartmentSelector && selectedDeptId && selectedDeptId !== 'all') {
        const deptId = slot.course?.departmentId || slot.course?.department?.id;
        if (String(deptId) !== String(selectedDeptId)) return false;
      }

      // Academic Year Filter
      if (filterPermissions.year && selectedYear) {
        const yr = parseInt(selectedYear, 10);
        if (slot.course?.year !== yr && slot.year !== yr) return false;
      }

      // Semester Filter
      if (filterPermissions.semester && selectedSemester) {
        const sem = parseInt(selectedSemester, 10);
        if (slot.course?.semester !== sem && slot.semester !== sem) return false;
      }

      // Course Filter (Assigned only for TA)
      if (filterPermissions.course && selectedCourse) {
        const cid = String(slot.courseId || slot.course?.id || slot.course?.name || '');
        if (cid !== selectedCourse) return false;
      }

      // Session Type Filter
      if (filterPermissions.type && selectedSlotType && selectedSlotType !== 'all') {
        if (slot.slotType !== selectedSlotType) return false;
      }

      // Day Filter (canonical API day string)
      if (filterPermissions.day && selectedDayFilter) {
        if (String(slot.dayOfWeek).toUpperCase() !== selectedDayFilter.toUpperCase()) return false;
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
  }, [
    rawSlots,
    filterPermissions,
    hideCollegeSelector,
    hideDepartmentSelector,
    selectedTAId,
    selectedCollegeId,
    selectedDeptId,
    selectedYear,
    selectedSemester,
    selectedCourse,
    selectedSlotType,
    selectedDayFilter,
    searchQuery,
  ]);

  // Group filtered slots into Days Record for ScheduleView
  const timetableRecord = useMemo<TATimetableDayRecord>(() => {
    return filteredSlots.reduce((acc: TATimetableDayRecord, slot: TAScheduleSlot) => {
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
    setSelectedCourse('');
    setSelectedDayFilter('');
    setSelectedSlotType('all');
    setSearchQuery('');
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* 1. UNIFIED SCHEDULE HEADER */}
      <ScheduleHeader
        title={taNameDisplay}
        subtitle={deptNameDisplay || t('schedules.universityFallback', '6th of October Technological University')}
        icon={activeTA ? activeTA.firstName?.[0] : <Calendar size={22} />}
        roleBadge={
          activeTA
            ? t('schedules.teachingAssistantBadge', 'Teaching Assistant')
            : t('schedules.masterTASchedule', 'Master Teaching Assistants Schedule')
        }
        canManage={isAdmin}
        onManage={() => navigate('/timetables-management')}
        showPrint={true}
        onPrint={() => window.print()}
        onRefresh={fetchScheduleData}
        isRefreshing={loading}
      />

      {/* 2. UNIFIED COMPACT FILTER TOOLBAR */}
      <ScheduleToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder={t('schedules.searchTASchedulePlaceholder')}
        hasActiveFilters={Boolean(
          (filterPermissions.teachingAssistant && selectedTAId !== 'all') ||
          (filterPermissions.college && !hideCollegeSelector && selectedCollegeId !== 'all') ||
          (filterPermissions.department && !hideDepartmentSelector && selectedDeptId !== 'all') ||
          (filterPermissions.year && selectedYear) ||
          (filterPermissions.semester && selectedSemester) ||
          (filterPermissions.course && selectedCourse) ||
          (filterPermissions.day && selectedDayFilter) ||
          (filterPermissions.type && selectedSlotType !== 'all') ||
          searchQuery
        )}
        onResetFilters={resetFilters}
        viewMode={scheduleViewMode}
        onViewModeChange={setScheduleViewMode}
      >
        {/* Searchable TA Switcher (Admins & Staff) */}
        {filterPermissions.teachingAssistant && (
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
        {filterPermissions.college && !hideCollegeSelector && (
          <select
            value={selectedCollegeId}
            onChange={(e) => {
              setSelectedCollegeId(e.target.value);
              setSelectedDeptId('all');
            }}
            aria-label={t('schedules.allColleges', 'All Colleges')}
            className="h-8.5 px-3 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-brand-primary-500 cursor-pointer"
          >
            <option value="all">{t('schedules.allColleges', 'All Colleges')}</option>
            {collegesList.map((col) => (
              <option key={col.id} value={col.id}>
                {isRTL ? col.nameAr || col.name : col.name}
              </option>
            ))}
          </select>
        )}

        {/* Course Filter (Assigned only for TA) */}
        {filterPermissions.course && (
          <select
            value={selectedCourse}
            onChange={(e) => setSelectedCourse(e.target.value)}
            aria-label={t('schedules.filterByCourse', 'Filter by Course')}
            className="h-8.5 px-3 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-brand-primary-500 cursor-pointer"
          >
            <option value="">{t('schedules.allCourses', 'All Courses')}</option>
            {assignedCourses.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.courseCode ? `[${c.courseCode}] ` : ''}{c.name}
              </option>
            ))}
          </select>
        )}

        {/* Session Type Filter (Lecture / Lab) */}
        {filterPermissions.type && (
          <select
            value={selectedSlotType}
            onChange={(e) => setSelectedSlotType(e.target.value)}
            aria-label={t('schedules.filterBySessionType', 'Filter by Session Type')}
            className="h-8.5 px-3 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-brand-primary-500 cursor-pointer"
          >
            <option value="all">{t('schedules.allSessions', 'All Sessions')}</option>
            <option value="LECTURE">{t('schedules.lecture', 'Lecture')}</option>
            <option value="LAB">{t('schedules.lab', 'Lab / Section')}</option>
          </select>
        )}

        {/* Day Filter */}
        {filterPermissions.day && (
          <select
            value={selectedDayFilter}
            onChange={(e) => setSelectedDayFilter(e.target.value)}
            aria-label={t('schedules.filterByDay', 'Filter by Day')}
            className="h-8.5 px-3 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-brand-primary-500 cursor-pointer"
          >
            <option value="">{t('schedules.allDays', 'All Days')}</option>
            {API_SCHEDULE_DAYS.map((d) => (
              <option key={d} value={d}>
                {t(`days.${d.toLowerCase()}`, d)}
              </option>
            ))}
          </select>
        )}

        {/* Academic Year */}
        {filterPermissions.year && (
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            aria-label={t('schedules.filterByYear', 'Filter by year')}
            className="h-8.5 px-3 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-brand-primary-500 cursor-pointer"
          >
            <option value="">{t('schedules.allYears', 'All Years')}</option>
            {[1, 2, 3, 4].map((yr) => (
              <option key={yr} value={yr}>
                {t('schedules.yearOption', { year: yr, defaultValue: `Year ${yr}` })}
              </option>
            ))}
          </select>
        )}

        {/* Semester */}
        {filterPermissions.semester && (
          <select
            value={selectedSemester}
            onChange={(e) => setSelectedSemester(e.target.value)}
            aria-label={t('schedules.filterBySemester', 'Filter by semester')}
            className="h-8.5 px-3 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-brand-primary-500 cursor-pointer"
          >
            <option value="">{t('schedules.allSemesters', 'All Semesters')}</option>
            <option value="1">{t('schedules.semesterOption', { semester: 1, defaultValue: 'Sem 1' })}</option>
            <option value="2">{t('schedules.semesterOption', { semester: 2, defaultValue: 'Sem 2' })}</option>
            <option value="3">{t('schedules.semesterSummer', 'Summer')}</option>
          </select>
        )}
      </ScheduleToolbar>

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
          viewMode={scheduleViewMode}
          onViewModeChange={setScheduleViewMode}
        />
      )}
    </div>
  );
}

export default TASchedule;
