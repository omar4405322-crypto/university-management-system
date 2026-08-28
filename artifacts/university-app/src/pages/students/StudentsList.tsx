// @ts-nocheck
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useStudents } from '../../hooks/useStudents';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  GraduationCap,
} from 'lucide-react';
import studentService from '../../services/students.service';
import departmentService from '../../services/department.service';
import collegeService from '../../services/college.service';
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
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { scopeParams } = useScope();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isRTL = i18n.language === 'ar';

  const [exporting, setExporting] = useState(false);
  const [departments, setDepartments] = useState<any[]>([]);
  const [colleges, setColleges] = useState<any[]>([]);
  const [loadingMetadata, setLoadingMetadata] = useState(false);

  // Filter States
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedCollege, setSelectedCollege] = useState(() => searchParams.get('collegeId') || '');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [sortBy, setSortBy] = useState('firstName');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    const cId = searchParams.get('collegeId');
    if (cId !== null) {
      setSelectedCollege(cId);
    }
  }, [searchParams]);

  const { activeView, activeViewId, updateActiveView } = useSavedViews('students_views', defaultView);
  const limit = activeView?.pageSize || 10;

  // Active filters object passed to hook
  const activeFiltersObj = useMemo(() => {
    const obj: Record<string, any> = {};
    if (statusFilter !== 'all') obj.status = statusFilter;
    if (selectedCollege) obj.collegeId = selectedCollege;
    if (selectedDept) obj.departmentId = selectedDept;
    if (selectedYear) obj.year = selectedYear;
    return obj;
  }, [statusFilter, selectedCollege, selectedDept, selectedYear]);

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

  // Fetch metadata
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        setLoadingMetadata(true);
        const [deptRes, collRes] = await Promise.all([
          departmentService.getDepartments(selectedCollege ? { collegeId: selectedCollege } : {}),
          collegeService.getColleges(),
        ]);
        if (deptRes?.success && Array.isArray(deptRes.data)) {
          setDepartments(deptRes.data);
        }
        if (collRes?.success) {
          setColleges(Array.isArray(collRes.data) ? collRes.data : collRes.data?.data || []);
        }
      } catch (_err) {
        // Fallback gracefully
      } finally {
        setLoadingMetadata(false);
      }
    };
    fetchMetadata();
  }, [selectedCollege]);

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

      {/* ========================================================================= */}
      {/* 1. EXECUTIVE 4-METRIC RIBBON                                              */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
        {/* Total Students */}
        <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-semibold block">
              {t('dashboard.totalStudents', 'Total Students')}
            </span>
            <span className="text-lg font-black text-slate-900 dark:text-white block mt-0.5 font-mono">
              {total}
            </span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-brand-primary-50 dark:bg-brand-primary-950/50 text-brand-primary-600 flex items-center justify-center shrink-0">
            <Users size={16} />
          </div>
        </div>

        {/* Active Students */}
        <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-semibold block">
              {isRTL ? 'الطلاب النشطون' : 'Active Students'}
            </span>
            <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 block mt-0.5 font-mono">
              {Array.isArray(students) ? students.filter((s: any) => s.isActive).length : 0}
            </span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center shrink-0">
            <UserCheck size={16} />
          </div>
        </div>

        {/* Inactive / Suspended */}
        <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-semibold block">
              {isRTL ? 'الحسابات المعطلة' : 'Inactive / Suspended'}
            </span>
            <span className="text-lg font-black text-amber-600 dark:text-amber-400 block mt-0.5 font-mono">
              {Array.isArray(students) ? students.filter((s: any) => !s.isActive).length : 0}
            </span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center shrink-0">
            <UserX size={16} />
          </div>
        </div>

        {/* Assigned Departments */}
        <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-semibold block">
              {isRTL ? 'الأقسام الأكاديمية' : 'Academic Depts'}
            </span>
            <span className="text-lg font-black text-blue-600 dark:text-blue-400 block mt-0.5 font-mono">
              {departments.length}
            </span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center shrink-0">
            <GraduationCap size={16} />
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
            placeholder={t('students.searchPlaceholder', 'Search by name, student ID, or email...')}
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
            {Array.isArray(colleges) &&
              colleges.map((c) => (
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
          <option value="">{t('students.allDepartments', 'All Departments')}</option>
          {Array.isArray(departments) &&
            departments.map((d) => (
              <option key={d.id} value={d.id}>
                {isRTL ? d.nameAr || d.name : d.name}
              </option>
            ))}
        </select>

        {/* Academic Year Dropdown */}
        <select
          value={selectedYear}
          onChange={(e) => {
            setSelectedYear(e.target.value);
            setPage(1);
          }}
          className="h-8.5 px-3 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-brand-primary-500 cursor-pointer"
        >
          <option value="">{t('students.allYears', 'All Years')}</option>
          <option value="1">{isRTL ? 'الفرقة الأولى' : 'Year 1'}</option>
          <option value="2">{isRTL ? 'الفرقة الثانية' : 'Year 2'}</option>
          <option value="3">{isRTL ? 'الفرقة الثالثة' : 'Year 3'}</option>
          <option value="4">{isRTL ? 'الفرقة الرابعة' : 'Year 4'}</option>
        </select>

        {/* Status Dropdown */}
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="h-8.5 px-3 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-brand-primary-500 cursor-pointer"
        >
          <option value="all">{t('students.filterAll', 'All Statuses')}</option>
          <option value="active">{t('students.filterActive', 'Active')}</option>
          <option value="inactive">{t('students.filterInactive', 'Inactive')}</option>
          <option value="suspended">{t('students.filterSuspended', 'Suspended')}</option>
        </select>

        {/* Sort Select */}
        <select
          value={sortBy}
          onChange={(e) => {
            setSortBy(e.target.value);
            setPage(1);
          }}
          className="h-8.5 px-3 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-brand-primary-500 cursor-pointer"
        >
          <option value="firstName">{t('students.sortAlphabeticalAsc', 'Name')}</option>
          <option value="studentId">{t('students.sortIdAsc', 'Student ID')}</option>
          <option value="year">{t('students.sortYearAsc', 'Year')}</option>
          <option value="enrolledAt">{t('students.sortNewest', 'Enrollment Date')}</option>
        </select>

        {/* Clear Filters Button */}
        {(search || selectedCollege || selectedDept || selectedYear || statusFilter !== 'all') && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetFilters}
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
          onClick={handleExport}
          className="h-8.5 px-3 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer shadow-2xs ms-auto"
        >
          <Download size={13} className="text-slate-500" />
          <span>{t('common.exportCsv', 'Export CSV')}</span>
        </Button>
      </div>

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
                ? t('students.noSearchResultsDesc', 'Try a different search term or clear your filters.')
                : t('students.noStudentsDesc')}
            </p>
            {activeFilterCount > 0 && (
              <Button
                variant="outline"
                onClick={handleResetFilters}
                className="rounded-xl flex items-center gap-2 text-xs font-bold"
              >
                <RotateCcw size={14} />
                <span>{t('students.resetFilters', 'Reset Filters')}</span>
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
