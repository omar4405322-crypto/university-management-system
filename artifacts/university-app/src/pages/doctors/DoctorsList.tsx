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
import Button from '../../components/ui/button';
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
  Calendar,
  X,
} from 'lucide-react';
import ResetPasswordModal from '../../components/ui/ResetPasswordModal';
import BulkActionToolbar from '../../components/ui/BulkActionToolbar';
import { useNavigate, useSearchParams } from 'react-router-dom';
import collegeService from '../../services/college.service';
import departmentService from '../../services/department.service';
import { logger } from '../../lib/logger';
import { useToast } from '../../context/ToastContext';

const DoctorsList = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { scopeParams, _isCollegeAdmin } = useScope();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const [selectedCollege, setSelectedCollege] = useState(() => searchParams.get('collegeId') || '');
  const [selectedDept, setSelectedDept] = useState(() => searchParams.get('departmentId') || '');
  const [colleges, setColleges] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);

  useEffect(() => {
    const cId = searchParams.get('collegeId');
    const dId = searchParams.get('departmentId');
    if (cId !== null) setSelectedCollege(cId);
    if (dId !== null) setSelectedDept(dId);
  }, [searchParams]);

  useEffect(() => {
    collegeService.getColleges().then((res) => {
      if (res.success) setColleges(Array.isArray(res.data) ? res.data : res.data?.data || []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    departmentService.getDepartments(selectedCollege ? { collegeId: selectedCollege } : {}).then((res) => {
      if (res.success) setDepartments(Array.isArray(res.data) ? res.data : res.data?.data || []);
    }).catch(() => {});
  }, [selectedCollege]);

  const activeFilters = useMemo(() => {
    const obj: Record<string, any> = {};
    if (selectedCollege) obj.collegeId = selectedCollege;
    if (selectedDept) obj.departmentId = selectedDept;
    return obj;
  }, [selectedCollege, selectedDept]);

  const { data: doctors, loading, error, search, setSearch, page, setPage, total, refetch } = useDoctors({
    filters: activeFilters,
  });
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
  const [selectedIds, setSelectedIds] = useState<(string | number)[]>([]);

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
      if (d.user?.role && d.user.role !== 'DOCTOR') return false;
      if (statusFilter === 'all') return true;
      if (statusFilter === 'active') return d.status === 'active';
      if (statusFilter === 'inactive') return d.status === 'inactive';
      if (statusFilter === 'onleave') return d.status === 'on_leave' || d.status === 'onleave';
      return true;
    });
  }, [doctors, statusFilter]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filteredDoctors.map((d: any) => d.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string | number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleBulkClear = () => setSelectedIds([]);

  const handleBulkExport = () => {
    const selectedDocs = filteredDoctors.filter((d: any) => selectedIds.includes(d.id));
    const exportData = selectedDocs.map((d: any) => ({
      ID: d.doctorId || d.id,
      Name: `${d.firstName} ${d.lastName}`,
      Email: d.user?.email || 'N/A',
      Department: d.department?.name || 'N/A',
      Status: d.status || 'active',
    }));
    downloadCsv(exportData, `doctors_selected_${new Date().toISOString().split('T')[0]}.csv`);
    showToast(t('common.exporting', 'Exported selected records'), 'success');
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(t('doctors.confirmBulkDelete', `Are you sure you want to delete ${selectedIds.length} selected doctor(s)?`))) return;
    try {
      for (const id of selectedIds) {
        await doctorsService.deleteDoctor(id);
      }
      showToast(t('doctors.bulkDeleteSuccess', 'Deleted selected doctors'), 'success');
      setSelectedIds([]);
      fetchDoctors();
      fetchStats();
    } catch (_err: any) {
      showToast(t('common.error'), 'error');
    }
  };

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

  const handleEdit = useCallback(async (doctor) => {
    // Start with list data immediately so modal opens fast
    setSelectedDoctor(doctor);
    setIsEditModalOpen(true);
    // Then enrich with full details (includes taughtCourses + department.college)
    try {
      const result = await doctorsService.getDoctorById(doctor.id.toString());
      if (result.success && result.data) {
        setSelectedDoctor(result.data);
      }
    } catch (err) {
      // Non-critical — list data is already shown
    }
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

      {/* ========================================================================= */}
      {/* 1. EXECUTIVE 4-METRIC RIBBON                                              */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
        {/* Total Doctors */}
        <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-semibold block">
              {t('doctors.totalDoctors', 'Total Doctors')}
            </span>
            <span className="text-lg font-black text-slate-900 dark:text-white block mt-0.5 font-mono">
              {stats[0]?.value || filteredDoctors.length}
            </span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-brand-primary-50 dark:bg-brand-primary-950/50 text-brand-primary-600 flex items-center justify-center shrink-0">
            <Users size={16} />
          </div>
        </div>

        {/* Active Faculty */}
        <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-semibold block">
              {t('doctors.activeDoctors', 'Active Faculty')}
            </span>
            <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 block mt-0.5 font-mono">
              {stats[1]?.value || filteredDoctors.filter((d: any) => d.status === 'active' || !d.status).length}
            </span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center shrink-0">
            <UserCheck size={16} />
          </div>
        </div>

        {/* Total Courses Assigned */}
        <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-semibold block">
              {t('doctors.totalCourses', 'Assigned Courses')}
            </span>
            <span className="text-lg font-black text-blue-600 dark:text-blue-400 block mt-0.5 font-mono">
              {stats[2]?.value || '0'}
            </span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center shrink-0">
            <BookOpen size={16} />
          </div>
        </div>

        {/* Research / Projects */}
        <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-semibold block">
              {t('doctors.researchProjects', 'Research & Depts')}
            </span>
            <span className="text-lg font-black text-amber-600 dark:text-amber-400 block mt-0.5 font-mono">
              {stats[3]?.value || '0'}
            </span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center shrink-0">
            <Briefcase size={16} />
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. UNIFIED COMPACT FILTER TOOLBAR                                         */}
      {/* ========================================================================= */}
      <div className="p-2 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-700 shadow-2xs flex flex-wrap items-center gap-2 mb-4">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={t('doctors.searchPlaceholder', 'Search by name, email, or specialization...')}
            className="w-full h-8.5 ps-8 pe-8 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-1.5 focus:ring-brand-primary-500 outline-none bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100"
          />
          {search && (
            <button
              onClick={() => {
                setSearch('');
                setPage(1);
              }}
              className="absolute end-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* College Dropdown */}
        {isSuperAdmin && (
          <select
            value={selectedCollege}
            onChange={(e) => {
              setSelectedCollege(e.target.value);
              setSelectedDept('');
              setPage(1);
              if (e.target.value) {
                setSearchParams({ collegeId: e.target.value });
              } else {
                setSearchParams({});
              }
            }}
            className="h-8.5 px-3 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-brand-primary-500 cursor-pointer"
          >
            <option value="">{t('colleges.allColleges', 'All Colleges')}</option>
            {colleges.map((c) => (
              <option key={c.id} value={c.id}>
                {isRTL ? c.nameAr || c.name : c.name}
              </option>
            ))}
          </select>
        )}

        {/* Department Dropdown */}
        <select
          value={selectedDept}
          onChange={(e) => {
            setSelectedDept(e.target.value);
            setPage(1);
          }}
          className="h-8.5 px-3 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-brand-primary-500 cursor-pointer"
        >
          <option value="">{t('departments.allDepartments', 'All Departments')}</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {isRTL ? d.nameAr || d.name : d.name}
            </option>
          ))}
        </select>

        {/* Status Dropdown */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-8.5 px-3 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-brand-primary-500 cursor-pointer"
        >
          <option value="all">{t('doctors.filterAll', 'All Statuses')}</option>
          <option value="active">{t('doctors.filterActive', 'Active')}</option>
          <option value="onleave">{t('doctors.filterOnLeave', 'On Leave')}</option>
          <option value="inactive">{t('doctors.filterInactive', 'Inactive')}</option>
        </select>

        {/* Clear Filters Button */}
        {(search || selectedCollege || selectedDept || statusFilter !== 'all') && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch('');
              setSelectedCollege('');
              setSelectedDept('');
              setStatusFilter('all');
              setSearchParams({});
              setPage(1);
            }}
            className="h-8.5 px-2.5 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl font-bold cursor-pointer"
          >
            <X size={13} className="me-1" />
            {isRTL ? 'مسح' : 'Clear'}
          </Button>
        )}

        {/* Export CSV Button */}
        <Button
          variant="outline"
          size="sm"
          disabled={exporting}
          onClick={handleExportCsv}
          className="h-8.5 px-3 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer shadow-2xs ms-auto"
        >
          <Download size={13} className="text-slate-500" />
          <span>{exporting ? t('common.loading') : t('doctors.exportCsv', 'Export CSV')}</span>
        </Button>
      </div>

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
                    <TableHead className="w-12 text-center p-4">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 dark:border-slate-700 text-brand-green focus:ring-brand-green/20 w-4 h-4 cursor-pointer align-middle"
                        checked={filteredDoctors.length > 0 && selectedIds.length === filteredDoctors.length}
                        onChange={handleSelectAll}
                      />
                    </TableHead>
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
                    const isSelected = selectedIds.includes(doctor.id);
                    
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
                        className={`hover:bg-slate-50 dark:hover:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 last:border-b-0 transition-colors ${isSelected ? 'bg-brand-primary-500/5 dark:bg-brand-primary-500/10' : ''}`}
                      >
                        <TableCell className="w-12 text-center p-4" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            className="rounded border-slate-300 dark:border-slate-700 text-brand-green focus:ring-brand-green/20 w-4 h-4 cursor-pointer align-middle"
                            checked={isSelected}
                            onChange={() => handleSelectOne(doctor.id)}
                          />
                        </TableCell>
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
                                label: t('common.view', 'View'),
                                icon: Eye,
                                variant: 'view',
                                onClick: () => navigate(`/doctors/${doctor.id}`),
                              },
                              {
                                label: isRTL ? 'عرض الجدول' : 'View Schedule',
                                icon: Calendar,
                                variant: 'view',
                                onClick: () => navigate(`/schedules/doctor?doctorId=${doctor.id}`),
                              },
                              {
                                label: t('common.edit'),
                                icon: Edit2,
                                variant: 'edit',
                                onClick: () => handleEdit(doctor),
                              },
                              {
                                label: isRTL ? 'إعادة تعيين كلمة المرور' : 'Reset Password',
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

      <BulkActionToolbar
        selectedCount={selectedIds.length}
        onClear={handleBulkClear}
        onExport={handleBulkExport}
        onDelete={isSuperAdmin ? handleBulkDelete : undefined}
      />
    </div>
  );
};

export default DoctorsList;
