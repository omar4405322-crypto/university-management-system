// @ts-nocheck
// FIXED: Phase 7 — empty state, CSV export, delete confirm modal
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useDoctors } from '../../hooks/useDoctors';
import doctorsService from '../../services/doctors.service';
import AddDoctorModal from './AddDoctorModal';
import EditDoctorModal from './EditDoctorModal';
import { PageHeader } from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Table, { TableRow, TableCell, TableHeader, TableHead, TableBody, ActionMenu } from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import FilterBar from '../../components/ui/FilterBar';
import Pagination from '../../components/ui/Pagination';
import { EmptyState } from '../../components/ui/EmptyState';
import ConfirmDeleteModal from '../../components/ui/ConfirmDeleteModal';
import Button from '../../components/ui/Button';
import { downloadCsv } from '../../utils/exportCsv';
import DoctorAvatar from '../../components/DoctorAvatar';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import useScope from '../../hooks/useScope';
import {
  Users,
  BookOpen,
  Briefcase,
  AlertCircle,
  CheckCircle,
  Loader2,
  Edit2,
  Trash2,
  Download,
  KeyRound,
  Eye,
  UserCheck,
  Plus,
  Search,
} from 'lucide-react';
import ResetPasswordModal from '../../components/ui/ResetPasswordModal';
import { useNavigate } from 'react-router-dom';
import { logger } from '../../lib/logger';
import { useToast } from '../../context/ToastContext';

