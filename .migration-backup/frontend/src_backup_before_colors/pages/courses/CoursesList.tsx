// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import Card from '../../components/ui/Card';
import Table, { TableRow, TableCell, ActionMenu } from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import LoadingState from '../../components/ui/LoadingState';
import { TruncatedText } from '../../components/ui/TruncatedText';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import ErrorState from '../../components/ui/ErrorState';
import Input from '../../components/ui/Input';
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
  Eye
} from 'lucide-react';
import { useCourses } from '../../hooks/useCourses';
import collegeService from '../../services/college.service';
import departmentService from '../../services/department.service';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import CourseModal from './CourseModal';
import ConfirmDeleteModal from '../../components/ui/ConfirmDeleteModal';
import { logger } from '../../lib/logger';
import { useToast } from '../../context/ToastContext';

const CoursesList = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [colleges, setColleges] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selectedCollege, setSelectedCollege] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
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

  const fetchFilteredCourses = useCallback(async () => {
    try {
            setLoading(true);
            setError(null);
      const params = {
        search,
        collegeId: selectedCollege || scope?.effectiveCollegeId || undefined,
        departmentId: selectedDept || scope?.effectiveDepartmentId || undefined,
        page,
        limit: 10
      };
            const res = await coursesService.getCourses(params);
      if (res.success) {
        const coursesArray = Array.isArray(res.data) 
          ? res.data 
          : Array.isArray(res.data?.courses) 
            ? res.data.courses 
            : Array.isArray(res.data?.data) 
              ? res.data.data 
              : [];
        // Internal state is managed by useCourses, refetch logic handles updates
                setTotalPages(res.data?.pagination?.totalPages || res.data?.totalPages || 1);
      }
    } catch (err: any) {
      logger.error('Error filtering courses:', err);
            setError(err.message || 'Failed to load courses.');
    } finally {
            setLoading(false);
    }
  }, [search, selectedCollege, selectedDept, page]);

  useEffect(() => {
    fetchInitialData();
  }, []);

  // Apply scope defaults for admins
    const scope = require('../../hooks/useScope').default ? require('../../hooks/useScope').default() : null;

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
    <div className="section-gap animate-page">
      
      <PageHeader 
        title={t('courses.title')}
        subtitle={t('COURSES.SUBTITLE')}
        action={canManage ? {
          label: t('courses.addCourse'),
          onClick: () => { setSelectedCourse(null); setIsModalOpen(true); }
        } : null}
      />

      <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
        <Card noPadding className="md:col-span-1 h-fit border-none shadow-soft overflow-hidden">
          <div className="p-6 bg-surface-subtle dark:bg-slate-800/30 border-b border-brand-border dark:border-brand-border flex items-center justify-between">
            <h3 className="font-black text-brand-text-primary dark:text-brand-text-main flex items-center gap-2 uppercase tracking-widest text-xs">
              <Filter size={16} className="text-brand-primary-500" /> 
              {t('students.filters')}
            </h3>
            <button onClick={resetFilters} className="text-[10px] font-black text-brand-primary-500 hover:opacity-70 transition-opacity uppercase tracking-widest">
              {t('COMMON.RESET')}
            </button>
          </div>
          
          <div className="p-6 space-y-6">
            <div className="space-y-1.5">
              <label className="label-stat ml-1">{t('COURSES.SEARCHCOURSE')}</label>
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-text-muted h-4 w-4 group-focus-within:text-brand-primary-500 transition-colors" />
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
                className="w-full h-10 px-4 bg-surface-subtle dark:bg-surface-subtle border-none rounded-xl text-xs font-black uppercase tracking-widest text-brand-text-primary dark:text-brand-text-main focus:ring-2 focus:ring-brand-primary-500/20 transition-all appearance-none cursor-pointer"
              >
                <option value="">{t('colleges.allColleges')}</option>
                {Array.isArray(colleges) && colleges.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="label-stat ml-1">{t('auth.department')}</label>
              <select 
                value={selectedDept}
                onChange={(e) => { setSelectedDept(e.target.value); setPage(1); }}
                disabled={!selectedCollege}
                className="w-full h-10 px-4 bg-surface-subtle dark:bg-surface-subtle border-none rounded-xl text-xs font-black uppercase tracking-widest text-brand-text-primary dark:text-brand-text-main focus:ring-2 focus:ring-brand-primary-500/20 transition-all appearance-none cursor-pointer disabled:opacity-50"
              >
                <option value="">{t('departments.allDepartments')}</option>
                {Array.isArray(departments) && departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>
        </Card>

        <div className="md:col-span-3">
          {loading && (!Array.isArray(courses) || courses.length === 0) ? (
            <LoadingState message="Fetching academic curriculum..." />
          ) : error ? (
            <ErrorState message={error} onRetry={fetchFilteredCourses} />
          ) : (
            <Card noPadding className="border-none shadow-soft overflow-hidden">
              <div className="min-h-[400px]">
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
                    <Table headers={[t('courses.courseCode'), t('courses.courseName'), t('auth.department'), t('courses.instructor'), t('courses.students'), t('common.actions')]}>
                      {(Array.isArray(courses) ? courses : []).map((course) => (
                        <TableRow key={course.id} className="hover:bg-surface-subtle dark:hover:bg-slate-800/50 transition-colors">
                          <TableCell className="font-black text-brand-navy-500 dark:text-brand-primary-400 tracking-widest text-xs uppercase">{course.courseCode}</TableCell>
                          <TableCell className="font-black text-brand-text-primary dark:text-brand-text-main tracking-tight">
                            <TruncatedText text={course.name} />
                          </TableCell>
                          <TableCell className="label-stat max-w-[150px]">
                            <TruncatedText text={course.department?.name} />
                          </TableCell>
                          <TableCell>
                            {course.doctor ? (
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-brand-primary-50 dark:bg-brand-primary-900/10 text-brand-primary-500 flex items-center justify-center text-[10px] font-black shadow-inner">
                                  {course.doctor.firstName[0]}
                                </div>
                                <span className="text-xs font-bold text-brand-text-primary dark:text-brand-text-main">{course.doctor.firstName} {course.doctor.lastName}</span>
                              </div>
                            ) : <span className="text-[10px] font-black uppercase tracking-widest text-brand-text-muted opacity-50">Unassigned</span>}
                          </TableCell>
                          <TableCell>
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
          course={selectedCourse}
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => { setIsModalOpen(false); fetchFilteredCourses(); showToast(selectedCourse ? t('courses.updateSuccess') : t('courses.addSuccess'), 'success'); }}
        />
      )}
    </div>
  );
};

export default CoursesList;
