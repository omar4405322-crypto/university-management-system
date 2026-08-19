// @ts-nocheck
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Users,
  GraduationCap,
  Loader2,
  AlertCircle,
  ArrowLeft,
  Upload,
  FileText,
  Video,
  Download,
  Trash2,
  Plus,
  Calendar,
  Clock,
  MapPin,
  ExternalLink,
  ShieldCheck,
  UserCheck,
  Search,
  FileCode,
  Link as LinkIcon,
  CheckCircle2,
  ClipboardList,
  Eye,
  EyeOff,
  FileUp,
  CheckCircle,
  MessageSquare,
  Pencil,
  Send,
  UserPlus,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/button';
import Badge from '../../components/ui/Badge';
import Breadcrumbs from '../../components/ui/Breadcrumbs';
import Modal from '../../components/ui/Modal';
import ConfirmDeleteModal from '../../components/ui/ConfirmDeleteModal';
import taskService from '../../services/task.service';
import SubmissionsGradingModal from '../../components/tasks/SubmissionsGradingModal';
import coursesService from '../../services/courses.service';
import enrollmentService from '../../services/enrollment.service';
import EnrollStudentModal from './EnrollStudentModal';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { logger } from '../../lib/logger';

interface CourseDetailsProps {
  courseId?: string;
  isDrawerMode?: boolean;
}

type TabType = 'overview' | 'lectures' | 'tutorials' | 'tasks' | 'roster';

