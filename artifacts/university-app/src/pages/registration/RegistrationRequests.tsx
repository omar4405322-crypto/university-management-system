import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Clock,
  CheckCircle2,
  XCircle,
  Download,
  RotateCw,
  Check,
  X,
  GraduationCap,
  Users,
} from "lucide-react";

import Card from "../../components/ui/card";
import Button from "../../components/ui/button";
import { PageHeader } from "../../components/ui/PageHeader";
import { EmptyState } from "../../components/ui/EmptyState";
import ConfirmDeleteModal from "../../components/ui/ConfirmDeleteModal";
import Pagination from "../../components/ui/pagination";
import BulkActionToolbar from "../../components/ui/BulkActionToolbar";
import registrationService from "../../services/registration.service";
import collegeService from "../../services/college.service";
import { useToast } from "../../context/ToastContext";
import { useNotifications } from "../../context/NotificationContext";
import { downloadCsv } from "../../utils/exportCsv";
import { logger } from "../../lib/logger";

import {
  RegistrationRejectModal,
  PRESET_REASONS,
} from "./components/RegistrationRejectModal";
import { RegistrationDetailsModal } from "./components/RegistrationDetailsModal";
import { RegistrationKpiStats } from "./components/RegistrationKpiStats";
import { RegistrationFilterBar } from "./components/RegistrationFilterBar";
import { RegistrationRequestsTable } from "./components/RegistrationRequestsTable";
import { RegistrationRequestsCards } from "./components/RegistrationRequestsCards";

import type {
  RegistrationRequestItem,
  CollegeOption,
  RegistrationKpiCounts,
  StatusFilterType,
  ViewModeType,
  StatusBadgeConfig,
} from "./types";

