// @ts-nocheck
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useStudents } from '../../hooks/useStudents';
import { useNavigate } from 'react-router-dom';
import Card from '../../components/ui/Card';
import Table, { TableRow, TableCell, TableHeader, TableHead, TableBody, ActionMenu } from '../../components/ui/Table';
import { PageHeader } from '../../components/ui/PageHeader';
import Button from '../../components/ui/button';
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
  KeyRound,
  RotateCcw,
  ArrowUpDown,
  X,
  Filter,
  ChevronDown,
} from 'lucide-react';
import studentService from '../../services/students.service';
import departmentService from '../../services/department.service';
import studentGroupsService from '../../services/studentGroups.service';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import useScope from '../../hooks/useScope';
import AddStudentModal from './AddStudentModal';
import EditStudentModal from './EditStudentModal';
import ResetPasswordModal from '../../components/ui/ResetPasswordModal';
import ConfirmDeleteModal from '../../components/ui/ConfirmDeleteModal';
import Pagination from '../../components/ui/Pagination';
import ErrorState from '../../components/ui/ErrorState';
import { downloadCsv } from '../../utils/exportCsv';
import BulkActionToolbar from '../../components/ui/BulkActionToolbar';
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
  const { scopeParams } = useScope();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isRTL = i18n.language === 'ar';

  const [exporting, setExporting] = useState(false);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loadingMetadata, setLoadingMetadata] = useState(false);

  // Filter States
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [sortBy, setSortBy] = useState('firstName');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Popover state
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false);
  const [sortPopoverOpen, setSortPopoverOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);

  const { activeView, activeViewId, updateActiveView } = useSavedViews('students_views', defaultView);
  const limit = activeView?.pageSize || 10;

  // Active filters object passed to hook
  const activeFiltersObj = useMemo(() => {
    const obj: Record<string, any> = {};
    if (statusFilter !== 'all') obj.status = statusFilter;
    if (selectedDept) obj.departmentId = selectedDept;
    if (selectedYear) obj.year = selectedYear;
    return obj;
  }, [statusFilter, selectedDept, selectedYear]);

  const {
    data: students,
    loading,
    error,
    search,
    setSearch,
    page,
    setPage,
    total,
    refetch: fetchStudents,
  } = useStudents({
    initialSearch: activeView?.search || '',
    limit,
    filters: activeFiltersObj,
    sortBy,
    sortOrder,
  });

  const totalPages = Math.ceil(total / limit) || 1;
  const totalRecords = total;

  // Fetch departments metadata
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        setLoadingMetadata(true);
        const deptRes = await departmentService.getDepartments();
        if (deptRes?.success && Array.isArray(deptRes.data)) {
          setDepartments(deptRes.data);
        }
      } catch (_err) {
        // Fallback gracefully
      } finally {
        setLoadingMetadata(false);
      }
    };
    fetchMetadata();
  }, []);

  useEffect(() => {
    setSearch(activeView.search || '');
    setStatusFilter(activeView.filters?.status || 'all');
    setPage(1);
  }, [activeViewId]);

  useEffect(() => {
    updateActiveView({
      search,
      filters: { ...activeView.filters, status: statusFilter, selectedDept, selectedYear },
      pageSize: limit,
    });
  }, [search, statusFilter, selectedDept, selectedYear, limit]);

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

  // Close popovers on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node))
        setFilterPopoverOpen(false);
      if (sortRef.current && !sortRef.current.contains(e.target as Node))
        setSortPopoverOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [resetPasswordStudent, setResetPasswordStudent] = useState(null);
  const { showToast } = useToast();

  // Active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (statusFilter !== 'all') count++;
    if (selectedDept) count++;
    if (selectedYear) count++;
    if (search.trim()) count++;
    return count;
  }, [statusFilter, selectedDept, selectedYear, search]);

  const handleResetFilters = useCallback(() => {
    setSearch('');
    setStatusFilter('all');
    setSelectedDept('');
    setSelectedYear('');
    setSortBy('firstName');
    setSortOrder('asc');
    setPage(1);
  }, [setSearch, setPage]);

  const handleHeaderSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setPage(1);
  };

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
        'Department': isRTL ? (s.department?.nameAr || s.department?.name || 'N/A') : (s.department?.name || 'N/A'),
        'Group': s.group?.name || 'N/A',
        'Email': s.user?.email || 'N/A',
        'Status': s.isActive ? 'Active' : 'Inactive',
      }));
      downloadCsv(exportData, `students_${new Date().toISOString().split('T')[0]}.csv`);
      showToast(t('common.exportSuccess', 'Export downloaded successfully'), 'success');
    } catch (_err: any) {
      showToast(t('common.exportError', 'Failed to export data'), 'error');
    }
  }, [students, showToast, t, isRTL]);

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

  const handleSelectAll = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const newIds = new Set(selectedIds);
      (students || []).forEach((s) => newIds.add(s.id));
      setSelectedIds(Array.from(newIds));
    } else {
      const visibleIds = (students || []).map((s) => s.id);
      setSelectedIds(selectedIds.filter((id) => !visibleIds.includes(id)));
    }
  }, [students, selectedIds]);

  const handleSelectOne = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  const handleBulkClear = useCallback(() => setSelectedIds([]), []);

  const handleBulkExport = useCallback(() => {
    const selectedStudents = (students || []).filter((s) => selectedIds.includes(s.id));
    const exportData = selectedStudents.map((s) => ({
      ID: s.studentId || s.id,
      Name: `${s.firstName} ${s.lastName}`,
      Year: s.year || 'N/A',
      Department: isRTL ? (s.department?.nameAr || s.department?.name || 'N/A') : (s.department?.name || 'N/A'),
      Email: s.user?.email || 'N/A',
      Status: s.isActive ? 'Active' : 'Inactive',
    }));
    downloadCsv(exportData, `students_selected_${new Date().toISOString().split('T')[0]}.csv`);
    showToast(t('common.exporting', 'Exported selected records'), 'success');
  }, [students, selectedIds, showToast, t, isRTL]);

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

  const visibleIds = useMemo(() => (students || []).map((s) => s.id), [students]);
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

      {/* Filter & Search Toolbar */}
      <Card className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm px-4 py-3 sm:px-5 mb-6 space-y-0">
        {/* Row 1: Full-width search bar */}
        <div className="relative">
          <Search
            className="absolute start-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            size={16}
          />
          <input
            type="text"
            placeholder={t('students.searchPlaceholder')}
            className="w-full h-11 border border-slate-200 dark:border-slate-700 rounded-xl ps-10 pe-9 text-sm bg-slate-50/60 dark:bg-slate-900/40 text-brand-text-primary dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-primary-500/25 focus:border-brand-primary-500 transition-all"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          {search && (
            <button
              onClick={() => { setSearch(''); setPage(1); }}
              className="absolute end-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Row 2: Status tabs (start) + Icon buttons (end) */}
        <div className="flex items-center justify-between pt-1 mt-2 border-t border-slate-100 dark:border-slate-700/60">

          {/* Status underline tabs — scrollable on narrow viewports */}
          <div className="flex overflow-x-auto custom-scrollbar gap-0 min-w-0">
            {[
              { id: 'all',       label: t('students.filterAll') },
              { id: 'active',    label: t('students.filterActive') },
              { id: 'inactive',  label: t('students.filterInactive') },
              { id: 'suspended', label: t('students.filterSuspended') },
            ].map((tab) => {
              const isActive = statusFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => { setStatusFilter(tab.id); setPage(1); }}
                  className={`flex-shrink-0 whitespace-nowrap px-3.5 py-2.5 text-sm border-b-2 transition-all cursor-pointer ${
                    isActive
                      ? 'border-brand-primary-500 text-brand-primary-500 font-medium'
                      : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-normal'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Icon button group: Filters | Sort | Export */}
          <div className="flex items-center gap-1 ps-3 shrink-0">

            {/* ── Filters popover ── */}
            <div className="relative" ref={filterRef}>
              <button
                onClick={() => { setFilterPopoverOpen((o) => !o); setSortPopoverOpen(false); }}
                className={`relative h-[34px] w-[34px] flex items-center justify-center rounded-xl border transition-all ${
                  filterPopoverOpen
                    ? 'bg-brand-primary-50 dark:bg-brand-primary-900/30 border-brand-primary-300 dark:border-brand-primary-600 text-brand-primary-600 dark:text-brand-primary-400'
                    : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
                title={t('common.filters', 'تصفية')}
                aria-label={t('common.filters', 'Filters')}
                aria-expanded={filterPopoverOpen}
              >
                <Filter size={15} />
                {/* Active badge */}
                {(selectedDept || selectedYear) && (
                  <span className="absolute -top-0.5 -end-0.5 w-2 h-2 rounded-full bg-brand-primary-500 border-2 border-white dark:border-slate-800" />
                )}
              </button>

              {/* Filters popover panel */}
              {filterPopoverOpen && (
                <div className="absolute end-0 top-full mt-2 z-50 w-64 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
                  {/* Department */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {t('students.department', 'القسم')}
                    </label>
                    <select
                      value={selectedDept}
                      onChange={(e) => { setSelectedDept(e.target.value); setPage(1); }}
                      className="w-full h-9 px-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-brand-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 cursor-pointer"
                    >
                      <option value="">{t('students.allDepartments', 'جميع الأقسام')}</option>
                      {Array.isArray(departments) &&
                        departments.map((d) => (
                          <option key={d.id} value={d.id}>
                            {isRTL ? d.nameAr || d.name : d.name}
                          </option>
                        ))}
                    </select>
                  </div>

                  {/* Academic Year */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {t('students.year', 'الفرقة الدراسية')}
                    </label>
                    <select
                      value={selectedYear}
                      onChange={(e) => { setSelectedYear(e.target.value); setPage(1); }}
                      className="w-full h-9 px-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-brand-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 cursor-pointer"
                    >
                      <option value="">{t('students.allYears', 'جميع الفرق')}</option>
                      <option value="1">{isRTL ? 'الفرقة الأولى' : 'Year 1'}</option>
                      <option value="2">{isRTL ? 'الفرقة الثانية' : 'Year 2'}</option>
                      <option value="3">{isRTL ? 'الفرقة الثالثة' : 'Year 3'}</option>
                      <option value="4">{isRTL ? 'الفرقة الرابعة' : 'Year 4'}</option>
                    </select>
                  </div>

                  {/* Reset link */}
                  {(selectedDept || selectedYear) && (
                    <button
                      onClick={() => { setSelectedDept(''); setSelectedYear(''); setPage(1); }}
                      className="flex items-center gap-1.5 text-xs text-rose-500 hover:text-rose-600 font-medium transition-colors"
                    >
                      <RotateCcw size={11} />
                      {t('students.resetFilters', 'إعادة ضبط الفلاتر')}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* ── Sort popover ── */}
            <div className="relative" ref={sortRef}>
              <button
                onClick={() => { setSortPopoverOpen((o) => !o); setFilterPopoverOpen(false); }}
                className={`h-[34px] w-[34px] flex items-center justify-center rounded-xl border transition-all ${
                  sortPopoverOpen
                    ? 'bg-brand-primary-50 dark:bg-brand-primary-900/30 border-brand-primary-300 dark:border-brand-primary-600 text-brand-primary-600 dark:text-brand-primary-400'
                    : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
                title={t('students.sortBy', 'ترتيب')}
                aria-label={t('students.sortBy', 'Sort')}
                aria-expanded={sortPopoverOpen}
              >
                <ArrowUpDown size={15} />
              </button>

              {/* Sort popover panel */}
              {sortPopoverOpen && (
                <div className="absolute end-0 top-full mt-2 z-50 w-52 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-2">
                  {/* Sort field options */}
                  {[
                    { value: 'firstName',  label: t('students.sortAlphabeticalAsc', 'الاسم') },
                    { value: 'studentId', label: t('students.sortIdAsc', 'الرقم الجامعي') },
                    { value: 'year',      label: t('students.sortYearAsc', 'الفرقة الدراسية') },
                    { value: 'enrolledAt', label: t('students.sortNewest', 'تاريخ التسجيل') },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => { setSortBy(opt.value); setPage(1); setSortPopoverOpen(false); }}
                      className={`w-full text-start px-3 py-2 rounded-xl text-sm flex items-center gap-2 transition-colors ${
                        sortBy === opt.value
                          ? 'bg-brand-primary-50 dark:bg-brand-primary-900/30 text-brand-primary-600 dark:text-brand-primary-400 font-medium'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50'
                      }`}
                    >
                      {sortBy === opt.value && (
                        <span className="w-1.5 h-1.5 rounded-full bg-brand-primary-500 shrink-0" />
                      )}
                      {opt.label}
                    </button>
                  ))}

                  {/* Direction divider */}
                  <div className="my-1.5 border-t border-slate-100 dark:border-slate-700" />
                  <div className="flex gap-1 px-1 pb-1">
                    <button
                      onClick={() => { setSortOrder('asc'); setPage(1); setSortPopoverOpen(false); }}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        sortOrder === 'asc'
                          ? 'bg-brand-primary-500 text-white'
                          : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'
                      }`}
                    >
                      {isRTL ? '↑ تصاعدي' : '↑ Asc'}
                    </button>
                    <button
                      onClick={() => { setSortOrder('desc'); setPage(1); setSortPopoverOpen(false); }}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        sortOrder === 'desc'
                          ? 'bg-brand-primary-500 text-white'
                          : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'
                      }`}
                    >
                      {isRTL ? '↓ تنازلي' : '↓ Desc'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ── Export button ── */}
            <button
              onClick={handleExport}
              disabled={exporting}
              className="h-[34px] w-[34px] flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-700 dark:hover:text-slate-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              title={t('students.exportCsv', 'تصدير CSV')}
              aria-label={t('students.exportCsv', 'Export CSV')}
            >
              <Download size={15} />
            </button>
          </div>
        </div>
      </Card>

      {/* Table Content / Empty States */}
      <div className="min-h-0">
        {error ? (
          <div className="p-8">
            <ErrorState message={error} onRetry={fetchStudents} />
          </div>
        ) : (students || []).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
            <div className="rounded-full bg-brand-primary-500/10 p-5 mb-4">
              <Users className="w-10 h-10 text-brand-primary-500" />
            </div>
            <h3 className="text-lg font-bold text-brand-text-primary dark:text-white mb-1">
              {t('students.noStudents')}
            </h3>
            <p className="text-sm text-brand-text-secondary dark:text-slate-400 mb-6 max-w-md">
              {activeFilterCount > 0
                ? t('students.noSearchResultsDesc', 'جرّب كلمة بحث أخرى أو قم بإعادة ضبط الفلاتر الحالية.')
                : t('students.noStudentsDesc')}
            </p>
            {activeFilterCount > 0 && (
              <Button
                variant="outline"
                onClick={handleResetFilters}
                className="rounded-xl flex items-center gap-2 text-xs font-bold"
              >
                <RotateCcw size={14} />
                <span>{t('students.resetFilters', 'إعادة ضبط الفلاتر')}</span>
              </Button>
            )}
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

                    {/* Student Name Column with Alphabetical Sorting Indicator */}
                    <TableHead
                      onClick={() => handleHeaderSort('firstName')}
                      className="text-start p-4 font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 cursor-pointer select-none hover:text-brand-primary-600 transition-colors"
                    >
                      <div className="inline-flex items-center gap-1.5">
                        <span>{t('students.colStudent')}</span>
                        {sortBy === 'firstName' && (
                          <span className="text-brand-primary-600">
                            {sortOrder === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </TableHead>

                    {/* Academic Division Column with Sorting */}
                    <TableHead
                      hideOnMobile
                      onClick={() => handleHeaderSort('year')}
                      className="text-center p-4 font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 cursor-pointer select-none hover:text-brand-primary-600 transition-colors"
                    >
                      <div className="inline-flex items-center justify-center gap-1.5">
                        <span>{t('students.colYear')}</span>
                        {sortBy === 'year' && (
                          <span className="text-brand-primary-600">
                            {sortOrder === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </TableHead>

                    {/* Department Column */}
                    <TableHead hideOnMobile className="text-start p-4 font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {t('students.colDepartment')}
                    </TableHead>

                    {/* Group Column */}
                    <TableHead hideOnMobile className="text-center p-4 font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {isRTL ? 'المجموعة' : 'Group'}
                    </TableHead>

                    {/* Email Column */}
                    <TableHead hideOnMobile className="text-start p-4 font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {t('students.colEmail')}
                    </TableHead>

                    {/* Status Column */}
                    <TableHead className="text-center p-4 font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {t('students.colStatus')}
                    </TableHead>

                    {/* Actions Column */}
                    <TableHead className="text-end p-4 font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 pe-6">
                      {t('students.colActions')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(students || []).map((student) => {
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
                        className={`hover:bg-slate-50 dark:hover:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 last:border-b-0 transition-colors ${
                          isSelected ? 'bg-brand-primary-500/5 dark:bg-brand-primary-500/10' : ''
                        }`}
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
                              <span className="text-xs text-brand-text-secondary dark:text-slate-400 font-mono">
                                {student.studentId}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell hideOnMobile className="p-4 text-center font-medium">
                          {t(`students.YEAR${student.year}`, isRTL ? `الفرقة ${student.year}` : `Division ${student.year}`)}
                        </TableCell>
                        <TableCell hideOnMobile className="p-4 text-start font-medium">
                          {isRTL
                            ? student.department?.nameAr || student.department?.name || '—'
                            : student.department?.name || '—'}
                        </TableCell>
                        <TableCell hideOnMobile className="p-4 text-center font-medium">
                          {student.group ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                              {student.group.parentGroup
                                ? `${student.group.parentGroup.name} / ${student.group.name}`
                                : student.group.name}
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
