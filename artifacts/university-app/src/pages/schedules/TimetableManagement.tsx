import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Edit2,
  Trash2,
  Loader2,
  AlertCircle,
  Building2,
  LayoutGrid,
  List,
  Eye,
  Plus,
  BookOpen,
  Search,
  RotateCcw,
  RotateCw,
  Globe,
  Clock,
  X,
  CheckSquare,
  Square,
  MinusSquare,
  CheckCircle2,
  Layers,
  GraduationCap
} from 'lucide-react';
import Card, { StatCard } from '../../components/ui/card';
import Button from '../../components/ui/button';
import Pagination from '../../components/ui/pagination';
import BulkActionToolbar from '../../components/ui/BulkActionToolbar';
import ConfirmDeleteModal from '../../components/ui/ConfirmDeleteModal';
import { downloadCsv } from '../../utils/exportCsv';
import timetableService from '../../services/timetable.service';
import collegeService from '../../services/college.service';
import departmentService from '../../services/department.service';
import type { College, Department } from '../../types/timetable.types';
import type { ApiResponse, TimetableItem } from '../../types/models';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import useScope from '../../hooks/useScope';
import TimetableModal from './TimetableModal';
import {
  isSelectionAllowedForRole,
  toggleOne,
  isAllPageSelected,
  isSomePageSelected,
  toggleCurrentPage,
  clearSelection
} from '../../utils/scheduleSelectionRules';
import { logger } from '../../lib/logger';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';

export type { TimetableItem };