const DoctorsList = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { scopeParams, _isCollegeAdmin } = useScope();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const { data: doctors, loading, error, search, setSearch, page, setPage, total, refetch } = useDoctors();
  const limit = 10;
  const totalPages = Math.ceil(total / limit);
  const totalRecords = total;
  const fetchDoctors = refetch;
  const debouncedSearch = search; // useDoctors already debounces internally
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [resetPasswordDoctor, setResetPasswordDoctor] = useState(null);
  const { showToast } = useToast();
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    const mainEl = document.querySelector('main');
    if (mainEl) {
      mainEl.classList.add('bg-slate-50', 'dark:bg-slate-900');
    }
    return () => {
      if (mainEl) {
        mainEl.classList.remove('bg-slate-50', 'dark:bg-slate-900');
      }
    };
  }, []);

  const isRTL = i18n.language === 'ar';

  const filteredDoctors = useMemo(() => {
    const list = Array.isArray(doctors) ? doctors : [];
    return list.filter((d) => {
      if (statusFilter === 'all') return true;
      if (statusFilter === 'active') return d.status === 'active';
      if (statusFilter === 'inactive') return d.status === 'inactive';
      if (statusFilter === 'onleave') return d.status === 'on_leave' || d.status === 'onleave';
      return true;
    });
  }, [doctors, statusFilter]);

  const [stats, setStats] = useState([
    { label: t('doctors.totalDoctors'), value: '0', icon: Users, bgClass: 'bg-brand-primary-500/10 text-brand-primary-500' },
    { label: t('doctors.activeDoctors'), value: '0', icon: UserCheck, bgClass: 'bg-green-500/10 text-green-500' },
    { label: t('doctors.totalCourses'), value: '0', icon: BookOpen, bgClass: 'bg-blue-500/10 text-blue-500' },
    { label: t('doctors.researchProjects'), value: '0', icon: Briefcase, bgClass: 'bg-amber-500/10 text-amber-500' },
  ]);

  const fetchStats = useCallback(async () => {
    try {
      const result = await doctorsService.getStats();
      if (result.success && result.data) {
        const d = result.data;
        setStats([
          {
            label: t('doctors.totalDoctors'),
            value: (d.totalFaculty ?? 0).toLocaleString(),
            icon: Users,
            bgClass: 'bg-brand-primary-500/10 text-brand-primary-500',
          },
          {
            label: t('doctors.activeDoctors'),
            value: (d.activeProfessors ?? 0).toLocaleString(),
            icon: UserCheck,
            bgClass: 'bg-green-500/10 text-green-500',
          },
          {
            label: t('doctors.totalCourses'),
            value: (d.totalCourses ?? 0).toLocaleString(),
            icon: BookOpen,
            bgClass: 'bg-blue-500/10 text-blue-500',
          },
          {
            label: t('doctors.researchProjects'),
            value: (d.researchProjects ?? 0).toLocaleString(),
            icon: Briefcase,
            bgClass: 'bg-amber-500/10 text-amber-500',
          },
        ]);
      }
    } catch (error: any) {
      logger.error('Error fetching doctor stats:', error);
    }
  }, [t]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleExportCsv = useCallback(async () => {
    try {
      setExporting(true);
            const result = await doctorsService.getDoctors({ search: debouncedSearch, page: 1, limit: 5000 });
      const list = result.data?.doctors || [];
      downloadCsv(
        `faculty-${new Date().toISOString().slice(0, 10)}.csv`,
        [t('doctors.doctorId'), t('students.fullName'), t('doctors.specialty'), t('auth.email')],
        list.map((d) => [
          d.doctorId,
          `${d.firstName} ${d.lastName}`,
          d.specialty || '',
          d.user?.email || '',
        ])
      );
      showToast(t('common.exportSuccess'), 'success');
    } catch {
      showToast(t('common.exportError'), 'error');
    } finally {
      setExporting(false);
    }
  }, [debouncedSearch, t, showToast]);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      setDeleteLoading(true);
      const result = await doctorsService.deleteDoctor(deleteTarget.id);
      if (result.success) {
        showToast(t('doctors.deleteSuccess'), 'success');
        setDeleteTarget(null);
        fetchDoctors();
        fetchStats();
      }
    } catch (error: any) {
      showToast(error.response?.data?.message || t('doctors.deleteError'), 'error');
    } finally {
      setDeleteLoading(false);
    }
  }, [deleteTarget, fetchDoctors, fetchStats, t, showToast]);

  const handleEdit = useCallback((doctor) => {
    setSelectedDoctor(doctor);
    setIsEditModalOpen(true);
  }, []);

  return (
    <div className="pt-6 section-gap animate-in fade-in duration-700">
      <PageHeader
        title={t('doctors.title')}
        subtitle={t('doctors.subtitle')}
        action={{
          label: t('doctors.addDoctor'),
          onClick: () => setIsAddModalOpen(true),
          icon: Plus,
          className: "bg-brand-primary-500 hover:bg-brand-primary-600 text-white font-bold rounded-xl active:scale-95 transition-all flex items-center gap-2 px-4 py-2"
        }}
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <Card
            key={i}
            className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 flex items-center gap-4 group hover:-translate-y-0.5 hover:shadow-md transition-all text-start"
          >
            <div className={`rounded-xl p-2.5 ${stat.bgClass}`}>
              <stat.icon size={24} />
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-black text-brand-text-primary dark:text-white">
                {stat.value}
              </span>
              <span className="text-sm text-brand-text-secondary dark:text-slate-400 font-bold">
                {stat.label}
              </span>
            </div>
          </Card>
        ))}
      </div>

      {/* Filter & Search Bar Card */}
      <Card className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex overflow-x-auto pb-1.5 md:pb-0 custom-scrollbar gap-2 w-full md:w-auto" dir={isRTL ? 'rtl' : 'ltr'}>
            {[
              { id: 'all', label: t('doctors.filterAll') },
              { id: 'active', label: t('doctors.filterActive') },
              { id: 'onleave', label: t('doctors.filterOnLeave') },
              { id: 'inactive', label: t('doctors.filterInactive') },
            ].map((tab) => {
              const isActive = statusFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id)}
                  className={`flex-shrink-0 whitespace-nowrap px-3 py-1.5 text-sm font-medium rounded-xl transition-all ${
                    isActive
                      ? 'bg-brand-primary-500 text-white shadow-sm'
                      : 'text-brand-text-secondary dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-1 md:max-w-md items-center gap-3 w-full">
            <div className="relative flex-1">
              <Search
                className="absolute start-3 top-1/2 -translate-y-1/2 text-brand-text-muted"
                size={18}
              />
              <input
                type="text"
                placeholder={t('doctors.searchPlaceholder')}
                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl ps-10 pe-3 py-2 text-sm bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-primary-500"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            <Button
              variant="outline"
              disabled={exporting}
              onClick={handleExportCsv}
              className="border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 transition-all shrink-0"
            >
              <Download size={14} />
              <span className="hidden md:inline">
                {exporting ? t('common.loading') : t('doctors.exportCsv')}
              </span>
            </Button>
          </div>
        </div>
      </Card>

      {/* Table Content / Empty States */}
      <div className="min-h-0">
        {error ? (
          <div className="p-8">
            <ErrorState message={error} onRetry={fetchDoctors} />
          </div>
        ) : filteredDoctors.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="rounded-full bg-brand-primary-500/10 p-5 mb-4">
              <Users className="w-10 h-10 text-brand-primary-500" />
            </div>
            <h3 className="text-lg font-bold text-brand-text-primary dark:text-white mb-1">
              {t('doctors.noDoctors')}
            </h3>
            <p className="text-sm text-brand-text-secondary dark:text-slate-400 mb-6">
              {t('doctors.noDoctorsDesc')}
            </p>
          </div>
        ) : (
          <Card className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden p-0">
            <div className="overflow-x-auto">
              <Table className="w-full">
                <TableHeader className="bg-slate-50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-700">
                  <TableRow>
                    <TableHead className="text-start p-4 font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {t('doctors.colDoctor')}
                    </TableHead>
                    <TableHead hideOnMobile className="text-start p-4 font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {t('doctors.colDepartment')}
                    </TableHead>
                    <TableHead hideOnMobile className="text-start p-4 font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {t('doctors.colEmail')}
                    </TableHead>
                    <TableHead hideOnMobile className="text-center p-4 font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {t('doctors.colCourses')}
                    </TableHead>
                    <TableHead className="text-center p-4 font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {t('doctors.colStatus')}
                    </TableHead>
                    <TableHead className="text-end p-4 font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 pe-6">
                      {t('doctors.colActions')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDoctors.map((doctor) => {
                    const initials = `${doctor.firstName?.[0] || ''}${doctor.lastName?.[0] || ''}`.toUpperCase();
                    
                    let statusClass = 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
                    let statusLabel = t('doctors.statusActive');
                    
                    if (doctor.status === 'inactive') {
                      statusClass = 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
                      statusLabel = t('doctors.statusInactive');
                    } else if (doctor.status === 'on_leave' || doctor.status === 'onleave') {
                      statusClass = 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
                      statusLabel = t('doctors.statusOnLeave');
                    }

                    return (
                      <TableRow 
                        key={doctor.id} 
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 last:border-b-0 transition-colors"
                      >
                        <TableCell className="p-4 text-start">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-brand-primary-500/10 flex items-center justify-center text-sm font-bold text-brand-primary-600 flex-shrink-0">
                              {initials}
                            </div>
                            <div className="flex flex-col">
                              <span className="font-bold text-brand-text-primary dark:text-white">
                                {doctor.firstName} {doctor.lastName}
                              </span>
                              <span className="text-xs text-brand-text-secondary dark:text-slate-400">
                                {doctor.doctorId}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell hideOnMobile className="p-4 text-start font-medium">
                          {isRTL ? (doctor.department?.nameAr || doctor.department?.name || '—') : (doctor.department?.name || '—')}
                        </TableCell>
                        <TableCell hideOnMobile className="p-4 text-start font-medium text-slate-500 dark:text-slate-400">
                          {doctor.user?.email || '—'}
                        </TableCell>
                        <TableCell hideOnMobile className="p-4 text-center font-medium">
                          {doctor._count?.courses || 0}
                        </TableCell>
                        <TableCell className="p-4 text-center">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${statusClass}`}>
                            {statusLabel}
                          </span>
                        </TableCell>
                        <TableCell className="p-4 text-end pe-6">
                          <ActionMenu
                            actions={[
                              {
                                label: t('common.view'),
                                icon: Eye,
                                variant: 'view',
                                onClick: () => navigate(`/doctors/${doctor.id}`),
                              },
                              {
                                label: t('common.edit'),
                                icon: Edit2,
                                variant: 'edit',
                                onClick: () => handleEdit(doctor),
                              },
                              {
                                label: 'Reset Password',
                                icon: KeyRound,
                                variant: 'edit',
                                onClick: () => setResetPasswordDoctor(doctor),
                              },
                              ...(isSuperAdmin
                                ? [
                                    {
                                      label: t('common.delete'),
                                      icon: Trash2,
                                      variant: 'delete',
                                      onClick: () =>
                                        setDeleteTarget({
                                          id: doctor.id,
                                          name: `${doctor.firstName} ${doctor.lastName}`,
                                        }),
                                    },
                                  ]
                                : []),
                            ]}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            
            <Pagination 
              page={page} 
              totalPages={totalPages} 
              onPageChange={setPage} 
              total={totalRecords}
              pageSize={limit}
            />
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

      {/* Modals */}
      <AddDoctorModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => {
          setIsAddModalOpen(false);
          showToast(t('doctors.createSuccess'), 'success');
          fetchDoctors();
          fetchStats();
        }}
      />

      {isEditModalOpen && (
        <EditDoctorModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedDoctor(null);
          }}
          doctor={selectedDoctor}
          onSuccess={() => {
            setIsEditModalOpen(false);
            setSelectedDoctor(null);
            showToast(t('doctors.updateSuccess'), 'success');
            fetchDoctors();
            fetchStats();
          }}
        />
      )}

      <ResetPasswordModal
        isOpen={!!resetPasswordDoctor}
        onClose={() => setResetPasswordDoctor(null)}
        person={resetPasswordDoctor}
        type="doctor"
      />
    </div>
  );
};

export default DoctorsList;
