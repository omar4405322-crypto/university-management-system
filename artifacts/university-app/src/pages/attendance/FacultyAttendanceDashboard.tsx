// @ts-nocheck
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import {
  Users,
  Clock,
  Play,
  Square,
  RefreshCw,
  AlertTriangle,
  UserCheck,
  BookOpen,
  ChevronRight,
  ChevronLeft,
  Eye,
  Search,
  X,
  GraduationCap,
  QrCode,
  MapPin,
  XCircle,
  LayoutGrid,
  LayoutList,
  Building2,
  Layers,
  RotateCcw,
} from 'lucide-react';
import attendanceService from '../../services/attendance.service';
import collegeService from '../../services/college.service';
import departmentService from '../../services/department.service';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/button';
import { EmptyState } from '../../components/ui/EmptyState';
import Table, {
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../../components/ui/Table';
import { SessionCountdown } from '../../components/attendance/SessionCountdown';
import { ElapsedSessionTimer } from '../../components/attendance/ElapsedSessionTimer';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

const GRACE_PERIOD_OPTIONS = [5, 10, 15, 20, 30];

// Arabic normalization helper for resilient search matching
function normalizeArabic(text: string | null | undefined): string {
  if (!text) return '';
  return String(text)
    .trim()
    .toLowerCase()
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/\s+/g, ' ');
}

