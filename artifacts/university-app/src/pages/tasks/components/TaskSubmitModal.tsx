import React, { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Send, Clock } from "lucide-react";
import { MAX_TASK_NOTES_LENGTH, isTaskPastDue } from "../../../utils/taskDeadline.utils";
import { isApprovedHostname } from "../../../utils/taskSubmissionUrl";
import Modal from "../../../components/ui/Modal";
import Button from "../../../components/ui/button";
import type { TaskItem, SubmitTaskFormData } from "../types";

export interface TaskSubmitModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: TaskItem | null;
  onSubmit: (data: SubmitTaskFormData) => Promise<void>;
}

export const TaskSubmitModal: React.FC<TaskSubmitModalProps> = ({
  isOpen,
  onClose,
  task,
  onSubmit,
}) => {
  const { t } = useTranslation();

  const submitSchema = useMemo(
    () =>
      z.object({
        notes: z.string().max(MAX_TASK_NOTES_LENGTH, t("tasks.notesTooLong", { max: MAX_TASK_NOTES_LENGTH })).optional(),
        fileUrl: z
          .string()
          .max(500, t("tasks.fileUrlTooLong", "Task submission link is too long"))
          .optional()
          .refine(
            (val) => {
              if (!val || !val.trim()) return true;
              try {
                const parsed = new URL(val.trim());
                return (
                  parsed.protocol === "https:" &&
                  isApprovedHostname(parsed.hostname.toLowerCase().replace(/\.$/, ""))
                );
              } catch {
                return false;
              }
            },
            (val) => {
              if (val) {
                try {
                  const parsed = new URL(val.trim());
                  if (parsed.protocol !== "https:") {
                    return {
                      message: t("tasks.fileUrlMustBeHttps", "Task submission link must use HTTPS"),
                    };
                  }
                } catch {
                  /* ignore */
                }
              }
              return {
                message: t("tasks.invalidUrl", "Please enter a valid submission link"),
              };
            }
          ),

      }).superRefine((data, ctx) => {
        const hasNotes = Boolean(data.notes && data.notes.trim().length > 0);
        const hasUrl = Boolean(data.fileUrl && data.fileUrl.trim().length > 0);
        if (!hasNotes && !hasUrl) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: t(
              "tasks.submissionContentRequired",
              "Submission must include either a valid link or notes"
            ),
            path: ["fileUrl"],
          });
        }
      }),
    [t],
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SubmitTaskFormData>({
    resolver: zodResolver(submitSchema),
    defaultValues: { notes: "", fileUrl: "" },
  });

  const isOverdue = isTaskPastDue(task?.dueDate);

  useEffect(() => {
    if (isOpen) {
      reset({ notes: "", fileUrl: "" });
    }
  }, [isOpen, reset]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("tasks.submitTask", "Submit Assignment")}
      subtitle={task?.title}
      size="md"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 pt-1">
        {isOverdue && (
          <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
            <Clock size={14} className="shrink-0" />
            <span>{t("tasks.deadlinePassed", "The deadline for this task has passed")}</span>
  




        </div>
        )}
        <div>
          <label htmlFor="submit-file-url" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            {t(
              "tasks.fileUrlLabel",
              "Deliverable Link (Google Drive / GitHub / OneDrive)"
            )}
  
          </label>
          <input
            id="submit-file-url"
            aria-required="true"
            aria-invalid={!!errors.fileUrl}
            aria-describedby={errors.fileUrl ? "submit-file-url-error" : undefined}
            type="url"
            className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-1.5 focus:ring-brand-primary-500 outline-none bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-mono"
            maxLength={500}
            placeholder="https://drive.google.com/..."
            {...register("fileUrl")} />

          {errors.fileUrl && (
            <p id="submit-file-url-error" className="text-rose-500 text-[11px] mt-0.5" role="alert">
              {errors.fileUrl.message}</p>)}







        </div>

        <div>
          <label htmlFor="submit-notes" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            {t(
              "tasks.submissionNotes",
              "Additional Notes for Instructor (Optional)"
            )}
  
          </label>
          <textarea
            id="submit-notes"
            rows={3}
            className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-1.5 focus:ring-brand-primary-500 outline-none bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100"
            placeholder={t(
              "tasks.submissionNotes",
              "Additional Notes for Instructor (Optional)"
            )}
  
            maxLength={MAX_TASK_NOTES_LENGTH}
            {...register("notes")} />

          {errors.notes && (
            <p id="submit-notes-error" className="text-rose-500 text-[11px] mt-0.5" role="alert">
              {errors.notes.message}
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
            disabled={isSubmitting || isOverdue}
            className="bg-brand-primary-600 hover:bg-brand-primary-700 text-white text-xs font-bold gap-1"
          >
            {isSubmitting ? (
              t("common.loading", "Loading...")
            ) : (
              <>
                <Send size={13} className="rtl:-scale-x-100" />
                <span>{t("common.submit", "Submit")}</span>
              </>
            )}
  
          </Button>





        </div>
      </form>
    </Modal>
  );
};
