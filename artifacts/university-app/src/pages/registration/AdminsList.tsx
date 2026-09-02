// @ts-nocheck
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import usersService from '../../services/users.service';
import collegeService from '../../services/college.service';
import { downloadCsv } from '../../utils/exportCsv';

import Card, { StatCard } from '../../components/ui/card';
import Button from '../../components/ui/button';
import MaskedEmail from '../../components/MaskedEmail';
import { PageHeader } from '../../components/ui/PageHeader';
import Table, { TableRow, TableCell, TableHeader, TableHead, TableBody, ActionMenu } from '../../components/ui/Table';
import Pagination from '../../components/ui/pagination';
import { EmptyState } from '../../components/ui/EmptyState';
import ConfirmDeleteModal from '../../components/ui/ConfirmDeleteModal';
import ResetPasswordModal from '../../components/ui/ResetPasswordModal';
import BulkActionToolbar from '../../components/ui/BulkActionToolbar';

import AddAdminModal from './AddAdminModal';
import EditAdminModal from './EditAdminModal';

import {
  ShieldCheck,
  Building2,
  Users,
  Search,
  Plus,
  Download,
  Trash2,
  Edit2,
  KeyRound,
  Loader2,
  Shield,
  X,
  AlertTriangle,
  UserX,
  UserCheck,
} from 'lucide-react';

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'];

