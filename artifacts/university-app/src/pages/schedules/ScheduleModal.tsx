import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { X, Clock, MapPin, BookOpen, Calendar, AlertCircle } from 'lucide-react';
import Button from '../../components/ui/Button';
import schedulesService from '../../services/schedules.service';

const schema = z.object({
  courseId: z.string().min(1, 'Course is required'),
  dayOfWeek: z.string().min(1, 'Day of week is required'),
  startTime: z.string().min(1, 'Start time is required'),
  endTime: z.string().min(1, 'End time is required'),
  room: z.string().optional()
});

type FormData = z.infer<typeof schema>;

const ScheduleModal = ({ isOpen, onClose, schedule, courses, onSuccess }) => {
  const { t } = useTranslation();
  const [error, setError] = useState(null);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      courseId: '',
      dayOfWeek: 'Monday',
      startTime: '08:00',
      endTime: '10:00',
      room: ''
    }
  });

  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  useEffect(() => {
    if (schedule) {
      reset({
        courseId: schedule.courseId,
        dayOfWeek: schedule.dayOfWeek,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        room: schedule.room || ''
      });
    } else {
      reset({
        courseId: '',
        dayOfWeek: 'Monday',
        startTime: '08:00',
        endTime: '10:00',
        room: ''
      });
    }
    setError(null);
  }, [schedule, isOpen, reset]);

  const onSubmit = async (data) => {
    setError(null);

    try {
      let result;
      if (schedule) {
        result = await schedulesService.updateSchedule(schedule.id, data);
      } else {
        result = await schedulesService.createSchedule(data);
      }

      if (result.success) {
        onSuccess();
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError(err.response?.data?.message || t('common.errorOccurred', 'Something went wrong'));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-navy-500/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-brand-bg-card rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b border-brand-border">
          <h2 className="text-xl font-bold text-brand-text-primary">
            {schedule ? t('SCHEDULES.EDIT_TITLE', 'Edit Schedule') : t('SCHEDULES.CREATE_TITLE', 'Create New Schedule')}
          </h2>
          <button onClick={onClose} className="p-2 text-brand-text-muted hover:text-brand-text-secondary rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 form-section">
          {error && (
            <div className="p-3 bg-error/10 text-error rounded-xl text-sm flex items-center gap-2 border border-error/20">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-brand-text-primary flex items-center gap-2">
              <BookOpen size={14} className="text-brand-text-muted" /> {t('courses.course', 'Course')}
            </label>
            <select
              className="w-full px-4 py-2 rounded-xl border border-brand-border focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 focus:border-brand-primary-500 transition-all bg-brand-bg-card"
              {...register('courseId')}
              disabled={!!schedule}
            >
              <option value="">{t('courses.selectCourse', 'Select a course')}</option>
              {courses.map(course => (
                <option key={course.id} value={course.id}>
                  {course.courseCode} - {course.name}
                </option>
              ))}
            </select>
            {errors.courseId && <p className="text-rose-500 text-xs mt-1">{errors.courseId.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-brand-text-primary flex items-center gap-2">
              <Calendar size={14} className="text-brand-text-muted" /> {t('timetables.day', 'Day of Week')}
            </label>
            <select
              className="w-full px-4 py-2 rounded-xl border border-brand-border focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 focus:border-brand-primary-500 transition-all bg-brand-bg-card"
              {...register('dayOfWeek')}
            >
              {days.map(day => (
                <option key={day} value={day}>{t(`days.${day.toLowerCase()}`, day)}</option>
              ))}
            </select>
            {errors.dayOfWeek && <p className="text-rose-500 text-xs mt-1">{errors.dayOfWeek.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-brand-text-primary flex items-center gap-2">
                <Clock size={14} className="text-brand-text-muted" /> {t('timetables.startTime', 'Start Time')}
              </label>
              <input
                type="time"
                className="w-full px-4 py-2 rounded-xl border border-brand-border focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 focus:border-brand-primary-500 transition-all"
                {...register('startTime')}
              />
              {errors.startTime && <p className="text-rose-500 text-xs mt-1">{errors.startTime.message}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-brand-text-primary flex items-center gap-2">
                <Clock size={14} className="text-brand-text-muted" /> {t('timetables.endTime', 'End Time')}
              </label>
              <input
                type="time"
                className="w-full px-4 py-2 rounded-xl border border-brand-border focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 focus:border-brand-primary-500 transition-all"
                {...register('endTime')}
              />
              {errors.endTime && <p className="text-rose-500 text-xs mt-1">{errors.endTime.message}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-brand-text-primary flex items-center gap-2">
              <MapPin size={14} className="text-brand-text-muted" /> {t('timetables.room', 'Room / Location')}
            </label>
            <input
              type="text"
              placeholder={t('timetables.roomPlaceholder', 'e.g. Hall 302, Lab 105')}
              className="w-full px-4 py-2 rounded-xl border border-brand-border focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 focus:border-brand-primary-500 transition-all"
              {...register('room')}
            />
            {errors.room && <p className="text-rose-500 text-xs mt-1">{errors.room.message}</p>}
          </div>

          <div className="flex items-center gap-3 pt-4">
            <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button type="submit" className="flex-1" loading={isSubmitting}>
              {schedule ? t('common.update', 'Update Schedule') : t('SCHEDULES.CREATE', 'Create Schedule')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ScheduleModal;