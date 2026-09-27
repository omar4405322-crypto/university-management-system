import React from "react";
import {
  BookOpen,
  Users,
  FileText,
  Video,
  Plus,
  Trash2,
  UserCheck,
  Calendar,
  Clock,
  MapPin,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import Card from "../../../components/ui/card";
import Button from "../../../components/ui/button";
import Badge from "../../../components/ui/badge";
import type {
  CourseDetailsData,
  AssignedDoctorInfo,
  AssignedTAInfo,
} from "../types";

export interface CourseOverviewTabProps {
  course: CourseDetailsData;
  assignedDoctors: AssignedDoctorInfo[];
  assignedTAs: AssignedTAInfo[];
  lecturesCount: number;
  tutorialsCount: number;
  canManageRoster: boolean;
  isRTL: boolean;
  onAssignDoctor: () => void;
  onAssignTA: () => void;
  onUnassignDoctor: (id: number, name: string) => void;
  onUnassignTA: (id: number | string, name: string) => void;
}

export const CourseOverviewTab: React.FC<CourseOverviewTabProps> = ({
  course,
  assignedDoctors,
  assignedTAs,
  lecturesCount,
  tutorialsCount,
  canManageRoster,
  isRTL,
  onAssignDoctor,
  onAssignTA,
  onUnassignDoctor,
  onUnassignTA,
}) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5">
        <div className="bg-surface-card border border-brand-border p-5 rounded-2xl flex items-center justify-between shadow-card hover:-translate-y-0.5 transition-all">
          <div className="space-y-1">
            <p className="text-xs font-bold text-brand-text-muted">
              {t("courses.students", "Students")}
            </p>
            <h3 className="text-3xl font-black text-brand-text-primary dark:text-brand-text-main">
              {course._count?.enrollments ?? course.enrollments?.length ?? 0}
            </h3>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-brand-navy-50 dark:bg-brand-navy-900/40 text-brand-navy-500 dark:text-brand-navy-300 flex items-center justify-center shrink-0">
            <Users size={24} />
          </div>
        </div>

        <div className="bg-surface-card border border-brand-border p-5 rounded-2xl flex items-center justify-between shadow-card hover:-translate-y-0.5 transition-all">
          <div className="space-y-1">
            <p className="text-xs font-bold text-brand-text-muted">
              {t("courses.credits", "Credits")}
            </p>
            <h3 className="text-3xl font-black text-brand-text-primary dark:text-brand-text-main">
              {course.credits}
            </h3>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-brand-primary-50 dark:bg-brand-primary-950/40 text-brand-brand-green-dark flex items-center justify-center shrink-0">
            <BookOpen size={24} />
          </div>
        </div>

        <div className="bg-surface-card border border-brand-border p-5 rounded-2xl flex items-center justify-between shadow-card hover:-translate-y-0.5 transition-all">
          <div className="space-y-1">
            <p className="text-xs font-bold text-brand-text-muted">
              {t("courses.lectures", "Lectures")}
            </p>
            <h3 className="text-3xl font-black text-brand-text-primary dark:text-brand-text-main">
              {lecturesCount}
            </h3>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <FileText size={24} />
          </div>
        </div>

        <div className="bg-surface-card border border-brand-border p-5 rounded-2xl flex items-center justify-between shadow-card hover:-translate-y-0.5 transition-all">
          <div className="space-y-1">
            <p className="text-xs font-bold text-brand-text-muted">
              {t("courses.tutorials", "Tutorials & Labs")}
            </p>
            <h3 className="text-3xl font-black text-brand-text-primary dark:text-brand-text-main">
              {tutorialsCount}
            </h3>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Video size={24} />
          </div>
        </div>
      </div>

      {/* Academic Staff Cards (Professors & TAs in Charge) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Professors Card */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-black text-brand-text-main">
              {t("courses.professorsInCharge", "Professors in Charge")}
            </h3>
            {canManageRoster && (
              <Button
                size="sm"
                variant="outline"
                onClick={onAssignDoctor}
                className="text-xs font-bold flex items-center gap-1.5 border-brand-primary-300 text-brand-brand-green-dark hover:bg-brand-primary-50 rounded-xl"
              >
                <Plus size={14} />
                <span>
                  {assignedDoctors.length > 0
                    ? isRTL
                      ? "إسناد/تغيير الدكتور"
                      : "Assign / Change Doctor"
                    : isRTL
                      ? "إسناد أستاذ للمقرر"
                      : "Assign Professor"}
                </span>
              </Button>
            )}
          </div>
          {assignedDoctors.length > 0 ? (
            <div className="space-y-3 mt-2">
              {assignedDoctors.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-surface-subtle border border-brand-border"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-brand-primary-50 dark:bg-brand-primary-950/40 text-brand-brand-green-dark flex items-center justify-center font-black text-base shrink-0 border border-brand-border">
                      {doc.firstName?.[0] || "D"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-brand-text-primary dark:text-brand-text-main truncate text-sm">
                          د. {doc.firstName} {doc.lastName}
                        </h4>
                        <span className="bg-brand-primary-50 dark:bg-brand-primary-950/40 text-brand-brand-green-dark text-[10px] px-2 py-0.5 rounded-full font-bold border border-brand-border">
                          أستاذ المادة
                        </span>
                      </div>
                      {doc.doctorId && (
                        <p className="text-xs text-brand-text-muted mt-0.5">
                          {doc.doctorId}
                        </p>
                      )}
                    </div>
                  </div>
                  {canManageRoster && (
                    <button
                      type="button"
                      onClick={() =>
                        onUnassignDoctor(
                          doc.id,
                          `${doc.firstName} ${doc.lastName}`
                        )
                      }
                      className="text-slate-400 hover:text-rose-600 p-2 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all shrink-0"
                      title={isRTL ? "إلغاء إسناد الدكتور" : "Unassign doctor"}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-brand-text-muted italic text-xs space-y-3">
              <UserCheck
                size={32}
                className="mx-auto opacity-40 text-brand-text-muted"
              />
              <p>
                {t(
                  "courses.noAssignedProfessors",
                  "No professor assigned to this course yet"
                )}
              </p>
              {canManageRoster && (
                <Button
                  size="sm"
                  onClick={onAssignDoctor}
                  className="bg-brand-primary-500 hover:bg-brand-primary-600 text-white text-xs font-bold rounded-xl px-4 py-2 mx-auto flex items-center gap-1.5"
                >
                  <Plus size={14} />
                  <span>
                    {isRTL
                      ? "إسناد أستاذ للمقرر الآن"
                      : "Assign Professor Now"}
                  </span>
                </Button>
              )}
            </div>
          )}
        </Card>

        {/* Teaching Assistants Card */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-black text-brand-text-main">
              {t("courses.tasInCharge", "Teaching Assistants in Charge")}
            </h3>
            {canManageRoster && (
              <Button
                size="sm"
                variant="outline"
                onClick={onAssignTA}
                className="text-xs font-bold flex items-center gap-1.5 border-brand-navy-300 text-brand-navy-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl"
              >
                <Plus size={14} />
                <span>
                  {assignedTAs.length > 0
                    ? isRTL
                      ? "إسناد/تغيير المعيد"
                      : "Assign / Change TA"
                    : isRTL
                      ? "إسناد معيد للمقرر"
                      : "Assign TA"}
                </span>
              </Button>
            )}
          </div>
          {assignedTAs.length > 0 ? (
            <div className="space-y-3 mt-2">
              {assignedTAs.map((ta) => (
                <div
                  key={ta.id}
                  className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-surface-subtle border border-brand-border"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-brand-navy-50 dark:bg-slate-700 text-brand-navy-600 dark:text-slate-200 flex items-center justify-center font-black text-base shrink-0 border border-slate-200 dark:border-slate-700">
                      {ta.firstName?.[0] || "T"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-brand-text-primary dark:text-brand-text-main truncate text-sm">
                          م. {ta.firstName} {ta.lastName}
                        </h4>
                        <span className="bg-brand-navy-50 dark:bg-slate-700 text-brand-navy-600 dark:text-slate-200 text-[10px] px-2 py-0.5 rounded-full font-bold border border-slate-200 dark:border-slate-600">
                          المعيد المسؤول
                        </span>
                      </div>
                      {ta.employeeId && (
                        <p className="text-xs text-brand-text-muted mt-0.5">
                          {ta.employeeId}
                        </p>
                      )}
                    </div>
                  </div>
                  {canManageRoster && (
                    <button
                      type="button"
                      onClick={() =>
                        onUnassignTA(
                          ta.id,
                          `${ta.firstName} ${ta.lastName}`
                        )
                      }
                      className="text-slate-400 hover:text-rose-600 p-2 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all shrink-0"
                      title={
                        isRTL
                          ? "إلغاء إسناد المعيد"
                          : "Unassign teaching assistant"
                      }
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-brand-text-muted italic text-xs space-y-3">
              <UserCheck
                size={32}
                className="mx-auto opacity-40 text-brand-text-muted"
              />
              <p>
                {t(
                  "courses.noAssignedTAs",
                  "No teaching assistant assigned to this course yet"
                )}
              </p>
              {canManageRoster && (
                <Button
                  size="sm"
                  onClick={onAssignTA}
                  className="bg-brand-primary-500 hover:bg-brand-primary-600 text-white text-xs font-bold rounded-xl px-4 py-2 mx-auto flex items-center gap-1.5 shadow-sm"
                >
                  <Plus size={14} />
                  <span>
                    {isRTL
                      ? "إسناد معيد للمقرر الآن"
                      : "Assign Teaching Assistant Now"}
                  </span>
                </Button>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* Description & Details Card */}
      <Card className="p-6">
        <h3 className="text-lg font-black text-brand-text-main mb-2">
          {t("courses.description", "Description")}
        </h3>
        {course.description ? (
          <p className="text-brand-text-sub font-medium leading-relaxed text-sm">
            {course.description}
          </p>
        ) : (
          <p className="text-brand-text-muted italic text-xs">
            {isRTL
              ? "لا يوجد وصف متاح لهذا المقرر الدراسي حتى الآن."
              : "No description available for this course yet."}
          </p>
        )}
      </Card>

      {/* Weekly Timetable & Room Slots */}
      {course.scheduleSlots && course.scheduleSlots.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-black text-brand-text-main mb-2">
            {t("courses.scheduleTimeline", "Weekly Schedule & Rooms")}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-2">
            {course.scheduleSlots.map((slot) => (
              <div
                key={slot.id}
                className="p-4 rounded-2xl bg-surface-subtle border border-brand-border space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-brand-text-primary dark:text-brand-text-main flex items-center gap-2 text-sm">
                    <Calendar
                      size={16}
                      className="text-brand-brand-green-dark"
                    />
                    {slot.dayOfWeek}
                  </span>
                  <Badge
                    variant={
                      slot.slotType === "LECTURE" ? "primary" : "secondary"
                    }
                    className="text-[10px]"
                  >
                    {slot.slotType === "LECTURE"
                      ? "محاضرة"
                      : slot.slotType === "SECTION"
                        ? "سكشن"
                        : "معمل"}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-xs text-brand-text-muted font-medium">
                  <Clock size={14} />
                  <span>
                    {slot.startTime} - {slot.endTime}
                  </span>
                </div>
                {slot.room && (
                  <div className="flex items-center gap-2 text-xs text-brand-text-muted font-medium">
                    <MapPin size={14} className="text-emerald-600" />
                    <span>القاعة / المعمل: {slot.room}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};
