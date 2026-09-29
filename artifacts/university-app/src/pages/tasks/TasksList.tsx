import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import taskService, { GetTasksParams } from "../../services/task.service";
import coursesService from "../../services/courses.service";
import SubmissionsGradingModal from "../../components/tasks/SubmissionsGradingModal";
import { useAuth } from "../../context/AuthContext";
import { useTranslation } from "react-i18next";
import {
  ClipboardList,
  Plus,
  RotateCw,
  Loader2,
  X,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { EmptyState } from "../../components/ui/EmptyState";
import Button from "../../components/ui/button";
import Badge from "../../components/ui/badge";
import BulkActionToolbar from "../../components/ui/BulkActionToolbar";
import { downloadCsv } from "../../utils/exportCsv";

import { TaskModal } from "./components/TaskModal";
import { TaskSubmitModal } from "./components/TaskSubmitModal";
import { TaskDeleteModal } from "./components/TaskDeleteModal";
import { TasksFilterBar } from "./components/TasksFilterBar";
import { TasksCards } from "./components/TasksCards";
import { TasksTable } from "./components/TasksTable";
import { TasksKpiStats } from "./components/TasksKpiStats";

import type {
  TaskItem,
  CourseOption,
  CreateTaskFormData,
  SubmitTaskFormData,
} from "./types";

const TASKS_PAGE_SIZE = 24;

export function TasksList() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const { user } = useAuth();
  const isDoctor =
    user?.role === "DOCTOR" ||
    user?.role === "SUPER_ADMIN" ||
    user?.role === "COLLEGE_ADMIN" ||
    user?.role === "DEPARTMENT_ADMIN" ||
    user?.role === "TEACHING_ASSISTANT";
  const isStudent = user?.role === "STUDENT";

  const [searchParams, setSearchParams] = useSearchParams();

  const courseIdParam = searchParams.get("courseId") || "";
  const statusParam = searchParams.get("status") || "";
  const dueFromParam = searchParams.get("dueFrom") || "";
  const dueToParam = searchParams.get("dueTo") || "";
  const sortByParam = searchParams.get("sortBy") || "";
  const searchParam = searchParams.get("search") || "";
  const yearParam = searchParams.get("year") || "";
  const parsedPage = Number(searchParams.get("page"));
  const pageParam =
    Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const [searchInput, setSearchInput] = useState(searchParam);

  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  const updateParam = (key: string, val: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (val) {
        next.set(key, val);
      } else {
        next.delete(key);
      }
      if (key !== "page") next.delete("page");
      return next;
    });
  };

  useEffect(() => {
    setSearchInput(searchParam);
  }, [searchParam]);

  useEffect(() => {
    if (searchInput === searchParam) return;
    const timeoutId = window.setTimeout(() => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (searchInput.trim()) next.set('search', searchInput);
        else next.delete('search');
        next.delete("page");
        return next;
      });
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [searchInput, searchParam, setSearchParams]);

  const clearAllFilters = () => {
    setSearchInput("");
    setSearchParams(new URLSearchParams());
  };

  const hasActiveFilters =
    Boolean(courseIdParam) ||
    Boolean(statusParam) ||
    Boolean(dueFromParam) ||
    Boolean(dueToParam) ||
    Boolean(sortByParam) ||
    Boolean(searchParam) ||
    Boolean(yearParam);

  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: string } | null>(
    null,
  );
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showSubmissionsModal, setShowSubmissionsModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: TASKS_PAGE_SIZE,
    totalCount: 0,
    totalPages: 1,
  });
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(
    new Set(),
  );

  const showToast = (message: string, type = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const isOverdue = (dueDate: string | Date) => new Date(dueDate) < new Date();

  const fetchTasks = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        const params: GetTasksParams = {};
        if (courseIdParam) params.courseId = Number(courseIdParam);
        if (statusParam)
          params.status = statusParam as GetTasksParams["status"];
        if (dueFromParam) params.dueFrom = dueFromParam;
        if (dueToParam) params.dueTo = dueToParam;
        if (sortByParam)
          params.sortBy = sortByParam as GetTasksParams["sortBy"];
        if (searchParam) params.search = searchParam;
        if (yearParam) params.year = Number(yearParam);
        params.page = pageParam;
        params.limit = TASKS_PAGE_SIZE;

        const result = await taskService.getTasks(params);
        if (result.success) {
          setTasks((result.data?.rows || result.data || []) as TaskItem[]);
          setPagination(
            result.data?.pagination || {
              page: pageParam,
              limit: TASKS_PAGE_SIZE,
              totalCount: 0,
              totalPages: 1,
            },
          );
        }
      } catch (error) {
        showToast(t("tasks.fetchError", "Error loading tasks"), "error");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      courseIdParam,
      statusParam,
      dueFromParam,
      dueToParam,
      sortByParam,
      searchParam,
      yearParam,
      pageParam,
      t,
    ],
  );

  const fetchCourses = async () => {
    try {
      const result = await coursesService.getCourses();
      if (result.success) {
        const list = Array.isArray(result.data)
          ? result.data
          : result.data?.courses || [];
        setCourses(list as CourseOption[]);
      }
    } catch (error) {
      console.error("Error fetching courses:", error);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    if (isDoctor) fetchCourses();
  }, [isDoctor]);

  // Selection Logic
  const allFilteredIds = useMemo(
    () => (Array.isArray(tasks) ? tasks : []).map((t) => t.id),
    [tasks],
  );
  const isAllSelected =
    allFilteredIds.length > 0 &&
    allFilteredIds.every((id) => selectedIds.has(id));

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allFilteredIds));
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

  const handleBulkClear = () => setSelectedIds(new Set());

  const handleBulkExport = () => {
    const selectedList = (Array.isArray(tasks) ? tasks : []).filter((t) =>
      selectedIds.has(t.id),
    );
    if (!selectedList.length) return;
    const exportData = selectedList.map((t) => ({
      ID: t.id,
      Title: t.title,
      Course: t.course?.name || t.course?.courseCode || "N/A",
      DueDate: t.dueDate,
      MaxScore: t.maxScore,
      Description: t.description || "",
    }));
    downloadCsv(
      exportData,
      `assignments_selected_${new Date().toISOString().split("T")[0]}.csv`,
    );
    showToast(
      isRTL
        ? "تم تصدير التكليفات المحددة بنجاح"
        : "Exported selected assignments successfully",
      "success",
    );
  };

  const onCreateSubmit = async (data: CreateTaskFormData) => {
    try {
      let result;
      if (editingTask) {
        result = await taskService.updateTask(
          editingTask.id,
          data,
        );
        if (result.success) {
          showToast(
            t("tasks.updateSuccess", "Task updated successfully"),
            "success",
          );
          setShowCreateModal(false);
          setEditingTask(null);
          fetchTasks(true);
        } else {
          showToast(
            result.message || t("tasks.updateError", "Error updating task"),
            "error",
          );
        }
      } else {
        result = await taskService.createTask(
          data,
        );
        if (result.success) {
          showToast(
            t("tasks.createSuccess", "Task created successfully"),
            "success",
          );
          setShowCreateModal(false);
          fetchTasks(true);
        } else {
          showToast(
            result.message || t("tasks.createError", "Error creating task"),
            "error",
          );
        }
      }
    } catch (error: any) {
      const msg =
        error.response?.data?.message ||
        (editingTask
          ? t("tasks.updateError", "Error updating task")
          : t("tasks.createError", "Error creating task"));
      showToast(msg, "error");
    }
  };

  const onSubmitTask = async (data: SubmitTaskFormData) => {
    if (!selectedTask) return;
    try {
      const result = await taskService.submitTask(
        selectedTask.id,
        data,
      );
      if (result.success) {
        showToast(
          t("tasks.submitSuccess", "Task submitted successfully"),
          "success",
        );
        setShowSubmitModal(false);
        fetchTasks(true);
      } else {
        showToast(
          result.message || t("tasks.submitError", "Error submitting task"),
          "error",
        );
      }
    } catch (error: any) {
      showToast(
        error.response?.data?.message ||
          t("tasks.submitError", "Error submitting task"),
        "error",
      );
    }
  };

  const onConfirmDelete = async (force = false) => {
    if (!selectedTask) return;
    try {
      const result = await taskService.deleteTask(selectedTask.id, force);
      if (result.success) {
        showToast(
          t("tasks.deleteSuccess", "Task deleted successfully"),
          "success",
        );
        setShowDeleteConfirm(false);
        setSelectedTask(null);
        fetchTasks(true);
      } else {
        showToast(
          result.message || t("tasks.deleteError", "Error deleting task"),
          "error",
        );
      }
    } catch (e: any) {
      showToast(
        e.response?.data?.message ||
          t("tasks.deleteError", "Error deleting task"),
        "error",
      );
    }
  };

  const locale = i18n.language === "ar" ? "ar-EG" : "en-US";

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

  const renderStudentStatusBadge = (task: TaskItem) => {
    const my = task.mySubmission;
    if (my && my.score != null) {
      return (
        <Badge className="bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 font-bold text-xs">
          {t("tasks.statusGraded", {
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
          {t("tasks.statusSubmitted", "Submitted")}
        </Badge>
      );
    }
    if (isOverdue(task.dueDate)) {
      return (
        <Badge className="bg-rose-100 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 font-bold text-xs">
          {t("tasks.statusOverdue", "Overdue")}
        </Badge>
      );
    }
    return (
      <Badge className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs">
        {t("tasks.statusNotSubmitted", "Not Submitted")}
      </Badge>
    );
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {toast && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs font-semibold ${
            toast.type === "error"
              ? "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800"
              : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
          }`}
        >
          <div className="flex items-center gap-2">
            {toast.type === "error" ? (
              <AlertCircle size={15} />
            ) : (
              <CheckCircle size={15} />
            )}
            <span>{toast.message}</span>
          </div>
          <button
            onClick={() => setToast(null)}
            className="p-1 hover:opacity-75 cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* 1. SLIM PAGE HEADER */}
      <div className="page-header-row">
        <div>
          <h1 className="page-title">
            {t("tasks.title", "Tasks & Assignments")}
          </h1>
          <p className="page-subtitle">
            {isDoctor
              ? t(
                  "tasks.subtitleDoctor",
                  "Manage student assignments, grading, and submissions.",
                )
              : t(
                  "tasks.subtitleStudent",
                  "View course assignments and submit your deliverables.",
                )}
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
            <RotateCw size={13} className={refreshing ? "animate-spin" : ""} />
            <span>{t("common.refresh", "Refresh")}</span>
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
              <span>{t("tasks.createTask", "Create Assignment")}</span>
            </Button>
          )}
        </div>
      </div>

      {/* 2. EXECUTIVE KPI OVERVIEW BADGES */}
      <TasksKpiStats
        total={kpis.total}
        active={kpis.active}
        submissionsCount={
          isDoctor
            ? kpis.totalSubs
            : tasks.filter((task) => task.mySubmission).length
        }
        overdue={kpis.overdue}
        isDoctor={Boolean(isDoctor)}
        isRTL={isRTL}
      />

      {/* 3. UNIFIED COMPACT FILTER TOOLBAR */}
      <TasksFilterBar
        searchInput={searchInput}
        onSearchInputChange={setSearchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        courseIdParam={courseIdParam}
        statusParam={statusParam}
        yearParam={yearParam}
        sortByParam={sortByParam}
        dueFromParam={dueFromParam}
        dueToParam={dueToParam}
        updateParam={updateParam}
        clearAllFilters={clearAllFilters}
        hasActiveFilters={hasActiveFilters}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        courses={courses}
        isDoctor={Boolean(isDoctor)}
        totalShowing={tasks.length}
        isRTL={isRTL}
      />

      {/* 4. MAIN VIEW: REFINED COMPACT CARDS OR HIGH-DENSITY TABLE */}
      {loading ? (
        <div className="flex flex-col items-center justify-center h-48 gap-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
          <Loader2 className="animate-spin text-brand-primary-500" size={32} />
          <span className="text-xs text-slate-400 font-medium">
            {t("common.loading", "Loading...")}
          </span>
        </div>
      ) : tasks.length === 0 ? (
        <div className="p-8 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
          <EmptyState
            icon={<ClipboardList size={36} className="text-slate-400" />}
            title={t("tasks.noTasks", "No assignments match your criteria")}
            subtitle={
              isDoctor
                ? t(
                    "tasks.subtitleDoctor",
                    "Manage student assignments, grading, and submissions.",
                  )
                : t(
                    "tasks.subtitleStudent",
                    "View course assignments and submit your deliverables.",
                  )
            }
            action={
              isDoctor
                ? {
                    label: t("tasks.createTask", "Create Assignment"),
                    onClick: () => setShowCreateModal(true),
                  }
                : hasActiveFilters
                  ? {
                      label: isRTL ? "إعادة ضبط الفلاتر" : "Reset Filters",
                      onClick: clearAllFilters,
                    }
                  : undefined
            }
          />
        </div>
      ) : viewMode === "cards" ? (
        <TasksCards
          tasks={tasks}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          isDoctor={Boolean(isDoctor)}
          isStudent={Boolean(isStudent)}
          isRTL={isRTL}
          locale={locale}
          isOverdue={isOverdue}
          onGrade={(task) => {
            setSelectedTask(task);
            setShowSubmissionsModal(true);
          }}
          onEdit={(task) => {
            setEditingTask(task);
            setShowCreateModal(true);
          }}
          onDelete={(task) => {
            setSelectedTask(task);
            setShowDeleteConfirm(true);
          }}
          onSubmit={(task) => {
            setSelectedTask(task);
            setShowSubmitModal(true);
          }}
          renderStudentStatusBadge={renderStudentStatusBadge}
        />
      ) : (
        <TasksTable
          tasks={tasks}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          onSelectAll={handleToggleSelectAll}
          allSelected={isAllSelected}
          isDoctor={Boolean(isDoctor)}
          isRTL={isRTL}
          locale={locale}
          isOverdue={isOverdue}
          onGrade={(task) => {
            setSelectedTask(task);
            setShowSubmissionsModal(true);
          }}
          onEdit={(task) => {
            setEditingTask(task);
            setShowCreateModal(true);
          }}
          onDelete={(task) => {
            setSelectedTask(task);
            setShowDeleteConfirm(true);
          }}
          onSubmit={(task) => {
            setSelectedTask(task);
            setShowSubmitModal(true);
          }}
          renderStudentStatusBadge={renderStudentStatusBadge}
        />
      )}

      {!loading && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800">
          <span className="text-slate-500 dark:text-slate-400">
            {isRTL
              ? `صفحة ${pagination.page} من ${pagination.totalPages} — ${pagination.totalCount} تكليف`
              : `Page ${pagination.page} of ${pagination.totalPages} — ${pagination.totalCount} assignments`}
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => updateParam("page", String(pagination.page - 1))}
            >
              {isRTL ? "السابق" : "Previous"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => updateParam("page", String(pagination.page + 1))}
            >
              {isRTL ? "التالي" : "Next"}
            </Button>
          </div>
        </div>
      )}

      {/* 5. MODALS */}
      <TaskModal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setEditingTask(null);
        }}
        editingTask={editingTask}
        courses={courses}
        onSubmit={onCreateSubmit}
      />

      <TaskSubmitModal
        isOpen={showSubmitModal}
        onClose={() => setShowSubmitModal(false)}
        task={selectedTask}
        onSubmit={onSubmitTask}
      />

      <SubmissionsGradingModal
        isOpen={showSubmissionsModal}
        onClose={() => {
          setShowSubmissionsModal(false);
          fetchTasks(true);
        }}
        task={selectedTask}
      />

      <TaskDeleteModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        task={selectedTask}
        onConfirmDelete={onConfirmDelete}
      />

      {/* Floating Bulk Action Toolbar */}
      <BulkActionToolbar
        selectedCount={selectedIds.size}
        onClear={handleBulkClear}
        onExport={handleBulkExport}
      />
    </div>
  );
}

export default TasksList;
