import React, { useState, useEffect, useCallback } from "react";
import Card from "../../components/ui/card";
import Button from "../../components/ui/button";
import Badge from "../../components/ui/badge";
import {
  Building2,
  ExternalLink,
  Edit2,
  Trash2,
  AlertCircle,
  Loader2,
  Plus,
  Layers,
} from "lucide-react";
import { PageHeader } from "../../components/ui/PageHeader";
import collegeService from "../../services/college.service";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import AddCollegeModal from "./AddCollegeModal";
import EditCollegeModal from "./EditCollegeModal";
import CollegeCardImage from "../../components/CollegeCardImage";
import { EmptyState } from "../../components/ui/EmptyState";
import ConfirmDeleteModal from "../../components/ui/ConfirmDeleteModal";
import { logger } from "../../lib/logger";
import { useToast } from "../../context/ToastContext";
import type { CollegeRow } from "../../types/domain";

const CollegesList = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isRTL } = useLanguage();
  const [colleges, setColleges] = useState<CollegeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedCollege, setSelectedCollege] = useState<CollegeRow | null>(null);
  const { showToast } = useToast();
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string | number;
    name: string;
  } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchColleges = useCallback(async () => {
    try {
      setLoading(true);
      const result = await collegeService.getManagedColleges();
      if (result.success) {
        setColleges(result.data?.colleges || result.data || []);
      }
    } catch (error: any) {
      logger.error("Error fetching colleges:", error);
      showToast(t("common.errorFetching"), "error");
    } finally {
      setLoading(false);
    }
  }, [showToast, t]);

  useEffect(() => {
    // If user is DEPARTMENT_ADMIN, redirect to their scoped view
    if (user?.role === "DEPARTMENT_ADMIN" && user?.managedDepartmentId) {
      navigate(`/departments/${user.managedDepartmentId}`);
      return;
    }

    fetchColleges();
  }, [fetchColleges, navigate, user?.managedDepartmentId, user?.role]);

  // For COLLEGE_ADMIN, filter colleges to only show their managed college
  const visibleColleges =
    user?.role === "COLLEGE_ADMIN" && user?.managedCollegeId
      ? Array.isArray(colleges)
        ? colleges.filter((c) => c.id === user.managedCollegeId)
        : []
      : Array.isArray(colleges)
        ? colleges
        : [];

  const displayColleges = [...visibleColleges].sort((a, b) =>
    (isRTL ? a.nameAr || a.name || "" : a.name || "").localeCompare(
      isRTL ? b.nameAr || b.name || "" : b.name || "",
    ),
  );

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleteLoading(true);
      const result = await collegeService.deleteCollege(deleteTarget.id);
      if (result.success) {
        showToast(t("colleges.deleteSuccess"), "success");
        setDeleteTarget(null);
        fetchColleges();
      }
    } catch (error: any) {
      const message =
        error.data?.message || error.message || t("colleges.deleteError");
      showToast(message, "error");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleEdit = (college: any) => {
    setSelectedCollege(college);
    setIsEditModalOpen(true);
  };

  return (
    <div className="section-gap animate-page pt-4">
      <PageHeader
        title={t("colleges.title", "University Colleges")}
        subtitle={t(
          "colleges.subtitle",
          "Overview of all academic divisions and their performance.",
        )}
        action={
          user?.role === "SUPER_ADMIN"
            ? {
                label: t("colleges.addCollege", "Add New College"),
                onClick: () => setIsAddModalOpen(true),
                icon: Plus,
                className:
                  "bg-brand-primary-500 hover:bg-brand-primary-600 text-white font-bold rounded-xl active:scale-95 transition-all flex items-center gap-2 px-4 py-2",
              }
            : undefined
        }
      />

      {loading ? (
        <div className="flex flex-col justify-center items-center h-96 gap-4">
          <Loader2 className="animate-spin text-brand-primary-600" size={48} />
          <p className="text-caption">{t("common.loading")}</p>
        </div>
      ) : !Array.isArray(displayColleges) || displayColleges.length === 0 ? (
        <EmptyState
          icon={<Building2 size={40} />}
          title={t("colleges.noColleges")}
          subtitle={t("colleges.noCollegesDesc")}
          action={
            user?.role === "SUPER_ADMIN"
              ? {
                  label: t("colleges.addFirstCollege"),
                  onClick: () => setIsAddModalOpen(true),
                }
              : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {displayColleges.map((college) => (
            <Card
              key={college.id}
              noPadding
              className="group border border-brand-border/70 bg-brand-bg-card rounded-2xl overflow-hidden shadow-2xs hover:shadow-card hover:-translate-y-1 hover:border-brand-primary-500/40 transition-all duration-200 flex flex-col justify-between"
            >
              <div>
                <div className="relative h-44 w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                  <CollegeCardImage
                    name={college.name}
                    image={college.image}
                    collegeId={college.id}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent z-10" />

                  <div className="absolute top-3 end-3 z-20 flex items-center gap-1.5">
                    {user?.role === "SUPER_ADMIN" && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleEdit(college)}
                          className="w-8 h-8 rounded-lg bg-black/50 p-1.5 text-white backdrop-blur-md hover:bg-brand-primary-500 hover:text-brand-navy-950 transition-all shadow-sm border border-white/10 flex items-center justify-center cursor-pointer"
                          title={t("common.edit")}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setDeleteTarget({
                              id: college.id,
                              name: isRTL
                                ? college.nameAr || college.name
                                : college.name,
                            })
                          }
                          className="w-8 h-8 rounded-lg bg-black/50 p-1.5 text-white backdrop-blur-md hover:bg-error transition-all shadow-sm border border-white/10 flex items-center justify-center cursor-pointer"
                          title={t("common.delete")}
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>

                  <div className="absolute bottom-3 start-3 z-20">
                    <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-brand-primary-500 text-brand-navy-950 shadow-sm">
                      {t("colleges.active")}
                    </span>
                  </div>
                </div>

                <div className="p-5">
                  <h3 className="text-base font-bold text-brand-text-primary dark:text-brand-text-main leading-snug mb-1.5 line-clamp-2">
                    {isRTL ? college.nameAr || college.name : college.name}
                  </h3>

                  <p
                    dir="auto"
                    className="text-xs text-brand-text-secondary dark:text-brand-text-sub text-start line-clamp-2 min-h-[2.25rem] leading-relaxed mb-4"
                  >
                    {isRTL
                      ? college.descriptionAr || college.description
                      : college.description}
                  </p>

                  <div className="grid grid-cols-2 gap-3 border-t border-brand-border/60 pt-3">
                    <div className="space-y-0.5">
                      <p className="label-stat text-slate-400 dark:text-slate-500">{t("nav.departments")}</p>
                      <p className="text-2xl font-black text-brand-text-primary dark:text-brand-text-main tracking-tight">
                        {college._count?.departments || 0}
                      </p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="label-stat text-slate-400 dark:text-slate-500">{t("profile.status")}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <div className="w-2 h-2 rounded-full bg-brand-primary-500 animate-pulse" />
                        <span className="text-[11px] font-bold text-brand-primary-600 dark:text-brand-primary-400">
                          {t("colleges.operational")}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Assigned Admin Section */}
                  <div className="mt-3.5 p-2.5 bg-surface-subtle rounded-xl text-start border border-brand-border/40">
                    <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
                      {t("colleges.assignedAdmin") || "Assigned Admin"}
                    </p>
                    {college.assignedAdmin ? (
                      <div className="flex flex-col">
                        <p
                          dir="auto"
                          className="font-bold text-xs text-brand-text-primary dark:text-brand-text-main truncate"
                        >
                          {college.assignedAdmin.name ||
                            college.assignedAdmin.email}
                        </p>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                          {college.assignedAdmin.email}
                        </p>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                        <AlertCircle size={13} />
                        <span className="text-[11px] font-semibold">
                          {t("colleges.noAdminAssigned") || "No admin assigned"}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-5 pt-0">
                <div className="flex items-center gap-2 pt-2 border-t border-brand-border/40">
                  <Button
                    variant="outline"
                    className="flex-1 text-xs font-bold py-2 rounded-xl flex items-center justify-center gap-1.5"
                    onClick={() =>
                      navigate(`/departments?collegeId=${college.id}`)
                    }
                  >
                    <Layers size={13} />
                    <span>{t("colleges.manageDepts")}</span>
                  </Button>
                  <Button
                    variant="default"
                    className="flex-1 text-xs font-bold py-2 rounded-xl flex items-center justify-center gap-1.5 bg-brand-navy-500 hover:bg-brand-navy-600 text-white"
                    onClick={() => navigate(`/colleges/${college.id}`)}
                  >
                    <span>{t("colleges.viewDetails")}</span>
                    <ExternalLink size={13} className="rtl:-scale-x-100" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDeleteModal
        isOpen={Boolean(deleteTarget)}
        itemName={deleteTarget?.name}
        onClose={() => !deleteLoading && setDeleteTarget(null)}
        onConfirm={confirmDelete}
        loading={deleteLoading}
      />

      <AddCollegeModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => {
          setIsAddModalOpen(false);
          fetchColleges();
          showToast(t("colleges.addSuccess"), "success");
        }}
      />

      <EditCollegeModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedCollege(null);
        }}
        college={selectedCollege}
        onSuccess={() => {
          setIsEditModalOpen(false);
          setSelectedCollege(null);
          fetchColleges();
          showToast(t("colleges.updateSuccess"), "success");
        }}
      />
    </div>
  );
};

export default CollegesList;
