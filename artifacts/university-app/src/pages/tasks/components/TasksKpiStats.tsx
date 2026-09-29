import React from "react";
import { useTranslation } from "react-i18next";
import { ClipboardList, Clock, Users, AlertTriangle } from "lucide-react";
import { StatCard } from "../../../components/ui/card";

export interface TasksKpiStatsProps {
  total: number;
  active: number;
  submissionsCount: number;
  overdue: number;
  isDoctor: boolean;
  isRTL: boolean;
}

export const TasksKpiStats: React.FC<TasksKpiStatsProps> = ({
  total,
  active,
  submissionsCount,
  overdue,
  isDoctor,
  isRTL,
}) => {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
      <StatCard
        compact
        title={t("tasks.totalTasks", "Total Assignments")}
        value={total}
        icon={ClipboardList}
        color="primary"
      />

      <StatCard
        compact
        title={t("tasks.activeTasks", "Active Assignments")}
        value={active}
        icon={Clock}
        color="emerald"
      />

      <StatCard
        compact
        title={
          isDoctor
            ? t("tasks.submissions", "Submissions")
            : t("tasks.statusSubmitted", "Submitted")
        }
        value={submissionsCount}
        icon={Users}
        color="blue"
      />

      <StatCard
        compact
        title={t("tasks.overdueTasks", "Overdue Assignments")}
        value={overdue}
        icon={AlertTriangle}
        color="rose"
        alert={overdue > 0}
        alertLabel={isRTL ? "متأخر" : "Overdue"}
      />
    </div>
  );
};
