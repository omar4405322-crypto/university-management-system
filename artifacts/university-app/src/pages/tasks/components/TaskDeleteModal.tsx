import React from "react";
import { useTranslation } from "react-i18next";
import { AlertCircle, Trash2 } from "lucide-react";
import Modal from "../../../components/ui/Modal";
import Button from "../../../components/ui/button";
import type { TaskItem } from "../types";

export interface TaskDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: TaskItem | null;
  onConfirmDelete: (permanent: boolean) => Promise<void>;
}

export const TaskDeleteModal: React.FC<TaskDeleteModalProps> = ({
  isOpen,
  onClose,
  task,
  onConfirmDelete,
}) => {
  const { t } = useTranslation();
  const submissionsCount = task?._count?.submissions || 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("tasks.deleteConfirmTitle", "Confirm Assignment Deletion")}
      subtitle={task?.title}
      size="md"
    >
      <div className="space-y-4 pt-1">
        <div
          className={`p-3 rounded-xl border text-xs leading-relaxed ${
            submissionsCount > 0
              ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200"
              : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
          }`}
        >
          <div className="flex items-start gap-2">
            <AlertCircle
              size={16}
              className="text-amber-600 shrink-0 mt-0.5"
            />
            <div>
              <p className="font-semibold">
                {submissionsCount > 0
                  ? t(
                      "tasks.deleteConfirmSoft",
                      "This task has student submissions. It will be archived to preserve student grades.",
                    )
                  : t(
                      "tasks.deleteConfirmEmpty",
                      "No submissions yet for this task.",
                    )}
              </p>
              <span className="text-[11px] text-slate-400 mt-1 block">
                {t("tasks.submissionsCountLabel", {
                  count: submissionsCount,
                  defaultValue: `${submissionsCount} submissions`,
                })}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-xs font-semibold"
          >
            {t("common.cancel", "Cancel")}
          </Button>
          <Button
            size="sm"
            onClick={() => onConfirmDelete(false)}
            className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold"
          >
            {t("tasks.deleteSoft", "Archive Assignment")}
          </Button>
          {submissionsCount === 0 && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => onConfirmDelete(true)}
              className="text-xs font-bold gap-1"
            >
              <Trash2 size={13} />
              <span>{t("tasks.deletePermanent", "Permanent Delete")}</span>
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};
