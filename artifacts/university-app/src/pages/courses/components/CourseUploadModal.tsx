import React from "react";
import { Upload, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import Button from "../../../components/ui/button";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1048576).toFixed(1) + " MB";
}

interface CourseUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  course: any;
  uploadType: "LECTURE" | "TUTORIAL";
  setUploadType: (type: "LECTURE" | "TUTORIAL") => void;
  materialTitle: string;
  setMaterialTitle: (title: string) => void;
  materialDescription: string;
  setMaterialDescription: (desc: string) => void;
  uploadMode: "file" | "link";
  setUploadMode: (mode: "file" | "link") => void;
  selectedFile: File | null;
  setSelectedFile: (file: File | null) => void;
  externalUrl: string;
  setExternalUrl: (url: string) => void;
  uploadError: string | null;
  setUploadError: (err: string | null) => void;
  isSubmitting: boolean;
  handleUploadSubmit: (e: React.FormEvent) => void;
}

export const CourseUploadModal: React.FC<CourseUploadModalProps> = ({
  isOpen,
  onClose,
  course,
  uploadType,
  setUploadType,
  materialTitle,
  setMaterialTitle,
  materialDescription,
  setMaterialDescription,
  uploadMode,
  setUploadMode,
  selectedFile,
  setSelectedFile,
  externalUrl,
  setExternalUrl,
  uploadError,
  setUploadError,
  isSubmitting,
  handleUploadSubmit,
}) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-brand-bg-card w-full max-w-lg rounded-3xl shadow-2xl border border-brand-border overflow-hidden">
        <div className="p-6 border-b border-brand-border flex items-center justify-between bg-brand-bg-page">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-brand-primary-50 text-brand-primary-600">
              <Upload size={22} />
            </div>
            <div>
              <h3 className="font-black text-lg text-brand-text-main">
                {uploadType === "LECTURE"
                  ? t("courses.uploadLecture", "Upload New Lecture")
                  : t("courses.uploadTutorial", "Upload New Tutorial")}
              </h3>
              <p className="text-xs text-brand-text-sub font-medium">
                {course.name} ({course.courseCode})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-brand-text-muted hover:text-brand-text-main text-xl font-bold p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleUploadSubmit} className="p-6 space-y-4">
          {uploadError && (
            <div className="p-3 rounded-2xl bg-red-50 text-red-600 text-xs font-bold flex items-center gap-2 border border-red-100">
              <AlertCircle size={16} />
              <span>{uploadError}</span>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-brand-text-main mb-1">
              {t("courses.materialTitle", "Title")} *
            </label>
            <input
              type="text"
              required
              placeholder={t(
                "courses.materialTitlePlaceholder",
                "e.g. Lecture 1 - Introduction to Algorithms",
              )}
              value={materialTitle}
              onChange={(e) => setMaterialTitle(e.target.value)}
              className="w-full px-4 py-2.5 rounded-2xl bg-brand-bg-page border border-brand-border text-sm font-medium text-brand-text-main focus:outline-none focus:border-brand-primary-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-brand-text-main mb-1">
              {t("courses.materialDescription", "Description (Optional)")}
            </label>
            <textarea
              rows={2}
              placeholder={t(
                "courses.materialDescriptionPlaceholder",
                "Add notes or instructions for students...",
              )}
              value={materialDescription}
              onChange={(e) => setMaterialDescription(e.target.value)}
              className="w-full px-4 py-2.5 rounded-2xl bg-brand-bg-page border border-brand-border text-sm font-medium text-brand-text-main focus:outline-none focus:border-brand-primary-500"
            />
          </div>

          {/* Category selector */}
          <div>
            <label className="block text-xs font-bold text-brand-text-main mb-1">
              {t("courses.materialType", "Material Category")}
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setUploadType("LECTURE")}
                className={`p-3 rounded-2xl font-bold text-xs border text-center transition-all ${
                  uploadType === "LECTURE"
                    ? "bg-brand-primary-50 border-brand-primary-500 text-brand-primary-700 shadow-sm"
                    : "bg-brand-bg-page border-brand-border text-brand-text-sub"
                }`}
              >
                📘 محاضرة (Lecture)
              </button>
              <button
                type="button"
                onClick={() => setUploadType("TUTORIAL")}
                className={`p-3 rounded-2xl font-bold text-xs border text-center transition-all ${
                  uploadType === "TUTORIAL"
                    ? "bg-purple-50 border-purple-500 text-purple-700 shadow-sm"
                    : "bg-brand-bg-page border-brand-border text-brand-text-sub"
                }`}
              >
                📝 سكشن / تمرين (Tutorial)
              </button>
            </div>
          </div>

          {/* Upload Mode Selector (File vs Link) */}
          <div>
            <label className="block text-xs font-bold text-brand-text-main mb-1">
              {t("courses.fileOrUrl", "File or External Link")}
            </label>
            <div className="flex items-center gap-3 mb-2">
              <button
                type="button"
                onClick={() => setUploadMode("file")}
                className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-colors ${
                  uploadMode === "file"
                    ? "bg-brand-primary-600 text-white border-brand-primary-600"
                    : "bg-brand-bg-page text-brand-text-sub border-brand-border"
                }`}
              >
                {t("courses.fileUpload", "Upload File")}
              </button>
              <button
                type="button"
                onClick={() => setUploadMode("link")}
                className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-colors ${
                  uploadMode === "link"
                    ? "bg-brand-primary-600 text-white border-brand-primary-600"
                    : "bg-brand-bg-page text-brand-text-sub border-brand-border"
                }`}
              >
                {t(
                  "courses.urlLink",
                  "External Link (Drive, Youtube, etc.)",
                )}
              </button>
            </div>

            {uploadMode === "file" ? (
              <div className="border-2 border-dashed border-brand-border hover:border-brand-primary-400 p-6 rounded-2xl text-center bg-brand-bg-page/50 transition-colors">
                <input
                  type="file"
                  id="file-input"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setSelectedFile(file);
                    if (file) setUploadError(null);
                  }}
                />
                <label
                  htmlFor="file-input"
                  className="cursor-pointer block"
                >
                  <Upload
                    size={32}
                    className="mx-auto text-brand-brand-green-dark mb-2"
                  />
                  {selectedFile ? (
                    <div className="flex items-center justify-center gap-2 text-xs font-bold text-brand-brand-green-dark bg-brand-primary-50 p-2.5 rounded-xl border border-brand-border">
                      <CheckCircle2 size={16} />
                      <span className="truncate max-w-[200px]">
                        {selectedFile.name}
                      </span>
                      <span className="text-[10px] text-brand-text-muted">
                        ({formatFileSize(selectedFile.size)})
                      </span>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs font-bold text-brand-text-primary dark:text-brand-text-main">
                        اضغط هنا لاختيار ملف من جهازك
                      </p>
                      <p className="text-[10px] text-brand-text-muted mt-1">
                        PDF, Word, PPT, Video, ZIP (حتى 50 ميجابايت)
                      </p>
                    </div>
                  )}
                </label>
              </div>
            ) : (
              <input
                type="url"
                placeholder="https://drive.google.com/file/d/..."
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                className="w-full px-4 py-2.5 rounded-2xl bg-brand-bg-page border border-brand-border text-sm font-medium text-brand-text-main focus:outline-none focus:border-brand-primary-500"
              />
            )}
          </div>

          {/* Submit Buttons */}
          <div className="flex items-center justify-end gap-3 border-t border-brand-border pt-4 mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              {t("common.cancel", "Cancel")}
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting}
              className="flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  <span>{t("common.uploading", "Uploading...")}</span>
                </>
              ) : (
                <>
                  <Upload size={16} />
                  <span>
                    {t("courses.uploadMaterial", "Upload Course Material")}
                  </span>
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
