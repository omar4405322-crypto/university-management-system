import React from "react";
import { useTranslation } from "react-i18next";
import Card from "../../../components/ui/card";
import {
  GraduationCap,
  Award,
  BookOpen,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { TranscriptData, SemesterTranscript } from "../../../services/transcript.service";

export interface StudentTranscriptViewProps {
  data: TranscriptData | null;
  user: {
    name?: string;
    college?: { name?: string } | null;
    department?: { name?: string } | null;
  } | null;
  filteredSemesters: SemesterTranscript[];
  expandedCourses: Record<number, boolean>;
  toggleCourseExpand: (courseId: number) => void;
  getGradeBadge: (finalGrade?: number | null, status?: string) => React.ReactNode;
}

export const StudentTranscriptView: React.FC<StudentTranscriptViewProps> = ({
  data,
  user,
  filteredSemesters,
  expandedCourses,
  toggleCourseExpand,
  getGradeBadge,
}) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      {/* Student Overview Header Card */}
      <Card className="p-5 bg-gradient-to-r from-brand-primary-900 to-slate-900 text-white rounded-2xl shadow-sm border border-slate-800">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-sm">
              <GraduationCap className="w-8 h-8 text-brand-primary-300" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">{user?.name}</h2>
              <p className="text-xs text-slate-300 mt-0.5">
                {user?.college?.name} - {user?.department?.name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-center px-4 py-2 bg-white/10 rounded-xl backdrop-blur-sm">
              <p className="text-[10px] uppercase font-bold text-slate-300">GPA</p>
              <p className="text-xl font-black text-brand-primary-300">
                {data?.gpa || "N/A"}
              </p>
            </div>
            <div className="text-center px-4 py-2 bg-white/10 rounded-xl backdrop-blur-sm">
              <p className="text-[10px] uppercase font-bold text-slate-300">
                {t("transcript.credits", "Credits")}
              </p>
              <p className="text-xl font-black text-white">
                {data?.totalCreditHours || 0}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Student Semesters Breakdown */}
      {filteredSemesters.map((sem, sIdx) => (
        <Card
          key={sIdx}
          className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-2xs"
        >
          <h3 className="font-bold text-sm text-slate-800 dark:text-white mb-3 flex items-center gap-2">
            <Award size={16} className="text-brand-primary-500" />
            <span>
              {t("transcript.semesterTitle", {
                year: sem.academicYear,
                sem: sem.semester,
              })}
            </span>
          </h3>

          <div className="space-y-2">
            {sem.courses.map((cItem) => {
              const isExpanded = !!expandedCourses[cItem.id];

              return (
                <div
                  key={cItem.id}
                  className="border border-slate-100 dark:border-slate-700/60 rounded-xl overflow-hidden"
                >
                  <div
                    onClick={() => toggleCourseExpand(cItem.id)}
                    className="p-3 bg-slate-50/50 dark:bg-slate-900/40 hover:bg-slate-100/60 dark:hover:bg-slate-800/60 flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <BookOpen size={14} className="text-brand-primary-500" />
                      <span className="font-bold text-xs text-slate-800 dark:text-white">
                        {cItem.course.name}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        ({cItem.course.courseCode})
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="sr-only">
                        {t("transcript.letterGrade", "Letter Grade")}:{" "}
                      </span>
                      {getGradeBadge(cItem.finalGrade, cItem.status)}
                      {isExpanded ? (
                        <ChevronUp size={15} />
                      ) : (
                        <ChevronDown size={15} />
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="p-3 border-t border-slate-100 dark:border-slate-700/60 bg-white dark:bg-slate-800 text-xs space-y-2">
                      {cItem.exams && cItem.exams.length > 0 && (
                        <div>
                          <p className="text-[11px] font-bold text-slate-400 uppercase mb-1">
                            {t("exams.title", "Exams")}:
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {cItem.exams.map((ex) => (
                              <div
                                key={ex.id}
                                className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/60 flex items-center justify-between"
                              >
                                <span className="font-medium text-slate-700 dark:text-slate-300">
                                  {ex.title}
                                </span>
                                <span className="font-bold text-brand-primary-600">
                                  {ex.score != null
                                    ? `${ex.score}/${ex.maxScore}`
                                    : "-"}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      ))}
    </div>
  );
};
