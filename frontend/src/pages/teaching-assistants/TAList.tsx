// @ts-nocheck
// FIXED: Phase 7 — empty state, CSV export, delete confirm modal
import React, { useState, useEffect, useMemo } from 'react';
import { useTeachingAssistants } from '../../hooks/useTeachingAssistants';
import { useDebounce } from '../../hooks/useDebounce';
import teachingAssistantsService from '../../services/teachingAssistants.service';
import AddTeachingAssistantModal from './AddTAModal';
import EditTeachingAssistantModal from './EditTAModal';
import { PageHeader } from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Table, { TableRow, TableCell, ActionMenu } from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import FilterBar from '../../components/ui/FilterBar';
import Pagination from '../../components/ui/Pagination';
import { EmptyState } from '../../components/ui/EmptyState';
import ConfirmDeleteModal from '../../components/ui/ConfirmDeleteModal';
import Button from '../../components/ui/Button';
import { downloadCsv } from '../../utils/exportCsv';
import TeachingAssistantAvatar from '../../components/TeachingAssistantAvatar';
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
} from 'lucide-react';
import ResetPasswordModal from '../../components/ui/ResetPasswordModal';
import { useNavigate } from 'react-router-dom';
import { logger } from '../../lib/logger';

const TeachingAssistantsList = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
    const { scopeParams, _isCollegeAdmin } = useScope();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const { data: teachingAssistants, loading, error, search, setSearch, page, setPage, total, refetch } = useTeachingAssistants();
  const limit = 10;
  const totalPages = Math.ceil(total / limit);
  const totalRecords = total;
  const fetchTeachingAssistants = refetch;
  const debouncedSearch = useDebounce(search, 400);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedTeachingAssistant, setSelectedTeachingAssistant] = useState(null);
  const [resetPasswordTeachingAssistant, setResetPasswordTeachingAssistant] = useState(null);
  const [toast, setToast] = useState<any>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredTeachingAssistants = useMemo(() => {
    return (Array.isArray(teachingAssistants) ? teachingAssistants : []).filter((ta) => {
      let status = 'active';
      if (ta.status) {
        status = ta.status;
      } else if (ta.isActive !== undefined) {
        status = ta.isActive ? 'active' : 'inactive';
      }
      
      if (statusFilter === 'all') return true;
      return status === statusFilter;
    });
  }, [teachingAssistants, statusFilter]);

  const [stats, setStats] = useState([
    { label: t('teachingAssistants.totalFaculty'), value: '0', icon: Users, color: 'navy' },
    { label: t('teachingAssistants.activeProfessors'), value: '0', icon: CheckCircle, color: 'green' },
    { label: t('teachingAssistants.totalCourses'), value: '0', icon: BookOpen, color: 'navy' },
    { label: t('teachingAssistants.researchProjects'), value: '0', icon: Briefcase, color: 'yellow' },
  ]);

  const fetchStats = async () => {
    try {
      const result = await teachingAssistantsService.getStats();
      if (result.success && result.data) {
        const d = result.data;
        setStats([
          {
            label: t('teachingAssistants.totalFaculty'),
            value: (d.totalFaculty ?? 0).toLocaleString(),
            icon: Users,
            color: 'navy',
          },
          {
            label: t('teachingAssistants.activeProfessors'),
            value: (d.activeProfessors ?? 0).toLocaleString(),
            icon: CheckCircle,
            color: 'green',
          },
          {
            label: t('teachingAssistants.totalCourses'),
            value: (d.totalCourses ?? 0).toLocaleString(),
            icon: BookOpen,
            color: 'navy',
          },
          {
            label: t('teachingAssistants.researchProjects'),
            value: (d.researchProjects ?? 0).toLocaleString(),
            icon: Briefcase,
            color: 'yellow',
          },
        ]);
      }
    } catch (error: any) {
      logger.error('Error fetching teachingAssistant stats:', error);
    }
  };



  useEffect(() => {
    fetchStats();
  }, []);


  const handleExportCsv = async () => {
    try {
      setExporting(true);
            const result = await teachingAssistantsService.getTeachingAssistants({ search: debouncedSearch, page: 1, limit: 5000 });
      const list = result.data?.teachingAssistants || [];
      downloadCsv(
        `faculty-${new Date().toISOString().slice(0, 10)}.csv`,
        [t('teachingAssistants.specialization'), t('students.fullName'), t('teachingAssistants.specialty'), t('auth.email')],
        list.map((d) => [
          d.specialization,
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
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleteLoading(true);
      const result = await teachingAssistantsService.deleteTeachingAssistant(deleteTarget.id);
      if (result.success) {
        showToast(t('teachingAssistants.deleteSuccess'), 'success');
        setDeleteTarget(null);
        fetchTeachingAssistants();
        fetchStats();
      }
    } catch (error: any) {
      showToast(error.response?.data?.message || t('teachingAssistants.deleteError'), 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleEdit = (teachingAssistant) => {
    setSelectedTeachingAssistant(teachingAssistant);
  };

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
      {/* FIXED: Move action button next to title */}
      <PageHeader
        title={t('teachingAssistants.title')}
        subtitle={t('teachingAssistants.subtitle')}
        action={{
          label: t('teachingAssistants.addTeachingAssistant'),
          onClick: () => setIsAddModalOpen(true),
        }}
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {stats.map((stat, i) => (
          <Card
            key={i}
            noPadding
            className="group hover:-translate-y-1 transition-all duration-300 border-none shadow-soft overflow-hidden"
          >
            <div className="p-6 flex items-center justify-between">
              <div>
                <p className="label-stat mb-1">{stat.label}</p>
                <h3 className="m-0 text-3xl font-black text-brand-text-primary dark:text-brand-text-main tracking-tightest">
                  {stat.value}
                </h3>
              </div>
              <div
                className={`rounded-[1.25rem] p-3.5 transition-all duration-500 shadow-inner ${
                  stat.color === 'navy'
                    ? 'bg-brand-navy-50 text-brand-navy-500 group-hover:bg-brand-navy-500 group-hover:text-white'
                    : stat.color === 'green'
                      ? 'bg-brand-primary-50 text-brand-green-dark group-hover:bg-brand-green-dark group-hover:text-white'
                      : 'bg-brand-accent-yellow/10 text-brand-accent-yellow group-hover:bg-brand-accent-yellow group-hover:text-white'
                }`}
              >
                <stat.icon size={28} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card noPadding className="border-none shadow-soft overflow-hidden">
        <FilterBar
          search={search}
          onSearchChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          searchPlaceholder={t('teachingAssistants.searchPlaceholder')}
        >
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={exporting}
            onClick={handleExportCsv}
            className="text-[10px] font-black uppercase tracking-widest gap-2"
          >
            <Download size={14} />
            {exporting ? t('common.loading') : t('common.exportCsv')}
          </Button>
          <button type="button" onClick={() => setStatusFilter('all')}>
            <Badge variant={statusFilter === 'all' ? 'primary' : 'neutral'} className="cursor-pointer px-3 py-1">
              {t('teachingAssistants.allFaculty')}
            </Badge>
          </button>
          <button type="button" onClick={() => setStatusFilter('active')}>
            <Badge variant={statusFilter === 'active' ? 'success' : 'neutral'} className="cursor-pointer px-3 py-1">
              {t('students.active')}
            </Badge>
          </button>
          <button type="button" onClick={() => setStatusFilter('onLeave')}>
            <Badge variant={statusFilter === 'onLeave' ? 'warning' : 'neutral'} className="cursor-pointer px-3 py-1">
              {t('teachingAssistants.onLeave')}
            </Badge>
          </button>
          <button type="button" onClick={() => setStatusFilter('inactive')}>
            <Badge variant={statusFilter === 'inactive' ? 'danger' : 'neutral'} className="cursor-pointer px-3 py-1">
              {t('students.inactive')}
            </Badge>
          </button>
        </FilterBar>

        <div className="min-h-[400px]">
                    {loading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <Loader2 className="animate-spin text-brand-green-dark" size={40} />
              <p className="label-stat">{t('teachingAssistants.loading')}</p>
            </div>
          ) : !Array.isArray(teachingAssistants) || teachingAssistants.length === 0 ? (
            <EmptyState
              icon={<Users size={40} />}
              title={search ? t('teachingAssistants.noSearchResults') : t('teachingAssistants.noTeachingAssistants')}
              subtitle={search ? t('teachingAssistants.noSearchResultsDesc') : t('teachingAssistants.noTeachingAssistantsDesc')}
              action={
                search
                  ? { label: t('common.clearSearch'), onClick: () => setSearch('') }
                  : { label: t('teachingAssistants.addFirstTeachingAssistant'), onClick: () => setIsAddModalOpen(true) }
              }
            />
          ) : (
            <>
              <Table
                headers={[
                  t('teachingAssistants.specialization'),
                  t('students.fullName'),
                  t('profile.email'),
                  t('teachingAssistants.specialty'),
                  t('teachingAssistants.courses'),
                  t('profile.status'),
                  t('common.actions'),
                ]}
              >
                {filteredTeachingAssistants.map((teachingAssistant) => (
                  <TableRow key={teachingAssistant.id}>
                    <TableCell className="font-black text-brand-navy-500 dark:text-brand-green tracking-widest text-xs uppercase hidden md:table-cell">
                      {teachingAssistant.specialization}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-4">
                        <TeachingAssistantAvatar
                          name={`${(teachingAssistant.user?.email || '').split('@')[0] || ''} ${'' || ''}`.trim()}
                          imageUrl={teachingAssistant.user?.profilePicture}
                          size="table"
                          className="shadow-inner ring-1 ring-brand-primary-100/50 dark:ring-brand-primary-900/20 group-hover:scale-110 transition-transform"
                        />
                        <span className="font-black text-brand-text-primary dark:text-brand-text-main tracking-tight group-hover:text-brand-green-dark transition-colors">
                          {(teachingAssistant.user?.email || '').split('@')[0]} {''}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-brand-text-secondary font-bold text-xs hidden md:table-cell">
                      {teachingAssistant.user?.email}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="inline-flex items-center px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest bg-brand-primary-50 dark:bg-brand-primary-900/10 text-brand-green-dark border border-brand-primary-100/50 dark:border-brand-primary-900/20">
                        {teachingAssistant.specialty || t('students.notProvided')}
                      </span>
                    </TableCell>
                    <TableCell className="text-brand-text-primary dark:text-brand-text-main font-black text-sm hidden md:table-cell">
                      {teachingAssistant._count?.courses || 0}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border uppercase tracking-wider ${
                        (teachingAssistant.status === 'active' || !teachingAssistant.status)
                          ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800'
                          : teachingAssistant.status === 'inactive'
                            ? 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'
                            : 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800'
                      }`}>
                        {teachingAssistant.status ? t(`students.${teachingAssistant.status}`) : t('students.active')}
                      </span>
                    </TableCell>
                    <TableCell>
                      <ActionMenu
                        actions={[
                          {
                            label: t('common.view'),
                            icon: Eye,
                            variant: 'view',
                            onClick: () => navigate(`/teachingAssistants/${teachingAssistant.id}`),
                          },
                          {
                            label: t('common.edit'),
                            icon: Edit2,
                            variant: 'edit',
                            onClick: () => handleEdit(teachingAssistant),
                          },
                          {
                            label: 'Reset Password',
                            icon: KeyRound,
                            variant: 'edit',
                            onClick: () => setResetPasswordTeachingAssistant(teachingAssistant),
                          },
                          ...(isSuperAdmin
                            ? [
                                {
                                  label: t('common.delete'),
                                  icon: Trash2,
                                  variant: 'delete',
                                  onClick: () =>
                                    setDeleteTarget({
                                      id: teachingAssistant.id,
                                      name: `${(teachingAssistant.user?.email || '').split('@')[0]} ${''}`,
                                    }),
                                },
                              ]
                            : []),
                        ]}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </Table>

                            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            </>
          )}
        </div>
      </Card>

      <ConfirmDeleteModal
        isOpen={Boolean(deleteTarget)}
        itemName={deleteTarget?.name}
        onClose={() => !deleteLoading && setDeleteTarget(null)}
        onConfirm={confirmDelete}
        loading={deleteLoading}
      />

      {/* Modals */}
      <AddTeachingAssistantModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => {
          setIsAddModalOpen(false);
          showToast(t('teachingAssistants.createSuccess'), 'success');
          fetchTeachingAssistants();
          fetchStats();
        }}
      />

      <EditTeachingAssistantModal
        isOpen={!!selectedTeachingAssistant}
        onClose={() => {
          setSelectedTeachingAssistant(null);
        }}
        teachingAssistant={selectedTeachingAssistant}
        onSuccess={() => {
          setSelectedTeachingAssistant(null);
          showToast(t('teachingAssistants.updateSuccess'), 'success');
          fetchTeachingAssistants();
          fetchStats();
        }}
      />

      <ResetPasswordModal
        isOpen={!!resetPasswordTeachingAssistant}
        onClose={() => setResetPasswordTeachingAssistant(null)}
        person={resetPasswordTeachingAssistant}
        type="teachingAssistant"
      />
    </div>
  );
};

export default TeachingAssistantsList;
