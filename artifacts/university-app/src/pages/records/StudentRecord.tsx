import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";
import transcriptService, {
  type TranscriptData,
} from "../../services/transcript.service";
import Badge from "../../components/ui/badge";
import { useToast } from "../../context/ToastContext";
import { StudentTranscriptView } from "./components/StudentTranscriptView";
import { AdminExamRecordView } from "./components/AdminExamRecordView";
import {
  Archive,
  RotateCw,
  LayoutGrid,
  List,
} from "lucide-react";

const StudentRecord: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showToast } = useToast();

  const isStaffOrAdmin = Boolean(
    user?.role &&
    [
      "SUPER_ADMIN",
      "ADMIN",
      "DOCTOR",
      "COLLEGE_ADMIN",
      "DEPARTMENT_ADMIN",
    ].includes(user.role)
  );

  // View Mode: 'CARD' | 'LIST'
  const [viewMode, setViewMode] = useState<"CARD" | "LIST">("CARD");

  // Loading & Data States
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<TranscriptData | null>(null);

  // Filter States for Students
  const [searchQuery] = useState("");
  const [semesterFilter] = useState("ALL");
  const [gradeStatusFilter] = useState("ALL");
  const [assessmentTypeFilter] = useState("ALL");

  // Expand states for Student View
  const [expandedCourses, setExpandedCourses] = useState<
    Record<number, boolean>
  >({});

  // Fetch Transcript Data
  const fetchTranscript = useCallback(async () => {
    setLoading(true);
    try {
      const res = await transcriptService.getStudentTranscript(undefined);
      if (res.success && res.data) {
        setData(res.data);
      } else {
        showToast(t("transcript.fetchError", "Error fetching record"), "error");
      }
    } catch (_err) {
      showToast(t("transcript.fetchError", "Error fetching record"), "error");
    } finally {
      setLoading(false);
    }
  }, [t, showToast]);

  useEffect(() => {
    fetchTranscript();
  }, [fetchTranscript]);

  const toggleCourseExpand = (courseId: number) => {
    setExpandedCourses((prev) => ({
      ...prev,
      [courseId]: !prev[courseId],
    }));
  };

  const getGradeBadge = (grade: number | null, status: string) => {
    if (status === "WITHDRAWN") {
      return (
        <Badge variant="warning">
          {t("transcript.withdrawn", "Withdrawn")}
        </Badge>
      );
    }
    if (status === "FAILED") {
      return <Badge variant="danger">{t("transcript.failed", "Failed")}</Badge>;
    }
    if (grade === null) {
      return (
        <Badge variant="outline">
          <span className="sr-only">{t("transcript.letterGrade", "Letter Grade")}: </span>
          {t("transcript.inProgress", "In Progress")}
        </Badge>
      );
    }
    if (grade >= 90) return <Badge variant="success">A+ ({grade}%)</Badge>;
    if (grade >= 85) return <Badge variant="success">A ({grade}%)</Badge>;
    if (grade >= 75) return <Badge variant="info">B ({grade}%)</Badge>;
    if (grade >= 65) return <Badge variant="warning">C ({grade}%)</Badge>;
    if (grade >= 50) return <Badge variant="warning">D ({grade}%)</Badge>;
    return <Badge variant="danger">F ({grade}%)</Badge>;
  };

  // Student Filtered Semesters
  const filteredSemesters = useMemo(() => {
    if (!data?.semesters) return [];

    return data.semesters
      .map((sem) => {
        if (
          semesterFilter !== "ALL" &&
          sem.semester.toString() !== semesterFilter
        ) {
          return null;
        }

        const filteredCourses = sem.courses.filter((cItem) => {
          if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            const matchName = cItem.course.name.toLowerCase().includes(q);
            const matchCode = cItem.course.courseCode.toLowerCase().includes(q);
            if (!matchName && !matchCode) return false;
          }

          if (gradeStatusFilter === "PASSED" && cItem.status !== "COMPLETED")
            return false;
          if (gradeStatusFilter === "FAILED" && cItem.status !== "FAILED")
            return false;
          if (gradeStatusFilter === "IN_PROGRESS" && cItem.finalGrade !== null)
            return false;

          if (assessmentTypeFilter === "EXAMS" && cItem.exams.length === 0)
            return false;
          if (assessmentTypeFilter === "QUIZZES" && cItem.quizzes.length === 0)
            return false;
          if (assessmentTypeFilter === "TASKS" && cItem.tasks.length === 0)
            return false;

          return true;
        });

        if (filteredCourses.length === 0) return null;
        return { ...sem, courses: filteredCourses };
      })
      .filter(Boolean) as typeof data.semesters;
  }, [
    data,
    semesterFilter,
    searchQuery,
    gradeStatusFilter,
    assessmentTypeFilter,
  ]);

  const showAdminView = Boolean(data?.isAdminOverview || isStaffOrAdmin);

  return (
    <div className="section-gap animate-in fade-in duration-500 space-y-4 w-full min-w-0 pb-20">
      {/* 1. Sleek Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="page-title flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-brand-primary-500/10 text-brand-primary-600 dark:text-brand-primary-400">
              <Archive size={22} />
            </span>
            {t("transcript.title", "Exams Record & Archive")}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
            {t(
              "transcript.subtitle",
              "Permanent record for archived exams, student submissions, and performance statistics",
            )}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* View Switcher for Staff / Admins */}
          {showAdminView && (
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
              <button
                type="button"
                onClick={() => setViewMode("CARD")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === "CARD"
                    ? "bg-white dark:bg-slate-700 text-brand-primary-600 dark:text-brand-primary-300 shadow-xs"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                <LayoutGrid size={14} />
                <span>{t("exams.viewCardView", "Cards")}</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("LIST")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === "LIST"
                    ? "bg-white dark:bg-slate-700 text-brand-primary-600 dark:text-brand-primary-300 shadow-xs"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                <List size={14} />
                <span>{t("exams.viewListView", "List")}</span>
              </button>
            </div>
          )}

          {/* Refresh Button */}
          <button
            type="button"
            onClick={fetchTranscript}
            className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-xs transition-all border border-slate-200 dark:border-slate-700 active:scale-95 shadow-2xs cursor-pointer"
            title={t("common.refresh", "Refresh")}
          >
            <RotateCw size={15} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* 2. Admin / Staff View vs Student Transcript View */}
      {showAdminView ? (
        <AdminExamRecordView
          data={data}
          loading={loading}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onRefresh={fetchTranscript}
        />
      ) : (
        <StudentTranscriptView
          data={data}
          user={user}
          filteredSemesters={filteredSemesters}
          expandedCourses={expandedCourses}
          toggleCourseExpand={toggleCourseExpand}
          getGradeBadge={getGradeBadge}
        />
      )}
    </div>
  );
};

export default StudentRecord;
