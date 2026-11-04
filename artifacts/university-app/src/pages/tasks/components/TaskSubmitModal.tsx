import React, { useEffect, useMemo } from "react";
import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Send, Clock, FileUp, X, UploadCloud, AlertCircle } from "lucide-react";
import { MAX_TASK_NOTES_LENGTH, isTaskPastDue } from "../../../utils/taskDeadline.utils";
import {
  isApprovedHostname,
  validateSubmissionFile,
  formatTaskFileSize,
  ALLOWED_TASK_EXTENSIONS,
} from "../../../utils/taskSubmissionUrl";
import Modal from "../../../components/ui/Modal";
import Button from "../../../components/ui/button";
import type { TaskItem } from "../types";

export interface TaskSubmitModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: TaskItem | null;
  onSubmit: (formData: FormData) => Promise<void>;
}

export const TaskSubmitModal: React.FC<TaskSubmitModalProps> = ({
  isOpen,
  onClose,
  task,
  onSubmit,
}) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileUrl, setFileUrl] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [notesError, setNotesError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isOverdue = isTaskPastDue(task?.dueDate);

  useEffect(() => {
    if (isOpen) {
      setSelectedFile(null);
      setFileError(null);
      setFileUrl("");
      setUrlError(null);
      setNotes("");
      setNotesError(null);
      setIsSubmitting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [isOpen]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (!file) {
      setSelectedFile(null);
      setFileError(null);
      return;
    }
    const val = validateSubmissionFile(file);
    if (!val.isValid) {
      setSelectedFile(null);
      setFileError(t(val.errorKey || "tasks.fileExtensionNotAllowed", val.defaultMessage || "Invalid file"));
      if (fileInputRef.current) fileInputRef.current.value = "";
    } else {
      setSelectedFile(file);
      setFileError(null);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setFileError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const validateUrl = (url: string): boolean => {
    if (!url.trim()) {
      setUrlError(null);
      return true;
    }
    if (url.trim().length > 500) {
      setUrlError(t("tasks.fileUrlTooLong", "Task submission link is too long"));
      return false;
    }
    try {
      const parsed = new URL(url.trim());
      if (parsed.protocol !== "https:") {
        setUrlError(t("tasks.fileUrlMustBeHttps", "Task submission link must use HTTPS"));
        return false;
      }
      if (!isApprovedHostname(parsed.hostname.toLowerCase().replace(/\.$/, ""))) {
        setUrlError(t("tasks.invalidUrl", "Please enter a valid submission link"));
        return false;
      }
      setUrlError(null);
      return true;
    } catch {
      setUrlError(t("tasks.invalidUrl", "Please enter a valid submission link"));
      return false;
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isOverdue || isSubmitting) return;

    if (!selectedFile) {
      setFileError(t("tasks.fileRequiredHint", "A file upload is required to submit this task"));
      return;
    }

    if (selectedFile) {
      const fileVal = validateSubmissionFile(selectedFile);
      if (!fileVal.isValid) {
        setFileError(t(fileVal.errorKey || "tasks.fileExtensionNotAllowed", fileVal.defaultMessage || "Invalid file"));
        return;
      }
    }

    if (fileUrl.trim() && !validateUrl(fileUrl)) {
      return;
    }

    if (notes.length > MAX_TASK_NOTES_LENGTH) {
      setNotesError(t("tasks.notesTooLong", { max: MAX_TASK_NOTES_LENGTH }));
      return;
    }

    const formData = new FormData();
    if (selectedFile) {
      formData.append("file", selectedFile);
    }
    if (fileUrl.trim()) {
      formData.append("linkUrl", fileUrl.trim());
      formData.append("fileUrl", fileUrl.trim());
    }
    if (notes.trim()) {
      formData.append("notes", notes.trim());
    }

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
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
      <form onSubmit={handleFormSubmit} className="space-y-4 pt-1">
        {isOverdue && (
          <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
            <Clock size={14} className="shrink-0" />
            <span>{t("tasks.deadlinePassed", "The deadline for this task has passed")}</span>
          </div>
        )}

        {/* File Picker Section */}
        <div>
          <label
            htmlFor="submit-file-input"
            className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
          >
            {t("tasks.filePickerLabel", "Select Deliverable File")} <span className="text-rose-500">*</span>
          </label>

          <input
            ref={fileInputRef}
            id="submit-file-input"
            type="file"
            accept={ALLOWED_TASK_EXTENSIONS.map((e) => `.${e}`).join(",")}
            className="sr-only"
            onChange={handleFileSelect}
            aria-describedby={
              fileError
                ? "submit-file-error"
                : !selectedFile
                ? "submit-file-required-hint"
                : undefined
            }
          />

          {!selectedFile ? (
            <div
              role="button"
              tabIndex={0}
              aria-label={t("tasks.filePickerDropzone", "Click or press Enter to upload file")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-brand-primary-500 dark:hover:border-brand-primary-400 focus:border-brand-primary-500 focus:ring-2 focus:ring-brand-primary-500/20 rounded-2xl p-4 text-center cursor-pointer transition-colors bg-slate-50/60 dark:bg-slate-900/40"
            >
              <UploadCloud size={24} className="mx-auto text-brand-primary-600 dark:text-brand-primary-400 mb-1.5" />
              <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                {t("tasks.filePickerDropzone", "Click or press Enter to upload file")}
              </p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                {t(
                  "tasks.filePickerFormats",
                  "Allowed: PDF, Word, Excel, PowerPoint, Text, Archives, Images (Max 25MB)"
                )}
              </p>
            </div>
          ) : (
            <div className="p-3 rounded-2xl bg-brand-primary-500/[0.04] dark:bg-brand-primary-500/[0.08] border border-brand-primary-200 dark:border-brand-primary-800/60 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-brand-primary-100 dark:bg-brand-primary-950/60 text-brand-primary-700 dark:text-brand-primary-300 flex items-center justify-center shrink-0">
                  <FileUp size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate" title={selectedFile.name}>
                    {selectedFile.name}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    {formatTaskFileSize(selectedFile.size)} · {selectedFile.type || selectedFile.name.split('.').pop()?.toUpperCase() || "FILE"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                data-remove-file="true"
                onClick={handleRemoveFile}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                title={t("tasks.removeFile", "Remove File")}
                aria-label={t("tasks.removeFile", "Remove File")}
              >
                <X size={15} />
              </button>
            </div>
          )}

          {fileError && (
            <p id="submit-file-error" data-file-error="true" className="text-rose-500 text-[11px] mt-1.5 font-medium flex items-center gap-1" role="alert">
              <AlertCircle size={12} className="shrink-0" />
              <span>{fileError}</span>
            </p>
          )}

          {!selectedFile && (
            <p id="submit-file-required-hint" data-file-required-hint="true" className="text-slate-500 dark:text-slate-400 text-[11px] mt-1 font-medium">
              {t("tasks.fileRequiredHint", "A file upload is required to submit this task")}
            </p>
          )}
        </div>

        {/* Optional Deliverable Link */}
        <div>
          <label htmlFor="submit-file-url" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            {t("tasks.deliverableLinkOptional", "Deliverable Link (Optional - Google Drive / GitHub / OneDrive)")}
          </label>
          <input
            id="submit-file-url"
            type="url"
            value={fileUrl}
            onChange={(e) => {
              setFileUrl(e.target.value);
              if (urlError) validateUrl(e.target.value);
            }}
            onBlur={() => validateUrl(fileUrl)}
            aria-invalid={!!urlError}
            aria-describedby={urlError ? "submit-file-url-error" : undefined}
            className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-1.5 focus:ring-brand-primary-500 outline-none bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-mono"
            maxLength={500}
            placeholder="https://drive.google.com/..."
          />
          {urlError && (
            <p id="submit-file-url-error" className="text-rose-500 text-[11px] mt-1 font-medium flex items-center gap-1" role="alert">
              <AlertCircle size={12} className="shrink-0" />
              <span>{urlError}</span>
            </p>
          )}
        </div>

        {/* Optional Notes */}
        <div>
          <label htmlFor="submit-notes" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            {t("tasks.submissionNotes", "Additional Notes for Instructor (Optional)")}
          </label>
          <textarea
            id="submit-notes"
            rows={3}
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
              if (notesError && e.target.value.length <= MAX_TASK_NOTES_LENGTH) {
                setNotesError(null);
              }
            }}
            className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-1.5 focus:ring-brand-primary-500 outline-none bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100"
            placeholder={t("tasks.submissionNotes", "Additional Notes for Instructor (Optional)")}
            maxLength={MAX_TASK_NOTES_LENGTH}
          />
          {notesError && (
            <p id="submit-notes-error" className="text-rose-500 text-[11px] mt-1 font-medium flex items-center gap-1" role="alert">
              <AlertCircle size={12} className="shrink-0" />
              <span>{notesError}</span>
            </p>
          )}
        </div>

        <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-xs font-semibold cursor-pointer"
          >
            {t("common.cancel", "Cancel")}
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={!selectedFile || Boolean(fileError) || isSubmitting || isOverdue}
            className="bg-brand-primary-600 hover:bg-brand-primary-700 text-white text-xs font-bold gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
