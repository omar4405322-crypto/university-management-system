import React from "react";
import { Eye, Check, X, Trash2, RotateCw, AlertTriangle } from "lucide-react";
import Card from "../../../components/ui/card";
import type { RegistrationRequestItem, StatusBadgeConfig } from "../types";

export interface RegistrationRequestsCardsProps {
  requests: RegistrationRequestItem[];
  selectedIds: (string | number)[];
  onSelectOne: (id: string | number) => void;
  onView: (req: RegistrationRequestItem) => void;
  onApprove: (id: string | number) => void;
  onReject: (req: RegistrationRequestItem) => void;
  onDelete: (req: RegistrationRequestItem) => void;
  actionLoadingId: string | number | null;
  getStatusBadge: (status: string) => StatusBadgeConfig;
  isRTL: boolean;
  t: (key: string, fallback: string) => string;
}

export const RegistrationRequestsCards: React.FC<RegistrationRequestsCardsProps> = ({
  requests,
  selectedIds,
  onSelectOne,
  onView,
  onApprove,
  onReject,
  onDelete,
  actionLoadingId,
  getStatusBadge,
  isRTL,
  t,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in duration-300">
      {requests.map((req) => {
        const isSelected = selectedIds.includes(req.id);
        const statusConfig = getStatusBadge(req.status);
        const isActioning = actionLoadingId === req.id;
        const collegeName =
          req.department?.college?.name || req.department?.college?.nameAr;
        const deptName = req.department?.name || req.department?.nameAr;

        return (
          <Card
            key={req.id}
            noPadding
            className={`bg-white dark:bg-slate-800 rounded-2xl border transition-all duration-200 p-5 flex flex-col justify-between shadow-xs hover:shadow-md ${
              isSelected
                ? "border-brand-primary-500 ring-2 ring-brand-primary-500/20"
                : "border-slate-200/90 dark:border-slate-700"
            }`}
          >
            <div>
              {/* Header: Checkbox, ID & Status Badge */}
              <div className="flex items-center justify-between gap-2 mb-3.5">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    aria-label={
                      isRTL
                        ? `تحديد ${req.firstName} ${req.lastName}`
                        : `Select ${req.firstName} ${req.lastName}`
                    }
                    className="rounded border-slate-300 dark:border-slate-700 text-brand-primary-600 focus:ring-brand-primary-500/20 w-4 h-4 cursor-pointer align-middle"
                    checked={isSelected}
                    onChange={() => onSelectOne(req.id)}
                  />
                  <span className="text-xs font-mono font-bold text-slate-400">
                    #{req.id}
                  </span>
                </div>
                <div
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${statusConfig.className}`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${statusConfig.dotClass}`}
                  ></span>
                  <span>{statusConfig.label}</span>
                </div>
              </div>

              {/* Applicant Profile */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-brand-primary-500 to-brand-primary-600 text-white font-bold text-sm flex items-center justify-center shadow-xs shrink-0">
                  {req.firstName?.[0] || "U"}
                </div>
                <div className="min-w-0">
                  <h4 className="text-base font-extrabold text-slate-900 dark:text-white truncate">
                    {req.firstName} {req.lastName}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5 font-medium">
                    {req.email}
                  </p>
                </div>
              </div>

              {/* Info Grid */}
              <div className="bg-slate-50 dark:bg-slate-900/60 rounded-xl p-3 border border-slate-100 dark:border-slate-700/60 space-y-2 mb-4 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-400 font-medium">
                    {t("auth.college", "College")}:
                  </span>
                  <span
                    className="font-bold text-slate-700 dark:text-slate-200 truncate max-w-[170px]"
                    title={collegeName || "N/A"}
                  >
                    {collegeName || (isRTL ? "غير محدد" : "N/A")}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-400 font-medium">
                    {t("auth.department", "Department")}:
                  </span>
                  <span
                    className="font-bold text-slate-700 dark:text-slate-200 truncate max-w-[170px]"
                    title={deptName || "N/A"}
                  >
                    {deptName || (isRTL ? "عام" : "General")}
                  </span>
                </div>
                {req.studentId && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400 font-medium">
                      {t("auth.studentId", "Student ID Number")}:
                    </span>
                    <span className="font-mono font-bold text-brand-primary-600 dark:text-brand-primary-400">
                      {req.studentId}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/50 dark:border-slate-700/50">
                  <span className="text-slate-400 font-medium">
                    {t("registration.appliedDate", "Applied Date")}:
                  </span>
                  <span className="font-medium text-slate-600 dark:text-slate-300">
                    {req.createdAt
                      ? new Date(req.createdAt).toLocaleDateString(
                          isRTL ? "ar-EG" : "en-US",
                        )
                      : "-"}
                  </span>
                </div>
              </div>

              {/* Rejection Note Preview */}
              {req.status === "REJECTED" && req.rejectionReason && (
                <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/40 text-xs text-rose-700 dark:text-rose-300 mb-4 flex items-start gap-2">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  <p className="line-clamp-2">{req.rejectionReason}</p>
                </div>
              )}
            </div>

            {/* Actions Footer */}
            <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-700/60 mt-auto">
              <button
                onClick={() => onView(req)}
                className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer"
              >
                <Eye size={14} />
                <span>{t("common.view", "View")}</span>
              </button>

              {req.status === "PENDING" && (
                <>
                  <button
                    onClick={() => onReject(req)}
                    disabled={isActioning}
                    className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                  >
                    <X size={14} />
                    <span>{t("common.reject", "Reject")}</span>
                  </button>
                  <button
                    onClick={() => onApprove(req.id)}
                    disabled={isActioning}
                    className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl bg-brand-primary-500 hover:bg-brand-primary-600 text-white text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer disabled:opacity-50"
                  >
                    {isActioning ? (
                      <RotateCw size={14} className="animate-spin" />
                    ) : (
                      <Check size={14} />
                    )}
                    <span>{t("common.approve", "Approve")}</span>
                  </button>
                </>
              )}

              <button
                onClick={() => onDelete(req)}
                title={t("registration.deleteRequest", "Delete Request")}
                className="h-9 px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-rose-300 dark:hover:border-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 text-xs font-bold transition-all cursor-pointer flex items-center justify-center"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </Card>
        );
      })}
    </div>
  );
};
