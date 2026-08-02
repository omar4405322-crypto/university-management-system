// @ts-nocheck
import React, { useState, useEffect, useMemo } from 'react';
import taskService from '../../services/task.service';
import coursesService from '../../services/courses.service';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import {
  ClipboardList,
  Calendar,
  Plus,
  FileUp,
  CheckCircle,
  Clock,
  X,
  Send,
  AlertCircle,
  Loader2,
  Pencil,
  Trash2,
  MessageSquare,
  History,
} from 'lucide-react';
import { TaskTimelineModal } from '../../components/tasks/TaskTimelineModal';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/button';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Modal from '../../components/ui/Modal';

const createSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  courseId: z.string().min(1, 'Course is required'),
  dueDate: z.string().min(1, 'Due date is required'),
  maxScore: z.coerce.number().min(1, 'Max score must be at least 1'),
});

const submitSchema = z.object({
  notes: z.string().optional(),
  fileUrl: z.string().url('Must be a valid URL').min(1, 'File URL is required'),
});

type CreateFormData = z.infer<typeof createSchema>;
type SubmitFormData = z.infer<typeof submitSchema>;

type SubmissionState = {
  score?: string;
  feedback?: string;
  saving?: boolean;
  scoreError?: string;
};

const TasksList = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const isDoctor =
    user?.role === 'DOCTOR' ||
    user?.role === 'SUPER_ADMIN' ||
    user?.role === 'COLLEGE_ADMIN' ||
    user?.role === 'DEPARTMENT_ADMIN';
  const isStudent = user?.role === 'STUDENT';

  const [tasks, setTasks] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<any>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showSubmissionsModal, setShowSubmissionsModal] = useState(false);
  const [showTimelineModal, setShowTimelineModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [showToggleConfirmModal, setShowToggleConfirmModal] = useState(false);
  const [pendingPortalAction, setPendingPortalAction] = useState<'CLOSE' | 'REOPEN' | null>(null);
  const [isTogglingPortal, setIsTogglingPortal] = useState(false);
  const [extendDueDate, setExtendDueDate] = useState('');
  const [dateValidationError, setDateValidationError] = useState<string | null>(null);
  const [isExtending, setIsExtending] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [mySubmissions, setMySubmissions] = useState<Record<number, any>>({});
  const [submissionState, setSubmissionState] = useState<Record<number, SubmissionState>>({});

  const {
    register: registerCreate,
    handleSubmit: handleSubmitCreate,
    reset: resetCreate,
    setValue: setCreateValue,
    formState: { errors: errorsCreate, isSubmitting: isSubmittingCreate },
  } = useForm({
    resolver: zodResolver(createSchema),
    defaultValues: {
      title: '',
      description: '',
      courseId: '',
      dueDate: '',
      maxScore: 100,
    },
  });

  const {
    register: registerSubmit,
    handleSubmit: handleSubmitSubmit,
    reset: resetSubmit,
    formState: { errors: errorsSubmit, isSubmitting: isSubmittingSubmit },
  } = useForm({
    resolver: zodResolver(submitSchema),
    defaultValues: { notes: '', fileUrl: '' },
  });

  useEffect(() => {
    if (showCreateModal) {
      if (editingTask) {
        const date = new Date(editingTask.dueDate);
        const iso = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16);
        setCreateValue('title', editingTask.title);
        setCreateValue('description', editingTask.description);
        setCreateValue('courseId', String(editingTask.courseId));
        setCreateValue('dueDate', iso);
        setCreateValue('maxScore', editingTask.maxScore);
      } else {
        resetCreate();
      }
    }
  }, [showCreateModal, resetCreate, editingTask, setCreateValue]);

  useEffect(() => {
    if (showSubmitModal) resetSubmit();
  }, [showSubmitModal, resetSubmit]);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const isOverdue = (dueDate) => new Date(dueDate) < new Date();

  const isTaskOwner = (task) => {
    if (!task || !user) return false;
    if (user.role !== 'DOCTOR') return true;
    return (
      String(task.doctor?.userId || task.doctorId || '') === String(user.id) ||
      String(task.doctorId || '') === String(task.doctorId)
    );
  };

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const result = await taskService.getTasks();
      if (result.success) {
        setTasks(result.data || []);
      }
    } catch (error) {
      showToast(t('tasks.fetchError'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchCourses = async () => {
    try {
      const result = await coursesService.getCourses();
      if (result.success) {
        const list = Array.isArray(result.data)
          ? result.data
          : result.data?.courses || [];
        setCourses(list);
      }
    } catch (error) {
      console.error('Error fetching courses:', error);
    }
  };

  const fetchSubmissions = async (taskId) => {
    try {
      setLoadingSubmissions(true);
      const result = await taskService.getTaskSubmissions(taskId);
      if (result.success) {
        const data = result.data || [];
        setSubmissions(data);
        const initialState: Record<number, SubmissionState> = {};
        data.forEach((s) => {
          initialState[s.id] = {
            score: s.score != null ? String(s.score) : '',
            feedback: s.feedback || '',
          };
        });
        setSubmissionState(initialState);
      }
    } catch (error) {
      console.error('Error fetching submissions:', error);
    } finally {
      setLoadingSubmissions(false);
    }
  };

  const fetchMySubmissions = async (taskIds: number[]) => {
    if (!isStudent) return;
    const map: Record<number, any> = {};
    await Promise.all(
      taskIds.map(async (tid) => {
        try {
          const r = await taskService.getMySubmission(tid);
          if (r.success) map[tid] = r.data;
        } catch (e) {}
      })
    );
    setMySubmissions(map);
  };

  useEffect(() => {
    fetchTasks();
    if (isDoctor) fetchCourses();
  }, [isDoctor]);

  useEffect(() => {
    if (tasks.length > 0 && isStudent) {
      fetchMySubmissions(tasks.map((t) => t.id));
    }
  }, [tasks, isStudent]);

  const onCreateSubmit = async (data) => {
    try {
      let result;
      if (editingTask) {
        result = await taskService.updateTask(editingTask.id, data);
        if (result.success) {
          showToast(t('tasks.updateSuccess'), 'success');
          setShowCreateModal(false);
          setEditingTask(null);
          fetchTasks();
        } else {
          showToast(result.message || t('tasks.updateError'), 'error');
        }
      } else {
        result = await taskService.createTask(data);
        if (result.success) {
          showToast(t('tasks.createSuccess'), 'success');
          setShowCreateModal(false);
          fetchTasks();
        } else {
          showToast(result.message || t('tasks.createError'), 'error');
        }
      }
    } catch (error: any) {
      const msg =
        error.response?.data?.message ||
        (editingTask ? t('tasks.updateError') : t('tasks.createError'));
      showToast(msg, 'error');
    }
  };

  const onSubmitTask = async (data) => {
    try {
      const result = await taskService.submitTask(selectedTask.id, data);
      if (result.success) {
        showToast(t('tasks.submitSuccess'), 'success');
        setShowSubmitModal(false);
        fetchTasks();
      } else {
        showToast(result.message || t('tasks.submitError'), 'error');
      }
    } catch (error: any) {
      showToast(
        error.response?.data?.message || t('tasks.submitError'),
        'error'
      );
    }
  };

  const onSaveGrade = async (submissionId: number) => {
    if (!selectedTask) return;
    const state = submissionState[submissionId] || {};
    const scoreNum = parseFloat(String(state.score));
    const maxScore = Number(selectedTask.maxScore || 100);
    if (isNaN(scoreNum) || scoreNum < 0) {
      setSubmissionState((prev) => ({
        ...prev,
        [submissionId]: {
          ...prev[submissionId],
          scoreError: 'Invalid score',
        },
      }));
      return;
    }
    if (scoreNum > maxScore) {
      setSubmissionState((prev) => ({
        ...prev,
        [submissionId]: {
          ...prev[submissionId],
          scoreError: t('tasks.scoreExceedsMax', { maxScore }),
        },
      }));
      return;
    }
    try {
      setSubmissionState((prev) => ({
        ...prev,
        [submissionId]: { ...prev[submissionId], saving: true, scoreError: undefined },
      }));
      const result = await taskService.gradeSubmission(
        selectedTask.id,
        submissionId,
        { score: scoreNum, feedback: state.feedback }
      );
      if (result.success) {
        showToast(t('tasks.gradeSaved'), 'success');
        fetchSubmissions(selectedTask.id);
      } else {
        showToast(result.message || t('tasks.gradeError'), 'error');
      }
    } catch (e: any) {
      showToast(
        e.response?.data?.message || t('tasks.gradeError'),
        'error'
      );
    } finally {
      setSubmissionState((prev) => ({
        ...prev,
        [submissionId]: { ...prev[submissionId], saving: false },
      }));
    }
  };

  const onConfirmDelete = async (force = false) => {
    if (!selectedTask) return;
    try {
      const result = await taskService.deleteTask(selectedTask.id, force);
      if (result.success) {
        showToast(t('tasks.deleteSuccess'), 'success');
        setShowDeleteConfirm(false);
        setSelectedTask(null);
        fetchTasks();
      } else {
        showToast(result.message || t('tasks.deleteError'), 'error');
      }
    } catch (e: any) {
      showToast(
        e.response?.data?.message || t('tasks.deleteError'),
        'error'
      );
    }
  };

  const validateExtendDueDate = (dateStr: string, taskObj: any): string | null => {
    if (!dateStr) return 'Please select a valid future date and time.';
    const selected = new Date(dateStr);
    if (isNaN(selected.getTime())) return 'Invalid date format.';

    const now = new Date();
    if (selected <= now) {
      return 'New due date must be in the future (after current server time).';
    }

    if (taskObj?.startDate && selected < new Date(taskObj.startDate)) {
      return 'New due date cannot be earlier than the assignment start date.';
    }

    return null;
  };

  const onInitiateTogglePortal = (task: any, action: 'CLOSE' | 'REOPEN') => {
    setSelectedTask(task);
    setPendingPortalAction(action);
    setShowToggleConfirmModal(true);
  };

  const onConfirmTogglePortal = async () => {
    if (!selectedTask || !pendingPortalAction || isTogglingPortal) return;

    const taskId = selectedTask.id;
    const action = pendingPortalAction;
    const previousTasks = [...tasks];

    // Optimistic UI update
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              isManuallyClosed: action === 'CLOSE',
              portalState: action === 'CLOSE' ? 'MANUALLY_CLOSED' : 'OPEN',
            }
          : t
      )
    );

    try {
      setIsTogglingPortal(true);
      const result = await taskService.togglePortal(taskId, action);

      if (result.success && result.data) {
        showToast(
          action === 'CLOSE'
            ? 'Submission portal closed successfully.'
            : 'Submission portal reopened successfully.',
          'success'
        );
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, ...result.data } : t))
        );
      } else {
        setTasks(previousTasks);
        showToast(result.message || 'Unable to update submission portal state.', 'error');
      }
    } catch (e: any) {
      setTasks(previousTasks);
      const errMsg =
        e.response?.data?.message || 'Unable to update submission portal state.';
      showToast(errMsg, 'error');
    } finally {
      setIsTogglingPortal(false);
      setShowToggleConfirmModal(false);
      setSelectedTask(null);
      setPendingPortalAction(null);
    }
  };

  const onInitiateExtendDeadline = (task: any) => {
    setSelectedTask(task);
    const date = new Date(task.dueDate);
    const iso = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setExtendDueDate(iso);
    setDateValidationError(validateExtendDueDate(iso, task));
    setShowExtendModal(true);
  };

  const handleExtendDueDateChange = (value: string) => {
    setExtendDueDate(value);
    setDateValidationError(validateExtendDueDate(value, selectedTask));
  };

  const onConfirmExtendDeadline = async () => {
    if (!selectedTask || !extendDueDate || isExtending) return;

    const validationErr = validateExtendDueDate(extendDueDate, selectedTask);
    if (validationErr) {
      setDateValidationError(validationErr);
      return;
    }

    const taskId = selectedTask.id;
    const previousTasks = [...tasks];
    const newDueDateObj = new Date(extendDueDate);

    // Optimistic UI update
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              dueDate: newDueDateObj.toISOString(),
              portalState: 'OPEN',
            }
          : t
      )
    );

    try {
      setIsExtending(true);
      const result = await taskService.extendDeadline(taskId, extendDueDate);

      if (result.success && result.data) {
        showToast('Assignment deadline updated successfully.', 'success');
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, ...result.data } : t))
        );
      } else {
        setTasks(previousTasks);
        showToast(result.message || 'Unable to update assignment deadline.', 'error');
      }
    } catch (e: any) {
      setTasks(previousTasks);
      const errMsg =
        e.response?.data?.message || 'Unable to update assignment deadline.';
      showToast(errMsg, 'error');
    } finally {
      setIsExtending(false);
      setShowExtendModal(false);
      setSelectedTask(null);
      setExtendDueDate('');
      setDateValidationError(null);
    }
  };

  const locale = i18n.language === 'ar' ? 'ar-EG' : 'en-US';
  const formatDate = (d) =>
    d
      ? new Date(d).toLocaleDateString(locale, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '—';

  const renderStudentStatusBadge = (task) => {
    const my = mySubmissions[task.id];
    if (my && my.score != null) {
      return (
        <div className="space-y-1 w-full">
          <Badge variant="success" className="text-[10px] font-black">
            {t('tasks.statusGraded', {
              score: my.score,
              maxScore: task.maxScore,
            })}
          </Badge>
          {my.feedback && (
            <div className="mt-1 text-[10px] text-brand-text-sub bg-surface-subtle p-2 rounded-lg leading-relaxed flex items-start gap-1">
              <MessageSquare size={12} className="shrink-0 mt-0.5" />
              <span className="line-clamp-3">{my.feedback}</span>
            </div>
          )}
        </div>
      );
    }
    if (my) {
      return (
        <div className="space-y-1 w-full">
          <Badge variant="primary" className="text-[10px] font-black">
            {t('tasks.statusSubmitted')}
          </Badge>
          <div className="text-[9px] font-bold text-brand-text-muted">
            {t('tasks.submittedAt', { date: formatDate(my.submittedAt || my.createdAt) })}
          </div>
        </div>
      );
    }
    if (isOverdue(task.dueDate)) {
      return (
        <Badge variant="error" className="text-[10px] font-black">
          {t('tasks.statusOverdue')}
        </Badge>
      );
    }
    return null;
  };

  const renderStudentButton = (task) => {
    const my = mySubmissions[task.id];
    if (my) {
      return (
        <Button
          disabled
          className="w-full text-[10px] font-black uppercase tracking-widest py-3.5 gap-2 opacity-60"
        >
          <CheckCircle size={16} />
          {t('tasks.statusSubmitted')}
        </Button>
      );
    }
    const isClosed =
      task.portalState === 'MANUALLY_CLOSED' ||
      task.portalState === 'CLOSED' ||
      task.isManuallyClosed ||
      isOverdue(task.dueDate);

    return (
      <Button
        disabled={isClosed}
        onClick={() => {
          setSelectedTask(task);
          setShowSubmitModal(true);
        }}
        className={`w-full text-[10px] font-black uppercase tracking-widest py-3.5 gap-2 shadow-lg ${
          isClosed
            ? 'bg-gray-400 dark:bg-slate-700 text-white cursor-not-allowed opacity-60'
            : 'shadow-brand-primary-500/20'
        }`}
      >
        <FileUp size={16} />
        {isClosed ? 'Submissions Closed' : t('tasks.submitTask')}
      </Button>
    );
  };

  return (
    <div className="section-gap animate-page">
      {toast && (
        <div
          className={`${
            toast.type === 'error' ? 'toast-error' : 'toast-success'
          }`}
        >
          <div className="flex items-center gap-2">
            {toast.type === 'error' ? (
              <AlertCircle size={18} />
            ) : (
              <CheckCircle size={18} />
            )}
            <span className="font-medium">{toast.message}</span>
          </div>
        </div>
      )}

      <PageHeader
        title={t('tasks.title')}
        subtitle={
          isDoctor ? t('tasks.subtitleDoctor') : t('tasks.subtitleStudent')
        }
        action={
          isDoctor
            ? {
                label: t('tasks.createTask'),
                onClick: () => {
                  setEditingTask(null);
                  setShowCreateModal(true);
                },
              }
            : null
        }
      />

      {/* Create/Edit Task Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setEditingTask(null);
        }}
        title={editingTask ? t('tasks.editTask') : t('tasks.createTask')}
        subtitle={editingTask ? editingTask.title : t('tasks.subtitleDoctor')}
        size="md"
      >
        <form
          onSubmit={handleSubmitCreate(onCreateSubmit)}
          className="space-y-4 pt-2"
        >
          <div>
            <label className="block text-sm font-medium text-brand-text-sub">
              {t('tasks.taskTitle')}
            </label>
            <input
              type="text"
              className="mt-1 block w-full px-3 py-2 border border-brand-border rounded-xl focus:ring-2 focus:ring-brand-primary-500 outline-none bg-brand-bg-card"
              placeholder={t('tasks.taskTitle')}
              {...registerCreate('title')}
            />
            {errorsCreate.title && (
              <p className="text-rose-500 text-xs mt-1">
                {errorsCreate.title.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-brand-text-sub">
              {t('tasks.taskDescription')}
            </label>
            <textarea
              rows={3}
              className="mt-1 block w-full px-3 py-2 border border-brand-border rounded-xl focus:ring-2 focus:ring-brand-primary-500 outline-none bg-brand-bg-card"
              placeholder={t('tasks.taskDescription')}
              {...registerCreate('description')}
            />
            {errorsCreate.description && (
              <p className="text-rose-500 text-xs mt-1">
                {errorsCreate.description.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-brand-text-sub">
                {t('nav.courses')}
              </label>
              <select
                className="mt-1 block w-full px-3 py-2 border border-brand-border rounded-xl focus:ring-2 focus:ring-brand-primary-500 outline-none bg-brand-bg-card"
                disabled={!!editingTask}
                {...registerCreate('courseId')}
              >
                <option value="">{t('tasks.selectCourse')}</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.courseCode})
                  </option>
                ))}
              </select>
              {errorsCreate.courseId && (
                <p className="text-rose-500 text-xs mt-1">
                  {errorsCreate.courseId.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-brand-text-sub">
                {t('tasks.maxPoints')}
              </label>
              <input
                type="number"
                className="mt-1 block w-full px-3 py-2 border border-brand-border rounded-xl focus:ring-2 focus:ring-brand-primary-500 outline-none bg-brand-bg-card"
                {...registerCreate('maxScore')}
              />
              {errorsCreate.maxScore && (
                <p className="text-rose-500 text-xs mt-1">
                  {errorsCreate.maxScore.message}
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-brand-text-sub">
              {t('tasks.due')}
            </label>
            <input
              type="datetime-local"
              className="mt-1 block w-full px-3 py-2 border border-brand-border rounded-xl focus:ring-2 focus:ring-brand-primary-500 outline-none bg-brand-bg-card"
              {...registerCreate('dueDate')}
            />
            {errorsCreate.dueDate && (
              <p className="text-rose-500 text-xs mt-1">
                {errorsCreate.dueDate.message}
              </p>
            )}
          </div>

          <div className="pt-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setShowCreateModal(false);
                setEditingTask(null);
              }}
              className="px-4 py-2.5 text-brand-text-sub hover:bg-surface-subtle rounded-xl font-bold text-xs"
            >
              {t('common.cancel')}
            </button>
            <Button
              type="submit"
              disabled={isSubmittingCreate}
              className="px-6 py-2.5 shadow-md shadow-brand-primary-500/20"
            >
              {isSubmittingCreate
                ? t('common.loading')
                : editingTask
                ? t('tasks.editTask')
                : t('tasks.createTask')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Submit Task Modal */}
      <Modal
        isOpen={showSubmitModal}
        onClose={() => setShowSubmitModal(false)}
        title={t('tasks.submitTask')}
        subtitle={selectedTask?.title}
        size="md"
      >
        <form
          onSubmit={handleSubmitSubmit(onSubmitTask)}
          className="space-y-4 pt-2"
        >
          <div>
            <label className="block text-sm font-medium text-brand-text-sub">
              {t('tasks.submissionNotes')}
            </label>
            <textarea
              rows={3}
              className="mt-1 block w-full px-3 py-2 border border-brand-border rounded-xl focus:ring-2 focus:ring-brand-primary-500 outline-none bg-brand-bg-card"
              placeholder={t('tasks.submissionNotes')}
              {...registerSubmit('notes')}
            />
            {errorsSubmit.notes && (
              <p className="text-rose-500 text-xs mt-1">
                {errorsSubmit.notes.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-brand-text-sub">
              {t('tasks.fileUrlLabel', 'رابط الملف / الإجابة')}
            </label>
            <input
              type="url"
              className="mt-1 block w-full px-3 py-2 border border-brand-border rounded-xl focus:ring-2 focus:ring-brand-primary-500 outline-none bg-brand-bg-card"
              placeholder="https://..."
              {...registerSubmit('fileUrl')}
            />
            {errorsSubmit.fileUrl && (
              <p className="text-rose-500 text-xs mt-1">
                {errorsSubmit.fileUrl.message}
              </p>
            )}
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => setShowSubmitModal(false)}
              className="px-4 py-2 text-brand-text-sub hover:bg-surface-subtle rounded-xl font-bold text-xs"
            >
              {t('common.cancel')}
            </button>
            <Button
              type="submit"
              disabled={isSubmittingSubmit}
              className="px-6 py-2 shadow-md shadow-brand-primary-500/20"
            >
              {isSubmittingSubmit
                ? t('common.loading')
                : t('tasks.submitTask')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Submissions & Grading Modal */}
      <Modal
        isOpen={showSubmissionsModal}
        onClose={() => setShowSubmissionsModal(false)}
        title={t('tasks.viewSubmissions')}
        subtitle={selectedTask?.title}
        size="xl"
      >
        <div className="space-y-4 pt-2">
          {loadingSubmissions ? (
            <div className="flex items-center justify-center py-12 gap-3">
              <Loader2
                className="animate-spin text-brand-primary-500"
                size={32}
              />
              <p className="text-sm font-bold text-brand-text-muted">
                {t('tasks.loadingSubmissions', 'جاري تحميل التسليمات...')}
              </p>
            </div>
          ) : submissions.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-brand-border rounded-2xl">
              <ClipboardList
                size={40}
                className="mx-auto text-brand-text-muted opacity-40 mb-2"
              />
              <p className="text-sm font-bold text-brand-text-secondary">
                {t('tasks.noSubmissionsYet', 'لا توجد تسليمات لهذه المهمة حتى الآن.')}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-brand-border">
              {submissions.map((sub: any) => {
                const st = submissionState[sub.id] || {};
                const maxScore = Number(selectedTask?.maxScore || 100);
                const rawScore = String(st.score ?? sub.score ?? '');
                const scoreVal = parseFloat(rawScore);
                const exceeds =
                  !isNaN(scoreVal) && scoreVal > maxScore;
                return (
                  <div
                    key={sub.id}
                    className="py-4 flex flex-col lg:flex-row lg:items-start justify-between gap-4"
                  >
                    <div className="lg:max-w-[40%]">
                      <h4 className="font-bold text-sm text-brand-text-primary dark:text-brand-text-main">
                        {sub.student?.firstName} {sub.student?.lastName} (
                        {sub.student?.studentId})
                      </h4>
                      <p className="text-[10px] text-brand-text-muted mt-0.5">
                        {formatDate(sub.submittedAt || sub.createdAt)}
                      </p>
                      {sub.notes && (
                        <p className="text-xs text-brand-text-sub mt-2">
                          {sub.notes}
                        </p>
                      )}
                      {sub.fileUrl && (
                        <a
                          href={sub.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-brand-primary-500 hover:underline font-bold inline-flex items-center gap-1 mt-2"
                        >
                          <FileUp size={14} /> {t('tasks.viewAttachedFile', 'عرض الملف المرفق')}
                        </a>
                      )}
                    </div>

                    <div className="flex-1 lg:pl-4 lg:border-l lg:border-brand-border space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-widest text-brand-text-muted mb-1">
                            {t('tasks.grade')} (0 - {maxScore})
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              min={0}
                              max={maxScore}
                              step={0.01}
                              value={rawScore}
                              onChange={(e) => {
                                const v = e.target.value;
                                setSubmissionState((prev) => ({
                                  ...prev,
                                  [sub.id]: {
                                    ...prev[sub.id],
                                    score: v,
                                    scoreError:
                                      v &&
                                      parseFloat(v) > maxScore
                                        ? t('tasks.scoreExceedsMax', {
                                            maxScore,
                                          })
                                        : undefined,
                                  },
                                }));
                              }}
                              className={`w-full px-3 py-2 text-sm rounded-xl border ${
                                st.scoreError || exceeds
                                  ? 'border-rose-400 bg-rose-50 dark:bg-rose-950/20 focus:ring-rose-400'
                                  : 'border-brand-border bg-brand-bg-card focus:ring-brand-primary-500'
                              } focus:outline-none focus:ring-2`}
                              placeholder={`0 / ${maxScore}`}
                            />
                          </div>
                          {st.scoreError && (
                            <p className="mt-1 text-[10px] font-bold text-rose-600 flex items-center gap-1">
                              <AlertCircle size={12} />
                              {st.scoreError}
                            </p>
                          )}
                        </div>

                        <div className="flex items-end gap-2">
                          <div className="flex-1">
                            <label className="block text-[10px] font-black uppercase tracking-widest text-brand-text-muted mb-1">
                              {t('tasks.feedback')}
                            </label>
                            <Badge
                              variant={sub.score != null ? 'success' : 'warning'}
                              className="text-[10px] w-full justify-center"
                            >
                              {sub.score != null
                                ? `${t('tasks.grade')}: ${sub.score} / ${maxScore}`
                                : 'لم يتم التقييم بعد'}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-brand-text-muted mb-1">
                          {t('tasks.feedback')}
                        </label>
                        <textarea
                          rows={2}
                          value={st.feedback ?? sub.feedback ?? ''}
                          onChange={(e) =>
                            setSubmissionState((prev) => ({
                              ...prev,
                              [sub.id]: {
                                ...prev[sub.id],
                                feedback: e.target.value,
                              },
                            }))
                          }
                          placeholder={t('tasks.feedbackPlaceholder', 'اكتب ملاحظات للطالب (اختياري)...')}
                          className="w-full px-3 py-2 text-xs rounded-xl border border-brand-border bg-brand-bg-card focus:ring-2 focus:ring-brand-primary-500 focus:outline-none"
                        />
                      </div>

                      <div className="flex justify-end">
                        <Button
                          onClick={() => onSaveGrade(sub.id)}
                          disabled={st.saving}
                          className="text-[10px] font-black uppercase tracking-widest py-2 px-4 shadow-md shadow-brand-primary-500/20"
                        >
                          {st.saving ? (
                            <Loader2
                              className="animate-spin"
                              size={14}
                            />
                          ) : (
                            <CheckCircle size={14} />
                          )}
                          {st.saving
                            ? t('common.loading')
                            : t('tasks.saveGrade')}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title={t('tasks.deleteConfirmTitle')}
        subtitle={selectedTask?.title}
        size="md"
      >
        <div className="pt-2 space-y-5">
          <div
            className={`p-4 rounded-2xl border ${
              (selectedTask?._count?.submissions || 0) > 0
                ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800'
                : 'bg-surface-subtle border-brand-border'
            }`}
          >
            <div className="flex items-start gap-3">
              <AlertCircle
                size={20}
                className={
                  (selectedTask?._count?.submissions || 0) > 0
                    ? 'text-amber-600'
                    : 'text-brand-text-muted'
                }
              />
              <p className="text-xs font-bold leading-relaxed text-brand-text-primary">
                {(selectedTask?._count?.submissions || 0) > 0
                  ? t('tasks.deleteConfirmSoft')
                  : t('tasks.deleteConfirmEmpty')}
              </p>
            </div>
            <div className="mt-3 text-[10px] font-black text-brand-text-muted uppercase tracking-widest">
              {selectedTask?._count?.submissions ?? 0} {t('tasks.existingSubmissionsCount', 'تسليم(ات) موجود(ة)')}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(false)}
              className="px-4 py-2.5 text-brand-text-sub hover:bg-surface-subtle rounded-xl font-bold text-xs"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={() => onConfirmDelete(false)}
              className="px-4 py-2.5 rounded-xl font-bold text-xs text-white bg-amber-600 hover:bg-amber-700 shadow-md shadow-amber-500/20"
            >
              {t('tasks.deleteSoft')}
            </button>
            {(selectedTask?._count?.submissions || 0) === 0 && (
              <Button
                onClick={() => onConfirmDelete(true)}
                variant="destructive"
                className="px-4 py-2.5 text-xs shadow-md shadow-rose-500/20"
              >
                <Trash2 size={14} /> {t('tasks.deletePermanent')}
              </Button>
            )}
          </div>
        </div>
      </Modal>

      {/* Toggle Portal Confirmation Modal */}
      <Modal
        isOpen={showToggleConfirmModal}
        onClose={() => {
          if (!isTogglingPortal) {
            setShowToggleConfirmModal(false);
            setSelectedTask(null);
            setPendingPortalAction(null);
          }
        }}
        title={
          pendingPortalAction === 'CLOSE'
            ? 'Close Submission Portal'
            : 'Reopen Submission Portal'
        }
        subtitle={selectedTask?.title}
        size="md"
      >
        <div className="pt-2 space-y-4">
          <div
            className={`p-4 rounded-2xl border ${
              pendingPortalAction === 'CLOSE'
                ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800'
                : 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800'
            }`}
          >
            <div className="flex items-start gap-3">
              <AlertCircle
                size={20}
                className={
                  pendingPortalAction === 'CLOSE'
                    ? 'text-amber-600 shrink-0 mt-0.5'
                    : 'text-emerald-600 shrink-0 mt-0.5'
                }
              />
              <p className="text-xs font-bold leading-relaxed text-brand-text-primary dark:text-brand-text-main">
                {pendingPortalAction === 'CLOSE'
                  ? 'Closing the submission portal will immediately prevent students from uploading new files or modifying existing submissions.'
                  : 'Reopening the submission portal will restore dynamic evaluation and allow students to submit if the deadline has not passed.'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs bg-surface-subtle p-3.5 rounded-2xl border border-brand-border">
            <div>
              <span className="font-bold text-brand-text-muted block text-[10px] uppercase tracking-widest">
                Current Portal State
              </span>
              <span className="font-black text-brand-text-primary">
                {selectedTask?.portalState || 'UNKNOWN'}
              </span>
            </div>
            <div>
              <span className="font-bold text-brand-text-muted block text-[10px] uppercase tracking-widest">
                Current Deadline
              </span>
              <span className="font-black text-brand-text-primary">
                {formatDate(selectedTask?.dueDate)}
              </span>
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
            <button
              type="button"
              disabled={isTogglingPortal}
              onClick={() => {
                setShowToggleConfirmModal(false);
                setSelectedTask(null);
                setPendingPortalAction(null);
              }}
              className="px-4 py-2.5 text-brand-text-sub hover:bg-surface-subtle rounded-xl font-bold text-xs disabled:opacity-50"
            >
              {t('common.cancel')}
            </button>
            <Button
              onClick={onConfirmTogglePortal}
              disabled={isTogglingPortal}
              className={`px-6 py-2.5 text-xs font-bold shadow-md ${
                pendingPortalAction === 'CLOSE'
                  ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/20'
                  : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20'
              }`}
            >
              {isTogglingPortal ? (
                <>
                  <Loader2 size={14} className="animate-spin mr-2" />
                  {pendingPortalAction === 'CLOSE'
                    ? 'Closing...'
                    : 'Reopening...'}
                </>
              ) : pendingPortalAction === 'CLOSE' ? (
                'Confirm Close Submissions'
              ) : (
                'Confirm Reopen Submissions'
              )}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Extend Deadline Modal */}
      <Modal
        isOpen={showExtendModal}
        onClose={() => {
          if (!isExtending) {
            setShowExtendModal(false);
            setSelectedTask(null);
            setDateValidationError(null);
          }
        }}
        title={t('tasks.extendModalTitle', 'Extend Assignment Deadline')}
        subtitle={selectedTask?.title}
        size="md"
      >
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3 text-xs bg-surface-subtle p-3.5 rounded-2xl border border-brand-border mb-2">
            <div>
              <span className="font-bold text-brand-text-muted block text-[10px] uppercase tracking-widest">
                {t('tasks.currentDeadline', 'Current Deadline')}
              </span>
              <span className="font-black text-brand-text-primary">
                {formatDate(selectedTask?.dueDate)}
              </span>
            </div>
            <div>
              <span className="font-bold text-brand-text-muted block text-[10px] uppercase tracking-widest">
                {t('tasks.portalState', 'Portal State')}
              </span>
              <span className="font-black text-brand-text-primary">
                {selectedTask?.portalState || 'OPEN'}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-brand-text-sub mb-1">
              {t('tasks.newDueDate', 'New Due Date & Time')}
            </label>
            <input
              type="datetime-local"
              value={extendDueDate}
              disabled={isExtending}
              onChange={(e) => handleExtendDueDateChange(e.target.value)}
              className={`mt-1 block w-full px-3.5 py-2.5 border rounded-xl outline-none text-sm transition-all ${
                dateValidationError
                  ? 'border-rose-400 bg-rose-50/50 dark:bg-rose-950/20 focus:ring-2 focus:ring-rose-400'
                  : 'border-brand-border bg-brand-bg-card focus:ring-2 focus:ring-brand-primary-500'
              }`}
            />
            {dateValidationError && (
              <p className="mt-1.5 text-xs font-bold text-rose-600 flex items-center gap-1.5">
                <AlertCircle size={14} className="shrink-0" />
                {dateValidationError}
              </p>
            )}
          </div>

          <p className="text-[11px] text-brand-text-muted leading-relaxed">
            {t('tasks.extendNotice', 'Extending the deadline will update the target due date for all enrolled students and automatically allow on-time submissions until the new date.')}
          </p>

          <div className="pt-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            <button
              type="button"
              disabled={isExtending}
              onClick={() => {
                setShowExtendModal(false);
                setSelectedTask(null);
                setDateValidationError(null);
              }}
              className="px-4 py-2.5 text-brand-text-sub hover:bg-surface-subtle rounded-xl font-bold text-xs disabled:opacity-50"
            >
              {t('common.cancel')}
            </button>
            <Button
              onClick={onConfirmExtendDeadline}
              disabled={isExtending || !!dateValidationError || !extendDueDate}
              className="px-6 py-2.5 shadow-md shadow-brand-primary-500/20 text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExtending ? (
                <>
                  <Loader2 size={14} className="animate-spin mr-2" />
                  {t('tasks.updatingDeadline', 'Updating Deadline...')}
                </>
              ) : (
                t('tasks.confirmExtension', 'Confirm Extension')
              )}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Task Timeline Activity Modal */}
      <TaskTimelineModal
        task={selectedTask}
        isOpen={showTimelineModal}
        onClose={() => {
          setShowTimelineModal(false);
          setSelectedTask(null);
        }}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {loading ? (
          <div className="col-span-full flex flex-col items-center justify-center py-24 gap-4">
            <Loader2
              className="animate-spin text-brand-primary-500"
              size={48}
            />
            <p className="label-stat">Syncing assignments...</p>
          </div>
        ) : tasks.length === 0 ? (
          <div className="col-span-full">
            <EmptyState
              icon={<ClipboardList size={48} />}
              title={t('tasks.noTasks', 'No Assignments')}
              subtitle={
                isDoctor ? t('tasks.subtitleDoctor') : t('tasks.subtitleStudent')
              }
              action={
                isDoctor
                  ? {
                      label: t('tasks.createTask'),
                      onClick: () => setShowCreateModal(true),
                    }
                  : null
              }
            />
          </div>
        ) : (
          tasks.map((task) => (
            <Card
              key={task.id}
              noPadding
              className="group hover:-translate-y-2 duration-500 border-none shadow-soft rounded-[2rem] overflow-hidden flex flex-col"
            >
              <div className="p-8 flex-grow">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="primary"
                      className="px-3 py-1 text-[10px] font-black uppercase tracking-widest bg-brand-navy-500 text-white border-none"
                    >
                      {task.course?.courseCode}
                    </Badge>
                    {task.portalState && (
                      <Badge
                        variant={
                          task.portalState === 'OPEN'
                            ? 'success'
                            : task.portalState === 'SCHEDULED'
                            ? 'warning'
                            : 'error'
                        }
                        className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider"
                      >
                        {task.portalState === 'MANUALLY_CLOSED'
                          ? 'MANUALLY CLOSED'
                          : task.portalState}
                      </Badge>
                    )}
                  </div>
                  <div
                    className={`flex items-center gap-2 p-2 rounded-xl ${
                      isOverdue(task.dueDate)
                        ? 'bg-rose-50 dark:bg-rose-900/10 text-rose-500'
                        : 'bg-surface-subtle dark:bg-slate-800/50 text-brand-primary-500'
                    }`}
                  >
                    <Clock size={14} />
                    <span className="text-[10px] font-black uppercase tracking-widest">
                      {new Date(task.dueDate).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <h3 className="text-2xl font-black text-brand-text-primary dark:text-brand-text-main tracking-tight mb-3 group-hover:text-brand-primary-500 transition-colors">
                  {task.title}
                </h3>
                <p className="text-sm font-bold text-brand-text-secondary mb-6 line-clamp-2 leading-relaxed opacity-80">
                  {task.description}
                </p>

                {isStudent && (
                  <div className="mb-6">{renderStudentStatusBadge(task)}</div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-surface-subtle dark:bg-slate-800/50">
                    <div className="w-8 h-8 rounded-xl bg-white dark:bg-slate-700 shadow-sm flex items-center justify-center text-brand-accent-yellow">
                      <Send
                        size={16}
                        className="rtl:-scale-x-100"
                      />
                    </div>
                    <div>
                      <p className="text-[8px] font-black text-brand-text-muted uppercase tracking-widest">
                        Points
                      </p>
                      <p className="text-xs font-black text-brand-text-primary dark:text-brand-text-main">
                        {task.maxScore}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-surface-subtle dark:bg-slate-800/50">
                    <div className="w-8 h-8 rounded-xl bg-white dark:bg-slate-700 shadow-sm flex items-center justify-center text-brand-primary-500">
                      <Calendar size={16} />
                    </div>
                    <div className="truncate">
                      <p className="text-[8px] font-black text-brand-text-muted uppercase tracking-widest">
                        Course
                      </p>
                      <p className="text-xs font-black text-brand-text-primary dark:text-brand-text-main truncate max-w-[80px]">
                        {task.course?.name}
                      </p>
                    </div>
                  </div>
                </div>

                {isDoctor && isTaskOwner(task) && (
                  <div className="mt-6 flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => {
                        setEditingTask(task);
                        setShowCreateModal(true);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-brand-primary-600 bg-brand-primary-50 hover:bg-brand-primary-100 transition-colors"
                    >
                      <Pencil size={12} />
                      {t('tasks.editTask')}
                    </button>
                    <button
                      onClick={() => onInitiateExtendDeadline(task)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
                    >
                      <Clock size={12} />
                      Extend Deadline
                    </button>
                    {task.portalState === 'MANUALLY_CLOSED' ||
                    task.isManuallyClosed ? (
                      <button
                        onClick={() => onInitiateTogglePortal(task, 'REOPEN')}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 hover:bg-emerald-100 transition-colors"
                      >
                        <CheckCircle size={12} />
                        Reopen Submissions
                      </button>
                    ) : (
                      <button
                        onClick={() => onInitiateTogglePortal(task, 'CLOSE')}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-amber-600 bg-amber-50 hover:bg-amber-100 transition-colors"
                      >
                        <X size={12} />
                        Close Submissions
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setSelectedTask(task);
                        setShowTimelineModal(true);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 bg-slate-100 hover:bg-slate-200 dark:text-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors"
                    >
                      <History size={12} />
                      {t('timeline.activityLog', 'Activity Log')}
                    </button>
                    <button
                      onClick={() => {
                        setSelectedTask(task);
                        setShowDeleteConfirm(true);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-rose-600 bg-rose-50 hover:bg-rose-100 transition-colors"
                    >
                      <Trash2 size={12} />
                      {t('tasks.deleteTask')}
                    </button>
                  </div>
                )}
              </div>

              <div className="px-8 py-5 bg-surface-subtle dark:bg-slate-800/30 border-t border-brand-border dark:border-brand-border mt-auto">
                {isStudent ? (
                  <div className="flex flex-col gap-2">
                    {renderStudentButton(task)}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTask(task);
                        setShowTimelineModal(true);
                      }}
                      className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 bg-slate-100 hover:bg-slate-200 dark:text-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors"
                    >
                      <History size={12} />
                      {t('timeline.activityLog', 'Activity Log')}
                    </button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedTask(task);
                      fetchSubmissions(task.id);
                      setShowSubmissionsModal(true);
                    }}
                    className="w-full text-[10px] font-black uppercase tracking-widest py-3.5 gap-2 border-slate-200"
                  >
                    <CheckCircle size={16} />
                    {t('tasks.viewSubmissions')}
                  </Button>
                )}
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default TasksList;
