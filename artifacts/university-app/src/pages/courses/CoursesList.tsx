// @ts-nocheck
import React, { useState, useEffect } from 'react';
import Card from '../../components/ui/Card';
import Table, { TableRow, TableCell, TableHeader, TableHead, TableBody } from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import LoadingState from '../../components/ui/LoadingState';
import { TruncatedText } from '../../components/ui/TruncatedText';
import { EmptyState } from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import Pagination from '../../components/ui/Pagination';
import Button from '../../components/ui/button';
import {
  BookOpen,
  Search,
  AlertCircle,
  CheckCircle2,
  Edit2,
  Trash2,
  Eye,
  Users,
  Plus,
  Download,
  X,
  GraduationCap,
  Building2,
  Layers,
  Sparkles,
} from 'lucide-react';
import { useCourses } from '../../hooks/useCourses';
import collegeService from '../../services/college.service';
import departmentService from '../../services/department.service';
import coursesService from '../../services/courses.service';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import CourseModal from './CourseModal';
import ConfirmDeleteModal from '../../components/ui/ConfirmDeleteModal';
import { logger } from '../../lib/logger';
import { useToast } from '../../context/ToastContext';
import useScope from '../../hooks/useScope';
import { downloadCsv } from '../../utils/exportCsv';
import BulkActionToolbar from '../../components/ui/BulkActionToolbar';

