import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Modal from '../Modal';
import Button from '../Button';
import Input from '../Input';
import { Loader2 } from 'lucide-react';
import enrollmentService from '../../../services/enrollment.service';
import studentsService from '../../../services/students.service';
import coursesService from '../../../services/courses.service';

const schema = z.object({
  studentId: z.coerce.number().min(1, 'Student is required'),
  courseId: z.coerce.number().min(1, 'Course is required'),
  semester: z.coerce.number().min(1, 'Semester is required'),
  academicYear: z.coerce.number().min(2000, 'Valid year required'),
});

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

interface EnrollmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  fixedCourseId?: number;
  fixedStudentId?: number;
}

const EnrollmentModal: React.FC<EnrollmentModalProps> = ({ isOpen, onClose, onSuccess, fixedCourseId, fixedStudentId }) => {
  const { t } = useTranslation();
  const [students, setStudents] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);

  const { register, handleSubmit, formState: { errors, isSubmitting }, setError, reset } = useForm<FormInput>({
    resolver: zodResolver(schema),
    defaultValues: {
      courseId: fixedCourseId || undefined,
      studentId: fixedStudentId || undefined,
      semester: 1,
      academicYear: new Date().getFullYear(),
    }
  });

  useEffect(() => {
    if (isOpen) {
      if (!fixedStudentId) {
        studentsService.getStudents({ limit: 1000 }).then(res => {
          if (res.success) setStudents(res.data.students || []);
        });
      }
      if (!fixedCourseId) {
        coursesService.getCourses().then(res => {
          if (res.success) setCourses(res.data || []);
        });
      }
    }
  }, [isOpen, fixedCourseId, fixedStudentId]);

  const onSubmit = async (data: FormInput) => {
    try {
      const validData = schema.parse(data);
      await enrollmentService.enrollStudent(validData);
      reset();
      onSuccess();
    } catch (error: any) {
      setError('root', { message: error.response?.data?.message || 'Failed to enroll' });
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('enrollment.enrollTitle', 'Enroll Student')}
      subtitle={t('enrollment.enrollDesc', 'Register a student for a course')}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {errors.root && (
          <div className="p-4 bg-error/10 text-error rounded-xl text-sm font-bold">
            {errors.root.message}
          </div>
        )}

        {!fixedStudentId && (
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-brand-text-main ml-1">
              {t('enrollment.selectStudent', 'Select Student')}
            </label>
            <select
              {...register('studentId')}
              className="w-full h-10 px-4 bg-brand-bg-page/30 border border-brand-border rounded-xl text-sm focus:ring-2 focus:ring-brand-green/20"
            >
              <option value="">{t('common.select', 'Select...')}</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>{s.studentId} - {s.firstName} {s.lastName}</option>
              ))}
            </select>
            {errors.studentId && <p className="text-rose-500 text-xs mt-1">{errors.studentId.message}</p>}
          </div>
        )}

        {!fixedCourseId && (
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-brand-text-main ml-1">
              {t('enrollment.selectCourse', 'Select Course')}
            </label>
            <select
              {...register('courseId')}
              className="w-full h-10 px-4 bg-brand-bg-page/30 border border-brand-border rounded-xl text-sm focus:ring-2 focus:ring-brand-green/20"
            >
              <option value="">{t('common.select', 'Select...')}</option>
              {courses.map(c => (
                <option key={c.id} value={c.id}>{c.courseCode} - {c.name}</option>
              ))}
            </select>
            {errors.courseId && <p className="text-rose-500 text-xs mt-1">{errors.courseId.message}</p>}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-brand-text-main ml-1">
              {t('enrollment.semester', 'Semester')}
            </label>
            <Input type="number" {...register('semester')} min="1" max="3" />
            {errors.semester && <p className="text-rose-500 text-xs mt-1">{errors.semester.message}</p>}
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-brand-text-main ml-1">
              {t('enrollment.academicYear', 'Academic Year')}
            </label>
            <Input type="number" {...register('academicYear')} />
            {errors.academicYear && <p className="text-rose-500 text-xs mt-1">{errors.academicYear.message}</p>}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-6 border-t border-brand-border">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : t('common.save', 'Enroll')}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default EnrollmentModal;
