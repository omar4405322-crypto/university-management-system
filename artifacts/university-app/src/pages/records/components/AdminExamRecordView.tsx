import React, { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import type {
  TranscriptData,
  CompletedExamAdminItem,
} from "../../../services/transcript.service";
import collegeService from "../../../services/college.service";
import departmentService from "../../../services/department.service";
import Card, { StatCard } from "../../../components/ui/card";
import Badge from "../../../components/ui/badge";
import BulkActionToolbar from "../../../components/ui/BulkActionToolbar";
import { useToast } from "../../../context/ToastContext";
import { useLanguage } from "../../../context/LanguageContext";
import {
  Archive,
  Users,
  BarChart3,
  BookOpenCheck,
  Search,
  X,
  RotateCcw,
  Calendar,
  Clock,
  CheckSquare,
  Square,
  MinusSquare,
  CheckCircle2,
  Eye,
  LayoutGrid,
  List,
} from "lucide-react";
import { getTypeBadgeConfig } from "../../exams/examUtils";

interface AdminExamRecordViewProps {
  data: TranscriptData | null;
  loading: boolean;
  viewMode: "CARD" | "LIST";
  onViewModeChange: (mode: "CARD" | "LIST") => void;
  onRefresh: () => void;
}

export const AdminExamRecordView: React.FC<AdminExamRecordViewProps> = ({
  data,
  viewMode,
  onViewModeChange,
}) => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [colleges, setColleges] = useState<Array<{ id: number | string; name: string; nameAr?: string }>>([]);
  const [departments, setDepartments] = useState<Array<{ id: number | string; name: string; nameAr?: string; collegeId?: number }>>([]);

  // Filter States for Admin / Staff
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCollege, setSelectedCollege] = useState("");
  const [selectedDept, setSelectedDept] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [submissionFilter, setSubmissionFilter] = useState("ALL");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  // Multi-Selection State for Admins
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());

  // 1. Fetch Metadata (Colleges & Departments)
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [collegesRes, deptsRes] = await Promise.all([
          collegeService.getColleges({ limit: 100 }).catch(() => ({ success: false, data: [] })),
          departmentService.getDepartments({ limit: 200 }).catch(() => ({ success: false, data: [] })),
        ]);

        if (collegesRes.success || collegesRes.data) {
          const arr = Array.isArray(collegesRes.data)
            ? collegesRes.data
            : (collegesRes.data as { colleges?: unknown[]; data?: unknown[] })?.colleges ||
              (collegesRes.data as { colleges?: unknown[]; data?: unknown[] })?.data ||
              [];
          setColleges(arr as Array<{ id: number | string; name: string; nameAr?: string }>);
        }

        if (deptsRes.success || deptsRes.data) {
          const arr = Array.isArray(deptsRes.data)
            ? deptsRes.data
            : (deptsRes.data as { departments?: unknown[]; data?: unknown[] })?.departments ||
              (deptsRes.data as { departments?: unknown[]; data?: unknown[] })?.data ||
              [];
          setDepartments(arr as Array<{ id: number | string; name: string; nameAr?: string; collegeId?: number }>);
        }
      } catch (_err) {
        // silent
      }
    };

    fetchMetadata();
  }, []);

  // Cascading departments for selected college
  const filteredDepartments = useMemo(() => {
    if (!selectedCollege) return departments;
    const colId = parseInt(selectedCollege, 10);
    return departments.filter((d) => d.collegeId === colId);
  }, [departments, selectedCollege]);

  // Admin Filtered Completed Exams
  const filteredCompletedExams = useMemo(() => {
    if (!data?.completedExams) return [];
    let list = [...data.completedExams];

    // Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((e) => {
        const cName = (e.courseName || "").toLowerCase();
        const cCode = (e.courseCode || "").toLowerCase();
        const room = (e.room || "").toLowerCase();
        return cName.includes(q) || cCode.includes(q) || room.includes(q);
      });
    }

    // Exam Type
    if (typeFilter !== "ALL") {
      list = list.filter((e) => e.type === typeFilter);
    }

    // Submissions filter
    if (submissionFilter === "SUBMITTED") {
      list = list.filter((e) => e.submissionsCount > 0);
    } else if (submissionFilter === "PENDING") {
      list = list.filter((e) => e.submissionsCount === 0);
    }

    // Sort Order
    list.sort((a, b) => {
      const dateA = new Date(`${a.date}T${a.startTime || "00:00"}`).getTime();
      const dateB = new Date(`${b.date}T${b.startTime || "00:00"}`).getTime();
      return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
    });

    return list;
  }, [
    data?.completedExams,
    searchQuery,
    typeFilter,
    submissionFilter,
    sortOrder,
  ]);

  // Multi-Selection Logic
  const allFilteredIds = useMemo(
    () => filteredCompletedExams.map((e) => e.id),
    [filteredCompletedExams],
  );
  const isAllSelected =
    allFilteredIds.length > 0 &&
    allFilteredIds.every((id) => selectedIds.has(id));
  const isSomeSelected =
    allFilteredIds.some((id) => selectedIds.has(id)) && !isAllSelected;

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        allFilteredIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        allFilteredIds.forEach((id) => next.add(id));
        return next;
      });
    }
  };

  const handleToggleSelect = (id: string | number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Reset Filters
  const handleResetFilters = () => {
    setSearchQuery("");
    setSelectedCollege("");
    setSelectedDept("");
    setSelectedYear("");
    setTypeFilter("ALL");
    setSubmissionFilter("ALL");
  };

  const hasActiveFilters =
    searchQuery.trim() !== "" ||
    selectedCollege !== "" ||
    selectedDept !== "" ||
    selectedYear !== "" ||
    typeFilter !== "ALL" ||
    submissionFilter !== "ALL";

  // Format Time
  const formatTime = (timeStr: string) => {
    if (!timeStr) return "";
    const [hours, minutes] = timeStr.split(":");
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? t("common.pm", "PM") : t("common.am", "AM");
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const renderTypeBadge = (type?: string) => {
    const config = getTypeBadgeConfig(type || "MIDTERM", t);
    return (
      <Badge
        variant="outline"
        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${config.bg} ${config.text}`}
      >
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      {/* 1. EXECUTIVE 4-METRIC RIBBON */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <StatCard
          compact
          title={t("transcript.completedExams", "Archived Exams")}
          value={
            data?.totalCompletedExams || (data?.completedExams?.length ?? 0)
          }
          icon={Archive}
          color="primary"
        />

        <StatCard
          compact
          title={t("transcript.submissions", "Student Submissions")}
          value={data?.totalSubmissions || 0}
          icon={Users}
          color="emerald"
        />

        <StatCard
          compact
          title={t("transcript.avgScore", "Average Grade")}
          value={`${data?.averageScore || 0}%`}
          icon={BarChart3}
          color="blue"
        />

        <StatCard
          compact
          title={t("transcript.coursesCount", "Evaluated Courses")}
          value={
            data?.totalCoursesWithExams ||
            new Set(
              (data?.completedExams || []).map(
                (e: CompletedExamAdminItem) => e.courseCode || e.courseName,
              ),
            ).size
          }
          icon={BookOpenCheck}
          color="amber"
        />
      </div>

      {/* 2. UNIFIED COMPACT FILTER TOOLBAR */}
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
              "transcript.searchPlaceholder",
              "Search course name, code, or title...",
            )}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-8.5 ps-8 pe-8 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-1.5 focus:ring-brand-primary-500 outline-none bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute end-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* College Dropdown */}
        <select
          value={selectedCollege}
          onChange={(e) => {
            setSelectedCollege(e.target.value);
            setSelectedDept("");
          }}
          className="h-8.5 px-3 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-brand-primary-500 cursor-pointer"
        >
          <option value="">
            {t("common.allColleges", "All Colleges")}
          </option>
          {colleges.map((c) => (
            <option key={c.id} value={c.id}>
              {isRTL ? c.nameAr || c.name : c.name}
            </option>
          ))}
        </select>

        {/* Department Dropdown */}
        <select
          value={selectedDept}
          onChange={(e) => setSelectedDept(e.target.value)}
          className="h-8.5 px-3 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-brand-primary-500 cursor-pointer"
        >
          <option value="">
            {t("common.allDepartments", "All Departments")}
          </option>
          {filteredDepartments.map((d) => (
            <option key={d.id} value={d.id}>
              {isRTL ? d.nameAr || d.name : d.name}
            </option>
          ))}
        </select>

        {/* Year Dropdown */}
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(e.target.value)}
          className="h-8.5 px-3 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-brand-primary-500 cursor-pointer"
        >
          <option value="">{t("common.allYears", "All Years")}</option>
          <option value="1">{t("common.year1", "Year 1")}</option>
          <option value="2">{t("common.year2", "Year 2")}</option>
          <option value="3">{t("common.year3", "Year 3")}</option>
          <option value="4">{t("common.year4", "Year 4")}</option>
        </select>

        {/* Exam Type Filter */}
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="h-8.5 px-3 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-brand-primary-500 cursor-pointer"
        >
          <option value="ALL">{t("common.allTypes", "All Types")}</option>
          <option value="MIDTERM">{t("exams.types.midterm", "Midterm")}</option>
          <option value="FINAL">{t("exams.types.final", "Final")}</option>
          <option value="PRACTICAL">{t("exams.types.practical", "Practical")}</option>
        </select>

        {/* Submissions Filter */}
        <select
          value={submissionFilter}
          onChange={(e) => setSubmissionFilter(e.target.value)}
          className="h-8.5 px-3 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-brand-primary-500 cursor-pointer"
        >
          <option value="ALL">
            {t("transcript.allSubmissions", "All Submissions")}
          </option>
          <option value="SUBMITTED">
            {t("transcript.hasSubmissions", "With Submissions")}
          </option>
          <option value="PENDING">
            {t("transcript.noSubmissions", "No Submissions")}
          </option>
        </select>

        {/* Sort Order */}
        <button
          type="button"
          onClick={() =>
            setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"))
          }
          className="h-8.5 px-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1 cursor-pointer"
          title={t("transcript.sortOrder", "Toggle Date Sort")}
        >
          <span>{sortOrder === "desc" ? "↓" : "↑"}</span>
          <span>{t("common.date", "Date")}</span>
        </button>

        {/* Reset Filters */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleResetFilters}
            className="h-8.5 px-2.5 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl font-bold transition-colors flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw size={12} />
            <span>{t("groups.resetFilters", "Reset")}</span>
          </button>
        )}
      </div>

      {/* 3. CONTENT AREA: CARDS OR TABLE */}
      {filteredCompletedExams.length === 0 ? (
        <Card className="p-12 text-center flex flex-col items-center justify-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400 mb-3">
            <Archive size={26} />
          </div>
          <h3 className="font-bold text-slate-700 dark:text-slate-200 text-sm mb-1">
            {hasActiveFilters
              ? t("transcript.noFilteredExams", "No Matching Exams Found")
              : t("transcript.noCompletedExams", "No Archived Exams Yet")}
          </h3>
          <p className="text-xs text-slate-400 font-medium max-w-sm mb-4">
            {hasActiveFilters
              ? t(
                  "transcript.noFilteredExamsDesc",
                  "No archived exams match the selected filter criteria.",
                )
              : t(
                  "transcript.noCompletedExamsDesc",
                  "Completed exams with grades are automatically moved here for permanent archival.",
                )}
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-4 py-1.5 bg-brand-primary-500 text-white font-bold rounded-xl text-xs shadow-xs flex items-center gap-1.5"
            >
              <RotateCcw size={13} />
              <span>{t("groups.resetFilters", "Reset Filters")}</span>
            </button>
          )}
        </Card>
      ) : viewMode === "CARD" ? (
        /* MODE A: RESPONSIVE CARDS GRID */
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredCompletedExams.map((exam) => {
              const isSelected = selectedIds.has(exam.id);

              return (
                <Card
                  key={exam.id}
                  className={`rounded-2xl border p-4 shadow-2xs hover:shadow-sm transition-all relative flex flex-col justify-between group ${
                    isSelected
                      ? "border-brand-primary-500 ring-2 ring-brand-primary-500/20 bg-brand-primary-500/[0.02] dark:bg-brand-primary-500/[0.04]"
                      : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  }`}
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleSelect(exam.id)}
                          className="text-slate-400 hover:text-brand-primary-600 focus:outline-none transition-colors"
                        >
                          {isSelected ? (
                            <CheckSquare
                              size={16}
                              className="text-brand-primary-600"
                            />
                          ) : (
                            <Square size={16} />
                          )}
                        </button>
                        {renderTypeBadge(exam.type)}
                      </div>

                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                        <CheckCircle2 size={11} />
                        <span>
                          {t("exams.statusCompleted", "Completed")}
                        </span>
                      </span>
                    </div>

                    {/* Exam Title & Course */}
                    <div className="mb-2.5">
                      <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                        {exam.courseCode && (
                          <span className="px-2 py-0.5 rounded-md bg-brand-primary-500/10 text-brand-primary-700 dark:text-brand-primary-300 font-black text-[11px]">
                            {exam.courseCode}
                          </span>
                        )}
                        <h4 className="font-bold text-slate-900 dark:text-white text-xs md:text-sm leading-snug">
                          {exam.courseName}
                        </h4>
                      </div>
                    </div>

                    {/* Details */}
                    <div className="space-y-1.5 py-2 border-t border-slate-100 dark:border-slate-700/60 text-xs">
                      {/* Date & Time */}
                      <div className="flex items-center justify-between text-slate-700 dark:text-slate-300 font-semibold">
                        <div className="flex items-center gap-1.5">
                          <Calendar
                            size={12}
                            className="text-brand-primary-500 shrink-0"
                          />
                          <span>{exam.date}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 font-bold">
                          <Clock
                            size={11}
                            className="text-slate-400 shrink-0"
                          />
                          <span>
                            {formatTime(exam.startTime)} -{" "}
                            {formatTime(exam.endTime)}
                          </span>
                        </div>
                      </div>

                      {/* Hall */}
                      {exam.room && (
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-400 font-medium">
                            {t("transcript.hallRoom", "Hall / Room:")}
                          </span>
                          <span className="font-bold text-slate-700 dark:text-slate-300">
                            {exam.room}
                          </span>
                        </div>
                      )}

                      {/* Submissions & Questions */}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-700/40 text-[11px]">
                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold">
                          {exam.submissionsCount}{" "}
                          {t("transcript.submissions", "Submissions")}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold">
                          {exam.questionsCount}{" "}
                          {t("exams.questions", "Questions")}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="pt-2.5 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => navigate(`/exams/${exam.id}`)}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-brand-primary-50 dark:bg-brand-primary-950/40 hover:bg-brand-primary-100 dark:hover:bg-brand-primary-900/40 text-brand-primary-700 dark:text-brand-primary-300 text-xs font-bold transition-colors"
                    >
                      <Eye size={13} />
                      <span>
                        {t(
                          "transcript.examSubmissions",
                          "Submissions & Results",
                        )}
                      </span>
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      ) : (
        /* MODE B: TABLE LIST */
        <Card className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden p-0">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full border-collapse text-start">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700 text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  <th className="p-3.5 text-center w-12">
                    <button
                      type="button"
                      onClick={handleToggleSelectAll}
                      className="text-slate-400 hover:text-brand-primary-600 focus:outline-none transition-colors"
                    >
                      {isAllSelected ? (
                        <CheckSquare
                          size={16}
                          className="text-brand-primary-600"
                        />
                      ) : isSomeSelected ? (
                        <MinusSquare
                          size={16}
                          className="text-brand-primary-600"
                        />
                      ) : (
                        <Square size={16} />
                      )}
                    </button>
                  </th>
                  <th className="p-3.5 text-start min-w-[220px]">
                    {t("exams.examColumn", "Exam & Course")}
                  </th>
                  <th className="p-3.5 text-center w-28">
                    {t("exams.typeColumn", "Type")}
                  </th>
                  <th className="p-3.5 text-start min-w-[150px]">
                    {t("exams.dateTimeColumn", "Date & Time")}
                  </th>
                  <th className="p-3.5 text-center min-w-[110px]">
                    {t("transcript.submissions", "Submissions")}
                  </th>
                  <th className="p-3.5 text-center w-28">
                    {t("exams.actionsColumn", "Actions")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 text-xs">
                {filteredCompletedExams.map((exam) => {
                  const isSelected = selectedIds.has(exam.id);

                  return (
                    <tr
                      key={exam.id}
                      className={`group hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors ${
                        isSelected
                          ? "bg-brand-primary-500/[0.04] dark:bg-brand-primary-500/[0.08]"
                          : ""
                      }`}
                    >
                      <td className="p-3.5 align-middle text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleSelect(exam.id)}
                          className="text-slate-400 hover:text-brand-primary-600 focus:outline-none transition-colors"
                        >
                          {isSelected ? (
                            <CheckSquare
                              size={16}
                              className="text-brand-primary-600"
                            />
                          ) : (
                            <Square size={16} />
                          )}
                        </button>
                      </td>

                      <td className="p-3.5 align-middle">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {exam.courseCode && (
                              <span className="px-2 py-0.5 rounded-md bg-brand-primary-500/10 text-brand-primary-700 dark:text-brand-primary-300 font-black text-[11px]">
                                {exam.courseCode}
                              </span>
                            )}
                            <span className="font-bold text-slate-900 dark:text-white text-xs">
                              {exam.courseName}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="p-3.5 align-middle text-center whitespace-nowrap">
                        {renderTypeBadge(exam.type)}
                      </td>

                      <td className="p-3.5 align-middle whitespace-nowrap">
                        <div className="space-y-0.5">
                          <div className="font-bold text-slate-800 dark:text-white flex items-center gap-1">
                            <Calendar
                              size={12}
                              className="text-brand-primary-500 shrink-0"
                            />
                            <span>{exam.date}</span>
                          </div>
                          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                            <Clock
                              size={11}
                              className="text-slate-400 shrink-0"
                            />
                            <span>
                              {formatTime(exam.startTime)} -{" "}
                              {formatTime(exam.endTime)}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="p-3.5 align-middle text-center whitespace-nowrap">
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold text-xs">
                          {exam.submissionsCount}{" "}
                          {t("transcript.submissions", "Submissions")}
                        </span>
                      </td>

                      <td className="p-3.5 align-middle text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => navigate(`/exams/${exam.id}`)}
                          className="p-1.5 rounded-lg text-brand-primary-600 hover:bg-brand-primary-50 dark:hover:bg-brand-primary-950/40 transition-colors"
                          title={t(
                            "transcript.examSubmissions",
                            "Submissions & Results",
                          )}
                        >
                          <Eye size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Standard Floating Bottom Bulk Toolbar */}
      <BulkActionToolbar
        selectedCount={selectedIds.size}
        onClear={() => setSelectedIds(new Set())}
        onDelete={() => {
          showToast(
            t("common.exportSuccess", "Batch exported records"),
            "success",
          );
          setSelectedIds(new Set());
        }}
      />
    </div>
  );
};
