import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { 
  Calendar, CheckCircle2, Clock, XCircle, BookOpen, AlertCircle, ScanLine, History, MapPin, Filter, ShieldAlert, ChevronDown, ChevronUp
} from 'lucide-react';
import attendanceService from '../../services/attendance.service';
import studentsService from '../../services/students.service';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { StudentAttendanceScanner } from '../../components/attendance/StudentAttendanceScanner';
import { SessionCountdown } from '../../components/attendance/SessionCountdown';

export function StudentAttendanceDashboard() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const dateLocale = isRTL ? ar : enUS;
  
  // Helper to resolve translation keys safely
  const txt = (key: string, fallback: string) => {
    const val = t(key);
    return val === key ? fallback : val;
  };

  const [myCourses, setMyCourses] = useState<any[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [myAttendance, setMyAttendance] = useState<any[]>([]);
  const [centralStats, setCentralStats] = useState<any>(null);
  const [activeSession, setActiveSession] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);

  useEffect(() => {
    studentsService.getStudentStatistics('me')
      .then(res => {
        if (res.success && res.data?.attendance) {
          setCentralStats(res.data.attendance);
        }
      })
      .catch((err) => console.error('Failed to load centralized student statistics:', err));

    attendanceService.getMyCourses()
      .then(res => {
        const courses = res.data || [];
        setMyCourses(courses);
        if (courses.length > 0 && selectedCourseId === null) {
          setSelectedCourseId(courses[0].id);
        }
      })
      .catch((err) => console.error('Failed to load courses:', err));
  }, []);

  useEffect(() => {
    setLoading(true);
    attendanceService.getMyAttendance(selectedCourseId || undefined)
      .then(res => setMyAttendance(res.data || []))
      .catch((err) => console.error('Failed to load attendance records:', err))
      .finally(() => setLoading(false));

    if (selectedCourseId) {
      attendanceService.getActiveSession(selectedCourseId)
        .then(res => {
          if (res?.data?.sessionId) {
            setActiveSession(res.data);
          } else {
            setActiveSession(null);
          }
        })
        .catch(() => setActiveSession(null));
    } else {
      setActiveSession(null);
    }
  }, [selectedCourseId]);

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'PRESENT': 
        return (
          <Badge className="bg-brand-primary-50 text-brand-primary-800 dark:bg-brand-primary-950/60 dark:text-brand-primary-300 border-brand-primary-200 dark:border-brand-primary-800 px-3 py-0.5 text-[11px] font-bold shadow-xs flex items-center gap-1 shrink-0">
            <CheckCircle2 className="w-3 h-3" />
            {txt('attendance.present', 'حاضر')}
          </Badge>
        );
      case 'ABSENT': 
        return (
          <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800 px-3 py-0.5 text-[11px] font-bold shadow-xs flex items-center gap-1 shrink-0">
            <XCircle className="w-3 h-3" />
            {txt('attendance.absent', 'غائب')}
          </Badge>
        );
      case 'LATE': 
        return (
          <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800 px-3 py-0.5 text-[11px] font-bold shadow-xs flex items-center gap-1 shrink-0">
            <Clock className="w-3 h-3" />
            {txt('attendance.late', 'متأخر')}
          </Badge>
        );
      case 'EXCUSED': 
        return (
          <Badge className="bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border-sky-200 dark:border-sky-800 px-3 py-0.5 text-[11px] font-bold shadow-xs flex items-center gap-1 shrink-0">
            <AlertCircle className="w-3 h-3" />
            {txt('attendance.excused', 'عذر')}
          </Badge>
        );
      default: 
        return null;
    }
  };

  // Calculate statistics:
  // - For All Courses view (selectedCourseId === null): use centralStats breakdown & rate when available.
  // - For specific course: compute strictly from that course's myAttendance array using formula ((present + late * 0.5) / activeTotal) * 100.
  const getStats = () => {
    let present = 0, absent = 0, late = 0, excused = 0;
    myAttendance.forEach(a => {
      if (a.status === 'PRESENT') present++;
      if (a.status === 'ABSENT') absent++;
      if (a.status === 'LATE') late++;
      if (a.status === 'EXCUSED') excused++;
    });

    const isAllCourses = selectedCourseId === null;

    const displayTotal = isAllCourses && centralStats?.totalSessions !== undefined
      ? centralStats.totalSessions
      : myAttendance.length;
    const displayPresent = isAllCourses && centralStats?.present !== undefined
      ? centralStats.present
      : present;
    const displayLate = isAllCourses && centralStats?.late !== undefined
      ? centralStats.late
      : late;
    const displayAbsent = isAllCourses && centralStats?.absent !== undefined
      ? centralStats.absent
      : absent;
    const displayExcused = isAllCourses && centralStats?.excused !== undefined
      ? centralStats.excused
      : excused;

    const activeTotal = displayTotal - displayExcused;
    
    let percentage: number;
    if (isAllCourses) {
      percentage = centralStats?.rate !== undefined
        ? Math.round(centralStats.rate)
        : (activeTotal > 0 ? Math.round(((displayPresent + displayLate * 0.5) / activeTotal) * 100) : 0);
    } else {
      percentage = activeTotal > 0
        ? Math.round(((present + late * 0.5) / activeTotal) * 100)
        : 0;
    }

    const currentCourse = myCourses.find(c => c.id === selectedCourseId);
    const configuredThreshold = currentCourse?.maxAbsencePercent || currentCourse?.absenceThreshold || null;
    const absencePercent = activeTotal > 0 ? ((displayAbsent + displayLate * 0.5) / activeTotal) * 100 : 0;
    const isAboveThreshold = !isAllCourses && configuredThreshold !== null && absencePercent >= configuredThreshold;

    return { 
      present: displayPresent, 
      absent: displayAbsent, 
      late: displayLate, 
      excused: displayExcused,
      total: displayTotal, 
      percentage,
      configuredThreshold,
      isAboveThreshold
    };
  };

  const stats = getStats();
  const selectedCourse = myCourses.find(c => c.id === selectedCourseId);
  const selectedCourseName = selectedCourse ? `${selectedCourse.courseCode || ''} ${selectedCourse.name || ''}`.trim() : '';

  // Circular gauge style helper (Green >=85%, Amber 75-84%, Red <75%)
  const getGaugeStyle = (pct: number) => {
    if (pct >= 85) {
      return {
        stroke: '#84BD3A', // brand-primary-500
        text: 'text-brand-primary-600 dark:text-brand-primary-400',
        label: isRTL ? 'ممتاز' : 'Excellent',
        badgeClass: 'bg-brand-primary-100 text-brand-primary-800 dark:bg-brand-primary-950/60 dark:text-brand-primary-300 border-brand-primary-300 dark:border-brand-primary-800'
      };
    }
    if (pct >= 75) {
      return {
        stroke: '#F59E0B', // amber-500
        text: 'text-amber-600 dark:text-amber-400',
        label: isRTL ? 'مقبول' : 'Fair',
        badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800'
      };
    }
    return {
      stroke: '#EF4444', // rose-500
      text: 'text-rose-600 dark:text-rose-400',
      label: isRTL ? 'منخفض' : 'At Risk',
      badgeClass: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300 dark:border-rose-800'
    };
  };

  const gaugeStyle = getGaugeStyle(stats.percentage);
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (stats.percentage / 100) * circumference;

  // History list pagination slice
  const displayedAttendance = showAllHistory ? myAttendance : myAttendance.slice(0, 6);

  return (
    <div className="space-y-5 md:space-y-6 relative pb-28 animate-fade-in max-w-[1400px] mx-auto dir-rtl">
      
      {/* Full-Screen Glassmorphism Scanner Overlay */}
      {showScanner && (
        <div className="fixed inset-0 z-50 bg-brand-navy-900/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="max-w-lg w-full relative">
            <StudentAttendanceScanner
              onCancel={() => setShowScanner(false)}
              selectedCourseId={selectedCourseId}
              courses={myCourses}
            />
          </div>
        </div>
      )}

      {/* Attendance-Page-Only Floating Action Button (FAB) */}
      <div className="fixed bottom-6 inset-inline-end-6 z-40">
        <button 
          onClick={() => setShowScanner(true)}
          className="bg-brand-primary-600 hover:bg-brand-primary-700 active:scale-95 text-white shadow-xl hover:shadow-2xl rounded-full h-14 w-14 md:w-auto md:px-6 flex items-center justify-center gap-2.5 transition-all border border-brand-primary-400/30 font-bold"
          aria-label={txt('attendance.studentScanner', 'تسجيل الحضور الآن')}
        >
          <ScanLine className="w-6 h-6 shrink-0" />
          <span className="hidden md:inline text-sm tracking-wide">
            {txt('attendance.studentScanner', 'تسجيل الحضور الآن')}
          </span>
        </button>
      </div>

      {/* Header Banner - High-contrast text on Brand Navy Gradient */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-navy-700 via-brand-navy-600 to-brand-navy-500 p-5 md:p-7 shadow-md border border-brand-navy-400/30 text-white">
        <div className="relative z-10 flex flex-col md:flex-row gap-5 items-start md:items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-13 h-13 rounded-2xl bg-brand-primary-500 text-white flex items-center justify-center shadow-md shrink-0 border border-brand-primary-400/40">
              <ScanLine className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-white tracking-tight mb-1 drop-shadow-xs">
                {txt('attendance.studentDashboard', 'بوابة الحضور والانصراف')}
              </h1>
              <p className="text-slate-100 dark:text-white/95 font-medium text-xs md:text-sm leading-relaxed opacity-95">
                {isRTL 
                  ? 'تابع سجل حضورك في جميع المقررات الدراسية وقم بتسجيل الحضور المباشر بنقرة واحدة.' 
                  : 'Track your lecture attendance records and check in live with one tap.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link to="/warnings">
              <button className="bg-brand-navy-800/90 hover:bg-brand-navy-800 text-amber-300 hover:text-amber-200 border border-amber-500/40 rounded-xl px-4 py-2.5 text-xs font-bold transition-all flex items-center gap-2 shadow-sm cursor-pointer hover:scale-105 active:scale-95">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                <span>{isRTL ? 'إنذارات الغياب' : 'Absence Warnings'}</span>
              </button>
            </Link>
          </div>
        </div>

        {/* Course Selection Bar (Horizontal Chips) */}
        {myCourses.length > 0 && (
          <div className="mt-5 pt-4 border-t border-brand-navy-400/40">
            <div className="flex items-center gap-2 mb-2.5 text-xs font-bold text-slate-100">
              <Filter className="w-3.5 h-3.5 text-brand-primary-400" />
              <span>{isRTL ? 'اختر المقرر الدراسي:' : 'Select Course:'}</span>
            </div>
            
            <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-none">
              <button
                onClick={() => setSelectedCourseId(null)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 border ${
                  selectedCourseId === null
                    ? 'bg-brand-primary-600 text-white border-brand-primary-400 shadow-xs'
                    : 'bg-brand-navy-800/90 text-slate-100 hover:bg-brand-navy-800 hover:text-white border-brand-navy-600'
                }`}
              >
                {isRTL ? 'جميع المقررات' : 'All Courses'}
              </button>

              {myCourses.map(course => (
                <button
                  key={course.id}
                  onClick={() => setSelectedCourseId(course.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 border ${
                    selectedCourseId === course.id
                      ? 'bg-brand-primary-600 text-white border-brand-primary-400 shadow-xs'
                      : 'bg-brand-navy-800/90 text-slate-100 hover:bg-brand-navy-800 hover:text-white border-brand-navy-600'
                  }`}
                >
                  {course.courseCode ? `${course.courseCode} - ` : ''}{course.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main Dashboard Content */}
      <div className="space-y-5 md:space-y-6">
        
        {/* Active Session Live Alert Banner */}
        {activeSession?.expiresAt && (
          <div className="bg-gradient-to-r from-slate-900 via-brand-navy-900 to-slate-900 text-white rounded-2xl p-4 md:p-5 shadow-lg border border-brand-primary-500/40 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0 relative">
                <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping absolute" />
                <ScanLine className="w-5 h-5 relative" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                    {isRTL ? 'جلسة حضور نشطة الآن' : 'Active Lecture Session'}
                  </span>
                </div>
                <h4 className="text-base font-black text-white truncate">
                  {selectedCourse ? `${selectedCourse.courseCode ? `${selectedCourse.courseCode} - ` : ''}${selectedCourse.name}` : (isRTL ? 'محاضرة جارية' : 'Ongoing Lecture')}
                </h4>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end shrink-0">
              <SessionCountdown
                expiresAt={activeSession.expiresAt}
                createdAt={activeSession.createdAt}
                gracePeriodMins={activeSession.gracePeriodMins}
                variant="badge"
              />
              <button
                onClick={() => setShowScanner(true)}
                className="bg-brand-primary-600 hover:bg-brand-primary-700 active:scale-95 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-md transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <ScanLine className="w-4 h-4" />
                <span>{isRTL ? 'تسجيل الحضور' : 'Check In'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Unified Glance-able Summary Widget */}
        <Card className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs p-5 md:p-6 overflow-hidden">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            
            {/* Circular Percentage Gauge Unit */}
            <div className="flex items-center gap-5 w-full md:w-auto shrink-0 pb-4 md:pb-0 border-b md:border-b-0 md:border-e border-slate-100 dark:border-slate-700/80 pe-0 md:pe-8">
              <div className="relative w-24 h-24 shrink-0 flex items-center justify-center">
                <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 90 90">
                  <circle 
                    cx="45" 
                    cy="45" 
                    r={radius} 
                    className="stroke-slate-100 dark:stroke-slate-700/60" 
                    strokeWidth="8" 
                    fill="transparent" 
                  />
                  <circle 
                    cx="45" 
                    cy="45" 
                    r={radius} 
                    stroke={gaugeStyle.stroke} 
                    strokeWidth="8" 
                    strokeDasharray={circumference} 
                    strokeDashoffset={strokeDashoffset} 
                    strokeLinecap="round" 
                    fill="transparent" 
                    className="transition-all duration-700 ease-out" 
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-xl font-black text-slate-800 dark:text-white leading-none">
                    {stats.percentage}%
                  </span>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-sm text-slate-800 dark:text-white">
                    {txt('attendance.attendanceRate', 'نسبة الحضور التراكمية')}
                  </h3>
                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${gaugeStyle.badgeClass}`}>
                    {gaugeStyle.label}
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-medium">
                  {isRTL ? 'تحسب من إجمالي المحاضرات النشطة' : 'Calculated from active sessions'}
                </p>
                {stats.isAboveThreshold && stats.configuredThreshold !== null && (
                  <div className="mt-2 inline-flex items-center gap-1.5 bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 px-2.5 py-1 rounded-lg text-xs font-bold">
                    <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-rose-600 dark:text-rose-400" />
                    <span>تجاوز نسبة الغياب المسموحة ({stats.configuredThreshold}%)</span>
                  </div>
                )}
              </div>
            </div>

            {/* Compact Inline Counter Grid (4 Stat Blocks) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full flex-1">
              
              {/* Stat 1: Total Sessions */}
              <div className="bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-xl border border-slate-100 dark:border-slate-700/60 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-slate-200/80 dark:bg-slate-700/80 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 font-bold block leading-tight">
                    {txt('attendance.heldSessions', 'المحاضرات')}
                  </span>
                  <span className="text-lg font-black text-slate-800 dark:text-white leading-tight">
                    {stats.total}
                  </span>
                </div>
              </div>

              {/* Stat 2: Present */}
              <div className="bg-brand-primary-50/50 dark:bg-brand-primary-950/20 p-3.5 rounded-xl border border-brand-primary-200/50 dark:border-brand-primary-900/40 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-brand-primary-100 dark:bg-brand-primary-950 text-brand-primary-700 dark:text-brand-primary-300 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[11px] text-brand-primary-800 dark:text-brand-primary-300 font-bold block leading-tight">
                    {txt('attendance.present', 'حاضر')}
                  </span>
                  <span className="text-lg font-black text-slate-800 dark:text-white leading-tight">
                    {stats.present}
                  </span>
                </div>
              </div>

              {/* Stat 3: Late */}
              <div className="bg-amber-50/50 dark:bg-amber-950/20 p-3.5 rounded-xl border border-amber-200/50 dark:border-amber-900/40 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[11px] text-amber-800 dark:text-amber-300 font-bold block leading-tight">
                    {txt('attendance.late', 'متأخر')}
                  </span>
                  <span className="text-lg font-black text-slate-800 dark:text-white leading-tight">
                    {stats.late}
                  </span>
                </div>
              </div>

              {/* Stat 4: Absent */}
              <div className="bg-rose-50/50 dark:bg-rose-950/20 p-3.5 rounded-xl border border-rose-200/50 dark:border-rose-900/40 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 flex items-center justify-center shrink-0">
                  <XCircle className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[11px] text-rose-800 dark:text-rose-300 font-bold block leading-tight">
                    {txt('attendance.absent', 'غائب')}
                  </span>
                  <span className="text-lg font-black text-slate-800 dark:text-white leading-tight">
                    {stats.absent}
                  </span>
                </div>
              </div>

            </div>

          </div>
        </Card>

        {/* Detailed History Table / Compact Single-Line Rows with Expandable Pagination */}
        <Card className="bg-white dark:bg-slate-800 rounded-2xl shadow-xs border border-slate-200 dark:border-slate-700 overflow-hidden">
          <CardHeader className="border-b border-slate-100 dark:border-slate-700/80 px-5 py-4 bg-slate-50/50 dark:bg-slate-900/50 flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-brand-primary-500/10 text-brand-primary-600 dark:text-brand-primary-400 rounded-xl border border-brand-primary-500/20">
                <History className="w-4 h-4 md:w-5 md:h-5" />
              </div>
              <div>
                <CardTitle className="text-sm md:text-base font-bold">
                  {txt('attendance.history', 'سجل الحضور التفصيلي')}
                </CardTitle>
                <p className="text-xs text-slate-400 font-medium">
                  {selectedCourseName || (isRTL ? 'عرض أحدث السجلات الحالية' : 'Showing recent records')}
                </p>
              </div>
            </div>
            
            {selectedCourseName && (
              <Badge className="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-600 font-bold text-xs px-2.5 py-0.5">
                {selectedCourseName}
              </Badge>
            )}
          </CardHeader>

          <CardContent className="p-0">
            {loading ? (
              <div className="py-16 text-center text-slate-400 font-medium text-sm">
                {isRTL ? 'جاري تحميل سجلات الحضور...' : 'Loading attendance records...'}
              </div>
            ) : myAttendance.length === 0 ? (
              <div className="py-14 px-4">
                <EmptyState 
                  icon={<Calendar className="w-12 h-12 text-slate-300 dark:text-slate-600" />} 
                  title={txt('attendance.noRecords', 'لا توجد سجلات حضور حتى الآن')} 
                  subtitle={isRTL ? 'عند تسجيل الحضور في المحاضرات القادمة، ستظهر جميع السجلات هنا تفصيلياً.' : 'When you check into upcoming lectures, your records will appear here.'} 
                />
              </div>
            ) : (
              <div>
                {/* Single-Line Compact Rows */}
                <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {displayedAttendance.map((record, idx) => (
                    <div 
                      key={record.sessionId || idx} 
                      className="flex items-center justify-between px-4 py-3 sm:px-5 sm:py-3.5 hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors gap-3"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="font-bold text-slate-800 dark:text-white text-xs sm:text-sm truncate">
                          {format(new Date(record.date), 'EEEE, dd MMMM yyyy', { locale: dateLocale })}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 shrink-0 hidden sm:inline-flex ms-1">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          {isRTL ? 'في الحرم' : 'On campus'}
                        </span>
                        {record.remarks && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 font-semibold truncate">
                            <AlertCircle className="w-3 h-3 shrink-0" />
                            {record.remarks}
                          </span>
                        )}
                      </div>

                      <div className="shrink-0">
                        {renderStatusBadge(record.status)}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Show More / Show Less Toggle Button Footer */}
                {myAttendance.length > 6 && (
                  <div className="p-3 border-t border-slate-100 dark:border-slate-700/60 bg-slate-50/40 dark:bg-slate-900/30 text-center">
                    <button
                      onClick={() => setShowAllHistory(!showAllHistory)}
                      className="inline-flex items-center justify-center gap-1.5 text-xs font-bold text-brand-primary-600 hover:text-brand-primary-700 dark:text-brand-primary-400 dark:hover:text-brand-primary-300 py-1 px-4 rounded-xl hover:bg-brand-primary-50 dark:hover:bg-brand-primary-950/40 transition-all"
                    >
                      <span>
                        {showAllHistory 
                          ? (isRTL ? 'عرض أحدث 6 سجلات فقط' : 'Show top 6 records only')
                          : (isRTL ? `عرض جميع السجلات (${myAttendance.length} سجل)` : `Show all ${myAttendance.length} records`)}
                      </span>
                      {showAllHistory ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
