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
import Button from '../../components/ui/button';
import Input from '../../components/ui/input';
import { DEFAULT_ANTI_CHEAT_SETTINGS } from './examUtils';

const parseTimeToMinutes = (time: string | undefined) => {
  if (!time) return null;
  const [h, m] = time.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
};

const schema = z.object({
  courseId: z.string().min(1, 'Please select a course'),
  title: z.string().optional(),
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
  const [courses, setCourses] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      courseId: '',
      title: '',
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

  const [antiCheatEnabled, setAntiCheatEnabled] = useState(DEFAULT_ANTI_CHEAT_SETTINGS.antiCheatEnabled);
  const [maxLeavesBeforeCancel, setMaxLeavesBeforeCancel] = useState(DEFAULT_ANTI_CHEAT_SETTINGS.maxLeavesBeforeCancel);
  const [leaveGraceSeconds, setLeaveGraceSeconds] = useState(DEFAULT_ANTI_CHEAT_SETTINGS.leaveGraceSeconds);
  const [leaveWarningMessage, setLeaveWarningMessage] = useState('');
  const [shuffleQuestions, setShuffleQuestions] = useState(DEFAULT_ANTI_CHEAT_SETTINGS.shuffleQuestions);
  const [requireGeolocation, setRequireGeolocation] = useState(DEFAULT_ANTI_CHEAT_SETTINGS.requireGeolocation);
  const [blockMultipleTabs, setBlockMultipleTabs] = useState(DEFAULT_ANTI_CHEAT_SETTINGS.blockMultipleTabs);
  const [enableGeofencing, setEnableGeofencing] = useState(false);
  const [allowedLat, setAllowedLat] = useState<string>('');
  const [allowedLng, setAllowedLng] = useState<string>('');
  const [allowedRadiusMeters, setAllowedRadiusMeters] = useState<number>(200);

  const onSubmit = async (data: FormData) => {
    setError('');
    try {
      const payload = {
        courseId: data.courseId,
        title: data.title ? data.title.trim() : undefined,
        type: data.type,
        date: data.date,
        startTime: data.startTime,
        endTime: data.endTime,
        durationMinutes: data.durationMinutes,
        room: data.room ? data.room.trim() : 'TBA',
        antiCheatEnabled,
        maxLeavesBeforeCancel,
        leaveGraceSeconds,
        leaveWarningMessage: leaveWarningMessage.trim() || undefined,
        shuffleQuestions,
        requireGeolocation: requireGeolocation || enableGeofencing,
        blockMultipleTabs,
        enableGeofencing,
        allowedLat: allowedLat ? parseFloat(allowedLat) : null,
        allowedLng: allowedLng ? parseFloat(allowedLng) : null,
        allowedRadiusMeters,
      };
      const result = await examsService.createExam(payload);
      if (result.success) {
        setSuccess(true);
        setTimeout(() => navigate('/exams'), 1500);
      } else {
        setError(result.message || 'Failed to create exam');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || err.message || 'Error creating exam');
    }
  };

  return (
    <div className="section-gap animate-in fade-in duration-500">
      <div className="flex items-center justify-between gap-4 mb-6">
        <button
          onClick={() => navigate('/exams')}
          className="flex items-center gap-2 text-brand-text-muted hover:text-brand-text-main font-bold text-xs uppercase tracking-widest transition-colors"
        >
          <ChevronLeft size={16} />
          {t('common.backToExams', 'Back to Exams')}
        </button>

        <h1 className="heading-1 m-0">{t('exams.createTitle', 'Create New Exam')}</h1>
      </div>

      {success && (
        <div className="p-4 rounded-2xl bg-emerald-500 text-white flex items-center gap-3">
          <CheckCircle2 size={24} />
          <p className="font-bold">{t('exams.createSuccess', 'Exam created successfully! Redirecting...')}</p>
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
          <Card>
            <h3 className="text-lg font-black text-brand-text-main mb-2">{t('exams.basicInfo', 'Basic Information')}</h3>
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
                  {courses.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.courseCode} - {c.name}</option>
                  ))}
                </select>
                {errors.courseId && <p className="text-rose-500 text-xs mt-1">{errors.courseId.message}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-black text-brand-text-main uppercase tracking-widest ml-1">
                  {t('exams.customTypeLabel', 'مسمى / نوع الامتحان المخصص')}
                </label>
                <input
                  type="text"
                  placeholder={t('exams.customTypePlaceholder', 'اكتب مسمى الامتحان (مثال: اختبار شهر أكتوبر، امتحان عملي...)')}
                  className="w-full h-12 px-4 bg-brand-bg-page/50 border border-brand-border rounded-2xl text-sm font-bold text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-green/20 transition-all placeholder:font-medium placeholder:text-slate-400"
                  {...register('title')}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-black text-brand-text-main uppercase tracking-widest ml-1">
                  {t('exams.examTypeCategory', 'فئة الامتحان (التصنيف العام)')} *
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
          <Card>
            <h3 className="text-lg font-black text-brand-text-main mb-2">{t('exams.timingLocation', 'Timing & Location')}</h3>
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
