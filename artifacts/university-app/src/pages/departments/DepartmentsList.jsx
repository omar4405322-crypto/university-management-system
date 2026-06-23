// FIXED [Phase 7.4]: Delete confirmation modal
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import departmentService from '../../services/department.service';
import collegeService from '../../services/college.service';
import { useAuth } from '../../context/AuthContext';
import AddDepartmentModal from './AddDepartmentModal';
import EditDepartmentModal from './EditDepartmentModal';
import { Search, Plus, Edit2, Trash2, Layers, Building, Calendar, Loader2, AlertCircle, CheckCircle, ExternalLink } from 'lucide-react';
import { EmptyState } from '../../components/ui/EmptyState';
import { TruncatedText } from '../../components/ui/TruncatedText';
import { PageHeader } from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Badge from '../../components/ui/Badge';
import { useTranslation } from 'react-i18next';
import ConfirmDeleteModal from '../../components/ui/ConfirmDeleteModal';

const DepartmentsList = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialCollegeId = searchParams.get('collegeId') || '';
  
  const canManage = user?.role === 'SUPER_ADMIN' || user?.role === 'COLLEGE_ADMIN';
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isCollegeAdmin = user?.role === 'COLLEGE_ADMIN';
  
  const [departments, setDepartments] = useState([]);
  const [colleges, setColleges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCollegeId, setSelectedCollegeId] = useState(initialCollegeId);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [toast, setToast] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchDepartments = async () => {
    try {
      setLoading(true);
      const result = await departmentService.getDepartments();
      if (result.success) {
        setDepartments(result.data?.departments || result.data || []);
      }
    } catch (error) {
      console.error('Error fetching departments:', error);
      showToast(t('common.errorFetching'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchColleges = async () => {
    try {
      const result = await collegeService.getColleges();
      if (result.success) {
        setColleges(result.data?.colleges || result.data || []);
      }
    } catch (error) {
      console.error('Error fetching colleges:', error);
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

  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

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
    } catch (error) {
      showToast(error.response?.data?.message || t('departments.deleteError'), 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleEdit = (dept) => {
    setSelectedDepartment(dept);
    setIsEditModalOpen(true);
  };

  const filteredDepartments = Array.isArray(departments) ? departments.filter(dept => {
    const matchesSearch = dept.name.toLowerCase().includes(search.toLowerCase());
    const matchesCollege = selectedCollegeId === 'all' || selectedCollegeId === '' || dept.collegeId === parseInt(selectedCollegeId);
    return matchesSearch && matchesCollege;
  }) : [];

  return (
    <div className="section-gap animate-page">
      {/* Toast Notification */}
      {toast && (
        <div className={`${toast.type === 'error' ? 'toast-error' : 'toast-success'}`}>
          <div className="flex items-center gap-2">
            {toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle size={18} />}
            <span className="font-medium">{toast.message}</span>
          </div>
        </div>
      )}

      <PageHeader 
        title={t('departments.title')}
        subtitle={t('departments.subtitle')}
        action={canManage ? {
          label: t('departments.addDept'),
          onClick: () => setIsAddModalOpen(true)
        } : null}
      />

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-2xl border border-brand-border dark:border-brand-border shadow-soft">
        <div className="relative flex-grow md:max-w-md w-full group">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-text-muted group-focus-within:text-brand-primary-500 transition-colors" />
          <Input 
            placeholder={t('departments.searchPlaceholder')} 
            className="pl-11 h-11 w-full bg-surface-subtle dark:bg-surface-subtle border-none"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {!isCollegeAdmin && (
          <div className="relative md:max-w-xs w-full group">
            <Building className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-text-muted group-focus-within:text-brand-primary-500 transition-colors" />
            <select
              className="w-full h-11 pl-11 pr-10 bg-surface-subtle dark:bg-surface-subtle border-none rounded-xl text-sm font-bold text-brand-text-primary dark:text-brand-text-main focus:ring-2 focus:ring-brand-primary-500/20 transition-all appearance-none cursor-pointer"
              value={selectedCollegeId}
              onChange={(e) => setSelectedCollegeId(e.target.value)}
            >
              <option value="">{t('colleges.allColleges')}</option>
              {Array.isArray(colleges) && colleges.map(college => (
                <option key={college.id} value={college.id}>{college.name}</option>
              ))}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-brand-text-muted">
              <Layers size={14} />
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col justify-center items-center h-96 gap-4">
          <Loader2 className="animate-spin text-brand-primary-500" size={48} />
          <p className="text-caption">{t('common.loading')}</p>
        </div>
      ) : filteredDepartments.length === 0 ? (
        <EmptyState 
          icon={<Layers size={48} />}
          title={t('departments.noDepts')}
          subtitle={t('departments.noDeptsDesc')}
          action={canManage ? {
            label: t('departments.addDept'),
            onClick: () => setIsAddModalOpen(true)
          } : null}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredDepartments.map((dept) => (
            <Card key={dept.id} noPadding className="group border-none shadow-soft hover:-translate-y-2 duration-500 rounded-[2rem] overflow-hidden flex flex-col">
              <div className="p-8 flex-grow">
                <div className="flex justify-between items-start mb-6">
                  <div className="w-14 h-14 bg-brand-primary-50 dark:bg-brand-primary-900/10 rounded-2xl flex items-center justify-center text-brand-primary-500 group-hover:scale-110 group-hover:bg-brand-primary-500 group-hover:text-white transition-all duration-500 shadow-inner">
                    <Layers size={28} />
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
                  <p className="label-stat text-brand-primary-500">{dept.college?.name}</p>
                  <h3 className="text-2xl font-black text-brand-text-primary dark:text-brand-text-main tracking-tight group-hover:text-brand-primary-500 transition-colors duration-300">
                    <TruncatedText text={dept.name} />
                  </h3>
                  {dept.nameAr && (
                    <h4 className="text-xl text-brand-text-secondary font-arabic mt-1" dir="rtl">
                      <TruncatedText text={dept.nameAr} />
                    </h4>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-4 mt-8 pt-8 border-t border-brand-border dark:border-brand-border">
                  <div className="p-4 bg-surface-subtle dark:bg-slate-800/50 rounded-2xl text-center group-hover:bg-brand-navy-500 group-hover:text-white transition-colors duration-500">
                    <p className="label-stat mb-1 group-hover:text-brand-navy-100">{t('courses.title')}</p>
                    <p className="text-2xl font-black tracking-tighter">{dept._count?.courses || 0}</p>
                  </div>
                  <div className="p-4 bg-surface-subtle dark:bg-slate-800/50 rounded-2xl text-center group-hover:bg-brand-primary-500 group-hover:text-white transition-colors duration-500">
                    <p className="label-stat mb-1 group-hover:text-brand-primary-100">{t('students.title')}</p>
                    <p className="text-2xl font-black tracking-tighter">{dept._count?.students || 0}</p>
                  </div>
                </div>
              </div>

              <div className="px-8 py-5 bg-surface-subtle dark:bg-slate-800/30 border-t border-brand-border dark:border-brand-border mt-auto flex justify-between items-center">
                <button 
                  className="text-brand-primary-500 font-black text-[11px] uppercase tracking-widest hover:text-brand-primary-600 flex items-center gap-2 transition-colors"
                  onClick={() => navigate(`/departments/${dept.id}`)}
                >
                  {t('departments.manageCurriculum')} <ExternalLink size={14} className="rtl:-scale-x-100" />
                </button>
                <button 
                  className="text-brand-navy-500 dark:text-brand-text-main font-black text-[11px] uppercase tracking-widest hover:text-brand-primary-500 flex items-center gap-2 transition-colors"
                  onClick={() => navigate(`/schedules-management?departmentId=${dept.id}`)}
                >
                  <Calendar size={14} />
                  {t('SCHEDULES.TITLE')}
                </button>
              </div>
            </Card>
          ))}
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
    </div>
  );
};

export default DepartmentsList;
