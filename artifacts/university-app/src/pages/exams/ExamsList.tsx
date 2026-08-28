// @ts-nocheck
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import examsService from '../../services/exams.service';
import collegeService from '../../services/college.service';
import departmentService from '../../services/department.service';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import useScope from '../../hooks/useScope';
import { useLanguage } from '../../context/LanguageContext';
import {
  Plus,
  Calendar,
  Clock,
  MapPin,
  Trash2,
  Eye,
  Loader2,
  FileText,
  CalendarCheck,
  CheckCircle2,
  Timer,
  ArrowUpDown,
  Play,
  GraduationCap,
  LayoutGrid,
  List,
  Search,
  RotateCcw,
  RotateCw,
  Building2,
  X,
  CheckSquare,
  Square,
  MinusSquare,
  Archive,
  AlertTriangle
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/button';
import BulkActionToolbar from '../../components/ui/BulkActionToolbar';
import ConfirmDeleteModal from '../../components/ui/ConfirmDeleteModal';
import { useToast } from '../../context/ToastContext';
import AddExamModal from './AddExamModal';
import { getExamStatus, getDaysUntil, getExamLabel, getTypeBadgeConfig, getExamTimeWindowStatus } from './examUtils';

const ExamsList = () => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const { scopeParams, isCollegeAdmin } = useScope();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isAdmin = ['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'].includes(user?.role || '');

  // View Mode: 'CARD' | 'LIST'
  const [viewMode, setViewMode] = useState<'CARD' | 'LIST'>('CARD');

  // Loading & Data States
  const [exams, setExams] = useState<any[]>([]);
  const [colleges, setColleges] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [search, setSearch] = useState('');
  const [selectedCollege, setSelectedCollege] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Multi-Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

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
        // silent fallback
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

  // 2. Fetch Exams Data
  const fetchExams = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, any> = { ...scopeParams };
      const result = await examsService.getExams(params);
      if (result.success || result.data) {
        const arr = Array.isArray(result.data)
          ? result.data
          : result.data?.exams || result.data?.data || [];
        setExams(arr);
      }
    } catch (_err) {
      showToast(t('exams.loadError', 'Failed to load exams'), 'error');
    } finally {
      setLoading(false);
    }
  }, [scopeParams, t, showToast]);

  useEffect(() => {
    fetchExams();
  }, [fetchExams]);

  // Delete Individual Exam
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleteLoading(true);
      const result = await examsService.deleteExam(deleteTarget.id);
      if (result.success) {
        showToast(t('exams.deleteSuccess', 'Exam deleted successfully'), 'success');
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(deleteTarget.id);
          return next;
        });
        setDeleteTarget(null);
        fetchExams();
      }
    } catch (_err) {
      showToast(t('exams.deleteError', 'Failed to delete exam'), 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  // 3. Multi-Dimensional Filter Logic
  const filteredExams = useMemo(() => {
    let list = [...exams];

    // Search Query Filter
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter((exam) => {
        const courseName = (exam.course?.name || '').toLowerCase();
        const courseCode = (exam.course?.courseCode || '').toLowerCase();
        const title = (exam.title || '').toLowerCase();
        const room = (exam.room || '').toLowerCase();
        const dept = (exam.course?.department?.name || exam.course?.department?.nameAr || '').toLowerCase();
        return courseName.includes(q) || courseCode.includes(q) || title.includes(q) || room.includes(q) || dept.includes(q);
      });
    }

    // College Filter
    if (selectedCollege) {
      list = list.filter((exam) => {
        const colId = exam.course?.department?.collegeId || exam.course?.department?.college?.id;
        return String(colId) === String(selectedCollege);
      });
    }

    // Department Filter
    if (selectedDept) {
      list = list.filter((exam) => {
        const deptId = exam.course?.departmentId || exam.course?.department?.id;
        return String(deptId) === String(selectedDept);
      });
    }

    // Academic Year Filter
    if (selectedYear) {
      const yr = parseInt(selectedYear, 10);
      list = list.filter((exam) => exam.course?.year === yr);
    }

    // Type Filter
    if (typeFilter !== 'ALL') {
      list = list.filter((exam) => exam.type === typeFilter);
    }

    // Status Filter (UPCOMING | TODAY | COMPLETED)
    if (statusFilter !== 'ALL') {
      list = list.filter((exam) => getExamStatus(exam) === statusFilter);
    }

    // Sorting by Date
    list.sort((a, b) => {
      const dateA = new Date(`${a.date}T${a.startTime || '00:00'}`).getTime();
      const dateB = new Date(`${b.date}T${b.startTime || '00:00'}`).getTime();
      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });

    return list;
  }, [exams, search, selectedCollege, selectedDept, selectedYear, typeFilter, statusFilter, sortOrder]);

  // Multi-Selection Logic
  const allFilteredIds = useMemo(() => filteredExams.map((e) => e.id), [filteredExams]);
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

  const handleToggleSelect = (id: string | number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Bulk Delete
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    const msg = t('exams.bulkDeleteConfirm', `Are you sure you want to delete ${count} selected exams?`, { count });
    if (!window.confirm(msg)) return;

    try {
      setIsBulkDeleting(true);
      const deletePromises = Array.from(selectedIds).map((id) =>
        examsService.deleteExam(String(id)).catch((err) => ({ error: err }))
      );
      await Promise.allSettled(deletePromises);
      showToast(t('exams.bulkDeleteSuccess', `Successfully deleted ${count} exams`, { count }), 'success');
      setSelectedIds(new Set());
      fetchExams();
    } catch (_err) {
      showToast(t('exams.bulkDeleteError', 'An error occurred during bulk deletion'), 'error');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  // Live Metric Counts for Status Tabs
  const totalCount = exams.length;
  const upcomingCount = useMemo(() => exams.filter((e) => getExamStatus(e) === 'UPCOMING').length, [exams]);
  const todayCount = useMemo(() => exams.filter((e) => getExamStatus(e) === 'TODAY').length, [exams]);
  const completedCount = useMemo(() => exams.filter((e) => getExamStatus(e) === 'COMPLETED').length, [exams]);

  // Reset Filters
  const handleResetFilters = () => {
    setSearch('');
    setSelectedCollege('');
    setSelectedDept('');
    setSelectedYear('');
    setTypeFilter('ALL');
    setStatusFilter('ALL');
  };

  const hasActiveFilters =
    search.trim() !== '' ||
    selectedCollege !== '' ||
    selectedDept !== '' ||
    selectedYear !== '' ||
    typeFilter !== 'ALL' ||
    statusFilter !== 'ALL';

  // Format Time (12-hour AM/PM)
  const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? t('common.pm', 'PM') : t('common.am', 'AM');
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  // Type badge renderer
  const renderTypeBadge = (type: string) => {
    const c = getTypeBadgeConfig(type, t);
    return (
      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${c.bg} ${c.text}`}>
        {c.label}
      </span>
    );
  };

  // Status badge renderer
  const renderStatusBadge = (exam: any) => {
    const status = getExamStatus(exam);
    if (status === 'TODAY') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500 text-white shadow-2xs animate-pulse">
          <Clock size={11} />
          <span>{t('exams.statusToday', 'Today')}</span>
        </span>
      );
    }
    if (status === 'UPCOMING') {
      const days = getDaysUntil(exam.date);
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
          <CalendarCheck size={11} />
          <span>{days > 0 ? t('exams.daysRemaining', { count: days }) : t('exams.statusUpcoming', 'Upcoming')}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
        <CheckCircle2 size={11} />
        <span>{t('exams.statusCompleted', 'Completed')}</span>
      </span>
    );
  };

  return (
    <div className="section-gap animate-in fade-in duration-500 space-y-4 w-full min-w-0 pb-20">
      {/* 1. Sleek Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-800 dark:text-white flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-brand-primary-500/10 text-brand-primary-600 dark:text-brand-primary-400">
              <Calendar size={22} />
            </span>
            {t('exams.managementTitle', 'Exams & Assessments Management')}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
            {t('exams.managementSubtitle', 'Schedule, track, and manage midterm, final, and quiz assessments')}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Archive Link Button */}
          <button
            type="button"
            onClick={() => navigate('/record')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-bold text-xs transition-colors border border-indigo-200 dark:border-indigo-800/60"
            title={t('exams.archiveBadge', 'Exams Archive')}
          >
            <Archive size={14} />
            <span>{t('exams.archiveBadge', 'Archive Record')}</span>
          </button>

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
              <span>{t('exams.viewCardView', 'Cards')}</span>
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
              <span>{t('exams.viewListView', 'List')}</span>
            </button>
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={fetchExams}
            className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-xs transition-all border border-slate-200 dark:border-slate-700 active:scale-95 shadow-2xs"
            title={t('common.refresh', 'Refresh')}
          >
            <RotateCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>

          {/* Add Exam Button */}
          {isAdmin && (
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand-primary-500 hover:bg-brand-primary-600 text-white font-bold text-xs shadow-sm shadow-brand-primary-500/20 active:scale-95 transition-all"
            >
              <Plus size={15} />
              <span>{t('exams.addExam', 'New Exam')}</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. EXECUTIVE 4-METRIC RIBBON                                              */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
        {/* Total Exams */}
        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'ALL' ? 'ALL' : 'ALL')}
          className={`p-3 rounded-2xl border transition-all text-start flex items-center justify-between cursor-pointer ${
            statusFilter === 'ALL'
              ? 'bg-brand-primary-50 dark:bg-brand-primary-950/40 border-brand-primary-400 dark:border-brand-primary-600 ring-2 ring-brand-primary-500/20 shadow-xs'
              : 'bg-white dark:bg-slate-800 border-slate-200/90 dark:border-slate-700 shadow-2xs hover:border-brand-primary-300'
          }`}
        >
          <div>
            <span className="text-[10px] text-slate-400 font-semibold block">
              {t('exams.totalExams', 'Total Exams')}
            </span>
            <span className="text-lg font-black text-brand-primary-600 dark:text-brand-primary-400 block mt-0.5 font-mono">
              {totalCount}
            </span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-brand-primary-50 dark:bg-brand-primary-950/50 text-brand-primary-600 flex items-center justify-center shrink-0">
            <Calendar size={16} />
          </div>
        </button>

        {/* Upcoming Exams */}
        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'UPCOMING' ? 'ALL' : 'UPCOMING')}
          className={`p-3 rounded-2xl border transition-all text-start flex items-center justify-between cursor-pointer ${
            statusFilter === 'UPCOMING'
              ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-400 dark:border-blue-600 ring-2 ring-blue-500/20 shadow-xs'
              : 'bg-white dark:bg-slate-800 border-slate-200/90 dark:border-slate-700 shadow-2xs hover:border-blue-300'
          }`}
        >
          <div>
            <span className="text-[10px] text-slate-400 font-semibold block">
              {t('exams.statusUpcoming', 'Upcoming')}
            </span>
            <span className="text-lg font-black text-blue-600 dark:text-blue-400 block mt-0.5 font-mono">
              {upcomingCount}
            </span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center shrink-0">
            <Clock size={16} />
          </div>
        </button>

        {/* Today's Exams */}
        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'TODAY' ? 'ALL' : 'TODAY')}
          className={`p-3 rounded-2xl border transition-all text-start flex items-center justify-between cursor-pointer ${
            statusFilter === 'TODAY'
              ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-400 dark:border-amber-600 ring-2 ring-amber-500/20 shadow-xs'
              : 'bg-white dark:bg-slate-800 border-slate-200/90 dark:border-slate-700 shadow-2xs hover:border-amber-300'
          }`}
        >
          <div>
            <span className="text-[10px] text-slate-400 font-semibold block">
              {t('exams.statusToday', 'Today')}
            </span>
            <span className="text-lg font-black text-amber-600 dark:text-amber-400 block mt-0.5 font-mono">
              {todayCount}
            </span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center shrink-0">
            <CalendarCheck size={16} />
          </div>
        </button>

        {/* Completed */}
        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'COMPLETED' ? 'ALL' : 'COMPLETED')}
          className={`p-3 rounded-2xl border transition-all text-start flex items-center justify-between cursor-pointer ${
            statusFilter === 'COMPLETED'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-600 ring-2 ring-emerald-500/20 shadow-xs'
              : 'bg-white dark:bg-slate-800 border-slate-200/90 dark:border-slate-700 shadow-2xs hover:border-emerald-300'
          }`}
        >
          <div>
            <span className="text-[10px] text-slate-400 font-semibold block">
              {t('exams.statusCompleted', 'Submitted')}
            </span>
            <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 block mt-0.5 font-mono">
              {completedCount}
            </span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 size={16} />
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
            placeholder={t('exams.searchPlaceholder', 'Search by exam title, course code, or room...')}
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

        {/* Exam Type */}
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="h-8.5 px-3 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-brand-primary-500 cursor-pointer"
        >
          <option value="ALL">{t('exams.allTypes', 'All Types')}</option>
          <option value="MIDTERM">{t('exams.filterMidterm', 'Midterm')}</option>
          <option value="FINAL">{t('exams.filterFinal', 'Final')}</option>
          <option value="QUIZ">{t('exams.filterQuiz', 'Quiz')}</option>
        </select>

        {/* Sort Button */}
        <button
          type="button"
          onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
          className="h-8.5 px-3 bg-slate-100 dark:bg-slate-900/60 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1 border border-slate-200 dark:border-slate-700 cursor-pointer"
          title={sortOrder === 'asc' ? t('exams.sortDateAsc') : t('exams.sortDateDesc')}
        >
          <ArrowUpDown size={12} />
          <span>{sortOrder === 'asc' ? (isRTL ? 'الأقدم' : 'Earliest') : (isRTL ? 'الأحدث' : 'Latest')}</span>
        </button>

        {/* Clear Filters Button */}
        {hasActiveFilters && (
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
      </div>

      {/* 3. Main Content: Cards Grid vs Table List */}
      {loading ? (
        <Card className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-12 flex flex-col items-center justify-center gap-3 text-center">
          <Loader2 className="animate-spin text-brand-primary-500" size={32} />
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
            {t('exams.fetching', 'Loading exams...')}
          </p>
        </Card>
      ) : filteredExams.length === 0 ? (
        <Card className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-12 flex flex-col items-center justify-center text-center">
          <div className="w-14 h-14 rounded-full bg-brand-primary-500/10 text-brand-primary-500 flex items-center justify-center text-2xl mb-3">
            <Calendar size={28} />
          </div>
          <h3 className="text-base font-bold text-slate-800 dark:text-white mb-1">
            {hasActiveFilters ? t('exams.noExams', 'No Exams Found') : t('exams.noExamsSubtitle', 'No exams scheduled yet')}
          </h3>
          <p className="text-xs text-slate-400 font-medium max-w-sm mb-4">
            {hasActiveFilters
              ? t('schedule.noDoctorScheduleDesc', 'Try selecting different filter options or resetting filters.')
              : t('exams.noExamsSubtitle', 'Get started by creating your first exam.')}
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
            isAdmin && (
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-brand-primary-500 text-white font-bold text-xs shadow-xs flex items-center gap-1.5"
              >
                <Plus size={15} />
                <span>{t('exams.addExam', 'New Exam')}</span>
              </button>
            )
          )}
        </Card>
      ) : viewMode === 'CARD' ? (
        /* MODE A: RESPONSIVE CARDS GRID VIEW */
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredExams.map((exam) => {
              const isSelected = selectedIds.has(exam.id);

              return (
                <Card
                  key={exam.id}
                  className={`rounded-2xl border p-4 shadow-2xs hover:shadow-sm transition-all relative flex flex-col justify-between group ${
                    isSelected
                      ? 'border-brand-primary-500 ring-2 ring-brand-primary-500/20 bg-brand-primary-500/[0.02] dark:bg-brand-primary-500/[0.04]'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                  }`}
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <div className="flex items-center gap-2">
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => handleToggleSelect(exam.id)}
                            className="text-slate-400 hover:text-brand-primary-600 focus:outline-none transition-colors"
                          >
                            {isSelected ? (
                              <CheckSquare size={16} className="text-brand-primary-600" />
                            ) : (
                              <Square size={16} />
                            )}
                          </button>
                        )}
                        {renderTypeBadge(exam.type)}
                      </div>

                      {renderStatusBadge(exam)}
                    </div>

                    {/* Exam Name & Course */}
                    <div className="mb-2.5">
                      <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                        {exam.course?.courseCode && (
                          <span className="px-2 py-0.5 rounded-md bg-brand-primary-500/10 text-brand-primary-700 dark:text-brand-primary-300 font-black text-[11px]">
                            {exam.course.courseCode}
                          </span>
                        )}
                        <h4 className="font-bold text-slate-900 dark:text-white text-xs md:text-sm leading-snug">
                          {getExamLabel(exam, t)}
                        </h4>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
                        {exam.course?.name || exam.title}
                      </p>
                    </div>

                    {/* Details: Date, Time & Hall */}
                    <div className="space-y-1.5 py-2 border-t border-slate-100 dark:border-slate-700/60 text-xs">
                      {/* Date & Time */}
                      <div className="flex items-center justify-between text-slate-700 dark:text-slate-300 font-semibold">
                        <div className="flex items-center gap-1.5">
                          <Calendar size={12} className="text-brand-primary-500 shrink-0" />
                          <span>{exam.date}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 font-bold">
                          <Clock size={11} className="text-slate-400 shrink-0" />
                          <span>{formatTime(exam.startTime)} - {formatTime(exam.endTime)}</span>
                        </div>
                      </div>

                      {/* Hall */}
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-slate-400 font-medium">{t('exams.roomColumn', 'Hall:')}</span>
                        {exam.room ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-bold text-xs">
                            <MapPin size={11} className="text-blue-500 shrink-0" />
                            <span>{exam.room}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800 font-bold text-[10px]">
                            <AlertTriangle size={10} className="text-amber-500" />
                            <span>{t('schedules.unassignedRoomBadge', 'Unassigned')}</span>
                          </span>
                        )}
                      </div>

                      {/* Department */}
                      {exam.course?.department?.name && (
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-400 font-medium">{t('common.department', 'Dept:')}</span>
                          <span className="text-slate-600 dark:text-slate-300 font-semibold truncate max-w-[150px]">
                            {exam.course.department?.nameAr || exam.course.department?.name}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="pt-2.5 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => navigate(`/exams/${exam.id}`)}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-brand-primary-50 dark:bg-brand-primary-950/40 hover:bg-brand-primary-100 dark:hover:bg-brand-primary-900/40 text-brand-primary-700 dark:text-brand-primary-300 text-xs font-bold transition-colors"
                    >
                      <Eye size={13} />
                      <span>{t('exams.examDetails', 'Details & Results')}</span>
                    </button>

                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => setDeleteTarget({ id: exam.id, name: getExamLabel(exam, t) })}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors border border-slate-200 dark:border-slate-700"
                        title={t('common.delete', 'Delete')}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Footer stats */}
          <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs text-slate-500 font-bold">
            <span>
              {t('common.showing', 'Showing')} {filteredExams.length} {t('common.of', 'of')} {exams.length}{' '}
              {t('exams.totalCount', 'Exams')}
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
                  {isAdmin && (
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
                  <th className="p-3.5 text-start min-w-[220px]">{t('exams.examColumn', 'Exam & Course')}</th>
                  <th className="p-3.5 text-center w-28">{t('exams.typeColumn', 'Type')}</th>
                  <th className="p-3.5 text-start min-w-[150px]">{t('exams.dateTimeColumn', 'Date & Time')}</th>
                  <th className="p-3.5 text-center min-w-[120px]">{t('exams.roomColumn', 'Hall')}</th>
                  <th className="p-3.5 text-center min-w-[130px]">{t('exams.statusColumn', 'Status')}</th>
                  <th className="p-3.5 text-center w-28">{t('exams.actionsColumn', 'Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 text-xs">
                {filteredExams.map((exam) => {
                  const isSelected = selectedIds.has(exam.id);

                  return (
                    <tr
                      key={exam.id}
                      className={`group hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors ${
                        isSelected ? 'bg-brand-primary-500/[0.04] dark:bg-brand-primary-500/[0.08]' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      {isAdmin && (
                        <td className="p-3.5 align-middle text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleSelect(exam.id)}
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

                      {/* Exam & Course */}
                      <td className="p-3.5 align-middle">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {exam.course?.courseCode && (
                              <span className="px-2 py-0.5 rounded-md bg-brand-primary-500/10 text-brand-primary-700 dark:text-brand-primary-300 font-black text-[11px]">
                                {exam.course.courseCode}
                              </span>
                            )}
                            <span className="font-bold text-slate-900 dark:text-white text-xs">
                              {getExamLabel(exam, t)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                            <span>{exam.course?.name || exam.title}</span>
                            {exam.course?.department?.name && (
                              <>
                                <span>•</span>
                                <span>{exam.course.department.nameAr || exam.course.department.name}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Type */}
                      <td className="p-3.5 align-middle text-center whitespace-nowrap">
                        {renderTypeBadge(exam.type)}
                      </td>

                      {/* Date & Time */}
                      <td className="p-3.5 align-middle whitespace-nowrap">
                        <div className="space-y-0.5">
                          <div className="font-bold text-slate-800 dark:text-white flex items-center gap-1">
                            <Calendar size={12} className="text-brand-primary-500 shrink-0" />
                            <span>{exam.date}</span>
                          </div>
                          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                            <Clock size={11} className="text-slate-400 shrink-0" />
                            <span>{formatTime(exam.startTime)} - {formatTime(exam.endTime)}</span>
                          </div>
                        </div>
                      </td>

                      {/* Hall */}
                      <td className="p-3.5 align-middle text-center whitespace-nowrap">
                        {exam.room ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-bold text-xs">
                            <MapPin size={11} className="text-blue-500 shrink-0" />
                            <span>{exam.room}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800 font-bold text-[10px]">
                            <AlertTriangle size={10} className="text-amber-500" />
                            <span>{t('schedules.unassignedRoomBadge', 'Unassigned')}</span>
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="p-3.5 align-middle text-center whitespace-nowrap">
                        {renderStatusBadge(exam)}
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 align-middle text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => navigate(`/exams/${exam.id}`)}
                            className="p-1.5 rounded-lg text-brand-primary-600 hover:bg-brand-primary-50 dark:hover:bg-brand-primary-950/40 transition-colors"
                            title={t('exams.examDetails', 'Details & Results')}
                          >
                            <Eye size={14} />
                          </button>
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => setDeleteTarget({ id: exam.id, name: getExamLabel(exam, t) })}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors"
                              title={t('common.delete', 'Delete')}
                            >
                              <Trash2 size={14} />
                            </button>
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
                {t('common.showing', 'Showing')} {filteredExams.length} {t('common.of', 'of')} {exams.length}{' '}
                {t('exams.totalCount', 'Exams')}
              </span>
            </div>
          </div>
        </Card>
      )}

      {/* 4. Standard Bottom Floating BulkActionToolbar */}
      {isAdmin && (
        <BulkActionToolbar
          selectedCount={selectedIds.size}
          onClear={() => setSelectedIds(new Set())}
          onDelete={handleBulkDelete}
        />
      )}

      {/* Add Exam Modal */}
      {isModalOpen && (
        <AddExamModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => {
            setIsModalOpen(false);
            fetchExams();
          }}
        />
      )}

      {/* Confirm Delete Modal */}
      {deleteTarget && (
        <ConfirmDeleteModal
          isOpen={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
          title={t('exams.deleteExamTitle', 'Delete Exam')}
          message={t('exams.deleteConfirmMessage', `Are you sure you want to delete "${deleteTarget?.name}"?`)}
          isLoading={deleteLoading}
        />
      )}
    </div>
  );
};

export default ExamsList;
