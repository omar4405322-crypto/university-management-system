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
  const { data: courses, loading, error, search, setSearch, page, setPage, total, refetch } = useCourses({ collegeId: selectedCollege, departmentId: selectedDept });
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

  // Apply scope defaults for admins
  const scope = useScope();

  useEffect(() => {
    const timer = setTimeout(() => {
      refetch();
    }, 400);
    return () => clearTimeout(timer);
  }, [search, selectedCollege, selectedDept, page]);

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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Courses Stat */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-5 rounded-2xl flex flex-col gap-2 shadow-sm group hover:-translate-y-1 transition-all duration-300">
          <div className="h-10 w-10 rounded-full bg-brand-primary-500/25 flex items-center justify-center shadow-[0_0_15px_rgba(132,189,58,0.45)] group-hover:shadow-[0_0_25px_rgba(132,189,58,0.65)] transition-shadow duration-300">
            <BookOpen size={20} className="text-brand-primary-600" />
          </div>
          <div className="mt-2">
            <p className="text-xs font-bold text-brand-text-muted uppercase tracking-wider">
              {t('dashboard.totalCourses')}
            </p>
            <h3 className="text-2xl font-black text-brand-text-primary dark:text-brand-text-main mt-1">
              {total}
            </h3>
          </div>
        </div>

        {/* Unassigned Courses Stat */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-5 rounded-2xl flex flex-col gap-2 shadow-sm group hover:-translate-y-1 transition-all duration-300">
          <div className="h-10 w-10 rounded-full bg-amber-500/25 flex items-center justify-center shadow-[0_0_15px_rgba(245,158,11,0.45)] group-hover:shadow-[0_0_25px_rgba(245,158,11,0.65)] transition-shadow duration-300">
            <AlertCircle size={20} className="text-amber-600" />
          </div>
          <div className="mt-2">
            <p className="text-xs font-bold text-brand-text-muted uppercase tracking-wider">
              {t('courses.unassignedCourses')}
            </p>
            <h3 className="text-2xl font-black text-brand-text-primary dark:text-brand-text-main mt-1">
              {Array.isArray(courses) ? courses.filter(c => !(c.sections && c.sections.some((s: any) => s.doctor))).length : 0}
            </h3>
          </div>
        </div>

        {/* Total Students Stat */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-5 rounded-2xl flex flex-col gap-2 shadow-sm group hover:-translate-y-1 transition-all duration-300">
          <div className="h-10 w-10 rounded-full bg-blue-500/25 flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.45)] group-hover:shadow-[0_0_25px_rgba(59,130,246,0.65)] transition-shadow duration-300">
            <Users size={20} className="text-blue-600" />
          </div>
          <div className="mt-2">
            <p className="text-xs font-bold text-brand-text-muted uppercase tracking-wider">
              {t('dashboard.totalStudents')}
            </p>
            <h3 className="text-2xl font-black text-brand-text-primary dark:text-brand-text-main mt-1">
              {Array.isArray(courses) ? courses.reduce((acc, c) => acc + (c._count?.students || 0), 0) : 0}
            </h3>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
        <Card noPadding className="md:col-span-1 h-fit bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="p-6 bg-surface-subtle dark:bg-slate-800/30 border-b border-brand-border dark:border-brand-border flex items-center justify-between">
            <h3 className="font-black text-brand-text-primary dark:text-brand-text-main flex items-center gap-2 uppercase tracking-widest text-xs">
              <Filter size={16} className="text-brand-primary-600" /> 
              {t('students.filters')}
            </h3>
            <button onClick={resetFilters} className="text-[10px] font-black text-brand-primary-600 hover:opacity-70 transition-opacity uppercase tracking-widest">
              {t('COMMON.RESET')}
            </button>
          </div>
          
          <div className="p-6 space-y-6">
            <div className="space-y-1.5">
              <label className="label-stat ml-1">{t('COURSES.SEARCHCOURSE')}</label>
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-text-muted h-4 w-4 group-focus-within:text-brand-primary-600 transition-colors" />
                <Input 
                  placeholder={t('COURSES.SEARCHPLACEHOLDER')} 
                  className="pl-10 h-10 bg-surface-subtle dark:bg-surface-subtle border-none font-bold text-sm"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                />
              </div>
            </div>
            
            <div className="space-y-1.5">
              <label className="label-stat ml-1">{t('auth.college')}</label>
              <select 
                value={selectedCollege}
                onChange={handleCollegeChange}
                className="w-full h-10 px-4 bg-surface-subtle dark:bg-surface-subtle border-none rounded-xl text-xs font-black uppercase tracking-widest text-brand-text-primary dark:text-brand-text-main focus:ring-2 focus:ring-brand-primary-600/20 transition-all appearance-none cursor-pointer"
              >
                <option value="">{t('colleges.allColleges')}</option>
                {Array.isArray(colleges) && colleges.map(c => <option key={c.id} value={c.id}>{isRTL ? c.nameAr || c.name : c.name}</option>)}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="label-stat ml-1">{t('auth.department')}</label>
              <select 
                value={selectedDept}
                onChange={(e) => { setSelectedDept(e.target.value); setPage(1); }}
                disabled={!selectedCollege}
                className="w-full h-10 px-4 bg-surface-subtle dark:bg-surface-subtle border-none rounded-xl text-xs font-black uppercase tracking-widest text-brand-text-primary dark:text-brand-text-main focus:ring-2 focus:ring-brand-primary-600/20 transition-all appearance-none cursor-pointer disabled:opacity-50"
              >
                <option value="">{t('departments.allDepartments')}</option>
                {Array.isArray(departments) && departments.map(d => <option key={d.id} value={d.id}>{isRTL ? d.nameAr || d.name : d.name}</option>)}
              </select>
            </div>
          </div>
        </Card>

        <div className="md:col-span-3">
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
                              <TruncatedText text={course.name} />
                            </TableCell>
                            <TableCell hideOnMobile className="label-stat max-w-[150px]">
                              <TruncatedText text={isRTL ? course.department?.nameAr || course.department?.name : course.department?.name} />
                            </TableCell>
                            <TableCell>
                              {(() => {
                                const uniqueDoctors = course.sections
                                  ? Array.from(new Map(course.sections.filter((s: any) => s.doctor).map((s: any) => [s.doctor.id, s.doctor])).values())
                                  : [];
                                
                                if (uniqueDoctors.length > 0) {
                                  return (
                                    <div className="flex flex-col gap-1.5">
                                      {(uniqueDoctors as any[]).map((doc: any) => (
                                        <div key={doc.id} className="flex items-center gap-2">
                                          <div className="w-6 h-6 rounded-md bg-brand-primary-55 dark:bg-brand-primary-900/10 text-brand-primary-600 flex items-center justify-center text-[9px] font-black shadow-inner shrink-0">
                                            {doc.firstName[0]}
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
                              <Badge variant="info" className="font-black text-[10px]">{course._count.students}</Badge>
                            </TableCell>
                            <TableCell>
                              <ActionMenu actions={[
                                { label: t('common.view'), icon: Eye, variant: 'view', onClick: () => navigate(`/courses/${course.id}`) },
                                { label: t('common.edit'), icon: Edit2, variant: 'edit', onClick: () => { setSelectedCourse(course); setIsModalOpen(true); } },
                                {
                                  label: t('common.delete'),
                                  icon: Trash2,
                                  variant: 'delete',
                                  onClick: () => setDeleteTarget({ id: course.id, name: course.name }),
                                },
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
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => { setIsModalOpen(false); refetch(); showToast(selectedCourse ? t('courses.updateSuccess') : t('courses.addSuccess'), 'success'); }}
        />
      )}
    </div>
  );
};

export default CoursesList;
