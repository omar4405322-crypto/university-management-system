// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { 
  X, 
  Save, 
  Loader2, 
  AlertCircle, 
  Plus, 
  Trash2, 
  Clock, 
  User, 
  MapPin, 
  BookOpen,
  Building2
} from 'lucide-react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Input from '../../components/ui/input';
import collegeService from '../../services/college.service';
import departmentService from '../../services/department.service';
import timetableService from '../../services/timetable.service';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';

const schema = z.object({
  collegeId: z.string().min(1, 'College is required'),
  departmentId: z.string().min(1, 'Department is required'),
  academicYear: z.string().min(1, 'Academic Year is required'),
  semester: z.string().min(1, 'Semester is required'),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  status: z.string().min(1, 'Status is required')
});

type FormData = z.infer<typeof schema>;

const TimetableModal = ({ isOpen, onClose, timetable, onSuccess }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isCollegeAdmin = user?.role === 'COLLEGE_ADMIN';
  const managedCollegeId = user?.managedCollegeId;
  const managedCollegeName = user?.managedCollege?.name;
  const [colleges, setColleges] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [error, setError] = useState('');

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      collegeId: '',
      departmentId: '',
      academicYear: '1',
      semester: '1',
      title: '',
      description: '',
      status: 'DRAFT'
    }
  });

  const watchCollegeId = watch('collegeId');

  // Set collegeId when modal opens for COLLEGE_ADMIN, and fetch colleges for others
  useEffect(() => {
    if (isOpen) {
      if (isCollegeAdmin && managedCollegeId) {
        setValue('collegeId', managedCollegeId.toString());
      } else {
        fetchColleges();
      }
    }
  }, [isOpen, isCollegeAdmin, managedCollegeId, setValue]);

  // Fetch departments when collegeId changes
  useEffect(() => {
    if (watchCollegeId) {
      fetchDepartments(watchCollegeId);
    }
  }, [watchCollegeId]);

  // Handle timetable editing
  useEffect(() => {
    if (isOpen && timetable) {
      reset({
        ...timetable,
        collegeId: (timetable.collegeId || '').toString(),
        departmentId: (timetable.departmentId || '').toString(),
        academicYear: (timetable.academicYear || '1').toString(),
        semester: (timetable.semester || '1').toString(),
        title: timetable.title || '',
        description: timetable.description || '',
        status: timetable.status || 'DRAFT'
      });
    } else if (isOpen && !timetable && !isCollegeAdmin) {
      reset({
        collegeId: '',
        departmentId: '',
        academicYear: '1',
        semester: '1',
        title: '',
        description: '',
        status: 'DRAFT'
      });
      setError('');
    }
  }, [isOpen, timetable, isCollegeAdmin, reset]);

  const fetchColleges = async () => {
    try {
      const res = await collegeService.getColleges();
      if (res.success) {
        setColleges(Array.isArray(res.data) ? res.data : []);
      }
    } catch (err) {
      console.error(err);
      setColleges([]);
    }
  };

  const fetchDepartments = async (collegeId) => {
    try {
      const res = await departmentService.getDepartments({ collegeId });
      if (res.success) {
        setDepartments(Array.isArray(res.data) ? res.data : []);
      }
    } catch (err) {
      console.error(err);
      setDepartments([]);
    }
  };

  const onSubmit = async (data: FormData) => {
    setError('');

    try {
      // Create a clean copy for the API
      const payload = {
        collegeId: parseInt(data.collegeId),
        departmentId: parseInt(data.departmentId),
        academicYear: parseInt(data.academicYear),
        semester: parseInt(data.semester),
        title: data.title,
        description: data.description || '',
        status: data.status
      };

      if (timetable) {
        await timetableService.updateTimetable(timetable.id, payload);
        onSuccess(timetable);
      } else {
        const created = await timetableService.createTimetable(payload);
        onSuccess(created.data || created);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || t('common.errorOccurred'));
    }
  };

  const SELECT_CLASS = WatchCollegeId =>
    "w-full h-11 px-4 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm font-semibold text-brand-text-primary dark:text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 focus:border-brand-primary-500 transition-all cursor-pointer disabled:opacity-50";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={timetable ? t('timetables.edit') : t('timetables.create')}
      subtitle={t('timetables.subtitle')}
      size="xl"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {error && (
          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-sm font-bold flex items-center gap-2">
            <AlertCircle size={18} /> {error}
          </div>
        )}

        {/* Basic Info Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-700 pb-2">
              {t('common.basicInfo')}
            </h3>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{t('timetables.selectFaculty')} *</label>
                {isCollegeAdmin ? (
                  <div className="w-full h-11 px-4 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl flex items-center gap-3">
                    <Building2 size={20} className="text-brand-primary-500" />
                    <span className="font-semibold text-brand-text-primary dark:text-brand-text-main text-sm">
                      {managedCollegeName || t('timetables.yourCollege')}
                    </span>
                  </div>
                ) : (
                  <select
                    className={SELECT_CLASS(true)}
                    {...register('collegeId', {
                      onChange: (e) => {
                        setValue('departmentId', '');
                        fetchDepartments(e.target.value);
                      }
                    })}
                  >
                    <option value="">{t('timetables.selectFaculty')}</option>
                    {colleges.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                )}
                {errors.collegeId && <p className="text-rose-500 text-xs mt-1">{errors.collegeId.message}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{t('timetables.selectDept')} *</label>
                <select
                  className={SELECT_CLASS(true)}
                  {...register('departmentId')}
                  disabled={!watchCollegeId}
                >
                  <option value="">{t('timetables.selectDept')}</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                {errors.departmentId && <p className="text-rose-500 text-xs mt-1">{errors.departmentId.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{t('timetables.academicYear')} *</label>
                  <select
                    className={SELECT_CLASS(true)}
                    {...register('academicYear')}
                  >
                    {[1, 2, 3, 4, 5].map(y => <option key={y} value={y}>{t('auth.year')} {y}</option>)}
                  </select>
                  {errors.academicYear && <p className="text-rose-500 text-xs mt-1">{errors.academicYear.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{t('timetables.semester')} *</label>
                  <select
                    className={SELECT_CLASS(true)}
                    {...register('semester')}
                  >
                    <option value="1">{t('schedule.semester1', 'Semester 1')}</option>
                    <option value="2">{t('schedule.semester2', 'Semester 2')}</option>
                    <option value="3">{t('schedule.semester3', 'Summer Semester')}</option>
                  </select>
                  {errors.semester && <p className="text-rose-500 text-xs mt-1">{errors.semester.message}</p>}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-700 pb-2">
              {t('timetables.details')}
            </h3>
            <div className="space-y-4">
              <div>
                <Input
                  label={t('common.title') + " *"}
                  placeholder={t('timetables.titlePlaceholder', 'e.g. CS Year 2 - Fall 2026')}
                  {...register('title')}
                />
                {errors.title && <p className="text-rose-500 text-xs mt-1">{errors.title.message}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{t('common.description')}</label>
                <textarea
                  className="w-full p-4 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm font-semibold text-brand-text-primary dark:text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 focus:border-brand-primary-500 transition-all min-h-[80px]"
                  placeholder={t('timetables.notesPlaceholder', 'Notes...')}
                  {...register('description')}
                />
                {errors.description && <p className="text-rose-500 text-xs mt-1">{errors.description.message}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{t('finance.status')}</label>
                <select
                  className={SELECT_CLASS(true)}
                  {...register('status')}
                >
                  <option value="DRAFT">{t('timetables.draft')}</option>
                  <option value="PUBLISHED">{t('timetables.published')}</option>
                </select>
                {errors.status && <p className="text-rose-500 text-xs mt-1">{errors.status.message}</p>}
              </div>
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-3">
          <Button type="button" variant="ghost" className="rounded-xl font-bold" onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" disabled={isSubmitting} className="min-w-[140px] bg-brand-primary-500 hover:bg-brand-primary-600 text-white font-bold rounded-xl active:scale-95 transition-all flex items-center justify-center gap-2 shadow-md shadow-brand-primary-500/10 hover:shadow-lg">
            {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : (
              <span className="flex items-center gap-2">
                <Save size={18} /> {timetable ? t('common.update') : t('common.save')}
              </span>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default TimetableModal;
