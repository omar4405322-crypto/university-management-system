import React, { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Modal from "../../../components/ui/Modal";
import Button from "../../../components/ui/button";
import { MAX_TASK_TITLE_LENGTH, MAX_TASK_DESCRIPTION_LENGTH } from "../../../utils/taskDeadline.utils";
import type { TaskItem, CourseOption, CreateTaskFormData } from "../types";

export interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingTask: TaskItem | null;
  courses: CourseOption[];
  onSubmit: (data: CreateTaskFormData) => Promise<void>;
}

export const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  onClose,
  editingTask,
  courses,
  onSubmit,
}) => {
  const { t } = useTranslation();

  const createSchema = useMemo(
    () =>
      z.object({
        title: z
          .string()
          .min(1, t("tasks.titleRequired", "Task title is required"))
          .max(MAX_TASK_TITLE_LENGTH, t("tasks.titleTooLong", { max: MAX_TASK_TITLE_LENGTH })),
        description: z
          .string()
          .min(1, t("tasks.descriptionRequired", "Task description is required"))
          .max(MAX_TASK_DESCRIPTION_LENGTH, t("tasks.descriptionTooLong", { max: MAX_TASK_DESCRIPTION_LENGTH })),
        courseId: z
          .string()
          .min(1, t("tasks.courseRequired", "Please select a course")),
        dueDate: z
          .string()
          .min(1, t("tasks.dueDateRequired", "Due date is required")),
        maxScore: z.coerce
          .number()
          .min(1, t("tasks.maxScoreMin", "Total points must be at least 1")),
      }),
    [t],
  );

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateTaskFormData>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      title: "",
      description: "",
      courseId: "",
      dueDate: "",
      maxScore: 100,
    },
  });

  useEffect(() => {
    if (isOpen) {
      if (editingTask) {
        const date = new Date(editingTask.dueDate);
        const iso = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16);
        setValue("title", editingTask.title);
        setValue("description", editingTask.description);
        setValue("courseId", String(editingTask.courseId));
        setValue("dueDate", iso);
        setValue("maxScore", editingTask.maxScore);
      } else {
        reset({
          title: "",
          description: "",
          courseId: "",
          dueDate: "",
          maxScore: 100,
        });
      }
    }
  }, [isOpen, reset, editingTask, setValue]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        editingTask
          ? t("tasks.editTask", "Edit Assignment")
          : t("tasks.createTask", "Create Assignment")
      }
      subtitle={
        editingTask
          ? editingTask.title
          : t(
              "tasks.subtitleDoctor",
              "Manage student assignments, grading, and submissions.",
            )
      }
      size="md"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 pt-1">
        <div>
          <label htmlFor="task-title" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            {t("tasks.taskTitle", "Assignment Title")} <span className="text-rose-500">*</span>
          </label>
          <input
            id="task-title"
            aria-required="true"
            aria-invalid={!!errors.title}
            aria-describedby={errors.title ? "task-title-error" : undefined}
            type="text"
            className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-1.5 focus:ring-brand-primary-500 outline-none bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100"
            maxLength={MAX_TASK_TITLE_LENGTH}
            placeholder={t("tasks.taskTitle", "Assignment Title")}
            {...register("title")}
          />
          {errors.title && (
            <p id="task-title-error" className="text-rose-500 text-[11px] mt-0.5" role="alert">
              {errors.title.message}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="task-description" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            {t("tasks.taskDescription", "Assignment Instructions & Description")} <span className="text-rose-500">*</span>
          </label>
          <textarea
            id="task-description"
            aria-required="true"
            aria-invalid={!!errors.description}
            aria-describedby={errors.description ? "task-description-error" : undefined}
            rows={3}
            className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-1.5 focus:ring-brand-primary-500 outline-none bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100"
            placeholder={t(
              "tasks.taskDescription",
              "Assignment Instructions & Description",
            )}
            maxLength={MAX_TASK_DESCRIPTION_LENGTH}
            {...register("description")}
          />
          {errors.description && (
            <p id="task-description-error" className="text-rose-500 text-[11px] mt-0.5" role="alert">
              {errors.description.message}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="task-course" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t("nav.courses", "Courses")} <span className="text-rose-500">*</span>
            </label>
            <select
              id="task-course"
              aria-required="true"
              aria-invalid={!!errors.courseId}
              aria-describedby={errors.courseId ? "task-course-error" : undefined}
              className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-1.5 focus:ring-brand-primary-500 outline-none bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 cursor-pointer"
              disabled={Boolean(editingTask)}
              {...register("courseId")}
            >
              <option value="">
                {t("tasks.selectCourse", "Select Course")}
              </option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.courseCode} - {c.name}
                </option>
              ))}
            </select>
            {errors.courseId && (
              <p id="task-course-error" className="text-rose-500 text-[11px] mt-0.5" role="alert">
                {errors.courseId.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="task-max-points" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t("tasks.maxPoints", "Total Points")} <span className="text-rose-500">*</span>
            </label>
            <input
              id="task-max-points"
              aria-required="true"
              aria-invalid={!!errors.maxScore}
              aria-describedby={errors.maxScore ? "task-max-points-error" : undefined}
              type="number"
              className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-1.5 focus:ring-brand-primary-500 outline-none bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100"
              {...register("maxScore")}
            />
            {errors.maxScore && (
              <p id="task-max-points-error" className="text-rose-500 text-[11px] mt-0.5" role="alert">
                {errors.maxScore.message}
              </p>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="task-due-date" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            {t("tasks.due", "Submission Deadline")} <span className="text-rose-500">*</span>
          </label>
          <input
            id="task-due-date"
            aria-required="true"
            aria-invalid={!!errors.dueDate}
            aria-describedby={errors.dueDate ? "task-due-date-error" : undefined}
            type="datetime-local"
            className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-1.5 focus:ring-brand-primary-500 outline-none bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100"
            {...register("dueDate")}
          />
          {errors.dueDate && (
            <p id="task-due-date-error" className="text-rose-500 text-[11px] mt-0.5" role="alert">
              {errors.dueDate.message}
            </p>
          )}
        </div>

        <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-xs font-semibold"
          >
            {t("common.cancel", "Cancel")}
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={isSubmitting}
            className="bg-brand-primary-600 hover:bg-brand-primary-700 text-white text-xs font-bold"
          >
            {isSubmitting
              ? t("common.loading", "Loading...")
              : editingTask
                ? t("tasks.editTask", "Edit Assignment")
                : t("tasks.createTask", "Create Assignment")}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
