import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import examsService from '../../services/exams.service';
import coursesService from '../../services/courses.service';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import useScope from '../../hooks/useScope';
import { Plus, Search, Calendar, Clock, MapPin, Filter, Trash2, Eye, Loader2, CheckCircle2, AlertCircle, SlidersHorizontal, FileText, CalendarCheck } from 'lucide-react';
import Table, { TableRow, TableCell, TableHeader, TableHead, TableBody } from '../../components/ui/Table';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/input';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  courseId: z.string().min(1, "Course is required"),
  type: z.enum(['MIDTERM', 'FINAL', 'QUIZ']),
  date: z.string().min(1, "Date is required"),
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().min(1, "End time is required"),
  room: z.string().optional()
});

type FormData = z.infer<typeof schema>;

const AddExamModal = ({ isOpen, onClose, onSuccess }) => {
  const { t } = useTranslation();
  const [courses, setCourses] = useState([]);
  const [error, setError] = useState('');

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      courseId: '',
      type: 'MIDTERM',
      date: '',
      startTime: '09:00',
      endTime: '11:00',
      room: ''
    }
  });

  useEffect(() => {
    if (isOpen) {
      fetchCourses();
      reset();
    }
  }, [isOpen, reset]);

  const fetchCourses = async () => {
    try {
      const result = await coursesService.getCourses();
      if (result.success) {
        // Handle both old array format and new paginated object format
        const coursesData = Array.isArray(result.data) ? result.data : result.data.courses;
        setCourses(coursesData || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const onSubmit = async (data) => {
    setError('');
    try {
      const result = await examsService.createExam(data);
      if (result.success) {
        onSuccess();
        onClose();
      }
    } catch (err) {
      setError(err.response?.data?.message || t('exams.createError'));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('exams.scheduleNew')}
      subtitle={t('exams.scheduleSubtitle')}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="form-section">
        {error && <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-100 text-rose-600 text-sm font-bold">{error}</div>}
        
        <div className="space-y-1.5">
          <label className="text-sm font-bold text-brand-text-main ml-1">{t('exams.selectCourse')} *</label>
          <select
            className="w-full h-11 px-4 bg-brand-bg-page/30 border border-brand-border rounded-xl text-sm text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-green/20 transition-all appearance-none cursor-pointer"
            {...register('courseId')}
          >
            <option value="">{t('exams.chooseCourse')}</option>
            {courses.map(c => <option key={c.id} value={c.id}>{c.courseCode} - {c.name}</option>)}
          </select>
          {errors.courseId && <p className="text-rose-500 text-xs mt-1">{errors.courseId.message}</p>}
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-bold text-brand-text-main ml-1">{t('exams.examType')} *</label>
          <select
            className="w-full h-11 px-4 bg-brand-bg-page/30 border border-brand-border rounded-xl text-sm text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-green/20 transition-all appearance-none cursor-pointer"
            {...register('type')}
          >
            <option value="MIDTERM">{t('exams.midterm')}</option>
            <option value="FINAL">{t('exams.final')}</option>
            <option value="QUIZ">{t('exams.quiz')}</option>
          </select>
          {errors.type && <p className="text-rose-500 text-xs mt-1">{errors.type.message}</p>}
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-bold text-brand-text-main ml-1">Exam Date *</label>
          <Input
            type="date"
            {...register('date')}
          />
          {errors.date && <p className="text-rose-500 text-xs mt-1">{errors.date.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-brand-text-main ml-1">Start Time *</label>
            <Input
              type="time"
              {...register('startTime')}
            />
            {errors.startTime && <p className="text-rose-500 text-xs mt-1">{errors.startTime.message}</p>}
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-brand-text-main ml-1">End Time *</label>
            <Input
              type="time"
              {...register('endTime')}
            />
            {errors.endTime && <p className="text-rose-500 text-xs mt-1">{errors.endTime.message}</p>}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-bold text-brand-text-main ml-1">Location / Room</label>
          <Input
            placeholder="e.g. Auditorium A, Hall 302"
            {...register('room')}
          />
          {errors.room && <p className="text-rose-500 text-xs mt-1">{errors.room.message}</p>}
        </div>

        <div className="mt-8 flex justify-end gap-3 border-t border-brand-border pt-6">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={isSubmitting} className="min-w-[140px]">
            {isSubmitting ? 'Scheduling...' : 'Schedule Exam'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

const ExamsList = () => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language?.startsWith('ar');
  const { user } = useAuth();
  const { scopeParams } = useScope();
  const navigate = useNavigate();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isAdmin = ['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'].includes(user?.role);
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filter, setFilter] = useState('ALL');
  const [upcomingOnly, setUpcomingOnly] = useState(false);
  const [toast, setToast] = useState(null);

  // Set page background tint on mount
  useEffect(() => {
    const mainEl = document.querySelector('main');
    if (mainEl) {
      mainEl.classList.add('bg-slate-50', 'dark:bg-slate-900');
      return () => {
        mainEl.classList.remove('bg-slate-50', 'dark:bg-slate-900');
      };
    }
  }, []);

  const fetchExams = async () => {
    try {
      setLoading(true);
      const params = { ...scopeParams } as any;
      if (filter !== 'ALL') params.type = filter;
      if (upcomingOnly) params.upcoming = 'true';
      
      const result = await examsService.getExams(params);
      if (result.success) setExams(result.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExams();
  }, [filter, upcomingOnly, scopeParams]);

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this exam?')) {
      try {
        const result = await examsService.deleteExam(id);
        if (result.success) {
          showToast('Exam deleted successfully', 'success');
          fetchExams();
        }
      } catch (err) {
        showToast('Error deleting exam', 'error');
      }
    }
  };

  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const totalExams = exams.length;
  const upcomingExams = exams.filter(exam => {
    const examDate = new Date(exam.date);
    const today = new Date();
    today.setHours(0,0,0,0);
    return examDate >= today;
  }).length;
  const todayExams = exams.filter(exam => {
    const examDate = new Date(exam.date).toDateString();
    const today = new Date().toDateString();
    return examDate === today;
  }).length;

  return (
    <div className="section-gap animate-page">
      {/* Toast Notification */}
      {toast && (
        <div className={`${toast.type === 'error' ? 'toast-error' : 'toast-success'}`}>
          <div className="flex items-center gap-2">
            {toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
            <span className="font-medium">{toast.message}</span>
          </div>
        </div>
      )}

      <PageHeader 
        title={t('exams.title', 'الامتحانات')}
        subtitle={t('exams.subtitle', 'الاختبارات الفصلية والنهائية والتقييمات القادمة')}
        action={isAdmin ? {
          label: t('exams.addExam', '+ إضافة امتحان'),
          onClick: () => setIsModalOpen(true),
          className: "bg-brand-primary-500 hover:bg-brand-primary-600 text-white font-bold rounded-xl px-4 py-2 active:scale-95 transition-all flex items-center gap-2",
          icon: Plus
        } : undefined}
      />

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 animate-page">
        {/* Card 1: Total Exams */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 flex items-center gap-4 group hover:-translate-y-0.5 hover:shadow-md transition-all">
          <div className="rounded-xl p-2.5 bg-brand-primary-500/10 text-brand-primary-500">
            <FileText size={24} />
          </div>
          <div className="flex flex-col text-start">
            <span className="text-sm text-brand-text-secondary dark:text-slate-400 font-medium">
              {t('exams.totalCount', 'إجمالي الامتحانات')}
            </span>
            <span className="text-2xl font-black text-brand-text-primary dark:text-white">
              {totalExams}
            </span>
          </div>
        </div>

        {/* Card 2: Upcoming Exams */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 flex items-center gap-4 group hover:-translate-y-0.5 hover:shadow-md transition-all">
          <div className="rounded-xl p-2.5 bg-blue-500/10 text-blue-500">
            <Clock size={24} />
          </div>
          <div className="flex flex-col text-start">
            <span className="text-sm text-brand-text-secondary dark:text-slate-400 font-medium">
              {t('exams.upcomingCount', 'الامتحانات القادمة')}
            </span>
            <span className="text-2xl font-black text-brand-text-primary dark:text-white">
              {upcomingExams}
            </span>
          </div>
        </div>

        {/* Card 3: Today's Exams */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 flex items-center gap-4 group hover:-translate-y-0.5 hover:shadow-md transition-all">
          <div className="rounded-xl p-2.5 bg-amber-500/10 text-amber-500">
            <CalendarCheck size={24} />
          </div>
          <div className="flex flex-col text-start">
            <span className="text-sm text-brand-text-secondary dark:text-slate-400 font-medium">
              {t('exams.todayCount', 'امتحانات اليوم')}
            </span>
            <span className="text-2xl font-black text-brand-text-primary dark:text-white">
              {todayExams}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Filters Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 space-y-4">
            <div className="flex items-center gap-2 text-brand-text-primary dark:text-white">
              <SlidersHorizontal size={18} className="text-brand-primary-500" />
              <h3 className="text-sm font-semibold">
                {t('exams.filters', 'تصفية الامتحانات')}
              </h3>
            </div>
            
            <div className="border-b border-slate-200 dark:border-slate-700 my-3" />
            
            <div className="space-y-1">
              {[
                { value: 'ALL', label: t('exams.filterAll', 'الكل') },
                { value: 'MIDTERM', label: t('exams.filterMidterm', 'اختبار منتصف الفصل') },
                { value: 'FINAL', label: t('exams.filterFinal', 'الاختبار النهائي') },
                { value: 'QUIZ', label: t('exams.filterQuiz', 'اختبار قصير') }
              ].map((type) => (
                <button
                  key={type.value}
                  onClick={() => setFilter(type.value)}
                  className={`w-full text-start px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                    filter === type.value 
                    ? 'bg-brand-primary-500 text-white shadow-sm' 
                    : 'text-brand-text-secondary dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
            
            <div className="border-b border-slate-200 dark:border-slate-700 my-3" />
            
            <label className="flex items-center justify-between cursor-pointer group py-1">
              <span className="text-sm font-medium text-brand-text-secondary dark:text-slate-400 group-hover:text-brand-text-primary dark:group-hover:text-white transition-colors">
                {t('exams.upcomingOnly', 'القادمة فقط')}
              </span>
              <div className="relative">
                <input 
                  type="checkbox" 
                  className="sr-only" 
                  checked={upcomingOnly}
                  onChange={(e) => setUpcomingOnly(e.target.checked)}
                />
                <div className={`w-10 h-5 rounded-full transition-colors duration-300 ${upcomingOnly ? 'bg-brand-primary-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
                <div className={`absolute top-1 left-1 w-3 h-3 rounded-full bg-white transition-transform duration-300 ${upcomingOnly ? 'translate-x-5' : ''}`} />
              </div>
            </label>
          </div>
        </div>

        {/* Exams Table Content */}
        <div className="lg:col-span-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <Loader2 className="animate-spin text-brand-primary-500" size={40} />
              <p className="text-sm font-semibold text-brand-text-secondary dark:text-slate-400">
                {t('exams.fetching', 'Fetching exams...')}
              </p>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
              {exams.length === 0 ? (
                <div className="p-8">
                  <EmptyState 
                    icon={<Calendar size={48} />}
                    title={t('exams.noExams', 'No Exams Found')}
                    subtitle={t('exams.noExamsSubtitle', 'There are no exams scheduled matching your criteria.')}
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table className="w-full">
                    <TableHeader className="bg-slate-50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-700">
                      <TableRow>
                        <TableHead className="text-start p-4 font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          {t('exams.exam', 'الامتحان')}
                        </TableHead>
                        <TableHead className="text-center p-4 font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          {t('exams.type', 'النوع')}
                        </TableHead>
                        <TableHead className="text-start p-4 font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          {t('courses.course', 'المقرر')}
                        </TableHead>
                        <TableHead className="text-center p-4 font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          {t('exams.dateTime', 'التاريخ والوقت')}
                        </TableHead>
                        <TableHead className="text-center p-4 font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          {t('exams.room', 'القاعة')}
                        </TableHead>
                        <TableHead className="text-end p-4 font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 pe-6">
                          {t('common.actions', 'الإجراءات')}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {exams.map((exam) => (
                        <TableRow 
                          key={exam.id} 
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 last:border-b-0 transition-colors"
                        >
                          <TableCell className="p-4 text-start">
                            <div className="font-semibold text-brand-text-primary dark:text-white">
                              {exam.type === 'FINAL' ? t('exams.finalExam', 'الاختبار النهائي') : exam.type === 'MIDTERM' ? t('exams.midtermExam', 'اختبار منتصف الفصل') : t('exams.quizExam', 'اختبار قصير')}
                            </div>
                            <div className="text-xs text-brand-text-secondary dark:text-slate-400">
                              {exam.course?.name}
                            </div>
                          </TableCell>
                          <TableCell className="p-4 text-center">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                              exam.type === 'FINAL' 
                                ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400' 
                                : exam.type === 'MIDTERM' 
                                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400' 
                                  : 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                            }`}>
                              {exam.type === 'FINAL' ? t('exams.final', 'نهائي') : exam.type === 'MIDTERM' ? t('exams.midterm', 'منتصف') : t('exams.quiz', 'قصير')}
                            </span>
                          </TableCell>
                          <TableCell className="p-4 text-start font-medium text-brand-text-primary dark:text-white">
                            {exam.course?.courseCode}
                          </TableCell>
                          <TableCell className="p-4 text-center">
                            <div className="text-sm font-semibold text-brand-text-primary dark:text-white">
                              {new Date(exam.date).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </div>
                            <div className="text-xs text-brand-text-secondary dark:text-slate-400">
                              {exam.startTime} - {exam.endTime}
                            </div>
                          </TableCell>
                          <TableCell className="p-4 text-center font-medium text-brand-text-primary dark:text-white">
                            {exam.room || t('exams.tba', 'TBA')}
                          </TableCell>
                          <TableCell className="p-4 text-end pe-6">
                            <div className="flex items-center justify-end gap-2">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-xs font-semibold text-brand-primary-500 hover:text-brand-primary-600 flex items-center gap-1" 
                                onClick={() => navigate(`/exams/${exam.id}`)}
                              >
                                <Eye size={16} />
                                <span>{t('common.view', 'عرض')}</span>
                              </Button>
                              {isSuperAdmin && (
                                <button 
                                  onClick={() => handleDelete(exam.id)}
                                  className="p-2 rounded-lg text-brand-text-muted hover:text-error hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all"
                                  aria-label={t('common.delete', 'حذف')}
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <AddExamModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={fetchExams} 
      />
    </div>
  );
};

export default ExamsList;
