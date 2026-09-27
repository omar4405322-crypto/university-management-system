import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  BookOpen,
  Users,
  Loader2,
  AlertCircle,
  ArrowLeft,
  FileText,
  Video,
  ClipboardList,
  CheckCircle2,
  Eye,
  EyeOff,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import Badge from "../../components/ui/badge";
import Breadcrumbs from "../../components/ui/Breadcrumbs";
import ConfirmDeleteModal from "../../components/ui/ConfirmDeleteModal";
import taskService from "../../services/task.service";
import SubmissionsGradingModal from "../../components/tasks/SubmissionsGradingModal";
import coursesService from "../../services/courses.service";
import enrollmentService from "../../services/enrollment.service";
import EnrollStudentModal from "./EnrollStudentModal";
import AssignDoctorModal from "./AssignDoctorModal";
import AssignTAModal from "./AssignTAModal";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { logger } from "../../lib/logger";
import { CourseRosterTab } from "./components/CourseRosterTab";
import { CourseUploadModal } from "./components/CourseUploadModal";
import { CourseOverviewTab } from "./components/CourseOverviewTab";
import { CourseMaterialsTab } from "./components/CourseMaterialsTab";
import { CourseTasksTab } from "./components/CourseTasksTab";
import { CreateTaskModal, SubmitTaskModal } from "./components/CourseTaskModals";
import type {
  CourseDetailsData,
  CourseMaterial,
  CourseTask,
  CourseStudentSubmission,
  CourseScheduleSlot,
  AssignedDoctorInfo,
  AssignedTAInfo,
  TabType,
} from "./types";

interface CourseDetailsProps {
  courseId?: string;
  isDrawerMode?: boolean;
}

