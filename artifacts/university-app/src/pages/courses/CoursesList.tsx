// @ts-nocheck
import React, { useState, useEffect } from 'react';
import Card from '../../components/ui/Card';
import Table, { TableRow, TableCell, ActionMenu, TableHeader, TableHead, TableBody } from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import LoadingState from '../../components/ui/LoadingState';
import { TruncatedText } from '../../components/ui/TruncatedText';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import ErrorState from '../../components/ui/ErrorState';
import Input from '../../components/ui/input';
import FilterBar from '../../components/ui/FilterBar';
import Pagination from '../../components/ui/Pagination';
import { 
  BookOpen, 
  Filter, 
  Search,
  AlertCircle, 
  CheckCircle,
  Loader2,
  Edit2,
  Trash2,
  Eye,
  Users
} from 'lucide-react';
import { useCourses } from '../../hooks/useCourses';
import collegeService from '../../services/college.service';
import departmentService from '../../services/department.service';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import CourseModal from './CourseModal';
import ConfirmDeleteModal from '../../components/ui/ConfirmDeleteModal';
import { logger } from '../../lib/logger';
import { useToast } from '../../context/ToastContext';
import useScope from '../../hooks/useScope';

const CoursesList = () => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlDeptId = searchParams.get('departmentId');
  const [colleges, setColleges] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selectedCollege, setSelectedCollege] = useState('');
  const [selectedDept, setSelectedDept] = useState(urlDeptId || '');
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedSemester, setSelectedSemester] = useState('');
  const { data: courses, loading, error, search, setSearch, page, setPage, total, refetch } = useCourses({ 
    collegeId: selectedCollege, 
    departmentId: selectedDept,
    year: selectedYear,
    semester: selectedSemester
  });
  const totalPages = Math.ceil(total / 10);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const { showToast } = useToast();
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchInitialData = async () => {
    try {
      const collegesRes = await collegeService.getColleges();
      if (collegesRes.success) setColleges(collegesRes.data);
    } catch (err: any) {
      logger.error('Error fetching metadata:', err);
    }
  };


  useEffect(() => {
    const initializeFiltersFromUrl = async () => {
      // First fetch colleges
      try {
        const collegesRes = await collegeService.getColleges();
        if (collegesRes.success) {
          setColleges(collegesRes.data);
        }
      } catch (err: any) {
        logger.error('Error fetching colleges metadata:', err);
      }
      
      if (urlDeptId) {
        try {
          const res = await departmentService.getDepartmentById(urlDeptId);
          if (res.success && res.data) {
            const dept = res.data;
            const collegeId = dept.collegeId || dept.college?.id;
            if (collegeId) {
              setSelectedCollege(collegeId);
              // Fetch departments for this college to populate the department dropdown
              const deptRes = await departmentService.getDepartmentsByCollege(collegeId);
              if (deptRes.success) {
                setDepartments(deptRes.data);
              }
            }
            setSelectedDept(urlDeptId);
          }
        } catch (err: any) {
          logger.error('Error initializing url filters:', err);
        }
      }
    };

    initializeFiltersFromUrl();
  }, [urlDeptId]);

  useEffect(() => {
    const mainEl = document.querySelector('main');
    if (mainEl) {
      mainEl.classList.add('bg-slate-50', 'dark:bg-slate-900');
      return () => {
        mainEl.classList.remove('bg-slate-50', 'dark:bg-slate-900');
      };
    }
  }, []);

  // Apply scope defaults for admins / students
  const scope = useScope();

  useEffect(() => {
    if (user?.role === 'STUDENT') {
      const studentYr = user.student?.year || user.year;
      if (studentYr && !selectedYear) {
        setSelectedYear(String(studentYr));
      }
    }
  }, [user, selectedYear]);

  useEffect(() => {
    const timer = setTimeout(() => {
      refetch();
    }, 400);
    return () => clearTimeout(timer);
  }, [search, selectedCollege, selectedDept, selectedYear, selectedSemester, page]);

  const handleCollegeChange = async (e) => {
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
        showToast(t('courses.deleteSuccess'), 'success');
        setDeleteTarget(null);
        refetch();
      }
    } catch (err: any) {
      showToast(err.message || t('courses.deleteError'), 'error');
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

  const canManage = user?.role === 'SUPER_ADMIN' || user?.role === 'COLLEGE_ADMIN';

  return (
    <div className="pt-6 section-gap animate-page">
      
      <PageHeader 
        title={t('courses.title')}
        subtitle={t('COURSES.SUBTITLE')}
        action={canManage ? {
          label: t('courses.addCourse'),
          onClick: () => { setSelectedCourse(null); setIsModalOpen(true); },
          className: "bg-brand-primary-500 hover:bg-brand-primary-600 text-white rounded-xl active:scale-95 transition-all"
        } : null}
      />

      {/* Sleek Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
        {/* Total Courses */}
        <div className="bg-surface-card border border-brand-border p-5 rounded-2xl flex items-center justify-between shadow-card hover:-translate-y-0.5 transition-all">
          <div className="space-y-1">
            <p className="text-xs font-bold text-brand-text-muted">{t('dashboard.totalCourses')}</p>
            <h3 className="text-3xl font-black text-brand-text-primary dark:text-brand-text-main">{total}</h3>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-brand-primary-50 dark:bg-brand-primary-950/40 text-brand-brand-green-dark flex items-center justify-center shrink-0">
            <BookOpen size={24} />
          </div>
        </div>

        {/* Unassigned Courses */}
        <div className="bg-surface-card border border-brand-border p-5 rounded-2xl flex items-center justify-between shadow-card hover:-translate-y-0.5 transition-all">
          <div className="space-y-1">
            <p className="text-xs font-bold text-brand-text-muted">{t('courses.unassignedCourses')}</p>
            <h3 className="text-3xl font-black text-brand-text-primary dark:text-brand-text-main">
              {Array.isArray(courses) ? courses.filter(c => {
                const hasDoctor = (c.sections && c.sections.some((s: any) => s.doctor)) || (c.scheduleSlots && c.scheduleSlots.some((s: any) => s.doctor));
                return !hasDoctor;
              }).length : 0}
            </h3>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <AlertCircle size={24} />
          </div>
        </div>

        {/* Total Enrolled Students */}
        <div className="bg-surface-card border border-brand-border p-5 rounded-2xl flex items-center justify-between shadow-card hover:-translate-y-0.5 transition-all">
          <div className="space-y-1">
            <p className="text-xs font-bold text-brand-text-muted">{t('dashboard.totalStudents')}</p>
            <h3 className="text-3xl font-black text-brand-text-primary dark:text-brand-text-main">
              {Array.isArray(courses) ? courses.reduce((acc, c) => acc + (c._count?.students || c._count?.enrollments || 0), 0) : 0}
            </h3>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-brand-navy-50 dark:bg-brand-navy-900/40 text-brand-navy-500 dark:text-brand-navy-300 flex items-center justify-center shrink-0">
            <Users size={24} />
          </div>
        </div>
      </div>

      {/* Horizontal Filter Bar */}
      <Card className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-0 mb-6">
        <FilterBar
          search={search}
          onSearchChange={(val) => { setSearch(val); setPage(1); }}
          searchPlaceholder={t('COURSES.SEARCHPLACEHOLDER')}
          onClear={search || selectedCollege || selectedDept || selectedYear || selectedSemester ? resetFilters : undefined}
        >
          {canManage && (
            <>
              <select 
                value={selectedCollege}
                onChange={handleCollegeChange}
                className="h-10 px-4 bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-brand-text-primary dark:text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 transition-all cursor-pointer flex-shrink-0"
              >
                <option value="">{t('colleges.allColleges')}</option>
                {Array.isArray(colleges) && colleges.map(c => (
                  <option key={c.id} value={c.id}>
                    {isRTL ? c.nameAr || c.name : c.name}
                  </option>
                ))}
              </select>

              <select 
                value={selectedDept}
                onChange={(e) => { setSelectedDept(e.target.value); setPage(1); }}
                disabled={!selectedCollege}
                className="h-10 px-4 bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-brand-text-primary dark:text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 transition-all cursor-pointer flex-shrink-0 disabled:opacity-50"
              >
                <option value="">{t('departments.allDepartments')}</option>
                {Array.isArray(departments) && departments.map(d => (
                  <option key={d.id} value={d.id}>
                    {isRTL ? d.nameAr || d.name : d.name}
                  </option>
                ))}
              </select>
            </>
          )}

          <select 
            value={selectedYear}
            onChange={(e) => { setSelectedYear(e.target.value); setPage(1); }}
            className="h-10 px-4 bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-brand-text-primary dark:text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 transition-all cursor-pointer flex-shrink-0"
          >
            <option value="">{t('common.allYears', 'All Years')}</option>
            {[1, 2, 3, 4, 5].map(y => (
              <option key={y} value={y.toString()}>
                {t('common.year', 'Year')} {y}
              </option>
            ))}
          </select>

          <select 
            value={selectedSemester}
            onChange={(e) => { setSelectedSemester(e.target.value); setPage(1); }}
            className="h-10 px-4 bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-brand-text-primary dark:text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 transition-all cursor-pointer flex-shrink-0"
          >
            <option value="">{t('schedule.allSemesters', 'All Semesters')}</option>
            <option value="1">{t('schedule.semester1', 'Semester 1')}</option>
            <option value="2">{t('schedule.semester2', 'Semester 2')}</option>
            <option value="3">{t('schedule.semester3', 'Summer')}</option>
          </select>
        </FilterBar>
      </Card>

      <div className="w-full">
          {loading && (!Array.isArray(courses) || courses.length === 0) ? (
            <LoadingState message="Fetching academic curriculum..." />
          ) : error ? (
            <ErrorState message={error} onRetry={refetch} />
          ) : (
            <Card noPadding className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden p-4 md:p-6">
              <div className="min-h-0">
                {!Array.isArray(courses) || courses.length === 0 ? (
                  <EmptyState 
                    icon={<BookOpen size={48} />}
                    title={search ? t('courses.noSearchResults') : t('courses.noCourses')}
                    subtitle={search ? t('courses.noSearchResultsDesc') : t('courses.noCoursesDesc')}
                                        action={
                      search
                        ? { label: t('common.clearSearch'), onClick: () => setSearch('') }
                        : canManage ? {
                          label: t('courses.addCourse'),
                          onClick: () => { setSelectedCourse(null); setIsModalOpen(true); }
                        } : null
                    }
                  />
                ) : (
                  <>
                    <Table className="w-full">
                      <TableHeader>
                        <TableRow className="bg-slate-50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900/40">
                          <TableHead hideOnMobile className="text-start text-xs uppercase tracking-widest text-brand-text-muted font-black pb-3">
                            {t('courses.courseCode')}
                          </TableHead>
                          <TableHead className="text-start text-xs uppercase tracking-widest text-brand-text-muted font-black pb-3">
                            {t('courses.courseName')}
                          </TableHead>
                          <TableHead hideOnMobile className="text-start text-xs uppercase tracking-widest text-brand-text-muted font-black pb-3">
                            {t('auth.department')}
                          </TableHead>
                          <TableHead className="text-center text-xs uppercase tracking-widest text-brand-text-muted font-black pb-3">
                            {t('auth.year', 'Year')}
                          </TableHead>
                          <TableHead className="text-center text-xs uppercase tracking-widest text-brand-text-muted font-black pb-3">
                            {t('courses.instructor')}
                          </TableHead>
                          <TableHead hideOnMobile className="text-center text-xs uppercase tracking-widest text-brand-text-muted font-black pb-3">
                            {t('courses.students')}
                          </TableHead>
                          <TableHead className="text-end text-xs uppercase tracking-widest text-brand-text-muted font-black pb-3 pr-4">
                            {t('common.actions')}
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(Array.isArray(courses) ? courses : []).map((course) => (
                          <TableRow key={course.id} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                            <TableCell hideOnMobile className="font-black text-brand-navy-500 dark:text-brand-primary-500 tracking-widest text-xs uppercase">{course.courseCode}</TableCell>
                            <TableCell className="font-medium text-brand-text-primary dark:text-brand-text-main tracking-tight">
                              <div className="flex items-center gap-2">
                                <TruncatedText text={course.name} />
                                {course.isPublished !== false ? (
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/50 shrink-0">
                                    منشور 🟢
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200/50 shrink-0">
                                    مسودة 🔴
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell hideOnMobile className="label-stat max-w-[150px]">
                              <TruncatedText text={isRTL ? course.department?.nameAr || course.department?.name : course.department?.name} />
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex flex-col items-center gap-1">
                                <Badge variant="info" className="font-bold text-[10px] px-2 py-0.5">
                                  {t('common.year', 'Year')} {course.year || 1}
                                </Badge>
                                {course.semester && (
                                  <span className="text-[9px] font-bold text-slate-400">
                                    {t('schedule.sem', 'Sem')} {course.semester}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {(() => {
                                const slots = course.sections || course.scheduleSlots || [];
                                const uniqueDoctors = slots
                                  ? Array.from(new Map(slots.filter((s: any) => s.doctor).map((s: any) => [s.doctor.id, s.doctor])).values())
                                  : [];
                                
                                if (uniqueDoctors.length > 0) {
                                  return (
                                    <div className="flex flex-col gap-1.5">
                                      {(uniqueDoctors as any[]).map((doc: any) => (
                                        <div key={doc.id} className="flex items-center gap-2">
                                          <div className="w-6 h-6 rounded-md bg-brand-primary-50 text-brand-brand-green-dark flex items-center justify-center text-[9px] font-black shadow-inner shrink-0">
                                            {doc.firstName ? doc.firstName[0] : 'D'}
                                          </div>
                                          <span className="text-xs font-bold text-brand-text-primary dark:text-brand-text-main text-start whitespace-nowrap truncate max-w-[120px]">
                                            {doc.firstName} {doc.lastName}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  );
                                }
                                return (
                                  <div className="flex justify-start">
                                    <span className="inline-flex items-center justify-center px-2 py-1 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 font-black text-[10px] uppercase tracking-widest border border-amber-200 dark:border-amber-800/50">
                                      {t('courses.unassigned', 'UNASSIGNED')}
                                    </span>
                                  </div>
                                );
                              })()}
                            </TableCell>
                            <TableCell hideOnMobile className="text-center">
                              <Badge variant="info" className="font-black text-[10px]">{course._count?.students ?? course._count?.enrollments ?? 0}</Badge>
                            </TableCell>
                            <TableCell>
                              <ActionMenu actions={[
                                { label: t('common.view'), icon: Eye, variant: 'view', onClick: () => navigate(`/courses/${course.id}`) },
                                ...(canManage ? [
                                  { label: t('common.edit'), icon: Edit2, variant: 'edit', onClick: () => { setSelectedCourse(course); setIsModalOpen(true); } },
                                  {
                                    label: t('common.delete'),
                                    icon: Trash2,
                                    variant: 'delete',
                                    onClick: () => setDeleteTarget({ id: course.id, name: course.name }),
                                  },
                                ] : [])
                              ]} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                                        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
                  </>
                )}
              </div>
            </Card>
          )}
        </div>

      <ConfirmDeleteModal
        isOpen={Boolean(deleteTarget)}
        itemName={deleteTarget?.name}
        onClose={() => !deleteLoading && setDeleteTarget(null)}
        onConfirm={confirmDelete}
        loading={deleteLoading}
      />

      {isModalOpen && (
        <CourseModal 
          isOpen={isModalOpen}
          course={selectedCourse}
          initialCollegeId={selectedCollege}
          initialDepartmentId={selectedDept}
          initialYear={selectedYear}
          initialSemester={selectedSemester}
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => { setIsModalOpen(false); refetch(); showToast(selectedCourse ? t('courses.updateSuccess') : t('courses.addSuccess'), 'success'); }}
        />
      )}
    </div>
  );
};

export default CoursesList;
