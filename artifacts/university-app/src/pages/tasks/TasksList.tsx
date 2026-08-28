// @ts-nocheck
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import taskService, { GetTasksParams } from '../../services/task.service';
import coursesService from '../../services/courses.service';
import SubmissionsGradingModal from '../../components/tasks/SubmissionsGradingModal';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import {
  ClipboardList,
  Calendar,
  Plus,
  FileUp,
  CheckCircle,
  Clock,
  X,
  Send,
  AlertCircle,
  Loader2,
  Pencil,
  Trash2,
  MessageSquare,
  Search,
  RotateCcw,
  LayoutGrid,
  LayoutList,
  Building2,
  Users,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Eye,
  FileText,
} from 'lucide-react';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/button';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Modal from '../../components/ui/Modal';
import Table, {
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../../components/ui/Table';

type CreateFormData = {
  title: string;
  description: string;
  courseId: string;
  dueDate: string;
  maxScore: number;
};

type SubmitFormData = {
  notes?: string;
  fileUrl: string;
};

// Arabic normalization helper
function normalizeArabic(text: string | null | undefined): string {
  if (!text) return '';
  return String(text)
    .trim()
    .toLowerCase()
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/\s+/g, ' ');
}

export function TasksList() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { user } = useAuth();
  const isDoctor =
    user?.role === 'DOCTOR' ||
    user?.role === 'SUPER_ADMIN' ||
    user?.role === 'COLLEGE_ADMIN' ||
    user?.role === 'DEPARTMENT_ADMIN' ||
    user?.role === 'TEACHING_ASSISTANT';
  const isStudent = user?.role === 'STUDENT';

  const [searchParams, setSearchParams] = useSearchParams();

  const courseIdParam = searchParams.get('courseId') || '';
  const statusParam = searchParams.get('status') || '';
  const dueFromParam = searchParams.get('dueFrom') || '';
  const dueToParam = searchParams.get('dueTo') || '';
  const sortByParam = searchParams.get('sortBy') || '';
  const searchParam = searchParams.get('search') || '';
  const yearParam = searchParams.get('year') || '';

  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  const updateParam = (key: string, val: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (val) {
        next.set(key, val);
      } else {
        next.delete(key);
      }
      return next;
    });
  };

  const clearAllFilters = () => {
    setSearchParams(new URLSearchParams());
  };

  const hasActiveFilters =
    !!courseIdParam ||
    !!statusParam ||
    !!dueFromParam ||
    !!dueToParam ||
    !!sortByParam ||
    !!searchParam ||
    !!yearParam;

  const [tasks, setTasks] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<any>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showSubmissionsModal, setShowSubmissionsModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [mySubmissions, setMySubmissions] = useState<Record<number, any>>({});

  const createSchema = useMemo(
    () =>
      z.object({
        title: z.string().min(1, t('tasks.titleRequired', 'Task title is required')),
        description: z.string().min(1, t('tasks.descriptionRequired', 'Task description is required')),
        courseId: z.string().min(1, t('tasks.courseRequired', 'Please select a course')),
        dueDate: z.string().min(1, t('tasks.dueDateRequired', 'Due date is required')),
        maxScore: z.coerce.number().min(1, t('tasks.maxScoreMin', 'Total points must be at least 1')),
      }),
    [t]
  );

  const submitSchema = useMemo(
    () =>
      z.object({
        notes: z.string().optional(),
        fileUrl: z
          .string()
          .url(t('tasks.invalidUrl', 'Please enter a valid submission link'))
          .min(1, t('tasks.fileUrlRequired', 'Submission file URL is required')),
      }),
    [t]
  );

  const {
    register: registerCreate,
    handleSubmit: handleSubmitCreate,
    reset: resetCreate,
    setValue: setCreateValue,
    formState: { errors: errorsCreate, isSubmitting: isSubmittingCreate },
  } = useForm({
    resolver: zodResolver(createSchema),
    defaultValues: {
      title: '',
      description: '',
      courseId: '',
      dueDate: '',
      maxScore: 100,
    },
  });

  const {
    register: registerSubmit,
    handleSubmit: handleSubmitSubmit,
    reset: resetSubmit,
    formState: { errors: errorsSubmit, isSubmitting: isSubmittingSubmit },
  } = useForm({
    resolver: zodResolver(submitSchema),
    defaultValues: { notes: '', fileUrl: '' },
  });

  useEffect(() => {
    if (showCreateModal) {
      if (editingTask) {
        const date = new Date(editingTask.dueDate);
        const iso = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16);
        setCreateValue('title', editingTask.title);
        setCreateValue('description', editingTask.description);
        setCreateValue('courseId', String(editingTask.courseId));
        setCreateValue('dueDate', iso);
        setCreateValue('maxScore', editingTask.maxScore);
      } else {
        resetCreate();
      }
    }
  }, [showCreateModal, resetCreate, editingTask, setCreateValue]);

  useEffect(() => {
    if (showSubmitModal) resetSubmit();
  }, [showSubmitModal, resetSubmit]);

  const showToast = (message: string, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const isOverdue = (dueDate: string | Date) => new Date(dueDate) < new Date();

  const isTaskOwner = (task: any) => {
    if (!task || !user) return false;
    if (user.role !== 'DOCTOR') return true;
    return (
      String(task.doctor?.userId || '') === String(user.id) ||
      String(task.doctorId || '') === String(user.doctor?.id || '')
    );
  };

  const fetchTasks = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        const params: GetTasksParams = {};
        if (courseIdParam) params.courseId = Number(courseIdParam);
        if (statusParam) params.status = statusParam as any;
        if (dueFromParam) params.dueFrom = dueFromParam;
        if (dueToParam) params.dueTo = dueToParam;
        if (sortByParam) params.sortBy = sortByParam as GetTasksParams['sortBy'];
        if (searchParam) params.search = searchParam;
        if (yearParam) params.year = Number(yearParam);

        const result = await taskService.getTasks(params);
        if (result.success) {
          setTasks(result.data?.rows || result.data || []);
        }
      } catch (error) {
        showToast(t('tasks.fetchError', 'Error loading tasks'), 'error');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [courseIdParam, statusParam, dueFromParam, dueToParam, sortByParam, searchParam, yearParam, t]
  );

  const fetchCourses = async () => {
    try {
      const result = await coursesService.getCourses();
      if (result.success) {
        const list = Array.isArray(result.data) ? result.data : result.data?.courses || [];
        setCourses(list);
      }
    } catch (error) {
      console.error('Error fetching courses:', error);
    }
  };

  const fetchMySubmissions = async (taskIds: number[]) => {
    if (!isStudent) return;
    const map: Record<number, any> = {};
    await Promise.all(
      taskIds.map(async (tid) => {
        try {
          const r = await taskService.getMySubmission(tid);
          if (r.success) map[tid] = r.data;
        } catch (e) {}
      })
    );
    setMySubmissions(map);
  };

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    if (isDoctor) fetchCourses();
  }, [isDoctor]);

  useEffect(() => {
    if (tasks.length > 0 && isStudent) {
      fetchMySubmissions(tasks.map((t) => t.id));
    }
  }, [tasks, isStudent]);

  const onCreateSubmit = async (data: any) => {
    try {
      let result;
      if (editingTask) {
        result = await taskService.updateTask(editingTask.id, data);
        if (result.success) {
          showToast(t('tasks.updateSuccess', 'Task updated successfully'), 'success');
          setShowCreateModal(false);
          setEditingTask(null);
          fetchTasks(true);
        } else {
          showToast(result.message || t('tasks.updateError', 'Error updating task'), 'error');
        }
      } else {
        result = await taskService.createTask(data);
        if (result.success) {
          showToast(t('tasks.createSuccess', 'Task created successfully'), 'success');
          setShowCreateModal(false);
          fetchTasks(true);
        } else {
          showToast(result.message || t('tasks.createError', 'Error creating task'), 'error');
        }
      }
    } catch (error: any) {
      const msg =
        error.response?.data?.message ||
        (editingTask
          ? t('tasks.updateError', 'Error updating task')
          : t('tasks.createError', 'Error creating task'));
      showToast(msg, 'error');
    }
  };

  const onSubmitTask = async (data: any) => {
    try {
      const result = await taskService.submitTask(selectedTask.id, data);
      if (result.success) {
        showToast(t('tasks.submitSuccess', 'Task submitted successfully'), 'success');
        setShowSubmitModal(false);
        fetchTasks(true);
      } else {
        showToast(result.message || t('tasks.submitError', 'Error submitting task'), 'error');
      }
    } catch (error: any) {
      showToast(error.response?.data?.message || t('tasks.submitError', 'Error submitting task'), 'error');
    }
  };

  const onConfirmDelete = async (force = false) => {
    if (!selectedTask) return;
    try {
      const result = await taskService.deleteTask(selectedTask.id, force);
      if (result.success) {
        showToast(t('tasks.deleteSuccess', 'Task deleted successfully'), 'success');
        setShowDeleteConfirm(false);
        setSelectedTask(null);
        fetchTasks(true);
      } else {
        showToast(result.message || t('tasks.deleteError', 'Error deleting task'), 'error');
      }
    } catch (e: any) {
      showToast(e.response?.data?.message || t('tasks.deleteError', 'Error deleting task'), 'error');
    }
  };

  const locale = i18n.language === 'ar' ? 'ar-EG' : 'en-US';
  const formatDate = (d: any) =>
    d
      ? new Date(d).toLocaleDateString(locale, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '—';

  // KPI Metrics calculations
  const kpis = useMemo(() => {
    let active = 0;
    let overdue = 0;
    let totalSubs = 0;

    tasks.forEach((t) => {
      if (isOverdue(t.dueDate)) overdue++;
      else active++;
      totalSubs += t._count?.submissions || 0;
    });

    return {
      total: tasks.length,
      active,
      overdue,
      totalSubs,
    };
  }, [tasks]);

  const renderStudentStatusBadge = (task: any) => {
    const my = mySubmissions[task.id];
    if (my && my.score != null) {
      return (
        <Badge className="bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 font-bold text-xs">
          {t('tasks.statusGraded', {
            score: my.score,
            maxScore: task.maxScore,
            defaultValue: `تم الرصد: ${my.score} / ${task.maxScore}`,
          })}
        </Badge>
      );
    }
    if (my) {
      return (
        <Badge className="bg-blue-100 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 font-bold text-xs">
          {t('tasks.statusSubmitted', 'Submitted')}
        </Badge>
      );
    }
    if (isOverdue(task.dueDate)) {
      return (
        <Badge className="bg-rose-100 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 font-bold text-xs">
          {t('tasks.statusOverdue', 'Overdue')}
        </Badge>
      );
    }
    return (
      <Badge className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs">
        {t('tasks.statusNotSubmitted', 'Not Submitted')}
      </Badge>
    );
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {toast && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs font-semibold ${
            toast.type === 'error'
              ? 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800'
              : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {toast.type === 'error' ? <AlertCircle size={15} /> : <CheckCircle size={15} />}
            <span>{toast.message}</span>
          </div>
          <button onClick={() => setToast(null)} className="p-1 hover:opacity-75 cursor-pointer">
            <X size={14} />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. SLIM PAGE HEADER                                                       */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            {t('tasks.title', 'Tasks & Assignments')}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {isDoctor
              ? t('tasks.subtitleDoctor', 'Manage student assignments, grading, and submissions.')
              : t('tasks.subtitleStudent', 'View course assignments and submit your deliverables.')}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchTasks(true)}
            disabled={refreshing}
            className="h-8.5 px-3 rounded-lg border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 gap-1.5 cursor-pointer shadow-2xs"
          >
            <RotateCw size={13} className={refreshing ? 'animate-spin' : ''} />
            <span>{t('common.refresh', 'Refresh')}</span>
          </Button>

          {isDoctor && (
            <Button
              size="sm"
              onClick={() => {
                setEditingTask(null);
                setShowCreateModal(true);
              }}
              className="h-8.5 px-3.5 bg-brand-primary-600 hover:bg-brand-primary-700 text-white rounded-lg text-xs font-bold gap-1.5 shadow-xs cursor-pointer"
            >
              <Plus size={14} />
              <span>{t('tasks.createTask', 'Create Assignment')}</span>
            </Button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. EXECUTIVE KPI OVERVIEW BADGES                                          */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Total Tasks */}
        <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200/90 dark:border-slate-700 shadow-2xs">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-bold text-slate-600 dark:text-slate-300">
              {t('tasks.totalTasks', 'Total Assignments')}
            </span>
            <ClipboardList size={14} className="text-brand-primary-500" />
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white font-mono">
            {kpis.total}
          </div>
        </div>

        {/* Active Tasks */}
        <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200/90 dark:border-slate-700 shadow-2xs">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-bold text-emerald-700 dark:text-emerald-400">
              {t('tasks.activeTasks', 'Active Assignments')}
            </span>
            <Clock size={14} className="text-emerald-500" />
          </div>
          <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
            {kpis.active}
          </div>
        </div>

        {/* Submissions Count (Doctor) / Completed (Student) */}
        <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200/90 dark:border-slate-700 shadow-2xs">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-bold text-blue-700 dark:text-blue-400">
              {isDoctor ? t('tasks.submissions', 'Submissions') : t('tasks.statusSubmitted', 'Submitted')}
            </span>
            <Users size={14} className="text-blue-500" />
          </div>
          <div className="text-xl font-black text-blue-600 dark:text-blue-400 font-mono">
            {isDoctor ? kpis.totalSubs : Object.keys(mySubmissions).length}
          </div>
        </div>

        {/* Overdue */}
        <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200/90 dark:border-slate-700 shadow-2xs">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-bold text-rose-700 dark:text-rose-400">
              {t('tasks.overdueTasks', 'Overdue Assignments')}
            </span>
            <AlertTriangle size={14} className="text-rose-500" />
          </div>
          <div className="text-xl font-black text-rose-600 dark:text-rose-400 font-mono">
            {kpis.overdue}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. UNIFIED COMPACT FILTER TOOLBAR                                         */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700/80 p-2.5 shadow-2xs space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px]">
            <Search
              className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={14}
            />
            <input
              type="text"
              value={searchParam}
              onChange={(e) => updateParam('search', e.target.value)}
              placeholder={t('tasks.searchPlaceholder', 'Search assignment title, course, or description...')}
              className="w-full ps-8 pe-7 h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1.5 focus:ring-brand-primary-500"
            />
            {searchParam && (
              <button
                onClick={() => updateParam('search', '')}
                className="absolute end-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Course Dropdown */}
          {courses.length > 0 && (
            <select
              value={courseIdParam}
              onChange={(e) => updateParam('courseId', e.target.value)}
              aria-label={t('tasks.allCourses', 'All Courses')}
              className="h-9 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-brand-primary-500 cursor-pointer max-w-[160px] truncate"
            >
              <option value="">{t('tasks.allCourses', 'All Courses')}</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.courseCode} - {c.name}
                </option>
              ))}
            </select>
          )}

          {/* Academic Year Dropdown */}
          <select
            value={yearParam}
            onChange={(e) => updateParam('year', e.target.value)}
            aria-label={t('tasks.allYears', 'All Years')}
            className="h-9 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-brand-primary-500 cursor-pointer"
          >
            <option value="">{t('tasks.allYears', 'All Years')}</option>
            <option value="1">{isRTL ? 'الفرقة الأولى (1)' : 'Year 1'}</option>
            <option value="2">{isRTL ? 'الفرقة الثانية (2)' : 'Year 2'}</option>
            <option value="3">{isRTL ? 'الفرقة الثالثة (3)' : 'Year 3'}</option>
            <option value="4">{isRTL ? 'الفرقة الرابعة (4)' : 'Year 4'}</option>
          </select>

          {/* Status Dropdown */}
          <select
            value={statusParam}
            onChange={(e) => updateParam('status', e.target.value)}
            aria-label={t('tasks.allStatus', 'All Statuses')}
            className="h-9 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-brand-primary-500 cursor-pointer"
          >
            <option value="">{t('tasks.allStatus', 'All Statuses')}</option>
            <option value="ACTIVE">{t('tasks.statusActive', 'Active')}</option>
            <option value="OVERDUE">{t('tasks.statusOverdue', 'Overdue')}</option>
          </select>

          {/* Sort Dropdown */}
          <select
            value={sortByParam}
            onChange={(e) => updateParam('sortBy', e.target.value)}
            aria-label={t('tasks.sortByDefault', 'Sort: Default')}
            className="h-9 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-brand-primary-500 cursor-pointer"
          >
            <option value="">{t('tasks.sortByDefault', 'Sort: Default')}</option>
            <option value="DUE_DATE_ASC">{t('tasks.sortDueAsc', 'Due Soonest')}</option>
            <option value="DUE_DATE_DESC">{t('tasks.sortDueDesc', 'Due Latest')}</option>
            <option value="CREATED_AT_DESC">{t('tasks.sortCreatedDesc', 'Recently Created')}</option>
            <option value="SUBMISSIONS_COUNT_DESC">{t('tasks.sortSubmissionsDesc', 'Most Submissions')}</option>
          </select>

          {/* Reset Filters */}
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="h-9 px-2.5 rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 text-xs font-medium flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw size={12} />
              <span>{isRTL ? 'مسح' : 'Reset'}</span>
            </button>
          )}

          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-900 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 ms-auto">
            <button
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded-md text-xs transition-all cursor-pointer ${
                viewMode === 'cards'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
              title={isRTL ? 'عرض البطاقات' : 'Cards'}
            >
              <LayoutGrid size={15} />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-md text-xs transition-all cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
              title={isRTL ? 'عرض الجدول' : 'Table'}
            >
              <LayoutList size={15} />
            </button>
          </div>
        </div>

        {/* Date Filter & Counter Sub-row */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-700/50 text-[11px] text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{t('tasks.dueDateRange', 'Due Date Range')}:</span>
            <input
              type="date"
              value={dueFromParam}
              onChange={(e) => updateParam('dueFrom', e.target.value)}
              className="h-7 px-2 text-[11px] rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 cursor-pointer"
              title={t('tasks.dueDateFrom', 'Due From')}
            />
            <span>→</span>
            <input
              type="date"
              value={dueToParam}
              onChange={(e) => updateParam('dueTo', e.target.value)}
              className="h-7 px-2 text-[11px] rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 cursor-pointer"
              title={t('tasks.dueDateTo', 'Due To')}
            />
          </div>

          <span>
            {isRTL
              ? `عرض ${tasks.length} تكليف`
              : `Showing ${tasks.length} assignment(s)`}
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. MAIN VIEW: REFINED COMPACT CARDS OR HIGH-DENSITY TABLE                 */}
      {/* ========================================================================= */}
      {loading ? (
        <div className="flex flex-col items-center justify-center h-48 gap-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
          <Loader2 className="animate-spin text-brand-primary-500" size={32} />
          <span className="text-xs text-slate-400 font-medium">{t('common.loading', 'Loading...')}</span>
        </div>
      ) : tasks.length === 0 ? (
        <div className="p-8 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
          <EmptyState
            icon={<ClipboardList size={36} className="text-slate-400" />}
            title={t('tasks.noTasks', 'No assignments match your criteria')}
            subtitle={
              isDoctor
                ? t('tasks.subtitleDoctor', 'Manage student assignments, grading, and submissions.')
                : t('tasks.subtitleStudent', 'View course assignments and submit your deliverables.')
            }
            action={
              isDoctor
                ? {
                    label: t('tasks.createTask', 'Create Assignment'),
                    onClick: () => setShowCreateModal(true),
                  }
                : hasActiveFilters
                ? {
                    label: isRTL ? 'إعادة ضبط الفلاتر' : 'Reset Filters',
                    onClick: clearAllFilters,
                  }
                : undefined
            }
          />
        </div>
      ) : viewMode === 'cards' ? (
        /* ======================================================================= */
        /* REFINED COMPACT CARD GRID (3-column)                                    */
        /* ======================================================================= */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {tasks.map((task) => {
            const overdue = isOverdue(task.dueDate);
            const subsCount = task._count?.submissions || 0;
            const totalEnrolled = task.course?._count?.enrollments || 30;
            const progressPercent = Math.min(100, Math.round((subsCount / (totalEnrolled || 1)) * 100));

            return (
              <div
                key={task.id}
                className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-700/80 p-4 shadow-2xs hover:shadow-xs hover:border-brand-primary-300 dark:hover:border-brand-primary-600 transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Top Badges Row */}
                  <div className="flex items-center justify-between gap-1.5 mb-2">
                    <span className="font-mono text-xs font-bold text-brand-primary-700 dark:text-brand-primary-300 bg-brand-primary-50 dark:bg-brand-primary-950/50 px-2 py-0.5 rounded-md border border-brand-primary-200/40">
                      {task.course?.courseCode}
                    </span>

                    <div className="flex items-center gap-1 text-[10px] font-semibold">
                      <span
                        className={`px-2 py-0.5 rounded-md flex items-center gap-1 ${
                          overdue
                            ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200/40'
                            : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200/40'
                        }`}
                      >
                        <Clock size={11} />
                        <span>{new Date(task.dueDate).toLocaleDateString(locale, { month: 'short', day: 'numeric' })}</span>
                      </span>

                      <span className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded-md font-mono">
                        {task.maxScore} {isRTL ? 'نقطة' : 'pts'}
                      </span>
                    </div>
                  </div>

                  {/* Course Full Name */}
                  <div className="text-[11px] text-slate-400 font-medium truncate mb-1">
                    {task.course?.name}
                  </div>

                  {/* Task Title */}
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-snug mb-1 line-clamp-1">
                    {task.title}
                  </h3>

                  {/* Task Description */}
                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-3 leading-relaxed">
                    {task.description}
                  </p>

                  {/* Student Status Indicator */}
                  {isStudent && (
                    <div className="mb-3">{renderStudentStatusBadge(task)}</div>
                  )}

                  {/* Doctor/Admin: Submissions Progress Bar */}
                  {isDoctor && (
                    <div className="p-2.5 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-100 dark:border-slate-700/50 mb-3 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-slate-600 dark:text-slate-300">
                          {t('tasks.submissions', 'Submissions')}:
                        </span>
                        <span className="font-mono font-bold text-brand-primary-600 dark:text-brand-primary-400">
                          {subsCount} {isRTL ? 'تسليم' : 'submitted'}
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-brand-primary-500 h-full rounded-full transition-all"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Actions */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between gap-2">
                  {isDoctor ? (
                    <>
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedTask(task);
                          setShowSubmissionsModal(true);
                        }}
                        className="flex-1 h-8 bg-brand-primary-600 hover:bg-brand-primary-700 text-white rounded-lg text-xs font-bold gap-1.5 shadow-2xs cursor-pointer"
                      >
                        <Eye size={13} />
                        <span>{t('tasks.viewSubmissionsAction', 'View & Grade')}</span>
                      </Button>

                      <button
                        onClick={() => {
                          setEditingTask(task);
                          setShowCreateModal(true);
                        }}
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
                        title={t('common.edit', 'Edit')}
                      >
                        <Pencil size={13} />
                      </button>

                      <button
                        onClick={() => {
                          setSelectedTask(task);
                          setShowDeleteConfirm(true);
                        }}
                        className="p-1.5 rounded-lg border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                        title={t('common.delete', 'Delete')}
                      >
                        <Trash2 size={13} />
                      </button>
                    </>
                  ) : (
                    /* Student Submit Action */
                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedTask(task);
                        setShowSubmitModal(true);
                      }}
                      className={`w-full h-8 rounded-lg text-xs font-bold gap-1.5 cursor-pointer shadow-2xs ${
                        overdue
                          ? 'bg-rose-600 hover:bg-rose-700 text-white'
                          : 'bg-brand-primary-600 hover:bg-brand-primary-700 text-white'
                      }`}
                    >
                      <FileUp size={13} />
                      <span>
                        {mySubmissions[task.id]
                          ? t('tasks.resubmitTask', 'Resubmit Assignment')
                          : t('tasks.submitTask', 'Submit Assignment')}
                      </span>
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ======================================================================= */
        /* HIGH-DENSITY MINIMAL TABLE                                              */
        /* ======================================================================= */
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <Table className="w-full text-xs">
              <TableHeader className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700">
                <TableRow>
                  <TableHead className="w-24 p-2.5 font-bold text-slate-500">
                    {isRTL ? 'كود' : 'Code'}
                  </TableHead>
                  <TableHead className="p-2.5 font-bold text-slate-500">
                    {isRTL ? 'عنوان التكليف' : 'Assignment Title'}
                  </TableHead>
                  <TableHead className="p-2.5 font-bold text-slate-500">
                    {isRTL ? 'المقرر' : 'Course'}
                  </TableHead>
                  <TableHead className="p-2.5 font-bold text-slate-500 text-center">
                    {isRTL ? 'النقاط' : 'Points'}
                  </TableHead>
                  <TableHead className="p-2.5 font-bold text-slate-500 text-center">
                    {isRTL ? 'موعد التسليم' : 'Due Date'}
                  </TableHead>
                  <TableHead className="p-2.5 font-bold text-slate-500 text-center">
                    {isDoctor ? (isRTL ? 'التسليمات' : 'Submissions') : (isRTL ? 'الحالة' : 'Status')}
                  </TableHead>
                  <TableHead className="p-2.5 font-bold text-slate-500 text-end pe-4">
                    {isRTL ? 'الإجراءات' : 'Actions'}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((task) => {
                  const overdue = isOverdue(task.dueDate);
                  const subsCount = task._count?.submissions || 0;

                  return (
                    <TableRow
                      key={task.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-700/20 border-b border-slate-100 dark:border-slate-700/50"
                    >
                      <TableCell className="p-2.5 font-mono font-bold text-brand-primary-600">
                        {task.course?.courseCode}
                      </TableCell>
                      <TableCell className="p-2.5">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {task.title}
                        </div>
                        <div className="text-[10px] text-slate-400 line-clamp-1 max-w-[200px]">
                          {task.description}
                        </div>
                      </TableCell>
                      <TableCell className="p-2.5 text-slate-600 dark:text-slate-300 text-[11px] truncate max-w-[150px]">
                        {task.course?.name}
                      </TableCell>
                      <TableCell className="p-2.5 text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                        {task.maxScore}
                      </TableCell>
                      <TableCell className="p-2.5 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                            overdue
                              ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                              : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                          }`}
                        >
                          {new Date(task.dueDate).toLocaleDateString(locale, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </TableCell>
                      <TableCell className="p-2.5 text-center">
                        {isDoctor ? (
                          <span className="font-mono font-bold text-brand-primary-600 bg-brand-primary-50 dark:bg-brand-primary-950/50 px-2 py-0.5 rounded">
                            {subsCount}
                          </span>
                        ) : (
                          renderStudentStatusBadge(task)
                        )}
                      </TableCell>
                      <TableCell className="p-2.5 text-end pe-4">
                        <div className="inline-flex items-center gap-1.5">
                          {isDoctor ? (
                            <>
                              <Button
                                size="sm"
                                onClick={() => {
                                  setSelectedTask(task);
                                  setShowSubmissionsModal(true);
                                }}
                                className="h-7 px-2.5 bg-brand-primary-600 hover:bg-brand-primary-700 text-white rounded-lg text-xs font-bold gap-1 cursor-pointer"
                              >
                                <Eye size={12} />
                                <span>{isRTL ? 'رصد' : 'Grade'}</span>
                              </Button>
                              <button
                                onClick={() => {
                                  setEditingTask(task);
                                  setShowCreateModal(true);
                                }}
                                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 cursor-pointer"
                              >
                                <Pencil size={12} />
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedTask(task);
                                  setShowDeleteConfirm(true);
                                }}
                                className="p-1.5 rounded-lg border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 cursor-pointer"
                              >
                                <Trash2 size={12} />
                              </button>
                            </>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedTask(task);
                                setShowSubmitModal(true);
                              }}
                              className="h-7 px-2.5 bg-brand-primary-600 hover:bg-brand-primary-700 text-white rounded-lg text-xs font-bold gap-1 cursor-pointer"
                            >
                              <FileUp size={12} />
                              <span>{isRTL ? 'تسليم' : 'Submit'}</span>
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. MODALS: CREATE/EDIT, SUBMIT, DELETE, GRADE                             */}
      {/* ========================================================================= */}

      {/* Create/Edit Task Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setEditingTask(null);
        }}
        title={editingTask ? t('tasks.editTask', 'Edit Assignment') : t('tasks.createTask', 'Create Assignment')}
        subtitle={editingTask ? editingTask.title : t('tasks.subtitleDoctor', 'Manage student assignments, grading, and submissions.')}
        size="md"
      >
        <form onSubmit={handleSubmitCreate(onCreateSubmit)} className="space-y-3 pt-1">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t('tasks.taskTitle', 'Assignment Title')}
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-1.5 focus:ring-brand-primary-500 outline-none bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100"
              placeholder={t('tasks.taskTitle', 'Assignment Title')}
              {...registerCreate('title')}
            />
            {errorsCreate.title && (
              <p className="text-rose-500 text-[11px] mt-0.5">{errorsCreate.title.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t('tasks.taskDescription', 'Assignment Instructions & Description')}
            </label>
            <textarea
              rows={3}
              className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-1.5 focus:ring-brand-primary-500 outline-none bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100"
              placeholder={t('tasks.taskDescription', 'Assignment Instructions & Description')}
              {...registerCreate('description')}
            />
            {errorsCreate.description && (
              <p className="text-rose-500 text-[11px] mt-0.5">{errorsCreate.description.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t('nav.courses', 'Courses')}
              </label>
              <select
                className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-1.5 focus:ring-brand-primary-500 outline-none bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 cursor-pointer"
                disabled={!!editingTask}
                {...registerCreate('courseId')}
              >
                <option value="">{t('tasks.selectCourse', 'Select Course')}</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.courseCode} - {c.name}
                  </option>
                ))}
              </select>
              {errorsCreate.courseId && (
                <p className="text-rose-500 text-[11px] mt-0.5">{errorsCreate.courseId.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t('tasks.maxPoints', 'Total Points')}
              </label>
              <input
                type="number"
                className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-1.5 focus:ring-brand-primary-500 outline-none bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                {...registerCreate('maxScore')}
              />
              {errorsCreate.maxScore && (
                <p className="text-rose-500 text-[11px] mt-0.5">{errorsCreate.maxScore.message}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t('tasks.due', 'Submission Deadline')}
            </label>
            <input
              type="datetime-local"
              className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-1.5 focus:ring-brand-primary-500 outline-none bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100"
              {...registerCreate('dueDate')}
            />
            {errorsCreate.dueDate && (
              <p className="text-rose-500 text-[11px] mt-0.5">{errorsCreate.dueDate.message}</p>
            )}
          </div>

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setShowCreateModal(false);
                setEditingTask(null);
              }}
              className="text-xs font-semibold"
            >
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmittingCreate}
              className="bg-brand-primary-600 hover:bg-brand-primary-700 text-white text-xs font-bold"
            >
              {isSubmittingCreate
                ? t('common.loading', 'Loading...')
                : editingTask
                ? t('tasks.editTask', 'Edit Assignment')
                : t('tasks.createTask', 'Create Assignment')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Submit Task Modal */}
      <Modal
        isOpen={showSubmitModal}
        onClose={() => setShowSubmitModal(false)}
        title={t('tasks.submitTask', 'Submit Assignment')}
        subtitle={selectedTask?.title}
        size="md"
      >
        <form onSubmit={handleSubmitSubmit(onSubmitTask)} className="space-y-3 pt-1">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t('tasks.fileUrlLabel', 'Deliverable Link (Google Drive / GitHub / OneDrive)')}
            </label>
            <input
              type="url"
              className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-1.5 focus:ring-brand-primary-500 outline-none bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-mono"
              placeholder="https://drive.google.com/..."
              {...registerSubmit('fileUrl')}
            />
            {errorsSubmit.fileUrl && (
              <p className="text-rose-500 text-[11px] mt-0.5">{errorsSubmit.fileUrl.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t('tasks.submissionNotes', 'Additional Notes for Instructor (Optional)')}
            </label>
            <textarea
              rows={3}
              className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-1.5 focus:ring-brand-primary-500 outline-none bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100"
              placeholder={t('tasks.submissionNotes', 'Additional Notes for Instructor (Optional)')}
              {...registerSubmit('notes')}
            />
          </div>

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowSubmitModal(false)}
              className="text-xs font-semibold"
            >
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmittingSubmit}
              className="bg-brand-primary-600 hover:bg-brand-primary-700 text-white text-xs font-bold gap-1"
            >
              {isSubmittingSubmit ? (
                t('common.loading', 'Loading...')
              ) : (
                <>
                  <Send size={13} className="rtl:-scale-x-100" />
                  <span>{t('common.submit', 'Submit')}</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Submissions & Grading Modal */}
      <SubmissionsGradingModal
        isOpen={showSubmissionsModal}
        onClose={() => {
          setShowSubmissionsModal(false);
          fetchTasks(true);
        }}
        task={selectedTask}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title={t('tasks.deleteConfirmTitle', 'Confirm Assignment Deletion')}
        subtitle={selectedTask?.title}
        size="md"
      >
        <div className="space-y-4 pt-1">
          <div
            className={`p-3 rounded-xl border text-xs leading-relaxed ${
              (selectedTask?._count?.submissions || 0) > 0
                ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200'
                : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
            }`}
          >
            <div className="flex items-start gap-2">
              <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">
                  {(selectedTask?._count?.submissions || 0) > 0
                    ? t('tasks.deleteConfirmSoft', 'This task has student submissions. It will be archived to preserve student grades.')
                    : t('tasks.deleteConfirmEmpty', 'No submissions yet for this task.')}
                </p>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  {t('tasks.submissionsCountLabel', { count: selectedTask?._count?.submissions ?? 0 })}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDeleteConfirm(false)}
              className="text-xs font-semibold"
            >
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              size="sm"
              onClick={() => onConfirmDelete(false)}
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold"
            >
              {t('tasks.deleteSoft', 'Archive Assignment')}
            </Button>
            {(selectedTask?._count?.submissions || 0) === 0 && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => onConfirmDelete(true)}
                className="text-xs font-bold gap-1"
              >
                <Trash2 size={13} />
                <span>{t('tasks.deletePermanent', 'Permanent Delete')}</span>
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default TasksList;
