import React, { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import transcriptService, { TranscriptData, CourseTranscriptItem } from '../../services/transcript.service';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/button';
import { useToast } from '../../context/ToastContext';
import {
  GraduationCap,
  Award,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  Calendar,
  Layers,
  HelpCircle,
  Plus,
  Users,
  BarChart3,
  Search,
  CheckCircle2,
  Filter,
  RotateCcw
} from 'lucide-react';
import { getTypeBadgeConfig } from '../exams/examUtils';

const FILTER_SELECT =
  'h-10 px-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-brand-text-primary dark:text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 transition-all cursor-pointer flex-shrink-0';

const StudentRecord: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<TranscriptData | null>(null);

  // Expand states
  const [expandedCourses, setExpandedCourses] = useState<Record<number, boolean>>({});
  const [expandedExams, setExpandedExams] = useState<Record<number, boolean>>({});

  // ── Tailored Filter States for Professors / Admins ───────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [courseFilter, setCourseFilter] = useState('ALL');
  const [submissionFilter, setSubmissionFilter] = useState('ALL');

  // ── Tailored Filter States for Students ──────────────────────────────
  const [semesterFilter, setSemesterFilter] = useState('ALL');
  const [gradeStatusFilter, setGradeStatusFilter] = useState('ALL');
  const [assessmentTypeFilter, setAssessmentTypeFilter] = useState('ALL');

  const isStudent = user?.role === 'STUDENT';
  const isStaffOrAdmin = user?.role && ['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'].includes(user.role);

  useEffect(() => {
    const fetchTranscript = async () => {
      setLoading(true);
      try {
        const res = await transcriptService.getStudentTranscript(undefined);
        if (res.success && res.data) {
          setData(res.data);
        } else {
          showToast(t('transcript.fetchError') || 'Error fetching record', 'error');
        }
      } catch (err) {
        showToast(t('transcript.fetchError') || 'Error fetching record', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchTranscript();
  }, [user, isStudent, t, showToast]);

  const toggleCourseExpand = (courseId: number) => {
    setExpandedCourses((prev) => ({
      ...prev,
      [courseId]: !prev[courseId],
    }));
  };

  const toggleExamExpand = (examId: number) => {
    setExpandedExams((prev) => ({
      ...prev,
      [examId]: !prev[examId],
    }));
  };

  const getGradeBadge = (grade: number | null, status: string) => {
    if (status === 'WITHDRAWN') {
      return <Badge variant="warning">{t('transcript.withdrawn') || 'منسحب'}</Badge>;
    }
    if (status === 'FAILED') {
      return <Badge variant="danger">{t('transcript.failed') || 'راسب'}</Badge>;
    }
    if (grade === null) {
      return <Badge variant="secondary">{t('transcript.inProgress') || 'قيد الدراسة'}</Badge>;
    }
    if (grade >= 90) return <Badge variant="success">A ({grade}%)</Badge>;
    if (grade >= 80) return <Badge variant="success">B ({grade}%)</Badge>;
    if (grade >= 70) return <Badge variant="info">C ({grade}%)</Badge>;
    if (grade >= 60) return <Badge variant="warning">D ({grade}%)</Badge>;
    return <Badge variant="danger">F ({grade}%)</Badge>;
  };

  const renderTypeBadge = (type: string) => {
    const c = getTypeBadgeConfig(type, t);
    return <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${c.bg} ${c.text}`}>{c.label}</span>;
  };

  // ── Unique Options for Staff Filter Dropdowns ────────────────────────
  const uniqueStaffCourses = useMemo(() => {
    if (!data?.completedExams) return [];
    const map = new Map<string, string>();
    data.completedExams.forEach((e) => {
      if (e.courseCode && e.courseName) {
        map.set(e.courseCode, `${e.courseCode} - ${e.courseName}`);
      }
    });
    return Array.from(map.entries()).map(([code, name]) => ({ code, name }));
  }, [data]);

  // ── Filtered Exams for Staff Overview ────────────────────────────────
  const filteredStaffExams = useMemo(() => {
    if (!data?.completedExams) return [];
    return data.completedExams.filter((ex) => {
      // Search term
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = ex.courseName.toLowerCase().includes(q);
        const matchesCode = ex.courseCode.toLowerCase().includes(q);
        const matchesRoom = (ex.room || '').toLowerCase().includes(q);
        if (!matchesName && !matchesCode && !matchesRoom) return false;
      }
      // Type Filter
      if (typeFilter !== 'ALL' && ex.type !== typeFilter) return false;
      // Course Filter
      if (courseFilter !== 'ALL' && ex.courseCode !== courseFilter) return false;
      // Submission Filter
      if (submissionFilter === 'HAS_SUBMISSIONS' && ex.submissionsCount === 0) return false;
      if (submissionFilter === 'NO_SUBMISSIONS' && ex.submissionsCount > 0) return false;

      return true;
    });
  }, [data, searchQuery, typeFilter, courseFilter, submissionFilter]);

  const hasStaffFiltersActive =
    searchQuery.trim() !== '' || typeFilter !== 'ALL' || courseFilter !== 'ALL' || submissionFilter !== 'ALL';

  const resetStaffFilters = () => {
    setSearchQuery('');
    setTypeFilter('ALL');
    setCourseFilter('ALL');
    setSubmissionFilter('ALL');
  };

  // ── Unique Options for Student Semesters ─────────────────────────────
  const uniqueStudentSemesters = useMemo(() => {
    if (!data?.semesters) return [];
    return data.semesters.map((s) => ({
      key: `${s.academicYear}-${s.semester}`,
      label: `${t('transcript.academicYear') || 'السنة'} ${s.academicYear} - ${t('transcript.semester') || 'الترم'} ${s.semester}`,
    }));
  }, [data, t]);

  // ── Filtered Semesters and Courses for Student View ──────────────────
  const filteredStudentSemesters = useMemo(() => {
    if (!data?.semesters) return [];
    return data.semesters
      .map((sem) => {
        // Semester Filter
        if (semesterFilter !== 'ALL' && `${sem.academicYear}-${sem.semester}` !== semesterFilter) {
          return null;
        }

        const filteredCourses = sem.courses.filter((cItem) => {
          // Search query
          if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            const mName = cItem.course.name.toLowerCase().includes(q);
            const mCode = cItem.course.courseCode.toLowerCase().includes(q);
            if (!mName && !mCode) return false;
          }

          // Grade status filter
          if (gradeStatusFilter !== 'ALL') {
            if (gradeStatusFilter === 'WITHDRAWN' && cItem.status !== 'WITHDRAWN') return false;
            if (gradeStatusFilter === 'FAILED' && cItem.status !== 'FAILED') return false;
            if (gradeStatusFilter === 'IN_PROGRESS' && cItem.finalGrade !== null) return false;
            if (gradeStatusFilter === 'PASSED' && (cItem.finalGrade === null || cItem.finalGrade < 60 || cItem.status === 'FAILED' || cItem.status === 'WITHDRAWN')) return false;
          }

          // Assessment type filter
          if (assessmentTypeFilter === 'EXAMS' && cItem.exams.length === 0) return false;
          if (assessmentTypeFilter === 'QUIZZES' && cItem.quizzes.length === 0) return false;
          if (assessmentTypeFilter === 'TASKS' && cItem.tasks.length === 0) return false;

          return true;
        });

        if (filteredCourses.length === 0) return null;
        return { ...sem, courses: filteredCourses };
      })
      .filter(Boolean) as typeof data.semesters;
  }, [data, semesterFilter, searchQuery, gradeStatusFilter, assessmentTypeFilter]);

  const hasStudentFiltersActive =
    searchQuery.trim() !== '' || semesterFilter !== 'ALL' || gradeStatusFilter !== 'ALL' || assessmentTypeFilter !== 'ALL';

  const resetStudentFilters = () => {
    setSearchQuery('');
    setSemesterFilter('ALL');
    setGradeStatusFilter('ALL');
    setAssessmentTypeFilter('ALL');
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6 animate-pulse">
        <div className="h-20 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
          <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
          <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
        </div>
        <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
      </div>
    );
  }

  return (
    <div className="section-gap animate-page max-w-7xl mx-auto">
      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <PageHeader
        title={t('transcript.title') || 'سجل الامتحانات'}
        subtitle={t('transcript.subtitle') || 'سجل دائم لجميع الامتحانات المنتهية والنتائج'}
        action={
          isStaffOrAdmin
            ? {
                label: t('transcript.createExam') || 'إضافة امتحان جديد',
                onClick: () => navigate('/exams/create'),
                icon: Plus,
                className:
                  '!bg-brand-primary-500 !text-white !rounded-xl font-bold hover:!bg-brand-primary-600 hover:!scale-[1.02] active:!scale-[0.98] transition-all duration-200 border-none shadow-sm',
              }
            : undefined
        }
      />

      {/* ── Admin / Staff Overview View ───────────────────────────────── */}
      {data?.isAdminOverview || isStaffOrAdmin ? (
        <div className="space-y-6">
          {/* KPI Summary Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 flex items-center gap-4 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
              <div className="rounded-2xl p-3 bg-brand-primary-500/10 text-brand-primary-600 flex-shrink-0">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-brand-text-secondary dark:text-slate-400 truncate">
                  {t('transcript.completedExams') || 'الامتحانات المنتهية'}
                </span>
                <span className="text-3xl font-black text-brand-text-primary dark:text-white mt-1">
                  {data?.totalCompletedExams || 0}
                </span>
                <span className="text-[11px] text-brand-text-muted mt-0.5">امتحان مؤرشف</span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 flex items-center gap-4 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
              <div className="rounded-2xl p-3 bg-emerald-500/10 text-emerald-600 flex-shrink-0">
                <Users className="w-7 h-7" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-brand-text-secondary dark:text-slate-400 truncate">
                  {t('transcript.submissions') || 'إجمالي التسليمات'}
                </span>
                <span className="text-3xl font-black text-brand-text-primary dark:text-white mt-1">
                  {data?.totalSubmissions || 0}
                </span>
                <span className="text-[11px] text-brand-text-muted mt-0.5">تسليم مؤكد</span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 flex items-center gap-4 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
              <div className="rounded-2xl p-3 bg-blue-500/10 text-blue-600 flex-shrink-0">
                <BarChart3 className="w-7 h-7" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-brand-text-secondary dark:text-slate-400 truncate">
                  {t('transcript.avgScore') || 'متوسط الدرجات العام'}
                </span>
                <span className="text-3xl font-black text-brand-text-primary dark:text-white mt-1">
                  {data?.averageScore || '0'}
                </span>
                <span className="text-[11px] text-brand-text-muted mt-0.5">درجة</span>
              </div>
            </div>
          </div>

          {/* Tailored Staff Filter Bar */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 flex flex-col md:flex-row items-stretch md:items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-brand-text-sub rtl:right-3 rtl:left-auto" />
              <input
                type="text"
                placeholder={t('transcript.searchPlaceholder') || 'ابحث باسم المقرر أو الكود...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 rtl:pr-9 rtl:pl-4 py-2 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-brand-text-primary dark:text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 transition-all"
              />
            </div>

            {/* Filter by Exam Type */}
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={FILTER_SELECT}>
              <option value="ALL">{t('transcript.filterAllTypes') || 'جميع أنواع الامتحانات'}</option>
              <option value="MIDTERM">{t('transcript.filterMidterm') || 'منتصف الفصل'}</option>
              <option value="FINAL">{t('transcript.filterFinal') || 'الامتحان النهائي'}</option>
              <option value="QUIZ">{t('transcript.filterQuiz') || 'اختبار قصير'}</option>
            </select>

            {/* Filter by Course */}
            <select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)} className={FILTER_SELECT}>
              <option value="ALL">{t('transcript.filterAllCourses') || 'جميع المقررات الدراسية'}</option>
              {uniqueStaffCourses.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>

            {/* Filter by Submission Status */}
            <select value={submissionFilter} onChange={(e) => setSubmissionFilter(e.target.value)} className={FILTER_SELECT}>
              <option value="ALL">{t('transcript.filterSubmissionsAll') || 'جميع التسليمات'}</option>
              <option value="HAS_SUBMISSIONS">{t('transcript.filterHasSubmissions') || 'توجد تسليمات للطلاب'}</option>
              <option value="NO_SUBMISSIONS">{t('transcript.filterNoSubmissions') || 'بدون تسليمات حالياً'}</option>
            </select>

            {/* Reset Filters */}
            {hasStaffFiltersActive && (
              <Button
                variant="outline"
                size="sm"
                onClick={resetStaffFilters}
                className="h-10 px-3 text-xs font-bold gap-1.5 rounded-xl border-slate-200 dark:border-slate-700 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 flex-shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{t('transcript.resetFilters') || 'إعادة تعيين'}</span>
              </Button>
            )}
          </div>

          {/* Completed Exams List */}
          {filteredStaffExams.length === 0 ? (
            <Card className="p-12 text-center border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl bg-white dark:bg-slate-800">
              <HelpCircle className="w-14 h-14 mx-auto text-slate-400 mb-3" />
              <h3 className="text-base font-bold text-brand-text-primary dark:text-white mb-1">
                {t('transcript.noDataTitle') || 'لا توجد امتحانات مطابقة للفلاتر'}
              </h3>
              <p className="text-xs text-brand-text-secondary dark:text-slate-400 max-w-md mx-auto">
                {hasStaffFiltersActive
                  ? 'جرب تغيير خيارات البحث أو الفلاتر المختارة لإظهار نتائج أخرى.'
                  : (t('transcript.noDataDesc') || 'بمجرد انتهاء موعد أي امتحان، يتم نقله تلقائياً إلى هذا السجل للأرشفة والحفظ الدائم.')}
              </p>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredStaffExams.map((ex) => {
                const isExpanded = !!expandedExams[ex.id];
                return (
                  <Card
                    key={ex.id}
                    className="p-5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl hover:border-brand-primary-500/40 transition-all shadow-sm"
                  >
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                      <div className="flex items-start space-x-4 space-x-reverse">
                        <div className="px-3 py-2 bg-slate-100 dark:bg-slate-700/60 rounded-xl border border-slate-200 dark:border-slate-600 text-center min-w-[70px]">
                          <span className="text-xs font-black text-brand-primary-600 dark:text-brand-primary-400 block uppercase">
                            {ex.courseCode}
                          </span>
                          <span className="text-[10px] text-brand-text-secondary font-medium">
                            {ex.questionsCount} أسئلة
                          </span>
                        </div>
                        <div>
                          <div className="flex items-center space-x-2 space-x-reverse">
                            <h4 className="text-base font-bold text-brand-text-primary dark:text-white">{ex.courseName}</h4>
                            {renderTypeBadge(ex.type)}
                          </div>
                          <div className="flex items-center space-x-4 space-x-reverse text-xs text-brand-text-secondary dark:text-slate-400 mt-1">
                            <span className="flex items-center space-x-1 space-x-reverse">
                              <Calendar className="w-3.5 h-3.5 text-brand-primary-500" />
                              <span>{new Date(ex.date).toLocaleDateString('ar-EG')}</span>
                            </span>
                            <span className="flex items-center space-x-1 space-x-reverse">
                              <Clock className="w-3.5 h-3.5 text-emerald-500" />
                              <span>{ex.startTime} - {ex.endTime}</span>
                            </span>
                            {ex.room && (
                              <span className="bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-2 py-0.5 rounded text-[10px] font-semibold">
                                {ex.room}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3 space-x-reverse w-full md:w-auto justify-between md:justify-end">
                        <div className="text-left text-xs">
                          <span className="block text-brand-text-secondary dark:text-slate-400">التسليمات</span>
                          <span className="font-extrabold text-brand-primary-600 dark:text-brand-primary-400 text-sm">
                            {ex.submissionsCount} طالب
                          </span>
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/exams/${ex.id}/submissions`)}
                          className="text-xs font-bold gap-1.5 rounded-xl border-slate-200 dark:border-slate-700 text-brand-text-primary dark:text-white hover:bg-slate-100 dark:hover:bg-slate-700"
                        >
                          <Users className="w-4 h-4" />
                          <span>{t('transcript.viewSubmissions') || 'عرض تسليمات الطلاب'}</span>
                        </Button>

                        {ex.submissions.length > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleExamExpand(ex.id)}
                            className="text-xs gap-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl"
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Submissions List Expandable */}
                    {isExpanded && ex.submissions.length > 0 && (
                      <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-700 space-y-2">
                        <h5 className="text-xs font-bold text-brand-text-secondary uppercase mb-2">تسليمات الطلاب لهذا الامتحان</h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {ex.submissions.map((sub) => (
                            <div key={sub.id} className="p-3 bg-slate-50 dark:bg-slate-700/40 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between text-xs">
                              <div>
                                <p className="font-bold text-brand-text-primary dark:text-white">{sub.studentName}</p>
                                <p className="text-[10px] text-brand-text-secondary">{sub.studentCode}</p>
                              </div>
                              <div className="text-left">
                                <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                                  {sub.score !== null ? `${sub.score} / ${sub.maxScore}` : 'قيد التصحيح'}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* ── Student Personal Record View ──────────────────────────────── */
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 flex items-center gap-4 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
              <div className="rounded-2xl p-3 bg-brand-primary-500/10 text-brand-primary-600 flex-shrink-0">
                <GraduationCap className="w-7 h-7" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-brand-text-secondary dark:text-slate-400 truncate">
                  {t('transcript.gpa') || 'المعدل التراكمي (GPA)'}
                </span>
                <span className="text-3xl font-black text-brand-text-primary dark:text-white mt-1">
                  {data?.gpa || '0.00'}
                </span>
                <span className="text-[11px] text-brand-text-muted mt-0.5">من 4.00</span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 flex items-center gap-4 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
              <div className="rounded-2xl p-3 bg-emerald-500/10 text-emerald-600 flex-shrink-0">
                <Award className="w-7 h-7" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-brand-text-secondary dark:text-slate-400 truncate">
                  {t('transcript.creditHours') || 'الساعات المكتسبة'}
                </span>
                <span className="text-3xl font-black text-brand-text-primary dark:text-white mt-1">
                  {data?.totalCreditHours || 0}
                </span>
                <span className="text-[11px] text-brand-text-muted mt-0.5">ساعة معتمدة</span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 flex items-center gap-4 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
              <div className="rounded-2xl p-3 bg-blue-500/10 text-blue-600 flex-shrink-0">
                <BookOpen className="w-7 h-7" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-brand-text-secondary dark:text-slate-400 truncate">
                  {t('transcript.totalCourses') || 'إجمالي المقررات'}
                </span>
                <span className="text-3xl font-black text-brand-text-primary dark:text-white mt-1">
                  {data?.totalEnrollments || 0}
                </span>
                <span className="text-[11px] text-brand-text-muted mt-0.5">مقرر دراسي</span>
              </div>
            </div>
          </div>

          {/* Tailored Student Filter Bar */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 flex flex-col md:flex-row items-stretch md:items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-brand-text-sub rtl:right-3 rtl:left-auto" />
              <input
                type="text"
                placeholder={t('transcript.searchPlaceholder') || 'ابحث باسم المقرر أو الكود...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 rtl:pr-9 rtl:pl-4 py-2 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-brand-text-primary dark:text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 transition-all"
              />
            </div>

            {/* Filter by Semester */}
            <select value={semesterFilter} onChange={(e) => setSemesterFilter(e.target.value)} className={FILTER_SELECT}>
              <option value="ALL">{t('transcript.filterAllSemesters') || 'جميع الفصول الدراسية'}</option>
              {uniqueStudentSemesters.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>

            {/* Filter by Academic Status */}
            <select value={gradeStatusFilter} onChange={(e) => setGradeStatusFilter(e.target.value)} className={FILTER_SELECT}>
              <option value="ALL">{t('transcript.filterAllStatuses') || 'جميع الحالات الأكاديمية'}</option>
              <option value="PASSED">{t('transcript.filterPassed') || 'ناجح'}</option>
              <option value="IN_PROGRESS">{t('transcript.filterInProgress') || 'قيد الدراسة'}</option>
              <option value="FAILED">{t('transcript.filterFailed') || 'راسب'}</option>
              <option value="WITHDRAWN">{t('transcript.filterWithdrawn') || 'منسحب'}</option>
            </select>

            {/* Filter by Assessment Type */}
            <select value={assessmentTypeFilter} onChange={(e) => setAssessmentTypeFilter(e.target.value)} className={FILTER_SELECT}>
              <option value="ALL">{t('transcript.filterAllAssessments') || 'جميع التقييمات'}</option>
              <option value="EXAMS">{t('transcript.filterExamsOnly') || 'الامتحانات الرئيسية فقط'}</option>
              <option value="QUIZZES">{t('transcript.filterQuizzesOnly') || 'الاختبارات القصيرة فقط'}</option>
              <option value="TASKS">{t('transcript.filterTasksOnly') || 'المهام والواجبات فقط'}</option>
            </select>

            {/* Reset Filters */}
            {hasStudentFiltersActive && (
              <Button
                variant="outline"
                size="sm"
                onClick={resetStudentFilters}
                className="h-10 px-3 text-xs font-bold gap-1.5 rounded-xl border-slate-200 dark:border-slate-700 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 flex-shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{t('transcript.resetFilters') || 'إعادة تعيين'}</span>
              </Button>
            )}
          </div>

          {filteredStudentSemesters.length === 0 ? (
            <Card className="p-12 text-center border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl bg-white dark:bg-slate-800">
              <HelpCircle className="w-14 h-14 mx-auto text-slate-400 mb-3" />
              <h3 className="text-base font-bold text-brand-text-primary dark:text-white mb-1">
                {t('transcript.noDataTitle') || 'لا توجد نتائج مطابقة للفلاتر المختارة'}
              </h3>
              <p className="text-xs text-brand-text-secondary dark:text-slate-400 max-w-md mx-auto">
                {hasStudentFiltersActive
                  ? 'جرب تغيير خيارات البحث أو اختيار فصل دراسي آخر.'
                  : (t('transcript.noDataDesc') || 'بمجرد انتهاء موعد أي امتحان، يتم نقله تلقائياً إلى هذا السجل للأرشفة والحفظ الدائم.')}
              </p>
            </Card>
          ) : (
            <div className="space-y-6">
              {filteredStudentSemesters.map((sem) => (
                <div key={`${sem.academicYear}-${sem.semester}`} className="space-y-4">
                  <div className="flex items-center space-x-3 space-x-reverse pb-2 border-b border-slate-200 dark:border-slate-700">
                    <Layers className="w-5 h-5 text-brand-primary-500" />
                    <h2 className="text-lg font-bold text-brand-text-primary dark:text-white">
                      {t('transcript.academicYear') || 'السنة الدراسية'} {sem.academicYear} - {t('transcript.semester') || 'الترم'} {sem.semester}
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    {sem.courses.map((item: CourseTranscriptItem) => {
                      const isExpanded = !!expandedCourses[item.id];
                      const hasSubmissions = item.exams.length > 0 || item.quizzes.length > 0 || item.tasks.length > 0;

                      return (
                        <Card
                          key={item.id}
                          className="p-5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-brand-primary-500/40 transition-all rounded-2xl shadow-sm"
                        >
                          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                            <div className="flex items-start space-x-4 space-x-reverse">
                              <div className="px-3 py-2 bg-slate-100 dark:bg-slate-700/60 rounded-xl border border-slate-200 dark:border-slate-600 text-center min-w-[70px]">
                                <span className="text-xs font-black text-brand-primary-600 dark:text-brand-primary-400 block uppercase">
                                  {item.course.courseCode}
                                </span>
                                <span className="text-[10px] text-brand-text-secondary font-medium">
                                  {item.course.credits} {t('transcript.hrs') || 'ساعات'}
                                </span>
                              </div>
                              <div>
                                <h4 className="text-base font-bold text-brand-text-primary dark:text-white">{item.course.name}</h4>
                                {item.course.department?.name && (
                                  <p className="text-xs text-brand-text-secondary dark:text-slate-400 mt-0.5">
                                    {item.course.department.name}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center space-x-4 space-x-reverse w-full md:w-auto justify-between md:justify-end">
                              <div className="text-left">
                                {getGradeBadge(item.finalGrade, item.status)}
                              </div>

                              {hasSubmissions && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => toggleCourseExpand(item.id)}
                                  className="text-xs gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl"
                                >
                                  <span>{isExpanded ? (t('transcript.hideDetails') || 'إخفاء التفاصيل') : (t('transcript.showDetails') || 'تفاصيل الامتحانات')}</span>
                                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </Button>
                              )}
                            </div>
                          </div>

                          {isExpanded && hasSubmissions && (
                            <div className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-700 grid grid-cols-1 lg:grid-cols-3 gap-6 bg-slate-50 dark:bg-slate-700/30 p-4 rounded-xl">
                              {(assessmentTypeFilter === 'ALL' || assessmentTypeFilter === 'EXAMS') && (
                                <div>
                                  <div className="flex items-center space-x-2 space-x-reverse text-xs font-bold text-brand-text-secondary uppercase mb-3">
                                    <Calendar className="w-4 h-4 text-brand-primary-500" />
                                    <span>{t('transcript.majorExams') || 'الامتحانات الرئيسية'}</span>
                                  </div>
                                  {item.exams.length === 0 ? (
                                    <p className="text-xs text-brand-text-secondary italic">{t('transcript.noExams') || 'لا توجد امتحانات منتهية'}</p>
                                  ) : (
                                    <div className="space-y-2">
                                      {item.exams.map((ex) => (
                                        <div key={ex.id} className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between text-xs">
                                          <div>
                                            <p className="font-bold text-brand-text-primary dark:text-white">{ex.title}</p>
                                            <p className="text-[10px] text-brand-text-secondary mt-0.5">
                                              {new Date(ex.date).toLocaleDateString('ar-EG')}
                                            </p>
                                          </div>
                                          <span className="font-extrabold text-brand-primary-600 dark:text-brand-primary-400">
                                            {ex.score !== null ? `${ex.score} / ${ex.maxScore}` : 'تم التسليم'}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}

                              {(assessmentTypeFilter === 'ALL' || assessmentTypeFilter === 'QUIZZES') && (
                                <div>
                                  <div className="flex items-center space-x-2 space-x-reverse text-xs font-bold text-brand-text-secondary uppercase mb-3">
                                    <Clock className="w-4 h-4 text-emerald-500" />
                                    <span>{t('transcript.quizzes') || 'الاختبارات القصيرة'}</span>
                                  </div>
                                  {item.quizzes.length === 0 ? (
                                    <p className="text-xs text-brand-text-secondary italic">{t('transcript.noQuizzes') || 'لا توجد اختبارات قصيرة'}</p>
                                  ) : (
                                    <div className="space-y-2">
                                      {item.quizzes.map((qz) => (
                                        <div key={qz.id} className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between text-xs">
                                          <div>
                                            <p className="font-bold text-brand-text-primary dark:text-white">{qz.title}</p>
                                            <p className="text-[10px] text-brand-text-secondary mt-0.5">
                                              {new Date(qz.submittedAt).toLocaleDateString('ar-EG')}
                                            </p>
                                          </div>
                                          <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                                            {qz.score !== null ? `${qz.score} درجات` : 'تم التسليم'}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}

                              {(assessmentTypeFilter === 'ALL' || assessmentTypeFilter === 'TASKS') && (
                                <div>
                                  <div className="flex items-center space-x-2 space-x-reverse text-xs font-bold text-brand-text-secondary uppercase mb-3">
                                    <FileText className="w-4 h-4 text-blue-500" />
                                    <span>{t('transcript.tasks') || 'المهام والواجبات'}</span>
                                  </div>
                                  {item.tasks.length === 0 ? (
                                    <p className="text-xs text-brand-text-secondary italic">{t('transcript.noTasks') || 'لا توجد واجبات مسجلة'}</p>
                                  ) : (
                                    <div className="space-y-2">
                                      {item.tasks.map((tk) => (
                                        <div key={tk.id} className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between text-xs">
                                          <div>
                                            <p className="font-bold text-brand-text-primary dark:text-white">{tk.title}</p>
                                            <p className="text-[10px] text-brand-text-secondary mt-0.5">
                                              {new Date(tk.submittedAt).toLocaleDateString('ar-EG')}
                                            </p>
                                          </div>
                                          <span className="font-extrabold text-blue-600 dark:text-blue-400">
                                            {tk.score !== null ? `${tk.score} / ${tk.maxScore}` : 'تم التسليم'}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </Card>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StudentRecord;
