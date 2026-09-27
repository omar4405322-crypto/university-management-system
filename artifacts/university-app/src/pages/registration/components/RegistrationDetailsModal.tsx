import React from "react";
import { AlertTriangle, Trash2, RotateCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import Modal from "../../../components/ui/Modal";
import Button from "../../../components/ui/button";

interface RegistrationDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedRequest: any;
  getStatusBadge: (status: string) => { label: string; className: string; dotClass: string };
  handleDeleteClick: (request: any) => void;
  handleOpenRejectModal: (request: any) => void;
  handleApprove: (id: string | number) => Promise<void>;
  actionLoadingId: string | number | null;
  setIsDetailsModalOpen: (open: boolean) => void;
  isRTL: boolean;
}

export const RegistrationDetailsModal: React.FC<RegistrationDetailsModalProps> = ({
  isOpen,
  onClose,
  selectedRequest,
  getStatusBadge,
  handleDeleteClick,
  handleOpenRejectModal,
  handleApprove,
  actionLoadingId,
  setIsDetailsModalOpen,
  isRTL,
}) => {
  const { t } = useTranslation();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("registration.requestDetails", "Registration Request Details")}
    >
      {selectedRequest && (
        <div className="space-y-5 text-start">
          {/* Profile Header Banner */}
          <div className="p-5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-brand-primary-500 to-brand-primary-600 text-white font-extrabold text-lg flex items-center justify-center shadow-xs shrink-0">
                {selectedRequest.firstName?.[0] || "U"}
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white leading-tight">
                  {selectedRequest.firstName} {selectedRequest.lastName}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                  {selectedRequest.email}
                </p>
              </div>
            </div>

            <div
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border self-start sm:self-auto ${
                getStatusBadge(selectedRequest.status).className
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${getStatusBadge(selectedRequest.status).dotClass}`}
              ></span>
              <span>{getStatusBadge(selectedRequest.status).label}</span>
            </div>
          </div>

          {/* Rejection Alert if already rejected */}
          {selectedRequest.status === "REJECTED" &&
            selectedRequest.rejectionReason && (
              <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-rose-700 dark:text-rose-300">
                  <AlertTriangle size={15} />
                  <span>
                    {t("registration.rejectionReason", "Rejection Reason")}:
                  </span>
                </div>
                <p className="text-xs text-rose-600 dark:text-rose-400 font-medium ps-5">
                  {selectedRequest.rejectionReason}
                </p>
              </div>
            )}

          {/* Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Personal Information */}
            <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-700 space-y-3">
              <h4 className="text-xs font-bold text-brand-primary-600 dark:text-brand-primary-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 pb-2">
                {t("registration.personalInfo", "Personal Information")}
              </h4>
              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-slate-400 block font-medium">
                    {t("auth.email", "Email address")}
                  </span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 block mt-0.5 break-all">
                    {selectedRequest.email}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">
                    {t("profile.phone", "Phone Number")}
                  </span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 block mt-0.5">
                    {selectedRequest.phone ||
                      (isRTL ? "غير مسجل" : "Not provided")}
                  </span>
                </div>
              </div>
            </div>

            {/* Academic Information */}
            <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-700 space-y-3">
              <h4 className="text-xs font-bold text-brand-primary-600 dark:text-brand-primary-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 pb-2">
                {t("registration.academicInfo", "Academic Information")}
              </h4>
              <div className="space-y-2 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-slate-400 block font-medium">
                      {t("auth.role", "Role")}
                    </span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 block mt-0.5">
                      {selectedRequest.role}
                    </span>
                  </div>
                  {selectedRequest.studentId && (
                    <div>
                      <span className="text-slate-400 block font-medium">
                        {t("auth.studentId", "Student ID Number")}
                      </span>
                      <span className="font-mono font-bold text-brand-primary-600 dark:text-brand-primary-400 block mt-0.5">
                        {selectedRequest.studentId}
                      </span>
                    </div>
                  )}
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">
                    {t("auth.college", "College")}
                  </span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 block mt-0.5">
                    {selectedRequest.department?.college?.name ||
                      selectedRequest.department?.college?.nameAr ||
                      (isRTL ? "غير محدد" : "Not assigned")}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">
                    {t("auth.department", "Department")}
                  </span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 block mt-0.5">
                    {selectedRequest.department?.name ||
                      selectedRequest.department?.nameAr ||
                      (isRTL ? "عام" : "General")}
                  </span>
                </div>
                {selectedRequest.year && (
                  <div>
                    <span className="text-slate-400 block font-medium">
                      {t("auth.year", "Academic Division")}
                    </span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 block mt-0.5">
                      {isRTL
                        ? selectedRequest.year === 1
                          ? "الفرقة الأولى"
                          : selectedRequest.year === 2
                            ? "الفرقة الثانية"
                            : selectedRequest.year === 3
                              ? "الفرقة الثالثة"
                              : selectedRequest.year === 4
                                ? "الفرقة الرابعة"
                                : `الفرقة ${selectedRequest.year}`
                        : `Division ${selectedRequest.year}`}
                    </span>
                  </div>
                )}
                <div>
                  <span className="text-slate-400 block font-medium">
                    {t("registration.appliedDate", "Applied Date")}
                  </span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 block mt-0.5">
                    {selectedRequest.createdAt
                      ? new Date(selectedRequest.createdAt).toLocaleString(
                          isRTL ? "ar-EG" : "en-US",
                        )
                      : "-"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-between gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-700">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDeleteClick(selectedRequest)}
              className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl text-xs font-bold gap-1.5 cursor-pointer"
            >
              <Trash2 size={14} />
              <span>{t("registration.deleteRequest", "Delete Request")}</span>
            </Button>

            <div className="flex items-center gap-2">
              {selectedRequest.status === "PENDING" && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenRejectModal(selectedRequest)}
                    className="text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 border-rose-200 dark:border-rose-800/50 rounded-xl text-xs font-bold"
                  >
                    {t("common.reject", "Reject")}
                  </Button>
                  <Button
                    size="sm"
                    onClick={async () => {
                      await handleApprove(selectedRequest.id);
                      setIsDetailsModalOpen(false);
                    }}
                    disabled={actionLoadingId === selectedRequest.id}
                    className="bg-brand-primary-500 hover:bg-brand-primary-600 text-white rounded-xl text-xs font-bold gap-1.5 shadow-xs"
                  >
                    {actionLoadingId === selectedRequest.id && (
                      <RotateCw size={14} className="animate-spin" />
                    )}
                    <span>{t("common.approve", "Approve")}</span>
                  </Button>
                </>
              )}
              {selectedRequest.status !== "PENDING" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsDetailsModalOpen(false)}
                  className="rounded-xl text-xs font-bold"
                >
                  {t("common.close", "Close")}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};
