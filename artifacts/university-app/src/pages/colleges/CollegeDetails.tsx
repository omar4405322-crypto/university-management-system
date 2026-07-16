// @ts-nocheck
// FIXED: Department route + breadcrumbs - Phase 1 / Phase 6
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  _Building2,
  Users,
  GraduationCap,
  Layers,
  ArrowLeft,
  Settings,
  Plus,
  Edit2,
  Trash2,
  _Info,
  Calendar,
  AlertCircle,
  CheckCircle,
  Loader2,
  ExternalLink,
  UserPlus,
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Table, { TableRow, TableCell, ActionMenu, TableHeader, TableBody, TableHead } from '../../components/ui/Table';
import collegeService from '../../services/college.service';
import departmentService from '../../services/department.service';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import AddDepartmentModal from '../departments/AddDepartmentModal';
import EditCollegeModal from './EditCollegeModal';
import AssignAdminModal from './AssignAdminModal';
import Breadcrumbs from '../../components/ui/Breadcrumbs';
import { logger } from '../../lib/logger';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';

const CollegeDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isRTL } = useLanguage();
  const [college, setCollege] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAddDeptModalOpen, setIsAddDeptModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAssignAdminModalOpen, setIsAssignAdminModalOpen] = useState(false);
  const { showToast } = useToast();

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
    } catch (error: any) {
      logger.error('Error fetching college details:', error);
      showToast(t('common.errorFetching'), 'error');
    } finally {
      setLoading(false);
    }
  };


  const handleDeleteDept = async (deptId) => {
    if (window.confirm(t('departments.deleteConfirm'))) {
      try {
        const result = await departmentService.deleteDepartment(deptId);
        if (result.success) {
          showToast(t('departments.deleteSuccess'), 'success');
          fetchCollegeDetails();
        }
      } catch (error: any) {
        showToast(error.response?.data?.message || t('departments.deleteError'), 'error');
      }
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <Loader2 className="animate-spin text-brand-green" size={48} />
        <p className="text-brand-text-sub font-bold uppercase tracking-widest text-sm">
          {t('common.loading')}
        </p>
      </div>
    );
  }

  if (!college) {
    return (
      <div className="text-center py-20 bg-brand-bg-card rounded-3xl border border-brand-border">
        <div className="h-20 w-20 rounded-full bg-brand-navy-500/5 flex items-center justify-center mx-auto mb-6">
          <AlertCircle size={40} className="text-brand-text-muted" />
        </div>
        <h2 className="text-2xl font-bold text-brand-text-main">
          {t('colleges.notFound') || 'College not found'}
        </h2>
        <Button
          variant="outline"
          className="mt-6 border-brand-border"
          onClick={() => navigate('/colleges')}
        >
          <ArrowLeft size={18} className="rtl:-scale-x-100 mr-2" /> {t('common.back')}
        </Button>
      </div>
    );
  }

  const breadcrumbItems = [
    { label: t('nav.colleges'), link: '/colleges' },
    { label: isRTL ? (college.nameAr || college.name) : college.name },
  ];

  return (
    <div className="pt-6 pb-6 animate-in fade-in duration-500 flex flex-col gap-4">
      {/* Header Card */}
      <div className="bg-brand-bg-card p-6 rounded-2xl border border-brand-border/40 shadow-sm">
        {/* Top row: Breadcrumbs */}
        <div className="mb-4">
          <Breadcrumbs items={breadcrumbItems} />
        </div>

        {/* Main Content Row */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-6">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-black text-brand-text-main">
                  {isRTL ? (college.nameAr || college.name) : college.name}
                </h1>
                <span className="bg-brand-primary-500/10 text-brand-primary-600 text-xs font-bold px-2 py-0.5 rounded-full">
                  {t('colleges.active')}
                </span>
              </div>
              {college.nameAr && !isRTL && (
                <p className="text-sm text-brand-text-muted mt-1 font-arabic" dir="rtl">
                  {college.nameAr}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 md:self-end lg:self-center">
            {canManage && (
              <Button
                variant="secondary"
                className="btn-secondary flex items-center gap-2 text-xs font-black uppercase tracking-wider py-2 px-4 h-10 rounded-xl"
                onClick={() => navigate(`/schedules-management?collegeId=${college.id}`)}
              >
                <Calendar size={14} className="text-brand-primary-400" />
                <span>{t('nav.schedule')}</span>
              </Button>
            )}

            {canManage && (
              <Button
                variant="primary"
                className="flex items-center gap-2 text-xs font-black uppercase tracking-wider py-2 px-4 h-10 rounded-xl shadow-md shadow-brand-primary-500/10"
                onClick={() => setIsAddDeptModalOpen(true)}
              >
                <Plus size={14} />
                <span>{t('departments.addDept')}</span>
              </Button>
            )}

            {user?.role === 'SUPER_ADMIN' && (
              <Button
                variant="outline"
                className="p-2 border border-brand-border hover:bg-brand-navy-500/10 hover:border-brand-navy-400 text-brand-text-main h-10 w-10 flex items-center justify-center rounded-xl transition-all duration-150"
                onClick={() => setIsEditModalOpen(true)}
              >
                <Settings size={16} />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Departments Stat */}
        <div className="bg-brand-bg-card border border-brand-border/40 p-5 rounded-2xl flex flex-col gap-2 shadow-sm group hover:-translate-y-1 hover:border-brand-primary-500/40 hover:shadow-[0_8px_30px_rgba(132,189,58,0.15)] transition-all duration-300">
          <div className="h-12 w-12 rounded-2xl bg-brand-primary-500/10 text-brand-primary-600 group-hover:bg-brand-primary-500 group-hover:text-white flex items-center justify-center shadow-[0_0_15px_rgba(132,189,58,0.2)] group-hover:shadow-[0_0_25px_rgba(132,189,58,0.5)] scale-100 group-hover:scale-110 transition-all duration-300">
            <Layers size={22} />
          </div>
          <div className="mt-2 text-start">
            <p className="text-xs font-bold text-brand-text-muted uppercase tracking-wider">
              {t('nav.departments')}
            </p>
            <h3 className="text-2xl font-black text-brand-text-main mt-1">
              {college._count?.departments || 0}
            </h3>
          </div>
        </div>

        {/* Students Stat */}
        <div className="bg-brand-bg-card border border-brand-border/40 p-5 rounded-2xl flex flex-col gap-2 shadow-sm group hover:-translate-y-1 hover:border-blue-500/40 hover:shadow-[0_8px_30px_rgba(59,130,246,0.15)] transition-all duration-300">
          <div className="h-12 w-12 rounded-2xl bg-blue-500/10 text-blue-600 group-hover:bg-blue-500 group-hover:text-white flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.2)] group-hover:shadow-[0_0_25px_rgba(59,130,246,0.5)] scale-100 group-hover:scale-110 transition-all duration-300">
            <GraduationCap size={22} />
          </div>
          <div className="mt-2 text-start">
            <p className="text-xs font-bold text-brand-text-muted uppercase tracking-wider">
              {t('nav.students')}
            </p>
            <h3 className="text-2xl font-black text-brand-text-main mt-1">
              {college._count?.students || 0}
            </h3>
          </div>
        </div>

        {/* Doctors Stat */}
        <div className="bg-brand-bg-card border border-brand-border/40 p-5 rounded-2xl flex flex-col gap-2 shadow-sm group hover:-translate-y-1 hover:border-indigo-500/40 hover:shadow-[0_8px_30px_rgba(99,102,241,0.15)] transition-all duration-300">
          <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 text-indigo-600 group-hover:bg-indigo-500 group-hover:text-white flex items-center justify-center shadow-[0_0_15px_rgba(99,102,241,0.2)] group-hover:shadow-[0_0_25px_rgba(99,102,241,0.5)] scale-100 group-hover:scale-110 transition-all duration-300">
            <Users size={22} />
          </div>
          <div className="mt-2 text-start">
            <p className="text-xs font-bold text-brand-text-muted uppercase tracking-wider">
              {t('nav.doctors')}
            </p>
            <h3 className="text-2xl font-black text-brand-text-main mt-1">
              {college._count?.doctors || 0}
            </h3>
          </div>
        </div>
      </div>

      {/* Assigned Admin Card */}
      {user?.role === 'SUPER_ADMIN' && (
        <div className="bg-brand-bg-card p-5 rounded-2xl border border-brand-border/40 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-brand-text-main mb-1">
              {t('colleges.assignedAdmin') || 'Assigned Admin'}
            </h3>
            {college.assignedAdmin ? (
              <div>
                <p className="font-semibold text-sm text-brand-text-main">
                  {college.assignedAdmin.name || college.assignedAdmin.email}
                </p>
                <p className="text-xs text-brand-text-muted mt-0.5">
                  {college.assignedAdmin.email}
                </p>
              </div>
            ) : (
              <p className="text-sm text-brand-text-muted">
                {t('colleges.noAdminAssigned') || 'No admin assigned to this college'}
              </p>
            )}
          </div>

          {college.assignedAdmin ? (
            <Button
              variant="secondary"
              className="btn-secondary text-xs font-black uppercase tracking-wider py-2 px-4 h-10 flex items-center gap-2 rounded-xl shadow-sm"
              onClick={() => setIsAssignAdminModalOpen(true)}
            >
              <Edit2 size={14} />
              <span>{t('common.change')}</span>
            </Button>
          ) : (
            <Button
              variant="primary"
              className="text-xs font-black uppercase tracking-wider py-2 px-4 h-10 flex items-center gap-2 rounded-xl shadow-sm"
              onClick={() => setIsAssignAdminModalOpen(true)}
            >
              <UserPlus size={14} />
              <span>{t('colleges.assignAdmin') || 'Assign Admin'}</span>
            </Button>
          )}
        </div>
      )}

      {/* Departments Table Card */}
      <div className="bg-brand-bg-card rounded-2xl border border-brand-border/40 p-5">
        <h3 className="text-lg font-bold text-brand-text-main mb-4">
          {t('nav.departments')}
        </h3>
        <div>
          {college.departments?.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-96 text-center p-8">
              <div className="h-20 w-20 rounded-full bg-brand-navy-500/5 flex items-center justify-center mb-4 border border-brand-border">
                <Layers size={40} className="text-brand-text-muted" />
              </div>
              <p className="text-lg font-black text-brand-text-main">
                {t('departments.noDepts')}
              </p>
              <p className="text-sm text-brand-text-sub max-w-xs mx-auto mt-1 font-bold">
                {t('departments.noDeptsDesc')}
              </p>
              {canManage && (
                <Button
                  onClick={() => setIsAddDeptModalOpen(true)}
                  className="mt-6 flex items-center gap-2"
                >
                  <Plus size={18} /> {t('departments.addDept')}
                </Button>
              )}
            </div>
          ) : (
            <Table className="w-full">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-start text-xs uppercase tracking-widest text-brand-text-muted font-black border-b border-brand-border pb-3">
                    {isRTL ? 'القسم' : 'Department'}
                  </TableHead>
                  <TableHead className="text-center text-xs uppercase tracking-widest text-brand-text-muted font-black border-b border-brand-border pb-3">
                    {isRTL ? 'المقررات' : 'Courses'}
                  </TableHead>
                  <TableHead className="text-center text-xs uppercase tracking-widest text-brand-text-muted font-black border-b border-brand-border pb-3">
                    {isRTL ? 'الطلاب' : 'Students'}
                  </TableHead>
                  <TableHead className="text-center text-xs uppercase tracking-widest text-brand-text-muted font-black border-b border-brand-border pb-3">
                    {isRTL ? 'إجراءات' : 'Actions'}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {college.departments.map((dept, _idx) => (
                  <TableRow
                    key={dept.id}
                    className="cursor-pointer hover:bg-brand-bg-page transition-colors border-b border-brand-border/40"
                    onClick={() => navigate(`/departments/${dept.id}`)}
                  >
                    <TableCell className="text-start py-3">
                      <div className="flex flex-col">
                        <span className="font-semibold text-brand-text-main text-sm">
                          {isRTL ? (dept.nameAr || dept.name) : dept.name}
                        </span>
                        {dept.nameAr && (
                          <span className="text-xs text-brand-text-muted mt-0.5">
                            {isRTL ? dept.name : dept.nameAr}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center align-middle text-sm font-bold text-brand-text-primary py-3">
                      <div className="w-full flex justify-center text-center">{dept._count?.courses || 0}</div>
                    </TableCell>
                    <TableCell className="text-center align-middle text-sm font-bold text-brand-text-primary py-3">
                      <div className="w-full flex justify-center text-center">{dept._count?.students || 0}</div>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()} className="text-end py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => navigate(`/departments/${dept.id}`)}
                          className="p-1.5 hover:bg-brand-navy-500/5 text-brand-text-sub hover:text-brand-green rounded-lg transition-all"
                          title={isRTL ? 'عرض القسم' : 'View Department'}
                        >
                          <ExternalLink size={16} />
                        </button>
                        {canManage && (
                          <button
                            onClick={() => handleDeleteDept(dept.id)}
                            className="p-1.5 hover:bg-error/10 text-brand-text-sub hover:text-error rounded-lg transition-all"
                            title={isRTL ? 'حذف' : 'Delete'}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
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
const _Shield = ({ size }) => (
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
