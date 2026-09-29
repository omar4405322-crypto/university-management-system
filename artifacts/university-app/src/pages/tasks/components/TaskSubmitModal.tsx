import React, { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Send } from "lucide-react";
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
        notes: z.string().optional(),
        fileUrl: z
          .string()
          .url(t("tasks.invalidUrl", "Please enter a valid submission link"))
          .min(1, t("tasks.fileUrlRequired", "Submission file URL is required")),
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
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            {t(
              "tasks.fileUrlLabel",
              "Deliverable Link (Google Drive / GitHub / OneDrive)",
            )}
          </label>
          <input
            type="url"
            className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-1.5 focus:ring-brand-primary-500 outline-none bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-mono"
            placeholder="https://drive.google.com/..."
            {...register("fileUrl")}
          />
          {errors.fileUrl && (
            <p className="text-rose-500 text-[11px] mt-0.5">
              {errors.fileUrl.message}
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            {t(
              "tasks.submissionNotes",
              "Additional Notes for Instructor (Optional)",
            )}
          </label>
          <textarea
            rows={3}
            className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-1.5 focus:ring-brand-primary-500 outline-none bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100"
            placeholder={t(
              "tasks.submissionNotes",
              "Additional Notes for Instructor (Optional)",
            )}
            {...register("notes")}
          />
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
