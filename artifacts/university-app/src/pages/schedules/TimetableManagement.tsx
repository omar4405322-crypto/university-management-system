// @ts-nocheck
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
import Card from '../../components/ui/Card';
import BulkActionToolbar from '../../components/ui/BulkActionToolbar';
import timetableService from '../../services/timetable.service';
import collegeService from '../../services/college.service';
import departmentService from '../../services/department.service';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import useScope from '../../hooks/useScope';
import TimetableModal from './TimetableModal';
import { logger } from '../../lib/logger';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../components/ui/alert-dialog';

const TimetableManagement = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { scopeParams, isCollegeAdmin } = useScope();
  const { isRTL } = useLanguage();
  const navigate = useNavigate();
  const { showToast } = useToast();

  // View Mode: 'CARD' | 'LIST'
  const [viewMode, setViewMode] = useState<'CARD' | 'LIST'>('CARD');

  // Loading & Data States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timetables, setTimetables] = useState<any[]>([]);
  const [colleges, setColleges] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'single'; id: number | string } | { type: 'bulk' } | null>(null);

  // Filter States
  const [search, setSearch] = useState('');
  const [selectedCollege, setSelectedCollege] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedSemester, setSelectedSemester] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Multi-Selection State
  const [selectedIds, setSelectedIds] = useState<Set<number | string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTimetable, setEditingTimetable] = useState<any>(null);

  const canManage = ['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'].includes(user?.role);

  // 1. Fetch Metadata (Colleges & Departments)
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [collegesRes, deptsRes] = await Promise.all([
          collegeService.getColleges({ limit: 100 }).catch(() => ({ data: [] })),
          departmentService.getDepartments({ limit: 200 }).catch(() => ({ data: [] })),
        ]);

        if (collegesRes.success || collegesRes.data) {
          const arr = Array.isArray(collegesRes.data)
            ? collegesRes.data
            : collegesRes.data?.colleges || collegesRes.data?.data || [];
          setColleges(arr);
        }

        if (deptsRes.success || deptsRes.data) {
          const arr = Array.isArray(deptsRes.data)
            ? deptsRes.data
            : deptsRes.data?.departments || deptsRes.data?.data || [];
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
  const handleDelete = (id: number | string) => {
    setDeleteTarget({ type: 'single', id });
  };

  const confirmDelete = async (id: number | string) => {
    try {
      const result = await timetableService.deleteTimetable(String(id));
      if (result.success || result) {
        showToast(t('common.deleteSuccess', 'Timetable deleted successfully'), 'success');
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        fetchTimetables();
      }
    } catch (err: any) {
      showToast(err.message || t('common.deleteError', 'Error deleting timetable'), 'error');
    }
  };

  // Toggle Publish / Unpublish Status
  const handleTogglePublish = async (id: number | string, currentStatus: string) => {
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

  // Multi-Selection Logic
  const allFilteredIds = useMemo(() => filteredTimetables.map((t) => t.id), [filteredTimetables]);
  const isAllSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => selectedIds.has(id));
  const isSomeSelected = allFilteredIds.some((id) => selectedIds.has(id)) && !isAllSelected;

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        allFilteredIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        allFilteredIds.forEach((id) => next.add(id));
        return next;
      });
    }
  };

  const handleToggleSelect = (id: number | string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Bulk Delete
  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    setDeleteTarget({ type: 'bulk' });
  };

  const confirmBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    try {
      setIsBulkDeleting(true);
      const deletePromises = Array.from(selectedIds).map((id) =>
        timetableService.deleteTimetable(String(id)).catch((err) => ({ error: err }))
      );
      await Promise.allSettled(deletePromises);
      showToast(t('timetables.bulkDeleteSuccess', `Successfully deleted ${count} timetables`, { count }), 'success');
      setSelectedIds(new Set());
      fetchTimetables();
    } catch (err) {
      showToast(t('timetables.bulkDeleteError', 'An error occurred during bulk deletion'), 'error');
    } finally {
      setIsBulkDeleting(false);
    }
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
          <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-800 dark:text-white flex items-center gap-2.5">
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
        {/* Total Master Timetables */}
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
              {t('timetables.totalTimetables', 'Total Timetables')}
            </span>
            <span className="text-lg font-black text-brand-primary-600 dark:text-brand-primary-400 block mt-0.5 font-mono">
              {totalCount}
            </span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-brand-primary-50 dark:bg-brand-primary-950/50 text-brand-primary-600 flex items-center justify-center shrink-0">
            <Calendar size={16} />
          </div>
        </button>

        {/* Published Timetables */}
        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'PUBLISHED' ? 'ALL' : 'PUBLISHED')}
          className={`p-3 rounded-2xl border transition-all text-start flex items-center justify-between cursor-pointer ${
            statusFilter === 'PUBLISHED'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-600 ring-2 ring-emerald-500/20 shadow-xs'
              : 'bg-white dark:bg-slate-800 border-slate-200/90 dark:border-slate-700 shadow-2xs hover:border-emerald-300'
          }`}
        >
          <div>
            <span className="text-[10px] text-slate-400 font-semibold block">
              {t('timetables.publishedStatus', 'Published')}
            </span>
            <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 block mt-0.5 font-mono">
              {publishedCount}
            </span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 size={16} />
          </div>
        </button>

        {/* Drafts in Progress */}
        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'DRAFT' ? 'ALL' : 'DRAFT')}
          className={`p-3 rounded-2xl border transition-all text-start flex items-center justify-between cursor-pointer ${
            statusFilter === 'DRAFT'
              ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-400 dark:border-amber-600 ring-2 ring-amber-500/20 shadow-xs'
              : 'bg-white dark:bg-slate-800 border-slate-200/90 dark:border-slate-700 shadow-2xs hover:border-amber-300'
          }`}
        >
          <div>
            <span className="text-[10px] text-slate-400 font-semibold block">
              {t('timetables.draftStatus', 'Draft')}
            </span>
            <span className="text-lg font-black text-amber-600 dark:text-amber-400 block mt-0.5 font-mono">
              {draftCount}
            </span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center shrink-0">
            <Clock size={16} />
          </div>
        </button>

        {/* Covered Departments */}
        <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-semibold block">
              {t('groups.allDepartments', 'Departments Covered')}
            </span>
            <span className="text-lg font-black text-blue-600 dark:text-blue-400 block mt-0.5 font-mono">
              {coveredDeptsCount}
            </span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center shrink-0">
            <Layers size={16} />
          </div>
        </div>
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
        {!isCollegeAdmin && (
          <select
            value={selectedCollege}
            onChange={(e) => {
              setSelectedCollege(e.target.value);
              setSelectedDept('');
            }}
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
        <select
          value={selectedDept}
          onChange={(e) => setSelectedDept(e.target.value)}
          className="h-8.5 px-3 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-brand-primary-500 cursor-pointer"
        >
          <option value="">{t('common.allDepartments', 'All Departments')}</option>
          {filteredDepartments.map((d) => (
            <option key={d.id} value={d.id}>
              {isRTL ? d.nameAr || d.name : d.name}
            </option>
          ))}
        </select>

        {/* Academic Year */}
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(e.target.value)}
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
          <h3 className="text-base font-bold text-slate-800 dark:text-white mb-2">{error}</h3>
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
          <h3 className="text-base font-bold text-slate-800 dark:text-white mb-1">
            {hasActiveFilters ? t('schedules.noResultsFound', 'No Timetables Found') : t('timetables.emptyTitle', 'No timetables yet')}
          </h3>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredTimetables.map((item) => {
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

                      {item.college?.name && (
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 truncate max-w-[130px]">
                          {item.college.name}
                        </span>
                      )}
                    </div>

                    {/* Timetable Title */}
                    <h3 className="text-sm md:text-base font-bold text-slate-900 dark:text-white leading-snug mb-1">
                      {item.title}
                    </h3>

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
                        >
                          <Edit2 size={13} />
                        </button>

                        {/* Delete */}
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 transition-colors border border-rose-200 dark:border-rose-800"
                          title={t('common.delete', 'Delete')}
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

          {/* Footer Count */}
          <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs text-slate-500 font-bold">
            <span>
              {t('common.showing', 'Showing')} {filteredTimetables.length} {t('common.of', 'of')} {timetables.length}{' '}
              {t('timetables.totalTimetablesKpi', 'Timetables')}
            </span>
          </div>
        </div>
      ) : (
        /* MODE B: TABLE LIST VIEW */
        <Card className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden p-0">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full border-collapse text-start">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700 text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  {canManage && (
                    <th className="p-3.5 text-center w-12">
                      <button
                        type="button"
                        onClick={handleToggleSelectAll}
                        className="text-slate-400 hover:text-brand-primary-600 focus:outline-none transition-colors"
                        title={isAllSelected ? t('schedules.deselectAll', 'Deselect All') : t('schedules.selectAll', 'Select All')}
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
                  <th className="p-3.5 text-start min-w-[240px]">{t('timetables.colTitleDept', 'Timetable & Department')}</th>
                  <th className="p-3.5 text-start min-w-[160px]">{t('timetables.colYearSem', 'Division & Semester')}</th>
                  <th className="p-3.5 text-start min-w-[130px]">{t('timetables.colStatus', 'Status')}</th>
                  <th className="p-3.5 text-start min-w-[140px]">{t('timetables.colUpdatedAt', 'Last Updated')}</th>
                  <th className="p-3.5 text-center w-32">{t('timetables.colActions', 'Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 text-xs">
                {filteredTimetables.map((item) => {
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
                              >
                                <Edit2 size={14} />
                              </button>

                              {/* Delete */}
                              <button
                                type="button"
                                onClick={() => handleDelete(item.id)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                                title={t('common.delete', 'Delete')}
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

            {/* Table Footer */}
            <div className="p-3 bg-slate-50 dark:bg-slate-900/40 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs text-slate-500 font-bold">
              <span>
                {t('common.showing', 'Showing')} {filteredTimetables.length} {t('common.of', 'of')} {timetables.length}{' '}
                {t('timetables.totalTimetablesKpi', 'Timetables')}
              </span>
            </div>
          </div>
        </Card>
      )}

      {/* 4. Standard Bottom Floating BulkActionToolbar */}
      {canManage && (
        <BulkActionToolbar
          selectedCount={selectedIds.size}
          onClear={() => setSelectedIds(new Set())}
          onDelete={handleBulkDelete}
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

      {/* Confirmation Alert Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteTarget?.type === 'bulk'
                ? t('timetables.bulkDeleteTitle', 'Delete Selected Timetables')
                : t('timetables.deleteTitle', 'Delete Timetable')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.type === 'bulk'
                ? t('timetables.bulkDeleteConfirm', `Are you sure you want to delete ${selectedIds.size} selected timetables?`, { count: selectedIds.size })
                : t('timetables.deleteConfirm', 'Are you sure you want to delete this timetable?')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget?.type === 'single') {
                  confirmDelete(deleteTarget.id);
                } else if (deleteTarget?.type === 'bulk') {
                  confirmBulkDelete();
                }
                setDeleteTarget(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('common.delete', 'Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TimetableManagement;
