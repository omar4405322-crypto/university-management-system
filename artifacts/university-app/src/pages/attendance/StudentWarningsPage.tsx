import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import {
  AlertTriangle, ShieldAlert, ShieldCheck, CheckCircle2,
  XCircle, Clock, BookOpen, Bell, RefreshCw, ArrowLeft,
  ArrowRight, Info, AlertCircle, Sparkles, FileText, Ban
} from 'lucide-react';
import attendanceService from '../../services/attendance.service';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/button';
import { EmptyState } from '../../components/ui/EmptyState';

export interface CourseWarningItem {
  enrollmentId: number;
  courseId: number;
  courseCode: string;
  courseName: string;
  status: 'ENROLLED' | 'BLOCKED' | 'COMPLETED' | 'WITHDRAWN' | 'FAILED';
  isBlocked: boolean;
  absencePercent: number;
  maxAbsencePercent: number;
  isExceeding: boolean;
  isNearLimit: boolean;
  totalSessions: number;
  present: number;
  late: number;
  absent: number;
  excused: number;
  exemptionPeriods?: Array<{
    id: number;
    startDate: string;
    endDate: string;
    reason: string;
    createdAt: string;
  }>;
}

export interface WarningNotificationItem {
  id: number;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

export function StudentWarningsPage() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const dateLocale = isRTL ? ar : enUS;

  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<CourseWarningItem[]>([]);
  const [notifications, setNotifications] = useState<WarningNotificationItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchWarningsData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await attendanceService.getMyWarnings();
      if (res?.success && res.data) {
        setCourses(res.data.courses || []);
        setNotifications(res.data.notifications || []);
      } else {
        setCourses([]);
        setNotifications([]);
      }
    } catch (err: any) {
      console.error('Failed to load warnings data:', err);
      setError(err?.response?.data?.message || err?.message || 'Failed to load absence warnings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWarningsData();
  }, [fetchWarningsData]);

  // Aggregate Metrics
  const blockedCount = courses.filter((c) => c.isBlocked || c.isExceeding).length;
  const nearLimitCount = courses.filter((c) => c.isNearLimit && !c.isBlocked && !c.isExceeding).length;
  const safeCount = courses.filter((c) => !c.isBlocked && !c.isExceeding && !c.isNearLimit).length;

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-24 animate-fade-in dir-rtl">
      
      {/* Top Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-brand-navy-900 to-slate-900 p-6 md:p-8 text-white shadow-xl border border-slate-800">
        <div className="absolute -start-10 -top-10 w-48 h-48 rounded-full bg-rose-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -end-10 -bottom-10 w-48 h-48 rounded-full bg-brand-primary-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-500 to-amber-600 text-white flex items-center justify-center shadow-lg shadow-rose-500/20 shrink-0">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-black uppercase tracking-wider text-rose-400">
                  {isRTL ? 'متابعة اللائحة الأكاديمية والغياب' : 'Academic Standing & Absence Policy'}
                </span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight drop-shadow-sm">
                {isRTL ? 'سجل الإنذارات والحرمان الأكاديمي' : 'Absence Warnings & Blocking Records'}
              </h1>
              <p className="text-slate-300 font-medium text-xs md:text-sm mt-1 leading-relaxed max-w-2xl">
                {isRTL
                  ? 'متابعة دقيقة لنسبة الغياب لكل مقرر وفقاً للحد الأقصى المسموح به (25%)، مع استعراض الإشعارات الرسمية وفترات الإعفاء المعتمدة.'
                  : 'Track your course-by-course absence rates against university limits (max 25%), official notices, and approved exemption periods.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            <Button
              onClick={fetchWarningsData}
              variant="outline"
              disabled={loading}
              className="bg-slate-800/80 hover:bg-slate-700 text-white border-slate-700 rounded-xl px-4 py-2.5 text-xs font-bold transition-all flex items-center gap-2 shadow-sm"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>{isRTL ? 'تحديث البيانات' : 'Refresh'}</span>
            </Button>
            <Link to="/attendance">
              <Button className="bg-brand-primary-600 hover:bg-brand-primary-700 text-white rounded-xl px-5 py-2.5 text-xs font-bold transition-all shadow-md flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                <span>{isRTL ? 'بوابة الحضور' : 'Attendance Portal'}</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Status Card 1: Academic Standing */}
        <Card className={`rounded-2xl border shadow-xs transition-all ${
          blockedCount > 0
            ? 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/60'
            : nearLimitCount > 0
            ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/60'
            : 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60'
        }`}>
          <CardContent className="p-5 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
              blockedCount > 0
                ? 'bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400'
                : nearLimitCount > 0
                ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400'
                : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400'
            }`}>
              {blockedCount > 0 ? (
                <Ban className="w-6 h-6" />
              ) : nearLimitCount > 0 ? (
                <AlertTriangle className="w-6 h-6" />
              ) : (
                <ShieldCheck className="w-6 h-6" />
              )}
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                {isRTL ? 'حالة القيد الأكاديمي' : 'Standing Status'}
              </span>
              <h4 className={`text-base font-black mt-0.5 ${
                blockedCount > 0
                  ? 'text-rose-700 dark:text-rose-300'
                  : nearLimitCount > 0
                  ? 'text-amber-700 dark:text-amber-300'
                  : 'text-emerald-700 dark:text-emerald-300'
              }`}>
                {blockedCount > 0
                  ? (isRTL ? 'يوجد حرمان في مقرر' : 'Course Blocked')
                  : nearLimitCount > 0
                  ? (isRTL ? 'إنذار: اقتراب من الحد' : 'Warning: Near Limit')
                  : (isRTL ? 'وضع أكاديمي سليم' : 'Good Standing')}
              </h4>
            </div>
          </CardContent>
        </Card>

        {/* Status Card 2: Blocked Courses Count */}
        <Card className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <XCircle className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                {isRTL ? 'المقررات المحظورة (حرمان)' : 'Blocked Courses'}
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-black text-slate-800 dark:text-white">{blockedCount}</span>
                <span className="text-xs text-slate-400 font-medium">{isRTL ? 'مقررات' : 'courses'}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Status Card 3: Near Limit Count */}
        <Card className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                {isRTL ? 'مقررات قريبة من الحد (≥20%)' : 'Near Limit (≥20%)'}
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-black text-slate-800 dark:text-white">{nearLimitCount}</span>
                <span className="text-xs text-slate-400 font-medium">{isRTL ? 'مقررات' : 'courses'}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Status Card 4: Safe Courses */}
        <Card className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                {isRTL ? 'مقررات بوضع آمن' : 'Safe Standing'}
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-black text-slate-800 dark:text-white">{safeCount}</span>
                <span className="text-xs text-slate-400 font-medium">{isRTL ? 'مقررات' : 'courses'}</span>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Main Content Layout: Left = Course Absence Warnings, Right = Official Notifications */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Section 1: Course Breakdown (Span 2 Columns) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-brand-primary-600 dark:text-brand-primary-400" />
              <span>{isRTL ? 'تفاصيل الغياب وسقف الحرمان لكل مقرر' : 'Course Absence Limits & Status'}</span>
            </h3>
            <span className="text-xs font-bold text-slate-400">
              {courses.length} {isRTL ? 'مقررات مسجلة' : 'Enrolled Courses'}
            </span>
          </div>

          {loading ? (
            <div className="p-12 text-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
              <RefreshCw className="w-8 h-8 animate-spin text-brand-primary-500 mx-auto mb-3" />
              <p className="text-slate-500 dark:text-slate-400 font-bold text-sm">
                {isRTL ? 'جاري تحميل بيانات المقررات والإنذارات...' : 'Loading course warning metrics...'}
              </p>
            </div>
          ) : error ? (
            <div className="p-6 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl text-center">
              <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
              <p className="text-rose-700 dark:text-rose-300 font-bold text-sm">{error}</p>
            </div>
          ) : courses.length === 0 ? (
            <EmptyState
              icon={<BookOpen className="w-10 h-10 text-slate-400" />}
              title={isRTL ? 'لا توجد مقررات دراسية مسجلة' : 'No Enrolled Courses'}
              subtitle={isRTL ? 'لم يتم العثور على مقررات مسجلة بحسابك لهذا الفصل الدراسي.' : 'No active course enrollments found for this semester.'}
            />
          ) : (
            <div className="space-y-4">
              {courses.map((c) => {
                const isBlocked = c.isBlocked || c.isExceeding;
                const isNear = c.isNearLimit && !isBlocked;
                const progressRatio = Math.min(100, Math.round((c.absencePercent / c.maxAbsencePercent) * 100));

                return (
                  <Card
                    key={c.courseId}
                    className={`rounded-2xl border shadow-xs transition-all overflow-hidden ${
                      isBlocked
                        ? 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/80 shadow-rose-500/5'
                        : isNear
                        ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/80'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <CardContent className="p-5 md:p-6">
                      
                      {/* Course Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge className="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-mono font-bold text-[11px] px-2 py-0.5">
                              {c.courseCode}
                            </Badge>
                            {c.exemptionPeriods && c.exemptionPeriods.length > 0 && (
                              <Badge className="bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border-sky-200 dark:border-sky-800 text-[10px] font-bold">
                                {c.exemptionPeriods.length} {isRTL ? 'إعفاء معتمد' : 'Exemptions'}
                              </Badge>
                            )}
                          </div>
                          <h4 className="text-base md:text-lg font-black text-slate-800 dark:text-white truncate">
                            {c.courseName}
                          </h4>
                        </div>

                        {/* Status Badge */}
                        <div className="shrink-0">
                          {isBlocked ? (
                            <Badge className="bg-rose-600 text-white font-black text-xs px-3.5 py-1 rounded-xl shadow-sm flex items-center gap-1.5 animate-pulse">
                              <Ban className="w-3.5 h-3.5" />
                              <span>{isRTL ? 'محروم من المقرر (BLOCKED)' : 'Blocked / Barred'}</span>
                            </Badge>
                          ) : isNear ? (
                            <Badge className="bg-amber-500 text-white font-black text-xs px-3.5 py-1 rounded-xl shadow-sm flex items-center gap-1.5">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              <span>{isRTL ? 'تحذير: اقتراب من الحرمان' : 'Warning: Near Limit'}</span>
                            </Badge>
                          ) : (
                            <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 font-bold text-xs px-3 py-1 rounded-xl flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{isRTL ? 'وضع منتظم' : 'Good Standing'}</span>
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Prominent Alert Banner if Blocked */}
                      {isBlocked && (
                        <div className="mb-4 bg-rose-500/10 border border-rose-500/30 rounded-xl p-3.5 flex items-start gap-3">
                          <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                          <p className="text-xs text-rose-800 dark:text-rose-200 font-bold leading-relaxed">
                            {isRTL
                              ? `تم حرمانك من هذا المقرر لتجاوز نسبة الغياب المسموح بها (${c.maxAbsencePercent}%). يرجى مراجعة إدارة الكلية وشؤون الطلاب في أقرب وقت.`
                              : `You are barred from this course for exceeding the maximum allowable absence limit (${c.maxAbsencePercent}%). Please contact academic affairs.`}
                          </p>
                        </div>
                      )}

                      {/* Absence Metric & Progress Bar */}
                      <div className="space-y-2 mb-4 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="text-slate-600 dark:text-slate-400">
                            {isRTL ? 'نسبة الغياب الحالية:' : 'Current Absence Rate:'}
                          </span>
                          <div className="flex items-baseline gap-1.5 font-mono">
                            <span className={`text-base font-black ${
                              isBlocked ? 'text-rose-600 dark:text-rose-400' : isNear ? 'text-amber-600 dark:text-amber-400' : 'text-slate-800 dark:text-white'
                            }`}>
                              {c.absencePercent}%
                            </span>
                            <span className="text-slate-400">/ {c.maxAbsencePercent}% {isRTL ? 'الحد الأقصى' : 'Max'}</span>
                          </div>
                        </div>

                        {/* Visual Progress Bar */}
                        <div className="h-3 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden relative">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${
                              isBlocked
                                ? 'bg-gradient-to-r from-rose-500 to-rose-600'
                                : isNear
                                ? 'bg-gradient-to-r from-amber-400 to-amber-500'
                                : 'bg-gradient-to-r from-emerald-500 to-teal-500'
                            }`}
                            style={{ width: `${Math.min(100, (c.absencePercent / c.maxAbsencePercent) * 100)}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
                          <span>0%</span>
                          <span className="text-amber-500 font-bold">20% ({isRTL ? 'نطاق الإنذار' : 'Warning Zone'})</span>
                          <span className="text-rose-500 font-bold">{c.maxAbsencePercent}% ({isRTL ? 'الحرمان' : 'Barred'})</span>
                        </div>
                      </div>

                      {/* Mini Stat Counters */}
                      <div className="grid grid-cols-4 gap-2 text-center">
                        <div className="bg-slate-100/70 dark:bg-slate-700/40 p-2 rounded-xl">
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">{isRTL ? 'المحاضرات' : 'Sessions'}</span>
                          <span className="font-mono font-black text-sm text-slate-800 dark:text-white">{c.totalSessions}</span>
                        </div>
                        <div className="bg-emerald-50 dark:bg-emerald-950/40 p-2 rounded-xl border border-emerald-100 dark:border-emerald-900/40">
                          <span className="text-[10px] text-emerald-700 dark:text-emerald-400 block font-medium">{isRTL ? 'حاضر' : 'Present'}</span>
                          <span className="font-mono font-black text-sm text-emerald-600 dark:text-emerald-400">{c.present}</span>
                        </div>
                        <div className="bg-amber-50 dark:bg-amber-950/40 p-2 rounded-xl border border-amber-100 dark:border-amber-900/40">
                          <span className="text-[10px] text-amber-700 dark:text-amber-400 block font-medium">{isRTL ? 'متأخر' : 'Late'}</span>
                          <span className="font-mono font-black text-sm text-amber-600 dark:text-amber-400">{c.late}</span>
                        </div>
                        <div className="bg-rose-50 dark:bg-rose-950/40 p-2 rounded-xl border border-rose-100 dark:border-rose-900/40">
                          <span className="text-[10px] text-rose-700 dark:text-rose-400 block font-medium">{isRTL ? 'غائب' : 'Absent'}</span>
                          <span className="font-mono font-black text-sm text-rose-600 dark:text-rose-400">{c.absent}</span>
                        </div>
                      </div>

                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Section 2: Official Absence & Enrollment Notifications History (Span 1 Column) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
              <Bell className="w-5 h-5 text-amber-500" />
              <span>{isRTL ? 'سجل الإشعارات الرسمية' : 'Official Notices'}</span>
            </h3>
            <span className="text-xs font-bold text-slate-400">
              {notifications.length} {isRTL ? 'إشعار' : 'Notices'}
            </span>
          </div>

          <Card className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden">
            <CardContent className="p-4 sm:p-5">
              {loading ? (
                <div className="p-8 text-center">
                  <RefreshCw className="w-6 h-6 animate-spin text-slate-400 mx-auto mb-2" />
                  <span className="text-xs text-slate-400">{isRTL ? 'جاري تحميل الإشعارات...' : 'Loading notices...'}</span>
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <ShieldCheck className="w-10 h-10 mx-auto mb-2 text-emerald-400 opacity-60" />
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    {isRTL ? 'لا توجد إنذارات أو إشعارات حرمان' : 'No Absence Warnings'}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {isRTL ? 'سجلك نظيف ولم يتم توجيه أي إنذار غياب رسمي بحسابك.' : 'Your record is clean with no formal absence notices.'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-700/80">
                  {notifications.map((n) => {
                    const isError = n.type === 'error';
                    const isSuccess = n.type === 'success';
                    return (
                      <div key={n.id} className="py-3.5 first:pt-0 last:pb-0 flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                          isError
                            ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400'
                            : isSuccess
                            ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400'
                            : 'bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400'
                        }`}>
                          {isError ? (
                            <XCircle className="w-4 h-4" />
                          ) : isSuccess ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : (
                            <AlertTriangle className="w-4 h-4" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <h5 className="text-xs font-black text-slate-800 dark:text-white truncate">
                              {n.title}
                            </h5>
                            <span className="text-[10px] text-slate-400 font-mono shrink-0">
                              {format(new Date(n.createdAt), 'dd/MM/yyyy', { locale: dateLocale })}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                            {n.message}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      </div>

    </div>
  );
}

export default StudentWarningsPage;
