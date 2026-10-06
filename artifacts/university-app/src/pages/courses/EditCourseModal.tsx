import React, { useState, useEffect } from 'react';
import coursesService from '../../services/courses.service';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { X } from 'lucide-react';

const schema = z.object({
  name: z.string().min(1, 'Course Name is required'),
  description: z.string().optional(),
  credits: z.coerce.number().min(1, 'Credits must be at least 1').max(10, 'Credits must be at most 10'),
  maxStudents: z.coerce.number().min(1, 'Max students must be at least 1'),
});

type FormData = z.infer<typeof schema>;

interface EditCourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  course: any;
}

const EditCourseModal: React.FC<EditCourseModalProps> = ({ isOpen, onClose, onSuccess, course }) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language?.startsWith('ar');
  const [toast, setToast] = useState<{ message: string; type: string } | null>(null);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema)
  });

  useEffect(() => {
    if (isOpen) {
      if (course) {
        reset({
          name: course.name || '',
          description: course.description || '',
          credits: course.credits || 3,
          maxStudents: course.maxStudents || 30,
        });
      }
    }
  }, [isOpen, course, reset]);

  const showToast = (message: string, type: string) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const onSubmit = async (data: FormData) => {
    try {
      const result = await coursesService.updateCourse(course.id, data);
      if (result.success) {
        onSuccess();
      }
    } catch (error: any) {
      showToast(error.response?.data?.message || t('courses.errorUpdating', isRTL ? 'حدث خطأ أثناء تحديث المقرر' : 'Error updating course'), 'error');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 sm:px-6">
      <div className="bg-brand-bg-card dark:bg-brand-bg-elevated rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden transform transition-all max-h-[90vh] overflow-y-auto border border-brand-border">
        <div className="px-6 py-4 border-b border-brand-border dark:border-brand-border flex justify-between items-center bg-brand-bg-page dark:bg-brand-bg-elevated/50">
          <h2 className="text-xl font-bold text-brand-text-primary dark:text-brand-text-main">
            {t('courses.editCourseTitle', {
              code: course?.courseCode,
              defaultValue: isRTL ? `تعديل المقرر: ${course?.courseCode}` : `Edit Course: ${course?.courseCode}`
            })}
          </h2>
          <button 
            onClick={onClose} 
            aria-label={t('common.close', isRTL ? 'إغلاق' : 'Close')}
            className="p-1.5 text-brand-text-muted hover:text-brand-text-secondary dark:text-brand-text-muted dark:hover:text-brand-text-secondary rounded-lg transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6">
          {toast && (
            <div className={`mb-4 p-3 rounded-xl text-white font-medium text-sm ${toast.type === 'error' ? 'bg-error-strong' : 'bg-success'}`}>
              {toast.message}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label htmlFor="edit-course-name" className="block text-sm font-medium text-brand-text-primary dark:text-brand-text-secondary mb-1">
                {t('courses.courseName', isRTL ? 'اسم المقرر' : 'Course Name')} <span className="text-rose-500">*</span>
              </label>
              <input
                id="edit-course-name"
                aria-required="true"
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? "edit-course-name-error" : undefined}
                type="text"
                {...register('name')}
                placeholder={t('courses.namePlaceholder', isRTL ? 'مثال: مقدمة في علوم الحاسب' : 'e.g. Intro to CS')}
                className="w-full px-3 py-2 border border-brand-border dark:border-brand-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary-500/30 dark:bg-brand-bg-elevated dark:text-brand-text-main bg-brand-bg-page/40"
              />
              {errors.name && <p id="edit-course-name-error" className="text-rose-500 text-xs mt-1" role="alert">{errors.name.message}</p>}
            </div>
            <div className="md:col-span-2">
              <label htmlFor="edit-course-desc" className="block text-sm font-medium text-brand-text-primary dark:text-brand-text-secondary mb-1">
                {t('courses.description', isRTL ? 'الوصف' : 'Description')}
              </label>
              <textarea
                id="edit-course-desc"
                aria-invalid={!!errors.description}
                aria-describedby={errors.description ? "edit-course-desc-error" : undefined}
                {...register('description')}
                rows={3}
                placeholder={t('courses.descPlaceholder', isRTL ? 'أدخل وصف المقرر الدراسي...' : 'Enter course description...')}
                className="w-full px-3 py-2 border border-brand-border dark:border-brand-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary-500/30 dark:bg-brand-bg-elevated dark:text-brand-text-main bg-brand-bg-page/40 resize-none"
              ></textarea>
              {errors.description && <p id="edit-course-desc-error" className="text-rose-500 text-xs mt-1" role="alert">{errors.description.message}</p>}
            </div>
            <div>
              <label htmlFor="edit-course-credits" className="block text-sm font-medium text-brand-text-primary dark:text-brand-text-secondary mb-1">
                {t('courses.credits', isRTL ? 'الساعات المعتمدة' : 'Credits')} <span className="text-rose-500">*</span>
              </label>
              <input
                id="edit-course-credits"
                aria-required="true"
                aria-invalid={!!errors.credits}
                aria-describedby={errors.credits ? "edit-course-credits-error" : undefined}
                type="number"
                {...register('credits')}
                min="1"
                max="10"
                className="w-full px-3 py-2 border border-brand-border dark:border-brand-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary-500/30 dark:bg-brand-bg-elevated dark:text-brand-text-main bg-brand-bg-page/40"
              />
              {errors.credits && <p id="edit-course-credits-error" className="text-rose-500 text-xs mt-1" role="alert">{errors.credits.message}</p>}
            </div>
            <div>
              <label htmlFor="edit-course-max-students" className="block text-sm font-medium text-brand-text-primary dark:text-brand-text-secondary mb-1">
                {t('courses.maxStudents', isRTL ? 'الحد الأقصى للطلاب' : 'Max Students')} <span className="text-rose-500">*</span>
              </label>
              <input
                id="edit-course-max-students"
                aria-required="true"
                aria-invalid={!!errors.maxStudents}
                aria-describedby={errors.maxStudents ? "edit-course-max-students-error" : undefined}
                type="number"
                {...register('maxStudents')}
                min="1"
                className="w-full px-3 py-2 border border-brand-border dark:border-brand-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary-500/30 dark:bg-brand-bg-elevated dark:text-brand-text-main bg-brand-bg-page/40"
              />
              {errors.maxStudents && <p id="edit-course-max-students-error" className="text-rose-500 text-xs mt-1" role="alert">{errors.maxStudents.message}</p>}
            </div>

          </div>

          <div className="mt-6 flex flex-col-reverse sm:flex-row justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 border border-brand-border dark:border-brand-border rounded-xl text-brand-text-secondary dark:text-brand-text-secondary hover:bg-brand-bg-page dark:hover:bg-brand-bg-elevated transition-colors cursor-pointer"
              disabled={isSubmitting}
            >
              {t('common.cancel', isRTL ? 'إلغاء' : 'Cancel')}
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-brand-primary-500 text-white rounded-xl hover:bg-brand-primary-600 disabled:opacity-50 transition-colors cursor-pointer font-bold text-sm"
              disabled={isSubmitting}
            >
              {isSubmitting ? t('courses.updating', isRTL ? 'جاري التحديث...' : 'Updating...') : t('common.saveChanges', isRTL ? 'حفظ التغييرات' : 'Save Changes')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditCourseModal;
