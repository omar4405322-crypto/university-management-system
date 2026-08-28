// @ts-nocheck
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import transcriptService, { TranscriptData, CourseTranscriptItem, CompletedExamAdminItem } from '../../services/transcript.service';
import collegeService from '../../services/college.service';
import departmentService from '../../services/department.service';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/button';
import BulkActionToolbar from '../../components/ui/BulkActionToolbar';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';
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
  RotateCcw,
  RotateCw,
  LayoutGrid,
  List,
  MapPin,
  CheckSquare,
  Square,
  MinusSquare,
  Building2,
  X,
  Eye,
  Archive,
  AlertTriangle,
  ArrowUpDown,
  BookOpenCheck,
  Percent,
  CheckCircle
} from 'lucide-react';
import { getTypeBadgeConfig } from '../exams/examUtils';

const StudentRecord: React.FC = () => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const isStudent = user?.role === 'STUDENT';
  const isStaffOrAdmin = user?.role && ['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'].includes(user.role);

  // View Mode: 'CARD' | 'LIST'
  const [viewMode, setViewMode] = useState<'CARD' | 'LIST'>('CARD');

  // Loading & Data States
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<TranscriptData | null>(null);
  const [colleges, setColleges] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);

  // Filter States for Admin / Staff
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCollege, setSelectedCollege] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [submissionFilter, setSubmissionFilter] = useState('ALL');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Filter States for Students
  const [semesterFilter, setSemesterFilter] = useState('ALL');
  const [gradeStatusFilter, setGradeStatusFilter] = useState('ALL');
  const [assessmentTypeFilter, setAssessmentTypeFilter] = useState('ALL');

  // Multi-Selection State for Admins
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());

  // Expand states for Student View
  const [expandedCourses, setExpandedCourses] = useState<Record<number, boolean>>({});
  const [expandedExams, setExpandedExams] = useState<Record<number, boolean>>({});

  // 1. Fetch Metadata (Colleges & Departments)
  useEffect(() => {
    if (!isStaffOrAdmin) return;
    const fetchMetadata = async () => {
      try {
        const [collegesRes, deptsRes] = await Promise.all([
          collegeService.getColleges({ limit: 100 }).catch(() => ({ data: [] })),
          departmentService.getDepartments({ limit: 200 }).catch(() => ({ data: [] })),
        ]);

        if (collegesRes.success || collegesRes.data) {
          const arr = Array.isArray(collegesRes.data)
            ? collegesRes.data
            : collegesRes.data?.colleges || collegesRes.data?.data || [];
          setColleges(arr);
        }

        if (deptsRes.success || deptsRes.data) {
          const arr = Array.isArray(deptsRes.data)
            ? deptsRes.data
            : deptsRes.data?.departments || deptsRes.data?.data || [];
          setDepartments(arr);
        }
      } catch (_err) {
        // silent
      }
    };

    fetchMetadata();
  }, [isStaffOrAdmin]);

  // Cascading departments for selected college
  const filteredDepartments = useMemo(() => {
    if (!selectedCollege) return departments;
    const colId = parseInt(selectedCollege, 10);
    return departments.filter((d) => d.collegeId === colId);
  }, [departments, selectedCollege]);

  // 2. Fetch Transcript Data
  const fetchTranscript = useCallback(async () => {
    setLoading(true);
    try {
      const res = await transcriptService.getStudentTranscript(undefined);
      if (res.success && res.data) {
        setData(res.data);
      } else {
        showToast(t('transcript.fetchError', 'Error fetching record'), 'error');
      }
    } catch (_err) {
      showToast(t('transcript.fetchError', 'Error fetching record'), 'error');
    } finally {
      setLoading(false);
    }
  }, [t, showToast]);

  useEffect(() => {
    fetchTranscript();
  }, [fetchTranscript]);

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
      return <Badge variant="warning">{t('transcript.withdrawn', 'Withdrawn')}</Badge>;
    }
    if (status === 'FAILED') {
      return <Badge variant="danger">{t('transcript.failed', 'Failed')}</Badge>;
    }
    if (grade === null) {
      return <Badge variant="outline">{t('transcript.inProgress', 'In Progress')}</Badge>;
    }
    if (grade >= 90) return <Badge variant="success">A+ ({grade}%)</Badge>;
    if (grade >= 85) return <Badge variant="success">A ({grade}%)</Badge>;
    if (grade >= 75) return <Badge variant="info">B ({grade}%)</Badge>;
    if (grade >= 65) return <Badge variant="warning">C ({grade}%)</Badge>;
    if (grade >= 50) return <Badge variant="warning">D ({grade}%)</Badge>;
    return <Badge variant="danger">F ({grade}%)</Badge>;
  };

  // 3. Admin Filtered Completed Exams
  const filteredCompletedExams = useMemo(() => {
    if (!data?.completedExams) return [];
    let list = [...data.completedExams];

    // Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((e) => {
        const cName = (e.courseName || '').toLowerCase();
        const cCode = (e.courseCode || '').toLowerCase();
        const room = (e.room || '').toLowerCase();
        return cName.includes(q) || cCode.includes(q) || room.includes(q);
      });
    }

    // Exam Type
    if (typeFilter !== 'ALL') {
      list = list.filter((e) => e.type === typeFilter);
    }

    // Submissions filter
    if (submissionFilter === 'SUBMITTED') {
      list = list.filter((e) => e.submissionsCount > 0);
    } else if (submissionFilter === 'PENDING') {
      list = list.filter((e) => e.submissionsCount === 0);
    }

    // Sort Order
    list.sort((a, b) => {
      const dateA = new Date(`${a.date}T${a.startTime || '00:00'}`).getTime();
      const dateB = new Date(`${b.date}T${b.startTime || '00:00'}`).getTime();
      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });

    return list;
  }, [data?.completedExams, searchQuery, typeFilter, submissionFilter, sortOrder]);

  // Multi-Selection Logic
  const allFilteredIds = useMemo(() => filteredCompletedExams.map((e) => e.id), [filteredCompletedExams]);
  const isAllSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => selectedIds.has(id));
  const isSomeSelected = allFilteredIds.some((id) => selectedIds.has(id)) && !isAllSelected;

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        allFilteredIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        allFilteredIds.forEach((id) => next.add(id));
        return next;
      });
    }
  };

  const handleToggleSelect = (id: string | number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Reset Filters
  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedCollege('');
    setSelectedDept('');
    setSelectedYear('');
    setTypeFilter('ALL');
    setSubmissionFilter('ALL');
  };

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    selectedCollege !== '' ||
    selectedDept !== '' ||
    selectedYear !== '' ||
    typeFilter !== 'ALL' ||
    submissionFilter !== 'ALL';

  // Format Time
  const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? t('common.pm', 'PM') : t('common.am', 'AM');
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  // Type badge renderer
  const renderTypeBadge = (type: string) => {
    const c = getTypeBadgeConfig(type, t);
    return (
      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${c.bg} ${c.text}`}>
        {c.label}
      </span>
    );
  };

  // Student Filtered Semesters
  const filteredSemesters = useMemo(() => {
    if (!data?.semesters) return [];
    return data.semesters
      .map((sem) => {
        if (semesterFilter !== 'ALL' && sem.semester.toString() !== semesterFilter) {
          return null;
        }

        const filteredCourses = sem.courses.filter((cItem) => {
          if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            const matchName = cItem.course.name.toLowerCase().includes(q);
            const matchCode = cItem.course.courseCode.toLowerCase().includes(q);
            if (!matchName && !matchCode) return false;
          }

          if (gradeStatusFilter === 'PASSED' && (cItem.finalGrade === null || cItem.finalGrade < 50)) return false;
          if (gradeStatusFilter === 'FAILED' && (cItem.finalGrade === null || cItem.finalGrade >= 50)) return false;
          if (gradeStatusFilter === 'IN_PROGRESS' && cItem.finalGrade !== null) return false;

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

  return (
    <div className="section-gap animate-in fade-in duration-500 space-y-4 w-full min-w-0 pb-20">
      {/* 1. Sleek Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-800 dark:text-white flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-brand-primary-500/10 text-brand-primary-600 dark:text-brand-primary-400">
              <Archive size={22} />
            </span>
            {t('transcript.title', 'Exams Record & Archive')}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
            {t('transcript.subtitle', 'Permanent record for archived exams, student submissions, and performance statistics')}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* View Switcher for Staff / Admins */}
          {isStaffOrAdmin && (
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
              <button
                type="button"
                onClick={() => setViewMode('CARD')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'CARD'
                    ? 'bg-white dark:bg-slate-700 text-brand-primary-600 dark:text-brand-primary-300 shadow-xs'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                <LayoutGrid size={14} />
                <span>{t('exams.viewCardView', 'Cards')}</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('LIST')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'LIST'
                    ? 'bg-white dark:bg-slate-700 text-brand-primary-600 dark:text-brand-primary-300 shadow-xs'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                <List size={14} />
                <span>{t('exams.viewListView', 'List')}</span>
              </button>
            </div>
          )}

          {/* Refresh Button */}
          <button
            type="button"
            onClick={fetchTranscript}
            className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-xs transition-all border border-slate-200 dark:border-slate-700 active:scale-95 shadow-2xs"
            title={t('common.refresh', 'Refresh')}
          >
            <RotateCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>

          {/* Create Exam Button */}
          {isStaffOrAdmin && (
            <button
              type="button"
              onClick={() => navigate('/exams/create')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand-primary-500 hover:bg-brand-primary-600 text-white font-bold text-xs shadow-sm shadow-brand-primary-500/20 active:scale-95 transition-all"
            >
              <Plus size={15} />
              <span>{t('transcript.createExam', 'New Exam')}</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Admin / Staff View */}
      {data?.isAdminOverview || isStaffOrAdmin ? (
        <div className="space-y-4">
          {/* ========================================================================= */}
          {/* 1. EXECUTIVE 4-METRIC RIBBON                                              */}
          {/* ========================================================================= */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
            {/* Total Archived Exams */}
            <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 font-semibold block">
                  {t('transcript.completedExams', 'Archived Exams')}
                </span>
                <span className="text-lg font-black text-brand-primary-600 dark:text-brand-primary-400 block mt-0.5 font-mono">
                  {data?.totalCompletedExams || (data?.completedExams?.length ?? 0)}
                </span>
              </div>
              <div className="w-8 h-8 rounded-xl bg-brand-primary-50 dark:bg-brand-primary-950/50 text-brand-primary-600 flex items-center justify-center shrink-0">
                <Archive size={16} />
              </div>
            </div>

            {/* Total Student Submissions */}
            <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 font-semibold block">
                  {t('transcript.submissions', 'Student Submissions')}
                </span>
                <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 block mt-0.5 font-mono">
                  {data?.totalSubmissions || 0}
                </span>
              </div>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center shrink-0">
                <Users size={16} />
              </div>
            </div>

            {/* Average Score */}
            <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 font-semibold block">
                  {t('transcript.avgScore', 'Average Grade')}
                </span>
                <span className="text-lg font-black text-blue-600 dark:text-blue-400 block mt-0.5 font-mono">
                  {data?.averageScore || 0}%
                </span>
              </div>
              <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center shrink-0">
                <BarChart3 size={16} />
              </div>
            </div>

            {/* Evaluated Courses */}
            <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 font-semibold block">
                  {t('transcript.coursesCount', 'Evaluated Courses')}
                </span>
                <span className="text-lg font-black text-amber-600 dark:text-amber-400 block mt-0.5 font-mono">
                  {data?.totalCoursesWithExams || new Set((data?.completedExams || []).map((e: any) => e.courseCode || e.courseName)).size}
                </span>
              </div>
              <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center shrink-0">
                <BookOpenCheck size={16} />
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* 2. UNIFIED COMPACT FILTER TOOLBAR                                         */}
          {/* ========================================================================= */}
          <div className="p-2 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-700 shadow-2xs flex flex-wrap items-center gap-2 mb-4">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder={t('transcript.searchPlaceholder', 'Search course name, code, or title...')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-8.5 ps-8 pe-8 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-1.5 focus:ring-brand-primary-500 outline-none bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute end-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* College Dropdown */}
            <select
              value={selectedCollege}
              onChange={(e) => {
                setSelectedCollege(e.target.value);
                setSelectedDept('');
              }}
              className="h-8.5 px-3 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-brand-primary-500 cursor-pointer"
            >
              <option value="">{t('common.allColleges', 'All Colleges')}</option>
              {colleges.map((c) => (
                <option key={c.id} value={c.id}>
                  {isRTL ? c.nameAr || c.name : c.name}
                </option>
              ))}
            </select>

            {/* Department Dropdown */}
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="h-8.5 px-3 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-brand-primary-500 cursor-pointer"
            >
              <option value="">{t('common.allDepartments', 'All Departments')}</option>
              {filteredDepartments.map((d) => (
                <option key={d.id} value={d.id}>
                  {isRTL ? d.nameAr || d.name : d.name}
                </option>
              ))}
            </select>

            {/* Exam Type */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="h-8.5 px-3 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-brand-primary-500 cursor-pointer"
            >
              <option value="ALL">{t('transcript.filterAllTypes', 'All Types')}</option>
              <option value="MIDTERM">{t('transcript.filterMidterm', 'Midterm')}</option>
              <option value="FINAL">{t('transcript.filterFinal', 'Final')}</option>
              <option value="QUIZ">{t('transcript.filterQuiz', 'Quiz')}</option>
            </select>

            {/* Submissions Filter */}
            <select
              value={submissionFilter}
              onChange={(e) => setSubmissionFilter(e.target.value)}
              className="h-8.5 px-3 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-brand-primary-500 cursor-pointer"
            >
              <option value="ALL">{t('transcript.allSubmissions', 'All Submissions')}</option>
              <option value="SUBMITTED">{t('transcript.submittedOnly', 'Submitted')}</option>
              <option value="PENDING">{t('transcript.pendingGrading', 'Pending Grading')}</option>
            </select>

            {/* Sort Order */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
              className="h-8.5 px-2.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl font-bold cursor-pointer"
            >
              <ArrowUpDown size={13} className="me-1" />
              <span>{sortOrder === 'asc' ? t('exams.sortDateAsc', 'Oldest') : t('exams.sortDateDesc', 'Newest')}</span>
            </Button>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
                className="h-8.5 px-2.5 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl font-bold cursor-pointer"
              >
                <X size={13} className="me-1" />
                {isRTL ? 'مسح' : 'Clear'}
              </Button>
            )}
          </div>

          {/* Main Content: Cards Grid vs Table List */}
          {loading ? (
            <Card className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-12 flex flex-col items-center justify-center gap-3 text-center">
              <RotateCw className="animate-spin text-brand-primary-500" size={32} />
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                {t('common.loadingSchedule', 'Loading archived exam records...')}
              </p>
            </Card>
          ) : filteredCompletedExams.length === 0 ? (
            <Card className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-12 flex flex-col items-center justify-center text-center">
              <div className="w-14 h-14 rounded-full bg-brand-primary-500/10 text-brand-primary-500 flex items-center justify-center text-2xl mb-3">
                <Archive size={28} />
              </div>
              <h3 className="text-base font-bold text-slate-800 dark:text-white mb-1">
                {hasActiveFilters ? t('exams.noExams', 'No Exams Match Filter') : t('transcript.noCompletedExamsTitle', 'No Archived Exams Yet')}
              </h3>
              <p className="text-xs text-slate-400 font-medium max-w-sm mb-4">
                {hasActiveFilters
                  ? t('transcript.noFilteredExamsDesc', 'No archived exams match the selected filter criteria.')
                  : t('transcript.noCompletedExamsDesc', 'Completed exams with grades are automatically moved here for permanent archival.')}
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="px-4 py-1.5 bg-brand-primary-500 text-white font-bold rounded-xl text-xs shadow-xs flex items-center gap-1.5"
                >
                  <RotateCcw size={13} />
                  <span>{t('groups.resetFilters', 'Reset Filters')}</span>
                </button>
              )}
            </Card>
          ) : viewMode === 'CARD' ? (
            /* MODE A: RESPONSIVE CARDS GRID */
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {filteredCompletedExams.map((exam) => {
                  const isSelected = selectedIds.has(exam.id);

                  return (
                    <Card
                      key={exam.id}
                      className={`rounded-2xl border p-4 shadow-2xs hover:shadow-sm transition-all relative flex flex-col justify-between group ${
                        isSelected
                          ? 'border-brand-primary-500 ring-2 ring-brand-primary-500/20 bg-brand-primary-500/[0.02] dark:bg-brand-primary-500/[0.04]'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                      }`}
                    >
                      <div>
                        {/* Header */}
                        <div className="flex items-center justify-between gap-2 mb-2.5">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleToggleSelect(exam.id)}
                              className="text-slate-400 hover:text-brand-primary-600 focus:outline-none transition-colors"
                            >
                              {isSelected ? (
                                <CheckSquare size={16} className="text-brand-primary-600" />
                              ) : (
                                <Square size={16} />
                              )}
                            </button>
                            {renderTypeBadge(exam.type)}
                          </div>

                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                            <CheckCircle2 size={11} />
                            <span>{t('exams.statusCompleted', 'Completed')}</span>
                          </span>
                        </div>

                        {/* Exam Title & Course */}
                        <div className="mb-2.5">
                          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                            {exam.courseCode && (
                              <span className="px-2 py-0.5 rounded-md bg-brand-primary-500/10 text-brand-primary-700 dark:text-brand-primary-300 font-black text-[11px]">
                                {exam.courseCode}
                              </span>
                            )}
                            <h4 className="font-bold text-slate-900 dark:text-white text-xs md:text-sm leading-snug">
                              {exam.courseName}
                            </h4>
                          </div>
                        </div>

                        {/* Details */}
                        <div className="space-y-1.5 py-2 border-t border-slate-100 dark:border-slate-700/60 text-xs">
                          {/* Date & Time */}
                          <div className="flex items-center justify-between text-slate-700 dark:text-slate-300 font-semibold">
                            <div className="flex items-center gap-1.5">
                              <Calendar size={12} className="text-brand-primary-500 shrink-0" />
                              <span>{exam.date}</span>
                            </div>
                            <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 font-bold">
                              <Clock size={11} className="text-slate-400 shrink-0" />
                              <span>{formatTime(exam.startTime)} - {formatTime(exam.endTime)}</span>
                            </div>
                          </div>

                          {/* Hall */}
                          {exam.room && (
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-slate-400 font-medium">{t('transcript.hallRoom', 'Hall / Room:')}</span>
                              <span className="font-bold text-slate-700 dark:text-slate-300">{exam.room}</span>
                            </div>
                          )}

                          {/* Submissions & Questions */}
                          <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-700/40 text-[11px]">
                            <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold">
                              {exam.submissionsCount} {t('transcript.submissions', 'Submissions')}
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold">
                              {exam.questionsCount} {t('exams.questions', 'Questions')}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Actions Footer */}
                      <div className="pt-2.5 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => navigate(`/exams/${exam.id}`)}
                          className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-brand-primary-50 dark:bg-brand-primary-950/40 hover:bg-brand-primary-100 dark:hover:bg-brand-primary-900/40 text-brand-primary-700 dark:text-brand-primary-300 text-xs font-bold transition-colors"
                        >
                          <Eye size={13} />
                          <span>{t('transcript.examSubmissions', 'Submissions & Results')}</span>
                        </button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          ) : (
            /* MODE B: TABLE LIST */
            <Card className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden p-0">
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full border-collapse text-start">
                  <thead>
                    <tr className="bg-slate-50/80 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700 text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      <th className="p-3.5 text-center w-12">
                        <button
                          type="button"
                          onClick={handleToggleSelectAll}
                          className="text-slate-400 hover:text-brand-primary-600 focus:outline-none transition-colors"
                        >
                          {isAllSelected ? (
                            <CheckSquare size={16} className="text-brand-primary-600" />
                          ) : isSomeSelected ? (
                            <MinusSquare size={16} className="text-brand-primary-600" />
                          ) : (
                            <Square size={16} />
                          )}
                        </button>
                      </th>
                      <th className="p-3.5 text-start min-w-[220px]">{t('exams.examColumn', 'Exam & Course')}</th>
                      <th className="p-3.5 text-center w-28">{t('exams.typeColumn', 'Type')}</th>
                      <th className="p-3.5 text-start min-w-[150px]">{t('exams.dateTimeColumn', 'Date & Time')}</th>
                      <th className="p-3.5 text-center min-w-[110px]">{t('transcript.submissions', 'Submissions')}</th>
                      <th className="p-3.5 text-center w-28">{t('exams.actionsColumn', 'Actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 text-xs">
                    {filteredCompletedExams.map((exam) => {
                      const isSelected = selectedIds.has(exam.id);

                      return (
                        <tr
                          key={exam.id}
                          className={`group hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors ${
                            isSelected ? 'bg-brand-primary-500/[0.04] dark:bg-brand-primary-500/[0.08]' : ''
                          }`}
                        >
                          <td className="p-3.5 align-middle text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleSelect(exam.id)}
                              className="text-slate-400 hover:text-brand-primary-600 focus:outline-none transition-colors"
                            >
                              {isSelected ? (
                                <CheckSquare size={16} className="text-brand-primary-600" />
                              ) : (
                                <Square size={16} />
                              )}
                            </button>
                          </td>

                          <td className="p-3.5 align-middle">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {exam.courseCode && (
                                  <span className="px-2 py-0.5 rounded-md bg-brand-primary-500/10 text-brand-primary-700 dark:text-brand-primary-300 font-black text-[11px]">
                                    {exam.courseCode}
                                  </span>
                                )}
                                <span className="font-bold text-slate-900 dark:text-white text-xs">
                                  {exam.courseName}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="p-3.5 align-middle text-center whitespace-nowrap">
                            {renderTypeBadge(exam.type)}
                          </td>

                          <td className="p-3.5 align-middle whitespace-nowrap">
                            <div className="space-y-0.5">
                              <div className="font-bold text-slate-800 dark:text-white flex items-center gap-1">
                                <Calendar size={12} className="text-brand-primary-500 shrink-0" />
                                <span>{exam.date}</span>
                              </div>
                              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                <Clock size={11} className="text-slate-400 shrink-0" />
                                <span>{formatTime(exam.startTime)} - {formatTime(exam.endTime)}</span>
                              </div>
                            </div>
                          </td>

                          <td className="p-3.5 align-middle text-center whitespace-nowrap">
                            <span className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold text-xs">
                              {exam.submissionsCount} {t('transcript.submissions', 'Submissions')}
                            </span>
                          </td>

                          <td className="p-3.5 align-middle text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => navigate(`/exams/${exam.id}`)}
                              className="p-1.5 rounded-lg text-brand-primary-600 hover:bg-brand-primary-50 dark:hover:bg-brand-primary-950/40 transition-colors"
                              title={t('transcript.examSubmissions', 'Submissions & Results')}
                            >
                              <Eye size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Standard Floating Bottom Bulk Toolbar */}
          <BulkActionToolbar
            selectedCount={selectedIds.size}
            onClear={() => setSelectedIds(new Set())}
            onDelete={() => {
              showToast(t('common.exportSuccess', 'Batch exported records'), 'success');
              setSelectedIds(new Set());
            }}
          />
        </div>
      ) : (
        /* 3. Student Transcript View */
        <div className="space-y-4">
          {/* Student Overview Header Card */}
          <Card className="p-5 bg-gradient-to-r from-brand-primary-900 to-slate-900 text-white rounded-2xl shadow-sm border border-slate-800">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-sm">
                  <GraduationCap className="w-8 h-8 text-brand-primary-300" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">
                    {user?.name}
                  </h2>
                  <p className="text-xs text-slate-300 mt-0.5">
                    {user?.college?.name} - {user?.department?.name}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-center px-4 py-2 bg-white/10 rounded-xl backdrop-blur-sm">
                  <p className="text-[10px] uppercase font-bold text-slate-300">GPA</p>
                  <p className="text-xl font-black text-brand-primary-300">{data?.gpa || 'N/A'}</p>
                </div>
                <div className="text-center px-4 py-2 bg-white/10 rounded-xl backdrop-blur-sm">
                  <p className="text-[10px] uppercase font-bold text-slate-300">{t('transcript.credits', 'Credits')}</p>
                  <p className="text-xl font-black text-white">{data?.totalCreditHours || 0}</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Student Semesters Breakdown */}
          {filteredSemesters.map((sem, sIdx) => (
            <Card key={sIdx} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-2xs">
              <h3 className="font-bold text-sm text-slate-800 dark:text-white mb-3 flex items-center gap-2">
                <Award size={16} className="text-brand-primary-500" />
                <span>{t('transcript.semesterTitle', { year: sem.academicYear, sem: sem.semester })}</span>
              </h3>

              <div className="space-y-2">
                {sem.courses.map((cItem) => {
                  const isExpanded = !!expandedCourses[cItem.id];

                  return (
                    <div key={cItem.id} className="border border-slate-100 dark:border-slate-700/60 rounded-xl overflow-hidden">
                      <div
                        onClick={() => toggleCourseExpand(cItem.id)}
                        className="p-3 bg-slate-50/50 dark:bg-slate-900/40 hover:bg-slate-100/60 dark:hover:bg-slate-800/60 flex items-center justify-between cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <BookOpen size={14} className="text-brand-primary-500" />
                          <span className="font-bold text-xs text-slate-800 dark:text-white">{cItem.course.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">({cItem.course.courseCode})</span>
                        </div>

                        <div className="flex items-center gap-2">
                          {getGradeBadge(cItem.finalGrade, cItem.status)}
                          {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="p-3 border-t border-slate-100 dark:border-slate-700/60 bg-white dark:bg-slate-800 text-xs space-y-2">
                          {cItem.exams && cItem.exams.length > 0 && (
                            <div>
                              <p className="text-[11px] font-bold text-slate-400 uppercase mb-1">{t('exams.title', 'Exams')}:</p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {cItem.exams.map((ex) => (
                                  <div key={ex.id} className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/60 flex items-center justify-between">
                                    <span className="font-medium text-slate-700 dark:text-slate-300">{ex.title}</span>
                                    <span className="font-bold text-brand-primary-600">{ex.score != null ? `${ex.score}/${ex.maxScore}` : '-'}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default StudentRecord;
