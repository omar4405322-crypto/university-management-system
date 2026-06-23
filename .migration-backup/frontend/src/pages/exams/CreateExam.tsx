// FIXED: Exam create uses room field (matches database schema)
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import examsService from '../../services/exams.service';
import coursesService from '../../services/courses.service';
import {
  ChevronLeft,
  Save,
  Calendar as CalendarIcon,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Info,
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';

const parseTimeToMinutes = (time) => {
  if (!time) return null;
  const [h, m] = time.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
};

const schema = z.object({
  courseId: z.string().min(1, 'Please select a course'),
  type: z.enum(['MIDTERM', 'FINAL', 'QUIZ']),
  date: z.string().min(1, 'Exam date is required'),
  startTime: z.string().min(1, 'Start time is required'),
  endTime: z.string().min(1, 'End time is required'),
  durationMinutes: z.coerce.number().min(1, 'Duration must be at least 1 minute'),
  room: z.string().optional(),
}).refine((data) => {
  const start = parseTimeToMinutes(data.startTime);
  const end = parseTimeToMinutes(data.endTime);
  if (start != null && end != null && end <= start) {
    return false;
  }
  return true;
}, {
  message: 'End time must be after start time',
  path: ['endTime'],
});

type FormData = z.infer<typeof schema>;

const CreateExam = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [courses, setCourses] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      courseId: '',
      type: 'MIDTERM',
      date: '',
      startTime: '09:00',
      endTime: '11:00',
      durationMinutes: 120,
      room: '',
    }
  });

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      setCoursesLoading(true);
      const result = await coursesService.getCourses();
      if (result.success) setCourses(Array.isArray(result.data) ? result.data : []);
    } catch (err) {
      console.error(err);
      setError(t('exams.coursesLoadError', 'Could not load courses.'));
    } finally {
      setCoursesLoading(false);
    }
  };

  const onSubmit = async (data) => {
    setError('');
    try {
      const payload = {
        courseId: data.courseId,
        type: data.type,
        date: data.date,
        startTime: data.startTime,
        endTime: data.endTime,
        room: data.room ? data.room.trim() : 'TBA',
      };
      const result = await examsService.createExam(payload);
      if (result.success) {
        setSuccess(true);
        setTimeout(() => navigate('/exams'), 2000);
      } else {
        setError(result.message || t('exams.createError', 'Error creating exam'));
      }
    } catch (err) {
      setError(err.message || t('exams.createError', 'Error creating exam schedule'));
    }
  };

  return (
    <div className="section-gap animate-in fade-in duration-700">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => navigate('/exams')}
          className="p-3 text-brand-text-sub hover:text-brand-green hover:bg-brand-green/10 rounded-2xl transition-all duration-300"
        >
          <ChevronLeft size={24} className="rtl:-scale-x-100" />
        </button>
        <div>
          <h1 className="text-3xl font-black text-brand-text-main tracking-tight">
            {t('exams.createTitle', 'Schedule New Exam')}
          </h1>
          <p className="text-brand-text-sub font-bold mt-1 uppercase tracking-wider">
            {t('exams.createSubtitle', 'Define the academic assessment parameters')}
          </p>
        </div>
      </div>

      {success && (
        <div className="p-4 rounded-2xl bg-brand-green text-white flex items-center gap-3">
          <CheckCircle2 size={24} />
          <p className="font-bold">{t('exams.createSuccess', 'Exam scheduled successfully! Redirecting...')}</p>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-rose-500 text-white flex items-center gap-3">
          <AlertCircle size={24} />
          <p className="font-bold">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card title={t('exams.basicInfo', 'Basic Information')} borderLeft={false}>
            <div className="space-y-6 pt-2">
              <div className="space-y-2">
                <label className="text-sm font-black text-brand-text-main uppercase tracking-widest ml-1">
                  {t('exams.selectCourse', 'Course')} *
                </label>
                <select
                  disabled={coursesLoading}
                  className="w-full h-12 px-4 bg-brand-bg-page/50 border border-brand-border rounded-2xl text-sm font-bold text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-green/20 transition-all appearance-none cursor-pointer disabled:opacity-50"
                  {...register('courseId')}
                >
                  <option value="">{coursesLoading ? t('common.loading') : t('exams.chooseCourse', 'Choose a course')}</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>{c.courseCode} - {c.name}</option>
                  ))}
                </select>
                {errors.courseId && <p className="text-rose-500 text-xs mt-1">{errors.courseId.message}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-black text-brand-text-main uppercase tracking-widest ml-1">
                  {t('exams.examType', 'Exam Type')} *
                </label>
                <select
                  className="w-full h-12 px-4 bg-brand-bg-page/50 border border-brand-border rounded-2xl text-sm font-bold text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-green/20 transition-all appearance-none cursor-pointer"
                  {...register('type')}
                >
                  <option value="MIDTERM">{t('exams.typeMidterm', 'Midterm')}</option>
                  <option value="FINAL">{t('exams.typeFinal', 'Final')}</option>
                  <option value="QUIZ">{t('exams.typeQuiz', 'Quiz')}</option>
                </select>
                {errors.type && <p className="text-rose-500 text-xs mt-1">{errors.type.message}</p>}
              </div>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-1 space-y-6">
          <Card title={t('exams.timingLocation', 'Timing & Location')} borderLeft={false}>
            <div className="space-y-6 pt-2">
              <div className="space-y-2">
                <label className="text-sm font-black text-brand-text-main uppercase tracking-widest ml-1">
                  {t('exams.examDate', 'Date')} *
                </label>
                <input
                  type="date"
                  className="w-full h-12 px-4 bg-brand-bg-page/50 border border-brand-border rounded-2xl text-sm font-bold text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-green/20"
                  {...register('date')}
                />
                {errors.date && <p className="text-rose-500 text-xs mt-1">{errors.date.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-black text-brand-text-main uppercase tracking-widest ml-1">
                    {t('exams.startTime', 'Start Time')} *
                  </label>
                  <input
                    type="time"
                    className="w-full h-12 px-4 bg-brand-bg-page/50 border border-brand-border rounded-2xl text-sm font-bold text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-green/20"
                    {...register('startTime')}
                  />
                  {errors.startTime && <p className="text-rose-500 text-xs mt-1">{errors.startTime.message}</p>}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-black text-brand-text-main uppercase tracking-widest ml-1">
                    {t('exams.endTime', 'End Time')} *
                  </label>
                  <input
                    type="time"
                    className="w-full h-12 px-4 bg-brand-bg-page/50 border border-brand-border rounded-2xl text-sm font-bold text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-green/20"
                    {...register('endTime')}
                  />
                  {errors.endTime && <p className="text-rose-500 text-xs mt-1">{errors.endTime.message}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-black text-brand-text-main uppercase tracking-widest ml-1">
                  {t('exams.durationMinutes', 'Duration (minutes)')} *
                </label>
                <input
                  type="number"
                  min={1}
                  className="w-full h-12 px-4 bg-brand-bg-page/50 border border-brand-border rounded-2xl text-sm font-bold text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-green/20"
                  {...register('durationMinutes')}
                />
                {errors.durationMinutes && (
                  <p className="text-rose-500 text-xs mt-1">{errors.durationMinutes.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-black text-brand-text-main uppercase tracking-widest ml-1">
                  {t('exams.room', 'Location / Room')}
                </label>
                <input
                  placeholder={t('exams.roomPlaceholder', 'e.g. Hall 4, Room 302')}
                  className="w-full h-12 px-4 bg-brand-bg-page/50 border border-brand-border rounded-2xl text-sm font-bold text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-green/20"
                  {...register('room')}
                />
                {errors.room && <p className="text-rose-500 text-xs mt-1">{errors.room.message}</p>}
              </div>
            </div>
          </Card>

          <div className="p-6 rounded-[2rem] bg-brand-navy text-white relative overflow-hidden group shadow-xl">
            <div className="relative z-10">
              <h4 className="font-black text-sm uppercase tracking-wider flex items-center gap-2">
                <Info size={16} className="text-brand-green" /> {t('exams.schedulingNote', 'Scheduling Note')}
              </h4>
              <p className="text-xs text-brand-gray/80 mt-2 font-bold leading-relaxed">
                {t('exams.schedulingNoteBody', 'Ensure there are no schedule conflicts for the selected room and course before saving.')}
              </p>
            </div>
            <div className="absolute -right-4 -bottom-4 text-white/5 rotate-12">
              <CalendarIcon size={80} />
            </div>
          </div>

          <Button
            type="submit"
            disabled={isSubmitting || coursesLoading}
            className="w-full h-14 rounded-2xl shadow-xl shadow-brand-green/20 text-lg"
          >
            {isSubmitting ? <Loader2 className="animate-spin mx-auto" size={24} /> : (
              <span className="flex items-center justify-center gap-2">
                <Save size={20} /> {t('exams.saveExam', 'Save Exam Schedule')}
              </span>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default CreateExam;
