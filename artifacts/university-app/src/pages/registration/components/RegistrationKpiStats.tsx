import React from "react";
import { useTranslation } from "react-i18next";
import { Clock, CheckCircle2, XCircle, Users } from "lucide-react";
import { StatCard } from "../../../components/ui/card";
import type { RegistrationKpiCounts, StatusFilterType } from "../types";

interface RegistrationKpiStatsProps {
  counts: RegistrationKpiCounts;
  statusFilter: StatusFilterType;
  setStatusFilter: (filter: StatusFilterType) => void;
  isRTL: boolean;
}

export const RegistrationKpiStats: React.FC<RegistrationKpiStatsProps> = ({
  counts,
  statusFilter,
  setStatusFilter,
  isRTL,
}) => {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
      <StatCard
        compact
        title={t("registration.pendingReview", "Pending Review")}
        value={counts.pending}
        icon={Clock}
        color="amber"
        alert={counts.pending > 0}
        alertLabel={isRTL ? "معلق" : "Pending"}
        isActive={statusFilter === "PENDING"}
        onClick={() =>
          setStatusFilter(statusFilter === "PENDING" ? "ALL" : "PENDING")
        }
      />

      <StatCard
        compact
        title={t("registration.approvedTotal", "Approved Requests")}
        value={counts.approved}
        icon={CheckCircle2}
        color="emerald"
        isActive={statusFilter === "APPROVED"}
        onClick={() =>
          setStatusFilter(statusFilter === "APPROVED" ? "ALL" : "APPROVED")
        }
      />

      <StatCard
        compact
        title={t("registration.rejectedTotal", "Rejected Requests")}
        value={counts.rejected}
        icon={XCircle}
        color="rose"
        isActive={statusFilter === "REJECTED"}
        onClick={() =>
          setStatusFilter(statusFilter === "REJECTED" ? "ALL" : "REJECTED")
        }
      />

      <StatCard
        compact
        title={t("registration.totalRegistrations", "Total Registrations")}
        value={counts.total}
        icon={Users}
        color="primary"
        isActive={statusFilter === "ALL"}
        onClick={() => setStatusFilter("ALL")}
      />
    </div>
  );
};
