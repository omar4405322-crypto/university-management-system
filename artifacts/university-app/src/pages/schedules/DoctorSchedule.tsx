import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../context/LanguageContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  AlertTriangle,
  CheckCircle2,
  Clock,
  Search,
  RotateCcw,
  GraduationCap,
  Layers,
  X,
  Plus,
  ArrowRight,
  LayoutGrid,
  ListOrdered,
} from 'lucide-react';
import schedulesService from '../../services/schedules.service';
import doctorsService from '../../services/doctors.service';
import collegeService from '../../services/college.service';
import departmentService from '../../services/department.service';
import SearchableSelect, { SelectOption } from '../../components/ui/SearchableSelect';
import Pagination from '../../components/ui/pagination';
import Button from '../../components/ui/button';
import Badge from '../../components/ui/badge';
import ScheduleHeader from '../../components/timetable/ScheduleHeader';
import ScheduleToolbar from '../../components/timetable/ScheduleToolbar';
import { ScheduleView } from '../../components/timetable/ScheduleView';
import { generateHourlyTimes } from '../../utils/scheduleConfig';
import { logger } from '../../lib/logger';

const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

export interface ScheduleSlot {
  id?: number | string;
  isArchived?: boolean;
  archivedAt?: string | null;
  dayOfWeek: string;
  startTime: string;
  endTime?: string;
  room?: string | null;
  slotType?: string;
  year?: number;
  semester?: number;
  doctorId?: number | string;
  doctor?: {
    id?: number | string;
    firstName?: string;
    lastName?: string;
  } | null;
  teachingAssistantId?: string | number;
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

export type TimetableDayRecord = Record<string, ScheduleSlot[]>;

export function DoctorSchedule() {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const { isRTL } = useLanguage();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Metadata Lists
  const [doctorsList, setDoctorsList] = useState<any[]>([]);
  const [collegesList, setCollegesList] = useState<any[]>([]);
  const [departmentsList, setDepartmentsList] = useState<any[]>([]);

  // Filter States
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>(
    searchParams.get('doctorId') || (user?.role === 'DOCTOR' ? String(user.doctor?.id || user.id) : 'all')
  );
  const [selectedCollegeId, setSelectedCollegeId] = useState<string>('all');
  const [selectedDeptId, setSelectedDeptId] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedSemester, setSelectedSemester] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showConflictsOnly, setShowConflictsOnly] = useState<boolean>(false);
  const [scheduleViewMode, setScheduleViewMode] = useState<'grid' | 'agenda'>('grid');

  // Raw Schedule Data
  const [rawSlots, setRawSlots] = useState<ScheduleSlot[]>([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const limit = 50;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = user?.role ? ['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'].includes(user.role) : false;

  // 1. Fetch Doctor, College, and Department Metadata
  useEffect(() => {
    Promise.all([
      doctorsService.getDoctors({ limit: 200 }).catch(() => ({ data: [] })),
      collegeService.getColleges({ limit: 100 }).catch(() => ({ data: [] })),
      departmentService.getDepartments({ limit: 200 }).catch(() => ({ data: [] })),
    ]).then(([docRes, colRes, deptRes]) => {
      const docs = Array.isArray(docRes?.data) ? docRes.data : docRes?.data?.doctors || docRes?.data?.data || [];
      const cols = Array.isArray(colRes?.data) ? colRes.data : colRes?.data?.data || [];
      const depts = Array.isArray(deptRes?.data) ? deptRes.data : [];

      setDoctorsList(docs);
      setCollegesList(cols);
      setDepartmentsList(depts);

      // Auto-set doctor if logged in as DOCTOR
      if (user?.role === 'DOCTOR') {
        const myDoc = docs.find((d: any) => d.userId === user.id || d.id === user.doctor?.id);
        if (myDoc) setSelectedDoctorId(String(myDoc.id));
      }
    });
  }, [user]);

  // Format Doctor Name Cleanly
  const formatDoctorName = useCallback((doc: any) => {
    if (!doc) return '';
    const raw = `${doc.firstName || ''} ${doc.lastName || ''}`.trim();
    const cleaned = raw.replace(/^(Dr\.|د\.)\s*(Dr\.|د\.)?/i, '').trim();
    const title = doc.academicRank || (isRTL ? 'د.' : 'Dr.');
    return `${title} ${cleaned}`.trim();
  }, [isRTL]);

  const doctorOptions = useMemo(() => {
    const opts: SelectOption[] = [
      {
        label: isRTL ? 'الكل — الجدول الشامل لجميع أعضاء هيئة التدريس' : 'All Faculty Members (University Master Schedule)',
        value: 'all',
      },
    ];
    doctorsList.forEach((d) => {
      opts.push({
        label: formatDoctorName(d),
        value: String(d.id),
        sublabel: d.department?.name || '',
        group: d.department?.name || (isRTL ? 'عضو هيئة تدريس' : 'Faculty Member'),
      });
    });
    return opts;
  }, [doctorsList, isRTL, formatDoctorName]);

  const activeDoctor = useMemo(() => {
    if (!selectedDoctorId || selectedDoctorId === 'all') return null;
    return doctorsList.find((d) => String(d.id) === String(selectedDoctorId));
  }, [doctorsList, selectedDoctorId]);

  // Cascading departments for selected college
  const filteredDepartments = useMemo(() => {
    if (!selectedCollegeId || selectedCollegeId === 'all') return departmentsList;
    const colId = parseInt(selectedCollegeId, 10);
    return departmentsList.filter((d) => d.collegeId === colId);
  }, [departmentsList, selectedCollegeId]);

  // 2. Fetch the filtered schedule page (lectures only)
  const fetchSchedule = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await schedulesService.getSchedules({
        doctorId: selectedDoctorId !== 'all' ? selectedDoctorId : undefined,
        collegeId: selectedCollegeId !== 'all' ? selectedCollegeId : undefined,
        departmentId: selectedDeptId !== 'all' ? selectedDeptId : undefined,
        year: selectedYear || undefined,
        semester: selectedSemester || undefined,
        slotType: 'LECTURE',
        page,
        limit,
      });
      let slotsData: any[] = [];
      if (res.success || res.data) {
        slotsData = Array.isArray(res.data)
          ? res.data
          : res.data?.schedules || res.data?.data || [];
      }
      // Exclude Lab slots since they have their dedicated TA Schedule section
      const lectureSlots = slotsData.filter(
        (slot: any) => slot.slotType !== 'LAB'
      );
      setRawSlots(lectureSlots);
      setPagination(res.pagination || { total: lectureSlots.length, totalPages: 1 });
    } catch (err: any) {
      logger.error('Error fetching university schedule:', err);
      setError(err.message || t('common.fetchError', 'Failed to load schedules'));
    } finally {
      setLoading(false);
    }
  }, [page, selectedCollegeId, selectedDeptId, selectedDoctorId, selectedSemester, selectedYear, t]);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  useEffect(() => {
    setPage(1);
  }, [selectedCollegeId, selectedDeptId, selectedDoctorId, selectedSemester, selectedYear]);

  // 3. Multi-Dimensional Master Filtering Logic
  const filteredSlots = useMemo(() => {
    return rawSlots.filter((slot) => {
      // Exclude Lab slots (they belong exclusively to TA Schedule)
      if (slot.slotType === 'LAB') return false;

      // Doctor Filter
      if (selectedDoctorId && selectedDoctorId !== 'all') {
        const slotDocId = String(slot.doctorId || slot.doctor?.id || '');
        if (slotDocId !== selectedDoctorId) return false;
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

      // Search Query Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const courseName = (slot.course?.name || '').toLowerCase();
        const courseCode = (slot.course?.courseCode || '').toLowerCase();
        const docFull = `${slot.doctor?.firstName || ''} ${slot.doctor?.lastName || ''}`.toLowerCase();
        const roomName = (slot.room || '').toLowerCase();
        const groupName = (slot.group?.name || '').toLowerCase();
        const deptName = (slot.course?.department?.name || slot.course?.department?.nameAr || '').toLowerCase();

        const matches =
          courseName.includes(q) ||
          courseCode.includes(q) ||
          docFull.includes(q) ||
          roomName.includes(q) ||
          groupName.includes(q) ||
          deptName.includes(q);

        if (!matches) return false;
      }

      return true;
    });
  }, [
    rawSlots,
    selectedDoctorId,
    selectedCollegeId,
    selectedDeptId,
    selectedYear,
    selectedSemester,
    searchQuery,
  ]);

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

  // Accurate Resource Collision Helper
  const checkTimeOverlap = (s1: ScheduleSlot, s2: ScheduleSlot) => {
    const start1 = s1.startTime || '00:00';
    const end1 = s1.endTime || (start1 ? `${parseInt(start1.split(':')[0], 10) + 2}:00` : '23:59');
    const start2 = s2.startTime || '00:00';
    const end2 = s2.endTime || (start2 ? `${parseInt(start2.split(':')[0], 10) + 2}:00` : '23:59');
    return start1 < end2 && end1 > start2;
  };

  const areSlotsInConflict = useCallback((s1: ScheduleSlot, s2: ScheduleSlot) => {
    if (s1 === s2) return false;
    if (s1.id !== undefined && s2.id !== undefined && s1.id === s2.id) return false;
    if (!checkTimeOverlap(s1, s2)) return false;

    // 1. Same Room Collision
    if (s1.room && s2.room && s1.room.trim() && s2.room.trim()) {
      if (s1.room.trim().toLowerCase() === s2.room.trim().toLowerCase()) {
        return true;
      }
    }

    // 2. Same Doctor Collision
    const doc1 = String(s1.doctorId || s1.doctor?.id || '').trim();
    const doc2 = String(s2.doctorId || s2.doctor?.id || '').trim();
    if (doc1 && doc2 && doc1 === doc2) {
      return true;
    }

    // 3. Same TA Collision
    const ta1 = String(s1.teachingAssistantId || s1.teachingAssistant?.id || '').trim();
    const ta2 = String(s2.teachingAssistantId || s2.teachingAssistant?.id || '').trim();
    if (ta1 && ta2 && ta1 === ta2) {
      return true;
    }

    // 4. Same Group Collision
    const g1 = String(s1.groupId || s1.group?.id || '').trim();
    const g2 = String(s2.groupId || s2.group?.id || '').trim();
    if (g1 && g2 && g1 === g2) {
      return true;
    }

    return false;
  }, []);

  // Conflict calculation (identifies truly conflicting slots)
  const conflictingSlotKeys = useMemo(() => {
    const keys = new Set<string | number>();
    Object.values(timetableRecord).forEach((slots: ScheduleSlot[]) => {
      for (let i = 0; i < slots.length; i++) {
        for (let j = i + 1; j < slots.length; j++) {
          if (areSlotsInConflict(slots[i], slots[j])) {
            const key1 = slots[i].id !== undefined ? slots[i].id! : `${slots[i].dayOfWeek}_${slots[i].startTime}_${slots[i].course?.name}_${i}`;
            const key2 = slots[j].id !== undefined ? slots[j].id! : `${slots[j].dayOfWeek}_${slots[j].startTime}_${slots[j].course?.name}_${j}`;
            keys.add(key1);
            keys.add(key2);
          }
        }
      }
    });
    return keys;
  }, [timetableRecord, areSlotsInConflict]);

  const conflictCount = conflictingSlotKeys.size;

  // Filter for Conflicting slots only if toggled
  const displayTimetable = useMemo<TimetableDayRecord>(() => {
    if (!showConflictsOnly) return timetableRecord;

    const conflictRecord: TimetableDayRecord = {};
    Object.entries(timetableRecord).forEach(([day, slots]: [string, ScheduleSlot[]]) => {
      const conflictingSlots = slots.filter((s: ScheduleSlot, idx: number) => {
        const slotKey = s.id !== undefined ? s.id : `${s.dayOfWeek}_${s.startTime}_${s.course?.name}_${idx}`;
        return conflictingSlotKeys.has(slotKey);
      });

      if (conflictingSlots.length > 0) {
        conflictRecord[day] = conflictingSlots;
      }
    });

    return conflictRecord;
  }, [timetableRecord, showConflictsOnly, conflictingSlotKeys]);

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
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? (isRTL ? 'مساءً' : 'PM') : (isRTL ? 'صباحاً' : 'AM');
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  // Statistics
  const totalSlots = filteredSlots.length;
  const distinctCourses = useMemo(
    () => new Set(filteredSlots.map((s) => s.course?.id || s.course?.name).filter(Boolean)).size,
    [filteredSlots]
  );
  const distinctDoctors = useMemo(
    () => new Set(filteredSlots.map((s) => s.doctorId || s.doctor?.id).filter(Boolean)).size,
    [filteredSlots]
  );
  const distinctRooms = useMemo(
    () => new Set(filteredSlots.map((s) => s.room).filter(Boolean)).size,
    [filteredSlots]
  );

  const doctorNameDisplay =
    (activeDoctor
      ? formatDoctorName(activeDoctor)
      : selectedDoctorId === 'all'
      ? (isRTL ? 'الجدول الشامل لجميع المحاضرات والأساتذة' : 'University Master Lecture Schedule')
      : `${user?.firstName || ''} ${user?.lastName || ''}`.trim()) ||
    (isRTL ? 'جدول المحاضرات' : 'Lecture Schedule');

  const deptNameDisplay =
    activeDoctor?.department?.name ||
    (selectedDoctorId === 'all'
      ? isRTL ? 'جامعة 6 أكتوبر التكنولوجية • جميع الأقسام والقاعات' : '6th of October Technological University • All Departments'
      : user?.department?.name || '');

  const resetFilters = () => {
    setSelectedDoctorId(user?.role === 'DOCTOR' ? String(user.doctor?.id || user.id) : 'all');
    setSelectedCollegeId('all');
    setSelectedDeptId('all');
    setSelectedYear('');
    setSelectedSemester('');
    setSearchQuery('');
    setShowConflictsOnly(false);
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* 1. UNIFIED SCHEDULE HEADER */}
      <ScheduleHeader
        title={doctorNameDisplay}
        subtitle={deptNameDisplay}
        icon={activeDoctor ? activeDoctor.firstName?.[0] : <Calendar size={22} />}
        roleBadge={
          activeDoctor
            ? t('schedules.professorBadge', 'Professor')
            : t('schedules.masterScheduleBadge', 'Master Schedule')
        }
        canManage={isAdmin}
        onManage={() => navigate('/timetables-management')}
        showPrint={true}
        onPrint={() => window.print()}
        onRefresh={fetchSchedule}
        isRefreshing={loading}
      />

      {/* 2. UNIFIED COMPACT FILTER TOOLBAR */}
      <ScheduleToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder={t('schedules.searchDoctorSchedulePlaceholder')}
        hasActiveFilters={Boolean(
          selectedDoctorId !== 'all' ||
          selectedCollegeId !== 'all' ||
          selectedDeptId !== 'all' ||
          selectedYear ||
          selectedSemester ||
          searchQuery ||
          showConflictsOnly
        )}
        onResetFilters={resetFilters}
        viewMode={scheduleViewMode}
        onViewModeChange={setScheduleViewMode}
      >
        {/* Doctor Switcher (Admins & Staff) */}
        {(isAdmin || user?.role !== 'DOCTOR') && (
          <div className="w-56">
            <SearchableSelect
              options={doctorOptions}
              value={selectedDoctorId}
              onChange={(val) => {
                setSelectedDoctorId(val);
                setSearchParams(val !== 'all' ? { doctorId: val } : {});
              }}
              placeholder={isRTL ? 'اختر الدكتور' : 'Select Doctor'}
              searchPlaceholder={isRTL ? 'ابحث عن اسم الدكتور...' : 'Search doctor...'}
              emptyText={isRTL ? 'لم يتم العثور على أي دكتور' : 'No doctors found'}
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
          aria-label={isRTL ? 'كل الكليات' : 'All Colleges'}
          className="h-8.5 px-3 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-brand-primary-500 cursor-pointer"
        >
          <option value="all">{isRTL ? 'كل الكليات' : 'All Colleges'}</option>
          {collegesList.map((col) => (
            <option key={col.id} value={col.id}>
              {isRTL ? col.nameAr || col.name : col.name}
            </option>
          ))}
        </select>

        {/* Department Filter */}
        <select
          value={selectedDeptId}
          onChange={(e) => setSelectedDeptId(e.target.value)}
          disabled={selectedCollegeId === 'all' && filteredDepartments.length === 0}
          aria-label={isRTL ? 'كل الأقسام' : 'All Departments'}
          className="h-8.5 px-3 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-brand-primary-500 cursor-pointer disabled:opacity-50"
        >
          <option value="all">{isRTL ? 'كل الأقسام' : 'All Departments'}</option>
          {filteredDepartments.map((d) => (
            <option key={d.id} value={d.id}>
              {isRTL ? d.nameAr || d.name : d.name}
            </option>
          ))}
        </select>

        {/* Academic Year */}
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(e.target.value)}
          aria-label={isRTL ? 'تصفية حسب السنة' : 'Filter by year'}
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
          aria-label={isRTL ? 'تصفية حسب الفصل الدراسي' : 'Filter by semester'}
          className="h-8.5 px-3 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-brand-primary-500 cursor-pointer"
        >
          <option value="">{isRTL ? 'كل الفصول' : 'All Semesters'}</option>
          <option value="1">{isRTL ? 'الفصل 1' : 'Sem 1'}</option>
          <option value="2">{isRTL ? 'الفصل 2' : 'Sem 2'}</option>
          <option value="3">{isRTL ? 'الصيفي' : 'Summer'}</option>
        </select>

        {/* Conflicts Toggle */}
        {conflictCount > 0 && (
          <button
            type="button"
            onClick={() => setShowConflictsOnly(!showConflictsOnly)}
            className={`h-8.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              showConflictsOnly
                ? 'bg-rose-600 text-white'
                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 border border-rose-200 dark:border-rose-800'
            }`}
          >
            <AlertTriangle size={13} />
            <span>
              {isRTL ? `تعارضات (${conflictCount})` : `Conflicts (${conflictCount})`}
            </span>
          </button>
        )}
      </ScheduleToolbar>

      {/* ========================================================================= */}
      {/* 4. SCHEDULE TIMETABLE GRID                                                */}
      {/* ========================================================================= */}
      {loading ? (
        <div className="p-12 text-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-700 shadow-2xs">
          <Loader2 size={32} className="animate-spin text-brand-primary-600 mx-auto mb-2" />
          <p className="text-xs text-slate-400 font-semibold">
            {isRTL ? 'جاري تحميل جدول المحاضرات...' : 'Fetching lecture schedule...'}
          </p>
        </div>
      ) : error ? (
        <div className="p-8 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-700 shadow-2xs text-center">
          <AlertTriangle size={32} className="text-rose-500 mx-auto mb-2" />
          <p className="text-xs font-bold text-rose-600 mb-3">{error}</p>
          <Button size="sm" onClick={fetchSchedule} className="text-xs font-bold">
            {isRTL ? 'إعادة المحاولة' : 'Retry'}
          </Button>
        </div>
      ) : totalSlots === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-700 shadow-2xs">
          <div className="w-12 h-12 rounded-2xl bg-brand-primary-50 dark:bg-brand-primary-950/50 text-brand-primary-600 flex items-center justify-center mx-auto mb-3">
            <Calendar size={24} />
          </div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
            {isRTL ? 'لا توجد محاضرات مسجلة' : 'No Scheduled Lectures Found'}
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
            {isRTL
              ? 'لم يتم العثور على أي محاضرات مسندة وفقاً لمعايير التصفية المحددة.'
              : 'No scheduled lectures were found matching your current filter criteria.'}
          </p>

          <div className="flex items-center justify-center gap-2 flex-wrap">
            {(selectedDoctorId !== 'all' || selectedCollegeId !== 'all' || selectedDeptId !== 'all' || selectedYear || selectedSemester || searchQuery) ? (
              <Button size="sm" variant="outline" onClick={resetFilters} className="text-xs font-bold gap-1.5">
                <RotateCcw size={13} />
                <span>{isRTL ? 'مسح الفلاتر وإعادة الضبط' : 'Reset Filters'}</span>
              </Button>
            ) : isAdmin ? (
              <Button
                size="sm"
                onClick={() => navigate('/timetables-management')}
                className="bg-brand-primary-600 hover:bg-brand-primary-700 text-white text-xs font-bold gap-1.5 shadow-xs"
              >
                <Plus size={14} />
                <span>{isRTL ? 'إضافة وتسكين جدول جديد' : 'Create & Assign Timetable'}</span>
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <ScheduleView
          timetable={displayTimetable}
          role="DOCTOR"
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
      {!loading && !error && pagination.totalPages > 1 && (
        <Pagination
          page={page}
          totalPages={pagination.totalPages}
          onPageChange={setPage}
          totalRecords={pagination.total}
          limit={limit}
        />
      )}
    </div>
  );
}

export default DoctorSchedule;