const TimetableManagement = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { scopeParams, isCollegeAdmin, hideCollegeSelector, hideDepartmentSelector } = useScope();
  const { isRTL } = useLanguage();
  const navigate = useNavigate();
  const { showToast } = useToast();

  // View Mode: 'CARD' | 'LIST'
  const [viewMode, setViewMode] = useState<'CARD' | 'LIST'>('CARD');

  // Loading & Data States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timetables, setTimetables] = useState<TimetableItem[]>([]);
  const [colleges, setColleges] = useState<College[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<TimetableItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false);

  // Filter States
  const [search, setSearch] = useState('');
  const [selectedCollege, setSelectedCollege] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedSemester, setSelectedSemester] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Pagination State
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  // Multi-Selection State
  const [selectedIds, setSelectedIds] = useState<Set<number | string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTimetable, setEditingTimetable] = useState<TimetableItem | null>(null);

  const canManage = isSelectionAllowedForRole(user?.role);

  // 1. Fetch Metadata (Colleges & Departments)
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [collegesRes, deptsRes] = await Promise.all([
          collegeService.getColleges({ limit: 100 }).catch((): ApiResponse<any> => ({ success: false, data: [] })),
          departmentService.getDepartments({ limit: 200 }).catch((): ApiResponse<any> => ({ success: false, data: [] })),
        ]);

        if (collegesRes.success || collegesRes.data) {
          const raw = collegesRes.data;
          const arr = Array.isArray(raw)
            ? raw
            : raw?.colleges || raw?.data || [];
          setColleges(arr);
        }

        if (deptsRes.success || deptsRes.data) {
          const raw = deptsRes.data;
          const arr = Array.isArray(raw)
            ? raw
            : raw?.departments || raw?.data || [];
          setDepartments(arr);
        }
      } catch (err) {
        logger.error('Error fetching metadata:', err);
      }
    };

    fetchMetadata();
  }, []);

  // Cascading departments for selected college
  const filteredDepartments = useMemo(() => {
    if (!selectedCollege) return departments;
    const colId = parseInt(selectedCollege, 10);
    return departments.filter((d) => d.collegeId === colId);
  }, [departments, selectedCollege]);

  // 2. Fetch Master Timetable Records
  const fetchTimetables = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, any> = { ...scopeParams, limit: 100 };
      const result = await timetableService.getTimetables(params);
      const data = result?.data || result || {};
      const arr = Array.isArray(data.timetables)
        ? data.timetables
        : Array.isArray(data)
        ? data
        : [];
      setTimetables(arr);
    } catch (err: any) {
      logger.error('Error fetching timetables:', err);
      setError(err.message || t('common.fetchError', 'Failed to load timetables.'));
    } finally {
      setLoading(false);
    }
  }, [scopeParams, t]);

  useEffect(() => {
    fetchTimetables();
  }, [fetchTimetables]);

  // Delete Timetable
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleteLoading(true);
      const result = await timetableService.deleteTimetable(String(deleteTarget.id));
      if (result.success || result) {
        showToast(t('common.deleteSuccess', 'تم حذف الجدول الدراسي بنجاح'), 'success');
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(deleteTarget.id);
          return next;
        });
        setDeleteTarget(null);
        fetchTimetables();
      }
    } catch (err: any) {
      showToast(err.message || t('common.deleteError', 'خطأ في حذف الجدول الدراسي'), 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Toggle Publish / Unpublish Status
  const handleTogglePublish = async (id: number | string, currentStatus?: string) => {
    try {
      if (currentStatus === 'PUBLISHED') {
        await timetableService.unpublishTimetable(String(id));
        showToast(t('timetables.unpublished', 'Timetable unpublished'), 'success');
      } else {
        await timetableService.publishTimetable(String(id));
        showToast(t('timetables.publishSuccess', 'Timetable published successfully'), 'success');
      }
      fetchTimetables();
    } catch (err: any) {
      logger.error(err);
      showToast(t('common.errorOccurred', 'Failed to update status'), 'error');
    }
  };

  // 3. Multi-Dimensional Filter Logic
  const filteredTimetables = useMemo(() => {
    return timetables.filter((ti) => {
      // College Filter
      if (selectedCollege && String(ti.collegeId) !== String(selectedCollege)) return false;

      // Department Filter
      if (selectedDept && String(ti.departmentId) !== String(selectedDept)) return false;

      // Academic Year Filter
      if (selectedYear) {
        const yr = parseInt(selectedYear, 10);
        if (ti.academicYear !== yr) return false;
      }

      // Semester Filter
      if (selectedSemester) {
        const sem = parseInt(selectedSemester, 10);
        if (ti.semester !== sem) return false;
      }

      // Status Filter
      if (statusFilter !== 'ALL') {
        if (ti.status !== statusFilter) return false;
      }

      // Search Query Filter
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const title = (ti.title || '').toLowerCase();
        const desc = (ti.description || '').toLowerCase();
        const deptName = (ti.department?.name || ti.department?.nameAr || '').toLowerCase();
        const colName = (ti.college?.name || ti.college?.nameAr || '').toLowerCase();

        const matches = title.includes(q) || desc.includes(q) || deptName.includes(q) || colName.includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [timetables, selectedCollege, selectedDept, selectedYear, selectedSemester, statusFilter, search]);

  useEffect(() => {
    setPage(1);
  }, [search, selectedCollege, selectedDept, selectedYear, selectedSemester, statusFilter]);

  const paginatedTimetables = useMemo(() => {
    return filteredTimetables.slice((page - 1) * pageSize, page * pageSize);
  }, [filteredTimetables, page, pageSize]);

  // Multi-Selection Logic (Current Page Only)
  const currentPageIds = useMemo(() => paginatedTimetables.map((t) => t.id), [paginatedTimetables]);
  const isAllSelected = isAllPageSelected(selectedIds, currentPageIds);
  const isSomeSelected = isSomePageSelected(selectedIds, currentPageIds);

  const handleToggleSelectAll = () => {
    setSelectedIds((prev) => toggleCurrentPage(prev, currentPageIds));
  };

  const handleToggleSelect = (id: number | string) => {
    setSelectedIds((prev) => toggleOne(prev, id));
  };

  // Clear selection when filters, page, or viewMode change
  useEffect(() => {
    setSelectedIds((prev) => (prev.size > 0 ? clearSelection() : prev));
  }, [
    search,
    selectedCollege,
    selectedDept,
    selectedYear,
    selectedSemester,
    statusFilter,
    page,
    pageSize,
    viewMode,
  ]);

  // Bulk Delete
  const confirmBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    try {
      setIsBulkDeleting(true);
      const deletePromises = Array.from(selectedIds).map((id) =>
        timetableService.deleteTimetable(String(id)).catch((err) => ({ error: err }))
      );
      await Promise.allSettled(deletePromises);
      showToast(t('timetables.bulkDeleteSuccess', `تم حذف ${count} جداول دراسية بنجاح`, { count }), 'success');
      setSelectedIds(clearSelection());
      setBulkDeleteModalOpen(false);
      fetchTimetables();
    } catch (err) {
      showToast(t('timetables.bulkDeleteError', 'حدث خطأ أثناء الحذف الجماعي'), 'error');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  // Bulk Export Selected Timetables
  const handleBulkExport = () => {
    const selectedList = filteredTimetables.filter((tb) => selectedIds.has(tb.id));
    if (!selectedList.length) return;
    const exportData = selectedList.map((tb) => ({
      ID: tb.id,
      Title: tb.title || 'Untitled',
      Department: tb.department?.name || tb.department?.nameAr || 'General',
      College: tb.college?.name || tb.college?.nameAr || 'General',
      AcademicYear: tb.academicYear,
      Semester: tb.semester,
      Status: tb.status || 'DRAFT',
      SessionsCount: tb.slots?.length || tb._count?.slots || 0,
    }));
    downloadCsv(exportData, `timetables_selected_${new Date().toISOString().split('T')[0]}.csv`);
    showToast(isRTL ? 'تم تصدير الجداول المحددة بنجاح' : 'Exported selected timetables successfully', 'success');
  };

  // Live Counts for Status Tabs
  const totalCount = timetables.length;
  const publishedCount = useMemo(() => timetables.filter((t) => t.status === 'PUBLISHED').length, [timetables]);
  const draftCount = totalCount - publishedCount;
  const coveredDeptsCount = useMemo(
    () => new Set(timetables.map((t) => t.departmentId).filter(Boolean)).size,
    [timetables]
  );

  // Reset Filters
  const handleResetFilters = () => {
    setSearch('');
    setSelectedCollege('');
    setSelectedDept('');
    setSelectedYear('');
    setSelectedSemester('');
    setStatusFilter('ALL');
  };

  const hasActiveFilters =
    search.trim() !== '' ||
    selectedCollege !== '' ||
    selectedDept !== '' ||
    selectedYear !== '' ||
    selectedSemester !== '' ||
    statusFilter !== 'ALL';

  return (
    <div className="section-gap animate-in fade-in duration-500 space-y-4 w-full min-w-0 pb-20">
      {/* 1. Sleek Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="page-title flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-brand-primary-500/10 text-brand-primary-600 dark:text-brand-primary-400">
              <Calendar size={22} />
            </span>
            {t('timetables.managementTitle', 'General Timetable Records')}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
            {t('timetables.managementSubtitle', 'Manage and publish master class timetables')}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* View Mode Switcher (Cards vs List) */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode('CARD')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'CARD'
                  ? 'bg-white dark:bg-slate-700 text-brand-primary-600 dark:text-brand-primary-300 shadow-xs'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <LayoutGrid size={14} />
              <span>{t('timetables.viewCardView', 'Cards')}</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('LIST')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'LIST'
                  ? 'bg-white dark:bg-slate-700 text-brand-primary-600 dark:text-brand-primary-300 shadow-xs'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <List size={14} />
              <span>{t('timetables.viewListView', 'List')}</span>
            </button>
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={fetchTimetables}
            className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-xs transition-all border border-slate-200 dark:border-slate-700 active:scale-95 shadow-2xs"
            title={t('common.refresh', 'Refresh')}
          >
            <RotateCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>

          {/* Create Timetable Button */}
          {canManage && (
            <button
              type="button"
              onClick={() => {
                setEditingTimetable(null);
                setIsModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand-primary-500 hover:bg-brand-primary-600 text-white font-bold text-xs shadow-sm shadow-brand-primary-500/20 active:scale-95 transition-all"
            >
              <Plus size={15} />
              <span>{t('timetables.createTimetable', 'New Timetable')}</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. EXECUTIVE 4-METRIC RIBBON                                              */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <StatCard
          compact
          title={t('timetables.totalTimetables', 'Total Timetables')}
          value={totalCount}
          icon={Calendar}
          color="green"
          isActive={statusFilter === 'ALL'}
          onClick={() => setStatusFilter('ALL')}
        />

        <StatCard
          compact
          title={t('timetables.publishedStatus', 'Published')}
          value={publishedCount}
          icon={CheckCircle2}
          color="navy"
          isActive={statusFilter === 'PUBLISHED'}
          onClick={() => setStatusFilter(statusFilter === 'PUBLISHED' ? 'ALL' : 'PUBLISHED')}
        />

        <StatCard
          compact
          title={t('timetables.draftStatus', 'Draft')}
          value={draftCount}
          icon={Clock}
          color="cyan"
          isActive={statusFilter === 'DRAFT'}
          onClick={() => setStatusFilter(statusFilter === 'DRAFT' ? 'ALL' : 'DRAFT')}
        />

        <StatCard
          compact
          title={t('timetables.departmentsCoveredKpi', 'Departments Covered')}
          value={coveredDeptsCount}
          icon={Layers}
          color="gold"
        />
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
            placeholder={t('timetables.searchPlaceholder', 'Search by title, college, or department...')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-8.5 ps-8 pe-8 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-1.5 focus:ring-brand-primary-500 outline-none bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute end-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* College Selector */}
        {!hideCollegeSelector && (
          <select
            value={selectedCollege}
            onChange={(e) => {
              setSelectedCollege(e.target.value);
              setSelectedDept('');
            }}
            aria-label={t('common.allColleges', 'All Colleges')}
            className="h-8.5 px-3 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-brand-primary-500 cursor-pointer"
          >
            <option value="">{t('common.allColleges', 'All Colleges')}</option>
            {colleges.map((c) => (
              <option key={c.id} value={c.id}>
                {isRTL ? c.nameAr || c.name : c.name}
              </option>
            ))}
          </select>
        )}

        {/* Department Selector */}
        {!hideDepartmentSelector && (
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            aria-label={t('common.allDepartments', 'All Departments')}
            className="h-8.5 px-3 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-brand-primary-500 cursor-pointer"
          >
            <option value="">{t('common.allDepartments', 'All Departments')}</option>
            {filteredDepartments.map((d) => (
              <option key={d.id} value={d.id}>
                {isRTL ? d.nameAr || d.name : d.name}
              </option>
            ))}
          </select>
        )}

        {/* Academic Year */}
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(e.target.value)}
          aria-label={t('schedules.academicDivision', 'Academic Year')}
          className="h-8.5 px-3 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-brand-primary-500 cursor-pointer"
        >
          <option value="">{t('schedules.academicDivision', 'Year')}: {t('common.all', 'All')}</option>
          <option value="1">{t('common.year', 'Year')} 1</option>
          <option value="2">{t('common.year', 'Year')} 2</option>
          <option value="3">{t('common.year', 'Year')} 3</option>
          <option value="4">{t('common.year', 'Year')} 4</option>
        </select>

        {/* Semester */}
        <select
          value={selectedSemester}
          onChange={(e) => setSelectedSemester(e.target.value)}
          aria-label={t('schedule.allSemesters', 'Semester')}
          className="h-8.5 px-3 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-brand-primary-500 cursor-pointer"
        >
          <option value="">{t('schedule.allSemesters', 'Semester')}: {t('common.all', 'All')}</option>
          <option value="1">{t('schedule.semester1', 'Sem 1')}</option>
          <option value="2">{t('schedule.semester2', 'Sem 2')}</option>
          <option value="3">{t('schedule.semester3', 'Summer')}</option>
        </select>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label={t('common.status', 'Status')}
          className="h-8.5 px-3 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-brand-primary-500 cursor-pointer"
        >
          <option value="ALL">{t('common.all', 'All Statuses')}</option>
          <option value="PUBLISHED">{t('timetables.publishedStatus', 'Published')}</option>
          <option value="DRAFT">{t('timetables.draftStatus', 'Draft')}</option>
        </select>



        {/* Clear Filters */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetFilters}
            className="h-8.5 px-2.5 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl font-bold cursor-pointer"
          >
            <X size={13} className="me-1" />
            {t('common.clear', 'Clear')}
          </Button>
        )}
      </div>

      {/* 3. Main Content: Responsive Cards or Structured Table */}
      {loading ? (
        <Card className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-12 flex flex-col items-center justify-center gap-3 text-center">
          <Loader2 className="animate-spin text-brand-primary-500" size={32} />
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
            {t('common.loading', 'Loading timetables...')}
          </p>
        </Card>
      ) : error ? (
        <Card className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-12 flex flex-col items-center justify-center text-center">
          <AlertCircle size={36} className="text-rose-500 mb-2" />
          <h2 className="text-base font-bold text-slate-800 dark:text-white mb-2">{error}</h2>
          <button
            type="button"
            onClick={fetchTimetables}
            className="px-4 py-1.5 rounded-xl bg-brand-primary-500 text-white font-bold text-xs shadow-xs"
          >
            {t('common.retry', 'Retry')}
          </button>
        </Card>
      ) : filteredTimetables.length === 0 ? (
        <Card className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-12 flex flex-col items-center justify-center text-center">
          <div className="w-14 h-14 rounded-full bg-brand-primary-500/10 text-brand-primary-500 flex items-center justify-center text-2xl mb-3">
            <Calendar size={28} />
          </div>
          <h2 className="text-base font-bold text-slate-800 dark:text-white mb-1">
            {hasActiveFilters ? t('schedules.noResultsFound', 'No Timetables Found') : t('timetables.emptyTitle', 'No timetables yet')}
          </h2>
          <p className="text-xs text-slate-400 font-medium max-w-sm mb-4">
            {hasActiveFilters
              ? t('schedules.noResultsFoundDesc', 'Try adjusting your search criteria or resetting filters.')
              : t('timetables.emptySubtitle', 'Get started by creating your first timetable record.')}
          </p>
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-4 py-1.5 bg-brand-primary-500 text-white font-bold rounded-xl text-xs shadow-xs flex items-center gap-1.5"
            >
              <RotateCcw size={13} />
              <span>{t('groups.resetFilters', 'Reset Filters')}</span>
            </button>
          ) : (
            canManage && (
              <button
                type="button"
                onClick={() => {
                  setEditingTimetable(null);
                  setIsModalOpen(true);
                }}
                className="px-4 py-2 rounded-xl bg-brand-primary-500 text-white font-bold text-xs shadow-xs flex items-center gap-1.5"
              >
                <Plus size={15} />
                <span>{t('timetables.createTimetable', 'New Timetable')}</span>
              </button>
            )
          )}
        </Card>
      ) : viewMode === 'CARD' ? (
        /* MODE A: RESPONSIVE CARDS GRID VIEW */
        <div className="space-y-3">
          {/* Dedicated Select All Header Bar for Cards View */}
          {canManage && currentPageIds.length > 0 && (
            <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-700 shadow-2xs">
              <button
                type="button"
                onClick={handleToggleSelectAll}
                aria-label={isAllSelected
                  ? t('timetables.deselectAllPage', 'Deselect all on this page')
                  : `${t('timetables.selectAllPage', 'Select all on this page')} (${currentPageIds.length})`}
                aria-checked={isAllSelected ? 'true' : isSomeSelected ? 'mixed' : 'false'}
                className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-brand-primary-600 transition-colors cursor-pointer"
              >
                {isAllSelected ? (
                  <CheckSquare size={16} className="text-brand-primary-600" />
                ) : isSomeSelected ? (
                  <MinusSquare size={16} className="text-brand-primary-600" />
                ) : (
                  <Square size={16} className="text-slate-400" />
                )}
                <span>
                  {isAllSelected
                    ? t('timetables.deselectAllPage', 'Deselect all on this page')
                    : `${t('timetables.selectAllPage', 'Select all on this page')} (${currentPageIds.length})`}
                </span>
              </button>
              {selectedIds.size > 0 && (
                <span className="text-xs font-bold text-brand-primary-700 dark:text-brand-primary-300 bg-brand-primary-50 dark:bg-brand-primary-950/50 px-2.5 py-1 rounded-xl border border-brand-primary-200 dark:border-brand-primary-800">
                  {isRTL ? `تم تحديد ${selectedIds.size} من أصل ${currentPageIds.length}` : `Selected ${selectedIds.size} of ${currentPageIds.length}`}
                </span>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {paginatedTimetables.map((item) => {
              const isPublished = item.status === 'PUBLISHED';
              const isSelected = selectedIds.has(item.id);

              return (
                <Card
                  key={item.id}
                  className={`rounded-2xl border p-4 shadow-2xs hover:shadow-sm transition-all relative flex flex-col justify-between group ${
                    isSelected
                      ? 'border-brand-primary-500 ring-2 ring-brand-primary-500/20 bg-brand-primary-500/[0.02] dark:bg-brand-primary-500/[0.04]'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                  }`}
                >
                  <div>
                    {/* Header: Checkbox, Status Badge, College */}
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <div className="flex items-center gap-2">
                        {canManage && (
                          <button
                            type="button"
                            onClick={() => handleToggleSelect(item.id)}
                            className="text-slate-400 hover:text-brand-primary-600 focus:outline-none transition-colors"
                            aria-label={isSelected ? t('timetables.deselectItem', { title: item.title, defaultValue: `Deselect timetable ${item.title}` }) : t('timetables.selectItem', { title: item.title, defaultValue: `Select timetable ${item.title}` })}
                          >
                            {isSelected ? (
                              <CheckSquare size={16} className="text-brand-primary-600" />
                            ) : (
                              <Square size={16} />
                            )}
                          </button>
                        )}
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                            isPublished
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                              : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                          }`}
                        >
                          {isPublished ? <CheckCircle2 size={11} /> : <Clock size={11} />}
                          <span>
                            {isPublished
                              ? t('timetables.publishedStatus', 'Published')
                              : t('timetables.draftStatus', 'Draft')}
                          </span>
                        </span>
                      </div>

                      {(item.college?.name || item.college?.nameAr) && (
                        <span
                          className="text-[10px] font-bold text-slate-400 dark:text-slate-500 truncate max-w-[150px]"
                          dir={isRTL ? 'rtl' : 'ltr'}
                        >
                          {isRTL ? item.college.nameAr || item.college.name : item.college.name || item.college.nameAr}
                        </span>
                      )}
                    </div>

                    {/* Timetable Title */}
                    <h2 className="text-sm md:text-base font-bold text-slate-900 dark:text-white leading-snug mb-1">
                      {item.title}
                    </h2>

                    {/* Department */}
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium mb-3">
                      <Building2 size={12} className="text-brand-primary-500 shrink-0" />
                      <span className="truncate">
                        {item.department?.nameAr || item.department?.name || t('common.generalDept', 'Department')}
                      </span>
                    </div>

                    {/* Year & Semester Badges */}
                    <div className="flex items-center gap-1.5 flex-wrap mb-3.5">
                      {item.academicYear && (
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 text-[11px] font-bold flex items-center gap-1">
                          <Calendar size={11} className="text-slate-400" />
                          <span>{t('common.year', 'Year')} {item.academicYear}</span>
                        </span>
                      )}
                      {item.semester && (
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 text-[11px] font-bold flex items-center gap-1">
                          <BookOpen size={11} className="text-slate-400" />
                          <span>{t(`schedule.semester${item.semester}`, `Sem ${item.semester}`)}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="pt-2.5 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between gap-2">
                    {/* View Schedule Button */}
                    <button
                      type="button"
                      onClick={() =>
                        navigate(
                          `/schedules/timetable?collegeId=${item.collegeId || ''}&departmentId=${
                            item.departmentId || ''
                          }&academicYear=${item.academicYear || 1}&semester=${item.semester || 1}`
                        )
                      }
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-primary-50 dark:bg-brand-primary-950/40 hover:bg-brand-primary-100 dark:hover:bg-brand-primary-900/40 text-brand-primary-700 dark:text-brand-primary-300 text-xs font-bold transition-colors"
                      aria-label={t('timetables.viewTimetableItem', { title: item.title, defaultValue: `View schedule for ${item.title}` })}
                    >
                      <Eye size={13} />
                      <span>{t('timetables.viewTimetableSchedule', 'View Schedule')}</span>
                    </button>

                    {/* Admin Actions */}
                    {canManage && (
                      <div className="flex items-center gap-1">
                        {/* Publish/Unpublish */}
                        <button
                          type="button"
                          onClick={() => handleTogglePublish(item.id, item.status)}
                          className={`p-1.5 rounded-lg border transition-all ${
                            isPublished
                              ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100'
                              : 'text-slate-500 bg-slate-100 dark:bg-slate-700 border-slate-200 dark:border-slate-600 hover:bg-slate-200'
                          }`}
                          title={isPublished ? t('timetables.unpublishAction', 'Unpublish') : t('timetables.publishAction', 'Publish')}
                          aria-label={isPublished ? t('timetables.unpublishTimetableItem', { title: item.title, defaultValue: `Unpublish timetable ${item.title}` }) : t('timetables.publishTimetableItem', { title: item.title, defaultValue: `Publish timetable ${item.title}` })}
                        >
                          <Globe size={13} />
                        </button>

                        {/* Edit */}
                        <button
                          type="button"
                          onClick={() => {
                            setEditingTimetable(item);
                            setIsModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 transition-colors border border-slate-200 dark:border-slate-600"
                          title={t('common.edit', 'Edit')}
                          aria-label={t('timetables.editTimetableItem', { title: item.title, defaultValue: `Edit timetable ${item.title}` })}
                        >
                          <Edit2 size={13} />
                        </button>

                        {/* Delete */}
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(item)}
                          className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 transition-colors border border-rose-200 dark:border-rose-800 cursor-pointer"
                          title={t('common.delete', 'Delete')}
                          aria-label={t('timetables.deleteTimetableItem', { title: item.title, defaultValue: `Delete timetable ${item.title}` })}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Grid Mode Pagination */}
          <Pagination
            page={page}
            totalPages={Math.max(1, Math.ceil(filteredTimetables.length / pageSize))}
            total={filteredTimetables.length}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setPage(1);
            }}
            pageSizeOptions={[6, 12, 24, 48]}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-2xs"
          />
        </div>
      ) : (
        /* MODE B: TABLE LIST VIEW */
        <Card className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden p-0">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full border-collapse text-start">
              <caption className="sr-only">
                {t('tables.caption.timetableManagement', 'Timetable schedules management table')}
              </caption>
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700 text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  {canManage && (
                    <th scope="col" className="p-3.5 text-center w-12">
                      <button
                        type="button"
                        onClick={handleToggleSelectAll}
                        className="text-slate-400 hover:text-brand-primary-600 focus:outline-none transition-colors"
                        title={isAllSelected ? t('timetables.deselectAllPage', 'Deselect all on this page') : t('timetables.selectAllPage', 'Select all on this page')}
                        aria-label={isAllSelected ? t('timetables.deselectAllPage', 'Deselect all on this page') : t('timetables.selectAllPage', 'Select all on this page')}
                        aria-checked={isAllSelected ? 'true' : isSomeSelected ? 'mixed' : 'false'}
                      >
                        {isAllSelected ? (
                          <CheckSquare size={16} className="text-brand-primary-600" />
                        ) : isSomeSelected ? (
                          <MinusSquare size={16} className="text-brand-primary-600" />
                        ) : (
                          <Square size={16} />
                        )}
                      </button>
                    </th>
                  )}
                  <th scope="col" className="p-3.5 text-start min-w-[240px]">{t('timetables.colTitleDept', 'Timetable & Department')}</th>
                  <th scope="col" className="p-3.5 text-start min-w-[160px]">{t('timetables.colYearSem', 'Division & Semester')}</th>
                  <th scope="col" className="p-3.5 text-start min-w-[130px]">{t('timetables.colStatus', 'Status')}</th>
                  <th scope="col" className="p-3.5 text-start min-w-[140px]">{t('timetables.colUpdatedAt', 'Last Updated')}</th>
                  <th scope="col" className="p-3.5 text-center w-32">{t('timetables.colActions', 'Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 text-xs">
                {paginatedTimetables.map((item) => {
                  const isPublished = item.status === 'PUBLISHED';
                  const isSelected = selectedIds.has(item.id);

                  return (
                    <tr
                      key={item.id}
                      className={`group hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors ${
                        isSelected ? 'bg-brand-primary-500/[0.04] dark:bg-brand-primary-500/[0.08]' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      {canManage && (
                        <td className="p-3.5 align-middle text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleSelect(item.id)}
                            className="text-slate-400 hover:text-brand-primary-600 focus:outline-none transition-colors"
                            aria-label={isSelected ? t('timetables.deselectItem', { title: item.title, defaultValue: `Deselect timetable ${item.title}` }) : t('timetables.selectItem', { title: item.title, defaultValue: `Select timetable ${item.title}` })}
                          >
                            {isSelected ? (
                              <CheckSquare size={16} className="text-brand-primary-600" />
                            ) : (
                              <Square size={16} />
                            )}
                          </button>
                        </td>
                      )}

                      {/* Title & Department */}
                      <td className="p-3.5 align-middle">
                        <div className="space-y-0.5">
                          <span className="font-bold text-slate-900 dark:text-white text-xs">
                            {item.title}
                          </span>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                            <Building2 size={11} className="text-brand-primary-500 shrink-0" />
                            <span>
                              {item.department?.nameAr || item.department?.name || t('common.generalDept', 'Department')}
                            </span>
                            {item.college?.name && (
                              <>
                                <span>•</span>
                                <span>{item.college.name}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Year & Semester */}
                      <td className="p-3.5 align-middle whitespace-nowrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {item.academicYear && (
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 font-bold text-[11px]">
                              {t('common.year', 'Year')} {item.academicYear}
                            </span>
                          )}
                          {item.semester && (
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 font-bold text-[11px]">
                              {t(`schedule.semester${item.semester}`, `Sem ${item.semester}`)}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="p-3.5 align-middle whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                            isPublished
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                              : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                          }`}
                        >
                          {isPublished ? <CheckCircle2 size={11} /> : <Clock size={11} />}
                          <span>
                            {isPublished
                              ? t('timetables.publishedStatus', 'Published')
                              : t('timetables.draftStatus', 'Draft')}
                          </span>
                        </span>
                      </td>

                      {/* Last Updated */}
                      <td className="p-3.5 align-middle whitespace-nowrap text-slate-500 dark:text-slate-400 font-medium text-[11px]">
                        {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US') : '—'}
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 align-middle text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          {/* View */}
                          <button
                            type="button"
                            onClick={() =>
                              navigate(
                                `/schedules/timetable?collegeId=${item.collegeId || ''}&departmentId=${
                                  item.departmentId || ''
                                }&academicYear=${item.academicYear || 1}&semester=${item.semester || 1}`
                              )
                            }
                            className="p-1.5 rounded-lg text-brand-primary-600 hover:bg-brand-primary-50 dark:hover:bg-brand-primary-950/40 transition-colors"
                            title={t('timetables.viewTimetableSchedule', 'View Schedule')}
                            aria-label={t('timetables.viewTimetableItem', { title: item.title, defaultValue: `View schedule for ${item.title}` })}
                          >
                            <Eye size={14} />
                          </button>

                          {canManage && (
                            <>
                              {/* Publish Toggle */}
                              <button
                                type="button"
                                onClick={() => handleTogglePublish(item.id, item.status)}
                                className={`p-1.5 rounded-lg transition-colors ${
                                  isPublished
                                    ? 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                                    : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800'
                                }`}
                                title={isPublished ? t('timetables.unpublishAction', 'Unpublish') : t('timetables.publishAction', 'Publish')}
                                aria-label={isPublished ? t('timetables.unpublishTimetableItem', { title: item.title, defaultValue: `Unpublish timetable ${item.title}` }) : t('timetables.publishTimetableItem', { title: item.title, defaultValue: `Publish timetable ${item.title}` })}
                              >
                                <Globe size={14} />
                              </button>

                              {/* Edit */}
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingTimetable(item);
                                  setIsModalOpen(true);
                                }}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-brand-primary-600 hover:bg-brand-primary-50 dark:hover:bg-brand-primary-950/40 transition-colors"
                                title={t('common.edit', 'Edit')}
                                aria-label={t('timetables.editTimetableItem', { title: item.title, defaultValue: `Edit timetable ${item.title}` })}
                              >
                                <Edit2 size={14} />
                              </button>

                              {/* Delete */}
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(item)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                                title={t('common.delete', 'Delete')}
                                aria-label={t('timetables.deleteTimetableItem', { title: item.title, defaultValue: `Delete timetable ${item.title}` })}
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Table Mode Pagination */}
            <Pagination
              page={page}
              totalPages={Math.max(1, Math.ceil(filteredTimetables.length / pageSize))}
              total={filteredTimetables.length}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize);
                setPage(1);
              }}
              pageSizeOptions={[6, 12, 24, 48]}
            />
          </div>
        </Card>
      )}

      {/* 4. Standard Bottom Floating BulkActionToolbar */}
      {canManage && (
        <BulkActionToolbar
          selectedCount={selectedIds.size}
          onClear={() => setSelectedIds(clearSelection())}
          onExport={handleBulkExport}
          onDelete={() => setBulkDeleteModalOpen(true)}
        />
      )}

      {/* Timetable Edit / Create Modal */}
      {isModalOpen && (
        <TimetableModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingTimetable(null);
          }}
          timetable={editingTimetable}
          onSuccess={() => {
            setIsModalOpen(false);
            setEditingTimetable(null);
            fetchTimetables();
          }}
        />
      )}

      {/* Single Timetable Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={Boolean(deleteTarget)}
        itemName={deleteTarget?.title || deleteTarget?.department?.nameAr || deleteTarget?.department?.name || ''}
        onClose={() => !deleteLoading && setDeleteTarget(null)}
        onConfirm={confirmDelete}
        loading={deleteLoading}
        title={isRTL ? 'تأكيد حذف الجدول الدراسي' : 'Confirm Delete Timetable'}
        confirmLabel={isRTL ? 'حذف الجدول' : 'Delete Timetable'}
        message={
          isRTL
            ? `هل أنت متأكد من حذف الجدول الدراسي "${deleteTarget?.title || deleteTarget?.department?.nameAr || deleteTarget?.department?.name || ''}" (${deleteTarget?.college?.nameAr || deleteTarget?.college?.name || ''} - الفرقة ${deleteTarget?.academicYear || 1} - الفصل ${deleteTarget?.semester || 1})؟ سيتم حذف جميع الحصص والمحاضرات المرتبطة بهذا الجدول نهائياً لمنع أي أخطاء.`
            : `Are you sure you want to delete timetable "${deleteTarget?.title || deleteTarget?.department?.name || ''}" (${deleteTarget?.college?.name || ''} - Year ${deleteTarget?.academicYear || 1} - Sem ${deleteTarget?.semester || 1})? All scheduled sessions within this timetable will be permanently deleted.`
        }
      />

      {/* Bulk Timetables Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={bulkDeleteModalOpen}
        itemName={`${selectedIds.size} ${isRTL ? 'جداول دراسية' : 'timetables'}`}
        onClose={() => !isBulkDeleting && setBulkDeleteModalOpen(false)}
        onConfirm={confirmBulkDelete}
        loading={isBulkDeleting}
        title={isRTL ? 'تأكيد حذف الجداول المحددة' : 'Confirm Delete Selected Timetables'}
        confirmLabel={isRTL ? 'حذف الجداول المحددة' : 'Delete Selected'}
        message={
          isRTL
            ? `هل أنت متأكد من حذف ${selectedIds.size} جدول دراسي محدد؟ سيتم حذف جميع هذه الجداول والحصص الدراسية المرتبطة بها نهائياً لمنع الأخطاء العرضية.`
            : `Are you sure you want to delete ${selectedIds.size} selected timetables? All associated scheduled class sessions will be permanently deleted.`
        }
      />
    </div>
  );
};

export default TimetableManagement;
