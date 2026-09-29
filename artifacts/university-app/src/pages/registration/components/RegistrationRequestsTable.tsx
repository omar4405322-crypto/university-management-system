import React from "react";
import { useTranslation } from "react-i18next";
import { Building2, Eye, X, Check, Trash2, RotateCw } from "lucide-react";
import Card from "../../../components/ui/card";
import Badge from "../../../components/ui/badge";
import Table, {
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "../../../components/ui/table";
import type { RegistrationRequestItem } from "../types";

interface RegistrationRequestsTableProps {
  requests: RegistrationRequestItem[];
  selectedIds: (string | number)[];
  isAllVisibleSelected: boolean;
  handleSelectAll: () => void;
  handleSelectOne: (id: string | number) => void;
  handleView: (req: RegistrationRequestItem) => void;
  handleOpenRejectModal: (req: RegistrationRequestItem) => void;
  handleApprove: (id: string | number) => Promise<void>;
  handleDeleteClick: (req: RegistrationRequestItem) => void;
  actionLoadingId: string | number | null;
  getStatusBadge: (status: string) => {
    label: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    className: string;
    dotClass: string;
  };
  isRTL: boolean;
}

export const RegistrationRequestsTable: React.FC<RegistrationRequestsTableProps> = ({
  requests,
  selectedIds,
  isAllVisibleSelected,
  handleSelectAll,
  handleSelectOne,
  handleView,
  handleOpenRejectModal,
  handleApprove,
  handleDeleteClick,
  actionLoadingId,
  getStatusBadge,
  isRTL,
}) => {
  const { t } = useTranslation();

  return (
    <Card className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-700 shadow-xs overflow-hidden p-0">
      <div className="overflow-x-auto">
        <Table className="w-full">
          <TableHeader className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200/80 dark:border-slate-700/80">
            <TableRow>
              <TableHead className="w-12 text-center p-3.5">
                <input
                  type="checkbox"
                  aria-label={isRTL ? "تحديد الكل" : "Select all"}
                  className="rounded border-slate-300 dark:border-slate-700 text-brand-primary-600 focus:ring-brand-primary-500/20 w-4 h-4 cursor-pointer align-middle"
                  checked={isAllVisibleSelected}
                  onChange={handleSelectAll}
                />
              </TableHead>
              <TableHead className="text-start p-3.5 font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {isRTL ? "مقدم الطلب" : "Applicant"}
              </TableHead>
              <TableHead className="text-start p-3.5 font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {isRTL ? "الكلية والقسم" : "College & Dept"}
              </TableHead>
              <TableHead className="text-center p-3.5 font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {isRTL ? "الرقم الأكاديمي" : "Student ID"}
              </TableHead>
              <TableHead className="text-center p-3.5 font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {isRTL ? "تاريخ التقديم" : "Applied Date"}
              </TableHead>
              <TableHead className="text-center p-3.5 font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {isRTL ? "الحالة" : "Status"}
              </TableHead>
              <TableHead className="text-end p-3.5 font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 pe-6">
                {isRTL ? "الإجراءات" : "Actions"}
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {requests.map((req) => {
              const isSelected = selectedIds.includes(req.id);
              const statusConfig = getStatusBadge(req.status);
              const collegeName =
                req.department?.college?.name || req.department?.college?.nameAr;
              const deptName = req.department?.name || req.department?.nameAr;
              const isActioning = actionLoadingId === req.id;

              return (
                <TableRow
                  key={req.id}
                  className={`transition-colors hover:bg-slate-50/75 dark:hover:bg-slate-700/30 ${
                    isSelected
                      ? "bg-brand-primary-50/40 dark:bg-brand-primary-950/20"
                      : ""
                  }`}
                >
                  {/* Checkbox */}
                  <TableCell className="w-12 text-center p-3.5">
                    <input
                      type="checkbox"
                      aria-label={
                        isRTL
                          ? `تحديد ${req.firstName} ${req.lastName}`
                          : `Select ${req.firstName} ${req.lastName}`
                      }
                      className="rounded border-slate-300 dark:border-slate-700 text-brand-primary-600 focus:ring-brand-primary-500/20 w-4 h-4 cursor-pointer align-middle"
                      checked={isSelected}
                      onChange={() => handleSelectOne(req.id)}
                    />
                  </TableCell>

                  {/* Applicant Name & Email */}
                  <TableCell className="p-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-primary-500 to-brand-primary-600 text-white font-bold text-xs flex items-center justify-center shadow-xs shrink-0">
                        {req.firstName?.[0] || "U"}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-900 dark:text-white text-sm truncate">
                            {req.firstName} {req.lastName}
                          </span>
                          {req.role && (
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 rounded-md font-semibold border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                            >
                              {req.role}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-400 mt-0.5">
                          <span className="truncate">{req.email}</span>
                          {req.phone && (
                            <>
                              <span>•</span>
                              <span>{req.phone}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </TableCell>

                  {/* College & Department */}
                  <TableCell className="p-3.5">
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 truncate">
                        <Building2 size={13} className="text-slate-400 shrink-0" />
                        <span className="truncate">
                          {collegeName || (isRTL ? "غير محدد" : "Not assigned")}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 ps-4 truncate">
                        {deptName || (isRTL ? "غير محدد" : "General")}
                      </div>
                    </div>
                  </TableCell>

                  {/* Student ID / Year */}
                  <TableCell className="p-3.5 text-center">
                    {req.studentId ? (
                      <div className="space-y-0.5 inline-block">
                        <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-700/60 px-2 py-0.5 rounded-md block">
                          {req.studentId}
                        </span>
                        {req.year && (
                          <span className="text-[10px] text-slate-400 block font-medium">
                            {isRTL
                              ? req.year === 1
                                ? "الفرقة الأولى"
                                : req.year === 2
                                  ? "الفرقة الثانية"
                                  : req.year === 3
                                    ? "الفرقة الثالثة"
                                    : req.year === 4
                                      ? "الفرقة الرابعة"
                                      : `الفرقة ${req.year}`
                              : `Division ${req.year}`}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">-</span>
                    )}
                  </TableCell>

                  {/* Applied Date */}
                  <TableCell className="p-3.5 text-center">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300 block">
                      {req.createdAt
                        ? new Date(req.createdAt).toLocaleDateString(
                            isRTL ? "ar-EG" : "en-US",
                          )
                        : "-"}
                    </span>
                  </TableCell>

                  {/* Status Badge */}
                  <TableCell className="p-3.5 text-center">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border shadow-2xs">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${statusConfig.dotClass}`}
                      ></span>
                      <span className={statusConfig.className.split(" ")[1] || ""}>
                        {statusConfig.label}
                      </span>
                    </div>
                    {req.status === "REJECTED" && req.rejectionReason && (
                      <p
                        className="text-[10px] text-rose-500 dark:text-rose-400 mt-1 max-w-[140px] truncate mx-auto"
                        title={req.rejectionReason}
                      >
                        {req.rejectionReason}
                      </p>
                    )}
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="p-3.5 text-end pe-4">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => handleView(req)}
                        title={t("common.view", "View")}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-brand-primary-600 hover:bg-brand-primary-50 dark:hover:bg-brand-primary-950/30 transition-colors cursor-pointer"
                      >
                        <Eye size={16} />
                      </button>

                      {req.status === "PENDING" && (
                        <>
                          <button
                            onClick={() => handleOpenRejectModal(req)}
                            disabled={isActioning}
                            title={t("common.reject", "Reject")}
                            className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <X size={16} />
                          </button>
                          <button
                            onClick={() => handleApprove(req.id)}
                            disabled={isActioning}
                            title={t("common.approve", "Approve")}
                            className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            {isActioning ? (
                              <RotateCw size={16} className="animate-spin" />
                            ) : (
                              <Check size={16} />
                            )}
                          </button>
                        </>
                      )}

                      <button
                        onClick={() => handleDeleteClick(req)}
                        title={t(
                          "registration.deleteRequest",
                          "Delete Request",
                        )}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
};