const CourseDetails: React.FC<CourseDetailsProps> = ({
  courseId,
  isDrawerMode = false,
}) => {
  const { id } = useParams();
  const actualId = courseId || id;
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [course, setCourse] = useState<CourseDetailsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("overview");

  // Instructor Assignment State
  const [showAssignDoctorModal, setShowAssignDoctorModal] = useState(false);
  const [showAssignTAModal, setShowAssignTAModal] = useState(false);

  // Enrollment and Roster State
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [withdrawTarget, setWithdrawTarget] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [rosterSearch, setRosterSearch] = useState("");

  // Upload Modal State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadType, setUploadType] = useState<"LECTURE" | "TUTORIAL">("LECTURE");
  const [materialTitle, setMaterialTitle] = useState("");
  const [materialDescription, setMaterialDescription] = useState("");
  const [uploadMode, setUploadMode] = useState<"file" | "link">("file");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [externalUrl, setExternalUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Material Actions & Deletion Confirmation
  const [deleteMaterialTarget, setDeleteMaterialTarget] = useState<number | null>(null);
  const [deleteMaterialLoading, setDeleteMaterialLoading] = useState(false);
  const [downloadingMaterialId, setDownloadingMaterialId] = useState<string | number | null>(null);

  // Unassign Staff Modal States
  const [unassignDoctorTarget, setUnassignDoctorTarget] = useState<{
    doctorId: number;
    doctorName: string;
  } | null>(null);
  const [unassignTATarget, setUnassignTATarget] = useState<{
    taId: number | string;
    taName: string;
  } | null>(null);
  const [unassignActionLoading, setUnassignActionLoading] = useState(false);

  // Task & Submissions State
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showSubmissionsModal, setShowSubmissionsModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<CourseTask | null>(null);
  const [courseMySubmissions, setCourseMySubmissions] = useState<
    Record<number, CourseStudentSubmission | null | undefined>
  >({});

  const isRTL = i18n.language === "ar";

  // Authorization checks
  const canManageRoster = useMemo(() => {
    return (
      user?.role === "SUPER_ADMIN" ||
      user?.role === "ADMIN" ||
      user?.role === "COLLEGE_ADMIN" ||
      user?.role === "DEPARTMENT_ADMIN"
    );
  }, [user?.role]);

  // Derived Staff Assignments from Schedule Slots
  const assignedDoctors = useMemo<AssignedDoctorInfo[]>(() => {
    if (!course?.scheduleSlots) return [];
    const docMap = new Map<number, AssignedDoctorInfo>();
    course.scheduleSlots.forEach((slot: CourseScheduleSlot) => {
      if (slot.doctor) {
        const existing = docMap.get(slot.doctor.id);
        const slotSummary = {
          dayOfWeek: slot.dayOfWeek,
          startTime: slot.startTime,
          endTime: slot.endTime,
          room: slot.room,
          slotType: slot.slotType,
        };
        if (existing) {
          existing.slots.push(slotSummary);
        } else {
          docMap.set(slot.doctor.id, {
            id: slot.doctor.id,
            firstName: slot.doctor.firstName,
            lastName: slot.doctor.lastName,
            doctorId: slot.doctor.doctorId,
            slots: [slotSummary],
          });
        }
      }
    });
    return Array.from(docMap.values());
  }, [course?.scheduleSlots]);

  const assignedTAs = useMemo<AssignedTAInfo[]>(() => {
    if (!course?.scheduleSlots) return [];
    const taMap = new Map<string | number, AssignedTAInfo>();
    course.scheduleSlots.forEach((slot: CourseScheduleSlot) => {
      if (slot.teachingAssistant) {
        const key = slot.teachingAssistant.id;
        const existing = taMap.get(key);
        const slotSummary = {
          dayOfWeek: slot.dayOfWeek,
          startTime: slot.startTime,
          endTime: slot.endTime,
          room: slot.room,
          slotType: slot.slotType,
        };
        if (existing) {
          existing.slots.push(slotSummary);
        } else {
          taMap.set(key, {
            id: key,
            firstName: slot.teachingAssistant.firstName,
            lastName: slot.teachingAssistant.lastName,
            employeeId: slot.teachingAssistant.employeeId,
            slots: [slotSummary],
          });
        }
      }
    });
    return Array.from(taMap.values());
  }, [course?.scheduleSlots]);

  const canUpload = useMemo(() => {
    if (!user) return false;
    if (user.role === "SUPER_ADMIN" || user.role === "ADMIN" || user.role === "COLLEGE_ADMIN" || user.role === "DEPARTMENT_ADMIN") {
      return true;
    }
    if (user.role === "DOCTOR") {
      const docId = user.doctor?.id;
      return Boolean(docId && assignedDoctors.some((d) => d.id === docId));
    }
    if (user.role === "TEACHING_ASSISTANT") {
      const taId = user.teachingAssistant?.id;
      return Boolean(taId && assignedTAs.some((t) => String(t.id) === String(taId)));
    }
    return false;
  }, [user, assignedDoctors, assignedTAs]);

  const canCreateTask = useMemo(() => {
    return (
      user?.role === "DOCTOR" ||
      user?.role === "SUPER_ADMIN" ||
      user?.role === "COLLEGE_ADMIN"
    );
  }, [user?.role]);

  // Fetch Course Details
  const fetchCourseDetails = useCallback(async () => {
    if (!actualId) return;
    try {
      setLoading(true);
      const res = await coursesService.getCourseById(actualId);
      if (res.success && res.data) {
        setCourse(res.data as CourseDetailsData);
      } else {
        setCourse(null);
      }
    } catch (err: unknown) {
      logger.error("Error fetching course details:", err);
      setCourse(null);
    } finally {
      setLoading(false);
    }
  }, [actualId]);

  useEffect(() => {
    fetchCourseDetails();
  }, [fetchCourseDetails]);

  // Fetch Student Submissions
  const fetchCourseMySubmissions = useCallback(async () => {
    if (!course || user?.role !== "STUDENT") return;
    const taskIds = (course.tasks || []).map((t) => t.id);
    const map: Record<number, CourseStudentSubmission | null> = {};
    await Promise.all(
      taskIds.map(async (tid: number) => {
        try {
          const res = await taskService.getMySubmission(tid);
          if (res.success && res.data) {
            map[tid] = res.data as CourseStudentSubmission;
          } else {
            map[tid] = null;
          }
        } catch {
          map[tid] = null;
        }
      })
    );
    setCourseMySubmissions(map);
  }, [course, user?.role]);

  useEffect(() => {
    if (course && user?.role === "STUDENT") {
      fetchCourseMySubmissions();
    }
  }, [course, user?.role, fetchCourseMySubmissions]);

  // Material Deletion
  const handleDeleteMaterial = (materialId: number) => {
    setDeleteMaterialTarget(materialId);
  };

  const confirmDeleteMaterial = async () => {
    if (!deleteMaterialTarget || !actualId) return;
    try {
      setDeleteMaterialLoading(true);
      const res = await coursesService.deleteCourseMaterial(actualId, deleteMaterialTarget);
      if (res.success) {
        showToast(
          isRTL ? "تم حذف الملف بنجاح" : "Material deleted successfully",
          "success"
        );
        fetchCourseDetails();
        setDeleteMaterialTarget(null);
      } else {
        showToast(res.message || "Failed to delete material", "error");
      }
    } catch (err: unknown) {
      logger.error("Error deleting material:", err);
      const msg = err instanceof Error ? err.message : "Error deleting material";
      showToast(msg, "error");
    } finally {
      setDeleteMaterialLoading(false);
    }
  };

  // Material Toggle Publication
  const handleTogglePublication = async (materialId: number) => {
    if (!actualId) return;
    try {
      setCourse((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          materials: (prev.materials || []).map((m) =>
            m.id === materialId ? { ...m, isPublished: !m.isPublished } : m
          ),
        };
      });
      const res = await coursesService.toggleCourseMaterial(actualId, materialId);
      if (!res.success) {
        fetchCourseDetails();
      }
    } catch (err: unknown) {
      logger.error("Failed to toggle publication:", err);
      fetchCourseDetails();
    }
  };

  // Material Download
  const handleDownloadMaterial = async (item: CourseMaterial) => {
    if (!item) return;
    if (item.fileUrl && (item.fileUrl.startsWith("http://") || item.fileUrl.startsWith("https://"))) {
      window.open(item.fileUrl, "_blank", "noopener,noreferrer");
      return;
    }
    const cId = actualId || course?.id;
    if (!cId || !item.id) return;

    try {
      setDownloadingMaterialId(item.id);
      await coursesService.downloadCourseMaterial(
        String(cId),
        item.id,
        item.fileName || item.title
      );
    } catch (err: unknown) {
      logger.error("Failed to download course material", err);
      showToast(t("courses.downloadFailed", "Failed to download course material"), "error");
    } finally {
      setDownloadingMaterialId(null);
    }
  };

  // Upload Submission
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!materialTitle.trim()) {
      setUploadError(t("courses.materialTitlePlaceholder", "Title is required"));
      return;
    }
    if (uploadMode === "file" && !selectedFile) {
      setUploadError(t("courses.selectFile", "Please select a file to upload"));
      return;
    }
    if (uploadMode === "link" && !externalUrl.trim()) {
      setUploadError(t("courses.enterUrl", "Please enter a valid link"));
      return;
    }

    try {
      setIsUploading(true);
      setUploadError(null);
      const formData = new FormData();
      formData.append("title", materialTitle.trim());
      formData.append("type", uploadType);
      if (materialDescription.trim()) {
        formData.append("description", materialDescription.trim());
      }
      if (uploadMode === "file" && selectedFile) {
        formData.append("file", selectedFile);
      } else if (uploadMode === "link" && externalUrl.trim()) {
        formData.append("fileUrl", externalUrl.trim());
      }

      const res = await coursesService.uploadCourseMaterial(actualId!, formData);
      if (res.success) {
        showToast(
          isRTL ? "تم رفع الملف بنجاح" : "Material uploaded successfully",
          "success"
        );
        setIsUploadModalOpen(false);
        setMaterialTitle("");
        setMaterialDescription("");
        setSelectedFile(null);
        setExternalUrl("");
        fetchCourseDetails();
      } else {
        setUploadError(res.message || "Failed to upload material");
      }
    } catch (err: unknown) {
      logger.error("Upload error:", err);
      setUploadError(
        isRTL ? "حدث خطأ أثناء رفع الملف" : "Failed to upload material"
      );
    } finally {
      setIsUploading(false);
    }
  };

  // Course Publication Toggle
  const handleToggleCoursePublication = async () => {
    if (!actualId) return;
    try {
      setCourse((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          isPublished: !(prev.isPublished ?? true),
        };
      });
      const res = await coursesService.toggleCoursePublication(actualId);
      if (!res.success) {
        fetchCourseDetails();
      }
    } catch (err: unknown) {
      logger.error("Failed to toggle course publication:", err);
      fetchCourseDetails();
    }
  };

  // Unassign Staff Handlers
  const handleUnassignDoctor = (doctorId: number, doctorName: string) => {
    setUnassignDoctorTarget({ doctorId, doctorName });
  };

  const confirmUnassignDoctor = async () => {
    if (!unassignDoctorTarget || !actualId) return;
    try {
      setUnassignActionLoading(true);
      await api.delete(
        `/doctors/${unassignDoctorTarget.doctorId}/courses/${actualId}`
      );
      showToast(
        isRTL
          ? "تمت إزالة إسناد الدكتور بنجاح"
          : "Unassigned doctor successfully",
        "success"
      );
      fetchCourseDetails();
      setUnassignDoctorTarget(null);
    } catch (err: unknown) {
      logger.error("Error unassigning doctor:", err);
      showToast(
        isRTL
          ? "حدث خطأ أثناء إزالة الإسناد"
          : "Error unassigning doctor",
        "error"
      );
    } finally {
      setUnassignActionLoading(false);
    }
  };

  const handleUnassignTA = (taId: number | string, taName: string) => {
    setUnassignTATarget({ taId, taName });
  };

  const confirmUnassignTA = async () => {
    if (!unassignTATarget || !actualId) return;
    try {
      setUnassignActionLoading(true);
      await api.delete(
        `/teaching-assistants/${unassignTATarget.taId}/courses/${actualId}`
      );
      showToast(
        isRTL
          ? "تمت إزالة إسناد المعيد بنجاح"
          : "Unassigned teaching assistant successfully",
        "success"
      );
      fetchCourseDetails();
      setUnassignTATarget(null);
    } catch (err: unknown) {
      logger.error("Error unassigning TA:", err);
      showToast(
        isRTL
          ? "حدث خطأ أثناء إزالة الإسناد"
          : "Error unassigning teaching assistant",
        "error"
      );
    } finally {
      setUnassignActionLoading(false);
    }
  };

  // Student Withdrawal Handler
  const handleConfirmWithdraw = async () => {
    if (!withdrawTarget) return;
    const targetId = withdrawTarget.id;
    try {
      setIsWithdrawing(true);
      const res = await enrollmentService.withdrawStudent(targetId);
      if (res.success) {
        showToast(
          t("courses.withdrawSuccess", "Student withdrawn from course successfully"),
          "success"
        );
        setWithdrawTarget(null);
        setCourse((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            enrollments: (prev.enrollments || []).filter((e) => e.id !== targetId),
          };
        });
        fetchCourseDetails();
      } else {
        showToast(
          res.message || (isRTL ? "فشل سحب قيد الطالب" : "Failed to withdraw student"),
          "error"
        );
      }
    } catch (err: unknown) {
      logger.error("Error withdrawing student:", err);
      showToast(
        isRTL ? "حدث خطأ أثناء سحب قيد الطالب" : "Error withdrawing student",
        "error"
      );
    } finally {
      setIsWithdrawing(false);
    }
  };

  // Task Handlers
  const handleCreateTaskSubmit = async (data: {
    title: string;
    description: string;
    maxScore: number;
    dueDate: string;
  }) => {
    if (!actualId) return;
    const res = await taskService.createTask({
      courseId: Number(actualId),
      title: data.title,
      description: data.description,
      dueDate: data.dueDate,
      maxScore: data.maxScore,
    });
    if (res.success) {
      showToast(
        isRTL ? "تم إنشاء التكليف بنجاح" : "Task created successfully",
        "success"
      );
      fetchCourseDetails();
    } else {
      throw new Error(res.message || "Failed to create task");
    }
  };

  const handleSubmitTaskSubmit = async (data: {
    fileUrl: string;
    notes?: string;
  }) => {
    if (!selectedTask) return;
    const res = await taskService.submitTask(selectedTask.id, {
      notes: data.notes,
      fileUrl: data.fileUrl,
    });
    if (res.success) {
      showToast(
        isRTL ? "تم تسليم التكليف بنجاح" : "Task submitted successfully",
        "success"
      );
      fetchCourseDetails();
      fetchCourseMySubmissions();
    } else {
      throw new Error(res.message || "Failed to submit task");
    }
  };

  const formatTaskDate = (dateStr: string) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString(
      i18n.language === "ar" ? "ar-EG" : "en-US",
      {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }
    );
  };

  // Materials partition
  const materials = course?.materials || [];
  const lectures = materials.filter((m) => m.type === "LECTURE");
  const tutorials = materials.filter((m) => m.type === "TUTORIAL");
  const enrolledStudents = (course?.enrollments || []).filter(
    (e) => e.status === "ENROLLED" || !e.status
  );
  const filteredRoster = enrolledStudents.filter((e) => {
    if (!rosterSearch) return true;
    const name = `${e.student?.firstName || ""} ${e.student?.lastName || ""}`.toLowerCase();
    const code = (e.student?.studentId || "").toLowerCase();
    const query = rosterSearch.toLowerCase();
    return name.includes(query) || code.includes(query);
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <Loader2 className="animate-spin text-brand-primary-600" size={48} />
        <p className="text-sm font-bold text-brand-text-muted">
          {t("common.loading", "Loading...")}
        </p>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="text-center py-20">
        <AlertCircle size={40} className="text-brand-text-muted mx-auto mb-4" />
        <h2 className="text-2xl font-bold">
          {t("courses.noCourses", "No courses found")}
        </h2>
        {!isDrawerMode && (
          <button
            type="button"
            className="mt-6 px-4 py-2 rounded-xl border border-brand-border text-sm font-bold hover:bg-surface-subtle"
            onClick={() => navigate("/courses")}
          >
            <ArrowLeft
              size={18}
              className={isRTL ? "ml-2 rotate-180 inline" : "mr-2 inline"}
            />{" "}
            {t("common.back", "Back")}
          </button>
        )}
      </div>
    );
  }

  const breadcrumbItems = [
    { label: t("nav.courses", "Courses"), link: "/courses" },
    ...(course.department?.college?.name
      ? [
          {
            label: course.department.college.name,
            link: `/colleges/${course.department.college.id}`,
          },
        ]
      : []),
    ...(course.department?.name
      ? [
          {
            label: course.department.name,
            link: `/departments/${course.department.id}`,
          },
        ]
      : []),
    { label: course.name },
  ];

  return (
    <div
      className={
        isDrawerMode
          ? "animate-in fade-in duration-500"
          : "section-gap animate-in fade-in duration-500 space-y-6"
      }
    >
      {!isDrawerMode && (
        <div className="mb-4">
          <Breadcrumbs items={breadcrumbItems} />
        </div>
      )}

      {/* Main Header Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-brand-navy-500 via-brand-navy-600 to-brand-navy-800 text-white p-6 sm:p-8 rounded-3xl shadow-lg border border-white/10">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            {!isDrawerMode && (
              <button
                type="button"
                onClick={() => navigate("/courses")}
                className="p-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition-colors mt-1"
                title={t("common.back", "Back")}
              >
                <ArrowLeft size={22} className={isRTL ? "rotate-180" : ""} />
              </button>
            )}
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <Badge
                  variant="primary"
                  className="bg-brand-primary-500/25 text-brand-primary-300 border border-brand-primary-400/30 px-3 py-1 font-bold text-xs uppercase tracking-widest"
                >
                  {course.courseCode}
                </Badge>
                <span className="bg-white/10 px-3 py-1 rounded-full text-xs font-semibold text-white/80">
                  {t("auth.year", "Year")} {course.year}
                </span>
                <span className="bg-white/10 px-3 py-1 rounded-full text-xs font-semibold text-white/80">
                  {t("transcript.semester", "Semester")} {course.semester}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight">
                {course.name}
              </h1>
              <p className="text-xs sm:text-sm text-white/70 font-medium mt-2 flex flex-wrap items-center gap-2">
                <span>
                  {course.department?.name || t("courses.noDepartment", "No Department")}
                </span>
                {course.department?.college?.name && (
                  <>
                    <span>•</span>
                    <span>{course.department.college.name}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Quick Action Badges */}
          <div className="flex flex-wrap md:flex-col items-start md:items-end justify-between md:justify-center gap-3 border-t md:border-t-0 border-white/10 pt-4 md:pt-0">
            <div className="flex items-center gap-2.5 bg-white/10 px-4 py-2 rounded-2xl backdrop-blur-md border border-white/10">
              <Users size={18} className="text-brand-primary-400" />
              <span className="text-xs font-medium text-white/70">
                {t("courses.students", "Students")}:
              </span>
              <span className="font-black text-base text-white">
                {course._count?.enrollments ?? course.enrollments?.length ?? 0}
              </span>
            </div>
            <div className="flex items-center gap-2.5 bg-white/10 px-4 py-2 rounded-2xl backdrop-blur-md border border-white/10">
              <BookOpen size={18} className="text-emerald-400" />
              <span className="text-xs font-medium text-white/70">
                {t("courses.credits", "Credits")}:
              </span>
              <span className="font-black text-base text-white">
                {course.credits}
              </span>
            </div>
          </div>
        </div>

        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-brand-primary-500/15 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-brand-border pb-2">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          <button
            onClick={() => setActiveTab("overview")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-xs transition-all whitespace-nowrap ${
              activeTab === "overview"
                ? "bg-brand-primary-500 text-white shadow-md shadow-brand-primary-500/20"
                : "bg-surface-card text-brand-text-sub hover:bg-brand-primary-50 hover:text-brand-brand-green-dark border border-brand-border"
            }`}
          >
            <BookOpen size={16} />
            <span>{t("courses.overview", "Overview")}</span>
          </button>

          <button
            onClick={() => setActiveTab("lectures")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-xs transition-all whitespace-nowrap ${
              activeTab === "lectures"
                ? "bg-brand-primary-500 text-white shadow-md shadow-brand-primary-500/20"
                : "bg-surface-card text-brand-text-sub hover:bg-brand-primary-50 hover:text-brand-brand-green-dark border border-brand-border"
            }`}
          >
            <FileText size={16} />
            <span>{t("courses.lectures", "Lectures")}</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === "lectures"
                  ? "bg-white/20 text-white"
                  : "bg-brand-primary-100 text-brand-primary-700"
              }`}
            >
              {lectures.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("tutorials")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-xs transition-all whitespace-nowrap ${
              activeTab === "tutorials"
                ? "bg-brand-primary-500 text-white shadow-md shadow-brand-primary-500/20"
                : "bg-surface-card text-brand-text-sub hover:bg-brand-primary-50 hover:text-brand-brand-green-dark border border-brand-border"
            }`}
          >
            <Video size={16} />
            <span>{t("courses.tutorials", "Tutorials & Labs")}</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === "tutorials"
                  ? "bg-white/20 text-white"
                  : "bg-brand-primary-100 text-brand-primary-700"
              }`}
            >
              {tutorials.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("tasks")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-xs transition-all whitespace-nowrap ${
              activeTab === "tasks"
                ? "bg-brand-primary-500 text-white shadow-md shadow-brand-primary-500/20"
                : "bg-surface-card text-brand-text-sub hover:bg-brand-primary-50 hover:text-brand-brand-green-dark border border-brand-border"
            }`}
          >
            <ClipboardList size={16} />
            <span>{t("courses.tasks", "Tasks & Assignments")}</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === "tasks"
                  ? "bg-white/20 text-white"
                  : "bg-brand-primary-100 text-brand-primary-700"
              }`}
            >
              {course.tasks?.length || 0}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("roster")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-xs transition-all whitespace-nowrap ${
              activeTab === "roster"
                ? "bg-brand-primary-500 text-white shadow-md shadow-brand-primary-500/20"
                : "bg-surface-card text-brand-text-sub hover:bg-brand-primary-50 hover:text-brand-brand-green-dark border border-brand-border"
            }`}
          >
            <Users size={16} />
            <span>{t("courses.roster", "Enrolled Students")}</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === "roster"
                  ? "bg-white/20 text-white"
                  : "bg-brand-primary-100 text-brand-primary-700"
              }`}
            >
              {enrolledStudents.length}
            </span>
          </button>
        </div>

        {/* Action Controls & Course Publication Status */}
        <div className="flex flex-wrap items-center gap-3">
          {assignedDoctors.length > 0 ? (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 text-[11px] font-bold">
              <CheckCircle2 size={14} />
              <span>
                مُسندة (د. {assignedDoctors[0].firstName} {assignedDoctors[0].lastName})
              </span>
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200/50 text-[11px] font-bold">
              <AlertCircle size={14} />
              <span>غير مسندة</span>
            </div>
          )}

          {canUpload ? (
            <button
              onClick={handleToggleCoursePublication}
              className={`flex items-center gap-2 px-4 py-2 rounded-2xl font-bold text-xs shadow-sm transition-all border ${
                course.isPublished !== false
                  ? "bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-600 shadow-emerald-500/20"
                  : "bg-amber-500 hover:bg-amber-600 text-white border-amber-600 shadow-amber-500/20"
              }`}
              title={
                course.isPublished !== false
                  ? "المقرر منشور حالياً للطلاب - اضغط لإخفائه ووضعه كمسودة"
                  : "المقرر مخفي كمسودة - اضغط لنشره رسمياً للطلاب"
              }
            >
              {course.isPublished !== false ? (
                <>
                  <Eye size={16} />
                  <span>المقرر منشور للطلاب 🟢</span>
                </>
              ) : (
                <>
                  <EyeOff size={16} />
                  <span>مسودة ومخفي 🔴 (انقر للنشر)</span>
                </>
              )}
            </button>
          ) : (
            <div
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-xs font-bold ${
                course.isPublished !== false
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-amber-50 text-amber-700 border-amber-200"
              }`}
            >
              {course.isPublished !== false ? (
                <>
                  <CheckCircle2 size={14} />
                  <span>مقرر منشور 🟢</span>
                </>
              ) : (
                <>
                  <AlertCircle size={14} />
                  <span>مقرر غير منشور (مسودة) 🔴</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Student Notice Banner if Course is in Draft Mode */}
      {user?.role === "STUDENT" && course.isPublished === false && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 rounded-2xl p-4 flex items-center gap-3 text-amber-800 dark:text-amber-300 shadow-sm">
          <AlertCircle
            size={20}
            className="shrink-0 text-amber-600 dark:text-amber-400"
          />
          <div className="text-xs font-bold leading-relaxed">
            {t(
              "courses.draftNotice",
              "Notice: This course is currently in draft mode and has not yet been officially published to students by the instructor."
            )}
          </div>
        </div>
      )}

      {/* TAB 1: OVERVIEW */}
      {activeTab === "overview" && (
        <CourseOverviewTab
          course={course}
          assignedDoctors={assignedDoctors}
          assignedTAs={assignedTAs}
          lecturesCount={lectures.length}
          tutorialsCount={tutorials.length}
          canManageRoster={canManageRoster}
          isRTL={isRTL}
          onAssignDoctor={() => setShowAssignDoctorModal(true)}
          onAssignTA={() => setShowAssignTAModal(true)}
          onUnassignDoctor={handleUnassignDoctor}
          onUnassignTA={handleUnassignTA}
        />
      )}

      {/* TAB 2: LECTURES */}
      {activeTab === "lectures" && (
        <CourseMaterialsTab
          type="LECTURE"
          materials={lectures}
          canUpload={canUpload}
          userId={user?.id}
          downloadingMaterialId={downloadingMaterialId}
          onUpload={(type) => {
            setUploadType(type);
            setIsUploadModalOpen(true);
          }}
          onTogglePublication={handleTogglePublication}
          onDeleteMaterial={handleDeleteMaterial}
          onDownloadMaterial={handleDownloadMaterial}
        />
      )}

      {/* TAB 3: TUTORIALS & LABS */}
      {activeTab === "tutorials" && (
        <CourseMaterialsTab
          type="TUTORIAL"
          materials={tutorials}
          canUpload={canUpload}
          userId={user?.id}
          downloadingMaterialId={downloadingMaterialId}
          onUpload={(type) => {
            setUploadType(type);
            setIsUploadModalOpen(true);
          }}
          onTogglePublication={handleTogglePublication}
          onDeleteMaterial={handleDeleteMaterial}
          onDownloadMaterial={handleDownloadMaterial}
        />
      )}

      {/* TAB 4: TASKS & ASSIGNMENTS */}
      {activeTab === "tasks" && (
        <CourseTasksTab
          tasks={course.tasks || []}
          courseMySubmissions={courseMySubmissions}
          isStudent={user?.role === "STUDENT"}
          canCreateTask={canCreateTask}
          formatTaskDate={formatTaskDate}
          onCreateTask={() => setShowTaskModal(true)}
          onSubmitTask={(task) => {
            setSelectedTask(task);
            setShowSubmitModal(true);
          }}
          onViewSubmissions={(task) => {
            setSelectedTask(task);
            setShowSubmissionsModal(true);
          }}
        />
      )}

      {/* SUBMISSIONS & GRADING MODAL */}
      <SubmissionsGradingModal
        isOpen={showSubmissionsModal}
        onClose={() => setShowSubmissionsModal(false)}
        task={selectedTask ? { ...selectedTask, course } : null}
      />

      {/* TAB 5: STUDENTS ROSTER */}
      {activeTab === "roster" && (
        <CourseRosterTab
          enrolledStudents={enrolledStudents}
          rosterSearch={rosterSearch}
          setRosterSearch={setRosterSearch}
          filteredRoster={filteredRoster}
          canManageRoster={canManageRoster}
          setShowEnrollModal={setShowEnrollModal}
          setWithdrawTarget={setWithdrawTarget}
        />
      )}

      {/* UPLOAD MODAL */}
      <CourseUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        course={course}
        uploadType={uploadType}
        setUploadType={setUploadType}
        materialTitle={materialTitle}
        setMaterialTitle={setMaterialTitle}
        materialDescription={materialDescription}
        setMaterialDescription={setMaterialDescription}
        uploadMode={uploadMode}
        setUploadMode={setUploadMode}
        selectedFile={selectedFile}
        setSelectedFile={setSelectedFile}
        externalUrl={externalUrl}
        setExternalUrl={setExternalUrl}
        uploadError={uploadError}
        setUploadError={setUploadError}
        isSubmitting={isUploading}
        handleUploadSubmit={handleUploadSubmit}
      />

      {/* CREATE TASK MODAL */}
      <CreateTaskModal
        isOpen={showTaskModal}
        onClose={() => setShowTaskModal(false)}
        courseName={course.name}
        onSubmit={handleCreateTaskSubmit}
      />

      {/* SUBMIT TASK MODAL */}
      <SubmitTaskModal
        isOpen={showSubmitModal}
        onClose={() => setShowSubmitModal(false)}
        task={selectedTask}
        onSubmit={handleSubmitTaskSubmit}
      />

      {/* ENROLL STUDENT MODAL */}
      {canManageRoster && (
        <EnrollStudentModal
          isOpen={showEnrollModal}
          onClose={() => setShowEnrollModal(false)}
          courseId={actualId!}
          courseName={course.name || ""}
          courseCode={course.courseCode}
          semester={course.semester || 1}
          academicYear={course.year || 1}
          currentEnrolledStudentIds={enrolledStudents
            .map((e) => e.studentId || e.student?.id)
            .filter(Boolean)}
          departmentId={course.departmentId ?? undefined}
          onSuccess={fetchCourseDetails}
        />
      )}

      {/* ASSIGN DOCTOR MODAL */}
      {canManageRoster && (
        <AssignDoctorModal
          isOpen={showAssignDoctorModal}
          onClose={() => setShowAssignDoctorModal(false)}
          course={course}
          currentAssignedDoctors={assignedDoctors}
          onSuccess={fetchCourseDetails}
        />
      )}

      {/* ASSIGN TA MODAL */}
      {canManageRoster && (
        <AssignTAModal
          isOpen={showAssignTAModal}
          onClose={() => setShowAssignTAModal(false)}
          course={course}
          currentAssignedTAs={assignedTAs}
          onSuccess={fetchCourseDetails}
        />
      )}

      {/* WITHDRAW CONFIRMATION MODAL */}
      {canManageRoster && (
        <ConfirmDeleteModal
          isOpen={!!withdrawTarget}
          onClose={() => setWithdrawTarget(null)}
          itemName={withdrawTarget?.name || ""}
          title={t("courses.withdrawConfirmTitle", "Withdraw Student from Course")}
          subtitle={t("courses.withdrawConfirmSubtitle", "Confirm student withdrawal from this course")}
          message={
            isRTL
              ? `هل أنت متأكد من سحب قيد الطالب (${withdrawTarget?.name}) من هذا المقرر؟ سيتم تغيير حالة القيد إلى منسحب.`
              : `Are you sure you want to withdraw ${withdrawTarget?.name} from this course?`
          }
          confirmLabel={t("courses.confirmWithdraw", "Confirm Withdrawal")}
          cancelLabel={t("common.cancel", "Cancel")}
          variant="danger"
          loading={isWithdrawing}
          onConfirm={handleConfirmWithdraw}
        />
      )}

      {/* UNASSIGN DOCTOR CONFIRMATION MODAL */}
      <ConfirmDeleteModal
        isOpen={Boolean(unassignDoctorTarget)}
        title={isRTL ? "تأكيد إلغاء إسناد الدكتور" : "Confirm Unassign Doctor"}
        message={
          isRTL
            ? `هل أنت متأكد من إزالة إسناد د. ${unassignDoctorTarget?.doctorName} عن هذا المقرر؟`
            : `Are you sure you want to unassign Dr. ${unassignDoctorTarget?.doctorName} from this course?`
        }
        onClose={() => !unassignActionLoading && setUnassignDoctorTarget(null)}
        onConfirm={confirmUnassignDoctor}
        loading={unassignActionLoading}
        variant="warning"
        confirmLabel={isRTL ? "إلغاء الإسناد" : "Unassign"}
      />

      {/* UNASSIGN TA CONFIRMATION MODAL */}
      <ConfirmDeleteModal
        isOpen={Boolean(unassignTATarget)}
        title={isRTL ? "تأكيد إلغاء إسناد المعيد" : "Confirm Unassign TA"}
        message={
          isRTL
            ? `هل أنت متأكد من إزالة إسناد م. ${unassignTATarget?.taName} عن هذا المقرر؟`
            : `Are you sure you want to unassign TA ${unassignTATarget?.taName} from this course?`
        }
        onClose={() => !unassignActionLoading && setUnassignTATarget(null)}
        onConfirm={confirmUnassignTA}
        loading={unassignActionLoading}
        variant="warning"
        confirmLabel={isRTL ? "إلغاء الإسناد" : "Unassign"}
      />

      {/* DELETE MATERIAL CONFIRMATION MODAL */}
      <ConfirmDeleteModal
        isOpen={Boolean(deleteMaterialTarget)}
        title={isRTL ? "تأكيد حذف الملف التعليمي" : "Confirm Delete Material"}
        message={
          isRTL
            ? "هل أنت متأكد من إغلاق وحذف هذا الملف الدراسي؟"
            : "Are you sure you want to delete this material?"
        }
        onClose={() => !deleteMaterialLoading && setDeleteMaterialTarget(null)}
        onConfirm={confirmDeleteMaterial}
        loading={deleteMaterialLoading}
        variant="danger"
      />
    </div>
  );
};

export default CourseDetails;
