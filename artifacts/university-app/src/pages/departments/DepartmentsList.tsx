// @ts-nocheck
// FIXED [Phase 7.4]: Delete confirmation modal
import React, { useState, useEffect, Suspense } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import departmentService from '../../services/department.service';
import collegeService from '../../services/college.service';
import { useAuth } from '../../context/AuthContext';
import AddDepartmentModal from './AddDepartmentModal';
import EditDepartmentModal from './EditDepartmentModal';
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  Layers,
  Building,
  Calendar,
  Loader2,
  AlertCircle,
  CheckCircle,
  ExternalLink,
  ChevronDown,
  Users,
  BookOpen
} from 'lucide-react';
import FilterBar from '../../components/ui/FilterBar';
import { EmptyState } from '../../components/ui/EmptyState';
import { TruncatedText } from '../../components/ui/TruncatedText';
import { PageHeader } from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Drawer from '../../components/ui/Drawer';
const DepartmentDetails = React.lazy(() => import('./DepartmentDetails'));
import Button from '../../components/ui/button';
import ViewManager from '../../components/ui/ViewManager';
import { useSavedViews, SavedView } from '../../hooks/useSavedViews';
import { useDepartments } from '../../hooks/useDepartments';

const defaultView: SavedView = {
  id: 'default',
  name: 'departments.defaultView',
  isDefault: true,
  filters: { collegeId: '', sortBy: 'name' },
  search: '',
  density: 'comfortable',
  pageSize: 10,
};
import Input from '../../components/ui/input';
import Badge from '../../components/ui/Badge';
import { useTranslation } from 'react-i18next';
import ConfirmDeleteModal from '../../components/ui/ConfirmDeleteModal';
import { Select } from '../../components/ui/Select';
import { logger } from '../../lib/logger';
import { useToast } from '../../context/ToastContext';

