// FIXED: Department route + breadcrumbs - Phase 1 / Phase 6
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Building2, 
  Users, 
  GraduationCap, 
  Layers, 
  ArrowLeft,
  Settings,
  Plus,
  Edit2,
  Trash2,
  Info,
  Calendar,
  AlertCircle,
  CheckCircle,
  Loader2,
  ExternalLink,
  UserPlus
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Table, { TableRow, TableCell, ActionMenu } from '../../components/ui/Table';
import collegeService from '../../services/college.service';
import departmentService from '../../services/department.service';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import AddDepartmentModal from '../departments/AddDepartmentModal';
import EditCollegeModal from './EditCollegeModal';
import AssignAdminModal from './AssignAdminModal';
import Breadcrumbs from '../../components/ui/Breadcrumbs';

const CollegeDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const [college, setCollege] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAddDeptModalOpen, setIsAddDeptModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAssignAdminModalOpen, setIsAssignAdminModalOpen] = useState(false);
  const [toast, setToast] = useState(null);

  const canManage = ['SUPER_ADMIN', 'ADMIN'].includes(user?.role);

  useEffect(() => {
    fetchCollegeDetails();
  }, [id]);

  const fetchCollegeDetails = async () => {
    try {
      setLoading(true);
      const result = await collegeService.getCollegeById(id);
      if (result.success) {
        setCollege(result.data);
      }
    } catch (error) {
      console.error('Error fetching college details:', error);
      showToast(t('common.errorFetching'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleDeleteDept = async (deptId) => {
    if (window.confirm(t('departments.deleteConfirm'))) {
      try {
        const result = await departmentService.deleteDepartment(deptId);
        if (result.success) {
          showToast(t('departments.deleteSuccess'), 'success');
          fetchCollegeDetails();
        }
      } catch (error) {
        showToast(error.response?.data?.message || t('departments.deleteError'), 'error');
      }
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <Loader2 className="animate-spin text-brand-green" size={48} />
        <p className="text-brand-text-sub font-bold uppercase tracking-widest text-sm">{t('common.loading')}</p>
      </div>
    );
  }

  if (!college) {
    return (
      <div className="text-center py-20 bg-brand-bg-card rounded-3xl border border-brand-border">
        <div className="h-20 w-20 rounded-full bg-brand-navy/5 flex items-center justify-center mx-auto mb-6">
          <AlertCircle size={40} className="text-brand-text-muted" />
        </div>
        <h2 className="text-2xl font-bold text-brand-text-main">{t('colleges.notFound') || 'College not found'}</h2>
        <Button variant="outline" className="mt-6 border-brand-border" onClick={() => navigate('/colleges')}>
          <ArrowLeft size={18} className="rtl:-scale-x-100 mr-2" /> {t('common.back')}
        </Button>
      </div>
    );
  }

  const breadcrumbItems = [
    { label: t('nav.colleges'), link: '/colleges' },
    { label: college.name },
  ];

  return (
    <div className="pt-6 pb-6 animate-in fade-in duration-500">
      <Breadcrumbs items={breadcrumbItems} />
      {/* Toast Notification */}
      {toast && (
        <div className={`${toast.type === 'error' ? 'toast-error' : 'toast-success'}`}>
          <div className="flex items-center gap-2">
            {toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle size={18} />}
            <span className="font-medium">{toast.message}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-brand-bg-card p-6 rounded-3xl border border-brand-border shadow-soft">
        <div className="flex items-center gap-6">
          <button 
            onClick={() => navigate('/colleges')}
            className="p-3 text-brand-text-sub hover:text-brand-green hover:bg-brand-green/10 rounded-2xl transition-all duration-300 group"
          >
            <ArrowLeft size={24} className="rtl:-scale-x-100 group-hover:-translate-x-1 transition-transform" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-black text-brand-text-main">{college.name}</h1>
              <Badge variant="success" className="px-3 py-1 font-bold">{t('colleges.active')}</Badge>
            </div>
            {college.nameAr && (
              <p className="text-xl text-brand-text-sub mt-1 font-arabic" dir="rtl">{college.nameAr}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {canManage && (
            <Button 
              variant="outline" 
              className="flex items-center gap-2 border-brand-border hover:bg-brand-navy/5 text-brand-text-main font-bold"
              onClick={() => navigate(`/schedules-management?collegeId=${college.id}`)}
            >
              <Calendar size={18} className="text-brand-green" /> {t('nav.schedule')}
            </Button>
          )}

          {/* Settings (SUPER_ADMIN only) */}
          {user?.role === 'SUPER_ADMIN' && (
            <Button variant="outline" className="p-2.5 border-brand-border hover:bg-brand-navy/5 text-brand-text-main" onClick={() => setIsEditModalOpen(true)}>
              <Settings size={20} />
            </Button>
          )}

          {/* Add Department follows existing canManage rule */}
          {canManage && (
            <Button className="flex items-center gap-2 shadow-xl shadow-brand-green/20 font-bold" onClick={() => setIsAddDeptModalOpen(true)}>
              <Plus size={18} /> {t('departments.addDept')}
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="flex items-center gap-5 border-l-4 border-brand-navy/30 hover:translate-y-[-4px] transition-all duration-300">
          <div className="p-4 bg-brand-navy/10 text-brand-navy rounded-2xl">
            <Layers size={28} strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-xs font-black text-brand-text-muted uppercase tracking-widest">{t('nav.departments')}</p>
            <h3 className="text-3xl font-bold text-brand-text-main mt-1">{college._count?.departments || 0}</h3>
          </div>
        </Card>
        <Card className="flex items-center gap-5 border-l-4 border-brand-green/30 hover:translate-y-[-4px] transition-all duration-300">
          <div className="p-4 bg-brand-green/10 text-brand-green rounded-2xl">
            <Users size={28} strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-xs font-black text-brand-text-muted uppercase tracking-widest">{t('nav.students')}</p>
            <h3 className="text-3xl font-bold text-brand-text-main mt-1">{college._count?.students || 0}</h3>
          </div>
        </Card>
        <Card className="flex items-center gap-5 border-l-4 border-brand-yellow/30 hover:translate-y-[-4px] transition-all duration-300">
          <div className="p-4 bg-brand-yellow/10 text-brand-yellow rounded-2xl">
            <GraduationCap size={28} strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-xs font-black text-brand-text-muted uppercase tracking-widest">{t('nav.doctors')}</p>
            <h3 className="text-3xl font-bold text-brand-text-main mt-1">{college._count?.doctors || 0}</h3>
          </div>
        </Card>
      </div>

      {/* Assigned Admin Section */}
      {user?.role === 'SUPER_ADMIN' && (
        <Card className="mt-6 border-l-4 border-brand-primary-500/50">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h3 className="text-lg font-black text-brand-text-main mb-4 flex items-center gap-2">
                <UserPlus size={20} className="text-brand-primary-500" />
                {t('colleges.assignedAdmin') || 'Assigned Admin'}
              </h3>
              {college.assignedAdmin ? (
                <div className="bg-brand-navy/5 rounded-lg p-4 border border-brand-border">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-bold text-brand-text-secondary mb-1 uppercase tracking-widest">{t('common.name')}</p>
                      <p className="font-bold text-brand-text-main">{college.assignedAdmin.name || college.assignedAdmin.email}</p>
                      <p className="text-sm text-brand-text-sub mt-2">{college.assignedAdmin.email}</p>
                    </div>
                    <Button
                      variant="outline"
                      className="flex items-center gap-2"
                      onClick={() => setIsAssignAdminModalOpen(true)}
                    >
                      <Edit2 size={16} />
                      {t('common.change')}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 border border-yellow-200 dark:border-yellow-800">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <AlertCircle size={20} className="text-yellow-600 dark:text-yellow-400" />
                      <span className="font-semibold text-yellow-800 dark:text-yellow-200">{t('colleges.noAdminAssigned') || 'No admin assigned to this college'}</span>
                    </div>
                    <Button
                      variant="primary"
                      className="flex items-center gap-2"
                      onClick={() => setIsAssignAdminModalOpen(true)}
                    >
                      <UserPlus size={16} />
                      {t('colleges.assignAdmin') || 'Assign Admin'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-5 xl:gap-6">
        <div className="lg:col-span-1">
        </div>
        <div className="lg:col-span-2 xl:col-span-3">
          <Card className="border-l-0" title={t('nav.departments')} noPadding>
            <div className="h-auto">
              {college.departments?.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-96 text-center p-8">
                  <div className="h-20 w-20 rounded-full bg-brand-navy/5 flex items-center justify-center mb-4 border border-brand-border">
                    <Layers size={40} className="text-brand-text-muted" />
                  </div>
                  <p className="text-lg font-black text-brand-text-main">{t('departments.noDepts')}</p>
                  <p className="text-sm text-brand-text-sub max-w-xs mx-auto mt-1 font-bold">{t('departments.noDeptsDesc')}</p>
                  {canManage && (
                    <Button onClick={() => setIsAddDeptModalOpen(true)} className="mt-6 flex items-center gap-2">
                      <Plus size={18} /> {t('departments.addDept')}
                    </Button>
                  )}
                </div>
              ) : (
                <Table headers={[t('departments.nameEn'), t('departments.nameAr'), t('courses.title'), t('nav.students'), t('common.actions')]} className="w-full">
                  {college.departments.map((dept, idx) => (
                    <TableRow key={dept.id} className="cursor-pointer" onClick={() => navigate(`/departments/${dept.id}`)}>
                      <TableCell className="font-black text-brand-text-main">{dept.name}</TableCell>
                      <TableCell className="font-arabic text-brand-text-sub" dir="rtl">{dept.nameAr || '--'}</TableCell>
                      <TableCell>
                        <Badge variant="info" className="font-black px-3">{dept._count?.courses || 0}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 font-bold text-brand-text-main">
                          <Users size={14} className="text-brand-green" />
                          {dept._count?.students || 0}
                        </div>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <ActionMenu actions={[
                          { label: 'View Department', icon: ExternalLink, variant: 'view', onClick: () => navigate(`/departments/${dept.id}`) },
                          ...(canManage ? [{ label: 'Delete', icon: Trash2, variant: 'delete', onClick: () => handleDeleteDept(dept.id) }] : []),
                        ]} />
                      </TableCell>
                    </TableRow>
                  ))}
                </Table>
              )}
            </div>
          </Card>
        </div>
      </div>

      <EditCollegeModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        college={college}
        onSuccess={() => {
          setIsEditModalOpen(false);
          fetchCollegeDetails();
          showToast(t('colleges.updateSuccess') || 'College updated', 'success');
        }}
      />

      <AddDepartmentModal
        isOpen={isAddDeptModalOpen}
        onClose={() => setIsAddDeptModalOpen(false)}
        colleges={[college]}
        onSuccess={() => {
          setIsAddDeptModalOpen(false);
          fetchCollegeDetails();
          showToast(t('departments.createSuccess'), 'success');
        }}
      />

      <AssignAdminModal
        isOpen={isAssignAdminModalOpen}
        onClose={() => setIsAssignAdminModalOpen(false)}
        collegeId={college.id}
        collegeName={college.name}
        onSuccess={() => {
          setIsAssignAdminModalOpen(false);
          fetchCollegeDetails();
          showToast(t('colleges.adminAssignedSuccess') || 'Admin assigned successfully', 'success');
        }}
      />
    </div>
  );
};

// Helper component for the decorative shield
const Shield = ({ size }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

export default CollegeDetails;