export function CoursesList() {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlDeptId = searchParams.get('departmentId');
  const { showToast } = useToast();

  const [colleges, setColleges] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selectedCollege, setSelectedCollege] = useState('');
  const [selectedDept, setSelectedDept] = useState(urlDeptId || '');
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedSemester, setSelectedSemester] = useState('');
  const [selectedIds, setSelectedIds] = useState<(string | number)[]>([]);

  const {
    data: courses,
    loading,
    error,
    search,
    setSearch,
    page,
    setPage,
    total,
    refetch,
  } = useCourses({
    collegeId: selectedCollege,
    departmentId: selectedDept,
    year: selectedYear,
    semester: selectedSemester,
  });

  const totalPages = Math.ceil(total / 10);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const canManage = ['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'].includes(user?.role || '');

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(Array.isArray(courses) ? courses.map((c: any) => c.id) : []);
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string | number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleBulkClear = () => setSelectedIds([]);

  const handleBulkExport = () => {
    const selectedCourses = (Array.isArray(courses) ? courses : []).filter((c: any) => selectedIds.includes(c.id));
    const exportData = selectedCourses.map((c: any) => ({
      Code: c.courseCode,
      Name: c.name,
      Credits: c.credits,
      Department: c.department?.name || 'General',
      Year: c.year,
      Semester: c.semester,
      Status: c.isPublished !== false ? 'Published' : 'Draft',
    }));
    downloadCsv(exportData, `courses_selected_${new Date().toISOString().split('T')[0]}.csv`);
    showToast(isRTL ? 'تم تصدير المقررات المحددة' : 'Exported selected courses', 'success');
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(isRTL ? `هل أنت متأكد من حذف ${selectedIds.length} مقرر محدد؟` : `Are you sure you want to delete ${selectedIds.length} selected courses?`)) return;
    try {
      setDeleteLoading(true);
      for (const id of selectedIds) {
        await coursesService.deleteCourse(id);
      }
      showToast(isRTL ? 'تم حذف المقررات المحددة بنجاح' : 'Deleted selected courses successfully', 'success');
      setSelectedIds([]);
      refetch();
    } catch (_err: any) {
      showToast(isRTL ? 'حدث خطأ أثناء حذف المقررات' : 'Error deleting courses', 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleBulkTogglePublication = async () => {
    try {
      for (const id of selectedIds) {
        await coursesService.toggleCoursePublication(id);
      }
      showToast(isRTL ? 'تم تحديث حالة نشر المقررات المحددة' : 'Updated publication status for selected courses', 'success');
      setSelectedIds([]);
      refetch();
    } catch (_err: any) {
      showToast(isRTL ? 'حدث خطأ أثناء تعديل الحالة' : 'Error updating publication status', 'error');
    }
  };

  useEffect(() => {
    const initializeFilters = async () => {
      try {
        const collegesRes = await collegeService.getColleges();
        if (collegesRes.success) setColleges(collegesRes.data);
      } catch (err: any) {
        logger.error('Error fetching colleges:', err);
      }

      if (urlDeptId) {
        try {
          const res = await departmentService.getDepartmentById(urlDeptId);
          if (res.success && res.data) {
            const dept = res.data;
            const collegeId = dept.collegeId || dept.college?.id;
            if (collegeId) {
              setSelectedCollege(collegeId);
              const deptRes = await departmentService.getDepartmentsByCollege(collegeId);
              if (deptRes.success) setDepartments(deptRes.data);
            }
            setSelectedDept(urlDeptId);
          }
        } catch (err: any) {
          logger.error('Error initializing url filters:', err);
        }
      }
    };

    initializeFilters();
  }, [urlDeptId]);

  // Apply scope defaults for students
  useEffect(() => {
    if (user?.role === 'STUDENT') {
      const studentYr = user.student?.year || user.year;
      if (studentYr && !selectedYear) {
        setSelectedYear(String(studentYr));
      }
    }
  }, [user, selectedYear]);

  const handleCollegeChange = async (e: any) => {
    const collegeId = e.target.value;
    setSelectedCollege(collegeId);
    setSelectedDept('');
    setPage(1);

    if (!collegeId) {
      setDepartments([]);
      return;
    }

    try {
      const res = await departmentService.getDepartmentsByCollege(collegeId);
      if (res.success) setDepartments(res.data);
    } catch (err: any) {
      logger.error('Error fetching departments:', err);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleteLoading(true);
      const res = await coursesService.deleteCourse(deleteTarget.id);
      if (res.success) {
        showToast(t('courses.deleteSuccess', 'Course deleted successfully'), 'success');
        setDeleteTarget(null);
        refetch();
      }
    } catch (err: any) {
      showToast(err.message || t('courses.deleteError', 'Error deleting course'), 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  const resetFilters = () => {
    setSearch('');
    setSelectedCollege('');
    setSelectedDept('');
    setSelectedYear('');
    setSelectedSemester('');
    setDepartments([]);
    setPage(1);
  };

  // Stats
  const publishedCount = Array.isArray(courses)
    ? courses.filter((c) => c.isPublished !== false).length
    : 0;
  const unassignedCount = Array.isArray(courses)
    ? courses.filter((c) => {
        const slots = c.sections || c.scheduleSlots || [];
        return !slots.some((s: any) => s.doctor);
      }).length
    : 0;
  const totalEnrollments = Array.isArray(courses)
    ? courses.reduce((acc, c) => acc + (c._count?.students || c._count?.enrollments || 0), 0)
    : 0;

  // CSV Export
  const handleExportCsv = () => {
    if (!Array.isArray(courses) || courses.length === 0) {
      showToast(isRTL ? 'لا توجد بيانات لتصديرها' : 'No courses to export', 'error');
      return;
    }

    const rows = courses.map((c) => {
      const slots = c.sections || c.scheduleSlots || [];
      const doctors = slots
        .filter((s: any) => s.doctor)
        .map((s: any) => `${s.doctor.firstName} ${s.doctor.lastName}`)
        .join('; ');

      return {
        'كود المقرر (Course Code)': c.courseCode,
        'اسم المقرر (Course Name)': c.name,
        'الساعات المعتمدة (Credits)': c.credits || 3,
        'الفرقة الدراسية (Year)': c.year || 1,
        'الفصل الدراسي (Semester)': c.semester || 1,
        'الكلية (College)': c.department?.college?.name || c.department?.college?.nameAr || '—',
        'القسم (Department)': isRTL ? c.department?.nameAr || c.department?.name : c.department?.name || 'مقرر عام',
        'المحاضر (Instructor)': doctors || (isRTL ? 'غير مسند' : 'Unassigned'),
        'الطلاب المسجلين (Enrolled Students)': c._count?.students || c._count?.enrollments || 0,
        'الحالة (Status)': c.isPublished !== false ? (isRTL ? 'منشور' : 'Published') : (isRTL ? 'مسودة' : 'Draft'),
      };
    });

    downloadCsv(rows, `courses_catalog_${new Date().toISOString().split('T')[0]}.csv`);
    showToast(isRTL ? 'تم تصدير الكتالوج بنجاح' : 'Exported successfully', 'success');
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            {t('courses.title', 'Course Catalog')}
          </h1>
          <p className="text-xs text-slate-400 font-semibold mt-0.5">
            {t('courses.subtitle', 'View and manage academic courses')}
          </p>
        </div>

        {canManage && (
          <Button
            size="sm"
            onClick={() => {
              setSelectedCourse(null);
              setIsModalOpen(true);
            }}
            className="h-9 px-4 bg-brand-primary-600 hover:bg-brand-primary-700 text-white rounded-xl text-xs font-bold gap-1.5 shadow-xs cursor-pointer"
          >
            <Plus size={15} />
            <span>{t('courses.addCourse', 'Add Course')}</span>
          </Button>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 1. EXECUTIVE 4-METRIC RIBBON                                              */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {/* Total Courses */}
        <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-semibold block">
              {t('dashboard.totalCourses', 'Total Courses')}
            </span>
            <span className="text-lg font-black text-slate-900 dark:text-white block mt-0.5">
              {total}
            </span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-brand-primary-50 dark:bg-brand-primary-950/50 text-brand-primary-600 flex items-center justify-center shrink-0">
            <BookOpen size={16} />
          </div>
        </div>

        {/* Active Published */}
        <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-semibold block">
              {isRTL ? 'المقررات المنشورة' : 'Active Published'}
            </span>
            <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 block mt-0.5">
              {publishedCount}
            </span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 size={16} />
          </div>
        </div>

        {/* Unassigned Instructors */}
        <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-semibold block">
              {t('courses.unassignedCourses', 'Unassigned Courses')}
            </span>
            <span className="text-lg font-black text-amber-600 dark:text-amber-400 block mt-0.5">
              {unassignedCount}
            </span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center shrink-0">
            <AlertCircle size={16} />
          </div>
        </div>

        {/* Total Enrollments */}
        <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-semibold block">
              {t('dashboard.totalStudents', 'Total Students')}
            </span>
            <span className="text-lg font-black text-blue-600 dark:text-blue-400 block mt-0.5">
              {totalEnrollments}
            </span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center shrink-0">
            <Users size={16} />
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. UNIFIED COMPACT 44px FILTER TOOLBAR                                    */}
      {/* ========================================================================= */}
      <div className="p-2 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-700 shadow-2xs flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={t('courses.searchPlaceholder', 'Search by name or code...')}
            className="w-full h-8.5 ps-8 pe-8 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-1.5 focus:ring-brand-primary-500 outline-none bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute end-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* College Dropdown */}
        {canManage && (
          <select
            value={selectedCollege}
            onChange={handleCollegeChange}
            className="h-8.5 px-3 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-brand-primary-500 cursor-pointer"
          >
            <option value="">{t('colleges.allColleges', 'All Colleges')}</option>
            {Array.isArray(colleges) &&
              colleges.map((c) => (
                <option key={c.id} value={c.id}>
                  {isRTL ? c.nameAr || c.name : c.name}
                </option>
              ))}
          </select>
        )}

        {/* Department Dropdown */}
        {canManage && (
          <select
            value={selectedDept}
            onChange={(e) => {
              setSelectedDept(e.target.value);
              setPage(1);
            }}
            disabled={!selectedCollege && departments.length === 0}
            className="h-8.5 px-3 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-brand-primary-500 cursor-pointer disabled:opacity-50"
          >
            <option value="">{t('departments.allDepartments', 'All Departments')}</option>
            {Array.isArray(departments) &&
              departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {isRTL ? d.nameAr || d.name : d.name}
                </option>
              ))}
          </select>
        )}

        {/* Year Dropdown */}
        <select
          value={selectedYear}
          onChange={(e) => {
            setSelectedYear(e.target.value);
            setPage(1);
          }}
          className="h-8.5 px-3 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-brand-primary-500 cursor-pointer"
        >
          <option value="">{isRTL ? 'كل السنوات' : 'All Years'}</option>
          {[1, 2, 3, 4].map((y) => (
            <option key={y} value={y.toString()}>
              {isRTL ? `الفرقة ${y}` : `Year ${y}`}
            </option>
          ))}
        </select>

        {/* Semester Dropdown */}
        <select
          value={selectedSemester}
          onChange={(e) => {
            setSelectedSemester(e.target.value);
            setPage(1);
          }}
          className="h-8.5 px-3 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-brand-primary-500 cursor-pointer"
        >
          <option value="">{isRTL ? 'كل الفصول' : 'All Semesters'}</option>
          <option value="1">{isRTL ? 'الفصل الدراسي 1' : 'Semester 1'}</option>
          <option value="2">{isRTL ? 'الفصل الدراسي 2' : 'Semester 2'}</option>
          <option value="3">{isRTL ? 'الفصل الصيفي' : 'Summer Term'}</option>
        </select>

        {/* Clear Filters */}
        {(search || selectedCollege || selectedDept || selectedYear || selectedSemester) && (
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

        {/* Export CSV */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportCsv}
          className="h-8.5 px-3 rounded-xl text-xs font-bold border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 gap-1.5 ms-auto cursor-pointer shadow-2xs"
        >
          <Download size={13} />
          <span>{isRTL ? 'تصدير CSV' : 'Export CSV'}</span>
        </Button>
      </div>

      {/* ========================================================================= */}
      {/* 3. HIGH-DENSITY COURSES DATA TABLE                                        */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-700 shadow-2xs overflow-hidden">
        {loading && (!Array.isArray(courses) || courses.length === 0) ? (
          <div className="p-12 text-center">
            <LoadingState message={isRTL ? 'جاري تحميل سجل المقررات...' : 'Fetching academic curriculum...'} />
          </div>
        ) : error ? (
          <div className="p-8">
            <ErrorState message={error} onRetry={refetch} />
          </div>
        ) : !Array.isArray(courses) || courses.length === 0 ? (
          <div className="p-12">
            <EmptyState
              icon={<BookOpen size={40} className="text-slate-400" />}
              title={search ? (isRTL ? 'لا توجد نتائج مطابقة' : 'No results found') : (isRTL ? 'لا توجد مقررات دراسية' : 'No courses found')}
              subtitle={
                search
                  ? (isRTL ? 'جرب البحث بكود أو كلمة أخرى' : 'Try searching with another code or title')
                  : (isRTL ? 'لم يتم إضافة مقررات دراسية حتى الآن' : 'No academic courses have been created yet')
              }
              action={
                search
                  ? { label: isRTL ? 'مسح البحث' : 'Clear search', onClick: () => setSearch('') }
                  : canManage
                  ? {
                      label: t('courses.addCourse', 'Add Course'),
                      onClick: () => {
                        setSelectedCourse(null);
                        setIsModalOpen(true);
                      },
                    }
                  : null
              }
            />
          </div>
        ) : (
          <>
            <Table className="w-full">
              <TableHeader>
                <TableRow className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700 text-slate-500 font-bold text-[11px]">
                  {canManage && (
                    <TableHead className="w-12 ps-4 text-start">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 dark:border-slate-700 text-brand-primary-500 focus:ring-brand-primary-500/20 w-4 h-4 cursor-pointer align-middle"
                        checked={Array.isArray(courses) && courses.length > 0 && selectedIds.length === courses.length}
                        onChange={handleSelectAll}
                        title={isRTL ? 'تحديد الكل' : 'Select All'}
                      />
                    </TableHead>
                  )}
                  <TableHead className={`${canManage ? '' : 'ps-4'} text-start`}>{t('courses.courseCode', 'Course Code')}</TableHead>
                  <TableHead className="text-start">{t('courses.courseName', 'Course Name')}</TableHead>
                  <TableHead className="text-start">{t('auth.department', 'Department')}</TableHead>
                  <TableHead className="text-center">{t('auth.year', 'Academic Year')}</TableHead>
                  <TableHead className="text-start">{t('courses.instructor', 'Instructor')}</TableHead>
                  <TableHead className="text-center">{t('courses.students', 'Students')}</TableHead>
                  <TableHead className="pe-4 text-end">{t('common.actions', 'Actions')}</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {courses.map((course) => {
                  const slots = course.sections || course.scheduleSlots || [];
                  const uniqueDoctors = slots
                    ? Array.from(
                        new Map(
                          slots.filter((s: any) => s.doctor).map((s: any) => [s.doctor.id, s.doctor])
                        ).values()
                      )
                    : [];
                  const isSelected = selectedIds.includes(course.id);

                  return (
                    <TableRow
                      key={course.id}
                      className={`border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors ${
                        isSelected ? 'bg-brand-primary-50/60 dark:bg-brand-primary-950/20' : ''
                      }`}
                    >
                      {canManage && (
                        <TableCell className="w-12 ps-4 text-start" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            className="rounded border-slate-300 dark:border-slate-700 text-brand-primary-500 focus:ring-brand-primary-500/20 w-4 h-4 cursor-pointer align-middle"
                            checked={isSelected}
                            onChange={() => handleSelectOne(course.id)}
                          />
                        </TableCell>
                      )}

                      {/* Course Code */}
                      <TableCell className={`${canManage ? '' : 'ps-4'} font-mono font-bold text-xs text-brand-primary-600 dark:text-brand-primary-400`}>
                        <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                          {course.courseCode}
                        </span>
                      </TableCell>

                      {/* Course Name & Credits */}
                      <TableCell className="font-semibold text-xs text-slate-900 dark:text-white">
                        <div className="flex items-center gap-2">
                          <span
                            onClick={() => navigate(`/courses/${course.id}`)}
                            className="hover:text-brand-primary-600 cursor-pointer font-bold transition-colors"
                          >
                            <TruncatedText text={course.name} maxLength={35} />
                          </span>

                          <span className="text-[10px] text-slate-400 font-mono">
                            ({course.credits || 3} {isRTL ? 'معتمدة' : 'Cr'})
                          </span>

                          {course.isPublished !== false ? (
                            <span className="px-1.5 py-0.2 rounded-md text-[9px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/50">
                              {isRTL ? 'منشور 🟢' : 'Active'}
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.2 rounded-md text-[9px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200/50">
                              {isRTL ? 'مسودة 🔴' : 'Draft'}
                            </span>
                          )}
                        </div>
                      </TableCell>

                      {/* Department & College */}
                      <TableCell className="text-xs">
                        {course.department ? (
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[160px]">
                              {isRTL
                                ? course.department.nameAr || course.department.name
                                : course.department.name}
                            </span>
                            {course.department.college && (
                              <span className="text-[10px] text-slate-400 truncate max-w-[160px]">
                                {isRTL
                                  ? course.department.college.nameAr || course.department.college.name
                                  : course.department.college.name}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-400 italic">
                            {isRTL ? 'مقرر عام (متطلب جامعة)' : 'General Course'}
                          </span>
                        )}
                      </TableCell>

                      {/* Year & Semester */}
                      <TableCell className="text-center">
                        <div className="inline-flex items-center gap-1.5">
                          <Badge variant="info" className="text-[10px] font-bold px-2 py-0.5">
                            {isRTL ? `الفرقة ${course.year || 1}` : `Year ${course.year || 1}`}
                          </Badge>
                          {course.semester && (
                            <span className="text-[10px] font-semibold text-slate-400">
                              {isRTL ? `ف${course.semester}` : `S${course.semester}`}
                            </span>
                          )}
                        </div>
                      </TableCell>

                      {/* Instructor / Doctor */}
                      <TableCell>
                        {uniqueDoctors.length > 0 ? (
                          <div className="flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded-md bg-brand-primary-100 text-brand-primary-700 dark:bg-brand-primary-950/60 dark:text-brand-primary-300 flex items-center justify-center text-[9px] font-black shrink-0">
                              {uniqueDoctors[0].firstName ? uniqueDoctors[0].firstName[0] : 'D'}
                            </div>
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate max-w-[130px]">
                              {uniqueDoctors[0].firstName} {uniqueDoctors[0].lastName}
                              {uniqueDoctors.length > 1 && ` (+${uniqueDoctors.length - 1})`}
                            </span>
                          </div>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 font-bold text-[10px] border border-amber-200/50">
                            {isRTL ? 'غير مسند' : 'Unassigned'}
                          </span>
                        )}
                      </TableCell>

                      {/* Students Count */}
                      <TableCell className="text-center font-bold text-xs">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-mono text-[11px]">
                          {course._count?.students ?? course._count?.enrollments ?? 0}
                        </span>
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="pe-4 text-end">
                        <div className="inline-flex items-center gap-1 justify-end">
                          <button
                            onClick={() => navigate(`/courses/${course.id}`)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-brand-primary-600 hover:bg-brand-primary-50 dark:hover:bg-brand-primary-950/40 transition-all cursor-pointer"
                            title={t('common.view', 'View')}
                          >
                            <Eye size={14} />
                          </button>

                          {canManage && (
                            <>
                              <button
                                onClick={() => {
                                  setSelectedCourse(course);
                                  setIsModalOpen(true);
                                }}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-all cursor-pointer"
                                title={t('common.edit', 'Edit')}
                              >
                                <Edit2 size={14} />
                              </button>

                              <button
                                onClick={() => setDeleteTarget({ id: course.id, name: course.name })}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all cursor-pointer"
                                title={t('common.delete', 'Delete')}
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            <div className="p-3 border-t border-slate-100 dark:border-slate-700/60">
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
          </>
        )}
      </div>

      {/* Floating Bulk Action Toolbar */}
      {canManage && (
        <BulkActionToolbar
          selectedCount={selectedIds.length}
          onClear={handleBulkClear}
          onExport={handleBulkExport}
          onDelete={handleBulkDelete}
          actions={[
            {
              label: isRTL ? 'تبديل حالة النشر' : 'Toggle Publish',
              icon: Sparkles,
              onClick: handleBulkTogglePublication,
              variant: 'outline',
            },
          ]}
        />
      )}

      {/* Course Create / Edit Modal */}
      {isModalOpen && (
        <CourseModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedCourse(null);
          }}
          course={selectedCourse}
          onSuccess={() => {
            setIsModalOpen(false);
            setSelectedCourse(null);
            refetch();
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <ConfirmDeleteModal
          isOpen={Boolean(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
          title={t('common.deleteConfirmTitle', 'Confirm deletion')}
          message={t('common.deleteConfirmMessage', { name: deleteTarget?.name })}
          loading={deleteLoading}
        />
      )}
    </div>
  );
}

export default CoursesList;
