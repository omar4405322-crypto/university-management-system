import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  BarChart3, CheckCircle2, Clock, XCircle, AlertCircle, BookOpen, 
  Award, GraduationCap, FolderKanban, ShieldCheck, User, ArrowRight
} from 'lucide-react';
import studentsService from '../../services/students.service';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/button';

interface StudentStatisticsPageProps {
  customStudentId?: string;
  isAdvisorView?: boolean;
}

export default function StudentStatisticsPage({ customStudentId, isAdvisorView }: StudentStatisticsPageProps) {
  const { studentId: routeStudentId } = useParams<{ studentId?: string }>();
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const targetId = customStudentId || routeStudentId || 'me';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    studentsService.getStudentStatistics(targetId)
      .then((res) => {
        if (res.success && res.data) {
          setData(res.data);
        } else {
          setError(res.message || 'Failed to load student statistics');
        }
      })
      .catch((err) => {
        console.error('Error fetching student statistics:', err);
        setError(err.response?.data?.message || err.message || 'Failed to load statistics');
      })
      .finally(() => setLoading(false));
  }, [targetId]);

  // Gauge indicator style generator
  const getGaugeStyle = (rate: number) => {
    if (rate >= 85) {
      return {
        stroke: '#84BD3A',
        bgBg: 'bg-emerald-50 dark:bg-emerald-950/40',
        textColor: 'text-emerald-600 dark:text-emerald-400',
        borderColor: 'border-emerald-200 dark:border-emerald-800',
        label: isRTL ? 'ممتاز' : 'Excellent',
        badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300'
      };
    }
    if (rate >= 75) {
      return {
        stroke: '#F59E0B',
        bgBg: 'bg-amber-50 dark:bg-amber-950/40',
        textColor: 'text-amber-600 dark:text-amber-400',
        borderColor: 'border-amber-200 dark:border-amber-800',
        label: isRTL ? 'مقبول' : 'Fair',
        badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300'
      };
    }
    return {
      stroke: '#EF4444',
      bgBg: 'bg-rose-50 dark:bg-rose-950/40',
      textColor: 'text-rose-600 dark:text-rose-400',
      borderColor: 'border-rose-200 dark:border-rose-800',
      label: isRTL ? 'منخفض' : 'At Risk',
      badgeClass: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-300'
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-brand-primary-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-bold text-slate-500">
            {isRTL ? 'جاري تحميل الإحصائيات الأكاديمية...' : 'Loading academic statistics...'}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-rose-200 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/20">
          <CardContent className="pt-6 flex flex-col items-center text-center gap-3">
            <AlertCircle className="w-12 h-12 text-rose-500" />
            <h3 className="text-lg font-bold text-rose-800 dark:text-rose-200">
              {isRTL ? 'تعذر تحميل البيانات' : 'Failed to load statistics'}
            </h3>
            <p className="text-sm text-rose-600 dark:text-rose-300">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const student = data?.student;
  const attendance = data?.attendance || { rate: 0, totalSessions: 0, present: 0, late: 0, absent: 0, excused: 0 };
  const academics = data?.academics || {
    cumulativeGpa: 0,
    gpaString: '0.00',
    totalCreditsEarned: 0,
    totalCreditsAttempted: 0,
    coursesCount: 0,
    courses: [],
  };

  const gaugeStyle = getGaugeStyle(attendance.rate);

  // GPA standing style generator
  const getGpaStanding = (gpa: number) => {
    if (gpa >= 3.5) {
      return {
        label: isRTL ? 'ممتاز (مرتبة الشرف)' : 'Excellent (Honors)',
        badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300',
        stroke: '#10B981',
        textClass: 'text-emerald-600 dark:text-emerald-400',
      };
    }
    if (gpa >= 3.0) {
      return {
        label: isRTL ? 'جيد جداً' : 'Very Good',
        badgeClass: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 border-sky-300',
        stroke: '#0EA5E9',
        textClass: 'text-sky-600 dark:text-sky-400',
      };
    }
    if (gpa >= 2.0) {
      return {
        label: isRTL ? 'جيد' : 'Good',
        badgeClass: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border-indigo-300',
        stroke: '#6366F1',
        textClass: 'text-indigo-600 dark:text-indigo-400',
      };
    }
    if (gpa >= 1.0) {
      return {
        label: isRTL ? 'مقبول' : 'Fair / Pass',
        badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300',
        stroke: '#F59E0B',
        textClass: 'text-amber-600 dark:text-amber-400',
      };
    }
    return {
      label: isRTL ? 'إنذار أكاديمي / تعثر' : 'Academic Warning / At Risk',
      badgeClass: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-300',
      stroke: '#EF4444',
      textClass: 'text-rose-600 dark:text-rose-400',
    };
  };

  const gpaStanding = getGpaStanding(academics.cumulativeGpa);

  const getLetterBadge = (letterGrade: string, gradePoints: number) => {
    switch (letterGrade) {
      case 'A':
        return <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 font-bold">A ({gradePoints.toFixed(1)})</Badge>;
      case 'B':
        return <Badge className="bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 border-sky-300 font-bold">B ({gradePoints.toFixed(1)})</Badge>;
      case 'C':
        return <Badge className="bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border-indigo-300 font-bold">C ({gradePoints.toFixed(1)})</Badge>;
      case 'D':
        return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300 font-bold">D ({gradePoints.toFixed(1)})</Badge>;
      case 'F':
      default:
        return <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-300 font-bold">F (0.0)</Badge>;
    }
  };

  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (attendance.rate / 100) * circumference;

  const gpaProgressOffset = circumference - Math.min(1, academics.cumulativeGpa / 4.0) * circumference;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      
      {/* Page Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-primary-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-2xl font-black text-white shrink-0">
              {student?.user?.profilePicture ? (
                <img src={student.user.profilePicture} alt="Student" className="w-full h-full rounded-2xl object-cover" />
              ) : (
                <span>{student?.firstName?.[0] || 'S'}</span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight">
                  {student ? `${student.firstName} ${student.lastName}` : (t('statistics.title') || 'Student Statistics')}
                </h1>
                {isAdvisorView && (
                  <Badge className="bg-sky-500/20 text-sky-200 border-sky-400/30 text-xs">
                    <ShieldCheck className="w-3.5 h-3.5 mr-1 inline" />
                    {isRTL ? 'عرض المرشد الأكاديمي' : 'Advisor View'}
                  </Badge>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 flex items-center gap-3 flex-wrap">
                <span>{isRTL ? 'الرقم الجامعي:' : 'ID:'} <strong className="text-white font-mono">{student?.studentId || 'N/A'}</strong></span>
                <span>•</span>
                <span>{isRTL ? 'السنة:' : 'Year:'} <strong className="text-white">{student?.year || 1}</strong></span>
                {student?.department && (
                  <>
                    <span>•</span>
                    <span>{isRTL ? (student.department.nameAr || student.department.name) : student.department.name}</span>
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Grid of Main Functional Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Card 1: Attendance Performance */}
        <Card className="border-slate-200/80 dark:border-slate-800 shadow-md">
          <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800/80 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-emerald-500" />
              {isRTL ? 'نسبة وسجل الحضور' : 'Attendance Performance'}
            </CardTitle>
            <span className="text-xs text-slate-400 font-medium">
              {isRTL ? 'سجل المحاضرات' : 'Lecture Registry'}
            </span>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            
            {/* Main Percentage Gauge */}
            <div className="flex items-center gap-6 p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800">
              <div className="relative w-24 h-24 flex items-center justify-center shrink-0">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r={radius}
                    stroke="currentColor"
                    strokeWidth="8"
                    className="text-slate-200 dark:text-slate-800"
                    fill="transparent"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r={radius}
                    stroke={gaugeStyle.stroke}
                    strokeWidth="8"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    fill="transparent"
                    className="transition-all duration-1000 ease-out"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-2xl font-black text-slate-800 dark:text-white leading-none">
                    {attendance.rate}%
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-sm text-slate-800 dark:text-white">
                    {isRTL ? 'نسبة الحضور الإجمالية' : 'Overall Attendance Rate'}
                  </h4>
                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${gaugeStyle.badgeClass}`}>
                    {gaugeStyle.label}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  {isRTL ? 'محسوبة من السجلات المركزية' : 'Calculated from central records'}
                </p>
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-2">
                  {isRTL ? `إجمالي المحاضرات: ${attendance.totalSessions}` : `Total Sessions: ${attendance.totalSessions}`}
                </p>
              </div>
            </div>

            {/* 4 Stat Breakdown Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/20 rounded-xl border border-emerald-100 dark:border-emerald-900/40 text-center">
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 block">{isRTL ? 'حضور' : 'Present'}</span>
                <span className="text-xl font-black text-emerald-800 dark:text-emerald-200">{attendance.present}</span>
              </div>
              <div className="p-3 bg-amber-50/60 dark:bg-amber-950/20 rounded-xl border border-amber-100 dark:border-amber-900/40 text-center">
                <span className="text-xs font-bold text-amber-700 dark:text-amber-400 block">{isRTL ? 'تأخير' : 'Late'}</span>
                <span className="text-xl font-black text-amber-800 dark:text-amber-200">{attendance.late}</span>
              </div>
              <div className="p-3 bg-rose-50/60 dark:bg-rose-950/20 rounded-xl border border-rose-100 dark:border-rose-900/40 text-center">
                <span className="text-xs font-bold text-rose-700 dark:text-rose-400 block">{isRTL ? 'غياب' : 'Absent'}</span>
                <span className="text-xl font-black text-rose-800 dark:text-rose-200">{attendance.absent}</span>
              </div>
              <div className="p-3 bg-sky-50/60 dark:bg-sky-950/20 rounded-xl border border-sky-100 dark:border-sky-900/40 text-center">
                <span className="text-xs font-bold text-sky-700 dark:text-sky-400 block">{isRTL ? 'عذر' : 'Excused'}</span>
                <span className="text-xl font-black text-sky-800 dark:text-sky-200">{attendance.excused}</span>
              </div>
            </div>

          </CardContent>
        </Card>

        {/* Card 2: Academic Grades & Cumulative GPA */}
        <Card className="border-slate-200/80 dark:border-slate-800 shadow-md">
          <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800/80 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-sky-500" />
              {t('statistics.gpaTitle') || (isRTL ? 'المعدل التراكمي والدرجات' : 'Academic Grade Average & GPA')}
            </CardTitle>
            {academics.coursesCount > 0 ? (
              <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${gpaStanding.badgeClass}`}>
                {gpaStanding.label}
              </span>
            ) : (
              <Badge variant="secondary" className="text-xs font-medium">
                {isRTL ? 'قيد الاحتساب' : 'In Progress'}
              </Badge>
            )}
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            
            {/* GPA Gauge & High-level Metrics */}
            <div className="flex items-center gap-6 p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800">
              <div className="relative w-24 h-24 flex items-center justify-center shrink-0">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r={radius}
                    stroke="currentColor"
                    strokeWidth="8"
                    className="text-slate-200 dark:text-slate-800"
                    fill="transparent"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r={radius}
                    stroke={gpaStanding.stroke}
                    strokeWidth="8"
                    strokeDasharray={circumference}
                    strokeDashoffset={academics.coursesCount > 0 ? gpaProgressOffset : circumference}
                    strokeLinecap="round"
                    fill="transparent"
                    className="transition-all duration-1000 ease-out"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-2xl font-black text-slate-800 dark:text-white leading-none">
                    {academics.gpaString}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 mt-0.5">
                    {t('statistics.scaleMax') || '/ 4.00'}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-sm text-slate-800 dark:text-white">
                    {t('statistics.cumulativeGpa') || (isRTL ? 'المعدل التراكمي (GPA)' : 'Cumulative GPA')}
                  </h4>
                </div>
                <p className="text-xs text-slate-400">
                  {t('statistics.gpaDescription') || (isRTL ? 'المعدل التراكمي الموزون لكافة المقررات المحتسبة' : 'Weighted cumulative GPA across completed courses & unretaken failures')}
                </p>
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-2">
                  {isRTL 
                    ? `الساعات المكتسبة: ${academics.totalCreditsEarned} من إجمالي ${academics.totalCreditsAttempted} ساعة`
                    : `Credits Earned: ${academics.totalCreditsEarned} / ${academics.totalCreditsAttempted} hrs`}
                </p>
              </div>
            </div>

            {/* 3 Stat Breakdown Grid */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-sky-50/60 dark:bg-sky-950/20 rounded-xl border border-sky-100 dark:border-sky-900/40 text-center">
                <span className="text-xs font-bold text-sky-700 dark:text-sky-400 block">{t('statistics.earnedCredits') || (isRTL ? 'الساعات المكتسبة' : 'Earned Credits')}</span>
                <span className="text-xl font-black text-sky-800 dark:text-sky-200">{academics.totalCreditsEarned}</span>
              </div>
              <div className="p-3 bg-slate-100/70 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">{t('statistics.attemptedCredits') || (isRTL ? 'الساعات المسجلة' : 'Attempted')}</span>
                <span className="text-xl font-black text-slate-800 dark:text-slate-200">{academics.totalCreditsAttempted}</span>
              </div>
              <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/20 rounded-xl border border-emerald-100 dark:border-emerald-900/40 text-center">
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 block">{t('statistics.gradedCourses') || (isRTL ? 'المقررات المرصودة' : 'Graded')}</span>
                <span className="text-xl font-black text-emerald-800 dark:text-emerald-200">{academics.coursesCount}</span>
              </div>
            </div>

            {/* Course Grade Breakdown List / Table */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {t('statistics.courseBreakdown') || (isRTL ? 'تفاصيل درجات المقررات' : 'Course Grade Breakdown')}
              </h4>

              {academics.courses.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center space-y-1 bg-slate-50/50 dark:bg-slate-900/20">
                  <BookOpen className="w-8 h-8 text-slate-400 mx-auto mb-1" />
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    {t('statistics.noCoursesGraded') || (isRTL ? 'لا توجد مقررات مرصودة الدرجات حتى الآن' : 'No graded courses recorded yet')}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {t('statistics.noCoursesGradedDesc') || (isRTL ? 'ستظهر نتائج المقررات بمجرد رصد درجات الفصول الدراسية.' : 'Grades will appear here once semester final scores are finalized.')}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-60 overflow-y-auto pr-1">
                  {academics.courses.map((course: any) => (
                    <div key={course.courseId} className="py-2.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-xs text-slate-800 dark:text-white truncate">
                            [{course.courseCode}] {course.courseName}
                          </span>
                          {course.isRetake && (
                            <span 
                              className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-300"
                              title={course.supersededAttempts?.map((sa: any) => t('statistics.retakeTooltip', { year: sa.academicYear, sem: sa.semester })).join(' | ')}
                            >
                              {t('statistics.retakeBadge') || (isRTL ? 'إعادة مقرر' : 'Retake')}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {isRTL 
                            ? `السنة ${course.countedAcademicYear} الترم ${course.countedSemester} • ${course.credits} ساعات`
                            : `Year ${course.countedAcademicYear} Sem ${course.countedSemester} • ${course.credits} hrs`}
                          {course.isRetake && course.supersededAttempts?.length > 0 && (
                            <span className="text-purple-600 dark:text-purple-400 ml-1">
                              • ({isRTL ? 'محاولة سابقة ملغاة' : 'supersedes earlier attempt'})
                            </span>
                          )}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {course.finalGrade !== null && (
                          <span className="text-xs font-mono font-semibold text-slate-600 dark:text-slate-300">
                            {course.finalGrade}%
                          </span>
                        )}
                        {getLetterBadge(course.letterGrade, course.gradePoints)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </CardContent>
        </Card>

        {/* Card 3: Academic Excellence Distinction (PLACEHOLDER FOR SLICE 3) */}
        <Card className="border-slate-200/80 dark:border-slate-800 shadow-md relative overflow-hidden">
          <CardHeader className="pb-2 border-b border-slate-100 dark:border-slate-800/80 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-500" />
              {isRTL ? 'وسام التفوق الأكاديمي' : 'Academic Distinction Status'}
            </CardTitle>
            <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300 text-xs">
              {isRTL ? 'قريباً (Slice 3)' : 'Coming Soon'}
            </Badge>
          </CardHeader>
          <CardContent className="pt-6 flex flex-col items-center justify-center text-center space-y-3 min-h-[220px]">
            <div className="w-14 h-14 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-200 dark:border-amber-800">
              <Award className="w-7 h-7" />
            </div>
            <h3 className="font-bold text-slate-700 dark:text-slate-200 text-sm">
              {isRTL ? 'حالة التفوق ومرتبة الشرف' : 'Academic Excellence Status'}
            </h3>
            <p className="text-xs text-slate-400 max-w-sm">
              {isRTL 
                ? 'جاري اعتماد شرط ومعايير لوحة التفوق والأكاديميين المتميزين.' 
                : 'Distinction threshold logic will be activated upon confirming the official excellence formula.'}
            </p>
          </CardContent>
        </Card>

        {/* Card 4: Projects Performance (PLACEHOLDER FOR SLICE 4) */}
        <Card className="border-slate-200/80 dark:border-slate-800 shadow-md relative overflow-hidden">
          <CardHeader className="pb-2 border-b border-slate-100 dark:border-slate-800/80 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <FolderKanban className="w-5 h-5 text-indigo-500" />
              {isRTL ? 'أداء المشاريع والتكليفات' : 'Project Performance'}
            </CardTitle>
            <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300 text-xs">
              {isRTL ? 'قريباً (Slice 4)' : 'Coming Soon'}
            </Badge>
          </CardHeader>
          <CardContent className="pt-6 flex flex-col items-center justify-center text-center space-y-3 min-h-[220px]">
            <div className="w-14 h-14 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200 dark:border-indigo-800">
              <FolderKanban className="w-7 h-7" />
            </div>
            <h3 className="font-bold text-slate-700 dark:text-slate-200 text-sm">
              {isRTL ? 'تقييم التكليفات ومشاريع التخرج' : 'Project & Assignment Evaluations'}
            </h3>
            <p className="text-xs text-slate-400 max-w-sm">
              {isRTL 
                ? 'سيتم تجميع أداء تكليفات المواد والمشاريع فور تجهيز النماذج الخاصة بها.' 
                : 'Project performance aggregation will be available in Slice 4.'}
            </p>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
