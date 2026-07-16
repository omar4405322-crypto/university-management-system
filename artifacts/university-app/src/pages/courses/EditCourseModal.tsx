import React, { useState, useEffect } from 'react';
import coursesService from '../../services/courses.service';
import doctorsService from '../../services/doctors.service';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1, 'Course Name is required'),
  description: z.string().optional(),
  credits: z.coerce.number().min(1, 'Credits must be at least 1').max(10, 'Credits must be at most 10'),
  maxStudents: z.coerce.number().min(1, 'Max students must be at least 1'),
});

type FormData = z.infer<typeof schema>;

const EditCourseModal = ({ isOpen, onClose, onSuccess, course }) => {
  const [toast, setToast] = useState(null);

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



  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const onSubmit = async (data: FormData) => {
    try {
      const result = await coursesService.updateCourse(course.id, data);
      if (result.success) {
        onSuccess();
      }
    } catch (error) {
      showToast(error.response?.data?.message || 'Error updating course', 'error');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 sm:px-6">
      <div className="bg-brand-bg-card dark:bg-brand-bg-elevated rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden transform transition-all max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-brand-border dark:border-brand-border flex justify-between items-center bg-brand-bg-page dark:bg-brand-bg-elevated/50">
          <h2 className="text-xl font-bold text-brand-text-primary dark:text-brand-text-main">Edit Course: {course?.courseCode}</h2>
          <button onClick={onClose} className="text-brand-text-muted hover:text-brand-text-secondary dark:text-brand-text-muted dark:hover:text-brand-text-secondary transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6">
          {toast && (
            <div className={`mb-4 p-3 rounded text-white ${toast.type === 'error' ? 'bg-error' : 'bg-success'}`}>
              {toast.message}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-brand-text-primary dark:text-brand-text-secondary mb-1">Course Name *</label>
              <input
                type="text"
                {...register('name')}
                className="w-full px-3 py-2 border border-brand-border dark:border-brand-border rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary-500/30 dark:bg-brand-bg-elevated dark:text-brand-text-main"
              />
              {errors.name && <p className="text-rose-500 text-xs mt-1">{errors.name.message}</p>}
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-brand-text-primary dark:text-brand-text-secondary mb-1">Description</label>
              <textarea
                {...register('description')}
                rows={3}
                className="w-full px-3 py-2 border border-brand-border dark:border-brand-border rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary-500/30 dark:bg-brand-bg-elevated dark:text-brand-text-main"
              ></textarea>
              {errors.description && <p className="text-rose-500 text-xs mt-1">{errors.description.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-text-primary dark:text-brand-text-secondary mb-1">Credits *</label>
              <input
                type="number"
                {...register('credits')}
                min="1"
                max="10"
                className="w-full px-3 py-2 border border-brand-border dark:border-brand-border rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary-500/30 dark:bg-brand-bg-elevated dark:text-brand-text-main"
              />
              {errors.credits && <p className="text-rose-500 text-xs mt-1">{errors.credits.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-text-primary dark:text-brand-text-secondary mb-1">Max Students *</label>
              <input
                type="number"
                {...register('maxStudents')}
                min="1"
                className="w-full px-3 py-2 border border-brand-border dark:border-brand-border rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary-500/30 dark:bg-brand-bg-elevated dark:text-brand-text-main"
              />
              {errors.maxStudents && <p className="text-rose-500 text-xs mt-1">{errors.maxStudents.message}</p>}
            </div>

          </div>

          <div className="mt-6 flex flex-col-reverse sm:flex-row justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-brand-border dark:border-brand-border rounded-md text-brand-text-secondary dark:text-brand-text-secondary hover:bg-brand-bg-page dark:hover:bg-brand-bg-elevated transition-colors"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-brand-primary-500 text-white rounded-md hover:bg-brand-primary-600 disabled:opacity-50 transition-colors"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Updating...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditCourseModal;
