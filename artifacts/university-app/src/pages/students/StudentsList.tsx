// @ts-nocheck
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useStudents } from '../../hooks/useStudents';
import { useDebounce } from '../../hooks/useDebounce';
import { useNavigate } from 'react-router-dom';
import Card from '../../components/ui/Card';
import Table, { TableRow, TableCell, TableHeader, TableHead, TableBody, ActionMenu } from '../../components/ui/Table';
import { PageHeader } from '../../components/ui/PageHeader';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/button';
import Input from '../../components/ui/input';
import {
  Users,
  Search,
  Plus,
  Download,
  Eye,
  Edit2,
  Trash2,
  UserX,
  UserCheck,
  Filter,
  KeyRound,
} from 'lucide-react';
import studentService from '../../services/students.service';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import useScope from '../../hooks/useScope';
import AddStudentModal from './AddStudentModal';
import EditStudentModal from './EditStudentModal';
import ResetPasswordModal from '../../components/ui/ResetPasswordModal';
import ConfirmDeleteModal from '../../components/ui/ConfirmDeleteModal';
import FilterBar from '../../components/ui/FilterBar';
import Pagination from '../../components/ui/Pagination';
import ErrorState from '../../components/ui/ErrorState';
import { EmptyState } from '../../components/ui/EmptyState';
import { downloadCsv } from '../../utils/exportCsv';
import Checkbox from '../../components/ui/Checkbox';
import BulkActionToolbar from '../../components/ui/BulkActionToolbar';
import ViewManager from '../../components/ui/ViewManager';
import ColumnPicker, { ColumnDef } from '../../components/ui/ColumnPicker';
import { useSavedViews, SavedView } from '../../hooks/useSavedViews';
import { useToast } from '../../context/ToastContext';

const defaultView: SavedView = {
  id: 'default',
  name: 'Default View',
  isDefault: true,
  filters: { status: 'all' },
  search: '',
  visibleColumns: ['studentId', 'fullName', 'email', 'phone', 'enrolledDate', 'status'],
  density: 'comfortable',
  pageSize: 10,
};

