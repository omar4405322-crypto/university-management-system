import React from "react";
import { useTranslation } from "react-i18next";
import { Search, X, LayoutGrid, LayoutList } from "lucide-react";
import Button from "../../../components/ui/button";
import type { CollegeOption, StatusFilterType, ViewModeType } from "../types";

interface RegistrationFilterBarProps {
  search: string;
  setSearch: (val: string) => void;
  selectedCollege: string;
  setSelectedCollege: (val: string) => void;
  selectedRole: string;
  setSelectedRole: (val: string) => void;
  statusFilter: StatusFilterType;
  setStatusFilter: (val: StatusFilterType) => void;
  colleges: CollegeOption[];
  viewMode: ViewModeType;
  setViewMode: (val: ViewModeType) => void;
  isRTL: boolean;
}

export const RegistrationFilterBar: React.FC<RegistrationFilterBarProps> = ({
  search,
  setSearch,
  selectedCollege,
  setSelectedCollege,
  selectedRole,
  setSelectedRole,
  statusFilter,
  setStatusFilter,
  colleges,
  viewMode,
  setViewMode,
  isRTL,
}) => {
  const { t } = useTranslation();

  return (
    <div className="p-2 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-700 shadow-2xs flex flex-wrap items-center gap-2 mb-4">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px]">
        <Search
          size={14}
          className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          type="text"
          placeholder={t(
            "registration.searchPlaceholder",
            "Search by name, email, or student ID...",
          )}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-8.5 ps-8 pe-8 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-1.5 focus:ring-brand-primary-500 outline-none bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute end-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* College Filter */}
      <select
        value={selectedCollege}
        onChange={(e) => setSelectedCollege(e.target.value)}
        className="h-8.5 px-3 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-brand-primary-500 cursor-pointer"
      >
        <option value="ALL">
          {t("registration.allColleges", "All Colleges")}
        </option>
        {colleges.map((c) => (
          <option key={c.id} value={c.id}>
            {isRTL ? c.nameAr || c.name : c.name}
          </option>
        ))}
      </select>

      {/* Role Filter */}
      <select
        value={selectedRole}
        onChange={(e) => setSelectedRole(e.target.value)}
        className="h-8.5 px-3 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-brand-primary-500 cursor-pointer"
      >
        <option value="ALL">{t("registration.allRoles", "All Roles")}</option>
        <option value="STUDENT">{t("roles.STUDENT", "Student")}</option>
        <option value="DOCTOR">{t("roles.DOCTOR", "Professor")}</option>
      </select>

      {/* Clear Filters Button */}
      {(search ||
        selectedCollege !== "ALL" ||
        selectedRole !== "ALL" ||
        statusFilter !== "ALL") && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setSearch("");
            setSelectedCollege("ALL");
            setSelectedRole("ALL");
            setStatusFilter("ALL");
          }}
          className="h-8.5 px-2.5 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl font-bold cursor-pointer"
        >
          <X size={13} className="me-1" />
          {isRTL ? "مسح" : "Clear"}
        </Button>
      )}

      {/* View Mode Switcher */}
      <div className="flex items-center bg-slate-100 dark:bg-slate-900/80 p-0.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 ms-auto">
        <button
          onClick={() => setViewMode("table")}
          title={t("registration.tableView", "Table View")}
          className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 text-xs font-bold ${
            viewMode === "table"
              ? "bg-white dark:bg-slate-700 text-brand-primary-600 dark:text-brand-primary-400 shadow-xs"
              : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <LayoutList size={13} />
          <span className="hidden sm:inline">{isRTL ? "جدول" : "Table"}</span>
        </button>
        <button
          onClick={() => setViewMode("cards")}
          title={t("registration.cardView", "Card View")}
          className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 text-xs font-bold ${
            viewMode === "cards"
              ? "bg-white dark:bg-slate-700 text-brand-primary-600 dark:text-brand-primary-400 shadow-xs"
              : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <LayoutGrid size={13} />
          <span className="hidden sm:inline">{isRTL ? "بطاقات" : "Cards"}</span>
        </button>
      </div>
    </div>
  );
};