const DepartmentsList = () => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialCollegeId = searchParams.get('collegeId') || '';

  const canManage = user?.role === 'SUPER_ADMIN' || user?.role === 'COLLEGE_ADMIN';
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isCollegeAdmin = user?.role === 'COLLEGE_ADMIN';


  const [colleges, setColleges] = useState([]);

  const { views, activeView, activeViewId, setActiveViewId, saveView, deleteView, setDefaultView, updateActiveView } = useSavedViews('departments_views', defaultView);
  const { data: departments, loading, error, search, setSearch, page, setPage, total, refetch } = useDepartments({ initialSearch: activeView?.search || '', limit: activeView?.pageSize || 10 });
  const limit = activeView?.pageSize || 10;
  const totalPages = Math.ceil(total / limit);
  const totalRecords = total;
  const fetchDepartments = refetch;


  const [selectedCollegeId, setSelectedCollegeId] = useState(activeView.filters?.collegeId || initialCollegeId);
  const [sortBy, setSortBy] = useState<'name' | 'students' | 'courses'>(activeView.filters?.sortBy || 'name');

  const handleSelectView = (viewId: string) => {
    if (viewId === activeViewId) {
      const view = views.find((v) => v.id === viewId);
      if (view) {
        setSearch(view.search || '');
        setSortBy(view.filters?.sortBy || 'name');
        if (!isCollegeAdmin) {
          setSelectedCollegeId(view.filters?.collegeId || '');
        }
      }
    } else {
      setActiveViewId(viewId);
    }
  };

  useEffect(() => {
    setSearch(activeView.search || '');
    setSortBy(activeView.filters?.sortBy || 'name');
    if (!isCollegeAdmin) {
      setSelectedCollegeId(activeView.filters?.collegeId !== undefined ? activeView.filters.collegeId : initialCollegeId);
    }
  }, [activeViewId, isCollegeAdmin]);

  useEffect(() => {
    updateActiveView({
      search,
      filters: { ...activeView.filters, collegeId: selectedCollegeId, sortBy },
    });
  }, [search, selectedCollegeId, sortBy]);

  useEffect(() => {
    const mainEl = document.querySelector('main');
    if (mainEl) {
      mainEl.classList.add('bg-slate-50', 'dark:bg-slate-900');
      return () => {
        mainEl.classList.remove('bg-slate-50', 'dark:bg-slate-900');
      };
    }
  }, []);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [activeDrawerId, setActiveDrawerId] = useState<string | null>(null);
  const { showToast } = useToast();



  const fetchColleges = async () => {
    try {
      const result = await collegeService.getColleges();
      if (result.success) {
        setColleges(result.data?.colleges || result.data || []);
      }
    } catch (error: any) {
      logger.error('Error fetching colleges:', error);
    }
  };

  useEffect(() => {
    // If user is college or department admin, apply scope
    if (user?.role === 'COLLEGE_ADMIN' && user?.managedCollegeId) {
      setSelectedCollegeId(String(user.managedCollegeId));
      fetchDepartments(user.managedCollegeId);
    } else if (user?.role === 'DEPARTMENT_ADMIN' && user?.managedDepartmentId) {
      // If department admin, show only their department
      setSelectedCollegeId('');
      setDepartments([]);
      // Optionally, fetch single department data
    } else {
      fetchDepartments();
      fetchColleges();
    }
  }, []);


  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleteLoading(true);
      const result = await departmentService.deleteDepartment(deleteTarget.id);
      if (result.success) {
        showToast(t('departments.deleteSuccess'), 'success');
        setDeleteTarget(null);
        fetchDepartments();
      }
    } catch (error: any) {
      showToast(error.response?.data?.message || t('departments.deleteError'), 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleEdit = (dept) => {
    setSelectedDepartment(dept);
    setIsEditModalOpen(true);
  };

  const filteredDepartments = (Array.isArray(departments) ? departments : []).filter((dept) => {
    const matchesSearch = 
      (dept.name?.toLowerCase().includes(search.toLowerCase())) ||
      (dept.nameAr?.toLowerCase().includes(search.toLowerCase()));
    const matchesCollege = selectedCollegeId ? String(dept.collegeId) === selectedCollegeId : true;
    return matchesSearch && matchesCollege;
  });

  const isDirty = search !== (activeView.search || '') ||
                  selectedCollegeId !== (activeView.filters?.collegeId || '') ||
                  sortBy !== (activeView.filters?.sortBy || 'name');



  const sortedDepartments = [...filteredDepartments].sort((a, b) => {
    if (sortBy === 'students') return (b._count?.students ?? 0) - (a._count?.students ?? 0);
    if (sortBy === 'courses')  return (b._count?.courses  ?? 0) - (a._count?.courses  ?? 0);
    return (isRTL ? a.nameAr || a.name : a.name).localeCompare(
             isRTL ? b.nameAr || b.name : b.name, isRTL ? 'ar' : 'en');
  });



  return (
    <div className="section-gap animate-page">
      {/* Toast Notification */}


      <PageHeader
        title={t('departments.title')}
        subtitle={t('departments.subtitle')}
        action={canManage ? {
          label: t('departments.addDept'),
          onClick: () => setIsAddModalOpen(true),
          icon: Plus,
          className: "!bg-[#84cc16] !text-white !rounded-lg hover:!bg-[#65a30d] hover:!scale-[1.02] active:!bg-[#4d7c0f] active:!scale-[0.98] transition-all duration-200 border-none shadow-none",
        } : undefined}
      />

      <Card className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-0 mb-6">
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder={t('departments.searchPlaceholder')}
          onClear={search || selectedCollegeId ? () => { setSearch(''); setSelectedCollegeId(''); } : undefined}
        >
          {/* College filter — hidden for college admins */}
          {!isCollegeAdmin && (
            <select
              value={selectedCollegeId}
              onChange={e => setSelectedCollegeId(e.target.value)}
              className="h-10 px-4 bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-brand-text-primary dark:text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 transition-all cursor-pointer flex-shrink-0"
            >
              <option value="">{t('colleges.allColleges')}</option>
              {Array.isArray(colleges) && colleges.map(c => (
                <option key={c.id} value={c.id}>
                  {isRTL ? c.nameAr || c.name : c.name}
                </option>
              ))}
            </select>
          )}

          {/* Sort select */}
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
            className="h-10 px-4 bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-brand-text-primary dark:text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 transition-all cursor-pointer flex-shrink-0"
          >
            <option value="name">{t('departments.sortByName', 'Sort: Name')}</option>
            <option value="students">{t('departments.sortByStudents', 'Sort: Students')}</option>
            <option value="courses">{t('departments.sortByCourses', 'Sort: Courses')}</option>
          </select>

          {/* ViewManager stays */}
          <ViewManager
            views={views}
            activeViewId={activeViewId}
            onSelectView={handleSelectView}
            onSaveView={saveView}
            onDeleteView={deleteView}
            onSetDefault={setDefaultView}
            isDirty={isDirty}
            currentViewState={{
              search,
              filters: { collegeId: selectedCollegeId, sortBy },
              density: activeView.density,
              pageSize: 10
            }}
          />
        </FilterBar>
      </Card>

      {loading ? (
        <div className="flex flex-col justify-center items-center h-96 gap-4">
          <Loader2 className="animate-spin text-brand-brand-green-dark" size={48} />
          <p className="text-caption">{t('common.loading')}</p>
        </div>
      ) : filteredDepartments.length === 0 ? (
        <EmptyState
          icon={<Layers size={48} />}
          title={t('departments.noDepts')}
          subtitle={t('departments.noDeptsDesc')}
          action={
            canManage
              ? {
                label: t('departments.addDept'),
                onClick: () => setIsAddModalOpen(true),
              }
              : null
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {(() => {
            return sortedDepartments.map((dept, index) => {
              const isNew = (dept._count?.students ?? 0) === 0 && (dept._count?.courses ?? 0) === 0;

              return (
                <Card
                  key={dept.id}
                  onClick={() => setActiveDrawerId(dept.id)}
                  className={`relative bg-white dark:bg-slate-800 rounded-2xl border border-slate-200
                              dark:border-slate-700 shadow-sm overflow-hidden cursor-pointer
                              hover:-translate-y-1 hover:border-brand-primary-500/40 hover:shadow-[0_8px_30px_rgba(132,189,58,0.12)] transition-all duration-200 group`}>



                  <div className={activeView.density === 'compact' ? 'p-5 pt-8' : 'p-6 pt-8'}>

                    {/* Header row: icon + actions */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="rounded-2xl p-3 bg-brand-primary-500/10 text-brand-primary-600 flex-shrink-0">
                        <Layers className="w-6 h-6 text-brand-primary-600" />
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {/* NEW badge */}
                        {isNew && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-brand-primary-500/10 text-brand-primary-600 me-2">
                            جديد
                          </span>
                        )}
                        {canManage && (
                          <>
                            <button
                              onClick={e => { e.stopPropagation(); handleEdit(dept); }}
                              title="تعديل"
                              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            {isSuperAdmin && (
                              <button
                                onClick={e => { e.stopPropagation(); setDeleteTarget({ id: dept.id, name: dept.name }); }}
                                title="حذف"
                                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* College badge */}
                    <div className="mb-3">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-brand-navy-500/5 text-brand-navy-600 dark:bg-brand-navy-500/20 dark:text-brand-navy-400">
                        <Building className="w-3 h-3" />
                        {isRTL ? dept.college?.nameAr || dept.college?.name : dept.college?.name}
                      </span>
                    </div>

                    {/* Department names — Swaps dynamically based on active language */}
                    <div className="mb-4">
                      <h3 className="text-lg font-black text-brand-text-primary dark:text-white leading-tight mb-0.5">
                        {isRTL ? dept.nameAr || dept.name : dept.name}
                      </h3>
                      <p className="text-xs text-brand-text-secondary dark:text-slate-400 font-medium">
                        {isRTL ? dept.name : dept.nameAr || ''}
                      </p>
                    </div>

                    {/* Stats row */}
                    <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-100 dark:border-slate-700/50">
                      <Link
                        to={`/students?departmentId=${dept.id}`}
                        onClick={e => e.stopPropagation()}
                        className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group/stat">
                        <div className="flex items-center gap-1 text-slate-400">
                          <Users className="w-3.5 h-3.5" />
                          <span className="text-xs font-medium">{t('departments.students', 'Students')}</span>
                        </div>
                        <span className="text-xl font-black text-brand-text-primary dark:text-white">
                          {dept._count?.students ?? 0}
                        </span>
                      </Link>

                      <Link
                        to={`/courses?departmentId=${dept.id}`}
                        onClick={e => e.stopPropagation()}
                        className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors border-x border-slate-100 dark:border-slate-700/50">
                        <div className="flex items-center gap-1 text-slate-400">
                          <BookOpen className="w-3.5 h-3.5" />
                          <span className="text-xs font-medium">{t('departments.courses', 'Courses')}</span>
                        </div>
                        <span className="text-xl font-black text-brand-text-primary dark:text-white">
                          {dept._count?.courses ?? 0}
                        </span>
                      </Link>

                      <div className="flex flex-col items-center gap-1 p-2">
                        <div className="flex items-center gap-1 text-slate-400">
                          <Users className="w-3.5 h-3.5" />
                          <span className="text-xs font-medium">{t('departments.doctors', 'Doctors')}</span>
                        </div>
                        <span className="text-xl font-black text-brand-text-primary dark:text-white">
                          {dept._count?.doctors ?? 0}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Footer — actions dropdown replaced with icon buttons */}
                  <div className="px-5 py-3 bg-slate-50 dark:bg-slate-900/30 border-t border-slate-100 dark:border-slate-700/50 flex items-center justify-between gap-2">
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        navigate(`/courses?departmentId=${dept.id}`);
                      }}
                      className="flex items-center gap-1.5 text-xs font-semibold text-brand-primary-600 hover:text-brand-primary-700 transition-colors">
                      <Layers className="w-3.5 h-3.5" />
                      {t('departments.manageCurriculum', 'Curriculum')}
                    </button>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        navigate(`/schedules/timetable?departmentId=${dept.id}&collegeId=${dept.collegeId || ''}`);
                      }}
                      className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
                      <Calendar className="w-3.5 h-3.5" />
                      {t('departments.schedules', 'Schedules')}
                    </button>
                  </div>
                </Card>
              );
            });
          })()}
        </div>
      )}



      <ConfirmDeleteModal
        isOpen={Boolean(deleteTarget)}
        itemName={deleteTarget?.name}
        onClose={() => !deleteLoading && setDeleteTarget(null)}
        onConfirm={confirmDelete}
        loading={deleteLoading}
      />

      <AddDepartmentModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        colleges={colleges}
        onSuccess={() => {
          setIsAddModalOpen(false);
          fetchDepartments();
          showToast(t('departments.createSuccess'), 'success');
        }}
      />

      {isEditModalOpen && (
        <EditDepartmentModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedDepartment(null);
          }}
          department={selectedDepartment}
          colleges={colleges}
          onSuccess={() => {
            setIsEditModalOpen(false);
            setSelectedDepartment(null);
            fetchDepartments();
            showToast(t('departments.updateSuccess'), 'success');
          }}
        />
      )}

      <Drawer
        isOpen={Boolean(activeDrawerId)}
        onClose={() => setActiveDrawerId(null)}
        width="max-w-4xl"
      >
        {activeDrawerId && (
          <Suspense fallback={<div className="flex justify-center p-12"><Loader2 className="animate-spin text-brand-brand-green-dark" size={32} /></div>}>
            <DepartmentDetails departmentId={activeDrawerId} isDrawerMode />
          </Suspense>
        )}
      </Drawer>
    </div>
  );
};

export default DepartmentsList;
