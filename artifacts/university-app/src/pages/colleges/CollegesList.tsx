// @ts-nocheck
// FIXED [Phase 7]: Empty state + delete confirmation modal
import React, { useState, useEffect } from 'react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/button';
import Badge from '../../components/ui/Badge';
import {
  Building2,
  ExternalLink,
  Edit2,
  Trash2,
  AlertCircle,
  CheckCircle,
  Loader2,
  Plus,
  Layers,
  Search,
  Users,
  GraduationCap,
  X,
  Download,
} from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import collegeService from '../../services/college.service';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import AddCollegeModal from './AddCollegeModal';
import EditCollegeModal from './EditCollegeModal';
import CollegeCardImage from '../../components/CollegeCardImage';
import { EmptyState } from '../../components/ui/EmptyState';
import ConfirmDeleteModal from '../../components/ui/ConfirmDeleteModal';
import { logger } from '../../lib/logger';
import { useToast } from '../../context/ToastContext';

const CollegesList = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isRTL } = useLanguage();
  const [colleges, setColleges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedCollege, setSelectedCollege] = useState(null);
  const { showToast } = useToast();
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    // If user is DEPARTMENT_ADMIN, redirect to their scoped view
    if (user?.role === 'DEPARTMENT_ADMIN' && user?.managedDepartmentId) {
      navigate(`/departments/${user.managedDepartmentId}`);
      return;
    }

    fetchColleges();
  }, []);

  // For COLLEGE_ADMIN, filter colleges to only show their managed college
  const visibleColleges =
    user?.role === 'COLLEGE_ADMIN' && user?.managedCollegeId
      ? Array.isArray(colleges)
        ? colleges.filter((c) => c.id === user.managedCollegeId)
        : []
      : colleges;

  const filteredColleges = (Array.isArray(visibleColleges) ? visibleColleges : [])
    .filter((c) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      const name = (c.name || '').toLowerCase();
      const nameAr = (c.nameAr || '').toLowerCase();
      return name.includes(q) || nameAr.includes(q);
    })
    .sort((a, b) => {
      if (sortBy === 'departments') {
        return (b._count?.departments ?? b.departments?.length ?? 0) - (a._count?.departments ?? a.departments?.length ?? 0);
      }
      if (sortBy === 'students') {
        return (b._count?.students ?? 0) - (a._count?.students ?? 0);
      }
      return (isRTL ? a.nameAr || a.name : a.name).localeCompare(isRTL ? b.nameAr || b.name : b.name);
    });

  const totalDepts = colleges.reduce((acc, c) => acc + (c._count?.departments ?? c.departments?.length ?? 0), 0);
  const totalStudents = colleges.reduce((acc, c) => acc + (c._count?.students ?? 0), 0);
  const totalFaculty = colleges.reduce((acc, c) => acc + (c._count?.doctors ?? c._count?.faculty ?? 0), 0);

  const fetchColleges = async () => {
    try {
      setLoading(true);
      const result = await collegeService.getColleges();
      if (result.success) {
        setColleges(result.data?.colleges || result.data || []);
      }
    } catch (error: any) {
      logger.error('Error fetching colleges:', error);
      showToast(t('common.errorFetching'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleteLoading(true);
      const result = await collegeService.deleteCollege(deleteTarget.id);
      if (result.success) {
        showToast(t('colleges.deleteSuccess'), 'success');
        setDeleteTarget(null);
        fetchColleges();
      }
    } catch (error: any) {
      const message = error.data?.message || error.message || t('colleges.deleteError');
      showToast(message, 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleEdit = (college) => {
    setSelectedCollege(college);
    setIsEditModalOpen(true);
  };

  return (
    <div className="section-gap animate-page pt-4">
      <PageHeader
        title={t('colleges.title', 'University Colleges')}
        subtitle={t('colleges.subtitle', 'Overview of all academic divisions and their performance.')}
        action={
          user?.role === 'SUPER_ADMIN'
            ? {
                label: t('colleges.addCollege', 'Add New College'),
                onClick: () => setIsAddModalOpen(true),
                icon: Plus,
                className:
                  'bg-brand-primary-500 hover:bg-brand-primary-600 text-white font-bold rounded-xl active:scale-95 transition-all flex items-center gap-2 px-4 py-2',
              }
            : undefined
        }
      />

      {/* ========================================================================= */}
      {/* 1. EXECUTIVE 4-METRIC RIBBON                                              */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
        {/* Total Colleges */}
        <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-semibold block">
              {isRTL ? 'إجمالي الكليات' : 'Total Colleges'}
            </span>
            <span className="text-lg font-black text-slate-900 dark:text-white block mt-0.5 font-mono">
              {colleges.length}
            </span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-brand-primary-50 dark:bg-brand-primary-950/50 text-brand-primary-600 flex items-center justify-center shrink-0">
            <Building2 size={16} />
          </div>
        </div>

        {/* Total Departments */}
        <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-semibold block">
              {isRTL ? 'إجمالي الأقسام' : 'Total Departments'}
            </span>
            <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 block mt-0.5 font-mono">
              {totalDepts}
            </span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center shrink-0">
            <Layers size={16} />
          </div>
        </div>

        {/* Total Students */}
        <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-semibold block">
              {isRTL ? 'إجمالي الطلاب' : 'Total Students'}
            </span>
            <span className="text-lg font-black text-blue-600 dark:text-blue-400 block mt-0.5 font-mono">
              {totalStudents}
            </span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center shrink-0">
            <Users size={16} />
          </div>
        </div>

        {/* Total Faculty */}
        <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-semibold block">
              {isRTL ? 'الكادر الأكاديمي' : 'Faculty Members'}
            </span>
            <span className="text-lg font-black text-amber-600 dark:text-amber-400 block mt-0.5 font-mono">
              {totalFaculty}
            </span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center shrink-0">
            <GraduationCap size={16} />
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. UNIFIED COMPACT FILTER TOOLBAR                                         */}
      {/* ========================================================================= */}
      <div className="p-2 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-700 shadow-2xs flex flex-wrap items-center gap-2 mb-6">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('colleges.searchPlaceholder', 'Search by college name or code...')}
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

        {/* Sort Select */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="h-8.5 px-3 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-brand-primary-500 cursor-pointer"
        >
          <option value="name">{isRTL ? 'ترتيب: أبجدياً' : 'Sort: Name'}</option>
          <option value="departments">{isRTL ? 'ترتيب: حسب عدد الأقسام' : 'Sort: Departments'}</option>
          <option value="students">{isRTL ? 'ترتيب: حسب عدد الطلاب' : 'Sort: Students'}</option>
        </select>

        {/* Clear Filters */}
        {(search || sortBy !== 'name') && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch('');
              setSortBy('name');
            }}
            className="h-8.5 px-2.5 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl font-bold cursor-pointer"
          >
            <X size={13} className="me-1" />
            {isRTL ? 'مسح' : 'Clear'}
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col justify-center items-center h-96 gap-4">
          <Loader2 className="animate-spin text-brand-primary-600" size={48} />
          <p className="text-caption">{t('common.loading')}</p>
        </div>
      ) : !Array.isArray(filteredColleges) || filteredColleges.length === 0 ? (
        <EmptyState
          icon={<Building2 size={40} />}
          title={t('colleges.noColleges')}
          subtitle={t('colleges.noCollegesDesc')}
          action={
            user?.role === 'SUPER_ADMIN'
              ? { label: t('colleges.addFirstCollege'), onClick: () => setIsAddModalOpen(true) }
              : null
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {filteredColleges.map((college) => (
            <Card
              key={college.id}
              noPadding
              className="group border border-brand-border/60 bg-brand-bg-card rounded-2xl overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
            >
              <div className="relative h-64 w-full overflow-hidden">
                <CollegeCardImage
                  name={college.name}
                  image={college.image}
                  collegeId={college.id}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-brand-navy-900/90 via-brand-navy-900/20 to-transparent z-10" />

                <div className="absolute top-6 right-6 z-20 flex gap-2">
                  {user?.role === 'SUPER_ADMIN' && (
                    <>
                      <button
                        onClick={() => handleEdit(college)}
                        className="w-10 h-10 rounded-xl bg-white/10 p-2.5 text-white backdrop-blur-xl hover:bg-brand-primary-600 transition-all duration-300 shadow-xl border border-white/10 flex items-center justify-center"
                        title={t('common.edit')}
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget({ id: college.id, name: isRTL ? (college.nameAr || college.name) : college.name })}
                        className="w-10 h-10 rounded-xl bg-white/10 p-2.5 text-white backdrop-blur-xl hover:bg-error transition-all duration-300 shadow-xl border border-white/10 flex items-center justify-center"
                        title={t('common.delete')}
                      >
                        <Trash2 size={18} />
                      </button>
                    </>
                  )}
                </div>

                <div className="absolute bottom-6 right-6 left-6 z-20">
                  <Badge
                    variant="success"
                    className="mb-3 px-3 py-1 text-[10px] font-black tracking-widest uppercase bg-brand-primary-600/90 text-white border-none shadow-lg"
                  >
                    {t('colleges.active')}
                  </Badge>
                  <h3 className="text-3xl font-black text-white tracking-tight drop-shadow-lg uppercase leading-tight">
                    {isRTL ? (college.nameAr || college.name) : college.name}
                  </h3>
                </div>
              </div>

              <div className="p-8">
                <p 
                  dir="auto"
                  className="text-sm text-brand-text-muted text-start line-clamp-2 min-h-[3rem] leading-relaxed"
                >
                  {isRTL ? (college.descriptionAr || college.description) : college.description}
                </p>

                <div className="mt-8 grid grid-cols-2 gap-6 border-t border-brand-border dark:border-brand-border pt-6">
                  <div className="space-y-1">
                    <p className="label-stat">{t('nav.departments')}</p>
                    <p className="text-3xl font-black text-brand-text-primary dark:text-brand-text-main tracking-tighter">
                      {college._count?.departments || 0}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="label-stat">{t('profile.status')}</p>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-brand-primary-600 animate-pulse" />
                      <p className="text-[10px] font-black text-brand-primary-600 uppercase tracking-widest">
                        {t('colleges.operational')}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Assigned Admin Section */}
                <div className="mt-6 p-3 bg-brand-bg-page rounded-xl text-start">
                  <p className="text-[10px] font-black text-brand-text-muted uppercase tracking-widest mb-2">
                    {t('colleges.assignedAdmin') || 'Assigned Admin'}
                  </p>
                  {college.assignedAdmin ? (
                    <div className="flex flex-col">
                      <p 
                        dir="auto"
                        className="font-semibold text-sm text-brand-text-primary dark:text-brand-text-main"
                      >
                        {college.assignedAdmin.name || college.assignedAdmin.email}
                      </p>
                      <p className="text-xs text-brand-text-muted">
                        {college.assignedAdmin.email}
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-brand-accent-amber">
                      <AlertCircle size={14} />
                      <span className="text-xs font-bold">
                        {t('colleges.noAdminAssigned') || 'No admin assigned'}
                      </span>
                    </div>
                  )}
                </div>

                <div className="mt-8 flex items-center gap-3">
                  <Button
                    variant="primary"
                    className="flex-1 text-[10px] font-black uppercase tracking-widest py-3 rounded-xl shadow-sm flex items-center justify-center gap-2"
                    onClick={() => navigate(`/departments?collegeId=${college.id}`)}
                  >
                    <Layers size={14} />
                    <span>{t('colleges.manageDepts')}</span>
                  </Button>
                  <Button
                    variant="secondary"
                    className="btn-secondary flex-1 text-[10px] font-black uppercase tracking-widest py-3 rounded-xl shadow-sm flex items-center justify-center gap-2"
                    onClick={() => navigate(`/colleges/${college.id}`)}
                  >
                    <span>{t('colleges.viewDetails')}</span>
                    <ExternalLink size={14} className="rtl:-scale-x-100" />
                  </Button>
                </div>
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

      <AddCollegeModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => {
          setIsAddModalOpen(false);
          fetchColleges();
          showToast(t('colleges.addSuccess'), 'success');
        }}
      />

      <EditCollegeModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedCollege(null);
        }}
        college={selectedCollege}
        onSuccess={() => {
          setIsEditModalOpen(false);
          setSelectedCollege(null);
          fetchColleges();
          showToast(t('colleges.updateSuccess'), 'success');
        }}
      />
    </div>
  );
};

export default CollegesList;
