import React, { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Modal from "../../../components/ui/Modal";
import Button from "../../../components/ui/button";
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
          .min(1, t("tasks.titleRequired", "Task title is required")),
        description: z
          .string()
          .min(1, t("tasks.descriptionRequired", "Task description is required")),
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
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            {t("tasks.taskTitle", "Assignment Title")}
          </label>
          <input
            type="text"
            className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-1.5 focus:ring-brand-primary-500 outline-none bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100"
            placeholder={t("tasks.taskTitle", "Assignment Title")}
            {...register("title")}
          />
          {errors.title && (
            <p className="text-rose-500 text-[11px] mt-0.5">
              {errors.title.message}
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            {t("tasks.taskDescription", "Assignment Instructions & Description")}
          </label>
          <textarea
            rows={3}
            className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-1.5 focus:ring-brand-primary-500 outline-none bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100"
            placeholder={t(
              "tasks.taskDescription",
              "Assignment Instructions & Description",
            )}
            {...register("description")}
          />
          {errors.description && (
            <p className="text-rose-500 text-[11px] mt-0.5">
              {errors.description.message}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t("nav.courses", "Courses")}
            </label>
            <select
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
              <p className="text-rose-500 text-[11px] mt-0.5">
                {errors.courseId.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t("tasks.maxPoints", "Total Points")}
            </label>
            <input
              type="number"
              className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-1.5 focus:ring-brand-primary-500 outline-none bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100"
              {...register("maxScore")}
            />
            {errors.maxScore && (
              <p className="text-rose-500 text-[11px] mt-0.5">
                {errors.maxScore.message}
              </p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            {t("tasks.due", "Submission Deadline")}
          </label>
          <input
            type="datetime-local"
            className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-1.5 focus:ring-brand-primary-500 outline-none bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100"
            {...register("dueDate")}
          />
          {errors.dueDate && (
            <p className="text-rose-500 text-[11px] mt-0.5">
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
