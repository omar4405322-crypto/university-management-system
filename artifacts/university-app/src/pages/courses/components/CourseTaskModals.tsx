import React, { useState } from "react";
import { AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import Modal from "../../../components/ui/Modal";
import Button from "../../../components/ui/button";
import type { CourseTask } from "../types";

export interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  courseName?: string;
  onSubmit: (data: {
    title: string;
    description: string;
    maxScore: number;
    dueDate: string;
  }) => Promise<void>;
}

export const CreateTaskModal: React.FC<CreateTaskModalProps> = ({
  isOpen,
  onClose,
  courseName,
  onSubmit,
}) => {
  const { t } = useTranslation();
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskMaxScore, setTaskMaxScore] = useState<number>(10);
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskError, setTaskError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTaskError("");
    setIsSubmitting(true);
    try {
      await onSubmit({
        title: taskTitle,
        description: taskDesc,
        maxScore: taskMaxScore,
        dueDate: taskDueDate,
      });
      setTaskTitle("");
      setTaskDesc("");
      setTaskMaxScore(10);
      setTaskDueDate("");
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create task";
      setTaskError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("tasks.createTask", "Create Assignment")}
      subtitle={courseName}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        {taskError && (
          <div className="p-3 bg-red-50 dark:bg-red-950/20 text-red-600 rounded-xl text-xs font-bold flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{taskError}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-bold text-brand-text-main mb-1">
            {t("tasks.taskTitle", "Assignment Title")}
          </label>
          <input
            type="text"
            required
            value={taskTitle}
            onChange={(e) => setTaskTitle(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-brand-border bg-brand-bg-card focus:outline-none focus:border-brand-primary-500"
            placeholder="مثال: واجب الأسبوع الثالث"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-brand-text-main mb-1">
            {t("tasks.taskDescription", "Assignment Instructions & Description")}
          </label>
          <textarea
            rows={3}
            required
            value={taskDesc}
            onChange={(e) => setTaskDesc(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-brand-border bg-brand-bg-card focus:outline-none focus:border-brand-primary-500"
            placeholder="شرح المطلوب بالتفصيل..."
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-brand-text-main mb-1">
              {t("tasks.maxPoints", "Total Points")}
            </label>
            <input
              type="number"
              min={1}
              required
              value={taskMaxScore}
              onChange={(e) => setTaskMaxScore(Number(e.target.value))}
              className="w-full px-3 py-2 text-xs rounded-xl border border-brand-border bg-brand-bg-card focus:outline-none focus:border-brand-primary-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-brand-text-main mb-1">
              {t("tasks.due", "Submission Deadline")}
            </label>
            <input
              type="datetime-local"
              required
              value={taskDueDate}
              onChange={(e) => setTaskDueDate(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-brand-border bg-brand-bg-card focus:outline-none focus:border-brand-primary-500"
            />
          </div>
        </div>

        <div className="pt-4 flex justify-end gap-3 border-t border-brand-border">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-brand-text-sub hover:bg-surface-subtle rounded-xl"
          >
            {t("common.cancel", "Cancel")}
          </button>
          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting}
            className="text-xs py-2 px-5 shadow-md shadow-brand-primary-500/20"
          >
            {isSubmitting
              ? t("common.loading", "Loading...")
              : t("tasks.createTask", "Create Assignment")}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export interface SubmitTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: CourseTask | null;
  onSubmit: (data: { fileUrl: string; notes?: string }) => Promise<void>;
}

export const SubmitTaskModal: React.FC<SubmitTaskModalProps> = ({
  isOpen,
  onClose,
  task,
  onSubmit,
}) => {
  const { t } = useTranslation();
  const [submitNotes, setSubmitNotes] = useState("");
  const [submitFileUrl, setSubmitFileUrl] = useState("");
  const [taskError, setTaskError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTaskError("");
    setIsSubmitting(true);
    try {
      await onSubmit({
        fileUrl: submitFileUrl,
        notes: submitNotes || undefined,
      });
      setSubmitNotes("");
      setSubmitFileUrl("");
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to submit task";
      setTaskError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("tasks.submitTask", "Submit Assignment")}
      subtitle={task?.title}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        {taskError && (
          <div className="p-3 bg-red-50 dark:bg-red-950/20 text-red-600 rounded-xl text-xs font-bold flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{taskError}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-bold text-brand-text-main mb-1">
            {t(
              "tasks.submissionNotes",
              "Additional Notes for Instructor (Optional)"
            )}
          </label>
          <textarea
            rows={3}
            value={submitNotes}
            onChange={(e) => setSubmitNotes(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-brand-border bg-brand-bg-card focus:outline-none focus:border-brand-primary-500"
            placeholder="اكتب أي ملاحظات موجهة لأستاذ المادة..."
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-brand-text-main mb-1">
            رابط الملف / الإجابة (File URL)
          </label>
          <input
            type="url"
            required
            value={submitFileUrl}
            onChange={(e) => setSubmitFileUrl(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-brand-border bg-brand-bg-card focus:outline-none focus:border-brand-primary-500"
            placeholder="https://drive.google.com/..."
          />
        </div>

        <div className="pt-4 flex justify-end gap-3 border-t border-brand-border">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-brand-text-sub hover:bg-surface-subtle rounded-xl"
          >
            {t("common.cancel", "Cancel")}
          </button>
          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting}
            className="text-xs py-2 px-5 shadow-md shadow-brand-primary-500/20"
          >
            {isSubmitting
              ? t("common.loading", "Loading...")
              : t("tasks.submitTask", "Submit Assignment")}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
