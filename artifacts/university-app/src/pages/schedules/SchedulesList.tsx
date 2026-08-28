// @ts-nocheck
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar,
  MapPin,
  BookOpen,
  Loader2,
  AlertCircle,
  CheckCircle,
  Edit2,
  Trash2,
  Plus,
  List,
  LayoutGrid,
  Search,
  RotateCcw,
  User,
  Users,
  AlertTriangle,
  Clock,
  Building,
  CheckCircle2,
  X,
  RotateCw,
  CalendarDays,
  CheckSquare,
  Square,
  MinusSquare
} from 'lucide-react';
import Card from '../../components/ui/Card';
import BulkActionToolbar from '../../components/ui/BulkActionToolbar';
import schedulesService from '../../services/schedules.service';
import collegeService from '../../services/college.service';
import departmentService from '../../services/department.service';
import coursesService from '../../services/courses.service';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import useScope from '../../hooks/useScope';
import { useSearchParams } from 'react-router-dom';
import ScheduleModal from './ScheduleModal';
import { ScheduleView } from '../../components/timetable/ScheduleView';
import { generateHourlyTimes } from '../../utils/scheduleConfig';
import { logger } from '../../lib/logger';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';

const getSessionBadgeStyle = (type: string) => {
  switch (type) {
    case 'LECTURE':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800';
    case 'LAB':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800';
    case 'SECTION':
    case 'TUTORIAL':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border-purple-200 dark:border-purple-800';
    default:
      return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';
  }
};

