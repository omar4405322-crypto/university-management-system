import React from "react";
import { useTranslation } from "react-i18next";
import {
  Clock,
  CheckSquare,
  Square,
  Eye,
  Pencil,
  Trash2,
  FileUp,
} from "lucide-react";
import Button from "../../../components/ui/button";
import type { TaskItem } from "../types";

export interface TasksCardsProps {
  tasks: TaskItem[];
  selectedIds: Set<string | number>;
  onToggleSelect: (id: string | number) => void;
  isDoctor: boolean;
  isStudent: boolean;
  isRTL: boolean;
  locale: string;
  isOverdue: (date: string) => boolean;
  onGrade: (task: TaskItem) => void;
  onEdit: (task: TaskItem) => void;
  onDelete: (task: TaskItem) => void;
  onSubmit: (task: TaskItem) => void;
  renderStudentStatusBadge: (task: TaskItem) => React.ReactNode;
}

export const TasksCards: React.FC<TasksCardsProps> = ({
  tasks,
  selectedIds,
  onToggleSelect,
  isDoctor,
  isStudent,
  isRTL,
  locale,
  isOverdue,
  onGrade,
  onEdit,
  onDelete,
  onSubmit,
  renderStudentStatusBadge,
}) => {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
      {tasks.map((task) => {
        const overdue = isOverdue(task.dueDate);
        const subsCount = task._count?.submissions || 0;
        const totalEnrolled = task.course?._count?.enrollments || 30;
        const progressPercent = Math.min(
          100,
          Math.round((subsCount / (totalEnrolled || 1)) * 100),
        );
        const isSelected = selectedIds.has(task.id);
        const hasSubmission = Boolean(
          task.mySubmission ||
            (task.submissions && task.submissions.length > 0),
        );

        return (
          <div
            key={task.id}
            className={`rounded-2xl p-4 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between ${
              isSelected
                ? "border-2 border-brand-primary-500 ring-2 ring-brand-primary-500/20 bg-brand-primary-500/[0.02] dark:bg-brand-primary-500/[0.04]"
                : "bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700/80 hover:border-brand-primary-300 dark:hover:border-brand-primary-600"
            }`}
          >
            <div>
              {/* Top Badges Row */}
              <div className="flex items-center justify-between gap-1.5 mb-2">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onToggleSelect(task.id)}
                    className="text-slate-400 hover:text-brand-primary-600 focus:outline-none transition-colors p-0.5 cursor-pointer"
                  >
                    {isSelected ? (
                      <CheckSquare
                        size={16}
                        className="text-brand-primary-600"
                      />
                    ) : (
                      <Square size={16} />
                    )}
                  </button>
                  <span className="font-mono text-xs font-bold text-brand-primary-700 dark:text-brand-primary-300 bg-brand-primary-50 dark:bg-brand-primary-950/50 px-2 py-0.5 rounded-md border border-brand-primary-200/40">
                    {task.course?.courseCode}
                  </span>
                </div>

                <div className="flex items-center gap-1 text-[10px] font-semibold">
                  <span
                    className={`px-2 py-0.5 rounded-md flex items-center gap-1 ${
                      overdue
                        ? "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200/40"
                        : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200/40"
                    }`}
                  >
                    <Clock size={11} />
                    <span>
                      {new Date(task.dueDate).toLocaleDateString(locale, {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </span>

                  <span className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded-md font-mono">
                    {task.maxScore} {isRTL ? "نقطة" : "pts"}
                  </span>
                </div>
              </div>

              {/* Course Full Name */}
              <div className="text-[11px] text-slate-400 font-medium truncate mb-1">
                {task.course?.name}
              </div>

              {/* Task Title */}
              <h2 className="text-sm font-bold text-slate-900 dark:text-white leading-snug mb-1 line-clamp-1">
                {task.title}
              </h2>

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
                      {t("tasks.submissions", "Submissions")}:
                    </span>
                    <span className="font-mono font-bold text-brand-primary-600 dark:text-brand-primary-400">
                      {subsCount} {isRTL ? "تسليم" : "submitted"}
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
                    onClick={() => onGrade(task)}
                    className="flex-1 h-8 bg-brand-primary-600 hover:bg-brand-primary-700 text-white rounded-lg text-xs font-bold gap-1.5 shadow-2xs cursor-pointer"
                  >
                    <Eye size={13} />
                    <span>{t("tasks.viewSubmissionsAction", "View & Grade")}</span>
                  </Button>

                  <button
                    onClick={() => onEdit(task)}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
                    title={t("common.edit", "Edit")}
                  >
                    <Pencil size={13} />
                  </button>

                  <button
                    onClick={() => onDelete(task)}
                    className="p-1.5 rounded-lg border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                    title={t("common.delete", "Delete")}
                  >
                    <Trash2 size={13} />
                  </button>
                </>
              ) : (
                /* Student Submit Action */
                <Button
                  size="sm"
                  onClick={() => onSubmit(task)}
                  className={`w-full h-8 rounded-lg text-xs font-bold gap-1.5 cursor-pointer shadow-2xs ${
                    overdue
                      ? "bg-rose-600 hover:bg-rose-700 text-white"
                      : "bg-brand-primary-600 hover:bg-brand-primary-700 text-white"
                  }`}
                >
                  <FileUp size={13} />
                  <span>
                    {hasSubmission
                      ? t("tasks.resubmitTask", "Resubmit Assignment")
                      : t("tasks.submitTask", "Submit Assignment")}
                  </span>
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
