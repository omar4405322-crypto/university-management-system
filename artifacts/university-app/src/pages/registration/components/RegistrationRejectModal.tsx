import React from "react";
import { User, AlertTriangle, RotateCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import Modal from "../../../components/ui/Modal";
import Button from "../../../components/ui/button";

export const PRESET_REASONS = [
  "registration.rejectionReasonPreset1",
  "registration.rejectionReasonPreset2",
  "registration.rejectionReasonPreset3",
  "registration.rejectionReasonPreset4",
];

interface RegistrationRejectModalProps {
  isOpen: boolean;
  onClose: () => void;
  rejectTarget: any;
  selectedPresetReason: string;
  setSelectedPresetReason: (reason: string) => void;
  customRejectionReason: string;
  setCustomRejectionReason: (reason: string) => void;
  handleConfirmReject: () => void;
  actionLoadingId: string | number | null;
  isRTL: boolean;
}

export const RegistrationRejectModal: React.FC<RegistrationRejectModalProps> = ({
  isOpen,
  onClose,
  rejectTarget,
  selectedPresetReason,
  setSelectedPresetReason,
  customRejectionReason,
  setCustomRejectionReason,
  handleConfirmReject,
  actionLoadingId,
  isRTL,
}) => {
  const { t } = useTranslation();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("registration.rejectTitle", "Reject Registration Request")}
    >
      {rejectTarget && (
        <div className="space-y-4 text-start">
          {/* Target Student Preview */}
          <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-700">
            <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <User size={18} />
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-bold text-slate-800 dark:text-white truncate">
                {rejectTarget.firstName} {rejectTarget.lastName}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {rejectTarget.email}
              </p>
            </div>
          </div>

          {/* Quick Preset Reasons */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2.5">
              {isRTL
                ? "أسباب شائعة للرفض السريع:"
                : "Common Rejection Reasons:"}
            </label>
            <div className="space-y-2">
              {PRESET_REASONS.map((presetKey) => (
                <button
                  key={presetKey}
                  type="button"
                  onClick={() => {
                    setSelectedPresetReason(presetKey);
                    setCustomRejectionReason("");
                  }}
                  className={`w-full text-start p-3 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                    selectedPresetReason === presetKey
                      ? "border-brand-primary-500 bg-brand-primary-50 dark:bg-brand-primary-950/40 text-brand-primary-700 dark:text-brand-primary-300 ring-1 ring-brand-primary-500"
                      : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  {t(presetKey)}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Reason Input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              {isRTL
                ? "أو كتابة ملاحظات مخصصة:"
                : "Or custom explanation notes:"}
            </label>
            <textarea
              rows={3}
              value={customRejectionReason}
              onChange={(e) => {
                setCustomRejectionReason(e.target.value);
                setSelectedPresetReason("");
              }}
              placeholder={t(
                "registration.rejectionReasonPlaceholder",
                "Type a rejection reason or select a preset option below...",
              )}
              className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-medium text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all resize-none"
            />
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-700">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="rounded-xl text-xs font-bold"
            >
              {t("common.cancel", "Cancel")}
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmReject}
              disabled={actionLoadingId === rejectTarget.id}
              className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold gap-1.5 shadow-xs"
            >
              {actionLoadingId === rejectTarget.id && (
                <RotateCw size={14} className="animate-spin" />
              )}
              <span>
                {t("registration.confirmReject", "Confirm Rejection")}
              </span>
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};