export function FacultyAttendanceDashboard() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { user } = useAuth();
  const navigate = useNavigate();

  const [courses, setCourses] = useState<any[]>([]);
  const [colleges, setColleges] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);

  const [searchParams, setSearchParams] = useSearchParams();

  // Search & Filters State
  const [search, setSearch] = useState('');
  const [selectedYear, setSelectedYear] = useState<string>('ALL');
  const [selectedCollege, setSelectedCollege] = useState<string>('ALL');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('ALL');
  const [selectedSection, setSelectedSection] = useState<string>('ALL');
  const [selectedSemester, setSelectedSemester] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Active Session states
  const [activeSession, setActiveSession] = useState<any>(null);
  const [qrToken, setQrToken] = useState('');
  const [timeLeft, setTimeLeft] = useState(10);
  const [flaggedRecords, setFlaggedRecords] = useState<any[]>([]);

  // Toggleable roster state
  const [activeTab, setActiveTab] = useState<'QR' | 'MANUAL' | 'GPS'>('QR');
  const [showRosterList, setShowRosterList] = useState(false);
  const [roster, setRoster] = useState<any[]>([]);
  const [rosterSearch, setRosterSearch] = useState('');
  const [rosterFilter, setRosterFilter] = useState<'PRESENT' | 'LATE' | 'FLAGGED' | 'ALL' | 'ABSENT'>('ALL');
  const [gracePeriods, setGracePeriods] = useState<Record<number, number>>({});

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timerRef = useRef<any>(null);
  const pollingRef = useRef<any>(null);
  const targetTimeRef = useRef<number>(0);

  // 1. Initial Load: Fetch Courses, Colleges, Departments
  const fetchInitialData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const [resCourses, resColleges, resDepartments] = await Promise.all([
        attendanceService.getMyCourses(),
        collegeService.getColleges().catch(() => ({ success: false, data: [] })),
        departmentService.getDepartments().catch(() => ({ success: false, data: [] })),
      ]);

      const loadedCourses = resCourses.data || [];
      setCourses(loadedCourses);

      if (resColleges.success && Array.isArray(resColleges.data)) {
        setColleges(resColleges.data);
      }
      if (resDepartments.success && Array.isArray(resDepartments.data)) {
        setDepartments(resDepartments.data);
      }

      const urlCourseId = searchParams.get('courseId');
      if (urlCourseId) {
        const parsedId = parseInt(urlCourseId, 10);
        const courseExists = loadedCourses.some((c: any) => c.id === parsedId);
        if (courseExists) {
          setSelectedCourseId(parsedId);
        }
      }
    } catch (err: any) {
      console.error('Failed to load initial attendance data:', err);
      setError(t('attendance.loadCoursesError', 'Failed to load courses'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [searchParams, t]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // 2. Load active session if course selected
  useEffect(() => {
    if (selectedCourseId) {
      checkActiveSession(selectedCourseId);
    } else {
      setActiveSession(null);
    }
  }, [selectedCourseId]);

  const checkActiveSession = async (courseId: number) => {
    try {
      setLoading(true);
      const res = await attendanceService.getActiveSession(courseId);
      setActiveSession(res.data || null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // 3. QR Token and Polling
  useEffect(() => {
    if (activeSession?.sessionId) {
      const stepSeconds = activeSession.codeStepSeconds || 20;
      targetTimeRef.current = Date.now() + stepSeconds * 1000;
      updateToken();
      setTimeLeft(stepSeconds);

      if (timerRef.current) clearInterval(timerRef.current);
      if (pollingRef.current) clearInterval(pollingRef.current);

      timerRef.current = setInterval(() => {
        const remaining = Math.ceil((targetTimeRef.current - Date.now()) / 1000);
        if (remaining <= 0) {
          targetTimeRef.current = Date.now() + stepSeconds * 1000;
          updateToken();
          setTimeLeft(stepSeconds);
        } else {
          setTimeLeft(remaining);
        }
      }, 500);

      let isMounted = true;
      let currentInterval = 3000;

      const poll = async () => {
        if (!isMounted) return;
        const success = await fetchSessionData();
        if (!isMounted) return;

        if (success) {
          currentInterval = 3000;
        } else {
          currentInterval = Math.min(currentInterval * 2, 30000);
        }
        pollingRef.current = setTimeout(poll, currentInterval);
      };

      fetchSessionData();
      pollingRef.current = setTimeout(poll, currentInterval);

      return () => {
        isMounted = false;
        if (timerRef.current) clearInterval(timerRef.current);
        if (pollingRef.current) clearTimeout(pollingRef.current);
      };
    }
    return undefined;
  }, [activeSession?.sessionId]);

  const updateToken = async () => {
    if (activeSession?.sessionId) {
      try {
        const stepSeconds = activeSession.codeStepSeconds || 20;
        const res = await attendanceService.getCurrentCode(activeSession.sessionId, stepSeconds);
        if (res.data?.token) {
          setQrToken(res.data.token);
        }
      } catch (err) {
        console.error('Failed to get token', err);
      }
    }
  };

  const fetchSessionData = async (): Promise<boolean> => {
    if (!activeSession?.sessionId) return false;
    try {
      const flaggedRes = await attendanceService.getFlaggedRecords(activeSession.sessionId);
      setFlaggedRecords(flaggedRes.data || []);

      const rosterRes = await attendanceService.getSessionRoster(activeSession.sessionId);
      if (rosterRes.data) {
        setRoster(rosterRes.data);
      }
      return true;
    } catch (err) {
      console.error('Failed to sync session data', err);
      return false;
    }
  };

  const captureDoctorLocation = async (): Promise<{ lat?: number; lng?: number }> => {
    if (!navigator.geolocation) return {};
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 6000,
          maximumAge: 0,
        });
      });
      return { lat: pos.coords.latitude, lng: pos.coords.longitude };
    } catch (e) {
      console.warn('High accuracy location fallback:', e);
    }
    return {};
  };

  const handleStartSession = async (courseId: number) => {
    try {
      setLoading(true);
      setError(null);

      const { lat, lng } = await captureDoctorLocation();

      const res = await attendanceService.startSession({
        courseId,
        latitude: lat,
        longitude: lng,
        radius: 100,
        gracePeriodMins: gracePeriods[courseId] ?? 15,
      });
      setActiveSession(res.data);
      setSelectedCourseId(courseId);

      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('courseId', courseId.toString());
        return next;
      });
    } catch (err: any) {
      let errorMessage =
        err.response?.data?.message || t('attendance.startSessionError', 'Failed to start session');
      if (
        err.response?.status === 404 &&
        typeof errorMessage === 'string' &&
        errorMessage.includes('ScheduleSlot')
      ) {
        errorMessage = t('attendance.noScheduleSlot', 'No matching schedule slot found. Please contact administration to add a ScheduleSlot.');
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const syncLocationNow = async () => {
    if (!activeSession?.sessionId) return;
    try {
      setLoading(true);
      const { lat, lng } = await captureDoctorLocation();
      if (lat && lng) {
        const res = await attendanceService.updateSessionLocation(activeSession.sessionId, {
          latitude: lat,
          longitude: lng,
          radius: 100,
        });
        if (res.data) {
          setActiveSession(res.data);
        }
      } else {
        alert(
          t('attendance.locationPermissionAlert', 'attendance.locationPermissionAlert')
        );
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleStopSession = async () => {
    if (!activeSession) return;
    try {
      setLoading(true);
      await attendanceService.stopSession(activeSession.sessionId);
      setActiveSession(null);
      setSelectedCourseId(null);
      setQrToken('');
      setFlaggedRecords([]);

      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('courseId');
        return next;
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleManualToggle = async (
    studentId: number,
    status: 'PRESENT' | 'LATE' | 'ABSENT'
  ) => {
    if (!activeSession) return;
    try {
      await attendanceService.markStudentAttendance(activeSession.sessionId, studentId, status);
      fetchSessionData();
    } catch (err: any) {
      console.error('Failed to mark attendance manually:', err);
      setError(err.message || err.response?.data?.message || 'Failed to update attendance');
      fetchSessionData();
    }
  };

  // Helper: Extract distinct sections / groups
  const availableSections = useMemo(() => {
    const sectionSet = new Set<string>();
    courses.forEach((c) => {
      if (Array.isArray(c.scheduleSlots)) {
        c.scheduleSlots.forEach((slot: any) => {
          if (slot.studentGroup?.name) {
            sectionSet.add(slot.studentGroup.name.trim());
          }
        });
      }
    });
    return Array.from(sectionSet).sort();
  }, [courses]);

  // Filtered departments based on selected college
  const availableDepartments = useMemo(() => {
    if (selectedCollege === 'ALL') return departments;
    return departments.filter(
      (d) => String(d.collegeId || d.college?.id) === String(selectedCollege)
    );
  }, [departments, selectedCollege]);

  // Multi-criteria filtering
  const filteredCourses = useMemo(() => {
    const normQ = normalizeArabic(search);

    return courses.filter((course) => {
      // 1. Academic Year (1 to 4)
      if (selectedYear !== 'ALL') {
        const cYear = Number(course.year) || 1;
        if (cYear !== Number(selectedYear)) return false;
      }

      // 2. College
      if (selectedCollege !== 'ALL') {
        const colId =
          course.department?.college?.id ||
          course.department?.collegeId ||
          course.collegeId;
        if (String(colId) !== String(selectedCollege)) return false;
      }

      // 3. Department
      if (selectedDepartment !== 'ALL') {
        const deptId = course.departmentId || course.department?.id;
        if (String(deptId) !== String(selectedDepartment)) return false;
      }

      // 4. Section / Group
      if (selectedSection !== 'ALL') {
        const hasMatchingSection =
          Array.isArray(course.scheduleSlots) &&
          course.scheduleSlots.some((slot: any) => {
            const groupName = slot.studentGroup?.name?.trim();
            return groupName && groupName.toLowerCase() === selectedSection.toLowerCase();
          });
        if (!hasMatchingSection) return false;
      }

      // 5. Semester
      if (selectedSemester !== 'ALL') {
        const cSem = Number(course.semester) || 1;
        if (cSem !== Number(selectedSemester)) return false;
      }

      // 6. Search query
      if (normQ) {
        const nameNorm = normalizeArabic(course.name);
        const codeNorm = normalizeArabic(course.courseCode);
        const deptNameNorm = normalizeArabic(course.department?.name);
        const deptNameArNorm = normalizeArabic(course.department?.nameAr);
        const colNameNorm = normalizeArabic(course.department?.college?.name);
        const colNameArNorm = normalizeArabic(course.department?.college?.nameAr);

        const matches =
          nameNorm.includes(normQ) ||
          codeNorm.includes(normQ) ||
          deptNameNorm.includes(normQ) ||
          deptNameArNorm.includes(normQ) ||
          colNameNorm.includes(normQ) ||
          colNameArNorm.includes(normQ);

        if (!matches) return false;
      }

      return true;
    });
  }, [
    courses,
    search,
    selectedYear,
    selectedCollege,
    selectedDepartment,
    selectedSection,
    selectedSemester,
  ]);

  const hasActiveFilters = Boolean(
    search.trim() ||
      selectedYear !== 'ALL' ||
      selectedCollege !== 'ALL' ||
      selectedDepartment !== 'ALL' ||
      selectedSection !== 'ALL' ||
      selectedSemester !== 'ALL'
  );

  const resetAllFilters = () => {
    setSearch('');
    setSelectedYear('ALL');
    setSelectedCollege('ALL');
    setSelectedDepartment('ALL');
    setSelectedSection('ALL');
    setSelectedSemester('ALL');
  };

  const presentCount = roster.filter(
    (s) =>
      (s.existingStatus === 'PRESENT' || s.existingStatus === 'LATE') &&
      !s.existingLocationFlagged
  ).length;
  const lateCount = roster.filter(
    (s) => s.existingStatus === 'LATE' && !s.existingLocationFlagged
  ).length;
  const absentCount = roster.filter((s) => s.existingStatus === 'ABSENT').length;

  const filteredStudents = roster.filter((s) => {
    const fullName = `${s.firstName || ''} ${s.lastName || ''}`.toLowerCase();
    const studentIdStr = (s.studentId || '').toString().toLowerCase();
    const matchesSearch =
      !rosterSearch ||
      fullName.includes(rosterSearch.toLowerCase()) ||
      studentIdStr.includes(rosterSearch.toLowerCase());

    if (!matchesSearch) return false;

    if (rosterFilter === 'PRESENT') {
      return (
        (s.existingStatus === 'PRESENT' || s.existingStatus === 'LATE') &&
        !s.existingLocationFlagged
      );
    }
    if (rosterFilter === 'LATE') {
      return s.existingStatus === 'LATE' && !s.existingLocationFlagged;
    }
    if (rosterFilter === 'ABSENT') {
      return s.existingStatus === 'ABSENT';
    }
    return true;
  });

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {error && (
        <div className="p-3.5 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 rounded-xl border border-red-200 dark:border-red-800 flex items-center justify-between gap-3 text-xs font-semibold">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="p-1 hover:opacity-75 cursor-pointer">
            <X size={14} />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. SLIM & PROFESSIONAL HEADER                                             */}
      {/* ========================================================================= */}
      {!activeSession ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              {t('attendance.smartHubTitle', 'Smart Attendance Management')}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {t('attendance.smartHubSubtitle', 'Launch live interactive sessions, scan RFID cards, and monitor attendance records and warnings.')}
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/attendance/warnings')}
              className="h-8.5 px-3 rounded-lg border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 text-xs font-medium gap-1.5 cursor-pointer"
            >
              <AlertTriangle size={13} className="text-amber-500" />
              <span>{t('attendance.attendanceWarningsTitle', 'Warnings & Records')}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchInitialData(true)}
              disabled={refreshing}
              className="h-8.5 px-3 rounded-lg border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 gap-1.5 cursor-pointer"
            >
              <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
              <span>{t('common.refresh', 'Refresh')}</span>
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3 pb-2 border-b border-slate-100 dark:border-slate-800">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setActiveSession(null);
              setSelectedCourseId(null);
            }}
            className="rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 gap-1.5 cursor-pointer"
          >
            {isRTL ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
            <span>{t('attendance.backToCourseList', 'Back to Courses')}</span>
          </Button>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold border border-emerald-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            <span>{t('attendance.activeSessionNotice', 'Active live session in progress for this course')}</span>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. UNIFIED COMPACT FILTER & SEARCH TOOLBAR                                */}
      {/* ========================================================================= */}
      {!activeSession && (
        <div className="bg-white dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700/80 p-2.5 shadow-2xs space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px]">
              <Search
                className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={14}
              />
              <input
                type="text"
                placeholder={t('attendance.searchCoursesPlaceholder', 'Search by course name, code, college, or department (e.g. MATH101)...')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full ps-8 pe-7 h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1.5 focus:ring-brand-primary-500"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute end-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Academic Year Filter */}
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              aria-label={t('attendance.allYears', 'All Academic Years')}
              className="h-9 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-brand-primary-500 cursor-pointer"
            >
              <option value="ALL">{t('attendance.allYears', 'All Academic Years')}</option>
              <option value="1">{t('attendance.year1', 'Year 1 (Freshman)')}</option>
              <option value="2">{t('attendance.year2', 'Year 2 (Sophomore)')}</option>
              <option value="3">{t('attendance.year3', 'Year 3 (Junior)')}</option>
              <option value="4">{t('attendance.year4', 'Year 4 (Senior)')}</option>
            </select>

            {/* College Filter */}
            {colleges.length > 0 && (
              <select
                value={selectedCollege}
                onChange={(e) => {
                  setSelectedCollege(e.target.value);
                  setSelectedDepartment('ALL');
                }}
                aria-label={t('attendance.allColleges', 'All Colleges')}
                className="h-9 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-brand-primary-500 cursor-pointer max-w-[150px] truncate"
              >
                <option value="ALL">{t('attendance.allColleges', 'All Colleges')}</option>
                {colleges.map((c) => (
                  <option key={c.id} value={c.id}>
                    {isRTL ? c.nameAr || c.name : c.name}
                  </option>
                ))}
              </select>
            )}

            {/* Department Filter */}
            {availableDepartments.length > 0 && (
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                aria-label={t('attendance.allDepartments', 'All Departments')}
                className="h-9 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-brand-primary-500 cursor-pointer max-w-[150px] truncate"
              >
                <option value="ALL">{t('attendance.allDepartments', 'All Departments')}</option>
                {availableDepartments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {isRTL ? d.nameAr || d.name : d.name}
                  </option>
                ))}
              </select>
            )}

            {/* Section Filter */}
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              aria-label={t('attendance.allSections', 'All Sections / Groups')}
              className="h-9 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-brand-primary-500 cursor-pointer"
            >
              <option value="ALL">{t('attendance.allSections', 'All Sections / Groups')}</option>
              {availableSections.map((sec) => (
                <option key={sec} value={sec}>
                  {isRTL ? `سكشن ${sec}` : `Section ${sec}`}
                </option>
              ))}
            </select>

            {/* Semester Filter */}
            <select
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(e.target.value)}
              aria-label={t('attendance.allSemesters', 'All Semesters')}
              className="h-9 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-brand-primary-500 cursor-pointer"
            >
              <option value="ALL">{t('attendance.allSemesters', 'All Semesters')}</option>
              <option value="1">{t('attendance.semester1', 'Semester 1 (Fall)')}</option>
              <option value="2">{t('attendance.semester2', 'Semester 2 (Spring)')}</option>
            </select>

            {/* Reset Button */}
            {hasActiveFilters && (
              <button
                onClick={resetAllFilters}
                title={t('attendance.clearAllFilters', 'Reset Filters')}
                className="h-9 px-2.5 rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100/60 text-xs font-medium flex items-center gap-1 cursor-pointer transition-colors"
              >
                <RotateCcw size={12} />
                <span>{isRTL ? 'مسح' : 'Clear'}</span>
              </button>
            )}

            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-900 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 ms-auto">
              <button
                onClick={() => setViewMode('cards')}
                className={`p-1.5 rounded-md text-xs transition-all cursor-pointer ${
                  viewMode === 'cards'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
                title={isRTL ? 'عرض البطاقات' : 'Cards'}
              >
                <LayoutGrid size={15} />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-md text-xs transition-all cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
                title={isRTL ? 'عرض الجدول' : 'Table'}
              >
                <LayoutList size={15} />
              </button>
            </div>
          </div>

          {/* Sub-info bar: Matches counter & active filter badges */}
          <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 pt-1 px-1">
            <span>
              {t('attendance.showingCoursesCount', {
                filtered: filteredCourses.length,
                total: courses.length,
                defaultValue: `عرض ${filteredCourses.length} من إجمالي ${courses.length} مقرر`,
              })}
            </span>
          </div>
        </div>
      )}

      {/* Roster Slide-Over Modal Drawer */}
      {showRosterList && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <GraduationCap className="w-5 h-5 text-brand-primary-400" />
                <div>
                  <h3 className="text-sm font-bold">
                    {t('attendance.rosterStaffModalTitle', 'Attendance Roster & Course Staff')}
                  </h3>
                  <p className="text-slate-400 text-xs">
                    {courses.find((c) => c.id === selectedCourseId)?.name || 'المقرر الدراسي'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowRosterList(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-white cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3 flex-1">
              <div className="flex items-center justify-between gap-2">
                <div className="relative flex-1">
                  <Search size={14} className="text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={rosterSearch}
                    onChange={(e) => setRosterSearch(e.target.value)}
                    placeholder={t('attendance.searchStudentPlaceholder', 'Search student name or ID...')}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg ps-8 pe-3 py-1.5 text-xs text-slate-800 dark:text-white outline-none focus:ring-1 focus:ring-brand-primary-500"
                  />
                </div>

                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-[11px] font-semibold">
                  <button
                    onClick={() => setRosterFilter('PRESENT')}
                    className={`px-2 py-1 rounded ${
                      rosterFilter === 'PRESENT'
                        ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-2xs'
                        : 'text-slate-500'
                    }`}
                  >
                    {presentCount} حاضر
                  </button>
                  <button
                    onClick={() => setRosterFilter('LATE')}
                    className={`px-2 py-1 rounded ${
                      rosterFilter === 'LATE'
                        ? 'bg-white dark:bg-slate-700 text-amber-600 shadow-2xs'
                        : 'text-slate-500'
                    }`}
                  >
                    {lateCount} متأخر
                  </button>
                  <button
                    onClick={() => setRosterFilter('ABSENT')}
                    className={`px-2 py-1 rounded ${
                      rosterFilter === 'ABSENT'
                        ? 'bg-white dark:bg-slate-700 text-rose-600 shadow-2xs'
                        : 'text-slate-500'
                    }`}
                  >
                    {absentCount} غائب
                  </button>
                  <button
                    onClick={() => setRosterFilter('ALL')}
                    className={`px-2 py-1 rounded ${
                      rosterFilter === 'ALL'
                        ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-2xs'
                        : 'text-slate-500'
                    }`}
                  >
                    الكل
                  </button>
                </div>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-800/50 max-h-[350px] overflow-y-auto">
                {filteredStudents.map((s: any) => {
                  const isPresent =
                    (s.existingStatus === 'PRESENT' || s.existingStatus === 'LATE') &&
                    !s.existingLocationFlagged;
                  return (
                    <div
                      key={s.id}
                      className="p-2.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/60 text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                            isPresent
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'
                          }`}
                        >
                          {s.firstName?.[0] || 'S'}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800 dark:text-white">
                            {s.firstName} {s.lastName}
                          </p>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {s.studentId}
                          </span>
                        </div>
                      </div>

                      <Badge
                        className={
                          s.existingStatus === 'PRESENT'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 text-[10px]'
                            : s.existingStatus === 'LATE'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 text-[10px]'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 text-[10px]'
                        }
                      >
                        {s.existingStatus === 'PRESENT'
                          ? 'حاضر'
                          : s.existingStatus === 'LATE'
                          ? 'متأخر'
                          : 'غائب'}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-800 flex justify-end shrink-0">
              <Button
                size="sm"
                onClick={() => setShowRosterList(false)}
                className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg text-xs font-semibold px-4"
              >
                {t('common.close', 'Close')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. MAIN CONTENT: ACTIVE SESSION OR MODERN COURSE CATALOG                 */}
      {/* ========================================================================= */}
      {activeSession ? (
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="bg-slate-900 dark:bg-slate-950 rounded-2xl p-5 text-white shadow-md border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <BookOpen size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                    {t('attendance.activeSession', 'attendance.activeSession')}
                  </span>
                  {activeSession?.createdAt && (
                    <ElapsedSessionTimer createdAt={activeSession.createdAt} />
                  )}
                </div>
                <h2 className="text-base font-bold text-white truncate">
                  {courses.find((c) => c.id === selectedCourseId)?.name || 'المقرر الدراسي'}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowRosterList(true)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium flex items-center gap-1.5 cursor-pointer"
              >
                <Eye size={13} />
                <span>{t('attendance.viewRosterStaff', 'View Roster & Staff')} ({presentCount})</span>
              </button>

              <Button
                size="sm"
                onClick={handleStopSession}
                disabled={loading}
                className="bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold gap-1.5 h-8 px-3 cursor-pointer"
              >
                <Square size={13} />
                <span>{t('attendance.stopSession', 'End Session')}</span>
              </Button>
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('QR')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'QR'
                  ? 'bg-brand-primary-50 text-brand-primary-700 dark:bg-brand-primary-950/50 dark:text-brand-primary-300'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <QrCode size={14} />
              <span>QR Code</span>
            </button>
            <button
              onClick={() => setActiveTab('GPS')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'GPS'
                  ? 'bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <MapPin size={14} />
              <span>GPS</span>
            </button>
            <button
              onClick={() => setActiveTab('MANUAL')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'MANUAL'
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Users size={14} />
              <span>{isRTL ? 'يدوي' : 'Manual'}</span>
            </button>
          </div>

          {activeTab === 'QR' && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 flex flex-col items-center justify-center shadow-xs">
              <div className="text-center mb-4">
                <h3 className="text-base font-bold text-slate-800 dark:text-white">
                  {t('attendance.scanQrToAttend', 'Scan the code to register attendance')}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  يتجدد الرمز تلقائياً كل {activeSession?.codeStepSeconds || 20} ثانية
                </p>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center">
                {qrToken ? (
                  <>
                    <QRCodeSVG
                      value={JSON.stringify({
                        sessionId: activeSession.sessionId,
                        token: qrToken,
                      })}
                      size={200}
                      level="H"
                      className="mb-3"
                    />
                    <div className="text-center">
                      <span className="text-[10px] text-slate-400 font-bold block mb-0.5">
                        الرمز المؤقت
                      </span>
                      <span className="text-2xl font-black text-brand-primary-600 font-mono tracking-widest">
                        {qrToken}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="w-48 h-48 flex flex-col items-center justify-center text-slate-400 text-xs">
                    <RefreshCw className="w-6 h-6 animate-spin mb-2" />
                    <span>جاري التوليد...</span>
                  </div>
                )}
              </div>

              <div className="mt-4 text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                <Clock size={13} className="text-brand-primary-500" />
                <span>يتجدد بعد:</span>
                <span className="font-mono font-bold text-brand-primary-600">{timeLeft}s</span>
              </div>
            </div>
          )}

          {activeTab === 'GPS' && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <MapPin size={14} className="text-sky-500" />
                  <span>تسجيل الحضور بالنطاق الجغرافي</span>
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={syncLocationNow}
                  className="h-8 text-xs font-medium gap-1 cursor-pointer"
                >
                  <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                  <span>تحديث الإحداثيات</span>
                </Button>
              </div>
              <p className="text-xs text-slate-400">
                يسمح للطلاب بالتسجيل تلقائياً عند تواجدهم داخل قاعة المحاضرة.
              </p>
            </div>
          )}

          {activeTab === 'MANUAL' && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200">
                تسجيل الحضور اليدوي
              </h3>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-72 overflow-y-auto">
                {roster.map((s: any) => (
                  <div
                    key={s.id}
                    className="py-2 flex items-center justify-between gap-2 text-xs"
                  >
                    <span className="font-semibold text-slate-800 dark:text-white truncate">
                      {s.firstName} {s.lastName}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleManualToggle(s.id, 'PRESENT')}
                        className={`px-2 py-1 rounded text-[11px] font-bold cursor-pointer ${
                          s.existingStatus === 'PRESENT'
                            ? 'bg-emerald-500 text-white'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        حاضر
                      </button>
                      <button
                        onClick={() => handleManualToggle(s.id, 'LATE')}
                        className={`px-2 py-1 rounded text-[11px] font-bold cursor-pointer ${
                          s.existingStatus === 'LATE'
                            ? 'bg-amber-500 text-white'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        متأخر
                      </button>
                      <button
                        onClick={() => handleManualToggle(s.id, 'ABSENT')}
                        className={`px-2 py-1 rounded text-[11px] font-bold cursor-pointer ${
                          s.existingStatus === 'ABSENT'
                            ? 'bg-rose-500 text-white'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        غائب
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ======================================================================= */
        /* 3B. CLEAN COURSE GRID & TABLE                                           */
        /* ======================================================================= */
        <div>
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-primary-500/20 border-t-brand-primary-600"></div>
              <span className="text-xs text-slate-400 font-medium">جاري التحميل...</span>
            </div>
          ) : filteredCourses.length === 0 ? (
            <div className="p-8 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 text-center">
              <EmptyState
                icon={<BookOpen size={36} className="text-slate-400" />}
                title={t('attendance.noCoursesFound', 'No Courses Found')}
                subtitle={t('attendance.noCoursesFoundDesc', 'No courses match the specified search or filter criteria.')}
                action={
                  hasActiveFilters
                    ? {
                        label: isRTL ? 'إعادة ضبط الفلاتر' : 'Reset Filters',
                        onClick: resetAllFilters,
                      }
                    : undefined
                }
              />
            </div>
          ) : viewMode === 'cards' ? (
            /* =================================================================== */
            /* MODERN REFINED COMPACT CARDS                                        */
            /* =================================================================== */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredCourses.map((course) => {
                const currentGrace = gracePeriods[course.id] ?? 15;
                const collegeName =
                  course.department?.college?.name || course.department?.college?.nameAr;
                const deptName = course.department?.name || course.department?.nameAr;
                const enrolledCount = course._count?.enrollments || 0;
                const credits = course.credits || 3;
                const yearNum = course.year || 1;
                const semNum = course.semester || 1;

                const sectionsList = Array.isArray(course.scheduleSlots)
                  ? Array.from(
                      new Set(
                        course.scheduleSlots
                          .map((s: any) => s.studentGroup?.name)
                          .filter(Boolean)
                      )
                    ).join(', ')
                  : '';

                return (
                  <div
                    key={course.id}
                    className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-700/80 p-4 shadow-2xs hover:shadow-xs hover:border-brand-primary-300 dark:hover:border-brand-primary-600 transition-all flex flex-col justify-between"
                  >
                    <div>
                      {/* Top Header: Code, Year, Semester */}
                      <div className="flex items-center justify-between gap-1.5 mb-2">
                        <span className="font-mono text-xs font-bold text-brand-primary-700 dark:text-brand-primary-300 bg-brand-primary-50 dark:bg-brand-primary-950/50 px-2 py-0.5 rounded-md border border-brand-primary-200/40">
                          {course.courseCode}
                        </span>

                        <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-500">
                          <span className="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">
                            الفرقة {yearNum}
                          </span>
                          <span className="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">
                            ترم {semNum}
                          </span>
                          {credits > 0 && (
                            <span className="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">
                              {credits}س
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Course Title */}
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-snug mb-1 line-clamp-1">
                        {course.name}
                      </h3>

                      {/* Department / College */}
                      <p className="text-[11px] text-slate-400 truncate mb-2.5">
                        {collegeName ? `${collegeName} • ${deptName || 'عام'}` : (deptName || 'الكلية التكنولوجية')}
                      </p>

                      {/* Info Row: Sections & Enrolled */}
                      <div className="flex items-center justify-between text-xs py-1.5 px-2 bg-slate-50 dark:bg-slate-900/60 rounded-lg border border-slate-100 dark:border-slate-700/50 mb-3">
                        <span className="text-slate-500 font-medium text-[11px] truncate max-w-[140px]">
                          {sectionsList ? `سكشن: ${sectionsList}` : 'عام'}
                        </span>
                        <span className="text-brand-primary-600 dark:text-brand-primary-400 font-semibold font-mono text-[11px]">
                          {enrolledCount} طالب
                        </span>
                      </div>
                    </div>

                    {/* Footer Controls: Grace Period & Start Session Button */}
                    <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-700/60">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500 font-medium">فترة السماح:</span>
                        <select
                          value={currentGrace}
                          onChange={(e) =>
                            setGracePeriods({
                              ...gracePeriods,
                              [course.id]: parseInt(e.target.value, 10),
                            })
                          }
                          className="h-6 px-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-[11px] font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
                        >
                          {GRACE_PERIOD_OPTIONS.map((m) => (
                            <option key={m} value={m}>
                              {m} دقيقة
                            </option>
                          ))}
                        </select>
                      </div>

                      <Button
                        onClick={() => handleStartSession(course.id)}
                        disabled={loading}
                        className="w-full h-8.5 bg-brand-primary-600 hover:bg-brand-primary-700 text-white rounded-xl text-xs font-bold gap-1.5 shadow-2xs cursor-pointer transition-all"
                      >
                        {loading && selectedCourseId === course.id ? (
                          <RefreshCw size={13} className="animate-spin" />
                        ) : (
                          <Play size={12} className="fill-white" />
                        )}
                        <span>{t('attendance.startLiveSession', 'Start Smart Session')}</span>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* =================================================================== */
            /* HIGH DENSITY MINIMAL TABLE                                          */
            /* =================================================================== */
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <Table className="w-full text-xs">
                  <TableHeader className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700">
                    <TableRow>
                      <TableHead className="w-24 p-2.5 font-bold text-slate-500">كود</TableHead>
                      <TableHead className="p-2.5 font-bold text-slate-500">اسم المقرر</TableHead>
                      <TableHead className="p-2.5 font-bold text-slate-500 text-center">الفرقة</TableHead>
                      <TableHead className="p-2.5 font-bold text-slate-500">القسم / الكلية</TableHead>
                      <TableHead className="p-2.5 font-bold text-slate-500">السكاشن</TableHead>
                      <TableHead className="p-2.5 font-bold text-slate-500 text-center">الطلاب</TableHead>
                      <TableHead className="p-2.5 font-bold text-slate-500 text-center">السماح</TableHead>
                      <TableHead className="p-2.5 font-bold text-slate-500 text-end pe-4">الإجراء</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCourses.map((course) => {
                      const currentGrace = gracePeriods[course.id] ?? 15;
                      const collegeName =
                        course.department?.college?.name || course.department?.college?.nameAr;
                      const deptName = course.department?.name || course.department?.nameAr;
                      const enrolledCount = course._count?.enrollments || 0;
                      const yearNum = course.year || 1;
                      const semNum = course.semester || 1;

                      const sectionsList = Array.isArray(course.scheduleSlots)
                        ? Array.from(
                            new Set(
                              course.scheduleSlots
                                .map((s: any) => s.studentGroup?.name)
                                .filter(Boolean)
                            )
                          ).join(', ')
                        : '';

                      return (
                        <TableRow
                          key={course.id}
                          className="hover:bg-slate-50 dark:hover:bg-slate-700/20 border-b border-slate-100 dark:border-slate-700/50"
                        >
                          <TableCell className="p-2.5 font-mono font-bold text-brand-primary-600">
                            {course.courseCode}
                          </TableCell>
                          <TableCell className="p-2.5 font-semibold text-slate-900 dark:text-white">
                            {course.name}
                          </TableCell>
                          <TableCell className="p-2.5 text-center text-slate-500">
                            س{yearNum} • ت{semNum}
                          </TableCell>
                          <TableCell className="p-2.5 text-slate-500 text-[11px] truncate max-w-[150px]">
                            {collegeName ? `${collegeName} (${deptName})` : deptName}
                          </TableCell>
                          <TableCell className="p-2.5 text-purple-600 font-medium text-[11px]">
                            {sectionsList || 'عام'}
                          </TableCell>
                          <TableCell className="p-2.5 text-center font-mono font-semibold text-slate-700 dark:text-slate-300">
                            {enrolledCount}
                          </TableCell>
                          <TableCell className="p-2.5 text-center">
                            <select
                              value={currentGrace}
                              onChange={(e) =>
                                setGracePeriods({
                                  ...gracePeriods,
                                  [course.id]: parseInt(e.target.value, 10),
                                })
                              }
                              className="h-6 px-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-[11px] font-medium"
                            >
                              {GRACE_PERIOD_OPTIONS.map((m) => (
                                <option key={m} value={m}>
                                  {m}د
                                </option>
                              ))}
                            </select>
                          </TableCell>
                          <TableCell className="p-2.5 text-end pe-4">
                            <Button
                              size="sm"
                              onClick={() => handleStartSession(course.id)}
                              disabled={loading}
                              className="h-7 px-2.5 bg-brand-primary-600 hover:bg-brand-primary-700 text-white rounded-lg text-xs font-bold gap-1 cursor-pointer"
                            >
                              <Play size={11} className="fill-white" />
                              <span>بدء</span>
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default FacultyAttendanceDashboard;
