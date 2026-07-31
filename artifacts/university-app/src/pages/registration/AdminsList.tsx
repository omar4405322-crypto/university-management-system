// @ts-nocheck
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import usersService from '../../services/users.service';
import collegeService from '../../services/college.service';
import { downloadCsv } from '../../utils/exportCsv';

import Card from '../../components/ui/Card';
import Button from '../../components/ui/button';
import MaskedEmail from '../../components/MaskedEmail';
import { PageHeader } from '../../components/ui/PageHeader';
import Table, { TableRow, TableCell, TableHeader, TableHead, TableBody, ActionMenu } from '../../components/ui/Table';
import Pagination from '../../components/ui/Pagination';
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
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);

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
      const res = await usersService.getUsers({ role: ADMIN_ROLES });
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
  }, [search, roleFilter]);

  // Derived Statistics
  const totalAdminsCount = (admins || []).length;
  const universityAdminsCount = (admins || []).filter(
    (a) => a.role === 'SUPER_ADMIN' || a.role === 'ADMIN' || (!a.managedCollege && !a.college)
  ).length;
  const collegeAndDeptAdminsCount = totalAdminsCount - universityAdminsCount;

  // Derived Filtered Admins
  const filteredAdmins = useMemo(() => {
    const list = Array.isArray(admins) ? admins : [];
    const query = search.trim().toLowerCase();

    return list.filter((admin) => {
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
  }, [admins, roleFilter, search]);

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

  // Single Delete Confirmation
  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      setDeleteLoading(true);
      const res = await usersService.deleteUser(deleteTarget.id);
      if (res.success) {
        showToast(isRTL ? 'تم حذف حساب المسؤول بنجاح' : 'Admin deleted successfully', 'success');
        setDeleteTarget(null);
        fetchAdmins();
      }
    } catch (error: any) {
      showToast(error.response?.data?.message || (isRTL ? 'فشل حذف المسؤول' : 'Failed to delete admin'), 'error');
    } finally {
      setDeleteLoading(false);
    }
  }, [deleteTarget, fetchAdmins, isRTL, showToast]);

  // Bulk Delete Confirmation
  const confirmBulkDelete = useCallback(async () => {
    try {
      setDeleteLoading(true);
      for (const id of selectedIds) {
        if (id !== user?.id) {
          await usersService.deleteUser(id);
        }
      }
      showToast(isRTL ? 'تم حذف المسؤولين المحددين بنجاح' : 'Deleted selected admins successfully', 'success');
      setSelectedIds([]);
      setShowBulkDeleteModal(false);
      fetchAdmins();
    } catch (error: any) {
      showToast(isRTL ? 'حدث خطأ أثناء حذف بعض الحسابات' : 'Error deleting some accounts', 'error');
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

      {/* Filter & Search Bar Card */}
      <Card className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Role Filter Tabs */}
          <div className="flex overflow-x-auto pb-1.5 md:pb-0 custom-scrollbar gap-2 w-full md:w-auto" dir={isRTL ? 'rtl' : 'ltr'}>
            {[
              { id: 'all', label: isRTL ? 'الكل' : 'All' },
              { id: 'super', label: isRTL ? 'مسؤولو الجامعة' : 'University Admins' },
              { id: 'college', label: isRTL ? 'مسؤولو الكليات' : 'College Admins' },
              { id: 'department', label: isRTL ? 'مسؤولو الأقسام' : 'Dept Admins' },
            ].map((tab) => {
              const isActive = roleFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setRoleFilter(tab.id)}
                  className={`flex-shrink-0 whitespace-nowrap px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all ${
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

          {/* Search & Export Buttons */}
          <div className="flex flex-1 md:max-w-md items-center gap-3 w-full">
            <div className="relative flex-1">
              <Search
                className="absolute start-3.5 top-1/2 -translate-y-1/2 text-brand-text-muted"
                size={16}
              />
              <input
                type="text"
                placeholder={isRTL ? 'البحث بالبريد أو الصلاحية أو الكلية...' : 'Search by email, role, college...'}
                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl ps-10 pe-9 py-2 text-sm bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-primary-500 dark:text-white"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute end-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-brand-text-muted hover:text-brand-text-primary transition-colors"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <Button
              variant="outline"
              onClick={handleExportCsv}
              className="border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 transition-all shrink-0"
            >
              <Download size={14} />
              <span className="hidden sm:inline">
                {isRTL ? 'تصدير CSV' : 'Export CSV'}
              </span>
            </Button>
          </div>
        </div>
      </Card>

      {/* Bulk Action Toolbar */}
      {selectedIds.length > 0 && (
        <BulkActionToolbar
          selectedCount={selectedIds.length}
          onClearSelection={() => setSelectedIds([])}
          onExportSelected={handleBulkExport}
          onDeleteSelected={() => setShowBulkDeleteModal(true)}
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
            icon={<ShieldCheck className="w-10 h-10 text-brand-primary-500" />}
            title={isRTL ? 'لم يتم العثور على مسؤولين' : 'No Admins Found'}
            subtitle={isRTL ? 'لم ينطبق أي مسؤول على الفلتر أو البحث المحدد' : 'No administrators matched your filter or search query.'}
            action={
              isSuperAdmin
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
                      roleClass = 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
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

                    const actions = [
                      {
                        label: isRTL ? 'تعديل البيانات' : 'Edit Admin',
                        icon: Edit2,
                        onClick: () => setEditingAdmin(admin),
                      },
                      {
                        label: isRTL ? 'إعادة تعيين كلمة المرور' : 'Reset Password',
                        icon: KeyRound,
                        onClick: () => setResetPasswordAdmin(admin),
                      },
                    ];

                    if (isSuperAdmin && !isSelf) {
                      actions.push({
                        label: isRTL ? 'حذف الحساب' : 'Delete Admin',
                        icon: Trash2,
                        variant: 'delete',
                        onClick: () => setDeleteTarget(admin),
                      });
                    }

                    return (
                      <TableRow
                        key={admin.id}
                        className={`hover:bg-slate-50 dark:hover:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 last:border-b-0 transition-colors ${
                          isSelected ? 'bg-brand-primary-500/5 dark:bg-brand-primary-500/10' : ''
                        }`}
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
                            <div className="w-10 h-10 rounded-2xl bg-brand-primary-500/10 text-brand-primary-600 flex items-center justify-center flex-shrink-0 font-bold">
                              <Shield className="w-5 h-5 text-brand-primary-600" />
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
            {totalPages > 1 && (
              <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/20">
                <Pagination
                  page={page}
                  totalPages={totalPages}
                  onPageChange={setPage}
                  totalRecords={totalRecords}
                  limit={limit}
                />
              </div>
            )}
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

      {/* Single Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        itemName={deleteTarget?.email || ''}
        onConfirm={confirmDelete}
        loading={deleteLoading}
        title={isRTL ? 'تأكيد حذف المسؤول' : 'Confirm Delete Admin'}
        message={isRTL ? `هل أنت تأكد من إغلاق وحذف حساب المسؤول "${deleteTarget?.email}"؟ لا يمكن التراجع عن هذا الإجراء.` : `Are you sure you want to delete admin account "${deleteTarget?.email}"? This action cannot be undone.`}
      />

      {/* Bulk Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={showBulkDeleteModal}
        onClose={() => setShowBulkDeleteModal(false)}
        itemName={`${selectedIds.length} ${isRTL ? 'مسؤولين' : 'admins'}`}
        onConfirm={confirmBulkDelete}
        loading={deleteLoading}
        title={isRTL ? 'تأكيد حذف الحسابات المحددة' : 'Confirm Delete Selected Admins'}
        message={isRTL ? `هل أنت متأكد من حذف ${selectedIds.length} من حسابات المسؤولين المحددة؟` : `Are you sure you want to delete ${selectedIds.length} selected admin accounts?`}
      />
    </div>
  );
};

export default AdminsList;
