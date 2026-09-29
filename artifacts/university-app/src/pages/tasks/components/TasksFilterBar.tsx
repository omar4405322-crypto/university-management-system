import React from "react";
import { useTranslation } from "react-i18next";
import {
  Search,
  RotateCcw,
  LayoutGrid,
  LayoutList,
} from "lucide-react";
import Button from "../../../components/ui/button";
import type { CourseOption } from "../types";

export interface TasksFilterBarProps {
  searchInput: string;
  onSearchInputChange: (val: string) => void;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  courseIdParam: string;
  statusParam: string;
  yearParam: string;
  sortByParam: string;
  dueFromParam: string;
  dueToParam: string;
  updateParam: (key: string, val: string) => void;
  clearAllFilters: () => void;
  hasActiveFilters: boolean;
  viewMode: "cards" | "table";
  onViewModeChange: (mode: "cards" | "table") => void;
  courses: CourseOption[];
  isDoctor: boolean;
  totalShowing: number;
  isRTL: boolean;
}

export const TasksFilterBar: React.FC<TasksFilterBarProps> = ({
  searchInput,
  onSearchInputChange,
  onChange,
  courseIdParam,
  statusParam,
  yearParam,
  sortByParam,
  dueFromParam,
  dueToParam,
  updateParam,
  clearAllFilters,
  hasActiveFilters,
  viewMode,
  onViewModeChange,
  courses,
  isDoctor,
  totalShowing,
  isRTL,
}) => {
  const { t } = useTranslation();

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-700/80 p-3 shadow-2xs space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search
            size={14}
            className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            placeholder={t(
              "tasks.searchPlaceholder",
              "Search assignments by title or instructions...",
            )}
            value={searchInput}
            onChange={(e) => {
              if (onChange) onChange(e);
              else onSearchInputChange(e.target.value);
            }}
            className="w-full h-8.5 ps-8 pe-3 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-1.5 focus:ring-brand-primary-500 outline-none bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100"
          />
        </div>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Course filter */}
          <div className="relative">
            <select
              value={courseIdParam}
              onChange={(e) => updateParam("courseId", e.target.value)}
              className="h-8.5 text-xs px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 font-semibold cursor-pointer"
            >
              <option value="">{t("tasks.allCourses", "All Courses")}</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.courseCode} - {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Academic Division filter */}
          <div className="relative">
            <select
              value={yearParam}
              onChange={(e) => updateParam("year", e.target.value)}
              className="h-8.5 text-xs px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 font-semibold cursor-pointer"
            >
              <option value="">{t("tasks.allYears", "All Years")}</option>
              <option value="1">
                {isRTL ? "الفرقة الأولى" : "Year 1"}
              </option>
              <option value="2">
                {isRTL ? "الفرقة الثانية" : "Year 2"}
              </option>
              <option value="3">
                {isRTL ? "الفرقة الثالثة" : "Year 3"}
              </option>
              <option value="4">
                {isRTL ? "الفرقة الرابعة" : "Year 4"}
              </option>
            </select>
          </div>

          {/* Status filter */}
          <div className="relative">
            <select
              value={statusParam}
              onChange={(e) => updateParam("status", e.target.value)}
              className="h-8.5 text-xs px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 font-semibold cursor-pointer"
            >
              <option value="">{t("tasks.allStatuses", "All Statuses")}</option>
              <option value="PENDING">
                {isDoctor
                  ? isRTL
                    ? "قيد الانتظار"
                    : "Active"
                  : isRTL
                    ? "مطلوب تسليمه"
                    : "Due / Pending"}
              </option>
              <option value="COMPLETED">
                {isRTL ? "تم التسليم" : "Completed"}
              </option>
              <option value="OVERDUE">
                {isRTL ? "فات الموعد" : "Overdue"}
              </option>
            </select>
          </div>

          {/* Sort filter */}
          <div className="relative">
            <select
              value={sortByParam}
              onChange={(e) => updateParam("sortBy", e.target.value)}
              className="h-8.5 text-xs px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 font-semibold cursor-pointer"
            >
              <option value="">{t("tasks.sortBy", "Sort: Default")}</option>
              <option value="due_asc">
                {isRTL ? "الموعد (الأقرب أولاً)" : "Due Date (Soonest)"}
              </option>
              <option value="due_desc">
                {isRTL ? "الموعد (الأبعد أولاً)" : "Due Date (Furthest)"}
              </option>
              <option value="created_desc">
                {isRTL ? "الأحدث إضافة" : "Newest Created"}
              </option>
            </select>
          </div>

          {/* Clear button */}
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearAllFilters}
              className="h-8.5 px-2.5 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl border-rose-200 dark:border-rose-900 cursor-pointer gap-1"
            >
              <RotateCcw size={13} />
              <span>{isRTL ? "إلغاء الفلاتر" : "Reset"}</span>
            </Button>
          )}
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900/60 p-1 rounded-xl">
          <button
            onClick={() => onViewModeChange("cards")}
            className={`p-1.5 rounded-md text-xs transition-all cursor-pointer ${
              viewMode === "cards"
                ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs"
                : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
            title={isRTL ? "عرض البطاقات" : "Cards"}
          >
            <LayoutGrid size={15} />
          </button>
          <button
            onClick={() => onViewModeChange("table")}
            className={`p-1.5 rounded-md text-xs transition-all cursor-pointer ${
              viewMode === "table"
                ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs"
                : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
            title={isRTL ? "عرض الجدول" : "Table"}
          >
            <LayoutList size={15} />
          </button>
        </div>
      </div>

      {/* Date Filter & Counter Sub-row */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-700/50 text-[11px] text-slate-500">
        <div className="flex items-center gap-2">
          <span className="font-semibold">
            {t("tasks.dueDateRange", "Due Date Range")}:
          </span>
          <input
            type="date"
            value={dueFromParam}
            onChange={(e) => updateParam("dueFrom", e.target.value)}
            className="h-7 px-2 text-[11px] rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 cursor-pointer"
            title={t("tasks.dueDateFrom", "Due From")}
          />
          <span>→</span>
          <input
            type="date"
            value={dueToParam}
            onChange={(e) => updateParam("dueTo", e.target.value)}
            className="h-7 px-2 text-[11px] rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 cursor-pointer"
            title={t("tasks.dueDateTo", "Due To")}
          />
        </div>

        <span>
          {isRTL
            ? `عرض ${totalShowing} تكليف`
            : `Showing ${totalShowing} assignment(s)`}
        </span>
      </div>
    </div>
  );
};