const CourseDetails: React.FC<CourseDetailsProps> = ({ courseId, isDrawerMode = false }) => {
  const { id } = useParams();
  const actualId = courseId || id;
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [course, setCourse] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  // Enrollment and Roster State
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [withdrawTarget, setWithdrawTarget] = useState<{ id: number; name: string } | null>(null);
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  // Upload Modal State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadType, setUploadType] = useState<'LECTURE' | 'TUTORIAL'>('LECTURE');
  const [materialTitle, setMaterialTitle] = useState('');
  const [materialDescription, setMaterialDescription] = useState('');
  const [uploadMode, setUploadMode] = useState<'file' | 'link'>('file');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [externalUrl, setExternalUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Task Modal State
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showSubmissionsModal, setShowSubmissionsModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskMaxScore, setTaskMaxScore] = useState(100);
  const [taskDueDate, setTaskDueDate] = useState('');
  const [submitNotes, setSubmitNotes] = useState('');
  const [submitFileUrl, setSubmitFileUrl] = useState('');
  const [taskError, setTaskError] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [submissionState, setSubmissionState] = useState<Record<number, any>>({});
  const [courseMySubmissions, setCourseMySubmissions] = useState<Record<number, any>>({});

  // Roster Search State
  const [rosterSearch, setRosterSearch] = useState('');

  const isRTL = i18n.language === 'ar';

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setTaskError(null);
      const result = await taskService.createTask({
        title: taskTitle,
        description: taskDesc,
        courseId: actualId,
        dueDate: taskDueDate,
        maxScore: taskMaxScore,
      });
      if (result.success) {
        setShowTaskModal(false);
        setTaskTitle('');
        setTaskDesc('');
        setTaskDueDate('');
        fetchCourseDetails();
      }
    } catch (err: any) {
      setTaskError(err.response?.data?.message || 'حدث خطأ أثناء إضافة التكليف');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask) return;
    try {
      setIsSubmitting(true);
      setTaskError(null);
      const result = await taskService.submitTask(selectedTask.id, {
        notes: submitNotes,
        fileUrl: submitFileUrl,
      });
      if (result.success) {
        setShowSubmitModal(false);
        setSubmitNotes('');
        setSubmitFileUrl('');
        fetchCourseDetails();
        fetchCourseMySubmissions();
      }
    } catch (err: any) {
      setTaskError(err.response?.data?.message || 'حدث خطأ أثناء تسليم التكليف');
    } finally {
      setIsSubmitting(false);
    }
  };

  const fetchSubmissions = async (taskId) => {
    try {
      setLoadingSubmissions(true);
      const result = await taskService.getTaskSubmissions(taskId);
      if (result.success) {
        const data = result.data || [];
        setSubmissions(data);
        const initial: Record<number, any> = {};
        data.forEach((s) => {
          initial[s.id] = {
            score: s.score != null ? String(s.score) : '',
            feedback: s.feedback || '',
          };
        });
        setSubmissionState(initial);
      }
    } catch (error) {
      logger.error(error);
    } finally {
      setLoadingSubmissions(false);
    }
  };

  const handleSaveGrade = async (submissionId: number) => {
    if (!selectedTask) return;
    const st = submissionState[submissionId] || {};
    const scoreNum = parseFloat(String(st.score));
    const maxScore = Number(selectedTask.maxScore || 100);
    if (isNaN(scoreNum) || scoreNum < 0 || scoreNum > maxScore) return;
    try {
      setSubmissionState((prev) => ({
        ...prev,
        [submissionId]: { ...prev[submissionId], saving: true, scoreError: undefined },
      }));
      const result = await taskService.gradeSubmission(
        selectedTask.id,
        submissionId,
        { score: scoreNum, feedback: st.feedback }
      );
      if (result.success) {
        fetchSubmissions(selectedTask.id);
      }
    } catch (e) {
      logger.error(e);
    } finally {
      setSubmissionState((prev) => ({
        ...prev,
        [submissionId]: { ...prev[submissionId], saving: false },
      }));
    }
  };

  const fetchCourseMySubmissions = async () => {
    if (!course || user?.role !== 'STUDENT') return;
    const taskIds = (course.tasks || []).map((t) => t.id);
    const map: Record<number, any> = {};
    await Promise.all(
      taskIds.map(async (tid) => {
        try {
          const r = await taskService.getMySubmission(tid);
          if (r.success) map[tid] = r.data;
        } catch (e) {}
      })
    );
    setCourseMySubmissions(map);
  };

  useEffect(() => {
    if (course && user?.role === 'STUDENT') {
      fetchCourseMySubmissions();
    }
  }, [course, user?.role]);

  const formatTaskDate = (d) =>
    d
      ? new Date(d).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '—';

  const fetchCourseDetails = async () => {
    try {
      setLoading(true);
      const result = await coursesService.getCourseById(actualId!);
      if (result.success) {
        setCourse(result.data);
      }
    } catch (err: any) {
      logger.error(err);
      setCourse(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (actualId) {
      fetchCourseDetails();
    }
  }, [actualId]);

  // Extract deduplicated Professors & TAs assigned to this course via schedule slots
  const { assignedDoctors, assignedTAs } = useMemo(() => {
    if (!course || !course.scheduleSlots) return { assignedDoctors: [], assignedTAs: [] };

    const doctorsMap = new Map();
    const tasMap = new Map();

    course.scheduleSlots.forEach((slot: any) => {
      if (slot.doctor) {
        doctorsMap.set(slot.doctor.id, slot.doctor);
      }
      if (slot.teachingAssistant) {
        tasMap.set(slot.teachingAssistant.id, slot.teachingAssistant);
      }
    });

    return {
      assignedDoctors: Array.from(doctorsMap.values()),
      assignedTAs: Array.from(tasMap.values()),
    };
  }, [course]);

  // Permission Check: Can current user upload materials?
  // Allowed: SuperAdmin, Admin, College/Dept Admin, or Doctor/TA assigned to this course
  const canUpload = useMemo(() => {
    if (!user) return false;
    const adminRoles = ['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN', 'DOCTOR', 'TEACHING_ASSISTANT'];
    return adminRoles.includes(user.role);
  }, [user]);

  // Permission Check: Can current user manage course roster (enroll/withdraw students)?
  // Backend enrollment.routes.ts strictly authorizes: 'SUPER_ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'
  const canManageRoster = useMemo(() => {
    if (!user) return false;
    const authorizedRoles = ['SUPER_ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'];
    return authorizedRoles.includes(user.role);
  }, [user]);

  // Handle Student Withdrawal from Course
  const handleConfirmWithdraw = async () => {
    if (!withdrawTarget) return;
    const targetId = withdrawTarget.id;
    try {
      setIsWithdrawing(true);
      const res = await enrollmentService.withdrawStudent(targetId);
      if (res.success) {
        showToast(t('courses.withdrawSuccess', 'تم سحب قيد الطالب بنجاح'), 'success');
        setWithdrawTarget(null);
        setCourse((prev: any) => {
          if (!prev) return prev;
          return {
            ...prev,
            enrollments: (prev.enrollments || []).filter((e: any) => e.id !== targetId),
          };
        });
        fetchCourseDetails();
      } else {
        showToast(res.message || (isRTL ? 'فشل سحب قيد الطالب' : 'Failed to withdraw student'), 'error');
      }
    } catch (err: any) {
      logger.error('Error withdrawing student:', err);
      const msg = err.response?.data?.message || (isRTL ? 'حدث خطأ أثناء سحب قيد الطالب' : 'Error withdrawing student');
      showToast(msg, 'error');
    } finally {
      setIsWithdrawing(false);
    }
  };

  // Separate materials into Lectures and Tutorials
  const materials = course?.materials || [];
  const lectures = materials.filter((m: any) => m.type === 'LECTURE');
  const tutorials = materials.filter((m: any) => m.type === 'TUTORIAL');

  // Handle Upload Submission
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!materialTitle.trim()) {
      setUploadError(t('courses.materialTitlePlaceholder', 'Title is required'));
      return;
    }

    if (uploadMode === 'file' && !selectedFile) {
      setUploadError(isRTL ? 'الرجاء اختيار ملف للرفع' : 'Please select a file to upload');
      return;
    }

    if (uploadMode === 'link' && !externalUrl.trim()) {
      setUploadError(isRTL ? 'الرجاء إدخال الرابط الخارجي' : 'Please enter an external URL');
      return;
    }

    try {
      setIsSubmitting(true);
      setUploadError(null);

      const formData = new FormData();
      formData.append('title', materialTitle.trim());
      if (materialDescription) formData.append('description', materialDescription.trim());
      formData.append('type', uploadType);

      if (uploadMode === 'file' && selectedFile) {
        formData.append('file', selectedFile);
      } else if (uploadMode === 'link' && externalUrl) {
        formData.append('fileUrl', externalUrl.trim());
      }

      const res = await coursesService.uploadCourseMaterial(actualId!, formData);
      if (res.success) {
        setIsUploadModalOpen(false);
        setMaterialTitle('');
        setMaterialDescription('');
        setSelectedFile(null);
        setExternalUrl('');
        fetchCourseDetails();
      } else {
        setUploadError(res.message || 'Upload failed');
      }
    } catch (err: any) {
      logger.error(err);
      setUploadError(err.response?.data?.message || err.message || 'Error uploading material');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete Material
  const handleDeleteMaterial = async (materialId: number) => {
    const confirmMsg = isRTL ? 'هل أنت تأكد من إغلاق وحذف هذا الملف الدراسي؟' : 'Are you sure you want to delete this material?';
    if (!window.confirm(confirmMsg)) return;

    try {
      // Optimistically update local state so card disappears immediately
      setCourse((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          materials: (prev.materials || []).filter((m: any) => m.id !== materialId),
        };
      });

      const res = await coursesService.deleteCourseMaterial(actualId!, materialId);
      if (res.success) {
        fetchCourseDetails();
      } else {
        fetchCourseDetails(); // rollback/refetch on failure
      }
    } catch (err: any) {
      logger.error(err);
      alert(err.response?.data?.message || err.message || 'Failed to delete material');
      fetchCourseDetails();
    }
  };

  // Handle Toggle Publication Status (Published vs Draft)
  const handleTogglePublication = async (materialId: number) => {
    try {
      setCourse((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          materials: (prev.materials || []).map((m: any) =>
            m.id === materialId ? { ...m, isPublished: !(m.isPublished ?? true) } : m
          ),
        };
      });

      const res = await coursesService.toggleCourseMaterial(actualId!, materialId);
      if (!res.success) {
        fetchCourseDetails();
      }
    } catch (err: any) {
      logger.error(err);
      fetchCourseDetails();
    }
  };

  // Handle Toggle Entire Course Publication Status
  const handleToggleCoursePublication = async () => {
    try {
      setCourse((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          isPublished: !(prev.isPublished ?? true),
        };
      });

      const res = await coursesService.toggleCoursePublication(actualId!);
      if (!res.success) {
        fetchCourseDetails();
      }
    } catch (err: any) {
      logger.error(err);
      fetchCourseDetails();
    }
  };

  // Filtered Roster (active enrollments only)
  const enrolledStudents = (course?.enrollments || []).filter(
    (e: any) => e.status === 'ENROLLED' || !e.status
  );
  const filteredRoster = enrolledStudents.filter((e: any) => {
    if (!rosterSearch) return true;
    const name = `${e.student?.firstName || ''} ${e.student?.lastName || ''}`.toLowerCase();
    const code = (e.student?.studentCode || '').toLowerCase();
    const query = rosterSearch.toLowerCase();
    return name.includes(query) || code.includes(query);
  });

  // Helper for uploader name display
  const getUploaderName = (uploadedBy?: any) => {
    if (!uploadedBy) return '—';
    if (uploadedBy.doctor) {
      return `د. ${uploadedBy.doctor.firstName} ${uploadedBy.doctor.lastName}`;
    }
    if (uploadedBy.teachingAssistant) {
      return `م. ${uploadedBy.teachingAssistant.firstName} ${uploadedBy.teachingAssistant.lastName}`;
    }
    if (uploadedBy.firstName) {
      return `${uploadedBy.firstName} ${uploadedBy.lastName || ''}`;
    }
    return uploadedBy.email || 'أستاذ المادة';
  };

  // Helper for file size display
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return null;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  // Helper for downloading/viewing file url pointing to API backend
  const getDownloadUrl = (url?: string) => {
    if (!url) return '#';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;

    if (typeof window !== 'undefined') {
      const { hostname } = window.location;
      const backendHost = (import.meta as any).env.VITE_BACKEND_URL;

      if (backendHost && backendHost.startsWith('http')) {
        let baseUrl = backendHost.replace(/\/api\/?$/, '');
        if (baseUrl.includes('localhost') && hostname !== 'localhost' && hostname !== '127.0.0.1') {
          baseUrl = baseUrl.replace('localhost', hostname);
        }
        return `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
      }

      // Default to relative path via Vite proxy for mobile/network compatibility
      return `${url.startsWith('/') ? '' : '/'}${url}`;
    }

    return url;
  };

  // Helper for rendering file icon
  const getMaterialIcon = (fileType?: string, fileUrl?: string) => {
    if (fileType?.includes('pdf') || fileUrl?.endsWith('.pdf')) {
      return <FileText className="text-red-500" size={24} />;
    }
    if (fileType?.includes('video') || fileUrl?.match(/\.(mp4|webm|mkv)$/i)) {
      return <Video className="text-blue-500" size={24} />;
    }
    if (!fileType && (fileUrl?.startsWith('http://') || fileUrl?.startsWith('https://'))) {
      return <LinkIcon className="text-purple-500" size={24} />;
    }
    return <FileCode className="text-brand-primary-600" size={24} />;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <Loader2 className="animate-spin text-brand-primary-600" size={48} />
        <p className="text-sm font-bold text-brand-text-muted">{t('common.loading', 'جاري التحميل...')}</p>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="text-center py-20">
        <AlertCircle size={40} className="text-brand-text-muted mx-auto mb-4" />
        <h2 className="text-2xl font-bold">{t('courses.noCourses', 'المقرر غير موجود')}</h2>
        {!isDrawerMode && (
          <Button variant="outline" className="mt-6" onClick={() => navigate('/courses')}>
            <ArrowLeft size={18} className={isRTL ? 'ml-2 rotate-180' : 'mr-2'} /> {t('common.back', 'العودة')}
          </Button>
        )}
      </div>
    );
  }

  const breadcrumbItems = [
    { label: t('nav.courses', 'المقررات الدراسية'), link: '/courses' },
    ...(course.department?.college?.name
      ? [
        {
          label: course.department.college.name,
          link: `/colleges/${course.department.college.id}`,
        },
      ]
      : []),
    ...(course.department?.name
      ? [{ label: course.department.name, link: `/departments/${course.department.id}` }]
      : []),
    { label: course.name },
  ];

  return (
    <div className={isDrawerMode ? 'animate-in fade-in duration-500' : 'section-gap animate-in fade-in duration-500 space-y-6'}>
      {!isDrawerMode && (
        <div className="mb-4">
          <Breadcrumbs items={breadcrumbItems} />
        </div>
      )}

      {/* Main Header Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-brand-navy-500 via-[#1A3344] to-[#12222E] text-white p-6 sm:p-8 rounded-3xl shadow-lg border border-white/10">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            {!isDrawerMode && (
              <button
                type="button"
                onClick={() => navigate('/courses')}
                className="p-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition-colors mt-1"
                title={t('common.back', 'العودة')}
              >
                <ArrowLeft size={22} className={isRTL ? 'rotate-180' : ''} />
              </button>
            )}
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <Badge variant="primary" className="bg-brand-primary-500/25 text-brand-primary-300 border border-brand-primary-400/30 px-3 py-1 font-bold text-xs uppercase tracking-widest">
                  {course.courseCode}
                </Badge>
                <span className="bg-white/10 px-3 py-1 rounded-full text-xs font-semibold text-white/80">
                  {t('auth.year', 'الفرقة')} {course.year}
                </span>
                <span className="bg-white/10 px-3 py-1 rounded-full text-xs font-semibold text-white/80">
                  {t('transcript.semester', 'الترم')} {course.semester}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight">{course.name}</h1>
              <p className="text-xs sm:text-sm text-white/70 font-medium mt-2 flex flex-wrap items-center gap-2">
                <span>{course.department?.name || t('courses.noDepartment', 'قسم أخصائي')}</span>
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
              <span className="text-xs font-medium text-white/70">{t('courses.students', 'الطلاب')}:</span>
              <span className="font-black text-base text-white">{course._count?.enrollments ?? course.enrollments?.length ?? 0}</span>
            </div>
            <div className="flex items-center gap-2.5 bg-white/10 px-4 py-2 rounded-2xl backdrop-blur-md border border-white/10">
              <BookOpen size={18} className="text-emerald-400" />
              <span className="text-xs font-medium text-white/70">{t('courses.credits', 'ساعات معتمدة')}:</span>
              <span className="font-black text-base text-white">{course.credits}</span>
            </div>
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-brand-primary-500/15 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-brand-border pb-2">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-xs transition-all whitespace-nowrap ${activeTab === 'overview'
                ? 'bg-brand-primary-500 text-white shadow-md shadow-brand-primary-500/20'
                : 'bg-surface-card text-brand-text-sub hover:bg-brand-primary-50 hover:text-brand-brand-green-dark border border-brand-border'
              }`}
          >
            <BookOpen size={16} />
            <span>{t('courses.overview', 'نظرة عامة')}</span>
          </button>

          <button
            onClick={() => setActiveTab('lectures')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-xs transition-all whitespace-nowrap ${activeTab === 'lectures'
                ? 'bg-brand-primary-500 text-white shadow-md shadow-brand-primary-500/20'
                : 'bg-surface-card text-brand-text-sub hover:bg-brand-primary-50 hover:text-brand-brand-green-dark border border-brand-border'
              }`}
          >
            <FileText size={16} />
            <span>{t('courses.lectures', 'المحاضرات')}</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${activeTab === 'lectures' ? 'bg-white/20 text-white' : 'bg-brand-primary-100 text-brand-primary-700'}`}>
              {lectures.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('tutorials')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-xs transition-all whitespace-nowrap ${activeTab === 'tutorials'
                ? 'bg-brand-primary-500 text-white shadow-md shadow-brand-primary-500/20'
                : 'bg-surface-card text-brand-text-sub hover:bg-brand-primary-50 hover:text-brand-brand-green-dark border border-brand-border'
              }`}
          >
            <Video size={16} />
            <span>{t('courses.tutorials', 'السكاشن والتمارين')}</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${activeTab === 'tutorials' ? 'bg-white/20 text-white' : 'bg-brand-primary-100 text-brand-primary-700'}`}>
              {tutorials.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('tasks')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-xs transition-all whitespace-nowrap ${activeTab === 'tasks'
                ? 'bg-brand-primary-500 text-white shadow-md shadow-brand-primary-500/20'
                : 'bg-surface-card text-brand-text-sub hover:bg-brand-primary-50 hover:text-brand-brand-green-dark border border-brand-border'
              }`}
          >
            <ClipboardList size={16} />
            <span>{t('courses.tasks', 'الواجبات والمهام')}</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${activeTab === 'tasks' ? 'bg-white/20 text-white' : 'bg-brand-primary-100 text-brand-primary-700'}`}>
              {course?.tasks?.length || 0}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('roster')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-xs transition-all whitespace-nowrap ${activeTab === 'roster'
                ? 'bg-brand-primary-500 text-white shadow-md shadow-brand-primary-500/20'
                : 'bg-surface-card text-brand-text-sub hover:bg-brand-primary-50 hover:text-brand-brand-green-dark border border-brand-border'
              }`}
          >
            <Users size={16} />
            <span>{t('courses.roster', 'قائمة الطلاب')}</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${activeTab === 'roster' ? 'bg-white/20 text-white' : 'bg-brand-primary-100 text-brand-primary-700'}`}>
              {enrolledStudents.length}
            </span>
          </button>
        </div>

        {/* Action Controls & Course Publication Status Indicator */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Assignment Status Badge */}
          {assignedDoctors.length > 0 ? (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 text-[11px] font-bold">
              <CheckCircle2 size={14} />
              <span>مُسندة (د. {assignedDoctors[0].firstName} {assignedDoctors[0].lastName})</span>
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200/50 text-[11px] font-bold">
              <AlertCircle size={14} />
              <span>غير مسندة</span>
            </div>
          )}

          {/* Course Publication Control Toggle for Professor/TA/Admin */}
          {canUpload ? (
            <button
              onClick={handleToggleCoursePublication}
              className={`flex items-center gap-2 px-4 py-2 rounded-2xl font-bold text-xs shadow-sm transition-all border ${
                course?.isPublished !== false
                  ? 'bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-600 shadow-emerald-500/20'
                  : 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600 shadow-amber-500/20'
              }`}
              title={course?.isPublished !== false ? 'المقرر منشور حالياً للطلاب - اضغط لإخفائه ووضعه كمسودة' : 'المقرر مخفي كمسودة - اضغط لنشره رسمياً للطلاب'}
            >
              {course?.isPublished !== false ? (
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
            <div className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-xs font-bold ${
              course?.isPublished !== false
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}>
              {course?.isPublished !== false ? (
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
      {user?.role === 'STUDENT' && course?.isPublished === false && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 rounded-2xl p-4 flex items-center gap-3 text-amber-800 dark:text-amber-300 shadow-sm">
          <AlertCircle size={20} className="shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="text-xs font-bold leading-relaxed">
            {t('courses.draftNotice', 'تنبيه: هذا المقرر الدراسي في وضع المسودة حالياً ولم يتم نشره رسمياً بعد للطلاب بواسطة أستاذ المادة.')}
          </div>
        </div>
      )}

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5">
            <div className="bg-surface-card border border-brand-border p-5 rounded-2xl flex items-center justify-between shadow-card hover:-translate-y-0.5 transition-all">
              <div className="space-y-1">
                <p className="text-xs font-bold text-brand-text-muted">{t('courses.students', 'الطلاب المقيدون')}</p>
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
                <p className="text-xs font-bold text-brand-text-muted">{t('courses.credits', 'الساعات المعتمدة')}</p>
                <h3 className="text-3xl font-black text-brand-text-primary dark:text-brand-text-main">{course.credits}</h3>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-brand-primary-50 dark:bg-brand-primary-950/40 text-brand-brand-green-dark flex items-center justify-center shrink-0">
                <BookOpen size={24} />
              </div>
            </div>

            <div className="bg-surface-card border border-brand-border p-5 rounded-2xl flex items-center justify-between shadow-card hover:-translate-y-0.5 transition-all">
              <div className="space-y-1">
                <p className="text-xs font-bold text-brand-text-muted">{t('courses.lectures', 'المحاضرات المرفوعة')}</p>
                <h3 className="text-3xl font-black text-brand-text-primary dark:text-brand-text-main">{lectures.length}</h3>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <FileText size={24} />
              </div>
            </div>

            <div className="bg-surface-card border border-brand-border p-5 rounded-2xl flex items-center justify-between shadow-card hover:-translate-y-0.5 transition-all">
              <div className="space-y-1">
                <p className="text-xs font-bold text-brand-text-muted">{t('courses.tutorials', 'السكاشن والتمارين')}</p>
                <h3 className="text-3xl font-black text-brand-text-primary dark:text-brand-text-main">{tutorials.length}</h3>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                <Video size={24} />
              </div>
            </div>
          </div>

          {/* Academic Staff Cards (Professors & TAs in Charge) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Professors Card */}
            <Card className="p-6">
              <h3 className="text-lg font-black text-brand-text-main mb-2">{t('courses.professorsInCharge', 'أعضاء هيئة التدريس (دكاترة المقرر)')}</h3>
              {assignedDoctors.length > 0 ? (
                <div className="space-y-3 mt-2">
                  {assignedDoctors.map((doc: any) => (
                    <div key={doc.id} className="flex items-center gap-4 p-4 rounded-2xl bg-surface-subtle border border-brand-border">
                      <div className="w-11 h-11 rounded-xl bg-brand-primary-50 dark:bg-brand-primary-950/40 text-brand-brand-green-dark flex items-center justify-center font-black text-base shrink-0 border border-brand-border">
                        {doc.firstName?.[0] || 'D'}
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
                        {doc.specialty && <p className="text-xs text-brand-text-muted mt-0.5">{doc.specialty}</p>}
                        {doc.user?.email && <p className="text-xs text-brand-text-muted truncate">{doc.user.email}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-brand-text-muted italic text-xs">
                  <UserCheck size={32} className="mx-auto mb-2 opacity-40 text-brand-text-muted" />
                  <p>{t('courses.noAssignedProfessors', 'لم يتم تعيين أستاذ للمادة في الجدول بعد')}</p>
                </div>
              )}
            </Card>

            {/* Teaching Assistants Card */}
            <Card className="p-6">
              <h3 className="text-lg font-black text-brand-text-main mb-2">{t('courses.tasInCharge', 'المعيدون والمهندسون المسؤولون')}</h3>
              {assignedTAs.length > 0 ? (
                <div className="space-y-3 mt-2">
                  {assignedTAs.map((ta: any) => (
                    <div key={ta.id} className="flex items-center gap-4 p-4 rounded-2xl bg-surface-subtle border border-brand-border">
                      <div className="w-11 h-11 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center font-black text-base shrink-0 border border-purple-200/50">
                        {ta.firstName?.[0] || 'T'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-brand-text-primary dark:text-brand-text-main truncate text-sm">
                            م. {ta.firstName} {ta.lastName}
                          </h4>
                          <span className="bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 text-[10px] px-2 py-0.5 rounded-full font-bold border border-purple-200/50">
                            المعيد المسؤول
                          </span>
                        </div>
                        {ta.specialization && <p className="text-xs text-brand-text-muted mt-0.5">{ta.specialization}</p>}
                        {ta.user?.email && <p className="text-xs text-brand-text-muted truncate">{ta.user.email}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-brand-text-muted italic text-xs">
                  <UserCheck size={32} className="mx-auto mb-2 opacity-40 text-brand-text-muted" />
                  <p>{t('courses.noAssignedTAs', 'لم يتم تعيين معيد للمادة في الجدول بعد')}</p>
                </div>
              )}
            </Card>
          </div>

          {/* Description & Details Card */}
          <Card className="p-6">
            <h3 className="text-lg font-black text-brand-text-main mb-2">{t('courses.description', 'وصف المقرر الدراسي')}</h3>
            {course.description ? (
              <p className="text-brand-text-sub font-medium leading-relaxed text-sm">{course.description}</p>
            ) : (
              <p className="text-brand-text-muted italic text-xs">
                {isRTL ? 'لا يوجد وصف متاح لهذا المقرر الدراسي حتى الآن.' : 'No description available for this course yet.'}
              </p>
            )}
          </Card>

          {/* Weekly Timetable & Room Slots */}
          {course.scheduleSlots && course.scheduleSlots.length > 0 && (
            <Card className="p-6">
              <h3 className="text-lg font-black text-brand-text-main mb-2">{t('courses.scheduleTimeline', 'جدول مواعيد وقاعات المقرر الأسبوعي')}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-2">
                {course.scheduleSlots.map((slot: any) => (
                  <div key={slot.id} className="p-4 rounded-2xl bg-surface-subtle border border-brand-border space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-brand-text-primary dark:text-brand-text-main flex items-center gap-2 text-sm">
                        <Calendar size={16} className="text-brand-brand-green-dark" />
                        {slot.dayOfWeek}
                      </span>
                      <Badge variant={slot.slotType === 'LECTURE' ? 'primary' : 'secondary'} className="text-[10px]">
                        {slot.slotType === 'LECTURE' ? 'محاضرة' : slot.slotType === 'SECTION' ? 'سكشن' : 'معمل'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-brand-text-muted font-medium">
                      <Clock size={14} />
                      <span>{slot.startTime} - {slot.endTime}</span>
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
      )}

      {/* TAB 2: LECTURES */}
      {activeTab === 'lectures' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-brand-bg-card p-4 rounded-2xl border border-brand-border">
            <div>
              <h3 className="font-black text-lg text-brand-text-main flex items-center gap-2">
                <FileText className="text-brand-primary-600" size={20} />
                {t('courses.lectures', 'المحاضرات والملفات الدراسية')}
              </h3>
              <p className="text-xs text-brand-text-sub mt-1">
                {t('courses.onlyInChargeCanUpload', 'تنويه: يسمح فقط لأستاذ المادة والمعيد المسؤول برفع المحاضرات والسكاشن.')}
              </p>
            </div>

            {canUpload && (
              <Button
                onClick={() => {
                  setUploadType('LECTURE');
                  setIsUploadModalOpen(true);
                }}
                variant="primary"
                className="flex items-center gap-2"
              >
                <Upload size={16} />
                <span>{t('courses.uploadLecture', 'رفع محاضرة جديدة')}</span>
              </Button>
            )}
          </div>

          {lectures.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {lectures.map((item: any) => (
                <Card key={item.id} className="p-5 border border-brand-border hover:shadow-md transition-shadow flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="p-3 rounded-2xl bg-brand-primary-50">
                          {getMaterialIcon(item.fileType, item.fileUrl)}
                        </div>
                        <div>
                          <h4 className="font-bold text-brand-text-main text-base">{item.title}</h4>
                          <span className="text-xs text-brand-text-muted font-medium">
                            {new Date(item.createdAt).toLocaleDateString(i18n.language === 'ar' ? 'ar-EG' : 'en-US')}
                            {item.fileSize && ` • ${formatFileSize(item.fileSize)}`}
                          </span>
                        </div>
                      </div>

                      {/* Publication Status & Action Buttons if Authorized */}
                      <div className="flex items-center gap-1.5">
                        {item.isPublished === false ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            مخفي - مسودة 🔴
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            منشور للطلاب 🟢
                          </span>
                        )}

                        {(canUpload || user?.id === item.uploadedById) && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleTogglePublication(item.id)}
                              className="p-1.5 rounded-xl text-brand-text-muted hover:text-brand-primary-600 hover:bg-brand-primary-50 transition-colors"
                              title={item.isPublished === false ? 'نشر للطلاب' : 'تغيير للمسودة وإخفاء عن الطلاب'}
                            >
                              {item.isPublished === false ? <Eye size={18} className="text-emerald-600" /> : <EyeOff size={18} className="text-amber-600" />}
                            </button>
                            <button
                              onClick={() => handleDeleteMaterial(item.id)}
                              className="p-1.5 rounded-xl text-red-500 hover:bg-red-50 transition-colors"
                              title={t('common.delete', 'حذف')}
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {item.description && (
                      <p className="text-sm text-brand-text-sub font-medium mt-3 bg-brand-bg/50 p-3 rounded-xl">
                        {item.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between border-t border-brand-border pt-4 mt-4 text-xs text-brand-text-muted">
                    <span className="flex items-center gap-1 font-medium">
                      <UserCheck size={14} className="text-brand-primary-600" />
                      {t('courses.uploadedBy', 'رفع بواسطة')}: {getUploaderName(item.uploadedBy)}
                    </span>

                    <a
                      href={getDownloadUrl(item.fileUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-primary-600 text-white font-bold hover:bg-brand-primary-700 transition-colors"
                    >
                      <Download size={14} />
                      <span>{t('courses.download', 'تحميل / عرض')}</span>
                    </a>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 bg-brand-bg-card rounded-3xl border border-dashed border-brand-border p-8">
              <FileText size={48} className="mx-auto text-brand-text-muted opacity-40 mb-3" />
              <h3 className="text-lg font-bold text-brand-text-main">{t('courses.noLecturesYet', 'لا توجد محاضرات مرفوعة لهذا المقرر بعد')}</h3>
              {canUpload && (
                <Button
                  onClick={() => {
                    setUploadType('LECTURE');
                    setIsUploadModalOpen(true);
                  }}
                  variant="primary"
                  className="mt-4"
                >
                  <Plus size={16} className="mr-2" />
                  {t('courses.uploadLecture', 'رفع أول محاضرة')}
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: TUTORIALS & LABS */}
      {activeTab === 'tutorials' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-brand-bg-card p-4 rounded-2xl border border-brand-border">
            <div>
              <h3 className="font-black text-lg text-brand-text-main flex items-center gap-2">
                <Video className="text-purple-600" size={20} />
                {t('courses.tutorials', 'تمارين السكاشن والمعامل (Tutorials & Labs)')}
              </h3>
              <p className="text-xs text-brand-text-sub mt-1">
                {t('courses.onlyInChargeCanUpload', 'تنويه: يسمح فقط لأستاذ المادة والمعيد المسؤول برفع المحاضرات والسكاشن.')}
              </p>
            </div>

            {canUpload && (
              <Button
                onClick={() => {
                  setUploadType('TUTORIAL');
                  setIsUploadModalOpen(true);
                }}
                variant="primary"
                className="flex items-center gap-2"
              >
                <Upload size={16} />
                <span>{t('courses.uploadTutorial', 'رفع سكشن / تمرين جديد')}</span>
              </Button>
            )}
          </div>

          {tutorials.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tutorials.map((item: any) => (
                <Card key={item.id} className="p-5 border border-brand-border hover:shadow-md transition-shadow flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="p-3 rounded-2xl bg-purple-50">
                          {getMaterialIcon(item.fileType, item.fileUrl)}
                        </div>
                        <div>
                          <h4 className="font-bold text-brand-text-main text-base">{item.title}</h4>
                          <span className="text-xs text-brand-text-muted font-medium">
                            {new Date(item.createdAt).toLocaleDateString(i18n.language === 'ar' ? 'ar-EG' : 'en-US')}
                            {item.fileSize && ` • ${formatFileSize(item.fileSize)}`}
                          </span>
                        </div>
                      </div>

                      {/* Publication Status & Action Buttons if Authorized */}
                      <div className="flex items-center gap-1.5">
                        {item.isPublished === false ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            مخفي - مسودة 🔴
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            منشور للطلاب 🟢
                          </span>
                        )}

                        {(canUpload || user?.id === item.uploadedById) && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleTogglePublication(item.id)}
                              className="p-1.5 rounded-xl text-brand-text-muted hover:text-brand-primary-600 hover:bg-brand-primary-50 transition-colors"
                              title={item.isPublished === false ? 'نشر للطلاب' : 'تغيير للمسودة وإخفاء عن الطلاب'}
                            >
                              {item.isPublished === false ? <Eye size={18} className="text-emerald-600" /> : <EyeOff size={18} className="text-amber-600" />}
                            </button>
                            <button
                              onClick={() => handleDeleteMaterial(item.id)}
                              className="p-1.5 rounded-xl text-red-500 hover:bg-red-50 transition-colors"
                              title={t('common.delete', 'حذف')}
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {item.description && (
                      <p className="text-sm text-brand-text-sub font-medium mt-3 bg-brand-bg/50 p-3 rounded-xl">
                        {item.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between border-t border-brand-border pt-4 mt-4 text-xs text-brand-text-muted">
                    <span className="flex items-center gap-1 font-medium">
                      <UserCheck size={14} className="text-purple-600" />
                      {t('courses.uploadedBy', 'رفع بواسطة')}: {item.uploadedBy?.firstName} {item.uploadedBy?.lastName}
                    </span>

                    <a
                      href={getDownloadUrl(item.fileUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 text-white font-bold hover:bg-purple-700 transition-colors"
                    >
                      <Download size={14} />
                      <span>{t('courses.download', 'تحميل / عرض')}</span>
                    </a>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 bg-brand-bg-card rounded-3xl border border-dashed border-brand-border p-8">
              <Video size={48} className="mx-auto text-brand-text-muted opacity-40 mb-3" />
              <h3 className="text-lg font-bold text-brand-text-main">{t('courses.noTutorialsYet', 'لا توجد سكاشن أو تمارين مرفوعة لهذه المادة بعد')}</h3>
              {canUpload && (
                <Button
                  onClick={() => {
                    setUploadType('TUTORIAL');
                    setIsUploadModalOpen(true);
                  }}
                  variant="primary"
                  className="mt-4"
                >
                  <Plus size={16} className="mr-2" />
                  {t('courses.uploadTutorial', 'رفع أول سكشن')}
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: TASKS & ASSIGNMENTS */}
      {activeTab === 'tasks' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-surface-card p-4 rounded-2xl border border-brand-border shadow-sm">
            <div>
              <h3 className="font-black text-lg text-brand-text-primary dark:text-brand-text-main flex items-center gap-2">
                <ClipboardList className="text-amber-600 dark:text-amber-400" size={20} />
                {t('tasks.title', 'التكاليف')}
              </h3>
              <p className="text-xs text-brand-text-muted mt-1">
                إدارة وتتبع التكاليف المطلوبة من الطلاب وتحديد مواعيد التسليم.
              </p>
            </div>

            {(user?.role === 'DOCTOR' || user?.role === 'SUPER_ADMIN' || user?.role === 'COLLEGE_ADMIN') && (
              <Button
                onClick={() => setShowTaskModal(true)}
                variant="primary"
                className="flex items-center gap-2 text-xs py-2 px-4 shadow-md shadow-brand-primary-500/20"
              >
                <Plus size={16} />
                <span>{t('tasks.createTask', 'إضافة تكليف جديد')}</span>
              </Button>
            )}
          </div>

          {course?.tasks && course.tasks.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {course.tasks.map((task: any) => {
                const isOverdue = task.dueDate && new Date(task.dueDate) < new Date();
                const my = courseMySubmissions[task.id];
                const showStatusBadge = user?.role === 'STUDENT' && (my || isOverdue);
                return (
                  <div key={task.id} className="bg-surface-card border border-brand-border p-5 rounded-2xl shadow-card flex flex-col justify-between space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold shrink-0 border border-amber-200/50">
                            <ClipboardList size={20} />
                          </div>
                          <div>
                            <h4 className="font-bold text-brand-text-primary dark:text-brand-text-main text-base">{task.title}</h4>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-brand-text-muted">
                              {task.maxScore ? `${task.maxScore} ${t('tasks.maxPoints', 'درجة')}` : 'تكليف أكاديمي'}
                            </span>
                          </div>
                        </div>

                        <Badge
                          variant={
                            my && my.score != null
                              ? 'success'
                              : my
                              ? 'primary'
                              : isOverdue
                              ? 'error'
                              : 'warning'
                          }
                          className="text-[10px] font-black"
                        >
                          {my && my.score != null
                            ? t('tasks.statusGraded', { score: my.score, maxScore: task.maxScore })
                            : my
                            ? t('tasks.statusSubmitted')
                            : isOverdue
                            ? t('tasks.statusOverdue')
                            : 'قيد التسليم'}
                        </Badge>
                      </div>

                      {task.description && (
                        <p className="text-xs text-brand-text-sub font-medium leading-relaxed bg-surface-subtle p-3 rounded-xl border border-brand-border">
                          {task.description}
                        </p>
                      )}

                      {user?.role === 'STUDENT' && my && (
                        <div className="space-y-1">
                          <div className="text-[9px] font-bold text-brand-text-muted">
                            {my.score != null
                              ? t('tasks.statusGraded', { score: my.score, maxScore: task.maxScore })
                              : t('tasks.submittedAt', { date: formatTaskDate(my.submittedAt || my.createdAt) })}
                          </div>
                          {my.feedback && (
                            <div className="text-[10px] text-brand-text-sub bg-surface-subtle p-2 rounded-lg leading-relaxed flex items-start gap-1">
                              <MessageSquare size={12} className="shrink-0 mt-0.5" />
                              <span className="line-clamp-3">{my.feedback}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col border-t border-brand-border pt-3 text-xs font-medium gap-3">
                      <div className="flex items-center justify-between text-brand-text-muted gap-2">
                        <div className="flex items-center gap-1.5">
                          <Clock size={14} className={isOverdue ? 'text-red-500' : 'text-amber-500'} />
                          <span>{t('tasks.due', 'موعد التسليم')}: {task.dueDate ? formatTaskDate(task.dueDate) : 'غير محدد'}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        {user?.role === 'STUDENT' ? (
                          my ? (
                            <Button disabled className="text-[10px] py-1.5 px-3 opacity-60 w-full">
                              <CheckCircle size={14} className="mr-1" />
                              {t('tasks.statusSubmitted')}
                            </Button>
                          ) : (
                            <Button
                              onClick={() => {
                                setSelectedTask(task);
                                setShowSubmitModal(true);
                              }}
                              className={`text-[10px] py-1.5 px-3 w-full ${
                                isOverdue
                                  ? 'bg-rose-600 hover:bg-rose-700 shadow-md shadow-rose-500/20'
                                  : ''
                              }`}
                            >
                              <FileUp size={14} className="mr-1" />
                              {isOverdue
                                ? `${t('tasks.submitTask')} (${t('tasks.statusOverdue')})`
                                : t('tasks.submitTask', 'تسليم التكليف')}
                            </Button>
                          )
                        ) : (
                          <Button
                            variant="outline"
                            onClick={() => {
                              setSelectedTask(task);
                              fetchSubmissions(task.id);
                              setShowSubmissionsModal(true);
                            }}
                            className="text-[10px] py-1.5 px-3 w-full"
                          >
                            <CheckCircle size={14} className="mr-1" />
                            {t('tasks.viewSubmissions', 'معاينة التسليمات')}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-16 bg-surface-card rounded-3xl border border-dashed border-brand-border p-8">
              <ClipboardList size={48} className="mx-auto text-brand-text-muted opacity-40 mb-3" />
              <h3 className="text-base font-bold text-brand-text-primary dark:text-brand-text-main">
                لا توجد تكاليف مطلوبة لهذا المقرر حالياً
              </h3>
              <p className="text-xs text-brand-text-muted mt-1">
                عند إضافة تكليف جديد بواسطة أستاذ المادة يظهر هنا للطلاب للرفع والتسليم.
              </p>
            </div>
          )}
        </div>
      )}

      {/* SUBMISSIONS & GRADING MODAL */}
      <SubmissionsGradingModal
        isOpen={showSubmissionsModal}
        onClose={() => setShowSubmissionsModal(false)}
        task={selectedTask ? { ...selectedTask, course } : null}
      />

      {/* TAB 5: STUDENTS ROSTER */}
      {activeTab === 'roster' && (
        <Card className="p-6 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-black text-brand-text-main">{t('courses.roster', 'قائمة الطلاب المقيدين في المقرر')}</h3>
              <p className="text-xs text-brand-text-sub">{t('common.total', 'الإجمالي')}: {enrolledStudents.length} {t('courses.students', 'طالب')}</p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 text-brand-text-muted pointer-events-none" size={16} />
                <input
                  type="text"
                  placeholder={t('common.searchPlaceholder', 'بحث باسم الطالب أو الكود...')}
                  value={rosterSearch}
                  onChange={(e) => setRosterSearch(e.target.value)}
                  className="w-full ps-9 pe-4 py-2 rounded-xl bg-brand-bg border border-brand-border text-sm text-brand-text-main focus:outline-none focus:border-brand-primary-500 font-medium"
                />
              </div>

              {canManageRoster && (
                <Button
                  onClick={() => setShowEnrollModal(true)}
                  className="rounded-xl flex items-center justify-center gap-2 text-xs font-bold shrink-0 shadow-sm"
                >
                  <Plus size={16} />
                  <span>{t('courses.addStudent', 'إضافة طالب')}</span>
                </Button>
              )}
            </div>
          </div>

          {filteredRoster.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-start text-sm">
                <thead className="bg-brand-bg text-brand-text-muted text-xs font-bold uppercase border-b border-brand-border">
                  <tr>
                    <th className="py-3 px-4 text-start">#</th>
                    <th className="py-3 px-4 text-start">{t('auth.fullName', 'اسم الطالب')}</th>
                    <th className="py-3 px-4 text-start">{t('students.studentCode', 'كود الطالب')}</th>
                    <th className="py-3 px-4 text-start">{t('auth.email', 'البريد الإلكتروني')}</th>
                    {canManageRoster && (
                      <th className="py-3 px-4 text-end">{t('common.actions', 'الإجراءات')}</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border">
                  {filteredRoster.map((enr: any, idx: number) => {
                    const studentName = `${enr.student?.firstName || ''} ${enr.student?.lastName || ''}`.trim() || 'طالب';
                    return (
                      <tr key={enr.id || idx} className="hover:bg-brand-primary-50/20 transition-colors">
                        <td className="py-3 px-4 font-bold text-brand-text-muted">{idx + 1}</td>
                        <td className="py-3 px-4 font-bold text-brand-text-main">
                          {studentName}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs font-bold text-brand-primary-600">
                          {enr.student?.studentCode || '—'}
                        </td>
                        <td className="py-3 px-4 text-brand-text-sub font-medium">
                          {enr.student?.user?.email || '—'}
                        </td>
                        {canManageRoster && (
                          <td className="py-3 px-4 text-end">
                            <button
                              type="button"
                              onClick={() => setWithdrawTarget({ id: enr.id, name: studentName })}
                              className="p-2 rounded-xl text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer inline-flex items-center gap-1.5 text-xs font-bold"
                              title={t('courses.withdrawStudent', 'سحب القيد')}
                            >
                              <Trash2 size={15} />
                              <span className="hidden sm:inline">{t('courses.withdraw', 'سحب القيد')}</span>
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
              {t('common.noResults', 'لا يوجد طلاب مطابقون للبحث')}
            </div>
          )}
        </Card>
      )}

      {/* UPLOAD MATERIAL MODAL */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-brand-bg-card w-full max-w-lg rounded-3xl shadow-2xl border border-brand-border overflow-hidden">
            <div className="p-6 border-b border-brand-border flex items-center justify-between bg-brand-bg">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-brand-primary-50 text-brand-primary-600">
                  <Upload size={22} />
                </div>
                <div>
                  <h3 className="font-black text-lg text-brand-text-main">
                    {uploadType === 'LECTURE'
                      ? t('courses.uploadLecture', 'رفع محاضرة جديدة')
                      : t('courses.uploadTutorial', 'رفع سكشن / تمرين جديد')}
                  </h3>
                  <p className="text-xs text-brand-text-sub font-medium">
                    {course.name} ({course.courseCode})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(false)}
                className="text-brand-text-muted hover:text-brand-text-main text-xl font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="p-6 space-y-4">
              {uploadError && (
                <div className="p-3 rounded-2xl bg-red-50 text-red-600 text-xs font-bold flex items-center gap-2 border border-red-100">
                  <AlertCircle size={16} />
                  <span>{uploadError}</span>
                </div>
              )}

              {/* Title */}
              <div>
                <label className="block text-xs font-bold text-brand-text-main mb-1">
                  {t('courses.materialTitle', 'عنوان المادة أو الملف')} *
                </label>
                <input
                  type="text"
                  required
                  placeholder={t('courses.materialTitlePlaceholder', 'مثال: المحاضرة الأولى - مقدمة عن خوارزميات البحث')}
                  value={materialTitle}
                  onChange={(e) => setMaterialTitle(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-2xl bg-brand-bg border border-brand-border text-sm font-medium text-brand-text-main focus:outline-none focus:border-brand-primary-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-brand-text-main mb-1">
                  {t('courses.materialDescription', 'الوصف أو التعليمات (اختياري)')}
                </label>
                <textarea
                  rows={2}
                  placeholder={t('courses.materialDescriptionPlaceholder', 'اكتب ملاحظات أو إرشادات للطلاب...')}
                  value={materialDescription}
                  onChange={(e) => setMaterialDescription(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-2xl bg-brand-bg border border-brand-border text-sm font-medium text-brand-text-main focus:outline-none focus:border-brand-primary-500"
                />
              </div>

              {/* Category selector */}
              <div>
                <label className="block text-xs font-bold text-brand-text-main mb-1">
                  {t('courses.materialType', 'تصنيف المادة')}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setUploadType('LECTURE')}
                    className={`p-3 rounded-2xl font-bold text-xs border text-center transition-all ${uploadType === 'LECTURE'
                        ? 'bg-brand-primary-50 border-brand-primary-500 text-brand-primary-700 shadow-sm'
                        : 'bg-brand-bg border-brand-border text-brand-text-sub'
                      }`}
                  >
                    📘 محاضرة (Lecture)
                  </button>
                  <button
                    type="button"
                    onClick={() => setUploadType('TUTORIAL')}
                    className={`p-3 rounded-2xl font-bold text-xs border text-center transition-all ${uploadType === 'TUTORIAL'
                        ? 'bg-purple-50 border-purple-500 text-purple-700 shadow-sm'
                        : 'bg-brand-bg border-brand-border text-brand-text-sub'
                      }`}
                  >
                    📝 سكشن / تمرين (Tutorial)
                  </button>
                </div>
              </div>

              {/* Upload Mode Selector (File vs Link) */}
              <div>
                <label className="block text-xs font-bold text-brand-text-main mb-1">
                  {t('courses.fileOrUrl', 'طريقة تقديم المادة')}
                </label>
                <div className="flex items-center gap-3 mb-2">
                  <button
                    type="button"
                    onClick={() => setUploadMode('file')}
                    className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-colors ${uploadMode === 'file' ? 'bg-brand-primary-600 text-white border-brand-primary-600' : 'bg-brand-bg text-brand-text-sub border-brand-border'
                      }`}
                  >
                    {t('courses.fileUpload', 'رفع ملف من الجهاز')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setUploadMode('link')}
                    className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-colors ${uploadMode === 'link' ? 'bg-brand-primary-600 text-white border-brand-primary-600' : 'bg-brand-bg text-brand-text-sub border-brand-border'
                      }`}
                  >
                    {t('courses.urlLink', 'رابط خارجي (Drive, Youtube)')}
                  </button>
                </div>

                {uploadMode === 'file' ? (
                  <div className="border-2 border-dashed border-brand-border hover:border-brand-primary-400 p-6 rounded-2xl text-center bg-brand-bg/50 transition-colors">
                    <input
                      type="file"
                      id="file-input"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setSelectedFile(file);
                        if (file) setUploadError(null);
                      }}
                    />
                    <label htmlFor="file-input" className="cursor-pointer block">
                      <Upload size={32} className="mx-auto text-brand-brand-green-dark mb-2" />
                      {selectedFile ? (
                        <div className="flex items-center justify-center gap-2 text-xs font-bold text-brand-brand-green-dark bg-brand-primary-50 p-2.5 rounded-xl border border-brand-border">
                          <CheckCircle2 size={16} />
                          <span className="truncate max-w-[200px]">{selectedFile.name}</span>
                          <span className="text-[10px] text-brand-text-muted">({formatFileSize(selectedFile.size)})</span>
                        </div>
                      ) : (
                        <div>
                          <p className="text-xs font-bold text-brand-text-primary dark:text-brand-text-main">اضغط هنا لاختيار ملف من جهازك</p>
                          <p className="text-[10px] text-brand-text-muted mt-1">PDF, Word, PPT, Video, ZIP (حتى 50 ميجابايت)</p>
                        </div>
                      )}
                    </label>
                  </div>
                ) : (
                  <input
                    type="url"
                    placeholder="https://drive.google.com/file/d/..."
                    value={externalUrl}
                    onChange={(e) => setExternalUrl(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-2xl bg-brand-bg border border-brand-border text-sm font-medium text-brand-text-main focus:outline-none focus:border-brand-primary-500"
                  />
                )}
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 border-t border-brand-border pt-4 mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsUploadModalOpen(false)}
                  disabled={isSubmitting}
                >
                  {t('common.cancel', 'إلغاء')}
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={isSubmitting}
                  className="flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="animate-spin" size={16} />
                      <span>{t('common.uploading', 'جاري الرفع...')}</span>
                    </>
                  ) : (
                    <>
                      <Upload size={16} />
                      <span>{t('courses.uploadMaterial', 'رفع المادة')}</span>
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* INLINE CREATE TASK MODAL */}
      <Modal
        isOpen={showTaskModal}
        onClose={() => setShowTaskModal(false)}
        title={t('tasks.createTask', 'إضافة تكليف جديد')}
        subtitle={course?.name}
        size="md"
      >
        <form onSubmit={handleCreateTask} className="space-y-4 pt-2">
          {taskError && (
            <div className="p-3 bg-red-50 dark:bg-red-950/20 text-red-600 rounded-xl text-xs font-bold flex items-center gap-2">
              <AlertCircle size={16} />
              <span>{taskError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-brand-text-main mb-1">
              {t('tasks.taskTitle', 'عنوان التكليف')}
            </label>
            <input
              type="text"
              required
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-brand-border bg-brand-bg-card focus:outline-none focus:border-brand-primary-500"
              placeholder="مثال: واجب الأسبوع الثالث"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-brand-text-main mb-1">
              {t('tasks.taskDescription', 'وصف التكليف')}
            </label>
            <textarea
              rows={3}
              required
              value={taskDesc}
              onChange={(e) => setTaskDesc(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-brand-border bg-brand-bg-card focus:outline-none focus:border-brand-primary-500"
              placeholder="شرح المطلوب بالتفصيل..."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-brand-text-main mb-1">
                {t('tasks.maxPoints', 'الدرجة الكلية')}
              </label>
              <input
                type="number"
                min={1}
                required
                value={taskMaxScore}
                onChange={(e) => setTaskMaxScore(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-brand-border bg-brand-bg-card focus:outline-none focus:border-brand-primary-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-brand-text-main mb-1">
                {t('tasks.due', 'موعد التسليم')}
              </label>
              <input
                type="datetime-local"
                required
                value={taskDueDate}
                onChange={(e) => setTaskDueDate(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-brand-border bg-brand-bg-card focus:outline-none focus:border-brand-primary-500"
              />
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-brand-border">
            <button
              type="button"
              onClick={() => setShowTaskModal(false)}
              className="px-4 py-2 text-xs font-bold text-brand-text-sub hover:bg-surface-subtle rounded-xl"
            >
              {t('common.cancel', 'إلغاء')}
            </button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting}
              className="text-xs py-2 px-5 shadow-md shadow-brand-primary-500/20"
            >
              {isSubmitting ? t('common.loading', 'جاري الحفظ...') : t('tasks.createTask', 'إضافة التكليف')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* INLINE SUBMIT TASK MODAL */}
      <Modal
        isOpen={showSubmitModal}
        onClose={() => setShowSubmitModal(false)}
        title={t('tasks.submitTask', 'تسليم التكليف')}
        subtitle={selectedTask?.title}
        size="md"
      >
        <form onSubmit={handleSubmitTask} className="space-y-4 pt-2">
          {taskError && (
            <div className="p-3 bg-red-50 dark:bg-red-950/20 text-red-600 rounded-xl text-xs font-bold flex items-center gap-2">
              <AlertCircle size={16} />
              <span>{taskError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-brand-text-main mb-1">
              {t('tasks.submissionNotes', 'ملاحظات التسليم')}
            </label>
            <textarea
              rows={3}
              value={submitNotes}
              onChange={(e) => setSubmitNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-brand-border bg-brand-bg-card focus:outline-none focus:border-brand-primary-500"
              placeholder="اكتب أي ملاحظات موجهة لأستاذ المادة..."
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-brand-text-main mb-1">
              رابط الملف / الإجابة (File URL)
            </label>
            <input
              type="url"
              required
              value={submitFileUrl}
              onChange={(e) => setSubmitFileUrl(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-brand-border bg-brand-bg-card focus:outline-none focus:border-brand-primary-500"
              placeholder="https://drive.google.com/..."
            />
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-brand-border">
            <button
              type="button"
              onClick={() => setShowSubmitModal(false)}
              className="px-4 py-2 text-xs font-bold text-brand-text-sub hover:bg-surface-subtle rounded-xl"
            >
              {t('common.cancel', 'إلغاء')}
            </button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting}
              className="text-xs py-2 px-5 shadow-md shadow-brand-primary-500/20"
            >
              {isSubmitting ? t('common.loading', 'جاري التسليم...') : t('tasks.submitTask', 'تسليم التكليف')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ENROLL STUDENT MODAL */}
      {canManageRoster && (
        <EnrollStudentModal
          isOpen={showEnrollModal}
          onClose={() => setShowEnrollModal(false)}
          courseId={actualId!}
          courseName={course?.name || ''}
          courseCode={course?.courseCode}
          semester={course?.semester || 1}
          academicYear={course?.year || 1}
          currentEnrolledStudentIds={enrolledStudents.map((e: any) => e.studentId || e.student?.id).filter(Boolean)}
          departmentId={course?.departmentId}
          onSuccess={fetchCourseDetails}
        />
      )}

      {/* WITHDRAW CONFIRMATION MODAL */}
      {canManageRoster && (
        <ConfirmDeleteModal
          isOpen={!!withdrawTarget}
          onClose={() => setWithdrawTarget(null)}
          itemName={withdrawTarget?.name || ''}
          title={t('courses.withdrawConfirmTitle', 'سحب قيد طالب من المقرر')}
          subtitle={t('courses.withdrawConfirmSubtitle', 'تأكيد إلغاء قيد الطالب من هذا المقرر الدراسي')}
          message={isRTL
            ? `هل أنت متأكد من سحب قيد الطالب (${withdrawTarget?.name}) من هذا المقرر؟ سيتم تغيير حالة القيد إلى منسحب.`
            : `Are you sure you want to withdraw ${withdrawTarget?.name} from this course?`}
          confirmLabel={t('courses.confirmWithdraw', 'تأكيد سحب القيد')}
          cancelLabel={t('common.cancel', 'إلغاء')}
          variant="danger"
          loading={isWithdrawing}
          onConfirm={handleConfirmWithdraw}
        />
      )}
    </div>
  );
};

export default CourseDetails;
