// @ts-nocheck
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import {
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  BookOpen,
  Bell,
  RefreshCw,
  Search,
  X,
  RotateCcw,
  Download,
  UserCheck,
  Building2,
  Users,
  GraduationCap,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
  FileSpreadsheet,
  Unlock,
} from 'lucide-react';
import attendanceService from '../../services/attendance.service';
import { Card } from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/button';
import { PageHeader } from '../../components/ui/PageHeader';
import { EmptyState } from '../../components/ui/EmptyState';
import Table, {
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../../components/ui/Table';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

// Arabic normalizer helper
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

export function StudentWarningsPage() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Response payload state
  const [isStaffView, setIsStaffView] = useState(false);
  const [staffData, setStaffData] = useState<{
    summary?: any;
    warningRecords?: any[];
    coursesList?: any[];
  }>({});
  const [studentCourses, setStudentCourses] = useState<any[]>([]);
  const [studentNotifications, setStudentNotifications] = useState<any[]>([]);

  // Filter States (Staff View)
  const [search, setSearch] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<string>('ALL');
  const [selectedYear, setSelectedYear] = useState<string>('ALL');
  const [selectedCourseId, setSelectedCourseId] = useState<string>('ALL');

  // Unblock action loading state
  const [unblockingId, setUnblockingId] = useState<number | null>(null);

  const fetchWarningsData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const res = await attendanceService.getMyWarnings();
      if (res?.data) {
        const payload = res.data;
        if (payload.isStaff) {
          setIsStaffView(true);
          setStaffData(payload);
        } else {
          setIsStaffView(false);
          setStudentCourses(payload.courses || []);
          setStudentNotifications(payload.notifications || []);
        }
      }
    } catch (err: any) {
      console.error('Failed to load warnings data:', err);
      setError(err?.response?.data?.message || err?.message || 'Failed to load absence warnings');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchWarningsData();
  }, [fetchWarningsData]);

  // Handle Unblocking a Student Enrollment
  const handleUnblock = async (enrollmentId: number, studentName: string) => {
    const confirmMsg = isRTL
      ? `هل أنت متأكد من إلغاء الحرمان وإعادة قيد الطالب (${studentName})؟`
      : `Are you sure you want to unblock student (${studentName})?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      setUnblockingId(enrollmentId);
      await api.post(`/attendance/unblock/${enrollmentId}`);
      await fetchWarningsData(true);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to unblock student');
    } finally {
      setUnblockingId(null);
    }
  };

  // CSV Export for Faculty/Staff
  const exportToCSV = () => {
    const records = filteredStaffRecords;
    if (records.length === 0) return;

    const headers = [
      'Student Name',
      'Student ID',
      'Course Name',
      'Course Code',
      'Absence %',
      'Max Allowed %',
      'Status',
      'Total Sessions',
      'Absent',
      'Late',
      'Excused',
    ];

    const rows = records.map((r) => [
      `"${r.studentName}"`,
      `"${r.studentCode}"`,
      `"${r.courseName}"`,
      `"${r.courseCode}"`,
      `"${r.absencePercent}%"`,
      `"${r.maxAbsencePercent}%"`,
      `"${r.warningStage}"`,
      r.totalSessions,
      r.absent,
      r.late,
      r.excused,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `absence_warnings_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered Staff Records
  const filteredStaffRecords = useMemo(() => {
    if (!staffData.warningRecords) return [];
    const normQ = normalizeArabic(search);

    return staffData.warningRecords.filter((r) => {
      // 1. Warning Stage
      if (selectedLevel !== 'ALL' && r.warningStage !== selectedLevel) {
        return false;
      }

      // 2. Academic Year
      if (selectedYear !== 'ALL') {
        const yr = Number(r.studentYear || r.courseYear) || 1;
        if (yr !== Number(selectedYear)) return false;
      }

      // 3. Course Filter
      if (selectedCourseId !== 'ALL' && String(r.courseId) !== String(selectedCourseId)) {
        return false;
      }

      // 4. Search
      if (normQ) {
        const nameNorm = normalizeArabic(r.studentName);
        const codeNorm = normalizeArabic(r.studentCode);
        const courseCodeNorm = normalizeArabic(r.courseCode);
        const courseNameNorm = normalizeArabic(r.courseName);
        const emailNorm = normalizeArabic(r.studentEmail);

        const matches =
          nameNorm.includes(normQ) ||
          codeNorm.includes(normQ) ||
          courseCodeNorm.includes(normQ) ||
          courseNameNorm.includes(normQ) ||
          emailNorm.includes(normQ);

        if (!matches) return false;
      }

      return true;
    });
  }, [staffData.warningRecords, search, selectedLevel, selectedYear, selectedCourseId]);

  const hasActiveFilters = Boolean(
    search.trim() ||
      selectedLevel !== 'ALL' ||
      selectedYear !== 'ALL' ||
      selectedCourseId !== 'ALL'
  );

  const resetFilters = () => {
    setSearch('');
    setSelectedLevel('ALL');
    setSelectedYear('ALL');
    setSelectedCourseId('ALL');
  };

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            {isStaffView
              ? isRTL
                ? 'سجل ومتابعة إنذارات وحرمان الطلاب'
                : 'Absence Warnings & Deprivation Management'
              : isRTL
              ? 'سجل ومتابعة إنذارات الغياب الأكاديمي'
              : 'My Absence Warnings & Records'}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {isStaffView
              ? isRTL
                ? 'متابعة نسب غياب الطلاب وسقف الحرمان الأكاديمي (25%) عبر كافة المقررات الدراسية.'
                : 'Monitor student absence thresholds, official warning notices, and 25% academic blocks.'
              : isRTL
              ? 'متابعة نسبة غيابك لكل مقرر مسجل وسقف الحرمان المسموح به وفقاً للائحة الأكاديمية.'
              : 'Track your registered course absence percentages and academic thresholds.'}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {isStaffView && (
            <Button
              variant="outline"
              size="sm"
              onClick={exportToCSV}
              disabled={filteredStaffRecords.length === 0}
              className="h-8.5 px-3 rounded-lg border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 gap-1.5 cursor-pointer shadow-2xs"
            >
              <FileSpreadsheet size={13} className="text-emerald-600" />
              <span>{isRTL ? 'تصدير CSV' : 'Export CSV'}</span>
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchWarningsData(true)}
            disabled={refreshing}
            className="h-8.5 px-3 rounded-lg border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 gap-1.5 cursor-pointer shadow-2xs"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            <span>{t('common.refresh', 'Refresh')}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/attendance')}
            className="h-8.5 px-3 rounded-lg border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 gap-1.5 cursor-pointer"
          >
            <BookOpen size={13} />
            <span>{isRTL ? 'بوابة الحضور' : 'Attendance Hub'}</span>
          </Button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. STAFF / FACULTY VIEW: INSTITUTIONAL ABSENCE COMMAND CENTER             */}
      {/* ========================================================================= */}
      {isStaffView ? (
        <div className="space-y-4">
          {/* ========================================================================= */}
          {/* 1. EXECUTIVE 4-METRIC RIBBON                                              */}
          {/* ========================================================================= */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
            {/* Blocked / Deprived */}
            <button
              type="button"
              onClick={() => setSelectedLevel(selectedLevel === 'BLOCKED' ? 'ALL' : 'BLOCKED')}
              className={`p-3 rounded-2xl border transition-all text-start flex items-center justify-between cursor-pointer ${
                selectedLevel === 'BLOCKED'
                  ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-400 dark:border-rose-600 ring-2 ring-rose-500/20 shadow-xs'
                  : 'bg-white dark:bg-slate-800 border-slate-200/90 dark:border-slate-700 shadow-2xs hover:border-rose-300'
              }`}
            >
              <div>
                <span className="text-[10px] text-slate-400 font-semibold block">
                  {isRTL ? 'حرمان أكاديمي (≥25%)' : 'Academic Block (≥25%)'}
                </span>
                <span className="text-lg font-black text-rose-600 dark:text-rose-400 block mt-0.5 font-mono">
                  {staffData.summary?.blockedCount || 0}
                </span>
              </div>
              <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 flex items-center justify-center shrink-0">
                <XCircle size={16} />
              </div>
            </button>

            {/* Final Warning */}
            <button
              type="button"
              onClick={() => setSelectedLevel(selectedLevel === 'FINAL_WARNING' ? 'ALL' : 'FINAL_WARNING')}
              className={`p-3 rounded-2xl border transition-all text-start flex items-center justify-between cursor-pointer ${
                selectedLevel === 'FINAL_WARNING'
                  ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-400 dark:border-amber-600 ring-2 ring-amber-500/20 shadow-xs'
                  : 'bg-white dark:bg-slate-800 border-slate-200/90 dark:border-slate-700 shadow-2xs hover:border-amber-300'
              }`}
            >
              <div>
                <span className="text-[10px] text-slate-400 font-semibold block">
                  {isRTL ? 'إنذار نهائي (20%)' : 'Final Warning (20%)'}
                </span>
                <span className="text-lg font-black text-amber-600 dark:text-amber-400 block mt-0.5 font-mono">
                  {staffData.summary?.finalWarningCount || 0}
                </span>
              </div>
              <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center shrink-0">
                <AlertTriangle size={16} />
              </div>
            </button>

            {/* First Warning */}
            <button
              type="button"
              onClick={() => setSelectedLevel(selectedLevel === 'FIRST_WARNING' ? 'ALL' : 'FIRST_WARNING')}
              className={`p-3 rounded-2xl border transition-all text-start flex items-center justify-between cursor-pointer ${
                selectedLevel === 'FIRST_WARNING'
                  ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-400 dark:border-blue-600 ring-2 ring-blue-500/20 shadow-xs'
                  : 'bg-white dark:bg-slate-800 border-slate-200/90 dark:border-slate-700 shadow-2xs hover:border-blue-300'
              }`}
            >
              <div>
                <span className="text-[10px] text-slate-400 font-semibold block">
                  {isRTL ? 'إنذار أول (10%)' : 'Early Warning (10%)'}
                </span>
                <span className="text-lg font-black text-blue-600 dark:text-blue-400 block mt-0.5 font-mono">
                  {staffData.summary?.firstWarningCount || 0}
                </span>
              </div>
              <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center shrink-0">
                <AlertCircle size={16} />
              </div>
            </button>

            {/* Total Monitored */}
            <button
              type="button"
              onClick={() => setSelectedLevel('ALL')}
              className={`p-3 rounded-2xl border transition-all text-start flex items-center justify-between cursor-pointer ${
                selectedLevel === 'ALL'
                  ? 'bg-brand-primary-50 dark:bg-brand-primary-950/40 border-brand-primary-400 dark:border-brand-primary-600 ring-2 ring-brand-primary-500/20 shadow-xs'
                  : 'bg-white dark:bg-slate-800 border-slate-200/90 dark:border-slate-700 shadow-2xs hover:border-brand-primary-300'
              }`}
            >
              <div>
                <span className="text-[10px] text-slate-400 font-semibold block">
                  {isRTL ? 'إجمالي الطلاب المتابعين' : 'Total Monitored'}
                </span>
                <span className="text-lg font-black text-brand-primary-600 dark:text-brand-primary-400 block mt-0.5 font-mono">
                  {staffData.summary?.totalMonitored || 0}
                </span>
              </div>
              <div className="w-8 h-8 rounded-xl bg-brand-primary-50 dark:bg-brand-primary-950/50 text-brand-primary-600 flex items-center justify-center shrink-0">
                <Users size={16} />
              </div>
            </button>
          </div>

          {/* ========================================================================= */}
          {/* 2. UNIFIED COMPACT FILTER TOOLBAR                                         */}
          {/* ========================================================================= */}
          <div className="p-2 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-700 shadow-2xs flex flex-wrap items-center gap-2 mb-4">
            {/* Search Box */}
            <div className="relative flex-1 min-w-[200px]">
              <Search
                className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={14}
              />
              <input
                type="text"
                placeholder={
                  isRTL
                    ? 'ابحث باسم الطالب، الرقم الجامعي، أو كود المقرر...'
                    : 'Search by student name, ID, or course code...'
                }
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-8.5 ps-8 pe-8 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-1.5 focus:ring-brand-primary-500 outline-none bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute end-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 cursor-pointer"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Warning Stage Filter */}
            <select
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
              className="h-8.5 px-3 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-brand-primary-500 cursor-pointer"
            >
              <option value="ALL">{isRTL ? 'جميع الحالات والإنذارات' : 'All Warning Levels'}</option>
              <option value="BLOCKED">{isRTL ? 'حرمان أكاديمي (≥25%)' : 'Academic Block (≥25%)'}</option>
              <option value="FINAL_WARNING">{isRTL ? 'إنذار نهائي (20% - 25%)' : 'Final Warning (20%-25%)'}</option>
              <option value="FIRST_WARNING">{isRTL ? 'إنذار أول (10% - 20%)' : 'First Warning (10%-20%)'}</option>
              <option value="SAFE">{isRTL ? 'وضع آمن (<10%)' : 'Safe (<10%)'}</option>
            </select>

            {/* Academic Year Filter */}
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="h-8.5 px-3 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-brand-primary-500 cursor-pointer"
            >
              <option value="ALL">{isRTL ? 'جميع الفرق' : 'All Years'}</option>
              <option value="1">{isRTL ? 'الفرقة الأولى (1)' : 'Year 1'}</option>
              <option value="2">{isRTL ? 'الفرقة الثانية (2)' : 'Year 2'}</option>
              <option value="3">{isRTL ? 'الفرقة الثالثة (3)' : 'Year 3'}</option>
              <option value="4">{isRTL ? 'الفرقة الرابعة (4)' : 'Year 4'}</option>
            </select>

            {/* Course Filter */}
            {staffData.coursesList && staffData.coursesList.length > 0 && (
              <select
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}
                className="h-8.5 px-3 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-brand-primary-500 cursor-pointer max-w-[180px] truncate"
              >
                <option value="ALL">{isRTL ? 'جميع المقررات' : 'All Courses'}</option>
                {staffData.coursesList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.courseCode} - {c.name}
                  </option>
                ))}
              </select>
            )}

            {/* Reset Filter Button */}
            {hasActiveFilters && (
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

          {/* High-Density Data Table */}
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-primary-500/20 border-t-brand-primary-600"></div>
              <span className="text-xs text-slate-400 font-medium">جاري التحميل...</span>
            </div>
          ) : filteredStaffRecords.length === 0 ? (
            <div className="p-8 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
              <EmptyState
                icon={<ShieldCheck size={36} className="text-emerald-500" />}
                title={isRTL ? 'لا توجد حالات حرمان أو إنذارات مطابقة' : 'No matching absence records'}
                subtitle={
                  isRTL
                    ? 'كافة الطلاب في هذا النطاق ضمن الحدود الآمنة للغياب.'
                    : 'All students in this filter range are within safe absence limits.'
                }
                action={
                  hasActiveFilters
                    ? {
                        label: isRTL ? 'إعادة ضبط الفلاتر' : 'Reset Filters',
                        onClick: resetFilters,
                      }
                    : undefined
                }
              />
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <Table className="w-full text-xs">
                  <TableHeader className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700">
                    <TableRow>
                      <TableHead className="p-2.5 font-bold text-slate-500">
                        {isRTL ? 'الطالب' : 'Student'}
                      </TableHead>
                      <TableHead className="p-2.5 font-bold text-slate-500">
                        {isRTL ? 'المقرر' : 'Course'}
                      </TableHead>
                      <TableHead className="p-2.5 font-bold text-slate-500 text-center">
                        {isRTL ? 'الفرقة' : 'Year'}
                      </TableHead>
                      <TableHead className="p-2.5 font-bold text-slate-500 text-center">
                        {isRTL ? 'المحاضرات' : 'Sessions'}
                      </TableHead>
                      <TableHead className="p-2.5 font-bold text-slate-500 text-center">
                        {isRTL ? 'الغياب / التأخير' : 'Absence / Late'}
                      </TableHead>
                      <TableHead className="p-2.5 font-bold text-slate-500 text-center w-36">
                        {isRTL ? 'نسبة الغياب %' : 'Absence %'}
                      </TableHead>
                      <TableHead className="p-2.5 font-bold text-slate-500 text-center">
                        {isRTL ? 'الحالة الأكاديمية' : 'Status'}
                      </TableHead>
                      <TableHead className="p-2.5 font-bold text-slate-500 text-end pe-4">
                        {isRTL ? 'الإجراء' : 'Action'}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStaffRecords.map((r) => {
                      const isBlocked = r.warningStage === 'BLOCKED';
                      const isFinal = r.warningStage === 'FINAL_WARNING';
                      const isFirst = r.warningStage === 'FIRST_WARNING';

                      return (
                        <TableRow
                          key={r.enrollmentId}
                          className="hover:bg-slate-50 dark:hover:bg-slate-700/20 border-b border-slate-100 dark:border-slate-700/50"
                        >
                          {/* Student Info */}
                          <TableCell className="p-2.5">
                            <div className="flex items-center gap-2">
                              <div
                                className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                                  isBlocked
                                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'
                                    : isFinal
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                                    : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                                }`}
                              >
                                {r.studentName?.[0] || 'S'}
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-slate-900 dark:text-white truncate">
                                  {r.studentName}
                                </p>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {r.studentCode}
                                </span>
                              </div>
                            </div>
                          </TableCell>

                          {/* Course Info */}
                          <TableCell className="p-2.5">
                            <div className="font-mono text-[11px] font-bold text-brand-primary-600">
                              {r.courseCode}
                            </div>
                            <div className="text-[11px] text-slate-600 dark:text-slate-300 truncate max-w-[140px]">
                              {r.courseName}
                            </div>
                          </TableCell>

                          {/* Year */}
                          <TableCell className="p-2.5 text-center text-slate-500">
                            س{r.studentYear || r.courseYear}
                          </TableCell>

                          {/* Total Sessions */}
                          <TableCell className="p-2.5 text-center font-mono text-slate-600 dark:text-slate-300">
                            {r.totalSessions}
                          </TableCell>

                          {/* Absence breakdown */}
                          <TableCell className="p-2.5 text-center">
                            <span className="text-rose-600 font-bold font-mono">
                              {r.absent} غ
                            </span>
                            {r.late > 0 && (
                              <span className="text-amber-600 font-medium font-mono ms-1">
                                ({r.late} ت)
                              </span>
                            )}
                          </TableCell>

                          {/* Absence Percent & Gauge */}
                          <TableCell className="p-2.5 text-center">
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-[11px] font-mono font-bold">
                                <span
                                  className={
                                    isBlocked
                                      ? 'text-rose-600'
                                      : isFinal
                                      ? 'text-amber-600'
                                      : isFirst
                                      ? 'text-blue-600'
                                      : 'text-emerald-600'
                                  }
                                >
                                  {r.absencePercent}%
                                </span>
                                <span className="text-slate-400 text-[10px]">
                                  حد {r.maxAbsencePercent}%
                                </span>
                              </div>
                              <div className="w-full bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    isBlocked
                                      ? 'bg-rose-500'
                                      : isFinal
                                      ? 'bg-amber-500'
                                      : isFirst
                                      ? 'bg-blue-500'
                                      : 'bg-emerald-500'
                                  }`}
                                  style={{
                                    width: `${Math.min(100, (r.absencePercent / r.maxAbsencePercent) * 100)}%`,
                                  }}
                                />
                              </div>
                            </div>
                          </TableCell>

                          {/* Academic Status Badge */}
                          <TableCell className="p-2.5 text-center">
                            <Badge
                              className={
                                isBlocked
                                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 font-bold text-[10px]'
                                  : isFinal
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 font-bold text-[10px]'
                                  : isFirst
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 font-bold text-[10px]'
                                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 text-[10px]'
                              }
                            >
                              {isBlocked
                                ? isRTL
                                  ? 'حرمان أكاديمي'
                                  : 'Blocked'
                                : isFinal
                                ? isRTL
                                  ? 'إنذار نهائي'
                                  : 'Final Warning'
                                : isFirst
                                ? isRTL
                                  ? 'إنذار أول'
                                  : 'First Warning'
                                : isRTL
                                ? 'وضع آمن'
                                : 'Safe'}
                            </Badge>
                          </TableCell>

                          {/* Actions */}
                          <TableCell className="p-2.5 text-end pe-4">
                            {isBlocked && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleUnblock(r.enrollmentId, r.studentName)}
                                disabled={unblockingId === r.enrollmentId}
                                className="h-7 px-2 border-rose-200 text-rose-700 hover:bg-rose-50 text-[11px] font-bold gap-1 cursor-pointer"
                              >
                                <Unlock size={11} />
                                <span>{isRTL ? 'إلغاء الحرمان' : 'Unblock'}</span>
                              </Button>
                            )}
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
      ) : (
        /* ========================================================================= */
        /* 3. STUDENT VIEW: PERSONAL ABSENCE & NOTIFICATIONS DASHBOARD               */
        /* ========================================================================= */
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {studentCourses.map((c) => {
              const isBlocked = c.isBlocked || c.isExceeding;
              const isNear = c.isNearLimit && !isBlocked;

              return (
                <div
                  key={c.enrollmentId}
                  className={`bg-white dark:bg-slate-800 rounded-2xl border p-4 shadow-2xs space-y-3 ${
                    isBlocked
                      ? 'border-rose-300 dark:border-rose-800 ring-1 ring-rose-500/20'
                      : isNear
                      ? 'border-amber-300 dark:border-amber-800 ring-1 ring-amber-500/20'
                      : 'border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-brand-primary-600 bg-brand-primary-50 dark:bg-brand-primary-950/50 px-2 py-0.5 rounded">
                      {c.courseCode}
                    </span>
                    <Badge
                      className={
                        isBlocked
                          ? 'bg-rose-100 text-rose-800 font-bold text-[10px]'
                          : isNear
                          ? 'bg-amber-100 text-amber-800 font-bold text-[10px]'
                          : 'bg-emerald-100 text-emerald-800 text-[10px]'
                      }
                    >
                      {isBlocked
                        ? isRTL
                          ? 'حرمان أكاديمي'
                          : 'Blocked'
                        : isNear
                        ? isRTL
                          ? 'اقتراب من الحرمان'
                          : 'Near Limit'
                        : isRTL
                        ? 'وضع آمن'
                        : 'Safe'}
                    </Badge>
                  </div>

                  <h3 className="font-bold text-sm text-slate-900 dark:text-white line-clamp-1">
                    {c.courseName}
                  </h3>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-mono font-bold">
                      <span
                        className={
                          isBlocked
                            ? 'text-rose-600'
                            : isNear
                            ? 'text-amber-600'
                            : 'text-slate-700 dark:text-slate-200'
                        }
                      >
                        {c.absencePercent}% غياب
                      </span>
                      <span className="text-slate-400 text-[10px]">
                        الحد الأقصى {c.maxAbsencePercent}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          isBlocked
                            ? 'bg-rose-500'
                            : isNear
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{
                          width: `${Math.min(100, (c.absencePercent / c.maxAbsencePercent) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-700/60">
                    <span>حضور: {c.present}</span>
                    <span>غياب: {c.absent}</span>
                    <span>تأخير: {c.late}</span>
                    <span>معفى: {c.excused}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Student Official Notifications List */}
          {studentNotifications.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <Bell size={14} className="text-amber-500" />
                <span>{isRTL ? 'إشعارات الإنذار الرسمية' : 'Official Warning Notices'}</span>
              </h3>
              <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {studentNotifications.map((notif) => (
                  <div key={notif.id} className="py-2.5 text-xs space-y-0.5">
                    <p className="font-bold text-slate-800 dark:text-white">{notif.title}</p>
                    <p className="text-slate-500">{notif.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default StudentWarningsPage;