const RegistrationRequests: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const { showToast } = useToast();
  const { fetchPendingRequestsCount } = useNotifications();

  // Data states
  const [requests, setRequests] = useState<RegistrationRequestItem[]>([]);
  const [colleges, setColleges] = useState<CollegeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filter & Search states - DEFAULT TO 'PENDING' FOR INBOX ZERO WORKFLOW
  const [statusFilter, setStatusFilter] = useState<StatusFilterType>("PENDING");
  const [search, setSearch] = useState("");
  const [selectedCollege, setSelectedCollege] = useState("ALL");
  const [selectedRole, setSelectedRole] = useState("ALL");
  const [viewMode, setViewMode] = useState<ViewModeType>("table");

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  // Batch selection states
  const [selectedIds, setSelectedIds] = useState<(string | number)[]>([]);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // Single action states
  const [actionLoadingId, setActionLoadingId] = useState<string | number | null>(null);

  // Modals
  const [selectedRequest, setSelectedRequest] =
    useState<RegistrationRequestItem | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  const [rejectTarget, setRejectTarget] =
    useState<RegistrationRequestItem | null>(null);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [selectedPresetReason, setSelectedPresetReason] = useState<string>("");
  const [customRejectionReason, setCustomRejectionReason] =
    useState<string>("");

  // Delete states
  const [deleteTarget, setDeleteTarget] =
    useState<RegistrationRequestItem | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [showBulkRejectModal, setShowBulkRejectModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    const mainEl = document.querySelector("main");
    if (mainEl) {
      mainEl.classList.add("bg-slate-50", "dark:bg-slate-900");
    }
    return () => {
      if (mainEl) {
        mainEl.classList.remove("bg-slate-50", "dark:bg-slate-900");
      }
    };
  }, []);

  const fetchRequests = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        const [resRequests, resColleges] = await Promise.all([
          registrationService.getRequests(),
          collegeService
            .getColleges()
            .catch(() => ({ success: false, data: [] })),
        ]);

        if (resRequests.success && Array.isArray(resRequests.data)) {
          setRequests(resRequests.data as RegistrationRequestItem[]);
        } else {
          setRequests([]);
        }

        if (resColleges.success && Array.isArray(resColleges.data)) {
          setColleges(resColleges.data as CollegeOption[]);
        }
      } catch (error: unknown) {
        logger.error("Error fetching registration requests:", error);
        showToast(t("common.errorFetching", "Error fetching data"), "error");
        setRequests([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
        fetchPendingRequestsCount();
      }
    },
    [showToast, t, fetchPendingRequestsCount],
  );

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Derived KPI Counts
  const counts: RegistrationKpiCounts = useMemo(() => {
    const total = requests.length;
    const pending = requests.filter((r) => r.status === "PENDING").length;
    const approved = requests.filter((r) => r.status === "APPROVED").length;
    const rejected = requests.filter((r) => r.status === "REJECTED").length;
    return { total, pending, approved, rejected };
  }, [requests]);

  // Reset page and selection when filters change
  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds([]);
  }, [search, statusFilter, selectedCollege, selectedRole]);

  // Filtered requests
  const filteredRequests = useMemo(() => {
    const query = search.trim().toLowerCase();

    return requests.filter((req) => {
      if (statusFilter !== "ALL" && req.status !== statusFilter) {
        return false;
      }

      if (selectedCollege !== "ALL") {
        const collegeId =
          req.department?.collegeId || req.department?.college?.id;
        if (String(collegeId) !== String(selectedCollege)) {
          return false;
        }
      }

      if (selectedRole !== "ALL" && req.role !== selectedRole) {
        return false;
      }

      if (query) {
        const fullName =
          `${req.firstName || ""} ${req.lastName || ""}`.toLowerCase();
        const email = (req.email || "").toLowerCase();
        const studentId = (req.studentId || "").toLowerCase();
        const collegeName = (req.department?.college?.name || "").toLowerCase();
        const deptName = (req.department?.name || "").toLowerCase();

        return (
          fullName.includes(query) ||
          email.includes(query) ||
          studentId.includes(query) ||
          collegeName.includes(query) ||
          deptName.includes(query)
        );
      }

      return true;
    });
  }, [requests, statusFilter, selectedCollege, selectedRole, search]);

  // Paginated requests
  const totalPages = Math.ceil(filteredRequests.length / pageSize) || 1;
  const paginatedRequests = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRequests.slice(start, start + pageSize);
  }, [filteredRequests, currentPage, pageSize]);

  // Selection handlers
  const isAllVisibleSelected =
    paginatedRequests.length > 0 &&
    paginatedRequests.every((req) => selectedIds.includes(req.id));

  const handleSelectAll = () => {
    if (isAllVisibleSelected) {
      const visibleIds = new Set(paginatedRequests.map((r) => r.id));
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.has(id)));
    } else {
      const visibleIds = paginatedRequests.map((r) => r.id);
      setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const handleSelectOne = (id: string | number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  // Actions: Approve
  const handleApprove = async (id: string | number) => {
    try {
      setActionLoadingId(id);
      const result = await registrationService.approveRequest(id);
      if (result.success) {
        showToast(
          t("registration.approveSuccess", "Request approved successfully"),
          "success",
        );
        await fetchRequests();
      }
    } catch (error: any) {
      showToast(
        error.response?.data?.message ||
          t("registration.approveError", "Error approving request"),
        "error",
      );
    } finally {
      setActionLoadingId(null);
    }
  };

  // Actions: Open Reject Modal
  const handleOpenRejectModal = (req: RegistrationRequestItem) => {
    setRejectTarget(req);
    setSelectedPresetReason(PRESET_REASONS[0]);
    setCustomRejectionReason("");
    setIsRejectModalOpen(true);
  };

  // Actions: Confirm Reject
  const handleConfirmReject = async () => {
    if (!rejectTarget) return;

    const finalReason =
      customRejectionReason.trim() ||
      (selectedPresetReason
        ? t(selectedPresetReason)
        : t("registration.rejectionReasonPreset1"));

    try {
      setActionLoadingId(rejectTarget.id);
      const result = await registrationService.rejectRequest(
        rejectTarget.id,
        finalReason,
      );
      if (result.success) {
        showToast(
          t("registration.rejectSuccess", "Request rejected successfully"),
          "success",
        );
        setIsRejectModalOpen(false);
        setRejectTarget(null);
        if (isDetailsModalOpen && selectedRequest?.id === rejectTarget.id) {
          setIsDetailsModalOpen(false);
        }
        await fetchRequests();
      }
    } catch (error: any) {
      showToast(
        error.response?.data?.message ||
          t("registration.rejectError", "Error rejecting request"),
        "error",
      );
    } finally {
      setActionLoadingId(null);
    }
  };

  // Batch Actions: Bulk Approve
  const handleBulkApprove = async () => {
    if (selectedIds.length === 0) return;
    const pendingSelected = requests.filter(
      (r) => selectedIds.includes(r.id) && r.status === "PENDING",
    );

    if (pendingSelected.length === 0) {
      showToast(
        isRTL
          ? "الطلبات المحددة تمت معالجتها مسبقاً"
          : "Selected requests are already processed",
        "info",
      );
      return;
    }

    try {
      setBulkActionLoading(true);
      let successCount = 0;
      for (const req of pendingSelected) {
        try {
          const res = await registrationService.approveRequest(req.id);
          if (res.success) successCount++;
        } catch (e) {
          logger.error(`Failed to bulk approve request #${req.id}`, e);
        }
      }

      showToast(
        t("registration.bulkApproveSuccess", {
          count: successCount,
          defaultValue: `تمت الموافقة على ${successCount} طلبات بنجاح`,
        }),
        "success",
      );
      setSelectedIds([]);
      await fetchRequests();
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Batch Actions: Bulk Reject
  const handleBulkReject = () => {
    if (selectedIds.length === 0) return;
    const pendingSelected = requests.filter(
      (r) => selectedIds.includes(r.id) && r.status === "PENDING",
    );

    if (pendingSelected.length === 0) {
      showToast(
        isRTL
          ? "الطلبات المحددة تمت معالجتها مسبقاً"
          : "Selected requests are already processed",
        "info",
      );
      return;
    }

    setShowBulkRejectModal(true);
  };

  const handleConfirmBulkReject = async () => {
    const pendingSelected = requests.filter(
      (r) => selectedIds.includes(r.id) && r.status === "PENDING",
    );
    if (pendingSelected.length === 0) {
      setShowBulkRejectModal(false);
      return;
    }

    try {
      setBulkActionLoading(true);
      let successCount = 0;
      for (const req of pendingSelected) {
        try {
          const res = await registrationService.rejectRequest(
            req.id,
            isRTL
              ? "تم الرفض بواسطة الإدارة"
              : "Rejected via administrative bulk action",
          );
          if (res.success) successCount++;
        } catch (e) {
          logger.error(`Failed to bulk reject request #${req.id}`, e);
        }
      }

      showToast(
        t("registration.bulkRejectSuccess", {
          count: successCount,
          defaultValue: `تم رفض ${successCount} طلبات بنجاح`,
        }),
        "success",
      );
      setSelectedIds([]);
      setShowBulkRejectModal(false);
      await fetchRequests();
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Actions: Single Delete
  const handleDeleteClick = (req: RegistrationRequestItem) => {
    setDeleteTarget(req);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmSingleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleteLoading(true);
      const res = await registrationService.deleteRequest(deleteTarget.id);
      if (res.success) {
        showToast(
          t(
            "registration.deleteSuccess",
            "Registration request deleted successfully",
          ),
          "success",
        );
        setIsDeleteModalOpen(false);
        setDeleteTarget(null);
        if (isDetailsModalOpen && selectedRequest?.id === deleteTarget.id) {
          setIsDetailsModalOpen(false);
        }
        await fetchRequests();
      }
    } catch (error: any) {
      showToast(
        error.response?.data?.message ||
          t("registration.deleteError", "Error deleting registration request"),
        "error",
      );
    } finally {
      setDeleteLoading(false);
    }
  };

  // Actions: Bulk Delete
  const handleConfirmBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    try {
      setDeleteLoading(true);
      let successCount = 0;
      for (const id of selectedIds) {
        try {
          const res = await registrationService.deleteRequest(id);
          if (res.success) successCount++;
        } catch (e) {
          logger.error(`Failed to delete request #${id}`, e);
        }
      }

      showToast(
        t("registration.bulkDeleteSuccess", {
          count: successCount,
          defaultValue: `تم حذف ${successCount} طلبات تسجيل بنجاح`,
        }),
        "success",
      );
      setShowBulkDeleteModal(false);
      setSelectedIds([]);
      await fetchRequests();
    } finally {
      setDeleteLoading(false);
    }
  };

  // Export to CSV
  const handleExportCsv = () => {
    const listToExport =
      selectedIds.length > 0
        ? requests.filter((r) => selectedIds.includes(r.id))
        : filteredRequests;

    if (listToExport.length === 0) {
      showToast(
        isRTL ? "لا توجد بيانات لتصديرها" : "No data to export",
        "info",
      );
      return;
    }

    const headers = isRTL
      ? [
          "رقم الطلب",
          "الاسم الأول",
          "اسم العائلة",
          "البريد الإلكتروني",
          "رقم الهاتف",
          "الرقم الأكاديمي",
          "الدور",
          "الكلية",
          "القسم",
          "الفرقة الدراسية",
          "الحالة",
          "سبب الرفض",
          "تاريخ التقديم",
        ]
      : [
          "Request ID",
          "First Name",
          "Last Name",
          "Email",
          "Phone",
          "Student ID",
          "Role",
          "College",
          "Department",
          "Academic Division",
          "Status",
          "Rejection Reason",
          "Applied Date",
        ];

    const rows = listToExport.map((req) => [
      req.id,
      req.firstName || "",
      req.lastName || "",
      req.email || "",
      req.phone || "",
      req.studentId || "",
      req.role || "",
      req.department?.college?.name || req.department?.college?.nameAr || "",
      req.department?.name || req.department?.nameAr || "",
      req.year ? `Year ${req.year}` : "",
      req.status || "",
      req.rejectionReason || "",
      req.createdAt ? new Date(req.createdAt).toISOString().split("T")[0] : "",
    ]);

    const filename = `${t("registration.exportFileName", "Registration_Requests")}_${
      new Date().toISOString().split("T")[0]
    }.csv`;

    downloadCsv(filename, headers, rows);
    showToast(
      isRTL ? "تم تصدير ملف CSV بنجاح" : "CSV file exported successfully",
      "success",
    );
  };

  const handleView = (req: RegistrationRequestItem) => {
    setSelectedRequest(req);
    setIsDetailsModalOpen(true);
  };

  const getStatusBadge = (status: string): StatusBadgeConfig => {
    switch (status) {
      case "APPROVED":
        return {
          label: isRTL ? "تمت الموافقة" : "Approved",
          icon: CheckCircle2,
          className:
            "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50",
          dotClass: "bg-emerald-500",
        };
      case "PENDING":
        return {
          label: isRTL ? "بانتظار المراجعة" : "Pending",
          icon: Clock,
          className:
            "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50",
          dotClass: "bg-amber-500 animate-pulse",
        };
      case "REJECTED":
        return {
          label: isRTL ? "مرفوض" : "Rejected",
          icon: XCircle,
          className:
            "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50",
          dotClass: "bg-rose-500",
        };
      default:
        return {
          label: status,
          icon: Clock,
          className:
            "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
          dotClass: "bg-slate-400",
        };
    }
  };

  const handleClearFilters = () => {
    setSearch("");
    setStatusFilter("ALL");
    setSelectedCollege("ALL");
    setSelectedRole("ALL");
  };

  return (
    <div className="section-gap animate-page pt-4 pb-12 space-y-6">
      {/* 1. Page Header with Action Bar */}
      <PageHeader
        title={
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-brand-primary-50 dark:bg-brand-primary-950/40 text-brand-primary-600 dark:text-brand-primary-400 border border-brand-primary-200/50 dark:border-brand-primary-800/40 shadow-xs">
              <GraduationCap size={26} />
            </div>
            <div>
              <span className="font-extrabold text-slate-900 dark:text-white text-2xl sm:text-3xl tracking-tight">
                {t("registration.title", "Registration Requests")}
              </span>
              {counts.pending > 0 && (
                <span className="ms-2.5 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-white shadow-xs animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                  {counts.pending} {isRTL ? "جديد" : "New"}
                </span>
              )}
            </div>
          </div>
        }
        subtitle={
          <span className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed block mt-1">
            {t(
              "registration.subtitle",
              "Review and manage student registration and enrollment applications.",
            )}
          </span>
        }
        extraActions={
          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchRequests(true)}
              disabled={refreshing}
              className="h-10 px-4 rounded-xl border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs gap-2 shrink-0 shadow-2xs cursor-pointer"
            >
              <RotateCw
                size={15}
                className={
                  refreshing ? "animate-spin text-brand-primary-500" : ""
                }
              />
              <span>{isRTL ? "تحديث" : "Refresh"}</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              className="h-10 px-4 rounded-xl border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs gap-2 shrink-0 shadow-2xs cursor-pointer"
            >
              <Download size={15} />
              <span>{t("registration.export", "Export CSV")}</span>
            </Button>
          </div>
        }
      />

      {/* 2. Executive 4-Metric Ribbon */}
      <RegistrationKpiStats
        counts={counts}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        isRTL={isRTL}
      />

      {/* 3. Filter & Search Controls Card */}
      <RegistrationFilterBar
        search={search}
        setSearch={setSearch}
        selectedCollege={selectedCollege}
        setSelectedCollege={setSelectedCollege}
        selectedRole={selectedRole}
        setSelectedRole={setSelectedRole}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        colleges={colleges}
        viewMode={viewMode}
        setViewMode={setViewMode}
        isRTL={isRTL}
      />

      {/* 4. Main Data Display: Table or Cards */}
      <div className="space-y-4">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center">
            <RotateCw
              size={36}
              className="animate-spin text-brand-primary-500 mb-4"
            />
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
              {t("common.loading", "Loading...")}
            </p>
          </div>
        ) : filteredRequests.length === 0 ? (
          <EmptyState
            icon={<Users size={32} />}
            title={
              statusFilter === "PENDING" && !search
                ? isRTL
                  ? "لا توجد طلبات معلقة بانتظار المراجعة"
                  : "All caught up! No pending requests"
                : t("registration.noRequests", "No registration requests found")
            }
            subtitle={
              statusFilter === "PENDING" && !search
                ? isRTL
                  ? "صندوق البريد خالي تماماً، تم التدقيق في جميع الطلبات المقدمة."
                  : "Zero pending inbox! All submissions have been processed."
                : t(
                    "registration.noRequestsDesc",
                    "Try adjusting your filters, search keyword, or status filter.",
                  )
            }
            action={
              statusFilter !== "ALL" || search
                ? {
                    label: isRTL ? "عرض كافة الطلبات" : "View All Requests",
                    onClick: handleClearFilters,
                  }
                : undefined
            }
          />
        ) : viewMode === "table" ? (
          <RegistrationRequestsTable
            requests={paginatedRequests}
            selectedIds={selectedIds}
            isAllVisibleSelected={isAllVisibleSelected}
            handleSelectAll={handleSelectAll}
            handleSelectOne={handleSelectOne}
            handleView={handleView}
            handleOpenRejectModal={handleOpenRejectModal}
            handleApprove={handleApprove}
            handleDeleteClick={handleDeleteClick}
            actionLoadingId={actionLoadingId}
            getStatusBadge={getStatusBadge}
            isRTL={isRTL}
          />
        ) : (
          <RegistrationRequestsCards
            requests={paginatedRequests}
            selectedIds={selectedIds}
            onSelectOne={handleSelectOne}
            onView={handleView}
            onApprove={handleApprove}
            onReject={handleOpenRejectModal}
            onDelete={handleDeleteClick}
            actionLoadingId={actionLoadingId}
            getStatusBadge={getStatusBadge}
            isRTL={isRTL}
            t={t}
          />
        )}

        {/* 5. Pagination Footer */}
        {filteredRequests.length > 0 && (
          <div className="mt-6">
            <Card
              noPadding
              className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-2xs"
            >
              <Pagination
                page={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                total={filteredRequests.length}
                pageSize={pageSize}
                onPageSizeChange={(newSize) => {
                  setPageSize(newSize);
                  setCurrentPage(1);
                }}
              />
            </Card>
          </div>
        )}
      </div>

      {/* 6. Floating Bulk Action Toolbar */}
      <BulkActionToolbar
        selectedCount={selectedIds.length}
        onClear={() => setSelectedIds([])}
        onExport={handleExportCsv}
        onDelete={() => setShowBulkDeleteModal(true)}
        actions={[
          {
            label: isRTL ? "قبول المحدد" : "Approve Selected",
            icon: Check,
            variant: "ghost",
            className:
              "text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30",
            onClick: handleBulkApprove,
          },
          {
            label: isRTL ? "رفض المحدد" : "Reject Selected",
            icon: X,
            variant: "ghost",
            className:
              "text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30",
            onClick: handleBulkReject,
          },
        ]}
      />

      {/* 7. Structured Rejection Reason Modal */}
      <RegistrationRejectModal
        isOpen={isRejectModalOpen}
        onClose={() => {
          setIsRejectModalOpen(false);
          setRejectTarget(null);
        }}
        rejectTarget={rejectTarget}
        selectedPresetReason={selectedPresetReason}
        setSelectedPresetReason={setSelectedPresetReason}
        customRejectionReason={customRejectionReason}
        setCustomRejectionReason={setCustomRejectionReason}
        handleConfirmReject={handleConfirmReject}
        actionLoadingId={actionLoadingId}
        isRTL={isRTL}
      />

      {/* 8. Detailed Applicant Profile Modal */}
      <RegistrationDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => {
          setIsDetailsModalOpen(false);
          setSelectedRequest(null);
        }}
        selectedRequest={selectedRequest}
        getStatusBadge={getStatusBadge}
        handleDeleteClick={handleDeleteClick}
        handleOpenRejectModal={handleOpenRejectModal}
        handleApprove={handleApprove}
        actionLoadingId={actionLoadingId}
        setIsDetailsModalOpen={setIsDetailsModalOpen}
        isRTL={isRTL}
      />

      {/* 9. Single Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setDeleteTarget(null);
        }}
        onConfirm={handleConfirmSingleDelete}
        loading={deleteLoading}
        title={t("registration.deleteRequest", "Delete Request")}
        itemName={
          deleteTarget
            ? `${deleteTarget.firstName} ${deleteTarget.lastName} (${deleteTarget.email})`
            : ""
        }
        message={
          isRTL
            ? `هل أنت متأكد من حذف طلب تسجيل "${deleteTarget?.firstName} ${deleteTarget?.lastName}" نهائياً من قاعدة البيانات؟`
            : `Are you sure you want to permanently delete registration request for "${deleteTarget?.firstName} ${deleteTarget?.lastName}"?`
        }
      />

      {/* 10. Bulk Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={showBulkDeleteModal}
        onClose={() => setShowBulkDeleteModal(false)}
        onConfirm={handleConfirmBulkDelete}
        loading={deleteLoading}
        title={t("registration.bulkDelete", "Delete Selected")}
        message={
          isRTL
            ? `هل أنت متأكد من حذف ${selectedIds.length} طلبات تسجيل محددة نهائياً من قاعدة البيانات؟ لا يمكن التراجع عن هذا الإجراء.`
            : `Are you sure you want to permanently delete ${selectedIds.length} selected registration requests? This action cannot be undone.`
        }
      />

      {/* 11. Bulk Reject Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={showBulkRejectModal}
        onClose={() => setShowBulkRejectModal(false)}
        onConfirm={handleConfirmBulkReject}
        loading={bulkActionLoading}
        title={t("registration.bulkReject", "Reject Selected")}
        message={
          isRTL
            ? `هل أنت متأكد من رفض ${requests.filter((r) => selectedIds.includes(r.id) && r.status === "PENDING").length} طلبات تسجيل محددة؟`
            : `Are you sure you want to reject ${requests.filter((r) => selectedIds.includes(r.id) && r.status === "PENDING").length} selected requests?`
        }
        variant="warning"
        confirmLabel={t("registration.reject", "Reject")}
      />
    </div>
  );
};

export default RegistrationRequests;
