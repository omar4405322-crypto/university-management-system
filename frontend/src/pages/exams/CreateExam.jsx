// FIXED: Exam create uses room field (matches database schema)
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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

const CreateExam = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [courses, setCourses] = useState([]);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    courseId: '',
    type: 'MIDTERM',
    date: '',
    startTime: '09:00',
    endTime: '11:00',
    durationMinutes: 120,
    room: '',
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

  const syncDurationFromTimes = (startTime, endTime) => {
    const start = parseTimeToMinutes(startTime);
    const end = parseTimeToMinutes(endTime);
    if (start != null && end != null && end > start) {
      return end - start;
    }
    return null;
  };

  const handleStartTimeChange = (startTime) => {
    const duration = formData.durationMinutes;
    const start = parseTimeToMinutes(startTime);
    let endTime = formData.endTime;
    if (start != null && duration > 0) {
      const total = start + Number(duration);
      const h = Math.floor(total / 60) % 24;
      const m = total % 60;
      endTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
    setFormData((prev) => ({ ...prev, startTime, endTime }));
    setFieldErrors((prev) => ({ ...prev, startTime: '', endTime: '', durationMinutes: '' }));
  };

  const handleDurationChange = (durationMinutes) => {
    const duration = Math.max(1, parseInt(durationMinutes, 10) || 0);
    const start = parseTimeToMinutes(formData.startTime);
    let endTime = formData.endTime;
    if (start != null) {
      const total = start + duration;
      const h = Math.floor(total / 60) % 24;
      const m = total % 60;
      endTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
    setFormData((prev) => ({ ...prev, durationMinutes: duration, endTime }));
    setFieldErrors((prev) => ({ ...prev, durationMinutes: '', endTime: '' }));
  };

  const handleEndTimeChange = (endTime) => {
    const duration = syncDurationFromTimes(formData.startTime, endTime);
    setFormData((prev) => ({
      ...prev,
      endTime,
      durationMinutes: duration ?? prev.durationMinutes,
    }));
    setFieldErrors((prev) => ({ ...prev, endTime: '', durationMinutes: '' }));
  };

  const validate = () => {
    const errors = {};
    if (!formData.courseId) {
      errors.courseId = t('exams.courseRequired', 'Please select a course');
    }
    if (!formData.date) {
      errors.date = t('exams.dateRequired', 'Exam date is required');
    }
    if (!formData.startTime) {
      errors.startTime = t('exams.startTimeRequired', 'Start time is required');
    }
    if (!formData.endTime) {
      errors.endTime = t('exams.endTimeRequired', 'End time is required');
    }
    const start = parseTimeToMinutes(formData.startTime);
    const end = parseTimeToMinutes(formData.endTime);
    if (start != null && end != null && end <= start) {
      errors.endTime = t('exams.endAfterStart', 'End time must be after start time');
    }
    if (!formData.durationMinutes || formData.durationMinutes < 1) {
      errors.durationMinutes = t('exams.durationRequired', 'Duration must be at least 1 minute');
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setError('');
    try {
      const payload = {
        courseId: formData.courseId,
        type: formData.type,
        date: formData.date,
        startTime: formData.startTime,
        endTime: formData.endTime,
        room: formData.room.trim() || 'TBA',
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
    } finally {
      setLoading(false);
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
          <ChevronLeft size={24} />
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

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card title={t('exams.basicInfo', 'Basic Information')} borderLeft={false}>
            <div className="space-y-6 pt-2">
              <div className="space-y-2">
                <label className="text-sm font-black text-brand-text-main uppercase tracking-widest ml-1">
                  {t('exams.selectCourse', 'Course')} *
                </label>
                <select
                  required
                  disabled={coursesLoading}
                  className="w-full h-12 px-4 bg-brand-bg-page/50 border border-brand-border rounded-2xl text-sm font-bold text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-green/20 transition-all appearance-none cursor-pointer disabled:opacity-50"
                  value={formData.courseId}
                  onChange={(e) => setFormData({ ...formData, courseId: e.target.value })}
                >
                  <option value="">{coursesLoading ? t('common.loading') : t('exams.chooseCourse', 'Choose a course')}</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>{c.courseCode} - {c.name}</option>
                  ))}
                </select>
                {fieldErrors.courseId && <p className="text-xs text-rose-500 font-bold">{fieldErrors.courseId}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-black text-brand-text-main uppercase tracking-widest ml-1">
                  {t('exams.examType', 'Exam Type')} *
                </label>
                <select
                  required
                  className="w-full h-12 px-4 bg-brand-bg-page/50 border border-brand-border rounded-2xl text-sm font-bold text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-green/20 transition-all appearance-none cursor-pointer"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                >
                  <option value="MIDTERM">{t('exams.typeMidterm', 'Midterm')}</option>
                  <option value="FINAL">{t('exams.typeFinal', 'Final')}</option>
                  <option value="QUIZ">{t('exams.typeQuiz', 'Quiz')}</option>
                </select>
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
                <Input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
                {fieldErrors.date && <p className="text-xs text-rose-500 font-bold">{fieldErrors.date}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-black text-brand-text-main uppercase tracking-widest ml-1">
                    {t('exams.startTime', 'Start Time')} *
                  </label>
                  <Input
                    type="time"
                    required
                    value={formData.startTime}
                    onChange={(e) => handleStartTimeChange(e.target.value)}
                  />
                  {fieldErrors.startTime && <p className="text-xs text-rose-500 font-bold">{fieldErrors.startTime}</p>}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-black text-brand-text-main uppercase tracking-widest ml-1">
                    {t('exams.endTime', 'End Time')} *
                  </label>
                  <Input
                    type="time"
                    required
                    value={formData.endTime}
                    onChange={(e) => handleEndTimeChange(e.target.value)}
                  />
                  {fieldErrors.endTime && <p className="text-xs text-rose-500 font-bold">{fieldErrors.endTime}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-black text-brand-text-main uppercase tracking-widest ml-1">
                  {t('exams.durationMinutes', 'Duration (minutes)')} *
                </label>
                <Input
                  type="number"
                  min={1}
                  required
                  value={formData.durationMinutes}
                  onChange={(e) => handleDurationChange(e.target.value)}
                />
                {fieldErrors.durationMinutes && (
                  <p className="text-xs text-rose-500 font-bold">{fieldErrors.durationMinutes}</p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-black text-brand-text-main uppercase tracking-widest ml-1">
                  {t('exams.room', 'Location / Room')}
                </label>
                <Input
                  placeholder={t('exams.roomPlaceholder', 'e.g. Hall 4, Room 302')}
                  value={formData.room}
                  onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                />
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
            disabled={loading || coursesLoading}
            className="w-full h-14 rounded-2xl shadow-xl shadow-brand-green/20 text-lg"
          >
            {loading ? <Loader2 className="animate-spin mx-auto" size={24} /> : (
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