const AdminsList = () => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { user } = useAuth();
  const { showToast } = useToast();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const [admins, setAdmins] = useState([]);
  const [colleges, setColleges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');

  // Pagination state
  const [page, setPage] = useState(1);
  const limit = 10;

  // Selection state
  const [selectedIds, setSelectedIds] = useState<(string | number)[]>([]);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState(null);
  const [resetPasswordAdmin, setResetPasswordAdmin] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [reactivateTarget, setReactivateTarget] = useState<any>(null);
  const [reactivateLoading, setReactivateLoading] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [showBulkReactivateModal, setShowBulkReactivateModal] = useState(false);
  const [showBulkHardDeleteModal, setShowBulkHardDeleteModal] = useState(false);
  const [hardDeleteTarget, setHardDeleteTarget] = useState<any>(null);
  const [hardDeleteConfirmInput, setHardDeleteConfirmInput] = useState('');
  const [bulkHardDeleteConfirmInput, setBulkHardDeleteConfirmInput] = useState('');

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

  const fetchAdmins = useCallback(async () => {
    try {
      setLoading(true);
      const res = await usersService.getUsers({ role: ADMIN_ROLES, includeInactive: 'true' });
      if (res.success) {
        const list = Array.isArray(res.data) ? res.data : [];
        setAdmins(list.filter((u: any) => ADMIN_ROLES.includes(u.role)));
      }
    } catch (error: any) {
      console.error('Error fetching admins:', error);
      showToast(isRTL ? 'فشل تحميل قائمة المسؤولين' : 'Failed to load admins list', 'error');
    } finally {
      setLoading(false);
    }
  }, [isRTL, showToast]);

  const fetchColleges = useCallback(async () => {
    try {
      const res = await collegeService.getColleges();
      if (res.success) setColleges(res.data || []);
    } catch (error) {
      console.error('Error fetching colleges:', error);
    }
  }, []);

  useEffect(() => {
    fetchAdmins();
    fetchColleges();
  }, [fetchAdmins, fetchColleges]);

  // Reset page when filter or search changes
  useEffect(() => {
    setPage(1);
  }, [search, roleFilter, statusFilter]);

  // Derived Statistics
  const totalAdminsCount = (admins || []).length;
  const activeAdminsCount = (admins || []).filter((a) => a.isActive !== false).length;
  const inactiveAdminsCount = (admins || []).filter((a) => a.isActive === false).length;
  const universityAdminsCount = (admins || []).filter(
    (a) => a.role === 'SUPER_ADMIN' || a.role === 'ADMIN' || (!a.managedCollege && !a.college)
  ).length;
  const collegeAndDeptAdminsCount = totalAdminsCount - universityAdminsCount;

  // Derived Filtered Admins
  const filteredAdmins = useMemo(() => {
    const list = Array.isArray(admins) ? admins : [];
    const query = search.trim().toLowerCase();

    return list.filter((admin) => {
      // Status filter
      if (statusFilter === 'active' && admin.isActive === false) return false;
      if (statusFilter === 'inactive' && admin.isActive !== false) return false;

      // Role filter
      if (roleFilter === 'super' && admin.role !== 'SUPER_ADMIN' && admin.role !== 'ADMIN') return false;
      if (roleFilter === 'college' && admin.role !== 'COLLEGE_ADMIN') return false;
      if (roleFilter === 'department' && admin.role !== 'DEPARTMENT_ADMIN') return false;

      // Search filter
      if (query) {
        const emailMatch = (admin.email || '').toLowerCase().includes(query);
        const roleMatch = (admin.role || '').toLowerCase().includes(query);
        const collegeMatch = (admin.managedCollege?.name || admin.college?.name || '').toLowerCase().includes(query);
        const deptMatch = (admin.department?.name || '').toLowerCase().includes(query);
        return emailMatch || roleMatch || collegeMatch || deptMatch;
      }

      return true;
    });
  }, [admins, statusFilter, roleFilter, search]);

  // Paginated Admins
  const totalRecords = filteredAdmins.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / limit));
  const paginatedAdmins = useMemo(() => {
    const start = (page - 1) * limit;
    return filteredAdmins.slice(start, start + limit);
  }, [filteredAdmins, page, limit]);

  // Selection Handlers
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const visibleIds = paginatedAdmins.map((a: any) => a.id);
      const combined = Array.from(new Set([...selectedIds, ...visibleIds]));
      setSelectedIds(combined);
    } else {
      const visibleIds = paginatedAdmins.map((a: any) => a.id);
      setSelectedIds(selectedIds.filter((id) => !visibleIds.includes(id)));
    }
  };

  const handleSelectOne = (id: string | number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const isAllVisibleSelected =
    paginatedAdmins.length > 0 &&
    paginatedAdmins.every((a: any) => selectedIds.includes(a.id));

  // CSV Export Handlers
  const handleExportCsv = useCallback(() => {
    if (filteredAdmins.length === 0) {
      showToast(isRTL ? 'لا توجد بيانات للتصدير' : 'No data to export', 'error');
      return;
    }

    const exportData = filteredAdmins.map((a: any) => ({
      ID: a.id,
      Email: a.email || 'N/A',
      Role: a.role || 'N/A',
      Scope: a.managedCollege?.name || a.college?.name || 'All University',
      Department: a.department?.name || 'N/A',
      'Created At': new Date(a.createdAt).toLocaleDateString(),
    }));

    downloadCsv(exportData, `admins_${new Date().toISOString().split('T')[0]}.csv`);
    showToast(isRTL ? 'تم تصدير ملف CSV بنجاح' : 'Exported CSV successfully', 'success');
  }, [filteredAdmins, isRTL, showToast]);

  const handleBulkExport = useCallback(() => {
    const selectedAdmins = filteredAdmins.filter((a: any) => selectedIds.includes(a.id));
    if (selectedAdmins.length === 0) return;

    const exportData = selectedAdmins.map((a: any) => ({
      ID: a.id,
      Email: a.email || 'N/A',
      Role: a.role || 'N/A',
      Scope: a.managedCollege?.name || a.college?.name || 'All University',
      Department: a.department?.name || 'N/A',
      'Created At': new Date(a.createdAt).toLocaleDateString(),
    }));

    downloadCsv(exportData, `admins_selected_${new Date().toISOString().split('T')[0]}.csv`);
    showToast(isRTL ? 'تم تصدير المسؤولين المحددين' : 'Exported selected admins', 'success');
  }, [filteredAdmins, selectedIds, isRTL, showToast]);

  // Single Deactivate Confirmation — Level 1
  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      setDeleteLoading(true);

      // Optimistically update local state so the row immediately reflects 'Inactive'
      // This prevents the UI glitch where the account looks unchanged after the action.
      setAdmins((prev: any[]) =>
        prev.map((a: any) =>
          a.id === deleteTarget.id ? { ...a, isActive: false, deactivatedAt: new Date().toISOString() } : a
        )
      );

      const res = await usersService.deleteUser(deleteTarget.id);
      if (res.success) {
        showToast(
          isRTL
            ? 'تم تعطيل حساب المسؤول بنجاح — يمكن إعادة تفعيله لاحقاً'
            : 'Admin account deactivated successfully — it can be reactivated later',
          'success'
        );
        setDeleteTarget(null);
        fetchAdmins(); // Re-sync with server
      } else {
        // Rollback optimistic update on failure
        setAdmins((prev: any[]) =>
          prev.map((a: any) =>
            a.id === deleteTarget.id ? { ...a, isActive: true, deactivatedAt: null } : a
          )
        );
        showToast(res.message || (isRTL ? 'فشل تعطيل المسؤول' : 'Failed to deactivate admin'), 'error');
      }
    } catch (error: any) {
      // Rollback optimistic update on exception
      setAdmins((prev: any[]) =>
        prev.map((a: any) =>
          a.id === deleteTarget.id ? { ...a, isActive: true, deactivatedAt: null } : a
        )
      );
      showToast(
        error.response?.data?.message || (isRTL ? 'فشل تعطيل المسؤول' : 'Failed to deactivate admin'),
        'error'
      );
    } finally {
      setDeleteLoading(false);
    }
  }, [deleteTarget, fetchAdmins, isRTL, showToast]);

  // Single Reactivate Confirmation
  const confirmReactivate = useCallback(async () => {
    if (!reactivateTarget) return;
    try {
      setReactivateLoading(true);
      const res = await usersService.reactivateUser(reactivateTarget.id);
      if (res.success) {
        showToast(isRTL ? 'تمت إعادة تفعيل حساب المسؤول بنجاح' : 'Admin account reactivated successfully', 'success');
        setReactivateTarget(null);
        fetchAdmins();
      } else {
        showToast(res.message || (isRTL ? 'فشل إعادة تفعيل المسؤول' : 'Failed to reactivate admin'), 'error');
      }
    } catch (error: any) {
      showToast(error.response?.data?.message || (isRTL ? 'فشل إعادة تفعيل المسؤول' : 'Failed to reactivate admin'), 'error');
    } finally {
      setReactivateLoading(false);
    }
  }, [reactivateTarget, fetchAdmins, isRTL, showToast]);

  // Single Permanent Delete Confirmation — Level 3
  const confirmHardDelete = useCallback(async () => {
    if (!hardDeleteTarget) return;
    setDeleteLoading(true);
    try {
      const res = await usersService.hardDeleteUser(hardDeleteTarget.id);
      if (res.success) {
        setAdmins((prev: any[]) => prev.filter((a: any) => a.id !== hardDeleteTarget.id));
        showToast(
          isRTL ? 'تم حذف المسؤول نهائياً وبشكل دائم' : 'Admin permanently and irreversibly deleted',
          'success'
        );
        setSelectedIds((prev) => prev.filter((id) => id !== hardDeleteTarget.id));
        fetchAdmins();
      } else {
        showToast(
          res.message || (isRTL ? 'فشل الحذف النهائي' : 'Permanent deletion failed'),
          'error'
        );
      }
    } catch (err: any) {
      console.error('Hard delete error:', err);
      const msg = err.response?.data?.message;
      showToast(
        msg || (isRTL ? 'حدث خطأ أثناء الحذف الدائم' : 'Failed to permanently delete admin'),
        'error'
      );
    } finally {
      setDeleteLoading(false);
      setHardDeleteTarget(null);
      setHardDeleteConfirmInput('');
    }
  }, [hardDeleteTarget, isRTL, showToast, fetchAdmins]);

  // Bulk Deactivate Confirmation — Level 1 (batch)
  const confirmBulkDeactivate = useCallback(async () => {
    try {
      setDeleteLoading(true);
      let count = 0;
      const failedIds: (string | number)[] = [];

      for (const id of selectedIds) {
        if (id !== user?.id) {
          const res = await usersService.deleteUser(id);
          if (res.success) {
            count++;
          } else {
            failedIds.push(id);
          }
        }
      }

      // Optimistically update state for all successfully deactivated admins
      setAdmins((prev: any[]) =>
        prev.map((a: any) =>
          selectedIds.includes(a.id) && a.id !== user?.id && !failedIds.includes(a.id)
            ? { ...a, isActive: false, deactivatedAt: new Date().toISOString() }
            : a
        )
      );

      if (failedIds.length > 0) {
        showToast(
          isRTL
            ? `تم تعطيل ${count} حساب. فشل تعطيل ${failedIds.length} حساب.`
            : `Deactivated ${count} account(s). Failed to deactivate ${failedIds.length}.`,
          'error'
        );
      } else {
        showToast(
          isRTL
            ? `تم تعطيل ${count} من حسابات المسؤولين بنجاح`
            : `Deactivated ${count} admin account(s) successfully`,
          'success'
        );
      }

      setSelectedIds([]);
      setShowBulkDeleteModal(false);
      fetchAdmins();
    } catch (error: any) {
      showToast(
        isRTL ? 'حدث خطأ أثناء تعطيل بعض الحسابات' : 'Error deactivating some accounts',
        'error'
      );
    } finally {
      setDeleteLoading(false);
    }
  }, [selectedIds, user, fetchAdmins, isRTL, showToast]);

  // Bulk Reactivate Confirmation
  const confirmBulkReactivate = useCallback(async () => {
    try {
      setDeleteLoading(true);
      let count = 0;
      for (const id of selectedIds) {
        const res = await usersService.reactivateUser(id);
        if (res.success) count++;
      }
      showToast(isRTL ? `تمت إعادة تفعيل ${count} من حسابات المسؤولين بنجاح` : `Reactivated ${count} admin accounts successfully`, 'success');
      setSelectedIds([]);
      setShowBulkReactivateModal(false);
      fetchAdmins();
    } catch (error: any) {
      showToast(isRTL ? 'حدث خطأ أثناء إعادة تفعيل بعض الحسابات' : 'Error reactivating some accounts', 'error');
    } finally {
      setDeleteLoading(false);
    }
  }, [selectedIds, fetchAdmins, isRTL, showToast]);

  // Bulk Permanent Delete Confirmation — Level 3 (batch)
  const confirmBulkHardDelete = useCallback(async () => {
    try {
      setDeleteLoading(true);
      let count = 0;
      const deletedIds: (string | number)[] = [];

      for (const id of selectedIds) {
        if (id !== user?.id) {
          const res = await usersService.hardDeleteUser(id);
          if (res.success) {
            count++;
            deletedIds.push(id);
          }
        }
      }

      if (deletedIds.length > 0) {
        setAdmins((prev: any[]) => prev.filter((a: any) => !deletedIds.includes(a.id)));
      }

      showToast(
        isRTL
          ? `تم حذف ${count} من حسابات المسؤولين نهائياً وبشكل دائم`
          : `Permanently deleted ${count} admin account(s)`,
        'success'
      );
      setSelectedIds([]);
      setShowBulkHardDeleteModal(false);
      setBulkHardDeleteConfirmInput('');
      fetchAdmins();
    } catch (error: any) {
      showToast(
        isRTL ? 'حدث خطأ أثناء الحذف النهائي لبعض الحسابات' : 'Error permanently deleting some accounts',
        'error'
      );
    } finally {
      setDeleteLoading(false);
    }
  }, [selectedIds, user, fetchAdmins, isRTL, showToast]);

  return (
    <div className="pt-6 section-gap animate-in fade-in duration-700 space-y-6">
      {/* Page Header */}
      <PageHeader
        title={isRTL ? 'إدارة المسؤولين' : 'Admins Management'}
        subtitle={isRTL ? 'مسؤولو الجامعة والكليات والأقسام الأكاديمية' : 'University, college, and department administrators'}
        action={
          isSuperAdmin
            ? {
                label: isRTL ? 'إضافة مسؤول' : 'Add Admin',
                onClick: () => setShowAddModal(true),
                icon: Plus,
                className:
                  'bg-brand-primary-500 hover:bg-brand-primary-600 text-white font-bold rounded-xl active:scale-95 transition-all flex items-center gap-2 px-4 py-2',
              }
            : null
        }
      />

      {/* ========================================================================= */}
      {/* 1. EXECUTIVE 4-METRIC RIBBON                                              */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <StatCard
          compact
          title={isRTL ? 'إجمالي المسؤولين' : 'Total Admins'}
          value={totalAdminsCount}
          icon={ShieldCheck}
          color="primary"
        />

        <StatCard
          compact
          title={isRTL ? 'الحسابات النشطة' : 'Active Admins'}
          value={activeAdminsCount}
          icon={UserCheck}
          color="emerald"
        />

        <StatCard
          compact
          title={isRTL ? 'مسؤولو الجامعة' : 'University Admins'}
          value={universityAdminsCount}
          icon={Shield}
          color="blue"
        />

        <StatCard
          compact
          title={isRTL ? 'مسؤولو الكليات والأقسام' : 'Faculty & Dept Admins'}
          value={collegeAndDeptAdminsCount}
          icon={Building2}
          color="amber"
        />
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
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isRTL ? 'البحث بالبريد أو الصلاحية أو الكلية أو القسم...' : 'Search by email, role, college, department...'}
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

        {/* Role Filter */}
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="h-8.5 px-3 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-brand-primary-500 cursor-pointer"
        >
          <option value="all">{isRTL ? 'جميع الصلاحيات (الكل)' : 'All Roles'}</option>
          <option value="super">{isRTL ? 'مسؤولو الجامعة' : 'University Admins'}</option>
          <option value="college">{isRTL ? 'مسؤولو الكليات' : 'College Admins'}</option>
          <option value="department">{isRTL ? 'مسؤولو الأقسام' : 'Dept Admins'}</option>
        </select>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="h-8.5 px-3 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-brand-primary-500 cursor-pointer"
        >
          <option value="all">{isRTL ? 'جميع الحسابات' : 'All Status'}</option>
          <option value="active">{isRTL ? 'الحسابات النشطة' : 'Active Only'}</option>
          <option value="inactive">{isRTL ? 'الحسابات المعطلة' : 'Deactivated Only'}</option>
        </select>

        {/* Clear Filters Button */}
        {(search || roleFilter !== 'all' || statusFilter !== 'all') && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch('');
              setRoleFilter('all');
              setStatusFilter('all');
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
          onClick={handleExportCsv}
          className="h-8.5 px-3 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer shadow-2xs ms-auto"
        >
          <Download size={13} className="text-slate-500" />
          <span>{isRTL ? 'تصدير CSV' : 'Export CSV'}</span>
        </Button>
      </div>

      {/* Bulk Action Toolbar */}
      {selectedIds.length > 0 && isSuperAdmin && (
        <BulkActionToolbar
          selectedCount={selectedIds.length}
          onClear={() => setSelectedIds([])}
          onExport={handleBulkExport}
          onDeactivate={statusFilter !== 'inactive' ? () => setShowBulkDeleteModal(true) : undefined}
          onReactivate={statusFilter !== 'active' ? () => setShowBulkReactivateModal(true) : undefined}
          onHardDelete={() => {
            setShowBulkHardDeleteModal(true);
            setBulkHardDeleteConfirmInput('');
          }}
        />
      )}

      {/* Table Content / Empty States */}
      <div className="min-h-0">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <Loader2 className="animate-spin text-brand-primary-500" size={36} />
            <p className="text-sm font-semibold text-brand-text-secondary dark:text-slate-400">
              {isRTL ? 'جاري تحميل المسؤولين...' : 'Loading admins...'}
            </p>
          </div>
        ) : filteredAdmins.length === 0 ? (
          <EmptyState
            icon={statusFilter === 'inactive' ? <UserCheck className="w-10 h-10 text-emerald-500" /> : <ShieldCheck className="w-10 h-10 text-brand-primary-500" />}
            title={
              statusFilter === 'inactive' && !search && roleFilter === 'all'
                ? (isRTL ? 'لا توجد حسابات معطلة' : 'No Deactivated Admins')
                : (isRTL ? 'لم يتم العثور على مسؤولين' : 'No Admins Found')
            }
            subtitle={
              statusFilter === 'inactive' && !search && roleFilter === 'all'
                ? (isRTL ? 'جميع حسابات مسؤولي الجامعة والكليات والأقسام نشطة وتعمل بشكل طبيعي.' : 'All administrator accounts are currently active and functioning normally.')
                : (isRTL ? 'لم ينطبق أي مسؤول على الفلتر أو البحث المحدد' : 'No administrators matched your filter or search query.')
            }
            action={
              isSuperAdmin && statusFilter !== 'inactive'
                ? {
                    label: isRTL ? 'إضافة مسؤول جديد' : 'Add New Admin',
                    onClick: () => setShowAddModal(true),
                  }
                : undefined
            }
          />
        ) : (
          <Card className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden p-0">
            <div className="overflow-x-auto">
              <Table className="w-full">
                <TableHeader className="bg-slate-50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-700">
                  <TableRow>
                    <TableHead className="w-12 text-center p-4">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 dark:border-slate-700 text-brand-primary-600 focus:ring-brand-primary-500/20 w-4 h-4 cursor-pointer align-middle"
                        checked={isAllVisibleSelected}
                        onChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead className="text-start p-4 font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {isRTL ? 'المسؤول' : 'Admin'}
                    </TableHead>
                    <TableHead className="text-start p-4 font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {isRTL ? 'البريد الإلكتروني' : 'Email'}
                    </TableHead>
                    <TableHead className="text-center p-4 font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {isRTL ? 'الصلاحية' : 'Role'}
                    </TableHead>
                    <TableHead className="text-center p-4 font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {isRTL ? 'الحالة' : 'Status'}
                    </TableHead>
                    <TableHead className="text-center p-4 font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {isRTL ? 'النطاق' : 'Scope'}
                    </TableHead>
                    <TableHead className="text-center p-4 font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {isRTL ? 'تاريخ الإنشاء' : 'Created At'}
                    </TableHead>
                    <TableHead className="text-end p-4 font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 pe-6">
                      {isRTL ? 'الإجراءات' : 'Actions'}
                    </TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {paginatedAdmins.map((admin: any) => {
                    const isSelected = selectedIds.includes(admin.id);
                    const isSelf = user?.id === admin.id;

                    let roleClass = 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
                    let roleLabel = isRTL ? 'مسؤول' : 'Admin';

                    if (admin.role === 'SUPER_ADMIN') {
                      roleClass = 'bg-brand-navy-50 text-brand-navy-600 dark:bg-slate-700 dark:text-slate-100 border border-brand-navy-200/50';
                      roleLabel = isRTL ? 'مسؤول الجامعة (Super Admin)' : 'Super Admin';
                    } else if (admin.role === 'COLLEGE_ADMIN') {
                      roleClass = 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400';
                      roleLabel = isRTL ? 'مسؤول كلية' : 'College Admin';
                    } else if (admin.role === 'DEPARTMENT_ADMIN') {
                      roleClass = 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
                      roleLabel = isRTL ? 'مسؤول قسم' : 'Dept Admin';
                    }

                    const scopeLabel =
                      admin.managedCollege?.name || admin.college?.name || (isRTL ? 'جميع الكليات والجامعة' : 'All University');

                    const isInactive = admin.isActive === false;
                    const actions = [];

                    if (isInactive) {
                      if (isSuperAdmin) {
                        actions.push({
                          label: isRTL ? 'إعادة تفعيل الحساب' : 'Reactivate Admin',
                          icon: UserCheck,
                          variant: 'edit',
                          onClick: () => setReactivateTarget(admin),
                        });
                        if (!isSelf) {
                          actions.push({
                            label: isRTL ? 'حذف الحساب نهائياً' : 'Permanent Delete',
                            icon: Trash2,
                            variant: 'delete',
                            onClick: () => {
                              setHardDeleteTarget(admin);
                              setHardDeleteConfirmInput('');
                            },
                          });
                        }
                      }
                    } else {
                      actions.push({
                        label: isRTL ? 'تعديل البيانات' : 'Edit Admin',
                        icon: Edit2,
                        onClick: () => setEditingAdmin(admin),
                      });
                      actions.push({
                        label: isRTL ? 'إعادة تعيين كلمة المرور' : 'Reset Password',
                        icon: KeyRound,
                        onClick: () => setResetPasswordAdmin(admin),
                      });

                      if (isSuperAdmin && !isSelf) {
                        actions.push({
                          label: isRTL ? 'تعطيل الحساب' : 'Deactivate Admin',
                          icon: UserX,
                          variant: 'delete',
                          onClick: () => setDeleteTarget(admin),
                        });
                        actions.push({
                          label: isRTL ? 'حذف الحساب نهائياً' : 'Permanent Delete',
                          icon: Trash2,
                          variant: 'delete',
                          onClick: () => {
                            setHardDeleteTarget(admin);
                            setHardDeleteConfirmInput('');
                          },
                        });
                      }
                    }

                    return (
                      <TableRow
                        key={admin.id}
                        className={`hover:bg-slate-50 dark:hover:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 last:border-b-0 transition-colors ${
                          isSelected ? 'bg-brand-primary-500/5 dark:bg-brand-primary-500/10' : ''
                        } ${isInactive ? 'opacity-75 bg-slate-50/50 dark:bg-slate-900/30' : ''}`}
                      >
                        {/* Checkbox */}
                        <TableCell className="w-12 text-center p-4">
                          <input
                            type="checkbox"
                            className="rounded border-slate-300 dark:border-slate-700 text-brand-primary-600 focus:ring-brand-primary-500/20 w-4 h-4 cursor-pointer align-middle"
                            checked={isSelected}
                            onChange={() => handleSelectOne(admin.id)}
                          />
                        </TableCell>

                        {/* Admin Name & Avatar */}
                        <TableCell className="p-4 text-start">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 font-bold ${
                              isInactive ? 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400' : 'bg-brand-primary-500/10 text-brand-primary-600'
                            }`}>
                              <Shield className="w-5 h-5" />
                            </div>
                            <div className="flex flex-col">
                              <span className="font-bold text-brand-text-primary dark:text-white flex items-center gap-1.5">
                                {(admin.email || 'admin').split('@')[0]}
                                {isSelf && (
                                  <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                    {isRTL ? 'حسابك' : 'You'}
                                  </span>
                                )}
                              </span>
                              <span className="text-xs text-brand-text-secondary dark:text-slate-400">
                                <MaskedEmail email={admin.email} />
                              </span>
                            </div>
                          </div>
                        </TableCell>

                        {/* Email */}
                        <TableCell className="p-4 text-start font-medium text-slate-600 dark:text-slate-300 text-sm">
                          <MaskedEmail email={admin.email} />
                        </TableCell>

                        {/* Role Badge */}
                        <TableCell className="p-4 text-center">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold ${roleClass}`}>
                            {roleLabel}
                          </span>
                        </TableCell>

                        {/* Status Badge */}
                        <TableCell className="p-4 text-center">
                          {!isInactive ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                              {isRTL ? 'نشط' : 'Active'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                              {isRTL ? 'معطل' : 'Inactive'}
                            </span>
                          )}
                        </TableCell>

                        {/* Scope */}
                        <TableCell className="p-4 text-center font-medium">
                          <div className="flex flex-col items-center">
                            <span className="text-xs font-bold text-brand-text-primary dark:text-white uppercase tracking-tight truncate max-w-[180px]">
                              {scopeLabel}
                            </span>
                            {admin.department && (
                              <span className="text-[10px] text-brand-text-secondary dark:text-slate-400 truncate max-w-[150px]">
                                {admin.department.name}
                              </span>
                            )}
                          </div>
                        </TableCell>

                        {/* Created At */}
                        <TableCell className="p-4 text-center text-xs font-semibold text-slate-500 dark:text-slate-400">
                          {new Date(admin.createdAt).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="p-4 text-end pe-6">
                          {actions.length > 0 ? (
                            <ActionMenu actions={actions} />
                          ) : (
                            '—'
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Pagination Component */}
            <Pagination
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
              totalRecords={totalRecords}
              limit={limit}
            />
          </Card>
        )}
      </div>

      {/* Add Admin Modal */}
      <AddAdminModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={fetchAdmins}
        colleges={colleges}
      />

      {/* Edit Admin Modal */}
      <EditAdminModal
        isOpen={!!editingAdmin}
        onClose={() => setEditingAdmin(null)}
        onSuccess={fetchAdmins}
        admin={editingAdmin}
        colleges={colleges}
      />

      {/* Reset Password Modal */}
      <ResetPasswordModal
        isOpen={!!resetPasswordAdmin}
        onClose={() => setResetPasswordAdmin(null)}
        person={resetPasswordAdmin}
        type="admin"
      />

      {/* Single Deactivate Confirmation Modal — Level 1 */}
      <ConfirmDeleteModal
        isOpen={!!deleteTarget}
        onClose={() => !deleteLoading && setDeleteTarget(null)}
        itemName={deleteTarget?.email || ''}
        onConfirm={confirmDelete}
        loading={deleteLoading}
        variant="warning"
        title={isRTL ? 'تأكيد تعطيل حساب المسؤول' : 'Confirm Deactivate Admin Account'}
        confirmLabel={isRTL ? 'تعطيل الحساب' : 'Deactivate Account'}
        message={
          isRTL
            ? `هل أنت متأكد من تعطيل حساب المسؤول "${deleteTarget?.email}"؟ سيتم تعليق صلاحيات الوصول — ويمكنك إعادة تفعيل الحساب في أي وقت.`
            : `Are you sure you want to deactivate admin "${deleteTarget?.email}"? Access will be suspended — you can reactivate this account at any time.`
        }
      />

      {/* Single Reactivate Confirmation Modal — Level 2 */}
      <ConfirmDeleteModal
        isOpen={!!reactivateTarget}
        onClose={() => !reactivateLoading && setReactivateTarget(null)}
        itemName={reactivateTarget?.email || ''}
        onConfirm={confirmReactivate}
        loading={reactivateLoading}
        variant="warning"
        title={isRTL ? 'تأكيد إعادة تفعيل الحساب' : 'Confirm Reactivate Admin Account'}
        confirmLabel={isRTL ? 'إعادة تفعيل الحساب' : 'Reactivate Account'}
        message={
          isRTL
            ? `هل أنت متأكد من إعادة تفعيل حساب المسؤول "${reactivateTarget?.email}"؟ سيتم استعادة جميع صلاحيات الوصول الخاصة به فوراً.`
            : `Are you sure you want to reactivate admin "${reactivateTarget?.email}"? All access permissions will be restored immediately.`
        }
      />

      {/* Bulk Deactivate Confirmation Modal — Level 1 (batch) */}
      <ConfirmDeleteModal
        isOpen={showBulkDeleteModal}
        onClose={() => !deleteLoading && setShowBulkDeleteModal(false)}
        itemName={`${selectedIds.length} ${isRTL ? 'مسؤول' : 'admin(s)'}`}
        onConfirm={confirmBulkDeactivate}
        loading={deleteLoading}
        variant="warning"
        title={isRTL ? 'تأكيد تعطيل الحسابات المحددة' : 'Confirm Deactivate Selected Admins'}
        confirmLabel={isRTL ? 'تعطيل الحسابات المحددة' : 'Deactivate Selected Accounts'}
        message={
          isRTL
            ? `هل أنت متأكد من تعطيل ${selectedIds.length} من حسابات المسؤولين المحددة؟ سيتم تعليق صلاحيات الوصول ويمكنك إعادة تفعيلها لاحقاً.`
            : `Are you sure you want to deactivate ${selectedIds.length} selected admin account(s)? Access will be suspended — these accounts can be reactivated later.`
        }
      />

      {/* Bulk Reactivate Confirmation Modal — Level 2 (batch) */}
      <ConfirmDeleteModal
        isOpen={showBulkReactivateModal}
        onClose={() => !deleteLoading && setShowBulkReactivateModal(false)}
        itemName={`${selectedIds.length} ${isRTL ? 'مسؤول' : 'admin(s)'}`}
        onConfirm={confirmBulkReactivate}
        loading={deleteLoading}
        variant="warning"
        title={isRTL ? 'تأكيد إعادة تفعيل الحسابات المحددة' : 'Confirm Reactivate Selected Admins'}
        confirmLabel={isRTL ? 'إعادة تفعيل الحسابات المحددة' : 'Reactivate Selected Accounts'}
        message={
          isRTL
            ? `هل أنت متأكد من إعادة تفعيل ${selectedIds.length} من حسابات المسؤولين المحددة؟ سيتم استعادة جميع صلاحيات الوصول الخاصة بهم فوراً.`
            : `Are you sure you want to reactivate ${selectedIds.length} selected admin account(s)? All access permissions will be restored immediately.`
        }
      />

      {/* Bulk Permanent Hard Delete Confirmation Modal — Level 3 (batch) */}
      {showBulkHardDeleteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => {
              if (!deleteLoading) {
                setShowBulkHardDeleteModal(false);
                setBulkHardDeleteConfirmInput('');
              }
            }}
          />
          <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Red header bar */}
            <div className="h-1.5 w-full bg-gradient-to-r from-rose-500 to-red-600" />
            <div className="p-6">
              <div className="flex items-start gap-4 mb-5">
                <div className="p-3 bg-rose-100 dark:bg-rose-900/30 rounded-full shrink-0 mt-0.5">
                  <AlertTriangle className="w-6 h-6 text-rose-600 dark:text-rose-400" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    {isRTL ? 'حذف دائم للحسابات المحددة' : 'Permanently Delete Selected Admins'}
                  </h3>
                  <p className="text-xs text-rose-500 font-bold mt-1">
                    {isRTL ? 'هذا الإجراء لا يمكن التراجع عنه نهائياً' : 'This action is permanent and cannot be undone'}
                  </p>
                </div>
              </div>

              {/* Account count pill */}
              <div className="mb-4 flex items-center gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800">
                <span className="text-rose-600 dark:text-rose-400 font-black text-2xl">{selectedIds.length}</span>
                <span className="text-sm text-rose-700 dark:text-rose-300 font-semibold">
                  {isRTL ? 'حساب مسؤول سيتم حذفه بشكل لا رجعة فيه' : `admin account${selectedIds.length !== 1 ? 's' : ''} will be permanently erased`}
                </span>
              </div>

              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                {isRTL
                  ? `سيتم حذف جميع بيانات هذه الحسابات بشكل كامل من قاعدة البيانات. لتأكيد الحذف، يرجى كتابة عدد الحسابات (${selectedIds.length}) أدناه:`
                  : `All data for these accounts will be completely erased from the database. To confirm deletion, please type the number of accounts (${selectedIds.length}) below:`}
              </p>

              {/* Typed verification input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  {isRTL ? `اكتب الرقم (${selectedIds.length}) للتأكيد:` : `Type "${selectedIds.length}" to confirm:`}
                </label>
                <input
                  type="text"
                  value={bulkHardDeleteConfirmInput}
                  onChange={(e) => setBulkHardDeleteConfirmInput(e.target.value)}
                  placeholder={String(selectedIds.length)}
                  dir="ltr"
                  className="w-full px-3.5 py-2 text-xs font-mono border border-rose-200 dark:border-rose-800 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none bg-rose-50/50 dark:bg-rose-950/20 text-slate-900 dark:text-white placeholder:text-slate-400"
                />
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowBulkHardDeleteModal(false);
                  setBulkHardDeleteConfirmInput('');
                }}
                disabled={deleteLoading}
                className="font-semibold"
              >
                {isRTL ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button
                variant="danger"
                onClick={confirmBulkHardDelete}
                disabled={deleteLoading || bulkHardDeleteConfirmInput.trim() !== String(selectedIds.length)}
                className="font-bold disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {deleteLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isRTL ? (
                  `حذف ${selectedIds.length} حساب نهائياً`
                ) : (
                  `Delete ${selectedIds.length} Account${selectedIds.length !== 1 ? 's' : ''} Permanently`
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Single Permanent Hard Delete Confirmation Modal — Level 3 */}
      {hardDeleteTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => {
              if (!deleteLoading) {
                setHardDeleteTarget(null);
                setHardDeleteConfirmInput('');
              }
            }}
          />
          <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Red header bar */}
            <div className="h-1.5 w-full bg-gradient-to-r from-rose-500 to-red-600" />
            <div className="p-6">
              <div className="flex items-start gap-4 mb-5">
                <div className="p-3 bg-rose-100 dark:bg-rose-900/30 rounded-full shrink-0 mt-0.5">
                  <AlertTriangle className="w-6 h-6 text-rose-600 dark:text-rose-400" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    {isRTL ? 'حذف دائم للحساب' : 'Permanently Delete Account'}
                  </h3>
                  <p className="text-xs text-rose-500 font-bold mt-1">
                    {isRTL ? 'هذا الإجراء لا يمكن التراجع عنه نهائياً' : 'This action is permanent and cannot be undone'}
                  </p>
                </div>
              </div>

              {/* Account email pill */}
              <div className="mb-4 flex items-center gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 font-mono text-sm break-all">
                <Trash2 className="w-4 h-4 text-rose-500 shrink-0" />
                <span className="text-rose-700 dark:text-rose-300 font-bold">{hardDeleteTarget.email}</span>
              </div>

              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                {isRTL
                  ? 'سيتم حذف جميع بيانات هذا الحساب بشكل كامل من قاعدة البيانات. لتأكيد الحذف، يرجى كتابة البريد الإلكتروني للمسؤول أدناه:'
                  : 'All data for this account will be completely erased from the database. To confirm deletion, please type the admin\'s email below:'}
              </p>

              {/* Typed verification input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  {isRTL ? 'اكتب البريد الإلكتروني للتأكيد:' : 'Type email to confirm:'}
                </label>
                <input
                  type="text"
                  value={hardDeleteConfirmInput}
                  onChange={(e) => setHardDeleteConfirmInput(e.target.value)}
                  placeholder={hardDeleteTarget.email}
                  dir="ltr"
                  className="w-full px-3.5 py-2 text-xs font-mono border border-rose-200 dark:border-rose-800 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none bg-rose-50/50 dark:bg-rose-950/20 text-slate-900 dark:text-white placeholder:text-slate-400"
                />
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setHardDeleteTarget(null);
                  setHardDeleteConfirmInput('');
                }}
                disabled={deleteLoading}
                className="font-semibold"
              >
                {isRTL ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button
                variant="danger"
                onClick={confirmHardDelete}
                disabled={deleteLoading || hardDeleteConfirmInput !== hardDeleteTarget.email}
                className="font-bold disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {deleteLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isRTL ? (
                  'حذف الحساب نهائياً'
                ) : (
                  'Delete Account Permanently'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminsList;
