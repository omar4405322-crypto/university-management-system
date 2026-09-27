import React from "react";
import { Search, Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import Card from "../../../components/ui/card";
import Button from "../../../components/ui/button";

interface CourseRosterTabProps {
  enrolledStudents: any[];
  rosterSearch: string;
  setRosterSearch: (search: string) => void;
  filteredRoster: any[];
  canManageRoster: boolean;
  setShowEnrollModal: (show: boolean) => void;
  setWithdrawTarget: (target: { id: number; name: string } | null) => void;
}

export const CourseRosterTab: React.FC<CourseRosterTabProps> = ({
  enrolledStudents,
  rosterSearch,
  setRosterSearch,
  filteredRoster,
  canManageRoster,
  setShowEnrollModal,
  setWithdrawTarget,
}) => {
  const { t } = useTranslation();

  return (
    <Card className="p-6 space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-black text-brand-text-main">
            {t("courses.roster", "Enrolled Students")}
          </h3>
          <p className="text-xs text-brand-text-sub">
            {t("common.total", "common.total")}: {enrolledStudents.length}{" "}
            {t("courses.students", "Students")}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search
              className="absolute start-3 top-1/2 -translate-y-1/2 text-brand-text-muted pointer-events-none"
              size={16}
            />
            <input
              type="text"
              placeholder={t("common.searchPlaceholder", "Search...")}
              value={rosterSearch}
              onChange={(e) => setRosterSearch(e.target.value)}
              className="w-full ps-9 pe-4 py-2 rounded-xl bg-brand-bg-page border border-brand-border text-sm text-brand-text-main focus:outline-none focus:border-brand-primary-500 font-medium"
            />
          </div>

          {canManageRoster && (
            <Button
              onClick={() => setShowEnrollModal(true)}
              className="rounded-xl flex items-center justify-center gap-2 text-xs font-bold shrink-0 shadow-sm"
            >
              <Plus size={16} />
              <span>{t("courses.addStudent", "Add Student")}</span>
            </Button>
          )}
        </div>
      </div>

      {filteredRoster.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-start text-sm">
            <thead className="bg-brand-bg-page text-brand-text-muted text-xs font-bold uppercase border-b border-brand-border">
              <tr>
                <th className="py-3 px-4 text-start">#</th>
                <th className="py-3 px-4 text-start">
                  {t("auth.fullName", "auth.fullName")}
                </th>
                <th className="py-3 px-4 text-start">
                  {t("students.studentCode", "students.studentCode")}
                </th>
                <th className="py-3 px-4 text-start">
                  {t("auth.email", "Email address")}
                </th>
                {canManageRoster && (
                  <th className="py-3 px-4 text-end">
                    {t("common.actions", "Actions")}
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border">
              {filteredRoster.map((enr: any, idx: number) => {
                const studentName =
                  `${enr.student?.firstName || ""} ${enr.student?.lastName || ""}`.trim() ||
                  "طالب";
                return (
                  <tr
                    key={enr.id || idx}
                    className="hover:bg-brand-primary-50/20 transition-colors"
                  >
                    <td className="py-3 px-4 font-bold text-brand-text-muted">
                      {idx + 1}
                    </td>
                    <td className="py-3 px-4 font-bold text-brand-text-main">
                      {studentName}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs font-bold text-brand-primary-600">
                      {enr.student?.studentCode || "—"}
                    </td>
                    <td className="py-3 px-4 text-brand-text-sub font-medium">
                      {enr.student?.user?.email || "—"}
                    </td>
                    {canManageRoster && (
                      <td className="py-3 px-4 text-end">
                        <button
                          type="button"
                          onClick={() =>
                            setWithdrawTarget({
                              id: enr.id,
                              name: studentName,
                            })
                          }
                          className="p-2 rounded-xl text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer inline-flex items-center gap-1.5 text-xs font-bold"
                          title={t(
                            "courses.withdrawStudent",
                            "Withdraw Student",
                          )}
                        >
                          <Trash2 size={15} />
                          <span className="hidden sm:inline">
                            {t("courses.withdraw", "Withdraw")}
                          </span>
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-10 text-brand-text-muted italic text-sm">
          {rosterSearch
            ? t("common.noResults", "No matching results found")
            : t("courses.noStudentsEnrolled", "No students enrolled yet.")}
        </div>
      )}
    </Card>
  );
};
