import React, { useState, useEffect } from 'react';
import coursesService from '../../services/courses.service';
import doctorsService from '../../services/doctors.service';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useTranslation } from 'react-i18next';
import { BookOpen, User, Hash, FileText, Users, CreditCard, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  courseCode: z.string().min(1, 'Course Code is required'),
  name: z.string().min(1, 'Course Name is required'),
  description: z.string().optional(),
  credits: z.coerce.number().min(1, 'Credits must be at least 1').max(10, 'Credits must be at most 10'),
  maxStudents: z.coerce.number().min(1, 'Max students must be at least 1'),
  doctorId: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const AddCourseModal = ({ isOpen, onClose, onSuccess }) => {
  const { t } = useTranslation();
  const [doctors, setDoctors] = useState([]);
  const [toast, setToast] = useState(null);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      credits: 3,
      maxStudents: 30,
    }
  });
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetchDoctors();
    }
  }, [isOpen]);

  const fetchDoctors = async () => {
    try {
      const result = await doctorsService.getDoctors({ limit: 100 });
      if (result.success) {
        setDoctors(result.data.doctors);
      }
    } catch (error) {
      console.error('Error fetching doctors:', error);
    }
  };

  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const onSubmit = async (data: FormData) => {
    try {
      const result = await coursesService.createCourse(data);
      if (result.success) {
        onSuccess();
      }
    } catch (error) {
      showToast(error.response?.data?.message || t('courses.createError'), 'error');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('courses.addNew')}
      subtitle={t('courses.addDesc')}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="form-section">
        {toast && (
          <div className={`p-4 rounded-xl text-white flex items-center gap-2 animate-in slide-in-from-top-2 duration-300 ${toast.type === 'error' ? 'bg-rose-500' : 'bg-brand-green'}`}>
            {toast.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
            <span className="font-medium">{toast.message}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <Hash size={14} className="text-brand-text-muted" /> {t('courses.courseCode')} <span className="text-rose-500">*</span>
            </label>
            <Input
              {...register('courseCode')}
              placeholder="e.g. CS101"
              className="bg-brand-bg-page/30 border-brand-border focus:bg-brand-bg-card transition-all"
            />
            {errors.courseCode && <p className="text-rose-500 text-xs mt-1">{errors.courseCode.message}</p>}
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <BookOpen size={14} className="text-brand-text-muted" /> {t('courses.courseName')} <span className="text-rose-500">*</span>
            </label>
            <Input
              {...register('name')}
              placeholder="e.g. Intro to CS"
              className="bg-brand-bg-page/30 border-brand-border focus:bg-brand-bg-card transition-all"
            />
            {errors.name && <p className="text-rose-500 text-xs mt-1">{errors.name.message}</p>}
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <label className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <FileText size={14} className="text-brand-text-muted" /> {t('courses.description')}
            </label>
            <textarea
              {...register('description')}
              rows={3}
              placeholder={t('courses.descPlaceholder')}
              className="w-full px-4 py-2 bg-brand-bg-page/30 border border-brand-border rounded-xl text-sm text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-green/20 transition-all resize-none placeholder:text-brand-text-muted"
            ></textarea>
            {errors.description && <p className="text-rose-500 text-xs mt-1">{errors.description.message}</p>}
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <CreditCard size={14} className="text-brand-text-muted" /> {t('courses.credits')} <span className="text-rose-500">*</span>
            </label>
            <Input
              type="number"
              {...register('credits')}
              min="1"
              max="10"
              className="bg-brand-bg-page/30 border-brand-border focus:bg-brand-bg-card transition-all"
            />
            {errors.credits && <p className="text-rose-500 text-xs mt-1">{errors.credits.message}</p>}
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <Users size={14} className="text-brand-text-muted" /> {t('courses.maxStudents')} <span className="text-rose-500">*</span>
            </label>
            <Input
              type="number"
              {...register('maxStudents')}
              min="1"
              className="bg-brand-bg-page/30 border-brand-border focus:bg-brand-bg-card transition-all"
            />
            {errors.maxStudents && <p className="text-rose-500 text-xs mt-1">{errors.maxStudents.message}</p>}
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <label className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <User size={14} className="text-brand-text-muted" /> {t('courses.assignDoctor')}
            </label>
            <select
              {...register('doctorId')}
              className="w-full h-10 px-4 bg-brand-bg-page/30 border border-brand-border rounded-xl text-sm text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-green/20 transition-all appearance-none cursor-pointer"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23132231'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1rem' }}
            >
              <option value="">{t('courses.unassigned')}</option>
              {doctors.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.firstName} {doc.lastName} ({doc.doctorId})
                </option>
              ))}
            </select>
            {errors.doctorId && <p className="text-rose-500 text-xs mt-1">{errors.doctorId.message}</p>}
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-3 border-t border-brand-border pt-6">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isSubmitting}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="min-w-[140px]"
          >
            {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : t('courses.addCourse')}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default AddCourseModal;
