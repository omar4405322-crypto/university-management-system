// @ts-nocheck
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTeachingAssistants } from '../../hooks/useTeachingAssistants';
import teachingAssistantsService from '../../services/teachingAssistants.service';
import AddTAModal from './AddTAModal';
import EditTAModal from './EditTAModal';
import AssignDoctorModal from './AssignDoctorModal';
import { PageHeader } from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Table, { TableRow, TableCell, TableHeader, TableHead, TableBody, ActionMenu } from '../../components/ui/Table';
import Pagination from '../../components/ui/Pagination';
import ConfirmDeleteModal from '../../components/ui/ConfirmDeleteModal';
import Button from '../../components/ui/button';
import { downloadCsv } from '../../utils/exportCsv';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import useScope from '../../hooks/useScope';
import {
  Users,
  Briefcase,
  UserCheck,
  Edit2,
  Trash2,
  Download,
  KeyRound,
  Eye,
  Plus,
  Search,
  GraduationCap,
  Link,
  Calendar,
} from 'lucide-react';
import ResetPasswordModal from '../../components/ui/ResetPasswordModal';
import { useNavigate } from 'react-router-dom';
import { logger } from '../../lib/logger';
import { useToast } from '../../context/ToastContext';

const TeachingAssistantsList = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { scopeParams } = useScope();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const { data: tas, loading, error, search, setSearch, page, setPage, total, refetch } = useTeachingAssistants();
  const limit = 10;
  const totalPages = Math.ceil(total / limit);
  const totalRecords = total;
  const fetchTAs = refetch;
  const debouncedSearch = search;

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedTA, setSelectedTA] = useState(null);
  const [resetPasswordTA, setResetPasswordTA] = useState(null);
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

  const filteredTAs = useMemo(() => {
    const list = Array.isArray(tas) ? tas : [];
    return list.filter((ta) => {
      if (statusFilter === 'all') return true;
      if (statusFilter === 'active') return ta.status === 'ACTIVE';
      if (statusFilter === 'inactive') return ta.status === 'INACTIVE';
      if (statusFilter === 'onleave') return ta.status === 'ON_LEAVE';
      return true;
    });
  }, [tas, statusFilter]);

  const [stats, setStats] = useState([
    { label: t('teachingAssistants.totalTAs'), value: '0', icon: Users, bgClass: 'bg-brand-primary-500/10 text-brand-primary-500' },
    { label: t('teachingAssistants.activeTAs'), value: '0', icon: UserCheck, bgClass: 'bg-green-500/10 text-green-500' },
    { label: t('teachingAssistants.onLeaveTAs'), value: '0', icon: Briefcase, bgClass: 'bg-amber-500/10 text-amber-500' },
  ]);

  const fetchStats = useCallback(async () => {
    try {
      const result = await teachingAssistantsService.getStats();
      if (result.success && result.data) {
        const d = result.data;
        setStats([
          {
            label: t('teachingAssistants.totalTAs'),
            value: (d.totalTAs ?? 0).toLocaleString(),
            icon: Users,
            bgClass: 'bg-brand-primary-500/10 text-brand-primary-500',
          },
          {
            label: t('teachingAssistants.activeTAs'),
            value: (d.activeTAs ?? 0).toLocaleString(),
            icon: UserCheck,
            bgClass: 'bg-green-500/10 text-green-500',
          },
          {
            label: t('teachingAssistants.onLeaveTAs'),
            value: (d.onLeaveTAs ?? 0).toLocaleString(),
            icon: Briefcase,
            bgClass: 'bg-amber-500/10 text-amber-500',
          },
        ]);
      }
    } catch (error: any) {
      logger.error('Error fetching TA stats:', error);
    }
  }, [t]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleExportCsv = useCallback(async () => {
    try {
      setExporting(true);
      const result = await teachingAssistantsService.getTeachingAssistants({ search: debouncedSearch, page: 1, limit: 5000 });
      const list = result.data?.teachingAssistants || [];
      downloadCsv(
        `teaching-assistants-${new Date().toISOString().slice(0, 10)}.csv`,
        [t('teachingAssistants.employeeId'), t('teachingAssistants.specialization'), t('auth.email')],
        list.map((ta: any) => [
          ta.employeeId,
          ta.specialization || '',
          ta.user?.email || '',
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
      const result = await teachingAssistantsService.deleteTeachingAssistant(deleteTarget.id);
      if (result.success) {
        showToast(t('teachingAssistants.deleteSuccess'), 'success');
        setDeleteTarget(null);
        fetchTAs();
        fetchStats();
      }
    } catch (error: any) {
      showToast(error.response?.data?.message || t('teachingAssistants.deleteError'), 'error');
    } finally {
      setDeleteLoading(false);
    }
  }, [deleteTarget, fetchTAs, fetchStats, t, showToast]);

  const handleEdit = useCallback((ta: any) => {
    setSelectedTA(ta);
    setIsEditModalOpen(true);
  }, []);

  const handleAssign = useCallback((ta: any) => {
    setSelectedTA(ta);
    setIsAssignModalOpen(true);
  }, []);

  return (
    <div className="pt-6 section-gap animate-in fade-in duration-700">
      <PageHeader
        title={t('teachingAssistants.title')}
        subtitle={t('teachingAssistants.subtitle')}
        action={{
          label: t('teachingAssistants.addTA'),
          onClick: () => setIsAddModalOpen(true),
          icon: Plus,
          className: "bg-brand-primary-500 hover:bg-brand-primary-600 text-white font-bold rounded-xl active:scale-95 transition-all flex items-center gap-2 px-4 py-2"
        }}
      />

      {/* Filter & Search Bar Card */}
      <Card className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex overflow-x-auto pb-1.5 md:pb-0 custom-scrollbar gap-2 w-full md:w-auto" dir={isRTL ? 'rtl' : 'ltr'}>
            {[
              { id: 'all', label: t('teachingAssistants.filterAll') },
              { id: 'active', label: t('teachingAssistants.filterActive') },
              { id: 'onleave', label: t('teachingAssistants.filterOnLeave') },
              { id: 'inactive', label: t('teachingAssistants.filterInactive') },
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
                placeholder={t('teachingAssistants.searchPlaceholder')}
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
                {exporting ? t('common.loading') : t('teachingAssistants.exportCsv')}
              </span>
            </Button>
          </div>
        </div>
      </Card>

      {/* Table Content / Empty States */}
      <div className="min-h-0">
        {error ? (
          <div className="p-8">
            <div className="text-center text-red-500 font-medium mb-4">{error}</div>
            <div className="flex justify-center">
              <Button onClick={fetchTAs}>{t('common.retry')}</Button>
            </div>
          </div>
        ) : filteredTAs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="rounded-full bg-brand-primary-500/10 p-5 mb-4">
              <GraduationCap className="w-10 h-10 text-brand-primary-500" />
            </div>
            <h3 className="text-lg font-bold text-brand-text-primary dark:text-white mb-1">
              {t('teachingAssistants.noTAs')}
            </h3>
            <p className="text-sm text-brand-text-secondary dark:text-slate-400 mb-6">
              {t('teachingAssistants.noTAsDesc')}
            </p>
          </div>
        ) : (
          <Card className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden p-0">
            <div className="overflow-x-auto">
              <Table className="w-full">
                <TableHeader className="bg-slate-50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-700">
                  <TableRow>
                    <TableHead className="text-start p-4 font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {t('teachingAssistants.colTA')}
                    </TableHead>
                    <TableHead hideOnMobile className="text-start p-4 font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {t('teachingAssistants.colDepartment')}
                    </TableHead>
                    <TableHead hideOnMobile className="text-start p-4 font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {t('teachingAssistants.colEmail')}
                    </TableHead>
                    <TableHead hideOnMobile className="text-start p-4 font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {t('teachingAssistants.colDoctors')}
                    </TableHead>
                    <TableHead className="text-center p-4 font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {t('teachingAssistants.colStatus')}
                    </TableHead>
                    <TableHead className="text-end p-4 font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 pe-6">
                      {t('teachingAssistants.colActions')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTAs.map((ta: any) => {
                    const initials = ta.specialization?.[0]?.toUpperCase() || 'TA';
                    
                    let statusClass = 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
                    let statusLabel = t('teachingAssistants.statusActive');
                    
                    if (ta.status === 'INACTIVE') {
                      statusClass = 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
                      statusLabel = t('teachingAssistants.statusInactive');
                    } else if (ta.status === 'ON_LEAVE') {
                      statusClass = 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
                      statusLabel = t('teachingAssistants.statusOnLeave');
                    }

                    return (
                      <TableRow 
                        key={ta.id} 
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 last:border-b-0 transition-colors"
                      >
                        <TableCell className="p-4 text-start">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-brand-primary-500/10 flex items-center justify-center text-sm font-bold text-brand-primary-600 flex-shrink-0">
                              {initials}
                            </div>
                            <div className="flex flex-col">
                              <span className="font-bold text-brand-text-primary dark:text-white">
                                {ta.employeeId}
                              </span>
                              <span className="text-xs text-brand-text-secondary dark:text-slate-400">
                                {ta.specialization || '—'}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell hideOnMobile className="p-4 text-start font-medium">
                          {isRTL ? (ta.department?.nameAr || ta.department?.name || '—') : (ta.department?.name || '—')}
                        </TableCell>
                        <TableCell hideOnMobile className="p-4 text-start font-medium text-slate-500 dark:text-slate-400">
                          {ta.user?.email || '—'}
                        </TableCell>
                        <TableCell hideOnMobile className="p-4 text-start font-medium text-slate-500 dark:text-slate-400">
                          {ta.doctors?.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {ta.doctors.slice(0, 2).map((d: any) => (
                                <span key={d.id} className="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">
                                  {d.doctor.firstName} {d.doctor.lastName}
                                </span>
                              ))}
                              {ta.doctors.length > 2 && (
                                <span className="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">
                                  +{ta.doctors.length - 2}
                                </span>
                              )}
                            </div>
                          ) : (
                            '—'
                          )}
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
                                label: isRTL ? 'عرض الجدول' : 'View Schedule',
                                icon: Calendar,
                                variant: 'view',
                                onClick: () => navigate(`/schedules/ta?taId=${ta.id}`),
                              },
                              {
                                label: t('teachingAssistants.assignDoctor'),
                                icon: Link,
                                variant: 'view',
                                onClick: () => handleAssign(ta),
                              },
                              {
                                label: t('common.edit'),
                                icon: Edit2,
                                variant: 'edit',
                                onClick: () => handleEdit(ta),
                              },
                              {
                                label: isRTL ? 'إعادة تعيين كلمة المرور' : 'Reset Password',
                                icon: KeyRound,
                                variant: 'edit',
                                onClick: () => setResetPasswordTA(ta),
                              },
                              ...(isSuperAdmin
                                ? [
                                    {
                                      label: t('common.delete'),
                                      icon: Trash2,
                                      variant: 'delete',
                                      onClick: () =>
                                        setDeleteTarget({
                                          id: ta.id,
                                          name: ta.employeeId,
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

      <AddTAModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => {
          setIsAddModalOpen(false);
          showToast(t('teachingAssistants.createSuccess'), 'success');
          fetchTAs();
          fetchStats();
        }}
      />

      {isEditModalOpen && (
        <EditTAModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedTA(null);
          }}
          ta={selectedTA}
          onSuccess={() => {
            setIsEditModalOpen(false);
            setSelectedTA(null);
            showToast(t('teachingAssistants.updateSuccess'), 'success');
            fetchTAs();
            fetchStats();
          }}
        />
      )}

      {isAssignModalOpen && (
        <AssignDoctorModal
          isOpen={isAssignModalOpen}
          onClose={() => {
            setIsAssignModalOpen(false);
            setSelectedTA(null);
          }}
          ta={selectedTA}
          onSuccess={() => {
            fetchTAs();
          }}
        />
      )}

      <ResetPasswordModal
        isOpen={!!resetPasswordTA}
        onClose={() => setResetPasswordTA(null)}
        person={resetPasswordTA ? { ...resetPasswordTA, firstName: resetPasswordTA.employeeId, lastName: '' } : null}
        type="teaching-assistant"
      />
    </div>
  );
};

export default TeachingAssistantsList;
