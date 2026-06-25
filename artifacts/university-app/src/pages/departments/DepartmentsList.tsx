// @ts-nocheck
// FIXED [Phase 7.4]: Delete confirmation modal
import React, { useState, useEffect, Suspense } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
} from 'lucide-react';
import { EmptyState } from '../../components/ui/EmptyState';
import { TruncatedText } from '../../components/ui/TruncatedText';
import { PageHeader } from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Checkbox from '../../components/ui/Checkbox';
import BulkActionToolbar from '../../components/ui/BulkActionToolbar';
import Drawer from '../../components/ui/Drawer';
const DepartmentDetails = React.lazy(() => import('./DepartmentDetails'));
import Button from '../../components/ui/Button';
import ViewManager from '../../components/ui/ViewManager';
import { useSavedViews, SavedView } from '../../hooks/useSavedViews';
import { useDepartments } from '../../hooks/useDepartments';
import Input from '../../components/ui/Input';
import Badge from '../../components/ui/Badge';
import { useTranslation } from 'react-i18next';
import ConfirmDeleteModal from '../../components/ui/ConfirmDeleteModal';
import { Select } from '../../components/ui/Select';
import { logger } from '../../lib/logger';
import { useToast } from '../../context/ToastContext';

const defaultView: SavedView = {
  id: 'default',
  name: 'Default View',
  isDefault: true,
  filters: { collegeId: '' },
  search: '',
  density: 'comfortable',
  pageSize: 10,
};


