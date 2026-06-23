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
import Pagination from '../../components/ui/Pagination';
import { 
  BookOpen, 
  Filter, 
  Search,
  AlertCircle, 
  CheckCircle,
  Edit2,
  Trash2,
  Eye
} from 'lucide-react';
import coursesService from '../../services/courses.service';
import collegeService from '../../services/college.service';
import departmentService from '../../services/department.service';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import CourseModal from './CourseModal';
import ConfirmDeleteModal from '../../components/ui/ConfirmDeleteModal';
import useScope from '../../hooks/useScope';

interface College {
  id: number;
  name: string;
  nameAr?: string;
}

interface Department {
  id: number;
  name: string;
  nameAr?: string;
}

interface Course {
  id: number;
  courseCode: string;
  name: string;
  nameAr?: string;
  department?: { name: string };
  doctor?: { firstName: string; lastName: string };
  _count: { students: number };
}

interface Toast {
  message: string;
  type: 'success' | 'error';
}

interface DeleteTarget {
  id: number;
  name: string;
}

const CoursesList: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [colleges, setColleges] = useState<College[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState<string>('');
  const [selectedCollege, setSelectedCollege] = useState<string>('');
  const [selectedDept, setSelectedDept] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCourses, setTotalCourses] = useState<number>(0);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<boolean>(false);

  const fetchInitialData = async () => {
    try {
      const collegesRes = await collegeService.getColleges();
      if (collegesRes.success) setColleges(collegesRes.data);
    } catch (err: any) {
      console.error('Error fetching colleges:', err);
      setError('Failed to load colleges - ' + (err.message || 'Connection error'));
    }
  };

  // Apply scope defaults for admins
  const scope = useScope();

  const fetchFilteredCourses = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {
        search,
        collegeId: selectedCollege ? parseInt(selectedCollege, 10) : (scope?.effectiveCollegeId || undefined),
        departmentId: selectedDept ? parseInt(selectedDept, 10) : (scope?.effectiveDepartmentId || undefined),
        page,
        limit: 10
      };
      const res = await coursesService.getCourses(params);
      if (res.success) {
        const coursesArray: Course[] = Array.isArray(res.data) 
          ? res.data 
          : Array.isArray(res.data?.courses) 
            ? res.data.courses 
            : Array.isArray(res.data?.data) 
              ? res.data.data 
              : [];
        setCourses(coursesArray);
        setTotalPages(res.data?.pagination?.totalPages || res.data?.totalPages || 1);
        setTotalCourses(res.data?.pagination?.total || res.data?.total || coursesArray.length);
      }
    } catch (err: any) {
      console.error('Error filtering courses:', err);
      setError(err.message || 'Failed to load courses.');
    } finally {
      setLoading(false);
    }
  }, [search, selectedCollege, selectedDept, page]);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchFilteredCourses();
    }, 400);
    return () => clearTimeout(timer);
  }, [fetchFilteredCourses]);

  const handleCollegeChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const collegeId = e.target.value;
    setSelectedCollege(collegeId);
    setSelectedDept('');
    setPage(1);
    
    if (!collegeId) {
      setDepartments([]);
      return;
    }
    
    try {
      const res = await departmentService.getDepartmentsByCollege(parseInt(collegeId, 10));
      if (res.success) {
        const deptsArray: Department[] = Array.isArray(res.data) 
          ? res.data 
          : Array.isArray(res.data?.data) 
            ? res.data.data 
            : [];
        setDepartments(deptsArray);
      }
    } catch (err) {
      console.error('Error fetching departments:', err);
    }
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleteLoading(true);
      const res = await coursesService.deleteCourse(deleteTarget.id);
      if (res.success) {
        showToast(t('courses.deleteSuccess'), 'success');
        setDeleteTarget(null);
        fetchFilteredCourses();
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

  const canManage = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN' || user?.role === 'COLLEGE_ADMIN';
  const canDelete = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';

  return (
    <div className="section-gap animate-page">
      {toast && (
        <div className={`${toast.type === 'error' ? 'toast-error' : 'toast-success'}`}>
          <div className="flex items-center gap-2">
            {toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle size={18} />}
            <span className="font-medium">{toast.message}</span>
          </div>
        </div>
      )}
      <PageHeader 
        title={t('courses.title')}
        subtitle={t('COURSES.SUBTITLE')}
        action={canManage ? {
          label: t('courses.addCourse'),
          onClick: () => { setSelectedCourse(null); setIsModalOpen(true); }
        } : null}
      />

      <div className="flex flex-col gap-6">
        <Card noPadding className="border-none shadow-soft overflow-hidden">
          <div className="p-4 flex flex-wrap items-end gap-4">
            
            {/* Header */}
            <div className="flex items-center gap-2 ml-2">
              <Filter size={16} className="text-brand-primary-500" />
              <span className="font-black text-brand-text-primary dark:text-brand-text-main uppercase tracking-widest text-xs">
                {t('students.filters')}
              </span>
            </div>

            {/* Search */}
            <div className="flex flex-col gap-1 min-w-[200px] flex-1">
              <label className="label-stat">{t('COURSES.SEARCHCOURSE')}</label>
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-text-muted h-4 w-4 group-focus-within:text-brand-primary-500 transition-colors" />
                <Input
                  placeholder={t('COURSES.SEARCHPLACEHOLDER')}
                  className="pl-10 h-10 bg-surface-subtle dark:bg-surface-subtle border-none font-bold text-sm"
                  value={search}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setSearch(e.target.value); setPage(1); }}
                />
              </div>
            </div>

            {/* College */}
            <div className="flex flex-col gap-1 min-w-[180px]">
              <label className="label-stat">{t('auth.college')}</label>
              <select
                value={selectedCollege}
                onChange={handleCollegeChange}
                className="w-full h-10 px-4 bg-surface-subtle dark:bg-surface-subtle border-none rounded-xl text-xs font-black uppercase tracking-widest text-brand-text-primary dark:text-brand-text-main focus:ring-2 focus:ring-brand-primary-500/20 transition-all appearance-none cursor-pointer"
              >
                <option value="">{t('colleges.allColleges')}</option>
                {Array.isArray(colleges) && colleges.map(c => (
                  <option key={c.id} value={c.id}>{c.nameAr || c.name}</option>
                ))}
              </select>
            </div>

            {/* Department */}
            <div className="flex flex-col gap-1 min-w-[180px]">
              <label className="label-stat">{t('auth.department')}</label>
              <select
                value={selectedDept}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { setSelectedDept(e.target.value); setPage(1); }}
                disabled={!selectedCollege || departments.length === 0}
                className="w-full h-10 px-4 bg-surface-subtle dark:bg-surface-subtle border-none rounded-xl text-xs font-black uppercase tracking-widest text-brand-text-primary dark:text-brand-text-main focus:ring-2 focus:ring-brand-primary-500/20 transition-all appearance-none cursor-pointer disabled:opacity-50"
              >
                <option value="">{t('departments.allDepartments')}</option>
                {Array.isArray(departments) && departments.map(d => (
                  <option key={d.id} value={d.id}>{d.nameAr || d.name}</option>
                ))}
              </select>
            </div>

            {/* Reset Button */}
            <button
              onClick={resetFilters}
              className="h-10 px-4 text-[10px] font-black text-brand-primary-500 hover:opacity-70 transition-opacity uppercase tracking-widest self-end"
            >
              {t('COMMON.RESET')}
            </button>

          </div>
        </Card>

        <div className="w-full">
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
                        } : undefined
                    }
                  />
                ) : (
                  <>
                    <Table headers={[t('courses.courseCode'), t('courses.courseName'), t('auth.department'), t('courses.instructor'), t('courses.students'), t('common.actions')]}>
                      {(Array.isArray(courses) ? courses : []).map((course) => (
                        <TableRow key={course.id} className="hover:bg-surface-subtle dark:hover:bg-slate-800/50 transition-colors">
                          <TableCell className="font-black text-brand-navy-500 dark:text-brand-primary-400 tracking-widest text-xs uppercase">{course.courseCode}</TableCell>
                          <TableCell className="font-black text-brand-text-primary dark:text-brand-text-main tracking-tight">
                            <span className="truncate block max-w-[150px]">
                              {i18n.language === 'ar' ? (course.nameAr || course.name) : course.name}
                            </span>
                          </TableCell>
                          <TableCell className="label-stat max-w-[150px]">
                            <span className="truncate block max-w-[150px]">{course.department?.name || '-'}</span>
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
                              ...(canManage ? [{ label: t('common.edit'), icon: Edit2, variant: 'edit', onClick: () => { setSelectedCourse(course); setIsModalOpen(true); } }] : []),
                              ...(canDelete ? [{
                                label: t('common.delete'),
                                icon: Trash2,
                                variant: 'delete',
                                onClick: () => setDeleteTarget({ id: course.id, name: course.name }),
                              }] : []),
                            ]} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </Table>

                    <Pagination page={page} totalPages={totalPages} onPageChange={setPage} total={totalCourses} pageSize={10} />
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
          onSuccess={() => { setIsModalOpen(false); fetchFilteredCourses(); showToast(selectedCourse ? t('courses.updateSuccess') : t('courses.addSuccess'), 'success'); }}
        />
      )}
    </div>
  );
};

export default CoursesList;
