import React from "react";
import {
  FileText,
  Video,
  Upload,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  UserCheck,
  Download,
  Loader2,
  FileCode,
  Link as LinkIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import Card from "../../../components/ui/card";
import Button from "../../../components/ui/button";
import type { CourseMaterial, CourseMaterialUploader } from "../types";

export interface CourseMaterialsTabProps {
  type: "LECTURE" | "TUTORIAL";
  materials: CourseMaterial[];
  canUpload: boolean;
  userId?: number | string;
  downloadingMaterialId: number | string | null;
  onUpload: (type: "LECTURE" | "TUTORIAL") => void;
  onTogglePublication: (id: number) => void;
  onDeleteMaterial: (id: number) => void;
  onDownloadMaterial: (item: CourseMaterial) => void;
}

export const CourseMaterialsTab: React.FC<CourseMaterialsTabProps> = ({
  type,
  materials,
  canUpload,
  userId,
  downloadingMaterialId,
  onUpload,
  onTogglePublication,
  onDeleteMaterial,
  onDownloadMaterial,
}) => {
  const { t, i18n } = useTranslation();

  const isLecture = type === "LECTURE";
  const title = isLecture
    ? t("courses.lectures", "Lectures")
    : t("courses.tutorials", "Tutorials & Labs");
  const uploadButtonLabel = isLecture
    ? t("courses.uploadLecture", "Upload New Lecture")
    : t("courses.uploadTutorial", "Upload New Tutorial / Lab");
  const emptyStateLabel = isLecture
    ? t("courses.noLecturesYet", "No lectures uploaded for this course yet")
    : t("courses.noTutorialsYet", "No tutorials or labs uploaded for this course yet");

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getMaterialIcon = (fileType?: string | null, fileUrl?: string | null) => {
    if (fileUrl && (fileUrl.startsWith("http://") || fileUrl.startsWith("https://"))) {
      return <LinkIcon size={24} className="text-brand-primary-600" />;
    }
    if (!fileType) {
      return <FileText size={24} className="text-brand-primary-600" />;
    }
    if (fileType.includes("pdf")) {
      return <FileText size={24} className="text-rose-500" />;
    }
    if (fileType.includes("video")) {
      return <Video size={24} className="text-indigo-500" />;
    }
    if (fileType.includes("presentation") || fileType.includes("powerpoint")) {
      return <FileText size={24} className="text-amber-500" />;
    }
    if (fileType.includes("zip") || fileType.includes("rar")) {
      return <FileCode size={24} className="text-emerald-500" />;
    }
    return <FileText size={24} className="text-brand-primary-600" />;
  };

  const getUploaderName = (uploadedBy?: CourseMaterialUploader): string => {
    if (!uploadedBy) return t("common.unknown", "Unknown");
    if (uploadedBy.doctor) {
      return `د. ${uploadedBy.doctor.firstName} ${uploadedBy.doctor.lastName}`;
    }
    if (uploadedBy.teachingAssistant) {
      return `م. ${uploadedBy.teachingAssistant.firstName} ${uploadedBy.teachingAssistant.lastName}`;
    }
    return uploadedBy.email || t("common.unknown", "Unknown");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-brand-bg-card p-4 rounded-2xl border border-brand-border">
        <div>
          <h3 className="font-black text-lg text-brand-text-main flex items-center gap-2">
            {isLecture ? (
              <FileText className="text-brand-primary-600" size={20} />
            ) : (
              <Video className="text-brand-primary-600" size={20} />
            )}
            {title}
          </h3>
          <p className="text-xs text-brand-text-sub mt-1">
            {t(
              "courses.onlyInChargeCanUpload",
              "Notice: Only the assigned professor or teaching assistant in charge of this course can upload materials."
            )}
          </p>
        </div>

        {canUpload && (
          <Button
            onClick={() => onUpload(type)}
            variant="primary"
            className="flex items-center gap-2"
          >
            <Upload size={16} />
            <span>{uploadButtonLabel}</span>
          </Button>
        )}
      </div>

      {materials.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {materials.map((item) => (
            <Card
              key={item.id}
              className="p-5 border border-brand-border hover:shadow-md transition-shadow flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-2xl bg-brand-primary-50">
                      {getMaterialIcon(item.fileType, item.fileUrl)}
                    </div>
                    <div>
                      <h4 className="font-bold text-brand-text-main text-base">
                        {item.title}
                      </h4>
                      <span className="text-xs text-brand-text-muted font-medium">
                        {new Date(item.createdAt).toLocaleDateString(
                          i18n.language === "ar" ? "ar-EG" : "en-US"
                        )}
                        {item.fileSize &&
                          ` • ${formatFileSize(item.fileSize)}`}
                      </span>
                    </div>
                  </div>

                  {/* Publication Status & Action Buttons if Authorized */}
                  <div className="flex items-center gap-1.5">
                    {item.isPublished === false ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        مخفي - مسودة 🔴
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        منشور للطلاب 🟢
                      </span>
                    )}

                    {(canUpload || userId === item.uploadedById) && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onTogglePublication(item.id)}
                          className="p-1.5 rounded-xl text-brand-text-muted hover:text-brand-primary-600 hover:bg-brand-primary-50 transition-colors"
                          title={
                            item.isPublished === false
                              ? "نشر للطلاب"
                              : "تغيير للمسودة وإخفاء عن الطلاب"
                          }
                        >
                          {item.isPublished === false ? (
                            <Eye size={18} className="text-emerald-600" />
                          ) : (
                            <EyeOff size={18} className="text-amber-600" />
                          )}
                        </button>
                        <button
                          onClick={() => onDeleteMaterial(item.id)}
                          className="p-1.5 rounded-xl text-red-500 hover:bg-red-50 transition-colors"
                          title={t("common.delete", "Delete")}
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {item.description && (
                  <p className="text-sm text-brand-text-sub font-medium mt-3 bg-brand-bg-page/50 p-3 rounded-xl">
                    {item.description}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between border-t border-brand-border pt-4 mt-4 text-xs text-brand-text-muted">
                <span className="flex items-center gap-1 font-medium">
                  <UserCheck size={14} className="text-brand-primary-600" />
                  {t("courses.uploadedBy", "Uploaded by")}:{" "}
                  {getUploaderName(item.uploadedBy)}
                </span>

                <button
                  type="button"
                  onClick={() => onDownloadMaterial(item)}
                  disabled={downloadingMaterialId === item.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-primary-600 text-white font-bold hover:bg-brand-primary-700 transition-colors disabled:opacity-50"
                >
                  {downloadingMaterialId === item.id ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Download size={14} />
                  )}
                  <span>{t("courses.download", "Download / View")}</span>
                </button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-brand-bg-card rounded-3xl border border-dashed border-brand-border p-8">
          {isLecture ? (
            <FileText
              size={48}
              className="mx-auto text-brand-text-muted opacity-40 mb-3"
            />
          ) : (
            <Video
              size={48}
              className="mx-auto text-brand-text-muted opacity-40 mb-3"
            />
          )}
          <h3 className="text-lg font-bold text-brand-text-main">
            {emptyStateLabel}
          </h3>
          {canUpload && (
            <Button
              onClick={() => onUpload(type)}
              variant="primary"
              className="mt-4"
            >
              <Plus size={16} className="mr-2" />
              {uploadButtonLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
