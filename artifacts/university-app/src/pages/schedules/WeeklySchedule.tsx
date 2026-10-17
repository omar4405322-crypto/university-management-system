import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import {
  Calendar,
  Loader2,
  BookOpen,
  MapPin,
  Printer,
  RotateCw,
  Building,
  AlertTriangle,
  Search,
  X,
  RotateCcw,
  GraduationCap,
  Layers,
  LayoutGrid,
  ListOrdered,
} from 'lucide-react';
import schedulesService, { ScheduleSlotData } from '../../services/schedules.service';
import collegeService from '../../services/college.service';
import departmentService from '../../services/department.service';
import useScope from '../../hooks/useScope';
import Button from '../../components/ui/button';
import Badge from '../../components/ui/badge';
import ScheduleHeader from '../../components/timetable/ScheduleHeader';
import ScheduleToolbar from '../../components/timetable/ScheduleToolbar';
import { ScheduleView } from '../../components/timetable/ScheduleView';
import { generateHourlyTimes } from '../../utils/scheduleConfig';
import { getScheduleFilterPermissions, API_SCHEDULE_DAYS } from '../../utils/scheduleFilterRules';
import { logger } from '../../lib/logger';
import type { College, Department } from '../../types/timetable.types';
import type { TimetableDayRecord, ScheduleSlot } from './DoctorSchedule';

export interface WeeklyScheduleProps {
  isStudentView?: boolean;
}