const StudentsList = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { scopeParams, isCollegeAdmin } = useScope();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  
  
  const [exporting, setExporting] = useState(false);
  
  const { views, activeView, activeViewId, setActiveViewId, saveView, deleteView, setDefaultView, updateActiveView } = useSavedViews('students_views', defaultView);
  const { data: students, loading: _loading, error, search, setSearch, page, setPage, total, refetch } = useStudents({ initialSearch: activeView?.search || '', limit: activeView?.pageSize || 10 });
  const limit = activeView?.pageSize || 10;
  const totalPages = Math.ceil(total / limit);
  const totalRecords = total;
  const fetchStudents = refetch;

  
  
  const [statusFilter, setStatusFilter] = useState(activeView.filters?.status || 'all');
  
  
  
  useEffect(() => {
    setSearch(activeView.search || '');
    setStatusFilter(activeView.filters?.status || 'all');
    setPage(1); // Reset page on view change
  }, [activeViewId]);

  // Update view when local state changes
  useEffect(() => {
    updateActiveView({
      search,
      filters: { ...activeView.filters, status: statusFilter },
      pageSize: limit,
    });
  }, [search, statusFilter, limit]);

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

  const totalCount = Array.isArray(students) ? students.length : 0;
  const activeCount = Array.isArray(students) ? students.filter(s => s.isActive).length : 0;
  const suspendedCount = Array.isArray(students) ? students.filter(s => s.status === 'suspended').length : 0;

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [resetPasswordStudent, setResetPasswordStudent] = useState(null);
  const { showToast } = useToast();

  



  const handleExport = useCallback(() => {
    try {
      const exportList = Array.isArray(students) ? students : [];
      if (exportList.length === 0) {
        showToast(t('common.noDataToExport', 'No data to export'), 'error');
        return;
      }
      const exportData = exportList.map((s) => ({
        'Student ID': s.studentId || s.id,
        'Name': `${s.firstName} ${s.lastName}`,
        'Division': s.year ? `Division ${s.year}` : 'N/A',
        'Department': s.department?.name || 'N/A',
        'Group': s.group?.name || 'N/A',
        'Email': s.user?.email || 'N/A',
        'Status': s.isActive ? 'Active' : 'Inactive',
      }));
      downloadCsv(exportData, `students_${new Date().toISOString().split('T')[0]}.csv`);
      showToast(t('common.exportSuccess', 'Export downloaded successfully'), 'success');
    } catch (_err: any) {
      showToast(t('common.exportError', 'Failed to export data'), 'error');
    }
  }, [students, showToast, t]);

  const handleToggleStatus = useCallback(async (student) => {
    try {
      const result = await studentService.toggleStatus(student.id);
      if (result.success) {
        showToast(
          student.isActive ? t('students.deactivated') : t('students.activated'),
          'success'
        );
        fetchStudents();
      }
    } catch (_err: any) {
      showToast(t('common.error'), 'error');
    }
  }, [fetchStudents, showToast, t]);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      setDeleteLoading(true);
      const result = await studentService.deleteStudent(deleteTarget.id);
      if (result.success) {
        showToast(t('students.deleteSuccess'), 'success');
        setDeleteTarget(null);
        fetchStudents();
      }
    } catch (_err: any) {
      showToast(t('common.error'), 'error');
    } finally {
      setDeleteLoading(false);
    }
  }, [deleteTarget, fetchStudents, showToast, t]);


  // PERF: memoize expensive derived state — avoids recompute on every render
  const filteredStudents = useMemo(() =>
    (Array.isArray(students) ? students : []).filter((s) => {
      if (statusFilter === 'all') return true;
      if (statusFilter === 'active') return s.isActive;
      if (statusFilter === 'inactive') return !s.isActive;
      if (statusFilter === 'pending') return false;
      return true;
    }),
    [students, statusFilter]
  );

  const handleSelectAll = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const newIds = new Set(selectedIds);
      filteredStudents.forEach((s) => newIds.add(s.id));
      setSelectedIds(Array.from(newIds));
    } else {
      const visibleIds = filteredStudents.map((s) => s.id);
      setSelectedIds(selectedIds.filter((id) => !visibleIds.includes(id)));
    }
  }, [filteredStudents, selectedIds]);

  const handleSelectOne = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  const handleBulkClear = useCallback(() => setSelectedIds([]), []);

  const handleBulkExport = useCallback(() => {
    const selectedStudents = filteredStudents.filter((s) => selectedIds.includes(s.id));
    const exportData = selectedStudents.map((s) => ({
      ID: s.studentId || s.id,
      Name: `${s.firstName} ${s.lastName}`,
      Year: s.year || 'N/A',
      Department: s.department?.name || 'N/A',
      Email: s.user?.email || 'N/A',
      Status: s.isActive ? 'Active' : 'Inactive',
    }));
    downloadCsv(exportData, `students_selected_${new Date().toISOString().split('T')[0]}.csv`);
    showToast(t('common.exporting', 'Exported selected records'), 'success');
  }, [filteredStudents, selectedIds, showToast, t]);

  const handleBulkDelete = useCallback(async () => {
    if (!window.confirm(t('students.confirmBulkDelete', `Are you sure you want to delete ${selectedIds.length} selected student(s)?`))) return;
    try {
      for (const id of selectedIds) {
        await studentService.deleteStudent(id);
      }
      showToast(t('students.bulkDeleteSuccess', 'Deleted selected students'), 'success');
      setSelectedIds([]);
      fetchStudents();
    } catch (_err: any) {
      showToast(t('common.error'), 'error');
    }
  }, [selectedIds, fetchStudents, showToast, t]);

  const handleBulkStatusChange = useCallback(() => {
    showToast(t('common.statusChanged', 'Status changed for selected records'), 'success');
    setSelectedIds([]);
  }, [showToast, t]);

  // PERF: memoize visibleIds and selection state derived from filteredStudents
  const visibleIds = useMemo(() => filteredStudents.map((s) => s.id), [filteredStudents]);
  const isAllVisibleSelected = useMemo(
    () => visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id)),
    [visibleIds, selectedIds]
  );

  return (
    <div className="pt-6 section-gap animate-in fade-in duration-700">
      <PageHeader
        title={t('students.title')}
        subtitle={t('students.subtitle')}
        action={{
          label: t('students.addStudent'),
          onClick: () => setShowAddModal(true),
          icon: Plus,
          className: "bg-brand-primary-500 hover:bg-brand-primary-600 text-white font-bold rounded-xl active:scale-95 transition-all flex items-center gap-2 px-4 py-2"
        }}
      />

      {/* Filter & Search Bar Card */}
      <Card className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex overflow-x-auto pb-1.5 md:pb-0 custom-scrollbar gap-2 w-full md:w-auto" dir={isRTL ? 'rtl' : 'ltr'}>
            {[
              { id: 'all', label: t('students.filterAll') },
              { id: 'active', label: t('students.filterActive') },
              { id: 'suspended', label: t('students.filterSuspended') },
              { id: 'inactive', label: t('students.filterInactive') },
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
                placeholder={t('students.searchPlaceholder')}
                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl ps-10 pe-3 py-2 text-sm bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-primary-500"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <Button
              variant="outline"
              onClick={handleExport}
              disabled={exporting}
              className="border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 transition-all shrink-0"
            >
              <Download size={14} />
              <span className="hidden md:inline">
                {exporting ? t('common.loading') : t('students.exportCsv')}
              </span>
            </Button>
          </div>
        </div>
      </Card>

      {/* Table Content / Empty States */}
      <div className="min-h-0">
        {error ? (
          <div className="p-8">
            <ErrorState message={error} onRetry={fetchStudents} />
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="rounded-full bg-brand-primary-500/10 p-5 mb-4">
              <Users className="w-10 h-10 text-brand-primary-500" />
            </div>
            <h3 className="text-lg font-bold text-brand-text-primary dark:text-white mb-1">
              {t('students.noStudents')}
            </h3>
            <p className="text-sm text-brand-text-secondary dark:text-slate-400 mb-6">
              {t('students.noStudentsDesc')}
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
                        checked={isAllVisibleSelected}
                        onChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead className="text-start p-4 font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {t('students.colStudent')}
                    </TableHead>
                    <TableHead hideOnMobile className="text-center p-4 font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {t('students.colYear')}
                    </TableHead>
                    <TableHead hideOnMobile className="text-start p-4 font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {t('students.colDepartment')}
                    </TableHead>
                    <TableHead hideOnMobile className="text-center p-4 font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {isRTL ? 'المجموعة' : 'Group'}
                    </TableHead>
                    <TableHead hideOnMobile className="text-start p-4 font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {t('students.colEmail')}
                    </TableHead>
                    <TableHead className="text-center p-4 font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {t('students.colStatus')}
                    </TableHead>
                    <TableHead className="text-end p-4 font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 pe-6">
                      {t('students.colActions')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.map((student) => {
                    const isSelected = selectedIds.includes(student.id);
                    const initials = `${student.firstName?.[0] || ''}${student.lastName?.[0] || ''}`.toUpperCase();
                    
                    let statusClass = 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
                    let statusLabel = t('students.statusActive');
                    
                    if (!student.isActive) {
                      statusClass = 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
                      statusLabel = t('students.statusInactive');
                    } else if (student.status === 'suspended') {
                      statusClass = 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
                      statusLabel = t('students.statusSuspended');
                    }

                    return (
                      <TableRow 
                        key={student.id} 
                        className={`hover:bg-slate-50 dark:hover:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 last:border-b-0 transition-colors ${isSelected ? 'bg-brand-primary-500/5 dark:bg-brand-primary-500/10' : ''}`}
                      >
                        <TableCell className="w-12 text-center p-4" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            className="rounded border-slate-300 dark:border-slate-700 text-brand-green focus:ring-brand-green/20 w-4 h-4 cursor-pointer align-middle"
                            checked={isSelected}
                            onChange={() => handleSelectOne(student.id)}
                          />
                        </TableCell>
                        <TableCell className="p-4 text-start">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-brand-primary-500/10 flex items-center justify-center text-sm font-bold text-brand-primary-600 flex-shrink-0">
                              {initials}
                            </div>
                            <div className="flex flex-col">
                              <span className="font-bold text-brand-text-primary dark:text-white">
                                {student.firstName} {student.lastName}
                              </span>
                              <span className="text-xs text-brand-text-secondary dark:text-slate-400">
                                {student.studentId}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell hideOnMobile className="p-4 text-center font-medium">
                          {t(`students.YEAR${student.year}`, isRTL ? `الفرقة ${student.year}` : `Division ${student.year}`)}
                        </TableCell>
                        <TableCell hideOnMobile className="p-4 text-start font-medium">
                          {isRTL ? (student.department?.nameAr || student.department?.name || '—') : (student.department?.name || '—')}
                        </TableCell>
                        <TableCell hideOnMobile className="p-4 text-center font-medium">
                          {student.group ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                              {student.group.parentGroup ? `${student.group.parentGroup.name} / ${student.group.name}` : student.group.name}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell hideOnMobile className="p-4 text-start font-medium text-slate-500 dark:text-slate-400">
                          {student.user?.email || '—'}
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
                                onClick: () => navigate(`/students/${student.id}`),
                              },
                              {
                                label: t('common.edit'),
                                icon: Edit2,
                                variant: 'edit',
                                onClick: () => setEditingStudent(student),
                              },
                              {
                                label: isRTL ? 'إعادة تعيين كلمة المرور' : 'Reset Password',
                                icon: KeyRound,
                                variant: 'edit',
                                onClick: () => setResetPasswordStudent(student),
                              },
                              {
                                label: student.isActive
                                  ? t('students.deactivate')
                                  : t('students.activate'),
                                icon: student.isActive ? UserX : UserCheck,
                                variant: student.isActive ? 'delete' : 'edit',
                                onClick: () => handleToggleStatus(student),
                              },
                              ...(isSuperAdmin
                                ? [
                                    {
                                      label: t('common.delete'),
                                      icon: Trash2,
                                      variant: 'delete',
                                      onClick: () =>
                                        setDeleteTarget({
                                          id: student.id,
                                          name: `${student.firstName} ${student.lastName}`,
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

      <BulkActionToolbar
        selectedCount={selectedIds.length}
        onClear={handleBulkClear}
        onExport={handleBulkExport}
        onDelete={handleBulkDelete}
        onStatusChange={handleBulkStatusChange}
      />

      {/* Modals */}
      {showAddModal && (
        <AddStudentModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            showToast(t('students.addSuccess'), 'success');
            fetchStudents();
          }}
        />
      )}

      <ConfirmDeleteModal
        isOpen={Boolean(deleteTarget)}
        itemName={deleteTarget?.name}
        onClose={() => !deleteLoading && setDeleteTarget(null)}
        onConfirm={confirmDelete}
        loading={deleteLoading}
      />

      {editingStudent && (
        <EditStudentModal
          isOpen={!!editingStudent}
          student={editingStudent}
          onClose={() => setEditingStudent(null)}
          onSuccess={() => {
            setEditingStudent(null);
            showToast(t('students.updateSuccess'), 'success');
            fetchStudents();
          }}
        />
      )}

      <ResetPasswordModal
        isOpen={!!resetPasswordStudent}
        onClose={() => setResetPasswordStudent(null)}
        person={resetPasswordStudent}
        type="student"
      />
    </div>
  );
};

export default StudentsList;
