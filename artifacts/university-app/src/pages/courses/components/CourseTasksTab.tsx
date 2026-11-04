import React from "react";
import {
  ClipboardList,
  Plus,
  Clock,
  CheckCircle,
  Download,
  FileUp,
  MessageSquare,
} from "lucide-react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import Button from "../../../components/ui/button";
import Badge from "../../../components/ui/badge";
import { isTaskPastDue } from "../../../utils/taskDeadline.utils";
import taskService from "../../../services/task.service";
import { formatTaskFileSize } from "../../../utils/taskSubmissionUrl";
import type { CourseTask, CourseStudentSubmission } from "../types";

export interface CourseTasksTabProps {
  tasks: CourseTask[];
  courseMySubmissions: Record<number, CourseStudentSubmission | null | undefined>;
  isStudent: boolean;
  canCreateTask: boolean;
  formatTaskDate: (dateStr: string) => string;
  onCreateTask: () => void;
  onSubmitTask: (task: CourseTask) => void;
  onViewSubmissions: (task: CourseTask) => void;
}

export const CourseTasksTab: React.FC<CourseTasksTabProps> = ({
  tasks,
  courseMySubmissions,
  isStudent,
  canCreateTask,
  formatTaskDate,
  onCreateTask,
  onSubmitTask,
  onViewSubmissions,
}) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-surface-card p-4 rounded-2xl border border-brand-border shadow-sm">
        <div>
          <h3 className="font-black text-lg text-brand-text-primary dark:text-brand-text-main flex items-center gap-2">
            <ClipboardList
              className="text-amber-600 dark:text-amber-400"
              size={20}
            />
            {t("tasks.title", "Tasks & Assignments")}
          </h3>
          <p className="text-xs text-brand-text-muted mt-1">
            {t("tasks.subtitleDoctor", "Manage student assignments, grading, and submissions.")}
          </p>
        </div>

        {canCreateTask && (
          <Button
            onClick={onCreateTask}
            variant="primary"
            className="flex items-center gap-2 text-xs py-2 px-4 shadow-md shadow-brand-primary-500/20"
          >
            <Plus size={16} />
            <span>{t("tasks.createTask", "Create Assignment")}</span>
          </Button>
        )}
      </div>

      {tasks && tasks.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tasks.map((task) => {
            const isOverdue =
              isTaskPastDue(task.dueDate);
            const my = courseMySubmissions[task.id];

            return (
              <div
                key={task.id}
                className="bg-surface-card border border-brand-border p-5 rounded-2xl shadow-card flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold shrink-0 border border-amber-200/50">
                        <ClipboardList size={20} />
                      </div>
                      <div>
                        <h4 className="font-bold text-brand-text-primary dark:text-brand-text-main text-base">
                          {task.title}
                        </h4>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-brand-text-muted">
                          {task.maxScore
                            ? `${task.maxScore} ${t("tasks.maxPoints", "Total Points")}`
                            : t("tasks.academicTask", "Academic Assignment")}
                        </span>
                      </div>
                    </div>

                    <Badge
                      variant={
                        my && my.score != null
                          ? "success"
                          : my
                            ? "primary"
                            : isOverdue
                              ? "danger"
                              : "warning"
                      }
                      className="text-[10px] font-black"
                    >
                      {my && my.score != null
                        ? t("tasks.statusGraded", {
                            score: my.score,
                            maxScore: task.maxScore,
                          })
                        : my
                          ? t("tasks.statusSubmitted")
                          : isOverdue
                            ? t("tasks.statusOverdue")
                            : t("tasks.statusNotSubmitted", "Not Submitted")}
                    </Badge>
                  </div>

                  {task.description && (
                    <p className="text-xs text-brand-text-sub font-medium leading-relaxed bg-surface-subtle p-3 rounded-xl border border-brand-border">
                      {task.description}
                    </p>
                  )}

                  {isStudent && my && (
                    <div className="space-y-1">
                      <div className="text-[9px] font-bold text-brand-text-muted">
                        {my.score != null
                          ? t("tasks.statusGraded", {
                              score: my.score,
                              maxScore: task.maxScore,
                            })
                          : t("tasks.submittedAt", {
                              date: formatTaskDate(my.submittedAt),
                            })}
                      </div>
                      {my.fileName && (
                        <div className="mt-1 flex items-center justify-between gap-2 text-xs bg-surface-subtle p-2 rounded-lg border border-brand-border">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <FileUp size={14} className="text-brand-primary-500 shrink-0" />
                            <span className="truncate font-semibold text-brand-text-primary dark:text-brand-text-main text-[11px]" title={my.fileName}>
                              {my.fileName}
                            </span>
                            {my.fileSize != null && (
                              <span className="text-[10px] text-brand-text-muted shrink-0">
                                ({formatTaskFileSize(my.fileSize)})
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await taskService.downloadSubmission(task.id, my.id, my.fileName || undefined);
                              } catch (err: unknown) {
                                const axiosErr = err as { status?: number; message?: string };
                                const msg =
                                  axiosErr?.status === 404
                                    ? t('tasks.downloadNotFound', 'Submission file not found')
                                    : axiosErr?.status === 403
                                    ? t('errors.forbidden', 'You do not have permission to perform this action.')
                                    : axiosErr?.message || t('tasks.downloadFailed', 'Failed to download submission');
                                toast.error(msg);
                              }
                            }}
                            aria-label={t('tasks.downloadSubmissionAria', { name: my.fileName, defaultValue: `Download ${my.fileName}` })}
                            className="text-xs text-brand-primary-500 hover:underline font-bold inline-flex items-center gap-1 shrink-0"
                          >
                            <Download size={13} />
                            <span>{t('tasks.downloadSubmission', 'Download')}</span>
                          </button>
                        </div>
                      )}
                      {my.feedback && (
                        <div className="text-[10px] text-brand-text-sub bg-surface-subtle p-2 rounded-lg leading-relaxed flex items-start gap-1">
                          <MessageSquare
                            size={12}
                            className="shrink-0 mt-0.5"
                          />
                          <span className="line-clamp-3">
                            {my.feedback}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-col border-t border-brand-border pt-3 text-xs font-medium gap-3">
                  <div className="flex items-center justify-between text-brand-text-muted gap-2">
                    <div className="flex items-center gap-1.5">
                      <Clock
                        size={14}
                        className={
                          isOverdue ? "text-red-500" : "text-amber-500"
                        }
                      />
                      <span>
                        {t("tasks.due", "Submission Deadline")}:{" "}
                        {task.dueDate
                          ? formatTaskDate(task.dueDate)
                          : t("common.unspecified", "Unspecified")}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    {isStudent ? (
                      isOverdue ? (
                        <Button
                          disabled
                          aria-disabled="true"
                          className="text-[10px] py-1.5 px-3 opacity-60 w-full cursor-not-allowed"
                        >
                          <Clock size={14} className="me-1" />
                          {t("tasks.statusOverdue", "Overdue")}
                        </Button>
                      ) : my && my.score != null ? (
                        <Button
                          disabled
                          aria-disabled="true"
                          className="text-[10px] py-1.5 px-3 opacity-60 w-full cursor-not-allowed"
                        >
                          <CheckCircle size={14} className="me-1" />
                          {t("tasks.statusGraded", {
                            score: my.score,
                            maxScore: task.maxScore,
                          })}
                        </Button>
                      ) : my ? (
                        <Button
                          onClick={() => onSubmitTask(task)}
                          className="text-[10px] py-1.5 px-3 w-full"
                        >
                          <FileUp size={14} className="me-1" />
                          {t("tasks.resubmitTask", "Resubmit Assignment")}
                        </Button>
                      ) : (
                        <Button
                          onClick={() => onSubmitTask(task)}
                          className="text-[10px] py-1.5 px-3 w-full"
                        >
                          <FileUp size={14} className="me-1" />
                          {t("tasks.submitTask", "Submit Assignment")}
                        </Button>
                      )
                    ) : (
                      <Button
                        variant="outline"
                        onClick={() => onViewSubmissions(task)}
                        className="text-[10px] py-1.5 px-3 w-full"
                      >
                        <CheckCircle size={14} className="me-1" />
                        {t("tasks.viewSubmissions", "View Submissions")}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 bg-surface-card rounded-3xl border border-dashed border-brand-border p-8">
          <ClipboardList
            size={48}
            className="mx-auto text-brand-text-muted opacity-40 mb-3"
          />
          <h3 className="text-base font-bold text-brand-text-primary dark:text-brand-text-main">
            {t("tasks.noCourseTasks", "No assignments required for this course currently")}
          </h3>
          <p className="text-xs text-brand-text-muted mt-1">
            {t("tasks.noCourseTasksDesc", "When a new assignment is added by the instructor, it will appear here for students to submit.")}
          </p>
        </div>
      )}
    </div>
  );
};
/* end */
