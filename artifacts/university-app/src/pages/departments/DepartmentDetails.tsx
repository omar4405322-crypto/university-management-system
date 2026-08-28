// @ts-nocheck
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  Loader2,
  AlertCircle,
  Users,
  GraduationCap,
  BookOpen,
  Search,
  ExternalLink,
  Settings,
} from 'lucide-react';
import Button from '../../components/ui/button';
import Table, {
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../../components/ui/Table';
import departmentService from '../../services/department.service';
import collegeService from '../../services/college.service';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import Breadcrumbs from '../../components/ui/Breadcrumbs';
import EditDepartmentModal from './EditDepartmentModal';
import { logger } from '../../lib/logger';
import { useToast } from '../../context/ToastContext';

interface DepartmentDetailsProps {
  departmentId?: string;
  isDrawerMode?: boolean;
}

type TabType = 'courses' | 'faculty' | 'students';

const DepartmentDetails: React.FC<DepartmentDetailsProps> = ({
  departmentId,
  isDrawerMode = false,
}) => {
  const { id } = useParams();
  const actualId = departmentId || id;
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [department, setDepartment] = useState<any>(null);
  const [colleges, setColleges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('courses');
  const [selectedYearFilter, setSelectedYearFilter] = useState<number | 'ALL'>('ALL');
  const [studentSearch, setStudentSearch] = useState('');
  const [facultySearch, setFacultySearch] = useState('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const canManage = ['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN'].includes(user?.role);

  useEffect(() => {
    if (actualId) {
      fetchDepartment();
    }
    if (canManage) {
      fetchColleges();
    }
  }, [actualId]);

  const fetchDepartment = async () => {
    try {
      setLoading(true);
      const result = await departmentService.getDepartmentById(actualId!);
      if (result.success) {
        setDepartment(result.data);
      } else {
        setDepartment(null);
      }
    } catch (error: any) {
      logger.error('Error fetching department:', error);
      setDepartment(null);
      showToast(t('common.errorFetching', 'Error loading department data'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchColleges = async () => {
    try {
      const res = await collegeService.getColleges();
      if (res.success && res.data) {
        setColleges(Array.isArray(res.data) ? res.data : res.data.colleges || []);
      }
    } catch (err) {
      logger.error('Error fetching colleges:', err);
    }
  };

  const students = useMemo(() => department?.students || [], [department]);
  const courses = useMemo(() => department?.courses || [], [department]);
  const doctors = useMemo(() => department?.doctors || [], [department]);

  // Total Credits Calculation
  const totalCredits = useMemo(() => {
    return courses.reduce((acc: number, c: any) => acc + (Number(c.credits) || 0), 0);
  }, [courses]);

  // Unique Years in Courses
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    courses.forEach((c: any) => {
      if (c.year) years.add(Number(c.year));
    });
    return Array.from(years).sort((a, b) => a - b);
  }, [courses]);

  // Filtered Students
  const filteredStudents = useMemo(() => {
    if (!studentSearch.trim()) return students;
    const query = studentSearch.toLowerCase().trim();
    return students.filter((s: any) => {
      const fullName = `${s.firstName || ''} ${s.lastName || ''}`.toLowerCase();
      const code = (s.studentId || '').toLowerCase();
      return fullName.includes(query) || code.includes(query);
    });
  }, [students, studentSearch]);

  // Filtered Faculty
  const filteredDoctors = useMemo(() => {
    if (!facultySearch.trim()) return doctors;
    const query = facultySearch.toLowerCase().trim();
    return doctors.filter((d: any) => {
      const fullName = `${d.firstName || ''} ${d.lastName || ''}`.toLowerCase();
      const code = (d.doctorId || '').toLowerCase();
      const specialty = (d.specialty || '').toLowerCase();
      return fullName.includes(query) || code.includes(query) || specialty.includes(query);
    });
  }, [doctors, facultySearch]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <Loader2 className="animate-spin text-brand-primary-500" size={36} />
        <p className="text-sm font-medium text-brand-text-sub">
          {t('common.loading', 'Loading...')}
        </p>
      </div>
    );
  }

  if (!department) {
    return (
      <div className="text-center py-16 bg-brand-bg-card rounded-2xl border border-brand-border/50 max-w-2xl mx-auto my-8">
        <AlertCircle size={36} className="text-brand-text-muted mx-auto mb-3" />
        <h2 className="text-lg font-bold text-brand-text-main">
          {t('departments.notFound', 'Department not found')}
        </h2>
        {!isDrawerMode && (
          <Button
            variant="outline"
            className="mt-5 border-brand-border"
            onClick={() => navigate('/departments')}
          >
            <ArrowLeft size={16} className="rtl:-scale-x-100 mr-2" />
            {t('common.back', 'Back')}
          </Button>
        )}
      </div>
    );
  }

  const breadcrumbItems = [
    { label: t('nav.colleges', 'Colleges'), link: '/colleges' },
    ...(department.college?.id
      ? [
          {
            label: isRTL
              ? department.college.nameAr || department.college.name
              : department.college.name,
            link: `/colleges/${department.college.id}`,
          },
        ]
      : []),
    { label: isRTL ? department.nameAr || department.name : department.name },
  ];

  // Helper for Year Translation
  const getYearLabel = (yr: number) => {
    if (isRTL) {
      const yearNames: Record<number, string> = {
        1: 'الفرقة الأولى',
        2: 'الفرقة الثانية',
        3: 'الفرقة الثالثة',
        4: 'الفرقة الرابعة',
        5: 'الفرقة الخامسة',
      };
      return yearNames[yr] || `الفرقة ${yr}`;
    }
    return `Year ${yr}`;
  };

  // Harmonious Color Schemes for Academic Years
  const getYearBadgeStyle = (yr: number) => {
    const num = Number(yr) || 1;
    switch (num) {
      case 1:
        return 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60';
      case 2:
        return 'bg-blue-50 text-blue-700 border-blue-200/80 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60';
      case 3:
        return 'bg-purple-50 text-purple-700 border-purple-200/80 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/60';
      case 4:
        return 'bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60';
      case 5:
        return 'bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60';
      default:
        return 'bg-teal-50 text-teal-700 border-teal-200/80 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800/60';
    }
  };

  // Harmonious Header Icon Styles for Year Blocks
  const getYearIconStyle = (yr: number) => {
    const num = Number(yr) || 1;
    switch (num) {
      case 1:
        return 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400';
      case 2:
        return 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400';
      case 3:
        return 'bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400';
      case 4:
        return 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400';
      case 5:
        return 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400';
      default:
        return 'bg-teal-50 text-teal-600 border-teal-200 dark:bg-teal-950/40 dark:text-teal-400';
    }
  };

  const getSemesterLabel = (sem: number) => {
    if (isRTL) {
      return sem === 2 ? 'الفصل الدراسي الثاني' : 'الفصل الدراسي الأول';
    }
    return `Semester ${sem || 1}`;
  };

  const getSemesterBadgeStyle = (sem: number) => {
    return sem === 2
      ? 'bg-indigo-50 text-indigo-700 border-indigo-200/80 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800/60'
      : 'bg-sky-50 text-sky-700 border-sky-200/80 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800/60';
  };

  return (
    <div className={isDrawerMode ? 'animate-in fade-in duration-300' : 'animate-in fade-in duration-300 max-w-7xl mx-auto space-y-6 pt-2 pb-10'}>
      {/* Top Header Card */}
      <div className="bg-brand-bg-card rounded-2xl border border-brand-border/40 p-6 shadow-sm">
        {!isDrawerMode && (
          <div className="mb-4">
            <Breadcrumbs items={breadcrumbItems} />
          </div>
        )}

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            {!isDrawerMode && (
              <button
                type="button"
                onClick={() => navigate('/departments')}
                className="p-2.5 rounded-xl border border-brand-border/60 hover:bg-brand-bg-page text-brand-text-sub hover:text-brand-text-main transition-colors mt-0.5"
                title={t('common.back', 'Back')}
              >
                <ArrowLeft size={18} className="rtl:-scale-x-100" />
              </button>
            )}

            <div>
              <div className="flex items-center gap-2 mb-1.5">
                {department.college && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-md bg-brand-primary-50 text-brand-primary-700 dark:bg-brand-primary-950/40 dark:text-brand-primary-300 border border-brand-primary-200/60">
                    <Building2 size={13} />
                    {isRTL ? department.college.nameAr || department.college.name : department.college.name}
                  </span>
                )}
                <span className="text-xs font-medium px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700">
                  {t('departments.activeStatus', 'Active Department')}
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-bold text-brand-text-main leading-tight mb-1">
                {isRTL ? department.nameAr || department.name : department.name}
              </h1>

              {department.nameAr && !isRTL && (
                <p className="text-sm text-brand-text-sub font-arabic" dir="rtl">
                  {department.nameAr}
                </p>
              )}
              {department.name && isRTL && (
                <p className="text-xs text-brand-text-muted font-sans" dir="ltr">
                  {department.name}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 self-start md:self-center">
            {canManage && (
              <Button
                variant="outline"
                className="h-10 px-3.5 border-brand-border text-xs font-bold flex items-center gap-2 rounded-xl text-brand-text-main hover:bg-brand-bg-page"
                onClick={() => setIsEditModalOpen(true)}
              >
                <Settings size={15} />
                <span>{t('departments.editDept', 'Edit Department')}</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Interactive Animated Metric Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* 1. Courses Metric Card */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setActiveTab('courses')}
          onKeyDown={(e) => e.key === 'Enter' && setActiveTab('courses')}
          className={`bg-brand-bg-card border p-5 rounded-2xl flex flex-col gap-2 shadow-sm group hover:-translate-y-1 hover:border-brand-primary-500/40 hover:shadow-[0_8px_30px_rgba(132,189,58,0.15)] transition-all duration-300 cursor-pointer ${
            activeTab === 'courses' ? 'border-brand-primary-500/50 ring-1 ring-brand-primary-500/20' : 'border-brand-border/40'
          }`}
          title={isRTL ? 'عرض المقررات الدراسية' : 'View Curriculum Courses'}
        >
          <div className="h-12 w-12 rounded-2xl bg-brand-primary-500/10 text-brand-primary-600 group-hover:bg-brand-primary-500 group-hover:text-white flex items-center justify-center shadow-[0_0_15px_rgba(132,189,58,0.2)] group-hover:shadow-[0_0_25px_rgba(132,189,58,0.5)] scale-100 group-hover:scale-110 transition-all duration-300">
            <BookOpen size={22} />
          </div>
          <div className="mt-2 text-start">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-brand-text-muted uppercase tracking-wider">
                {t('nav.courses', 'Courses')}
              </p>
              <ExternalLink size={12} className="text-brand-primary-600 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <h3 className="text-2xl font-black text-brand-text-main">
                {courses.length}
              </h3>
              <span className="text-xs text-brand-text-muted font-medium">
                ({totalCredits} {t('courses.credits_short', 'Credits')})
              </span>
            </div>
          </div>
        </div>

        {/* 2. Faculty Metric Card */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setActiveTab('faculty')}
          onKeyDown={(e) => e.key === 'Enter' && setActiveTab('faculty')}
          className={`bg-brand-bg-card border p-5 rounded-2xl flex flex-col gap-2 shadow-sm group hover:-translate-y-1 hover:border-indigo-500/40 hover:shadow-[0_8px_30px_rgba(99,102,241,0.15)] transition-all duration-300 cursor-pointer ${
            activeTab === 'faculty' ? 'border-indigo-500/50 ring-1 ring-indigo-500/20' : 'border-brand-border/40'
          }`}
          title={isRTL ? 'عرض أعضاء هيئة التدريس' : 'View Faculty Members'}
        >
          <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 text-indigo-600 group-hover:bg-indigo-500 group-hover:text-white flex items-center justify-center shadow-[0_0_15px_rgba(99,102,241,0.2)] group-hover:shadow-[0_0_25px_rgba(99,102,241,0.5)] scale-100 group-hover:scale-110 transition-all duration-300">
            <Users size={22} />
          </div>
          <div className="mt-2 text-start">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-brand-text-muted uppercase tracking-wider">
                {t('departments.assignedProfessors', 'Assigned professors')}
              </p>
              <ExternalLink size={12} className="text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <h3 className="text-2xl font-black text-brand-text-main">
                {doctors.length}
              </h3>
              <span className="text-xs text-brand-text-muted font-medium">
                {t('departments.professorsCount', 'Faculty Members')}
              </span>
            </div>
          </div>
        </div>

        {/* 3. Students Metric Card */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setActiveTab('students')}
          onKeyDown={(e) => e.key === 'Enter' && setActiveTab('students')}
          className={`bg-brand-bg-card border p-5 rounded-2xl flex flex-col gap-2 shadow-sm group hover:-translate-y-1 hover:border-blue-500/40 hover:shadow-[0_8px_30px_rgba(59,130,246,0.15)] transition-all duration-300 cursor-pointer ${
            activeTab === 'students' ? 'border-blue-500/50 ring-1 ring-blue-500/20' : 'border-brand-border/40'
          }`}
          title={isRTL ? 'عرض الطلاب المقيدين' : 'View Enrolled Students'}
        >
          <div className="h-12 w-12 rounded-2xl bg-blue-500/10 text-blue-600 group-hover:bg-blue-500 group-hover:text-white flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.2)] group-hover:shadow-[0_0_25px_rgba(59,130,246,0.5)] scale-100 group-hover:scale-110 transition-all duration-300">
            <GraduationCap size={22} />
          </div>
          <div className="mt-2 text-start">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-brand-text-muted uppercase tracking-wider">
                {t('nav.students', 'Students')}
              </p>
              <ExternalLink size={12} className="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <h3 className="text-2xl font-black text-brand-text-main">
                {students.length}
              </h3>
              <span className="text-xs text-brand-text-muted font-medium">
                {t('departments.enrolledStudents', 'Enrolled Students')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-brand-border/60 pb-3">
        <button
          onClick={() => setActiveTab('courses')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 ${
            activeTab === 'courses'
              ? 'bg-brand-primary-500 text-white shadow-sm'
              : 'text-brand-text-sub hover:text-brand-text-main hover:bg-brand-bg-card'
          }`}
        >
          <BookOpen size={15} />
          <span>{t('departments.studyPlan', 'Department Study Plan')}</span>
          <span
            className={`px-2 py-0.2 rounded-full text-[11px] font-mono ${
              activeTab === 'courses' ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-brand-text-sub'
            }`}
          >
            {courses.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('faculty')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 ${
            activeTab === 'faculty'
              ? 'bg-brand-primary-500 text-white shadow-sm'
              : 'text-brand-text-sub hover:text-brand-text-main hover:bg-brand-bg-card'
          }`}
        >
          <Users size={15} />
          <span>{t('departments.faculty', 'Department Faculty')}</span>
          <span
            className={`px-2 py-0.2 rounded-full text-[11px] font-mono ${
              activeTab === 'faculty' ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-brand-text-sub'
            }`}
          >
            {doctors.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('students')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 ${
            activeTab === 'students'
              ? 'bg-brand-primary-500 text-white shadow-sm'
              : 'text-brand-text-sub hover:text-brand-text-main hover:bg-brand-bg-card'
          }`}
        >
          <GraduationCap size={15} />
          <span>{t('nav.students', 'Students')}</span>
          <span
            className={`px-2 py-0.2 rounded-full text-[11px] font-mono ${
              activeTab === 'students' ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-brand-text-sub'
            }`}
          >
            {students.length}
          </span>
        </button>
      </div>

      {/* TAB CONTENT 1: COURSES & CURRICULUM */}
      {activeTab === 'courses' && (
        <div className="space-y-6">
          {/* Year Filter Controls if multiple years exist */}
          {availableYears.length > 1 && (
            <div className="flex items-center gap-2 flex-wrap bg-brand-bg-card p-2 rounded-xl border border-brand-border/40 w-fit">
              <button
                onClick={() => setSelectedYearFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  selectedYearFilter === 'ALL'
                    ? 'bg-slate-100 dark:bg-slate-800 text-brand-text-main shadow-xs'
                    : 'text-brand-text-muted hover:text-brand-text-sub'
                }`}
              >
                {t('common.allYears', 'All Years')}
              </button>
              {availableYears.map((yr) => (
                <button
                  key={yr}
                  onClick={() => setSelectedYearFilter(yr)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border ${
                    selectedYearFilter === yr
                      ? getYearBadgeStyle(yr)
                      : 'border-transparent text-brand-text-muted hover:text-brand-text-sub'
                  }`}
                >
                  {getYearLabel(yr)}
                </button>
              ))}
            </div>
          )}

          {courses.length === 0 ? (
            <div className="bg-brand-bg-card rounded-2xl border border-brand-border/40 p-12 text-center">
              <BookOpen size={36} className="text-brand-text-muted mx-auto mb-3" />
              <h3 className="text-base font-bold text-brand-text-main mb-1">
                {t('departments.noCourses', 'No courses in this department.')}
              </h3>
              <p className="text-xs text-brand-text-sub max-w-sm mx-auto">
                {t('departments.noCoursesDesc', 'No courses registered in this department yet.')}
              </p>
            </div>
          ) : (
            (selectedYearFilter === 'ALL' ? availableYears : [selectedYearFilter]).map((yr) => {
              const yearCourses = courses.filter((c: any) => (Number(c.year) || 1) === yr);
              if (yearCourses.length === 0) return null;

              const yearCredits = yearCourses.reduce((sum: number, c: any) => sum + (Number(c.credits) || 0), 0);

              return (
                <div key={yr} className="bg-brand-bg-card rounded-2xl border border-brand-border/40 shadow-sm overflow-hidden">
                  {/* Year Header Bar */}
                  <div className="px-6 py-4 bg-brand-bg-page/40 border-b border-brand-border/40 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-xl border flex items-center justify-center font-black text-sm shadow-xs ${getYearIconStyle(yr)}`}>
                        {yr}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-brand-text-main leading-none">
                            {getYearLabel(yr)}
                          </h3>
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${getYearBadgeStyle(yr)}`}>
                            {yearCourses.length} {t('departments.coursesCount', 'Total Courses')}
                          </span>
                        </div>
                        <p className="text-xs text-brand-text-muted mt-1">
                          {yearCredits} {t('courses.credits_short', 'Credits')}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Courses Table */}
                  <Table className="w-full">
                    <TableHeader>
                      <TableRow className="hover:bg-transparent border-b border-brand-border/40">
                        <TableHead className="text-start text-xs font-bold text-brand-text-muted py-3 px-6 w-36">
                          {t('courses.code', 'Course Code')}
                        </TableHead>
                        <TableHead className="text-start text-xs font-bold text-brand-text-muted py-3 px-6">
                          {t('courses.name', 'Course Name')}
                        </TableHead>
                        <TableHead className="text-center text-xs font-bold text-brand-text-muted py-3 px-6 w-48">
                          {t('schedule.semester', 'schedule.semester')}
                        </TableHead>
                        <TableHead className="text-center text-xs font-bold text-brand-text-muted py-3 px-6 w-32">
                          {t('courses.credits', 'Credits')}
                        </TableHead>
                        <TableHead className="text-end text-xs font-bold text-brand-text-muted py-3 px-6 w-20">
                          {t('common.actions', 'View')}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {yearCourses.map((course: any) => (
                        <TableRow
                          key={course.id}
                          className="cursor-pointer hover:bg-brand-bg-page/60 transition-colors border-b border-brand-border/30 last:border-0"
                          onClick={() => navigate(`/courses/${course.id}`)}
                        >
                          <TableCell className="py-3.5 px-6">
                            <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-brand-primary-50 text-brand-primary-700 dark:bg-brand-primary-950/40 dark:text-brand-primary-300 border border-brand-primary-200/60 dark:border-brand-primary-800/50">
                              {course.courseCode}
                            </span>
                          </TableCell>
                          <TableCell className="py-3.5 px-6">
                            <span className="font-semibold text-sm text-brand-text-main hover:text-brand-primary-600 transition-colors">
                              {course.name}
                            </span>
                          </TableCell>
                          <TableCell className="py-3.5 px-6 text-center">
                            <span className={`inline-flex items-center text-xs font-semibold px-3 py-1 rounded-full border shadow-2xs ${getSemesterBadgeStyle(course.semester)}`}>
                              {getSemesterLabel(course.semester)}
                            </span>
                          </TableCell>
                          <TableCell className="py-3.5 px-6 text-center">
                            <span className="text-xs font-mono font-bold text-brand-text-main bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                              {course.credits} {t('courses.credits_unit', 'Credit Hours')}
                            </span>
                          </TableCell>
                          <TableCell className="py-3.5 px-6 text-end" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => navigate(`/courses/${course.id}`)}
                              className="p-2 text-brand-text-muted hover:text-brand-primary-600 hover:bg-brand-primary-50 dark:hover:bg-brand-primary-950/40 rounded-xl transition-all"
                              title={t('courses.viewCourse', 'View Course')}
                            >
                              <ExternalLink size={16} />
                            </button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB CONTENT 2: FACULTY MEMBERS */}
      {activeTab === 'faculty' && (
        <div className="bg-brand-bg-card rounded-2xl border border-brand-border/40 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-brand-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-brand-text-main">
                {t('departments.assignedProfessors', 'Assigned professors')}
              </h3>
              <p className="text-xs text-brand-text-muted mt-0.5">
                {doctors.length} {t('departments.professorsCount', 'Faculty Members')}
              </p>
            </div>

            {doctors.length > 3 && (
              <div className="relative w-full sm:w-64">
                <Search size={15} className="absolute inset-y-0 start-3 my-auto text-brand-text-muted pointer-events-none" />
                <input
                  type="text"
                  placeholder={t('common.search', 'Search')}
                  value={facultySearch}
                  onChange={(e) => setFacultySearch(e.target.value)}
                  className="w-full h-9 ps-9 pe-3 bg-brand-bg-page/50 border border-brand-border rounded-xl text-xs text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20"
                />
              </div>
            )}
          </div>

          {filteredDoctors.length === 0 ? (
            <div className="p-12 text-center text-brand-text-muted">
              <Users size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm font-medium">
                {facultySearch
                  ? t('common.noSearchResults', 'No matching results found')
                  : t('departments.noDoctors', 'No professors assigned.')}
              </p>
            </div>
          ) : (
            <Table className="w-full">
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b border-brand-border/40">
                  <TableHead className="text-start text-xs font-bold text-brand-text-muted py-3 px-6 w-36">
                    {t('doctors.doctorId', 'Doctor ID')}
                  </TableHead>
                  <TableHead className="text-start text-xs font-bold text-brand-text-muted py-3 px-6">
                    {t('doctors.name', 'Name')}
                  </TableHead>
                  <TableHead className="text-start text-xs font-bold text-brand-text-muted py-3 px-6">
                    {t('doctors.specialty', 'Specialty')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDoctors.map((d: any) => (
                  <TableRow key={d.id} className="hover:bg-brand-bg-page/60 transition-colors border-b border-brand-border/30 last:border-0">
                    <TableCell className="py-3.5 px-6">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200/60">
                        {d.doctorId || '—'}
                      </span>
                    </TableCell>
                    <TableCell className="py-3.5 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300 flex items-center justify-center text-xs font-bold border border-indigo-200/60">
                          {d.firstName?.[0]}
                        </div>
                        <span className="font-semibold text-sm text-brand-text-main">
                          {d.firstName} {d.lastName}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="py-3.5 px-6">
                      {d.specialty ? (
                        <span className="text-xs font-semibold text-violet-700 bg-violet-50 dark:bg-violet-950/40 dark:text-violet-300 px-3 py-1 rounded-full border border-violet-200/70">
                          {d.specialty}
                        </span>
                      ) : (
                        <span className="text-brand-text-muted text-xs">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      {/* TAB CONTENT 3: ENROLLED STUDENTS */}
      {activeTab === 'students' && (
        <div className="bg-brand-bg-card rounded-2xl border border-brand-border/40 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-brand-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-brand-text-main">
                {t('departments.enrolledStudentsList', 'Enrolled Students')}
              </h3>
              <p className="text-xs text-brand-text-muted mt-0.5">
                {students.length} {t('departments.studentsCount', 'Total Students')}
              </p>
            </div>

            {students.length > 3 && (
              <div className="relative w-full sm:w-64">
                <Search size={15} className="absolute inset-y-0 start-3 my-auto text-brand-text-muted pointer-events-none" />
                <input
                  type="text"
                  placeholder={t('common.search', 'Search')}
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="w-full h-9 ps-9 pe-3 bg-brand-bg-page/50 border border-brand-border rounded-xl text-xs text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20"
                />
              </div>
            )}
          </div>

          {filteredStudents.length === 0 ? (
            <div className="p-12 text-center text-brand-text-muted">
              <GraduationCap size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm font-medium">
                {studentSearch
                  ? t('common.noSearchResults', 'No matching results found')
                  : t('departments.noStudents', 'No students enrolled in this department.')}
              </p>
            </div>
          ) : (
            <Table className="w-full">
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b border-brand-border/40">
                  <TableHead className="text-start text-xs font-bold text-brand-text-muted py-3 px-6 w-44">
                    {t('students.studentId', 'Student ID')}
                  </TableHead>
                  <TableHead className="text-start text-xs font-bold text-brand-text-muted py-3 px-6">
                    {t('students.name', 'Student Name')}
                  </TableHead>
                  <TableHead className="text-center text-xs font-bold text-brand-text-muted py-3 px-6 w-44">
                    {t('auth.year', 'Academic Year')}
                  </TableHead>
                  <TableHead className="text-end text-xs font-bold text-brand-text-muted py-3 px-6 w-20">
                    {t('common.actions', 'View')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.map((s: any) => (
                  <TableRow
                    key={s.id}
                    className="cursor-pointer hover:bg-brand-bg-page/60 transition-colors border-b border-brand-border/30 last:border-0"
                    onClick={() => navigate(`/students/${s.id}`)}
                  >
                    <TableCell className="py-3.5 px-6">
                      <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200/60">
                        {s.studentId}
                      </span>
                    </TableCell>
                    <TableCell className="py-3.5 px-6">
                      <span className="font-semibold text-sm text-brand-text-main hover:text-brand-primary-600 transition-colors">
                        {s.firstName} {s.lastName}
                      </span>
                    </TableCell>
                    <TableCell className="py-3.5 px-6 text-center">
                      <span className={`inline-flex items-center text-xs font-semibold px-3 py-1 rounded-full border shadow-2xs ${getYearBadgeStyle(s.year || 1)}`}>
                        {getYearLabel(s.year || 1)}
                      </span>
                    </TableCell>
                    <TableCell className="py-3.5 px-6 text-end" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => navigate(`/students/${s.id}`)}
                        className="p-2 text-brand-text-muted hover:text-brand-primary-600 hover:bg-brand-primary-50 dark:hover:bg-brand-primary-950/40 rounded-xl transition-all"
                        title={t('students.viewProfile', 'View Profile')}
                      >
                        <ExternalLink size={16} />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      {/* Edit Department Modal */}
      {isEditModalOpen && (
        <EditDepartmentModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          department={department}
          colleges={colleges}
          onSuccess={() => {
            setIsEditModalOpen(false);
            fetchDepartment();
            showToast(t('departments.updateSuccess', 'Department updated successfully'), 'success');
          }}
        />
      )}
    </div>
  );
};

export default DepartmentDetails;