export function WeeklySchedule({ isStudentView }: WeeklyScheduleProps = {}) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { isRTL } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const isStudent = isStudentView || user?.role === 'STUDENT' || location.pathname.includes('/student');
  const canManage = user?.role ? ['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'].includes(user.role) : false;
  const { scopeParams, isCollegeAdmin, hideCollegeSelector, hideDepartmentSelector } = useScope();

  const effectiveRole = isStudent ? 'STUDENT' : user?.role;
  const filterPermissions = useMemo(() => getScheduleFilterPermissions(effectiveRole), [effectiveRole]);

  // Metadata Lists (Colleges & Departments for Admins/Staff)
  const [colleges, setColleges] = useState<College[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCollege, setSelectedCollege] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedSemester, setSelectedSemester] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedDayFilter, setSelectedDayFilter] = useState('');
  const [selectedSlotType, setSelectedSlotType] = useState('all');
  const [scheduleViewMode, setScheduleViewMode] = useState<'grid' | 'agenda'>('grid');

  // Timetable Data
  const [rawSlots, setRawSlots] = useState<ScheduleSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? (isRTL ? 'مساءً' : 'PM') : (isRTL ? 'صباحاً' : 'AM');
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  // Fetch Colleges for Admins
  useEffect(() => {
    if (canManage) {
      collegeService
        .getColleges()
        .then((res) => {
          if (res.success) setColleges(Array.isArray(res.data) ? res.data : res.data?.data || []);
        })
        .catch(() => {});
    }
  }, [canManage]);

  const handleCollegeChange = (val: string) => {
    setSelectedCollege(val);
    setSelectedDept('');
    if (val) {
      departmentService
        .getDepartments({ collegeId: val })
        .then((res) => {
          if (res.success) setDepartments(Array.isArray(res.data) ? res.data : res.data?.data || []);
        })
        .catch(() => {});
    } else {
      setDepartments([]);
    }
  };

  // Fetch Schedule Data
  const fetchTargetedTimetable = useCallback(
    async (isPolling = false) => {
      try {
        if (!isPolling) setLoading(true);
        if (!isPolling) setError(null);

        const params: Record<string, unknown> = { ...scopeParams };
        if (!isCollegeAdmin) {
          if (selectedCollege) params.collegeId = selectedCollege;
          if (selectedDept) params.departmentId = selectedDept;
        }
        if (selectedYear) params.year = selectedYear;
        if (selectedSemester) params.semester = selectedSemester;

        const result = await schedulesService.getAllWeeklyTimetable(params);
        if (result.success && result.data && Array.isArray(result.data)) {
          const slots: ScheduleSlot[] = result.data.map((slot: ScheduleSlotData) => ({
            id: slot.id,
            isArchived: slot.isArchived,
            dayOfWeek: slot.dayOfWeek || slot.day || '',
            startTime: slot.startTime || '',
            endTime: slot.endTime,
            room: slot.room,
            slotType: slot.slotType,
            year: slot.year ?? (slot.course as any)?.year,
            semester: slot.semester ?? (slot.course as any)?.semester,
            doctorId: slot.doctorId,
            doctor: slot.doctor,
            teachingAssistantId: slot.teachingAssistantId,
            teachingAssistant: slot.teachingAssistant,
            courseId: slot.courseId,
            course: slot.course
              ? {
                  id: slot.course.id,
                  name: slot.course.name,
                  courseCode: slot.course.code,
                  departmentId: slot.departmentId,
                  department: slot.department as any,
                }
              : null,
            groupId: slot.groupId,
            group: slot.group,
          }));
          setRawSlots(slots);
        } else {
          setRawSlots([]);
        }
      } catch (err: unknown) {
        logger.error('Error fetching timetable:', err);
        setError(t('common.errorFetching', 'Failed to load schedule'));
      } finally {
        if (!isPolling) setLoading(false);
      }
    },
    [isCollegeAdmin, scopeParams, selectedCollege, selectedDept, selectedSemester, selectedYear, t]
  );

  useEffect(() => {
    fetchTargetedTimetable();

    // Gentle polling interval (15s) for real-time synchronization without UI flashing
    const interval = setInterval(() => {
      fetchTargetedTimetable(true);
    }, 15000);

    return () => clearInterval(interval);
  }, [fetchTargetedTimetable]);

  // Enrolled courses derived from loaded schedule slots
  const enrolledCourses = useMemo(() => {
    const map = new Map<number | string, { id: number | string; name: string; courseCode?: string }>();
    rawSlots.forEach((slot) => {
      const c = slot.course;
      if (c?.id) {
        map.set(c.id, {
          id: c.id,
          name: c.name || '',
          courseCode: c.courseCode || (c as any).code || '',
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [rawSlots]);

  // Multi-dimensional client-side filtering
  const filteredSlots = useMemo(() => {
    return rawSlots.filter((slot) => {
      // Slot Type Filter
      if (selectedSlotType !== 'all' && slot.slotType !== selectedSlotType) {
        return false;
      }

      // Course Filter (own enrolled courses for student)
      if (selectedCourse) {
        const cId = slot.course?.id;
        if (!cId || String(cId) !== String(selectedCourse)) return false;
      }

      // Day of Week Filter (canonical API day values)
      if (selectedDayFilter && selectedDayFilter !== 'all') {
        const slotDay = String(slot.dayOfWeek || '').trim().toUpperCase();
        if (slotDay !== selectedDayFilter.toUpperCase()) return false;
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

      // Department Filter (in case broader scope returned multiple)
      if (selectedDept) {
        const deptId = slot.course?.departmentId || slot.course?.department?.id;
        if (deptId && String(deptId) !== String(selectedDept)) return false;
      }

      // College Filter
      if (selectedCollege) {
        const colId = slot.course?.department?.collegeId || slot.course?.department?.college?.id;
        if (colId && String(colId) !== String(selectedCollege)) return false;
      }

      // Search Query Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const courseName = (slot.course?.name || '').toLowerCase();
        const courseCode = (slot.course?.courseCode || '').toLowerCase();
        const docFull = `${slot.doctor?.firstName || ''} ${slot.doctor?.lastName || ''}`.toLowerCase();
        const taFull = `${slot.teachingAssistant?.firstName || ''} ${slot.teachingAssistant?.lastName || ''}`.toLowerCase();
        const roomName = (slot.room || '').toLowerCase();
        const groupName = (slot.group?.name || '').toLowerCase();
        const deptName = (slot.course?.department?.name || slot.course?.department?.nameAr || '').toLowerCase();

        const matches =
          courseName.includes(q) ||
          courseCode.includes(q) ||
          docFull.includes(q) ||
          taFull.includes(q) ||
          roomName.includes(q) ||
          groupName.includes(q) ||
          deptName.includes(q);

        if (!matches) return false;
      }

      return true;
    });
  }, [rawSlots, selectedSlotType, selectedCourse, selectedDayFilter, selectedYear, selectedSemester, selectedDept, selectedCollege, searchQuery]);

  // Group filtered slots into Days Record for ScheduleView
  const timetableRecord = useMemo<TimetableDayRecord>(() => {
    return filteredSlots.reduce((acc: TimetableDayRecord, slot: ScheduleSlot) => {
      if (!slot.dayOfWeek) return acc;
      const dayName = slot.dayOfWeek.charAt(0).toUpperCase() + slot.dayOfWeek.slice(1).toLowerCase();
      if (!acc[dayName]) acc[dayName] = [];
      acc[dayName].push(slot);
      return acc;
    }, {});
  }, [filteredSlots]);

  // Statistics calculation for Top KPI Cards
  const totalSlots = filteredSlots.length;
  const distinctCourses = useMemo(
    () => new Set(filteredSlots.map((s) => s.courseId || s.course?.id || s.course?.name).filter(Boolean)).size,
    [filteredSlots]
  );
  const distinctRooms = useMemo(
    () => new Set(filteredSlots.map((s) => s.room).filter(Boolean)).size,
    [filteredSlots]
  );
  const distinctInstructors = useMemo(() => {
    const instructors = new Set<string>();
    filteredSlots.forEach((s) => {
      if (s.doctorId || s.doctor?.id) {
        instructors.add(`doc_${s.doctorId || s.doctor?.id}`);
      } else if (s.doctor?.firstName) {
        instructors.add(`doc_${s.doctor.firstName}_${s.doctor.lastName}`);
      }
      if (s.teachingAssistantId || s.teachingAssistant?.id) {
        instructors.add(`ta_${s.teachingAssistantId || s.teachingAssistant?.id}`);
      } else if (s.teachingAssistant?.firstName) {
        instructors.add(`ta_${s.teachingAssistant.firstName}_${s.teachingAssistant.lastName}`);
      }
    });
    return instructors.size;
  }, [filteredSlots]);

  // First available slot for contextual subtitle info
  const firstSlot = rawSlots[0];
  const detectedDeptName = firstSlot?.course?.department?.name;
  const detectedCollegeName = firstSlot?.course?.department?.college?.name;
  const detectedYear = user?.student?.year || firstSlot?.year || firstSlot?.course?.year;

  // Title & Subtitle construction
  const displayName = isStudent
    ? `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || (isRTL ? 'الجدول الدراسي للطالب' : 'Student Weekly Timetable')
    : isRTL
    ? 'الجدول الدراسي الأسبوعي'
    : 'Weekly Academic Timetable';

  const deptNameDisplay =
    user?.department?.name ||
    detectedDeptName ||
    (isRTL ? 'جامعة 6 أكتوبر التكنولوجية • الجدول المعتمد' : '6th of October Technological University • Official Timetable');

  const fullSubtitle = detectedCollegeName && !deptNameDisplay.includes(detectedCollegeName)
    ? `${deptNameDisplay} • ${detectedCollegeName}`
    : deptNameDisplay;

  const resetFilters = () => {
    setSelectedCollege('');
    setSelectedDept('');
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
        title={displayName}
        subtitle={fullSubtitle}
        icon={user?.firstName ? user.firstName[0] : <Calendar size={22} />}
        roleBadge={
          isStudent
            ? t('schedules.enrolledStudent', 'Enrolled Student')
            : t('schedules.officialTimetable', 'Official Timetable')
        }
        statusBadge={
          detectedYear ? (
            <Badge variant="neutral" className="text-[10px] font-bold">
              {t('schedules.academicYearBadge', `Year ${detectedYear}`, { year: detectedYear })}
            </Badge>
          ) : undefined
        }
        canManage={canManage}
        onManage={() => navigate('/timetables-management')}
        showPrint={true}
        onPrint={() => window.print()}
        onRefresh={() => fetchTargetedTimetable()}
        isRefreshing={loading}
      />

      {/* 2. UNIFIED COMPACT FILTER TOOLBAR */}
      <ScheduleToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder={t('schedules.searchWeeklySchedulePlaceholder')}
        hasActiveFilters={Boolean(
          (filterPermissions.college && canManage && !isCollegeAdmin && !hideCollegeSelector && selectedCollege) ||
          (filterPermissions.department && canManage && !hideDepartmentSelector && selectedDept) ||
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
        {/* College Filter (Admins / Staff) */}
        {filterPermissions.college && canManage && !isCollegeAdmin && !hideCollegeSelector && (
          <select
            value={selectedCollege}
            onChange={(e) => handleCollegeChange(e.target.value)}
            aria-label={isRTL ? 'كل الكليات' : 'All Colleges'}
            className="h-8.5 px-3 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-brand-primary-500 cursor-pointer"
          >
            <option value="">{isRTL ? 'كل الكليات' : 'All Colleges'}</option>
            {colleges.map((c) => (
              <option key={c.id} value={c.id}>
                {isRTL ? c.nameAr || c.name : c.name}
              </option>
            ))}
          </select>
        )}

        {/* Department Filter (Admins / Staff) */}
        {filterPermissions.department && canManage && !hideDepartmentSelector && (
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            disabled={!selectedCollege && departments.length === 0}
            aria-label={isRTL ? 'كل الأقسام' : 'All Departments'}
            className="h-8.5 px-3 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-brand-primary-500 cursor-pointer disabled:opacity-50"
          >
            <option value="">{isRTL ? 'كل الأقسام' : 'All Departments'}</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {isRTL ? d.nameAr || d.name : d.name}
              </option>
            ))}
          </select>
        )}

        {/* Course Filter (own enrolled courses only for students, built from loaded data) */}
        {filterPermissions.course && enrolledCourses.length > 0 && (
          <select
            value={selectedCourse}
            onChange={(e) => setSelectedCourse(e.target.value)}
            aria-label={t('schedules.filterByCourse', 'Filter by course')}
            className="h-8.5 px-3 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-brand-primary-500 cursor-pointer max-w-[200px]"
          >
            <option value="">{t('schedules.allCourses', 'All Courses')}</option>
            {enrolledCourses.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.courseCode ? `${c.courseCode} - ${c.name}` : c.name}
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
            <option value="">{isRTL ? 'كل السنوات' : 'All Years'}</option>
            {[1, 2, 3, 4].map((yr) => (
              <option key={yr} value={yr.toString()}>
                {isRTL ? `الفرقة ${yr}` : `Year ${yr}`}
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
            <option value="">{isRTL ? 'كل الفصول' : 'All Semesters'}</option>
            <option value="1">{isRTL ? 'الفصل 1' : 'Sem 1'}</option>
            <option value="2">{isRTL ? 'الفصل 2' : 'Sem 2'}</option>
            <option value="3">{isRTL ? 'الصيفي' : 'Summer'}</option>
          </select>
        )}

        {/* Session Type */}
        {filterPermissions.type && (
          <select
            value={selectedSlotType}
            onChange={(e) => setSelectedSlotType(e.target.value)}
            aria-label={t('schedules.filterBySessionType', 'Session type')}
            className="h-8.5 px-3 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-brand-primary-500 cursor-pointer"
          >
            <option value="all">{t('schedules.allSessions', 'All Sessions')}</option>
            <option value="LECTURE">{t('schedule.lecture', 'Lectures')}</option>
            <option value="LAB">{t('schedule.lab', 'Labs')}</option>
          </select>
        )}

        {/* Day Filter */}
        {filterPermissions.day && (
          <select
            value={selectedDayFilter}
            onChange={(e) => setSelectedDayFilter(e.target.value)}
            aria-label={t('schedules.filterByDay', 'Filter by day')}
            className="h-8.5 px-3 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-brand-primary-500 cursor-pointer"
          >
            <option value="">{t('schedules.allDays', 'All Days')}</option>
            {API_SCHEDULE_DAYS.map((day) => (
              <option key={day} value={day}>
                {t(`days.${day.toLowerCase()}`, day)}
              </option>
            ))}
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
            {isRTL ? 'جاري تحميل الجدول الدراسي...' : 'Fetching academic timetable...'}
          </p>
        </div>
      ) : error ? (
        <div className="p-8 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-700 shadow-2xs text-center">
          <AlertTriangle size={32} className="text-rose-500 mx-auto mb-2" />
          <p className="text-xs font-bold text-rose-600 mb-3">{error}</p>
          <Button size="sm" onClick={() => fetchTargetedTimetable()} className="text-xs font-bold">
            {isRTL ? 'إعادة المحاولة' : 'Retry'}
          </Button>
        </div>
      ) : totalSlots === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-700 shadow-2xs">
          <div className="w-12 h-12 rounded-2xl bg-brand-primary-50 dark:bg-brand-primary-950/50 text-brand-primary-600 flex items-center justify-center mx-auto mb-3">
            <Calendar size={24} />
          </div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
            {isRTL ? 'لا توجد محاضرات أو سكاشن مسجلة' : 'No Scheduled Sessions Found'}
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
            {isRTL
              ? 'لم يتم العثور على أي حصص أو محاضرات وفقاً لمعايير التصفية الحالية.'
              : 'No scheduled sessions were found matching your current filter criteria.'}
          </p>

          <div className="flex items-center justify-center gap-2 flex-wrap">
            {(selectedCollege || selectedDept || selectedYear || selectedSemester || selectedSlotType !== 'all' || searchQuery) ? (
              <Button size="sm" variant="outline" onClick={resetFilters} className="text-xs font-bold gap-1.5">
                <RotateCcw size={13} />
                <span>{isRTL ? 'مسح الفلاتر وإعادة الضبط' : 'Reset Filters'}</span>
              </Button>
            ) : canManage ? (
              <Button
                size="sm"
                onClick={() => navigate('/timetables-management')}
                className="bg-brand-primary-600 hover:bg-brand-primary-700 text-white text-xs font-bold gap-1.5 shadow-xs"
              >
                <Layers size={14} />
                <span>{isRTL ? 'إدارة وتسكين الجداول' : 'Manage Timetables'}</span>
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <ScheduleView
          timetable={timetableRecord}
          role="STUDENT"
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

export default WeeklySchedule;
