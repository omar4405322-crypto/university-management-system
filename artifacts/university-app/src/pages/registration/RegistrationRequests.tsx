// @ts-nocheck
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  Download,
  RotateCw,
  LayoutGrid,
  LayoutList,
  Eye,
  Check,
  X,
  Building2,
  GraduationCap,
  Calendar,
  Mail,
  Phone,
  AlertTriangle,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  UserCheck,
  FileSpreadsheet,
  Trash2,
} from 'lucide-react';

import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/button';
import Modal from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { EmptyState } from '../../components/ui/EmptyState';
import ConfirmDeleteModal from '../../components/ui/ConfirmDeleteModal';
import Table, {
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../../components/ui/Table';
import BulkActionToolbar from '../../components/ui/BulkActionToolbar';
import registrationService from '../../services/registration.service';
import collegeService from '../../services/college.service';
import { useToast } from '../../context/ToastContext';
import { useNotifications } from '../../context/NotificationContext';
import { downloadCsv } from '../../utils/exportCsv';
import { logger } from '../../lib/logger';

type StatusFilterType = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL';
type ViewModeType = 'table' | 'cards';

const PRESET_REASONS = [
  'registration.rejectionReasonPreset1',
  'registration.rejectionReasonPreset2',
  'registration.rejectionReasonPreset3',
  'registration.rejectionReasonPreset4',
];

const RegistrationRequests: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { showToast } = useToast();
  const { fetchPendingRequestsCount } = useNotifications();

  // Data states
  const [requests, setRequests] = useState<any[]>([]);
  const [colleges, setColleges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filter & Search states - DEFAULT TO 'PENDING' FOR INBOX ZERO WORKFLOW
  const [statusFilter, setStatusFilter] = useState<StatusFilterType>('PENDING');
  const [search, setSearch] = useState('');
  const [selectedCollege, setSelectedCollege] = useState('ALL');
  const [selectedRole, setSelectedRole] = useState('ALL');
  const [viewMode, setViewMode] = useState<ViewModeType>('table');

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  // Batch selection states
  const [selectedIds, setSelectedIds] = useState<(string | number)[]>([]);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // Single action states
  const [actionLoadingId, setActionLoadingId] = useState<string | number | null>(null);

  // Modals
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  const [rejectTarget, setRejectTarget] = useState<any>(null);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [selectedPresetReason, setSelectedPresetReason] = useState<string>('');
  const [customRejectionReason, setCustomRejectionReason] = useState<string>('');

  // Delete states
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    const mainEl = document.querySelector('main');
    if (mainEl) {
      mainEl.classList.add('bg-slate-50', 'dark:bg-slate-900');
      return () => {
        mainEl.classList.remove('bg-slate-50', 'dark:bg-slate-900');
      };
    }
  }, []);

  const fetchRequests = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const [resRequests, resColleges] = await Promise.all([
        registrationService.getRequests(),
        collegeService.getColleges().catch(() => ({ success: false, data: [] })),
      ]);

      if (resRequests.success && Array.isArray(resRequests.data)) {
        setRequests(resRequests.data);
      } else {
        setRequests([]);
      }

      if (resColleges.success && Array.isArray(resColleges.data)) {
        setColleges(resColleges.data);
      }
    } catch (error: any) {
      logger.error('Error fetching registration requests:', error);
      showToast(t('common.errorFetching', 'Error fetching data'), 'error');
      setRequests([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
      fetchPendingRequestsCount();
    }
  }, [showToast, t, fetchPendingRequestsCount]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Derived KPI Counts
  const counts = useMemo(() => {
    const total = requests.length;
    const pending = requests.filter((r) => r.status === 'PENDING').length;
    const approved = requests.filter((r) => r.status === 'APPROVED').length;
    const rejected = requests.filter((r) => r.status === 'REJECTED').length;
    return { total, pending, approved, rejected };
  }, [requests]);

  // Reset page and selection when filters change
  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds([]);
  }, [search, statusFilter, selectedCollege, selectedRole]);

  // Filtered requests
  const filteredRequests = useMemo(() => {
    const query = search.trim().toLowerCase();

    return requests.filter((req) => {
      // Status filter
      if (statusFilter !== 'ALL' && req.status !== statusFilter) {
        return false;
      }

      // College filter
      if (selectedCollege !== 'ALL') {
        const collegeId = req.department?.collegeId || req.department?.college?.id;
        if (String(collegeId) !== String(selectedCollege)) {
          return false;
        }
      }

      // Role filter
      if (selectedRole !== 'ALL' && req.role !== selectedRole) {
        return false;
      }

      // Search query
      if (query) {
        const fullName = `${req.firstName || ''} ${req.lastName || ''}`.toLowerCase();
        const email = (req.email || '').toLowerCase();
        const studentId = (req.studentId || '').toLowerCase();
        const collegeName = (req.department?.college?.name || '').toLowerCase();
        const deptName = (req.department?.name || '').toLowerCase();

        return (
          fullName.includes(query) ||
          email.includes(query) ||
          studentId.includes(query) ||
          collegeName.includes(query) ||
          deptName.includes(query)
        );
      }

      return true;
    });
  }, [requests, statusFilter, selectedCollege, selectedRole, search]);

  // Paginated requests
  const totalPages = Math.ceil(filteredRequests.length / pageSize) || 1;
  const paginatedRequests = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRequests.slice(start, start + pageSize);
  }, [filteredRequests, currentPage, pageSize]);

  // Selection handlers
  const isAllVisibleSelected =
    paginatedRequests.length > 0 &&
    paginatedRequests.every((req) => selectedIds.includes(req.id));

  const handleSelectAll = () => {
    if (isAllVisibleSelected) {
      const visibleIds = new Set(paginatedRequests.map((r) => r.id));
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.has(id)));
    } else {
      const visibleIds = paginatedRequests.map((r) => r.id);
      setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const handleSelectOne = (id: string | number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Actions: Approve
  const handleApprove = async (id: string | number) => {
    try {
      setActionLoadingId(id);
      const result = await registrationService.approveRequest(id);
      if (result.success) {
        showToast(t('registration.approveSuccess', 'Request approved successfully'), 'success');
        await fetchRequests();
      }
    } catch (error: any) {
      showToast(
        error.response?.data?.message || t('registration.approveError', 'Error approving request'),
        'error'
      );
    } finally {
      setActionLoadingId(null);
    }
  };

  // Actions: Open Reject Modal
  const handleOpenRejectModal = (req: any) => {
    setRejectTarget(req);
    setSelectedPresetReason(PRESET_REASONS[0]);
    setCustomRejectionReason('');
    setIsRejectModalOpen(true);
  };

  // Actions: Confirm Reject
  const handleConfirmReject = async () => {
    if (!rejectTarget) return;

    const finalReason =
      customRejectionReason.trim() ||
      (selectedPresetReason ? t(selectedPresetReason) : t('registration.rejectionReasonPreset1'));

    try {
      setActionLoadingId(rejectTarget.id);
      const result = await registrationService.rejectRequest(rejectTarget.id, finalReason);
      if (result.success) {
        showToast(t('registration.rejectSuccess', 'Request rejected successfully'), 'success');
        setIsRejectModalOpen(false);
        setRejectTarget(null);
        if (isDetailsModalOpen && selectedRequest?.id === rejectTarget.id) {
          setIsDetailsModalOpen(false);
        }
        await fetchRequests();
      }
    } catch (error: any) {
      showToast(
        error.response?.data?.message || t('registration.rejectError', 'Error rejecting request'),
        'error'
      );
    } finally {
      setActionLoadingId(null);
    }
  };

  // Batch Actions: Bulk Approve
  const handleBulkApprove = async () => {
    if (selectedIds.length === 0) return;
    const pendingSelected = requests.filter(
      (r) => selectedIds.includes(r.id) && r.status === 'PENDING'
    );

    if (pendingSelected.length === 0) {
      showToast(
        isRTL
          ? 'الطلبات المحددة تمت معالجتها مسبقاً'
          : 'Selected requests are already processed',
        'info'
      );
      return;
    }

    try {
      setBulkActionLoading(true);
      let successCount = 0;
      for (const req of pendingSelected) {
        try {
          const res = await registrationService.approveRequest(req.id);
          if (res.success) successCount++;
        } catch (e) {
          logger.error(`Failed to bulk approve request #${req.id}`, e);
        }
      }

      showToast(
        t('registration.bulkApproveSuccess', {
          count: successCount,
          defaultValue: `تمت الموافقة على ${successCount} طلبات بنجاح`,
        }),
        'success'
      );
      setSelectedIds([]);
      await fetchRequests();
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Batch Actions: Bulk Reject
  const handleBulkReject = async () => {
    if (selectedIds.length === 0) return;
    const pendingSelected = requests.filter(
      (r) => selectedIds.includes(r.id) && r.status === 'PENDING'
    );

    if (pendingSelected.length === 0) {
      showToast(
        isRTL
          ? 'الطلبات المحددة تمت معالجتها مسبقاً'
          : 'Selected requests are already processed',
        'info'
      );
      return;
    }

    if (
      !window.confirm(
        isRTL
          ? `هل أنت متأكد من رفض ${pendingSelected.length} طلبات تسجيل محددة؟`
          : `Are you sure you want to reject ${pendingSelected.length} selected requests?`
      )
    ) {
      return;
    }

    try {
      setBulkActionLoading(true);
      let successCount = 0;
      for (const req of pendingSelected) {
        try {
          const res = await registrationService.rejectRequest(
            req.id,
            isRTL ? 'تم الرفض بواسطة الإدارة' : 'Rejected via administrative bulk action'
          );
          if (res.success) successCount++;
        } catch (e) {
          logger.error(`Failed to bulk reject request #${req.id}`, e);
        }
      }

      showToast(
        t('registration.bulkRejectSuccess', {
          count: successCount,
          defaultValue: `تم رفض ${successCount} طلبات بنجاح`,
        }),
        'success'
      );
      setSelectedIds([]);
      await fetchRequests();
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Actions: Single Delete
  const handleDeleteClick = (req: any) => {
    setDeleteTarget(req);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmSingleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleteLoading(true);
      const res = await registrationService.deleteRequest(deleteTarget.id);
      if (res.success) {
        showToast(t('registration.deleteSuccess', 'Registration request deleted successfully'), 'success');
        setIsDeleteModalOpen(false);
        setDeleteTarget(null);
        if (isDetailsModalOpen && selectedRequest?.id === deleteTarget.id) {
          setIsDetailsModalOpen(false);
        }
        await fetchRequests();
      }
    } catch (error: any) {
      showToast(
        error.response?.data?.message || t('registration.deleteError', 'Error deleting registration request'),
        'error'
      );
    } finally {
      setDeleteLoading(false);
    }
  };

  // Actions: Bulk Delete
  const handleConfirmBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    try {
      setDeleteLoading(true);
      let successCount = 0;
      for (const id of selectedIds) {
        try {
          const res = await registrationService.deleteRequest(id);
          if (res.success) successCount++;
        } catch (e) {
          logger.error(`Failed to delete request #${id}`, e);
        }
      }

      showToast(
        t('registration.bulkDeleteSuccess', {
          count: successCount,
          defaultValue: `تم حذف ${successCount} طلبات تسجيل بنجاح`,
        }),
        'success'
      );
      setShowBulkDeleteModal(false);
      setSelectedIds([]);
      await fetchRequests();
    } finally {
      setDeleteLoading(false);
    }
  };

  // Export to CSV
  const handleExportCsv = () => {
    const listToExport =
      selectedIds.length > 0
        ? requests.filter((r) => selectedIds.includes(r.id))
        : filteredRequests;

    if (listToExport.length === 0) {
      showToast(isRTL ? 'لا توجد بيانات لتصديرها' : 'No data to export', 'info');
      return;
    }

    const headers = isRTL
      ? [
          'رقم الطلب',
          'الاسم الأول',
          'اسم العائلة',
          'البريد الإلكتروني',
          'رقم الهاتف',
          'الرقم الأكاديمي',
          'الدور',
          'الكلية',
          'القسم',
          'السنة الدراسية',
          'الحالة',
          'سبب الرفض',
          'تاريخ التقديم',
        ]
      : [
          'Request ID',
          'First Name',
          'Last Name',
          'Email',
          'Phone',
          'Student ID',
          'Role',
          'College',
          'Department',
          'Academic Year',
          'Status',
          'Rejection Reason',
          'Applied Date',
        ];

    const rows = listToExport.map((req) => [
      req.id,
      req.firstName || '',
      req.lastName || '',
      req.email || '',
      req.phone || '',
      req.studentId || '',
      req.role || '',
      req.department?.college?.name || req.department?.college?.nameAr || '',
      req.department?.name || req.department?.nameAr || '',
      req.year ? `Year ${req.year}` : '',
      req.status || '',
      req.rejectionReason || '',
      req.createdAt ? new Date(req.createdAt).toISOString().split('T')[0] : '',
    ]);

    const filename = `${t('registration.exportFileName', 'Registration_Requests')}_${
      new Date().toISOString().split('T')[0]
    }.csv`;

    downloadCsv(filename, headers, rows);
    showToast(isRTL ? 'تم تصدير ملف CSV بنجاح' : 'CSV file exported successfully', 'success');
  };

  const handleView = (req: any) => {
    setSelectedRequest(req);
    setIsDetailsModalOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return {
          label: isRTL ? 'تمت الموافقة' : 'Approved',
          icon: CheckCircle2,
          className:
            'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50',
          dotClass: 'bg-emerald-500',
        };
      case 'PENDING':
        return {
          label: isRTL ? 'بانتظار المراجعة' : 'Pending',
          icon: Clock,
          className:
            'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50',
          dotClass: 'bg-amber-500 animate-pulse',
        };
      case 'REJECTED':
        return {
          label: isRTL ? 'مرفوض' : 'Rejected',
          icon: XCircle,
          className:
            'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50',
          dotClass: 'bg-rose-500',
        };
      default:
        return {
          label: status,
          icon: Clock,
          className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
          dotClass: 'bg-slate-400',
        };
    }
  };

  return (
    <div className="section-gap animate-page pt-4 pb-12 space-y-6">
      {/* 1. Page Header with Action Bar */}
      <PageHeader
        title={
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-brand-primary-50 dark:bg-brand-primary-950/40 text-brand-primary-600 dark:text-brand-primary-400 border border-brand-primary-200/50 dark:border-brand-primary-800/40 shadow-xs">
              <GraduationCap size={26} />
            </div>
            <div>
              <span className="font-extrabold text-slate-900 dark:text-white text-2xl sm:text-3xl tracking-tight">
                {t('registration.title', 'Registration Requests')}
              </span>
              {counts.pending > 0 && (
                <span className="ms-2.5 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-white shadow-xs animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                  {counts.pending} {isRTL ? 'جديد' : 'New'}
                </span>
              )}
            </div>
          </div>
        }
        subtitle={
          <span className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed block mt-1">
            {t('registration.subtitle', 'Review and manage student registration and enrollment applications.')}
          </span>
        }
        extraActions={
          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchRequests(true)}
              disabled={refreshing}
              className="h-10 px-4 rounded-xl border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs gap-2 shrink-0 shadow-2xs cursor-pointer"
            >
              <RotateCw size={15} className={refreshing ? 'animate-spin text-brand-primary-500' : ''} />
              <span>{isRTL ? 'تحديث' : 'Refresh'}</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              className="h-10 px-4 rounded-xl border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs gap-2 shrink-0 shadow-2xs cursor-pointer"
            >
              <Download size={15} />
              <span>{t('registration.export', 'Export CSV')}</span>
            </Button>
          </div>
        }
      />

      {/* ========================================================================= */}
      {/* 2. EXECUTIVE 4-METRIC RIBBON                                              */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
        {/* PENDING CARD (Inbox Queue) */}
        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'PENDING' ? 'ALL' : 'PENDING')}
          className={`p-3 rounded-2xl border transition-all text-start flex items-center justify-between cursor-pointer ${
            statusFilter === 'PENDING'
              ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-400 dark:border-amber-600 ring-2 ring-amber-500/20 shadow-xs'
              : 'bg-white dark:bg-slate-800 border-slate-200/90 dark:border-slate-700 shadow-2xs hover:border-amber-300'
          }`}
        >
          <div>
            <span className="text-[10px] text-slate-400 font-semibold block">
              {t('registration.pendingReview', 'Pending Review')}
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-lg font-black text-amber-600 dark:text-amber-400 font-mono">
                {counts.pending}
              </span>
              {counts.pending > 0 && (
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
              )}
            </div>
          </div>
          <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center shrink-0">
            <Clock size={16} />
          </div>
        </button>

        {/* APPROVED CARD */}
        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'APPROVED' ? 'ALL' : 'APPROVED')}
          className={`p-3 rounded-2xl border transition-all text-start flex items-center justify-between cursor-pointer ${
            statusFilter === 'APPROVED'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-600 ring-2 ring-emerald-500/20 shadow-xs'
              : 'bg-white dark:bg-slate-800 border-slate-200/90 dark:border-slate-700 shadow-2xs hover:border-emerald-300'
          }`}
        >
          <div>
            <span className="text-[10px] text-slate-400 font-semibold block">
              {t('registration.approvedTotal', 'Approved Requests')}
            </span>
            <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 block mt-0.5 font-mono">
              {counts.approved}
            </span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 size={16} />
          </div>
        </button>

        {/* REJECTED CARD */}
        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'REJECTED' ? 'ALL' : 'REJECTED')}
          className={`p-3 rounded-2xl border transition-all text-start flex items-center justify-between cursor-pointer ${
            statusFilter === 'REJECTED'
              ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-400 dark:border-rose-600 ring-2 ring-rose-500/20 shadow-xs'
              : 'bg-white dark:bg-slate-800 border-slate-200/90 dark:border-slate-700 shadow-2xs hover:border-rose-300'
          }`}
        >
          <div>
            <span className="text-[10px] text-slate-400 font-semibold block">
              {t('registration.rejectedTotal', 'Rejected Requests')}
            </span>
            <span className="text-lg font-black text-rose-600 dark:text-rose-400 block mt-0.5 font-mono">
              {counts.rejected}
            </span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 flex items-center justify-center shrink-0">
            <XCircle size={16} />
          </div>
        </button>

        {/* TOTAL CARD */}
        <button
          type="button"
          onClick={() => setStatusFilter('ALL')}
          className={`p-3 rounded-2xl border transition-all text-start flex items-center justify-between cursor-pointer ${
            statusFilter === 'ALL'
              ? 'bg-brand-primary-50 dark:bg-brand-primary-950/40 border-brand-primary-400 dark:border-brand-primary-600 ring-2 ring-brand-primary-500/20 shadow-xs'
              : 'bg-white dark:bg-slate-800 border-slate-200/90 dark:border-slate-700 shadow-2xs hover:border-brand-primary-300'
          }`}
        >
          <div>
            <span className="text-[10px] text-slate-400 font-semibold block">
              {t('registration.totalRegistrations', 'Total Registrations')}
            </span>
            <span className="text-lg font-black text-brand-primary-600 dark:text-brand-primary-400 block mt-0.5 font-mono">
              {counts.total}
            </span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-brand-primary-50 dark:bg-brand-primary-950/50 text-brand-primary-600 flex items-center justify-center shrink-0">
            <Users size={16} />
          </div>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 3. UNIFIED COMPACT FILTER TOOLBAR                                         */}
      {/* ========================================================================= */}
      <div className="p-2 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-700 shadow-2xs flex flex-wrap items-center gap-2 mb-4">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={t('registration.searchPlaceholder', 'Search by name, email, or student ID...')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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

        {/* College Filter */}
        <select
          value={selectedCollege}
          onChange={(e) => setSelectedCollege(e.target.value)}
          className="h-8.5 px-3 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-brand-primary-500 cursor-pointer"
        >
          <option value="ALL">{t('registration.allColleges', 'All Colleges')}</option>
          {colleges.map((c) => (
            <option key={c.id} value={c.id}>
              {isRTL ? c.nameAr || c.name : c.name}
            </option>
          ))}
        </select>

        {/* Role Filter */}
        <select
          value={selectedRole}
          onChange={(e) => setSelectedRole(e.target.value)}
          className="h-8.5 px-3 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-brand-primary-500 cursor-pointer"
        >
          <option value="ALL">{t('registration.allRoles', 'All Roles')}</option>
          <option value="STUDENT">{t('roles.STUDENT', 'Student')}</option>
          <option value="DOCTOR">{t('roles.DOCTOR', 'Professor')}</option>
        </select>

        {/* Clear Filters Button */}
        {(search || selectedCollege !== 'ALL' || selectedRole !== 'ALL' || statusFilter !== 'ALL') && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch('');
              setSelectedCollege('ALL');
              setSelectedRole('ALL');
              setStatusFilter('ALL');
            }}
            className="h-8.5 px-2.5 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl font-bold cursor-pointer"
          >
            <X size={13} className="me-1" />
            {isRTL ? 'مسح' : 'Clear'}
          </Button>
        )}

        {/* View Mode Switcher */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-900/80 p-0.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 ms-auto">
          <button
            onClick={() => setViewMode('table')}
            title={t('registration.tableView', 'Table View')}
            className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 text-xs font-bold ${
              viewMode === 'table'
                ? 'bg-white dark:bg-slate-700 text-brand-primary-600 dark:text-brand-primary-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <LayoutList size={13} />
            <span className="hidden sm:inline">{isRTL ? 'جدول' : 'Table'}</span>
          </button>
          <button
            onClick={() => setViewMode('cards')}
            title={t('registration.cardView', 'Card View')}
            className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 text-xs font-bold ${
              viewMode === 'cards'
                ? 'bg-white dark:bg-slate-700 text-brand-primary-600 dark:text-brand-primary-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <LayoutGrid size={13} />
            <span className="hidden sm:inline">{isRTL ? 'بطاقات' : 'Cards'}</span>
          </button>
        </div>
      </div>

      {/* 4. Main List View (Inbox / Table / Grid) */}
      <div className="min-h-[350px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-72 gap-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
            <div className="animate-spin rounded-full h-10 w-10 border-3 border-brand-primary-500/20 border-t-brand-primary-600"></div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
              {t('common.loading', 'Loading...')}
            </p>
          </div>
        ) : filteredRequests.length === 0 ? (
          /* Empty State */
          <div className="p-12 flex flex-col items-center justify-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xs text-center">
            {statusFilter === 'PENDING' && !search && selectedCollege === 'ALL' && selectedRole === 'ALL' ? (
              /* Celebration / All Caught Up State */
              <div className="space-y-3 max-w-md">
                <div className="w-16 h-16 rounded-3xl bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-sm">
                  <Sparkles size={32} />
                </div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  {t('registration.noPendingTitle', 'All caught up! No pending requests')}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {t('registration.noPendingDesc', 'All incoming registration applications have been reviewed and processed.')}
                </p>
                <div className="pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setStatusFilter('ALL')}
                    className="rounded-xl text-xs font-bold"
                  >
                    {t('requests.filterAll', 'All')}
                  </Button>
                </div>
              </div>
            ) : (
              <EmptyState
                icon={<GraduationCap size={44} className="text-slate-400 dark:text-slate-500" />}
                title={t('registration.noRequests', 'No registration requests found')}
                subtitle={t('registration.noRequestsDesc', 'No registration records match the current filter criteria.')}
                action={
                  search || selectedCollege !== 'ALL' || selectedRole !== 'ALL'
                    ? {
                        label: isRTL ? 'مسح الفلاتر والبحث' : 'Clear Filters',
                        onClick: () => {
                          setSearch('');
                          setSelectedCollege('ALL');
                          setSelectedRole('ALL');
                        },
                      }
                    : undefined
                }
              />
            )}
          </div>
        ) : viewMode === 'table' ? (
          /* ============================================================ */
          /* 4A. TABLE VIEW (High Density, Fast Processing)               */
          /* ============================================================ */
          <Card className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-700 shadow-xs overflow-hidden p-0">
            <div className="overflow-x-auto">
              <Table className="w-full">
                <TableHeader className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200/80 dark:border-slate-700/80">
                  <TableRow>
                    <TableHead className="w-12 text-center p-3.5">
                      <input
                        type="checkbox"
                        aria-label={isRTL ? 'تحديد الكل' : 'Select all'}
                        className="rounded border-slate-300 dark:border-slate-700 text-brand-primary-600 focus:ring-brand-primary-500/20 w-4 h-4 cursor-pointer align-middle"
                        checked={isAllVisibleSelected}
                        onChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead className="text-start p-3.5 font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {isRTL ? 'مقدم الطلب' : 'Applicant'}
                    </TableHead>
                    <TableHead className="text-start p-3.5 font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {isRTL ? 'الكلية والقسم' : 'College & Dept'}
                    </TableHead>
                    <TableHead className="text-center p-3.5 font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {isRTL ? 'الرقم الأكاديمي' : 'Student ID'}
                    </TableHead>
                    <TableHead className="text-center p-3.5 font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {isRTL ? 'تاريخ التقديم' : 'Applied Date'}
                    </TableHead>
                    <TableHead className="text-center p-3.5 font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {isRTL ? 'الحالة' : 'Status'}
                    </TableHead>
                    <TableHead className="text-end p-3.5 font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 pe-6">
                      {isRTL ? 'الإجراءات' : 'Actions'}
                    </TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {paginatedRequests.map((req) => {
                    const isSelected = selectedIds.includes(req.id);
                    const statusConfig = getStatusBadge(req.status);
                    const collegeName = req.department?.college?.name || req.department?.college?.nameAr;
                    const deptName = req.department?.name || req.department?.nameAr;
                    const isActioning = actionLoadingId === req.id;

                    return (
                      <TableRow
                        key={req.id}
                        className={`transition-colors hover:bg-slate-50/75 dark:hover:bg-slate-700/30 ${
                          isSelected ? 'bg-brand-primary-50/40 dark:bg-brand-primary-950/20' : ''
                        }`}
                      >
                        {/* Checkbox */}
                        <TableCell className="w-12 text-center p-3.5">
                          <input
                            type="checkbox"
                            aria-label={isRTL ? `تحديد ${req.firstName} ${req.lastName}` : `Select ${req.firstName} ${req.lastName}`}
                            className="rounded border-slate-300 dark:border-slate-700 text-brand-primary-600 focus:ring-brand-primary-500/20 w-4 h-4 cursor-pointer align-middle"
                            checked={isSelected}
                            onChange={() => handleSelectOne(req.id)}
                          />
                        </TableCell>

                        {/* Applicant Name & Email */}
                        <TableCell className="p-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-primary-500 to-brand-primary-600 text-white font-bold text-xs flex items-center justify-center shadow-xs shrink-0">
                              {req.firstName?.[0] || 'U'}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-900 dark:text-white text-sm truncate">
                                  {req.firstName} {req.lastName}
                                </span>
                                {req.role && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] px-1.5 py-0 rounded-md font-semibold border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                                  >
                                    {req.role}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-400 mt-0.5">
                                <span className="truncate">{req.email}</span>
                                {req.phone && (
                                  <>
                                    <span>•</span>
                                    <span>{req.phone}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </TableCell>

                        {/* College & Department */}
                        <TableCell className="p-3.5">
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 truncate">
                              <Building2 size={13} className="text-slate-400 shrink-0" />
                              <span className="truncate">{collegeName || (isRTL ? 'غير محدد' : 'Not assigned')}</span>
                            </div>
                            <div className="text-[11px] text-slate-400 ps-4 truncate">
                              {deptName || (isRTL ? 'غير محدد' : 'General')}
                            </div>
                          </div>
                        </TableCell>

                        {/* Student ID / Year */}
                        <TableCell className="p-3.5 text-center">
                          {req.studentId ? (
                            <div className="space-y-0.5 inline-block">
                              <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-700/60 px-2 py-0.5 rounded-md block">
                                {req.studentId}
                              </span>
                              {req.year && (
                                <span className="text-[10px] text-slate-400 block font-medium">
                                  {isRTL ? `السنة ${req.year}` : `Year ${req.year}`}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">-</span>
                          )}
                        </TableCell>

                        {/* Applied Date */}
                        <TableCell className="p-3.5 text-center">
                          <span className="text-xs font-medium text-slate-600 dark:text-slate-300 block">
                            {req.createdAt
                              ? new Date(req.createdAt).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US')
                              : '-'}
                          </span>
                        </TableCell>

                        {/* Status Badge */}
                        <TableCell className="p-3.5 text-center">
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border shadow-2xs">
                            <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dotClass}`}></span>
                            <span className={statusConfig.className.split(' ')[1] || ''}>
                              {statusConfig.label}
                            </span>
                          </div>
                          {req.status === 'REJECTED' && req.rejectionReason && (
                            <p className="text-[10px] text-rose-500 dark:text-rose-400 mt-1 max-w-[140px] truncate mx-auto" title={req.rejectionReason}>
                              {req.rejectionReason}
                            </p>
                          )}
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="p-3.5 text-end pe-4">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleView(req)}
                              title={t('common.view', 'View')}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-brand-primary-600 hover:bg-brand-primary-50 dark:hover:bg-brand-primary-950/30 transition-colors cursor-pointer"
                            >
                              <Eye size={16} />
                            </button>

                            {req.status === 'PENDING' && (
                              <>
                                <button
                                  onClick={() => handleOpenRejectModal(req)}
                                  disabled={isActioning}
                                  title={t('common.reject', 'Reject')}
                                  className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer disabled:opacity-50"
                                >
                                  <X size={16} />
                                </button>
                                <button
                                  onClick={() => handleApprove(req.id)}
                                  disabled={isActioning}
                                  title={t('common.approve', 'Approve')}
                                  className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors cursor-pointer disabled:opacity-50"
                                >
                                  {isActioning ? (
                                    <RotateCw size={16} className="animate-spin" />
                                  ) : (
                                    <Check size={16} />
                                  )}
                                </button>
                              </>
                            )}

                            <button
                              onClick={() => handleDeleteClick(req)}
                              title={t('registration.deleteRequest', 'Delete Request')}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>
        ) : (
          /* ============================================================ */
          /* 4B. MODERN CARD VIEW (Grid)                                  */
          /* ============================================================ */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in duration-300">
            {paginatedRequests.map((req) => {
              const isSelected = selectedIds.includes(req.id);
              const statusConfig = getStatusBadge(req.status);
              const isActioning = actionLoadingId === req.id;
              const collegeName = req.department?.college?.name || req.department?.college?.nameAr;
              const deptName = req.department?.name || req.department?.nameAr;

              return (
                <Card
                  key={req.id}
                  noPadding
                  className={`bg-white dark:bg-slate-800 rounded-2xl border transition-all duration-200 p-5 flex flex-col justify-between shadow-xs hover:shadow-md ${
                    isSelected
                      ? 'border-brand-primary-500 ring-2 ring-brand-primary-500/20'
                      : 'border-slate-200/90 dark:border-slate-700'
                  }`}
                >
                  <div>
                    {/* Header: Checkbox, ID & Status Badge */}
                    <div className="flex items-center justify-between gap-2 mb-3.5">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          aria-label={isRTL ? `تحديد ${req.firstName} ${req.lastName}` : `Select ${req.firstName} ${req.lastName}`}
                          className="rounded border-slate-300 dark:border-slate-700 text-brand-primary-600 focus:ring-brand-primary-500/20 w-4 h-4 cursor-pointer align-middle"
                          checked={isSelected}
                          onChange={() => handleSelectOne(req.id)}
                        />
                        <span className="text-xs font-mono font-bold text-slate-400">#{req.id}</span>
                      </div>
                      <div
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${statusConfig.className}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dotClass}`}></span>
                        <span>{statusConfig.label}</span>
                      </div>
                    </div>

                    {/* Applicant Profile */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-brand-primary-500 to-brand-primary-600 text-white font-bold text-sm flex items-center justify-center shadow-xs shrink-0">
                        {req.firstName?.[0] || 'U'}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-base font-extrabold text-slate-900 dark:text-white truncate">
                          {req.firstName} {req.lastName}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5 font-medium">
                          {req.email}
                        </p>
                      </div>
                    </div>

                    {/* Info Grid */}
                    <div className="bg-slate-50 dark:bg-slate-900/60 rounded-xl p-3 border border-slate-100 dark:border-slate-700/60 space-y-2 mb-4 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-400 font-medium">{t('auth.college', 'College')}:</span>
                        <span className="font-bold text-slate-700 dark:text-slate-200 truncate max-w-[170px]" title={collegeName || 'N/A'}>
                          {collegeName || (isRTL ? 'غير محدد' : 'N/A')}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-400 font-medium">{t('auth.department', 'Department')}:</span>
                        <span className="font-bold text-slate-700 dark:text-slate-200 truncate max-w-[170px]" title={deptName || 'N/A'}>
                          {deptName || (isRTL ? 'عام' : 'General')}
                        </span>
                      </div>
                      {req.studentId && (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-slate-400 font-medium">{t('auth.studentId', 'Student ID Number')}:</span>
                          <span className="font-mono font-bold text-brand-primary-600 dark:text-brand-primary-400">
                            {req.studentId}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/50 dark:border-slate-700/50">
                        <span className="text-slate-400 font-medium">{t('registration.appliedDate', 'Applied Date')}:</span>
                        <span className="font-medium text-slate-600 dark:text-slate-300">
                          {req.createdAt ? new Date(req.createdAt).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US') : '-'}
                        </span>
                      </div>
                    </div>

                    {/* Rejection Note Preview */}
                    {req.status === 'REJECTED' && req.rejectionReason && (
                      <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/40 text-xs text-rose-700 dark:text-rose-300 mb-4 flex items-start gap-2">
                        <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                        <p className="line-clamp-2">{req.rejectionReason}</p>
                      </div>
                    )}
                  </div>

                  {/* Actions Footer */}
                  <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-700/60 mt-auto">
                    <button
                      onClick={() => handleView(req)}
                      className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer"
                    >
                      <Eye size={14} />
                      <span>{t('common.view', 'View')}</span>
                    </button>

                    {req.status === 'PENDING' && (
                      <>
                        <button
                          onClick={() => handleOpenRejectModal(req)}
                          disabled={isActioning}
                          className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                        >
                          <X size={14} />
                          <span>{t('common.reject', 'Reject')}</span>
                        </button>
                        <button
                          onClick={() => handleApprove(req.id)}
                          disabled={isActioning}
                          className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl bg-brand-primary-500 hover:bg-brand-primary-600 text-white text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer disabled:opacity-50"
                        >
                          {isActioning ? (
                            <RotateCw size={14} className="animate-spin" />
                          ) : (
                            <Check size={14} />
                          )}
                          <span>{t('common.approve', 'Approve')}</span>
                        </button>
                      </>
                    )}

                    <button
                      onClick={() => handleDeleteClick(req)}
                      title={t('registration.deleteRequest', 'Delete Request')}
                      className="h-9 px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-rose-300 dark:hover:border-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 text-xs font-bold transition-all cursor-pointer flex items-center justify-center"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* 5. Pagination Footer */}
        {filteredRequests.length > 0 && totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-6 border-t border-slate-200/80 dark:border-slate-700 mt-6">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isRTL ? (
                <>
                  عرض <span className="font-bold text-slate-800 dark:text-slate-200">{paginatedRequests.length}</span> من أصل{' '}
                  <span className="font-bold text-brand-primary-500">{filteredRequests.length}</span> طلب
                </>
              ) : (
                <>
                  Showing <span className="font-bold text-slate-800 dark:text-slate-200">{paginatedRequests.length}</span> of{' '}
                  <span className="font-bold text-brand-primary-500">{filteredRequests.length}</span> requests
                </>
              )}
            </p>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40 transition-colors cursor-pointer"
              >
                <ChevronLeft size={16} className={isRTL ? 'rotate-180' : ''} />
              </button>

              <span className="px-3 text-xs font-bold text-slate-700 dark:text-slate-300">
                {currentPage} / {totalPages}
              </span>

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40 transition-colors cursor-pointer"
              >
                <ChevronRight size={16} className={isRTL ? 'rotate-180' : ''} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 6. Floating Bulk Action Toolbar */}
      <BulkActionToolbar
        selectedCount={selectedIds.length}
        onClear={() => setSelectedIds([])}
        onExport={handleExportCsv}
        onDelete={() => setShowBulkDeleteModal(true)}
        actions={[
          {
            label: isRTL ? 'قبول المحدد' : 'Approve Selected',
            icon: Check,
            variant: 'ghost',
            className: 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30',
            onClick: handleBulkApprove,
          },
          {
            label: isRTL ? 'رفض المحدد' : 'Reject Selected',
            icon: X,
            variant: 'ghost',
            className: 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30',
            onClick: handleBulkReject,
          },
        ]}
      />

      {/* 7. Structured Rejection Reason Modal */}
      <Modal
        isOpen={isRejectModalOpen}
        onClose={() => {
          setIsRejectModalOpen(false);
          setRejectTarget(null);
        }}
        title={t('registration.rejectionReasonModalTitle', 'Specify Rejection Reason')}
      >
        {rejectTarget && (
          <div className="space-y-5">
            {/* Target Summary */}
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-800/40 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500 text-white flex items-center justify-center shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  {rejectTarget.firstName} {rejectTarget.lastName}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{rejectTarget.email}</p>
              </div>
            </div>

            {/* Quick Preset Reasons */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2.5">
                {isRTL ? 'أسباب شائعة للرفض السريع:' : 'Common Rejection Reasons:'}
              </label>
              <div className="space-y-2">
                {PRESET_REASONS.map((presetKey) => (
                  <button
                    key={presetKey}
                    type="button"
                    onClick={() => {
                      setSelectedPresetReason(presetKey);
                      setCustomRejectionReason('');
                    }}
                    className={`w-full text-start p-3 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                      selectedPresetReason === presetKey
                        ? 'border-brand-primary-500 bg-brand-primary-50 dark:bg-brand-primary-950/40 text-brand-primary-700 dark:text-brand-primary-300 ring-1 ring-brand-primary-500'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {t(presetKey)}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Reason Input */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                {isRTL ? 'أو كتابة ملاحظات مخصصة:' : 'Or custom explanation notes:'}
              </label>
              <textarea
                rows={3}
                value={customRejectionReason}
                onChange={(e) => {
                  setCustomRejectionReason(e.target.value);
                  setSelectedPresetReason('');
                }}
                placeholder={t('registration.rejectionReasonPlaceholder', 'Type a rejection reason or select a preset option below...')}
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-medium text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all resize-none"
              />
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-700">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsRejectModalOpen(false);
                  setRejectTarget(null);
                }}
                className="rounded-xl text-xs font-bold"
              >
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmReject}
                disabled={actionLoadingId === rejectTarget.id}
                className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold gap-1.5 shadow-xs"
              >
                {actionLoadingId === rejectTarget.id && <RotateCw size={14} className="animate-spin" />}
                <span>{t('registration.confirmReject', 'Confirm Rejection')}</span>
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* 8. Detailed Applicant Profile Modal */}
      <Modal
        isOpen={isDetailsModalOpen}
        onClose={() => {
          setIsDetailsModalOpen(false);
          setSelectedRequest(null);
        }}
        title={t('registration.requestDetails', 'Registration Request Details')}
      >
        {selectedRequest && (
          <div className="space-y-5 text-start">
            {/* Profile Header Banner */}
            <div className="p-5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-brand-primary-500 to-brand-primary-600 text-white font-extrabold text-lg flex items-center justify-center shadow-xs shrink-0">
                  {selectedRequest.firstName?.[0] || 'U'}
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white leading-tight">
                    {selectedRequest.firstName} {selectedRequest.lastName}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                    {selectedRequest.email}
                  </p>
                </div>
              </div>

              <div
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border self-start sm:self-auto ${
                  getStatusBadge(selectedRequest.status).className
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${getStatusBadge(selectedRequest.status).dotClass}`}></span>
                <span>{getStatusBadge(selectedRequest.status).label}</span>
              </div>
            </div>

            {/* Rejection Alert if already rejected */}
            {selectedRequest.status === 'REJECTED' && selectedRequest.rejectionReason && (
              <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-rose-700 dark:text-rose-300">
                  <AlertTriangle size={15} />
                  <span>{t('registration.rejectionReason', 'Rejection Reason')}:</span>
                </div>
                <p className="text-xs text-rose-600 dark:text-rose-400 font-medium ps-5">
                  {selectedRequest.rejectionReason}
                </p>
              </div>
            )}

            {/* Info Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Personal Information */}
              <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-700 space-y-3">
                <h4 className="text-xs font-bold text-brand-primary-600 dark:text-brand-primary-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 pb-2">
                  {t('registration.personalInfo', 'Personal Information')}
                </h4>
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-slate-400 block font-medium">{t('auth.email', 'Email address')}</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 block mt-0.5 break-all">
                      {selectedRequest.email}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">{t('profile.phone', 'Phone Number')}</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 block mt-0.5">
                      {selectedRequest.phone || (isRTL ? 'غير مسجل' : 'Not provided')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Academic Information */}
              <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-700 space-y-3">
                <h4 className="text-xs font-bold text-brand-primary-600 dark:text-brand-primary-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 pb-2">
                  {t('registration.academicInfo', 'Academic Information')}
                </h4>
                <div className="space-y-2 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-slate-400 block font-medium">{t('auth.role', 'Role')}</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200 block mt-0.5">
                        {selectedRequest.role}
                      </span>
                    </div>
                    {selectedRequest.studentId && (
                      <div>
                        <span className="text-slate-400 block font-medium">{t('auth.studentId', 'Student ID Number')}</span>
                        <span className="font-mono font-bold text-brand-primary-600 dark:text-brand-primary-400 block mt-0.5">
                          {selectedRequest.studentId}
                        </span>
                      </div>
                    )}
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">{t('auth.college', 'College')}</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 block mt-0.5">
                      {selectedRequest.department?.college?.name ||
                        selectedRequest.department?.college?.nameAr ||
                        (isRTL ? 'غير محدد' : 'Not assigned')}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">{t('auth.department', 'Department')}</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 block mt-0.5">
                      {selectedRequest.department?.name ||
                        selectedRequest.department?.nameAr ||
                        (isRTL ? 'عام' : 'General')}
                    </span>
                  </div>
                  {selectedRequest.year && (
                    <div>
                      <span className="text-slate-400 block font-medium">{t('auth.year', 'Academic Year')}</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200 block mt-0.5">
                        {isRTL ? `السنة الدراسية ${selectedRequest.year}` : `Year ${selectedRequest.year}`}
                      </span>
                    </div>
                  )}
                  <div>
                    <span className="text-slate-400 block font-medium">{t('registration.appliedDate', 'Applied Date')}</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 block mt-0.5">
                      {selectedRequest.createdAt
                        ? new Date(selectedRequest.createdAt).toLocaleString(isRTL ? 'ar-EG' : 'en-US')
                        : '-'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-700">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  handleDeleteClick(selectedRequest);
                }}
                className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl text-xs font-bold gap-1.5 cursor-pointer"
              >
                <Trash2 size={14} />
                <span>{t('registration.deleteRequest', 'Delete Request')}</span>
              </Button>

              <div className="flex items-center gap-2">
                {selectedRequest.status === 'PENDING' && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenRejectModal(selectedRequest)}
                      className="text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 border-rose-200 dark:border-rose-800/50 rounded-xl text-xs font-bold"
                    >
                      {t('common.reject', 'Reject')}
                    </Button>
                    <Button
                      size="sm"
                      onClick={async () => {
                        await handleApprove(selectedRequest.id);
                        setIsDetailsModalOpen(false);
                      }}
                      disabled={actionLoadingId === selectedRequest.id}
                      className="bg-brand-primary-500 hover:bg-brand-primary-600 text-white rounded-xl text-xs font-bold gap-1.5 shadow-xs"
                    >
                      {actionLoadingId === selectedRequest.id && (
                        <RotateCw size={14} className="animate-spin" />
                      )}
                      <span>{t('common.approve', 'Approve')}</span>
                    </Button>
                  </>
                )}
                {selectedRequest.status !== 'PENDING' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsDetailsModalOpen(false)}
                    className="rounded-xl text-xs font-bold"
                  >
                    {t('common.close', 'Close')}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* 9. Single Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setDeleteTarget(null);
        }}
        onConfirm={handleConfirmSingleDelete}
        loading={deleteLoading}
        title={t('registration.deleteRequest', 'Delete Request')}
        itemName={
          deleteTarget
            ? `${deleteTarget.firstName} ${deleteTarget.lastName} (${deleteTarget.email})`
            : ''
        }
        message={
          isRTL
            ? `هل أنت متأكد من حذف طلب تسجيل "${deleteTarget?.firstName} ${deleteTarget?.lastName}" نهائياً من قاعدة البيانات؟`
            : `Are you sure you want to permanently delete registration request for "${deleteTarget?.firstName} ${deleteTarget?.lastName}"?`
        }
      />

      {/* 10. Bulk Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={showBulkDeleteModal}
        onClose={() => setShowBulkDeleteModal(false)}
        onConfirm={handleConfirmBulkDelete}
        loading={deleteLoading}
        title={t('registration.bulkDelete', 'Delete Selected')}
        message={
          isRTL
            ? `هل أنت متأكد من حذف ${selectedIds.length} طلبات تسجيل محددة نهائياً من قاعدة البيانات؟ لا يمكن التراجع عن هذا الإجراء.`
            : `Are you sure you want to permanently delete ${selectedIds.length} selected registration requests? This action cannot be undone.`
        }
      />
    </div>
  );
};

export default RegistrationRequests;