const SchedulesList = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isRTL } = useLanguage();
  const { scopeParams, isCollegeAdmin } = useScope();
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast } = useToast();

  // View Modes: 'LIST' | 'CARD' | 'GRID'
  const [viewMode, setViewMode] = useState<'LIST' | 'CARD' | 'GRID'>(() => {
    const v = searchParams.get('view');
    if (v === 'card') return 'CARD';
    if (v === 'grid') return 'GRID';
    return 'LIST';
  });

  useEffect(() => {
    const v = searchParams.get('view');
    if (v === 'card') setViewMode('CARD');
    else if (v === 'grid') setViewMode('GRID');
    else if (v === 'list') setViewMode('LIST');
  }, [searchParams]);

  const handleViewModeChange = (mode: 'LIST' | 'CARD' | 'GRID') => {
    setViewMode(mode);
    const newParams = new URLSearchParams(searchParams);
    if (mode === 'CARD') newParams.set('view', 'card');
    else if (mode === 'GRID') newParams.set('view', 'grid');
    else newParams.delete('view');
    setSearchParams(newParams, { replace: true });
  };

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [colleges, setColleges] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);

  // Filter States
  const [search, setSearch] = useState('');
  const [selectedCollege, setSelectedCollege] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedSemester, setSelectedSemester] = useState('');
  const [selectedSlotType, setSelectedSlotType] = useState('all');
  const [filterMissingRoom, setFilterMissingRoom] = useState(false);
  const [filterMissingDoctor, setFilterMissingDoctor] = useState(false);
  const [filterConflictsOnly, setFilterConflictsOnly] = useState(false);

  // Multi-Selection State
  const [selectedIds, setSelectedIds] = useState<Set<number | string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<any>(null);

  const canManage = ['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'].includes(user?.role);

  // 1. Fetch Metadata
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [collegesRes, deptsRes, coursesRes] = await Promise.all([
          collegeService.getColleges({ limit: 100 }).catch(() => ({ data: [] })),
          departmentService.getDepartments({ limit: 200 }).catch(() => ({ data: [] })),
          coursesService.getCourses({ limit: 300 }).catch(() => ({ data: [] })),
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

        if (coursesRes.success || coursesRes.data) {
          const arr = Array.isArray(coursesRes.data)
            ? coursesRes.data
            : coursesRes.data?.courses || coursesRes.data?.data || [];
          setCourses(arr);
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

  // 2. Fetch Master Schedules
  const fetchSchedules = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, any> = { ...scopeParams };
      const result = await schedulesService.getSchedules(params);
      if (result.success || result.data) {
        const arr = Array.isArray(result.data)
          ? result.data
          : result.data?.schedules || result.data?.data || [];
        setSchedules(arr);
      }
    } catch (err: any) {
      logger.error('Error fetching schedules:', err);
      setError(err.message || t('common.fetchError', 'Error fetching schedules'));
      showToast(t('common.fetchError', 'Error fetching schedules'), 'error');
    } finally {
      setLoading(false);
    }
  }, [scopeParams, t, showToast]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  // Delete Individual Schedule
  const handleDelete = async (id: number | string) => {
    if (window.confirm(t('schedules.deleteConfirm', 'Are you sure you want to delete this schedule?'))) {
      try {
        const result = await schedulesService.deleteSchedule(String(id));
        if (result.success) {
          showToast(t('common.deleteSuccess', 'Schedule deleted successfully'), 'success');
          setSelectedIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
          fetchSchedules();
        }
      } catch (_error) {
        showToast(t('common.deleteError', 'Error deleting schedule'), 'error');
      }
    }
  };

  // Format Time (12-hour AM/PM)
  const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? t('common.pm', 'PM') : t('common.am', 'AM');
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  // Conflict Detection Map
  const conflictSlotIds = useMemo(() => {
    const conflictSet = new Set<number | string>();
    const groupedByTime: Record<string, any[]> = {};

    schedules.forEach((s) => {
      const key = `${s.dayOfWeek}_${s.startTime}`;
      if (!groupedByTime[key]) groupedByTime[key] = [];
      groupedByTime[key].push(s);
    });

    Object.values(groupedByTime).forEach((group) => {
      if (group.length > 1) {
        const roomMap: Record<string, any[]> = {};
        const docMap: Record<string, any[]> = {};

        group.forEach((s) => {
          if (s.room) {
            if (!roomMap[s.room]) roomMap[s.room] = [];
            roomMap[s.room].push(s);
          }
          if (s.doctorId || s.doctor?.id) {
            const dId = String(s.doctorId || s.doctor?.id);
            if (!docMap[dId]) docMap[dId] = [];
            docMap[dId].push(s);
          }
        });

        Object.values(roomMap).forEach((slots) => {
          if (slots.length > 1) slots.forEach((slot) => conflictSet.add(slot.id));
        });
        Object.values(docMap).forEach((slots) => {
          if (slots.length > 1) slots.forEach((slot) => conflictSet.add(slot.id));
        });
      }
    });

    return conflictSet;
  }, [schedules]);

  // 3. Multi-Dimensional Filter Logic
  const filteredSchedules = useMemo(() => {
    return schedules.filter((s) => {
      const course = s.course || {};
      const deptId = course.departmentId || course.department?.id;
      const colId = course.department?.collegeId || course.department?.college?.id;

      // College Filter
      if (selectedCollege && String(colId) !== String(selectedCollege)) return false;

      // Department Filter
      if (selectedDept && String(deptId) !== String(selectedDept)) return false;

      // Academic Year Filter
      if (selectedYear) {
        const yr = parseInt(selectedYear, 10);
        if (course.year !== yr && s.year !== yr) return false;
      }

      // Semester Filter
      if (selectedSemester) {
        const sem = parseInt(selectedSemester, 10);
        if (course.semester !== sem && s.semester !== sem) return false;
      }

      // Slot Type Filter
      if (selectedSlotType !== 'all') {
        if (s.slotType !== selectedSlotType) return false;
      }

      // Filter: Missing Room Only
      if (filterMissingRoom) {
        if (s.room && s.room.trim() !== '') return false;
      }

      // Filter: Missing Doctor Only
      if (filterMissingDoctor) {
        if (s.doctor || s.doctorId) return false;
      }

      // Filter: Conflicts Only
      if (filterConflictsOnly) {
        if (!conflictSlotIds.has(s.id)) return false;
      }

      // Search Query Filter
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const courseName = (course.name || '').toLowerCase();
        const courseCode = (course.courseCode || '').toLowerCase();
        const roomName = (s.room || '').toLowerCase();
        const groupName = (s.group?.name || '').toLowerCase();
        const docName = `${s.doctor?.firstName || ''} ${s.doctor?.lastName || ''}`.toLowerCase();
        const taName = `${s.teachingAssistant?.firstName || ''} ${s.teachingAssistant?.lastName || ''}`.toLowerCase();
        const deptName = (course.department?.name || course.department?.nameAr || '').toLowerCase();

        const matches =
          courseName.includes(q) ||
          courseCode.includes(q) ||
          roomName.includes(q) ||
          groupName.includes(q) ||
          docName.includes(q) ||
          taName.includes(q) ||
          deptName.includes(q);

        if (!matches) return false;
      }

      return true;
    });
  }, [
    schedules,
    selectedCollege,
    selectedDept,
    selectedYear,
    selectedSemester,
    selectedSlotType,
    filterMissingRoom,
    filterMissingDoctor,
    filterConflictsOnly,
    search,
    conflictSlotIds,
  ]);

  // Multi-Selection Logic
  const allFilteredIds = useMemo(() => filteredSchedules.map((s) => s.id), [filteredSchedules]);
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

  // Bulk Delete Selected Sessions
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    const msg = t('schedules.bulkDeleteConfirm', `Are you sure you want to delete ${count} selected sessions? This action cannot be undone.`, { count });
    if (!window.confirm(msg)) return;

    try {
      setIsBulkDeleting(true);
      const deletePromises = Array.from(selectedIds).map((id) =>
        schedulesService.deleteSchedule(String(id)).catch((err) => ({ error: err }))
      );
      await Promise.allSettled(deletePromises);
      showToast(t('schedules.bulkDeleteSuccess', `Successfully deleted ${count} sessions`, { count }), 'success');
      setSelectedIds(new Set());
      fetchSchedules();
    } catch (err) {
      showToast(t('schedules.bulkDeleteError', 'An error occurred during bulk deletion'), 'error');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  // Live Metric Counts for Quick Filter Chips
  const totalCount = schedules.length;
  const missingRoomCount = useMemo(() => schedules.filter((s) => !s.room || s.room.trim() === '').length, [schedules]);
  const missingDoctorCount = useMemo(() => schedules.filter((s) => !s.doctor && !s.doctorId).length, [schedules]);
  const conflictsCount = useMemo(() => schedules.filter((s) => conflictSlotIds.has(s.id)).length, [schedules, conflictSlotIds]);

  // Group filtered slots for the Grid matrix view
  const timetableRecord = useMemo(() => {
    return filteredSchedules.reduce((acc: Record<string, any[]>, slot: any) => {
      if (!slot.dayOfWeek) return acc;
      const dayName = slot.dayOfWeek.charAt(0).toUpperCase() + slot.dayOfWeek.slice(1).toLowerCase();
      if (!acc[dayName]) acc[dayName] = [];
      acc[dayName].push(slot);
      return acc;
    }, {});
  }, [filteredSchedules]);

  const days = isRTL
    ? ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
    : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const [selectedDay, setSelectedDay] = useState(days[0]);
  const times = useMemo(() => generateHourlyTimes(), []);

  // Reset all filters
  const handleResetFilters = () => {
    setSearch('');
    setSelectedCollege('');
    setSelectedDept('');
    setSelectedYear('');
    setSelectedSemester('');
    setSelectedSlotType('all');
    setFilterMissingRoom(false);
    setFilterMissingDoctor(false);
    setFilterConflictsOnly(false);
  };

  const hasActiveFilters =
    search.trim() !== '' ||
    selectedCollege !== '' ||
    selectedDept !== '' ||
    selectedYear !== '' ||
    selectedSemester !== '' ||
    selectedSlotType !== 'all' ||
    filterMissingRoom ||
    filterMissingDoctor ||
    filterConflictsOnly;

  return (
    <div className="section-gap animate-in fade-in duration-500 space-y-4 w-full min-w-0 pb-20">
      {/* 1. Sleek Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-800 dark:text-white flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-brand-primary-500/10 text-brand-primary-600 dark:text-brand-primary-400">
              <Calendar size={22} />
            </span>
            {t('schedules.managementTitle', 'Schedules & Sessions Management')}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
            {t('schedules.managementSubtitle', 'Manage class schedules, halls, faculty members, and student groups')}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* View Mode Switcher (List, Cards, Grid) */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
            <button
              type="button"
              onClick={() => handleViewModeChange('LIST')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'LIST'
                  ? 'bg-white dark:bg-slate-700 text-brand-primary-600 dark:text-brand-primary-300 shadow-xs'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <List size={14} />
              <span>{t('schedules.viewListView', 'List')}</span>
            </button>
            <button
              type="button"
              onClick={() => handleViewModeChange('CARD')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'CARD'
                  ? 'bg-white dark:bg-slate-700 text-brand-primary-600 dark:text-brand-primary-300 shadow-xs'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <LayoutGrid size={14} />
              <span>{t('schedules.viewCardView', 'Cards')}</span>
            </button>
            <button
              type="button"
              onClick={() => handleViewModeChange('GRID')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'GRID'
                  ? 'bg-white dark:bg-slate-700 text-brand-primary-600 dark:text-brand-primary-300 shadow-xs'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <CalendarDays size={14} />
              <span>{t('schedules.viewTimetableGrid', 'Timetable')}</span>
            </button>
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={fetchSchedules}
            className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-xs transition-all border border-slate-200 dark:border-slate-700 shadow-2xs active:scale-95"
            title={t('common.refresh', 'Refresh')}
          >
            <RotateCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>

          {/* Create Session Button */}
          {canManage && (
            <button
              type="button"
              onClick={() => {
                setEditingSchedule(null);
                setIsModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand-primary-500 hover:bg-brand-primary-600 text-white font-bold text-xs shadow-sm shadow-brand-primary-500/20 active:scale-95 transition-all"
            >
              <Plus size={15} />
              <span>{t('schedules.createSession', 'New Session')}</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. EXECUTIVE 4-METRIC RIBBON                                              */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
        {/* Total Sessions */}
        <button
          type="button"
          onClick={() => {
            setFilterMissingRoom(false);
            setFilterMissingDoctor(false);
            setFilterConflictsOnly(false);
          }}
          className={`p-3 rounded-2xl border transition-all text-start flex items-center justify-between cursor-pointer ${
            !filterMissingRoom && !filterMissingDoctor && !filterConflictsOnly
              ? 'bg-brand-primary-50 dark:bg-brand-primary-950/40 border-brand-primary-400 dark:border-brand-primary-600 ring-2 ring-brand-primary-500/20 shadow-xs'
              : 'bg-white dark:bg-slate-800 border-slate-200/90 dark:border-slate-700 shadow-2xs hover:border-brand-primary-300'
          }`}
        >
          <div>
            <span className="text-[10px] text-slate-400 font-semibold block">
              {t('schedules.totalSessions', 'Total Sessions')}
            </span>
            <span className="text-lg font-black text-brand-primary-600 dark:text-brand-primary-400 block mt-0.5 font-mono">
              {totalCount}
            </span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-brand-primary-50 dark:bg-brand-primary-950/50 text-brand-primary-600 flex items-center justify-center shrink-0">
            <Calendar size={16} />
          </div>
        </button>

        {/* Schedule Conflicts */}
        <button
          type="button"
          onClick={() => {
            setFilterConflictsOnly(!filterConflictsOnly);
            setFilterMissingRoom(false);
            setFilterMissingDoctor(false);
          }}
          className={`p-3 rounded-2xl border transition-all text-start flex items-center justify-between cursor-pointer ${
            filterConflictsOnly
              ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-400 dark:border-rose-600 ring-2 ring-rose-500/20 shadow-xs'
              : 'bg-white dark:bg-slate-800 border-slate-200/90 dark:border-slate-700 shadow-2xs hover:border-rose-300'
          }`}
        >
          <div>
            <span className="text-[10px] text-slate-400 font-semibold block">
              {t('schedules.conflicts', 'Schedule Conflicts')}
            </span>
            <span className="text-lg font-black text-rose-600 dark:text-rose-400 block mt-0.5 font-mono">
              {conflictsCount}
            </span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 flex items-center justify-center shrink-0">
            <AlertTriangle size={16} />
          </div>
        </button>

        {/* Missing Hall / Room */}
        <button
          type="button"
          onClick={() => {
            setFilterMissingRoom(!filterMissingRoom);
            setFilterConflictsOnly(false);
            setFilterMissingDoctor(false);
          }}
          className={`p-3 rounded-2xl border transition-all text-start flex items-center justify-between cursor-pointer ${
            filterMissingRoom
              ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-400 dark:border-amber-600 ring-2 ring-amber-500/20 shadow-xs'
              : 'bg-white dark:bg-slate-800 border-slate-200/90 dark:border-slate-700 shadow-2xs hover:border-amber-300'
          }`}
        >
          <div>
            <span className="text-[10px] text-slate-400 font-semibold block">
              {t('schedules.missingRoom', 'Unassigned Halls')}
            </span>
            <span className="text-lg font-black text-amber-600 dark:text-amber-400 block mt-0.5 font-mono">
              {missingRoomCount}
            </span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center shrink-0">
            <MapPin size={16} />
          </div>
        </button>

        {/* Missing Faculty */}
        <button
          type="button"
          onClick={() => {
            setFilterMissingDoctor(!filterMissingDoctor);
            setFilterConflictsOnly(false);
            setFilterMissingRoom(false);
          }}
          className={`p-3 rounded-2xl border transition-all text-start flex items-center justify-between cursor-pointer ${
            filterMissingDoctor
              ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-400 dark:border-blue-600 ring-2 ring-blue-500/20 shadow-xs'
              : 'bg-white dark:bg-slate-800 border-slate-200/90 dark:border-slate-700 shadow-2xs hover:border-blue-300'
          }`}
        >
          <div>
            <span className="text-[10px] text-slate-400 font-semibold block">
              {t('schedules.missingDoctor', 'Unassigned Instructors')}
            </span>
            <span className="text-lg font-black text-blue-600 dark:text-blue-400 block mt-0.5 font-mono">
              {missingDoctorCount}
            </span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center shrink-0">
            <User size={16} />
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
            placeholder={t('schedules.searchPlaceholder', 'Search course, code, room, or doctor...')}
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

        {/* Session Type */}
        <select
          value={selectedSlotType}
          onChange={(e) => setSelectedSlotType(e.target.value)}
          className="h-8.5 px-3 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-brand-primary-500 cursor-pointer"
        >
          <option value="all">{t('common.all', 'All Types')}</option>
          <option value="LECTURE">{t('schedule.lecture', 'Lectures')}</option>
          <option value="LAB">{t('schedule.lab', 'Labs')}</option>
          <option value="SECTION">{t('schedule.section', 'Sections')}</option>
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

      {/* 3. Main Content Area (List / Cards / Grid) */}
      {loading ? (
        <Card className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-12 flex flex-col items-center justify-center gap-3 text-center">
          <Loader2 className="animate-spin text-brand-primary-500" size={32} />
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
            {t('common.loadingSchedule', 'Loading schedules...')}
          </p>
        </Card>
      ) : error ? (
        <Card className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-12 flex flex-col items-center justify-center text-center">
          <AlertCircle size={36} className="text-rose-500 mb-2" />
          <h3 className="text-base font-bold text-slate-800 dark:text-white mb-2">{error}</h3>
          <button
            type="button"
            onClick={fetchSchedules}
            className="px-4 py-1.5 rounded-xl bg-brand-primary-500 text-white font-bold text-xs shadow-xs"
          >
            {t('common.retry', 'Retry')}
          </button>
        </Card>
      ) : filteredSchedules.length === 0 ? (
        <Card className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-12 flex flex-col items-center justify-center text-center">
          <div className="w-14 h-14 rounded-full bg-brand-primary-500/10 text-brand-primary-500 flex items-center justify-center text-2xl mb-3">
            <Calendar size={28} />
          </div>
          <h3 className="text-base font-bold text-slate-800 dark:text-white mb-1">
            {hasActiveFilters ? t('schedules.noResultsFound', 'No Sessions Found') : t('schedules.EMPTY_TITLE', 'No schedules yet')}
          </h3>
          <p className="text-xs text-slate-400 font-medium max-w-sm mb-4">
            {hasActiveFilters
              ? t('schedules.noResultsFoundDesc', 'Try adjusting your search criteria or resetting filters.')
              : t('schedules.EMPTY_DESC', 'Get started by creating your first class schedule.')}
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
                  setEditingSchedule(null);
                  setIsModalOpen(true);
                }}
                className="px-4 py-2 rounded-xl bg-brand-primary-500 text-white font-bold text-xs shadow-xs flex items-center gap-1.5"
              >
                <Plus size={15} />
                <span>{t('schedules.createSession', 'New Session')}</span>
              </button>
            )
          )}
        </Card>
      ) : viewMode === 'GRID' ? (
        /* MODE A: TIMETABLE GRID MATRIX */
        <ScheduleView
          timetable={timetableRecord}
          role="ALL"
          selectedDay={selectedDay}
          setSelectedDay={setSelectedDay}
          days={days}
          times={times}
          formatTime={formatTime}
          canManage={canManage}
          onSlotClick={(slot) => {
            if (canManage) {
              setEditingSchedule(slot);
              setIsModalOpen(true);
            }
          }}
        />
      ) : viewMode === 'CARD' ? (
        /* MODE B: RESPONSIVE CARDS VIEW */
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredSchedules.map((slot) => {
              const course = slot.course || {};
              const hasConflict = conflictSlotIds.has(slot.id);
              const isMissingRoom = !slot.room || slot.room.trim() === '';
              const isSelected = selectedIds.has(slot.id);

              const docName = slot.doctor
                ? `${slot.doctor.firstName || ''} ${slot.doctor.lastName || ''}`.replace(/^(Dr\.|د\.)\s*/i, '').trim()
                : '';

              const taName = slot.teachingAssistant
                ? `${slot.teachingAssistant.firstName || ''} ${slot.teachingAssistant.lastName || ''}`.trim()
                : '';

              return (
                <Card
                  key={slot.id}
                  className={`rounded-2xl border p-4 shadow-2xs hover:shadow-sm transition-all relative flex flex-col justify-between group ${
                    isSelected
                      ? 'border-brand-primary-500 ring-2 ring-brand-primary-500/20 bg-brand-primary-500/[0.02] dark:bg-brand-primary-500/[0.04]'
                      : hasConflict
                      ? 'border-amber-300 dark:border-amber-700/60 bg-amber-50/20 dark:bg-amber-950/10'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                  }`}
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        {canManage && (
                          <button
                            type="button"
                            onClick={() => handleToggleSelect(slot.id)}
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
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${getSessionBadgeStyle(
                            slot.slotType
                          )}`}
                        >
                          {t(`schedule.${(slot.slotType || '').toLowerCase()}`, slot.slotType)}
                        </span>
                        {hasConflict && (
                          <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[9px] font-black animate-pulse flex items-center gap-1">
                            <AlertTriangle size={10} />
                            {t('schedule.conflictsDetected', 'Conflict')}
                          </span>
                        )}
                      </div>

                      {canManage && (
                        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingSchedule(slot);
                              setIsModalOpen(true);
                            }}
                            className="p-1 rounded-lg text-slate-500 hover:text-brand-primary-600 hover:bg-brand-primary-50 dark:hover:bg-brand-primary-950/40 transition-colors"
                            title={t('schedules.editSession', 'Edit')}
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(slot.id)}
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                            title={t('schedules.deleteSession', 'Delete')}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Course Title & Code */}
                    <div className="mb-2.5">
                      <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                        {course.courseCode && (
                          <span className="px-2 py-0.5 rounded-md bg-brand-primary-500/10 text-brand-primary-700 dark:text-brand-primary-300 font-black text-[11px]">
                            {course.courseCode}
                          </span>
                        )}
                        <h4 className="font-bold text-slate-900 dark:text-white text-xs md:text-sm leading-snug">
                          {course.name || t('common.untitledCourse', 'Untitled Course')}
                        </h4>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                        {course.department?.nameAr || course.department?.name || t('common.generalDept', 'General')}
                        {course.year && ` • ${t('common.year', 'Year')} ${course.year}`}
                      </p>
                    </div>

                    {/* Card Details */}
                    <div className="space-y-1.5 py-2 border-t border-slate-100 dark:border-slate-700/60 text-xs">
                      {/* Day & Time */}
                      <div className="flex items-center justify-between text-slate-700 dark:text-slate-300 font-semibold">
                        <div className="flex items-center gap-1.5">
                          <Calendar size={12} className="text-brand-primary-500 shrink-0" />
                          <span>{t(`days.${(slot.dayOfWeek || '').toLowerCase()}`, slot.dayOfWeek)}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 font-bold">
                          <Clock size={11} className="text-slate-400 shrink-0" />
                          <span>
                            {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                          </span>
                        </div>
                      </div>

                      {/* Hall */}
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-slate-400 font-medium">{t('schedules.roomLabel', 'Hall:')}</span>
                        {isMissingRoom ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800 font-bold text-[10px]">
                            <AlertTriangle size={10} className="text-amber-500" />
                            {t('schedules.unassignedRoomBadge', '⚠️ Unassigned')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-bold text-xs">
                            <MapPin size={11} className="text-blue-500 shrink-0" />
                            <span>{slot.room}</span>
                          </span>
                        )}
                      </div>

                      {/* Faculty */}
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-slate-400 font-medium">{t('schedules.instructorLabel', 'Faculty:')}</span>
                        {docName ? (
                          <span className="font-bold text-slate-800 dark:text-white text-xs flex items-center gap-1">
                            <User size={11} className="text-brand-primary-500 shrink-0" />
                            <span>{t('common.dr', 'Dr.')} {docName}</span>
                          </span>
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400 font-medium text-[11px]">
                            {t('schedules.unassignedDoctorBadge', 'Staff (TBA)')}
                          </span>
                        )}
                      </div>

                      {/* Group */}
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-slate-400 font-medium">{t('schedules.groupLabel', 'Group:')}</span>
                        {slot.group?.name ? (
                          <span className="px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-bold text-[11px]">
                            {t('common.group', 'Group')} {slot.group.name}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-medium text-[11px]">
                            {t('schedules.allStudentsBatch', 'All Students')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Footer stats */}
          <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs text-slate-500 font-bold">
            <span>
              {t('common.showing', 'Showing')} {filteredSchedules.length} {t('common.of', 'of')} {schedules.length}{' '}
              {t('schedule.totalSlots', 'Sessions')}
            </span>
          </div>
        </div>
      ) : (
        /* MODE C: TABLE LIST VIEW */
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
                  <th className="p-3.5 text-start min-w-[220px]">{t('schedules.colCourseDept', 'Course & Department')}</th>
                  <th className="p-3.5 text-start min-w-[150px]">{t('schedules.colDayTime', 'Day & Time')}</th>
                  <th className="p-3.5 text-start min-w-[130px]">{t('schedules.colRoom', 'Hall / Lab')}</th>
                  <th className="p-3.5 text-start min-w-[180px]">{t('schedules.colTypeInstructor', 'Type & Instructor')}</th>
                  <th className="p-3.5 text-start min-w-[120px]">{t('schedules.colGroup', 'Group')}</th>
                  <th className="p-3.5 text-center w-24">{t('schedules.colActions', 'Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 text-xs">
                {filteredSchedules.map((slot) => {
                  const course = slot.course || {};
                  const hasConflict = conflictSlotIds.has(slot.id);
                  const isMissingRoom = !slot.room || slot.room.trim() === '';
                  const isSelected = selectedIds.has(slot.id);

                  const docName = slot.doctor
                    ? `${slot.doctor.firstName || ''} ${slot.doctor.lastName || ''}`.replace(/^(Dr\.|د\.)\s*/i, '').trim()
                    : '';

                  const taName = slot.teachingAssistant
                    ? `${slot.teachingAssistant.firstName || ''} ${slot.teachingAssistant.lastName || ''}`.trim()
                    : '';

                  return (
                    <tr
                      key={slot.id}
                      className={`group hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors ${
                        isSelected
                          ? 'bg-brand-primary-500/[0.04] dark:bg-brand-primary-500/[0.08]'
                          : hasConflict
                          ? 'bg-amber-50/40 dark:bg-amber-950/20'
                          : ''
                      }`}
                    >
                      {/* Checkbox */}
                      {canManage && (
                        <td className="p-3.5 align-middle text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleSelect(slot.id)}
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

                      {/* Course & Department */}
                      <td className="p-3.5 align-middle">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {course.courseCode && (
                              <span className="px-2 py-0.5 rounded-md bg-brand-primary-500/10 text-brand-primary-700 dark:text-brand-primary-300 font-black text-[11px]">
                                {course.courseCode}
                              </span>
                            )}
                            <span className="font-bold text-slate-900 dark:text-white text-xs">
                              {course.name || t('common.untitledCourse', 'Untitled Course')}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                            <span>{course.department?.nameAr || course.department?.name || t('common.generalDept', 'General')}</span>
                            {course.year && (
                              <>
                                <span>•</span>
                                <span className="text-slate-600 dark:text-slate-300 font-bold">
                                  {t('common.year', 'Year')} {course.year}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Day & Time */}
                      <td className="p-3.5 align-middle whitespace-nowrap">
                        <div className="space-y-0.5">
                          <div className="font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                            <Calendar size={12} className="text-brand-primary-500 shrink-0" />
                            <span>{t(`days.${(slot.dayOfWeek || '').toLowerCase()}`, slot.dayOfWeek)}</span>
                          </div>
                          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                            <Clock size={11} className="text-slate-400 shrink-0" />
                            <span>
                              {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Hall */}
                      <td className="p-3.5 align-middle whitespace-nowrap">
                        {isMissingRoom ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800 font-bold text-[10px]">
                            <AlertTriangle size={11} className="text-amber-500" />
                            {t('schedules.unassignedRoomBadge', '⚠️ Unassigned')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-bold text-xs">
                            <MapPin size={11} className="text-blue-500 shrink-0" />
                            <span>{slot.room}</span>
                          </span>
                        )}
                      </td>

                      {/* Type & Instructor */}
                      <td className="p-3.5 align-middle">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${getSessionBadgeStyle(
                                slot.slotType
                              )}`}
                            >
                              {t(`schedule.${(slot.slotType || '').toLowerCase()}`, slot.slotType)}
                            </span>
                            {hasConflict && (
                              <span className="px-1.5 py-0.5 rounded-md bg-rose-500 text-white text-[9px] font-black animate-pulse">
                                {t('schedule.conflictsDetected', 'Conflict')}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-[11px] font-bold text-slate-700 dark:text-slate-300">
                            <User size={11} className="text-brand-primary-500 shrink-0" />
                            {docName ? (
                              <span>
                                {t('common.dr', 'Dr.')} {docName}
                              </span>
                            ) : (
                              <span className="text-amber-600 dark:text-amber-400 font-medium">
                                {t('schedules.unassignedDoctorBadge', 'Staff (TBA)')}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Group */}
                      <td className="p-3.5 align-middle whitespace-nowrap">
                        {slot.group?.name ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-bold text-xs">
                            <Users size={11} className="text-purple-500 shrink-0" />
                            <span>{t('common.group', 'Group')} {slot.group.name}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 font-medium text-[11px]">
                            {t('schedules.allStudentsBatch', 'All Students')}
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 align-middle text-center whitespace-nowrap">
                        {canManage && (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingSchedule(slot);
                                setIsModalOpen(true);
                              }}
                              className="p-1 rounded-lg text-slate-500 hover:text-brand-primary-600 hover:bg-brand-primary-50 dark:hover:bg-brand-primary-950/40 transition-colors"
                              title={t('schedules.editSession', 'Edit Session')}
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(slot.id)}
                              className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                              title={t('schedules.deleteSession', 'Delete Session')}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Table Footer */}
            <div className="p-3 bg-slate-50 dark:bg-slate-900/40 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs text-slate-500 font-bold">
              <span>
                {t('common.showing', 'Showing')} {filteredSchedules.length} {t('common.of', 'of')} {schedules.length}{' '}
                {t('schedule.totalSlots', 'Sessions')}
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

      {/* Schedule Edit / Create Modal */}
      {isModalOpen && (
        <ScheduleModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingSchedule(null);
          }}
          schedule={editingSchedule}
          courses={courses}
          onSuccess={() => {
            setIsModalOpen(false);
            setEditingSchedule(null);
            fetchSchedules();
          }}
        />
      )}
    </div>
  );
};

export default SchedulesList;