const DepartmentsList = () => {
  const { t } = useTranslation();
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
  
  useEffect(() => {
    setSearch(activeView.search || '');
    if (!isCollegeAdmin) {
      setSelectedCollegeId(activeView.filters?.collegeId || initialCollegeId);
    }
  }, [activeViewId, isCollegeAdmin]);

  useEffect(() => {
    updateActiveView({
      search,
      filters: { ...activeView.filters, collegeId: selectedCollegeId },
    });
  }, [search, selectedCollegeId]);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
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
    const matchesSearch = dept.name?.toLowerCase().includes(search.toLowerCase());
    const matchesCollege = selectedCollegeId ? String(dept.collegeId) === selectedCollegeId : true;
    return matchesSearch && matchesCollege;
  });

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const newIds = new Set(selectedIds);
      filteredDepartments.forEach((d) => newIds.add(d.id));
      setSelectedIds(Array.from(newIds));
    } else {
      const visibleIds = filteredDepartments.map((d) => d.id);
      setSelectedIds(selectedIds.filter((id) => !visibleIds.includes(id)));
    }
  };

  const handleSelectOne = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleBulkClear = () => setSelectedIds([]);
  const handleBulkExport = () => { /* No-op for Phase 2 UI */ };
  const handleBulkDelete = () => { setSelectedIds([]); };

  const visibleIds = filteredDepartments.map((d) => d.id);
  const isAllVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

  return (
    <div className="section-gap animate-page">
      {/* Toast Notification */}
      

      <PageHeader
        title={t('departments.title')}
        subtitle={t('departments.subtitle')}
        action={
          canManage
            ? {
                label: t('departments.addDept'),
                onClick: () => setIsAddModalOpen(true),
              }
            : null
        }
      />

      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-2xl border border-brand-border dark:border-brand-border shadow-soft">
          <div className="relative flex-grow md:max-w-md w-full group">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-text-muted group-focus-within:text-brand-primary-600 transition-colors" />
          <Input
            placeholder={t('departments.searchPlaceholder')}
            className="pl-11 h-11 w-full bg-surface-subtle dark:bg-surface-subtle border-none"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {!isCollegeAdmin && (
          <div className="relative md:max-w-xs w-full group">
            <Building className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-text-muted group-focus-within:text-brand-primary-600 transition-colors" />
            <Select
              
              value={selectedCollegeId}
              onChange={(e) => setSelectedCollegeId(e.target.value)}
            >
              <option value="">{t('colleges.allColleges')}</option>
              {Array.isArray(colleges) &&
                colleges.map((college) => (
                  <option key={college.id} value={college.id}>
                    {college.name}
                  </option>
                ))}
            </Select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-brand-text-muted">
              <Layers size={14} />
            </div>
          </div>
        )}
          <div className="flex items-center gap-3">
            <Checkbox checked={isAllVisibleSelected} onChange={handleSelectAll} id="selectAllDepts" />
            <label htmlFor="selectAllDepts" className="text-sm font-bold text-brand-text-secondary cursor-pointer">
              {t('common.selectAll', 'Select All')}
            </label>
          </div>
        </div>
        
        <div className="flex items-center gap-4 bg-surface-subtle dark:bg-slate-900 p-3 rounded-2xl border border-brand-border dark:border-brand-border">
          <ViewManager
            views={views}
            activeViewId={activeViewId}
            onSelectView={setActiveViewId}
            onSaveView={saveView}
            onDeleteView={deleteView}
            onSetDefault={setDefaultView}
            currentViewState={{
              search,
              filters: { collegeId: selectedCollegeId },
              density: activeView.density,
              pageSize: 10
            }}
          />
          <div className="h-6 w-px bg-brand-border dark:bg-brand-border mx-2" />
          <div className="flex items-center gap-2">
            <button
              onClick={() => updateActiveView({ density: 'comfortable' })}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                activeView.density === 'comfortable'
                  ? 'bg-brand-primary-600 text-white'
                  : 'text-brand-text-secondary hover:bg-brand-bg-page/50'
              }`}
            >
              Comfortable
            </button>
            <button
              onClick={() => updateActiveView({ density: 'compact' })}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                activeView.density === 'compact'
                  ? 'bg-brand-primary-600 text-white'
                  : 'text-brand-text-secondary hover:bg-brand-bg-page/50'
              }`}
            >
              Compact
            </button>
          </div>
        </div>
      </div>

            {loading ? (
        <div className="flex flex-col justify-center items-center h-96 gap-4">
          <Loader2 className="animate-spin text-brand-primary-600" size={48} />
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
          {filteredDepartments.map((dept) => {
            const isSelected = selectedIds.includes(dept.id);
            const isCompact = activeView.density === 'compact';
            
            return (
            <Card
              key={dept.id}
              noPadding
              className={`group border-none shadow-soft hover:-translate-y-2 duration-500 overflow-hidden flex flex-col ${
                isSelected ? 'ring-2 ring-brand-primary-600 bg-brand-primary-600/5' : ''
              } ${isCompact ? 'rounded-2xl' : 'rounded-[2rem]'}`}
            >
              <div className={`flex-grow relative ${isCompact ? 'p-5' : 'p-8'}`}>
                <div className={`absolute ${isCompact ? 'top-4 left-4 rtl:left-auto rtl:right-4' : 'top-6 left-6 rtl:left-auto rtl:right-6'}`}>
                  <Checkbox checked={isSelected} onChange={() => handleSelectOne(dept.id)} />
                </div>
                <div className={`flex justify-between items-start ${isCompact ? 'mb-4' : 'mb-6'}`}>
                  <div className={`${isCompact ? 'w-10 h-10 ml-6' : 'w-14 h-14 ml-8'} rtl:mr-8 rtl:ml-0 bg-brand-primary-50 dark:bg-brand-primary-900/10 rounded-2xl flex items-center justify-center text-brand-primary-600 group-hover:scale-110 group-hover:bg-brand-primary-600 group-hover:text-white transition-all duration-500 shadow-inner`}>
                    <Layers size={isCompact ? 20 : 28} />
                  </div>
                  {canManage && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(dept)}
                        className="p-2.5 text-brand-text-muted hover:text-info hover:bg-blue-50 dark:hover:bg-blue-900/10 rounded-xl transition-all"
                        title={t('common.edit')}
                      >
                        <Edit2 size={18} />
                      </button>
                      {isSuperAdmin && (
                        <button
                          onClick={() => setDeleteTarget({ id: dept.id, name: dept.name })}
                          className="p-2.5 text-brand-text-muted hover:text-error hover:bg-rose-50 dark:bg-rose-900/20 dark:hover:bg-rose-900/10 rounded-xl transition-all"
                          title={t('common.delete')}
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <p className="label-stat text-brand-primary-600">{dept.college?.name}</p>
                  <h3 className={`${isCompact ? 'text-xl' : 'text-2xl'} font-black text-brand-text-primary dark:text-brand-text-main tracking-tight group-hover:text-brand-primary-600 transition-colors duration-300`}>
                    <TruncatedText text={dept.name} />
                  </h3>
                  {dept.nameAr && (
                    <h4 className={`${isCompact ? 'text-lg' : 'text-xl'} text-brand-text-secondary font-arabic mt-1`} dir="rtl">
                      <TruncatedText text={dept.nameAr} />
                    </h4>
                  )}
                </div>

                <div className={`grid grid-cols-2 gap-4 ${isCompact ? 'mt-4 pt-4' : 'mt-8 pt-8'} border-t border-brand-border dark:border-brand-border`}>
                  <div className={`${isCompact ? 'p-2' : 'p-4'} bg-surface-subtle dark:bg-slate-800/50 rounded-2xl text-center group-hover:bg-brand-navy-500 group-hover:text-white transition-colors duration-500`}>
                    <p className="label-stat mb-1 group-hover:text-brand-navy-100">
                      {t('courses.title')}
                    </p>
                    <p className={`${isCompact ? 'text-xl' : 'text-2xl'} font-black tracking-tighter`}>
                      {dept._count?.courses || 0}
                    </p>
                  </div>
                  <div className={`${isCompact ? 'p-2' : 'p-4'} bg-surface-subtle dark:bg-slate-800/50 rounded-2xl text-center group-hover:bg-brand-primary-600 group-hover:text-white transition-colors duration-500`}>
                    <p className="label-stat mb-1 group-hover:text-brand-primary-100">
                      {t('students.title')}
                    </p>
                    <p className={`${isCompact ? 'text-xl' : 'text-2xl'} font-black tracking-tighter`}>
                      {dept._count?.students || 0}
                    </p>
                  </div>
                </div>
              </div>

              <div className="px-8 py-5 bg-surface-subtle dark:bg-slate-800/30 border-t border-brand-border dark:border-brand-border mt-auto flex justify-between items-center">
                <button
                  className="text-brand-primary-600 font-black text-[11px] uppercase tracking-widest hover:text-brand-primary-600 flex items-center gap-2 transition-colors"
                  onClick={() => setActiveDrawerId(dept.id)}
                >
                  {t('departments.manageCurriculum')}{' '}
                  <ExternalLink size={14} className="rtl:-scale-x-100" />
                </button>
                <button
                  className="text-brand-navy-500 dark:text-brand-text-main font-black text-[11px] uppercase tracking-widest hover:text-brand-primary-600 flex items-center gap-2 transition-colors"
                  onClick={() => navigate(`/schedules-management?departmentId=${dept.id}`)}
                >
                  <Calendar size={14} />
                  {t('SCHEDULES.TITLE')}
                </button>
              </div>
            </Card>
            );
          })}
        </div>
      )}

      <BulkActionToolbar
        selectedCount={selectedIds.length}
        onClear={handleBulkClear}
        onExport={handleBulkExport}
        onDelete={handleBulkDelete}
      />

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
          <Suspense fallback={<div className="flex justify-center p-12"><Loader2 className="animate-spin text-brand-primary-600" size={32} /></div>}>
            <DepartmentDetails departmentId={activeDrawerId} isDrawerMode />
          </Suspense>
        )}
      </Drawer>
    </div>
  );
};

export default DepartmentsList;
