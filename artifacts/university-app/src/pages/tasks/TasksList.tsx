// @ts-nocheck
import React, { useState, useEffect } from 'react';
import taskService from '../../services/task.service';
import coursesService from '../../services/courses.service';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { ClipboardList, Calendar, Plus, FileUp, CheckCircle, Clock, X, Send, AlertCircle, Loader2 } from 'lucide-react';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const createSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  courseId: z.string().min(1, "Course is required"),
  dueDate: z.string().min(1, "Due date is required"),
  maxScore: z.coerce.number().min(1, "Max score must be at least 1")
});

const submitSchema = z.object({
  notes: z.string().optional(),
  fileUrl: z.string().url("Must be a valid URL").min(1, "File URL is required")
});

type CreateFormData = z.infer<typeof createSchema>;
type SubmitFormData = z.infer<typeof submitSchema>;

const TasksList = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isDoctor = user?.role === 'DOCTOR';
  const isStudent = user?.role === 'STUDENT';
  
  const [tasks, setTasks] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const { 
    register: registerCreate, 
    handleSubmit: handleSubmitCreate, 
    reset: resetCreate, 
    formState: { errors: errorsCreate, isSubmitting: isSubmittingCreate } 
  } = useForm({
    resolver: zodResolver(createSchema),
    defaultValues: {
      title: '',
      description: '',
      courseId: '',
      dueDate: '',
      maxScore: 100
    }
  });

  const { 
    register: registerSubmit, 
    handleSubmit: handleSubmitSubmit, 
    reset: resetSubmit, 
    formState: { errors: errorsSubmit, isSubmitting: isSubmittingSubmit } 
  } = useForm({
    resolver: zodResolver(submitSchema),
    defaultValues: {
      notes: '',
      fileUrl: ''
    }
  });

  useEffect(() => {
    if (showCreateModal) resetCreate();
  }, [showCreateModal, resetCreate]);

  useEffect(() => {
    if (showSubmitModal) resetSubmit();
  }, [showSubmitModal, resetSubmit]);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const result = await taskService.getTasks();
      if (result.success) {
        setTasks(result.data);
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

  useEffect(() => {
    fetchTasks();
    if (isDoctor) fetchCourses();
  }, [isDoctor]);

  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const isOverdue = (dueDate) => {
    return new Date(dueDate) < new Date();
  };

  const onCreateSubmit = async (data) => {
    try {
      const result = await taskService.createTask(data);
      if (result.success) {
        showToast('Assignment created successfully', 'success');
        setShowCreateModal(false);
        fetchTasks();
      }
    } catch (error) {
      showToast(error.response?.data?.message || 'Error creating assignment', 'error');
    }
  };

  const onSubmitTask = async (data) => {
    try {
      const result = await taskService.submitTask(selectedTask.id, data);
      if (result.success) {
        showToast('Assignment submitted successfully', 'success');
        setShowSubmitModal(false);
        fetchTasks();
      }
    } catch (error) {
      showToast(error.response?.data?.message || 'Error submitting assignment', 'error');
    }
  };

  return (
    <div className="section-gap animate-page">
      {/* Toast Notification */}
      {toast && (
        <div className={`${toast.type === 'error' ? 'toast-error' : 'toast-success'}`}>
          <div className="flex items-center gap-2">
            {toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle size={18} />}
            <span className="font-medium">{toast.message}</span>
          </div>
        </div>
      )}

      {/* FIXED: Move action button next to title */}
      <PageHeader 
        title={t('tasks.title')}
        subtitle={isDoctor ? t('tasks.subtitleDoctor') : t('tasks.subtitleStudent')}
        action={isDoctor ? {
          label: t('tasks.createTask'),
          onClick: () => setShowCreateModal(true)
        } : null}
      />

      {/* Create Task Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-brand-bg-card rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 border border-brand-border">
            <div className="p-4 sm:p-6 border-b border-brand-border flex justify-between items-center bg-brand-bg-page">
              <h2 className="text-lg sm:text-xl font-bold text-brand-text-main">{t('tasks.createTask')}</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-brand-text-muted hover:text-brand-text-sub">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmitCreate(onCreateSubmit)} className="p-4 sm:p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-brand-text-sub">{t('auth.title')}</label>
                <input
                  type="text"
                  className="mt-1 block w-full px-3 py-2 border border-brand-border rounded-md focus:ring-2 focus:ring-brand-primary-500 outline-none bg-brand-bg-card"
                  {...registerCreate('title')}
                />
                {errorsCreate.title && <p className="text-rose-500 text-xs mt-1">{errorsCreate.title.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-brand-text-sub">{t('profile.bio')}</label>
                <textarea
                  rows="3"
                  className="mt-1 block w-full px-3 py-2 border border-brand-border rounded-md focus:ring-2 focus:ring-brand-primary-500 outline-none bg-brand-bg-card"
                  {...registerCreate('description')}
                />
                {errorsCreate.description && <p className="text-rose-500 text-xs mt-1">{errorsCreate.description.message}</p>}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-brand-text-sub">{t('nav.courses')}</label>
                  <select
                    className="mt-1 block w-full px-3 py-2 border border-brand-border rounded-md focus:ring-2 focus:ring-brand-primary-500 outline-none bg-brand-bg-card"
                    {...registerCreate('courseId')}
                  >
                    <option value="">{t('courses.assignedDoctor')}</option>
                    {courses.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  {errorsCreate.courseId && <p className="text-rose-500 text-xs mt-1">{errorsCreate.courseId.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-brand-text-sub">{t('tasks.maxPoints')}</label>
                  <input
                    type="number"
                    className="mt-1 block w-full px-3 py-2 border border-brand-border rounded-md focus:ring-2 focus:ring-brand-primary-500 outline-none bg-brand-bg-card"
                    {...registerCreate('maxScore')}
                  />
                  {errorsCreate.maxScore && <p className="text-rose-500 text-xs mt-1">{errorsCreate.maxScore.message}</p>}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-brand-text-sub">{t('tasks.due')}</label>
                <input
                  type="datetime-local"
                  className="mt-1 block w-full px-3 py-2 border border-brand-border rounded-md focus:ring-2 focus:ring-brand-primary-500 outline-none bg-brand-bg-card"
                  {...registerCreate('dueDate')}
                />
                {errorsCreate.dueDate && <p className="text-rose-500 text-xs mt-1">{errorsCreate.dueDate.message}</p>}
              </div>
              <div className="pt-4 flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-3 gap-3 sm:gap-0">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-brand-text-sub hover:bg-brand-bg-page rounded-md"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCreate}
                  className="px-6 py-2 bg-brand-primary-500 text-white rounded-md hover:bg-brand-primary-600 disabled:opacity-50 shadow-sm"
                >
                  {isSubmittingCreate ? t('common.loading') : t('tasks.createTask')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Submit Task Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-brand-bg-card rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 border border-brand-border">
            <div className="p-4 sm:p-6 border-b border-brand-border flex justify-between items-center bg-brand-bg-page">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-brand-text-main">{t('tasks.submitTask')}</h2>
                <p className="text-xs sm:text-sm text-brand-text-muted">{selectedTask?.title}</p>
              </div>
              <button onClick={() => setShowSubmitModal(false)} className="text-brand-text-muted hover:text-brand-text-sub">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmitSubmit(onSubmitTask)} className="p-4 sm:p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-brand-text-sub">{t('tasks.submissions')} {t('profile.bio')}</label>
                <textarea
                  rows="3"
                  className="mt-1 block w-full px-3 py-2 border border-brand-border rounded-md focus:ring-2 focus:ring-brand-primary-500 outline-none bg-brand-bg-card"
                  placeholder="..."
                  {...registerSubmit('notes')}
                />
                {errorsSubmit.notes && <p className="text-rose-500 text-xs mt-1">{errorsSubmit.notes.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-brand-text-sub">File URL</label>
                <input
                  type="url"
                  className="mt-1 block w-full px-3 py-2 border border-brand-border rounded-md focus:ring-2 focus:ring-brand-primary-500 outline-none bg-brand-bg-card"
                  placeholder="https://..."
                  {...registerSubmit('fileUrl')}
                />
                {errorsSubmit.fileUrl && <p className="text-rose-500 text-xs mt-1">{errorsSubmit.fileUrl.message}</p>}
              </div>
              <div className="pt-4 flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-3 gap-3 sm:gap-0">
                <button
                  type="button"
                  onClick={() => setShowSubmitModal(false)}
                  className="px-4 py-2 text-brand-text-sub hover:bg-brand-bg-page rounded-md"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingSubmit}
                  className="px-6 py-2 bg-brand-primary-500 text-white rounded-md hover:bg-brand-primary-600 disabled:opacity-50 flex items-center justify-center shadow-sm"
                >
                  {isSubmittingSubmit ? t('common.loading') : (
                    <>
                      {t('common.submit')} <Send size={16} className="rtl:-scale-x-100 ml-2" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {loading ? (
          <div className="col-span-full flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 className="animate-spin text-brand-primary-500" size={48} />
            <p className="label-stat">Syncing assignments...</p>
          </div>
        ) : tasks.length === 0 ? (
          <div className="col-span-full">
            <EmptyState 
              icon={<ClipboardList size={48} />}
              title={t('tasks.noTasks', 'No Assignments')}
              subtitle={isDoctor ? t('tasks.subtitleDoctor') : t('tasks.subtitleStudent')}
              action={isDoctor ? {
                label: t('tasks.createTask'),
                onClick: () => setShowCreateModal(true)
              } : null}
            />
          </div>
        ) : (
          tasks.map((task) => (
            <Card key={task.id} noPadding className="group hover:-translate-y-2 duration-500 border-none shadow-soft rounded-[2rem] overflow-hidden flex flex-col">
              <div className="p-8 flex-grow">
                <div className="flex justify-between items-start mb-6">
                  <Badge variant="primary" className="px-3 py-1 text-[10px] font-black uppercase tracking-widest bg-brand-navy-500 text-white border-none">
                    {task.course?.courseCode}
                  </Badge>
                  <div className={`flex items-center gap-2 p-2 rounded-xl ${isOverdue(task.dueDate) ? 'bg-rose-50 dark:bg-rose-900/10 text-rose-500' : 'bg-surface-subtle dark:bg-slate-800/50 text-brand-primary-500'}`}>
                    <Clock size={14} />
                    <span className="text-[10px] font-black uppercase tracking-widest">
                      {new Date(task.dueDate).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <h3 className="text-2xl font-black text-brand-text-primary dark:text-brand-text-main tracking-tight mb-3 group-hover:text-brand-primary-500 transition-colors">
                  {task.title}
                </h3>
                <p className="text-sm font-bold text-brand-text-secondary mb-8 line-clamp-2 leading-relaxed opacity-80">
                  {task.description}
                </p>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-surface-subtle dark:bg-slate-800/50">
                    <div className="w-8 h-8 rounded-xl bg-white dark:bg-slate-700 shadow-sm flex items-center justify-center text-brand-accent-yellow">
                      <Send size={16} className="rtl:-scale-x-100" />
                    </div>
                    <div>
                      <p className="text-[8px] font-black text-brand-text-muted uppercase tracking-widest">Points</p>
                      <p className="text-xs font-black text-brand-text-primary dark:text-brand-text-main">{task.maxScore}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-surface-subtle dark:bg-slate-800/50">
                    <div className="w-8 h-8 rounded-xl bg-white dark:bg-slate-700 shadow-sm flex items-center justify-center text-brand-primary-500">
                      <Calendar size={16} />
                    </div>
                    <div className="truncate">
                      <p className="text-[8px] font-black text-brand-text-muted uppercase tracking-widest">Course</p>
                      <p className="text-xs font-black text-brand-text-primary dark:text-brand-text-main truncate max-w-[80px]">{task.course?.name}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-8 py-5 bg-surface-subtle dark:bg-slate-800/30 border-t border-brand-border dark:border-brand-border mt-auto">
                {isStudent ? (
                  <Button 
                    onClick={() => {
                      setSelectedTask(task);
                      setShowSubmitModal(true)}
                    }
                    className="w-full text-[10px] font-black uppercase tracking-widest py-3.5 gap-2 shadow-lg shadow-brand-primary-500/20"
                  >
                    <FileUp size={16} />
                    {t('tasks.submitTask')}
                  </Button>
                ) : (
                  <Button 
                    variant="outline"
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

