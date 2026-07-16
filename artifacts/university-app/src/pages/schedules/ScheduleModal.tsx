// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { X, Clock, MapPin, BookOpen, Calendar, AlertCircle, Users, User } from 'lucide-react';
import Button from '../../components/ui/Button';
import schedulesService from '../../services/schedules.service';
import studentGroupsService from '../../services/studentGroups.service';
import teachingAssistantsService from '../../services/teachingAssistants.service';
import { useLanguage } from '../../context/LanguageContext';
import InstructorSelector from '../../components/timetable/InstructorSelector';

const schema = z.object({
  courseId: z.string().min(1, 'Course is required'),
  groupId: z.string().min(1, 'Group is required'),
  doctorId: z.string().min(1, 'Doctor is required'),
  slotType: z.string().min(1, 'Slot Type is required'),
  slotType: z.string().min(1, 'Session Type is required'),
  teachingAssistantId: z.string().optional(),
  dayOfWeek: z.string().min(1, 'Day of week is required'),
  startTime: z.string().min(1, 'Start time is required'),
  endTime: z.string().min(1, 'End time is required'),
  room: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const ScheduleModal = ({ isOpen, onClose, schedule, courses, onSuccess }) => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const [error, setError] = useState(null);
  
  const [groups, setGroups] = useState([]);
  const [tas, setTas] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(false);

  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      courseId: '',
      groupId: '',
      doctorId: '',
      slotType: 'LECTURE',
      slotType: 'LECTURE',
      teachingAssistantId: '',
      dayOfWeek: 'MONDAY',
      startTime: '08:00',
      endTime: '10:00',
      room: ''
    }
  });

  const selectedCourseId = watch('courseId');
  const watchedSlotType = watch('slotType');

  const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const slotTypes = ['LECTURE', 'SECTION', 'LAB'];


  // Fetch groups when courseId changes
  useEffect(() => {
    if (!selectedCourseId || !courses) {
      setGroups([]);
      return;
    }
    
    const course = courses.find((c: any) => c.id.toString() === selectedCourseId);
    const departmentId = course?.departmentId || course?.department?.id;
    if (!departmentId) return;

    const fetchGroups = async () => {
      setLoadingGroups(true);
      try {
        const res = await studentGroupsService.getDepartmentGroups(departmentId);
        if (res.success) {
          setGroups(res.data?.groups || res.data || []);
        }
      } catch (err) {
        console.error('Failed to load groups', err);
      } finally {
        setLoadingGroups(false);
      }
    };
    fetchGroups();
  }, [selectedCourseId, courses]);

  // Fetch TAs once
  useEffect(() => {
    if (isOpen) {
      teachingAssistantsService.getTeachingAssistants()
        .then(res => {
          if (res.success) setTas(res.data?.teachingAssistants || res.data || []);
        })
        .catch(err => console.error(err));
    }
  }, [isOpen]);

  useEffect(() => {
    if (schedule) {
      reset({
        courseId: schedule.courseId?.toString() || '',
        groupId: schedule.groupId?.toString() || '',
        doctorId: schedule.doctorId?.toString() || '',
        slotType: schedule.slotType || 'LECTURE',
        slotType: schedule.slotType || 'LECTURE',
        teachingAssistantId: schedule.teachingAssistantId?.toString() || '',
        dayOfWeek: schedule.dayOfWeek,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        room: schedule.room || ''
      });
      
      if (schedule.group) {
        setGroups([schedule.group]);
      }
    } else {
      reset({
        courseId: '',
        groupId: '',
        doctorId: '',
        slotType: 'LECTURE',
        slotType: 'LECTURE',
        teachingAssistantId: '',
        dayOfWeek: 'MONDAY',
        startTime: '08:00',
        endTime: '10:00',
        room: ''
      });
      setGroups([]);
    }
    setError(null);
  }, [schedule, isOpen, reset]);

  const onSubmit = async (data: FormData) => {
    setError(null);

    // Prepare payload
    const payload = {
      ...data,
      courseId: parseInt(data.courseId),
      groupId: parseInt(data.groupId),
      doctorId: parseInt(data.doctorId),
      slotType: data.slotType,
      teachingAssistantId: data.teachingAssistantId ? parseInt(data.teachingAssistantId) : null
    };

    try {
      let result;
      if (schedule) {
        result = await schedulesService.updateSchedule(schedule.id, payload);
      } else {
        result = await schedulesService.createSchedule(payload);
      }

      if (result.success) {
        onSuccess();
      } else {
        setError(result.message);
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || t('SCHEDULES.conflictError', 'Conflict detected');
      setError(msg);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/10">
          <h2 className="text-lg font-bold text-brand-text-primary dark:text-brand-text-main">
            {schedule ? t('SCHEDULES.EDIT_TITLE', 'Edit Schedule') : t('SCHEDULES.CREATE_TITLE', 'Create New Schedule')}
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {error && (
            <div className="p-4 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-xl text-sm flex items-start gap-3 border border-rose-200 dark:border-rose-500/20">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <div className="flex flex-col">
                <span className="font-bold">{t('SCHEDULES.conflictError', 'Conflict detected')}</span>
                <span>{error}</span>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-brand-text-primary dark:text-brand-text-main flex items-center gap-2">
              <BookOpen size={14} className="text-slate-400" /> {t('courses.course', 'Course')}
            </label>
            <select
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 text-brand-text-primary dark:text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 focus:border-brand-primary-500 transition-all cursor-pointer text-sm"
              {...register('courseId')}
              onChange={(e) => {
                setValue('courseId', e.target.value);
                setValue('groupId', ''); // reset group
                setValue('doctorId', ''); // reset doctor
              }}
              disabled={!!schedule}
            >
              <option value="">{t('courses.selectCourse', 'Select a course')}</option>
              {courses.map((course: any) => (
                <option key={course.id} value={course.id}>
                  {course.courseCode} - {isRTL ? course.nameAr || course.name : course.name}
                </option>
              ))}
            </select>
            {errors.courseId && <p className="text-rose-500 text-xs mt-1">{errors.courseId.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-brand-text-primary dark:text-brand-text-main flex items-center gap-2">
              <Users size={14} className="text-slate-400" /> {t('common.group', 'Group')}
            </label>
            <select
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 text-brand-text-primary dark:text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 focus:border-brand-primary-500 transition-all cursor-pointer text-sm disabled:opacity-50"
              {...register('groupId')}
              disabled={!selectedCourseId || loadingGroups}
            >
              <option value="">
                {loadingGroups ? t('common.loading', 'Loading...') : t('common.selectGroup', 'Select Group')}
              </option>
              {groups.map((g: any) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            {errors.groupId && <p className="text-rose-500 text-xs mt-1">{errors.groupId.message}</p>}
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-brand-text-primary dark:text-brand-text-main flex items-center gap-2">
                <BookOpen size={14} className="text-slate-400" /> {t('SCHEDULES.slotType', 'Slot Type')}
              </label>
              <select
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 text-brand-text-primary dark:text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 focus:border-brand-primary-500 transition-all cursor-pointer text-sm"
                {...register('slotType')}
              >
                {slotTypes.map(st => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
              {errors.slotType && <p className="text-rose-500 text-xs mt-1">{errors.slotType.message}</p>}
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-brand-text-primary dark:text-brand-text-main flex items-center gap-2">
                <Calendar size={14} className="text-slate-400" /> {t('timetables.day', 'Day of Week')}
              </label>
              <select
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 text-brand-text-primary dark:text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 focus:border-brand-primary-500 transition-all cursor-pointer text-sm"
                {...register('dayOfWeek')}
              >
                {days.map(day => (
                  <option key={day} value={day}>{t(`days.${day.toLowerCase()}`, day)}</option>
                ))}
              </select>
              {errors.dayOfWeek && <p className="text-rose-500 text-xs mt-1">{errors.dayOfWeek.message}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-brand-text-primary dark:text-brand-text-main flex items-center gap-2">
              <BookOpen size={14} className="text-slate-400" /> {t('SCHEDULES.slotType', 'Session Type')}
            </label>
            <select
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 text-brand-text-primary dark:text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 focus:border-brand-primary-500 transition-all cursor-pointer text-sm"
              {...register('slotType')}
            >
              {slotTypes.map(st => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
            {errors.slotType && <p className="text-rose-500 text-xs mt-1">{errors.slotType.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-brand-text-primary dark:text-brand-text-main flex items-center gap-2">
                <Clock size={14} className="text-slate-400" /> {t('timetables.startTime', 'Start Time')}
              </label>
              <input
                type="time"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 text-brand-text-primary dark:text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 focus:border-brand-primary-500 transition-all text-sm"
                {...register('startTime')}
              />
              {errors.startTime && <p className="text-rose-500 text-xs mt-1">{errors.startTime.message}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-brand-text-primary dark:text-brand-text-main flex items-center gap-2">
                <Clock size={14} className="text-slate-400" /> {t('timetables.endTime', 'End Time')}
              </label>
              <input
                type="time"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 text-brand-text-primary dark:text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 focus:border-brand-primary-500 transition-all text-sm"
                {...register('endTime')}
              />
              {errors.endTime && <p className="text-rose-500 text-xs mt-1">{errors.endTime.message}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-brand-text-primary dark:text-brand-text-main flex items-center gap-2">
              <MapPin size={14} className="text-slate-400" /> {t('SCHEDULES.room', 'Room / Location')}
            </label>
            <input
              type="text"
              placeholder={t('timetables.roomPlaceholder', 'e.g. Hall 302, Lab 105')}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 text-brand-text-primary dark:text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 focus:border-brand-primary-500 transition-all text-sm"
              {...register('room')}
            />
            {errors.room && <p className="text-rose-500 text-xs mt-1">{errors.room.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-brand-text-primary dark:text-brand-text-main flex items-center gap-2">
              <User size={14} className="text-slate-400" /> {t('courses.instructor', 'Instructor')}
            </label>
            <InstructorSelector
              courseId={selectedCourseId}
              slotType="LECTURE"
              value={watch('doctorId') || ''}
              onChange={(val) => setValue('doctorId', val)}
              isRTL={isRTL}
              useIdAsValue={true}
              disabled={!selectedCourseId}
            />
            {errors.doctorId && <p className="text-rose-500 text-xs mt-1">{errors.doctorId.message}</p>}
          </div>

          {watchedSlotType !== 'LECTURE' && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-brand-text-primary dark:text-brand-text-main flex items-center gap-2">
                <User size={14} className="text-slate-400" /> {t('schedule.ta', 'Teaching Assistant')}
              </label>
              <InstructorSelector
                courseId={selectedCourseId}
                slotType={watchedSlotType || 'LAB'}
                value={watch('teachingAssistantId') || ''}
                onChange={(val) => setValue('teachingAssistantId', val)}
                isRTL={isRTL}
                useIdAsValue={true}
                fallbackOptions={tas}
                disabled={!selectedCourseId}
              />
            </div>
          )}

          <div className="flex items-center gap-3 pt-4">
            <Button type="button" variant="ghost" className="flex-1 rounded-xl text-xs font-semibold" onClick={onClose}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button 
              type="submit" 
              className="flex-1 bg-brand-primary-500 hover:bg-brand-primary-600 active:scale-95 text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed" 
              loading={isSubmitting}
            >
              {schedule ? t('common.update', 'Update Schedule') : t('SCHEDULES.CREATE', 'Create Schedule')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ScheduleModal;