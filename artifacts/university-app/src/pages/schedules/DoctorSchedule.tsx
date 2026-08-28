// @ts-nocheck
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
} from 'lucide-react';
import schedulesService from '../../services/schedules.service';
import doctorsService from '../../services/doctors.service';
import collegeService from '../../services/college.service';
import departmentService from '../../services/department.service';
import SearchableSelect from '../../components/ui/SearchableSelect';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/button';
import Badge from '../../components/ui/Badge';
import { ScheduleView } from '../../components/timetable/ScheduleView';
import { generateHourlyTimes } from '../../utils/scheduleConfig';
import { logger } from '../../lib/logger';

const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

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
  const [selectedSlotType, setSelectedSlotType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showConflictsOnly, setShowConflictsOnly] = useState<boolean>(false);

  // Raw Schedule Data
  const [rawSlots, setRawSlots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = ['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'].includes(user?.role);

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
  const formatDoctorName = (doc: any) => {
    if (!doc) return '';
    const raw = `${doc.firstName || ''} ${doc.lastName || ''}`.trim();
    const cleaned = raw.replace(/^(Dr\.|د\.)\s*(Dr\.|د\.)?/i, '').trim();
    const title = doc.academicRank || (isRTL ? 'د.' : 'Dr.');
    return `${title} ${cleaned}`.trim();
  };

  const doctorOptions = useMemo(() => {
    const opts = [
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
  }, [doctorsList, isRTL]);

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

  // 2. Fetch All Schedules across the University on Mount
  const fetchSchedule = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await schedulesService.getSchedules({});
      let slotsData: any[] = [];
      if (res.success || res.data) {
        slotsData = Array.isArray(res.data)
          ? res.data
          : res.data?.schedules || res.data?.data || [];
      }
      setRawSlots(slotsData);
    } catch (err: any) {
      logger.error('Error fetching university schedule:', err);
      setError(err.message || t('common.fetchError', 'Failed to load schedules'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  // 3. Multi-Dimensional Master Filtering Logic
  const filteredSlots = useMemo(() => {
    return rawSlots.filter((slot) => {
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

      // Slot Type Filter
      if (selectedSlotType !== 'all') {
        if (slot.slotType !== selectedSlotType) return false;
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
    selectedSlotType,
    searchQuery,
  ]);

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

  // Conflict calculation
  const conflictCount = useMemo(() => {
    let count = 0;
    Object.values(timetableRecord).forEach((slots) => {
      const hourCounts: Record<string, number> = {};
      slots.forEach((s) => {
        const hour = s.startTime?.split(':')[0] || '0';
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      });
      Object.values(hourCounts).forEach((c) => {
        if (c > 1) count += c;
      });
    });
    return count;
  }, [timetableRecord]);

  // Filter for Conflicting slots only if toggled
  const displayTimetable = useMemo(() => {
    if (!showConflictsOnly) return timetableRecord;

    const conflictRecord: Record<string, any[]> = {};
    Object.entries(timetableRecord).forEach(([day, slots]) => {
      const hourCounts: Record<string, number> = {};
      slots.forEach((s) => {
        const hour = s.startTime?.split(':')[0] || '0';
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      });

      const conflictingSlots = slots.filter((s) => {
        const hour = s.startTime?.split(':')[0] || '0';
        return hourCounts[hour] > 1;
      });

      if (conflictingSlots.length > 0) {
        conflictRecord[day] = conflictingSlots;
      }
    });

    return conflictRecord;
  }, [timetableRecord, showConflictsOnly]);

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

  // Counts by slotType
  const lectureCount = useMemo(() => filteredSlots.filter((s) => s.slotType === 'LECTURE').length, [filteredSlots]);
  const labCount = useMemo(() => filteredSlots.filter((s) => s.slotType === 'LAB' || s.slotType === 'SECTION').length, [filteredSlots]);

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

  const doctorNameDisplay = activeDoctor
    ? formatDoctorName(activeDoctor)
    : selectedDoctorId === 'all'
    ? isRTL ? 'الجدول الشامل لجميع المحاضرات والأساتذة' : 'University Master Lecture Schedule'
    : `${user?.firstName || ''} ${user?.lastName || ''}`;

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
    setSelectedSlotType('all');
    setSearchQuery('');
    setShowConflictsOnly(false);
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
              {activeDoctor ? activeDoctor.firstName?.[0] : <Calendar size={22} />}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  {doctorNameDisplay}
                </h1>
                <Badge variant="info" className="text-[10px] font-bold">
                  {activeDoctor ? isRTL ? 'أستاذ المادة' : 'Professor' : isRTL ? 'الجدول العام' : 'Master Schedule'}
                </Badge>
              </div>
              <p className="text-xs text-slate-400 font-semibold mt-0.5 flex items-center gap-1.5">
                <Building size={13} className="text-brand-primary-500" />
                <span>{deptNameDisplay}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/schedules/manage')}
                className="h-8 px-3 rounded-lg text-xs font-semibold border-slate-200 dark:border-slate-700 gap-1.5 cursor-pointer shadow-2xs"
              >
                <Layers size={13} />
                <span>{isRTL ? 'إدارة وتسكين الجداول' : 'Manage Timetables'}</span>
              </Button>
            )}

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
              onClick={fetchSchedule}
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
        {/* Total Lectures & Sessions */}
        <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-semibold block">
              {isRTL ? 'إجمالي المحاضرات والسكاشن' : 'Total Sessions'}
            </span>
            <span className="text-lg font-black text-slate-900 dark:text-white block mt-0.5">
              {loading ? '...' : totalSlots}
            </span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-brand-primary-50 dark:bg-brand-primary-950/50 text-brand-primary-600 flex items-center justify-center shrink-0">
            <Calendar size={16} />
          </div>
        </div>

        {/* Assigned Courses */}
        <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-semibold block">
              {isRTL ? 'المقررات المجدولة' : 'Assigned Courses'}
            </span>
            <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 block mt-0.5">
              {loading ? '...' : distinctCourses}
            </span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center shrink-0">
            <BookOpen size={16} />
          </div>
        </div>

        {/* Active Faculty Members */}
        <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-semibold block">
              {isRTL ? 'أعضاء هيئة التدريس' : 'Faculty Members'}
            </span>
            <span className="text-lg font-black text-purple-600 dark:text-purple-400 block mt-0.5">
              {loading ? '...' : distinctDoctors}
            </span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 flex items-center justify-center shrink-0">
            <GraduationCap size={16} />
          </div>
        </div>

        {/* Halls & Theaters */}
        <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-semibold block">
              {isRTL ? 'المدرجات والقاعات' : 'Lecture Halls'}
            </span>
            <span className="text-lg font-black text-blue-600 dark:text-blue-400 block mt-0.5">
              {loading ? '...' : distinctRooms}
            </span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center shrink-0">
            <MapPin size={16} />
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. UNIFIED 44px COMPACT FILTER TOOLBAR                                    */}
      {/* ========================================================================= */}
      <div className="p-2 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-700 shadow-2xs flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[170px]">
          <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isRTL ? 'بحث باسم المقرر، الكود، الدكتور أو القاعة...' : 'Search course, code, doctor, room...'}
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

        {/* Slot Type Toggle Tabs */}
        <div className="flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setSelectedSlotType('all')}
            className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
              selectedSlotType === 'all'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            {isRTL ? 'الكل' : 'All'} ({totalSlots})
          </button>
          <button
            onClick={() => setSelectedSlotType('LECTURE')}
            className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
              selectedSlotType === 'LECTURE'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            {isRTL ? 'محاضرة' : 'Lecture'} ({lectureCount})
          </button>
          <button
            onClick={() => setSelectedSlotType('LAB')}
            className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
              selectedSlotType === 'LAB'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            {isRTL ? 'معمل / سكشن' : 'Lab'} ({labCount})
          </button>
        </div>

        {/* Conflicts Toggle */}
        {conflictCount > 0 && (
          <button
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

        {/* Clear Filters */}
        {(selectedDoctorId !== 'all' ||
          selectedCollegeId !== 'all' ||
          selectedDeptId !== 'all' ||
          selectedYear ||
          selectedSemester ||
          selectedSlotType !== 'all' ||
          searchQuery ||
          showConflictsOnly) && (
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
            {isRTL ? 'لا توجد محاضرات أو سكاشن مسجلة' : 'No Scheduled Lectures Found'}
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
            {isRTL
              ? 'لم يتم العثور على أي محاضرات أو معامل مسندة وفقاً لمعايير التصفية المحددة.'
              : 'No scheduled lectures or sessions were found matching your current filter criteria.'}
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
                onClick={() => navigate('/schedules/manage')}
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
        />
      )}
    </div>
  );
}

export default DoctorSchedule;
