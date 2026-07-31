import React, { useState, useEffect } from 'react';
import coursesService from '../../services/courses.service';
import collegeService from '../../services/college.service';
import departmentService from '../../services/department.service';
import doctorsService from '../../services/doctors.service';
import Button from '../../components/ui/button';
import Input from '../../components/ui/input';
import { useTranslation } from 'react-i18next';
import { X, BookOpen, Hash, FileText, User, GraduationCap, School, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  courseCode: z.string().min(1, 'Course code is required'),
  description: z.string().optional(),
  credits: z.coerce.number().min(1, 'Min 1').max(10, 'Max 10'),
  maxStudents: z.coerce.number().min(1, 'Min 1'),
  departmentId: z.string().min(1, 'Department is required'),
  collegeId: z.string().min(1, 'College is required'),
  year: z.coerce.number().min(1),
  semester: z.coerce.number().min(1)
});

type FormData = z.infer<typeof schema>;

const CourseModal = ({ 
  isOpen, 
  onClose, 
  onSuccess, 
  course,
  initialCollegeId,
  initialDepartmentId,
  initialYear,
  initialSemester
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  onSuccess: () => void, 
  course?: any,
  initialCollegeId?: string | number,
  initialDepartmentId?: string | number,
  initialYear?: string | number,
  initialSemester?: string | number
}) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({ 
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      courseCode: '',
      description: '',
      credits: 3,
      maxStudents: 30,
      departmentId: initialDepartmentId ? String(initialDepartmentId) : '',
      collegeId: initialCollegeId ? String(initialCollegeId) : '',
      year: initialYear ? Number(initialYear) : 1,
      semester: initialSemester ? Number(initialSemester) : 1
    }
  });
  
  const [colleges, setColleges] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [fetchingData, setFetchingData] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const watchCollegeId = watch('collegeId');

  useEffect(() => {
    if (watchCollegeId) {
      fetchDepartments(watchCollegeId);
    } else {
      setDepartments([]);
    }
  }, [watchCollegeId]);

  useEffect(() => {
    if (isOpen) {
      fetchInitialData();
      if (course) {
        reset({
          name: course.name || '',
          courseCode: course.courseCode || '',
          description: course.description || '',
          credits: course.credits || 3,
          maxStudents: course.maxStudents || 30,
          departmentId: course.departmentId ? String(course.departmentId) : '',
          collegeId: course.department?.collegeId ? String(course.department.collegeId) : '',
          year: course.year || 1,
          semester: course.semester || 1
        });
      } else {
        const selCollege = initialCollegeId ? String(initialCollegeId) : '';
        reset({
          name: '',
          courseCode: '',
          description: '',
          credits: 3,
          maxStudents: 30,
          departmentId: initialDepartmentId ? String(initialDepartmentId) : '',
          collegeId: selCollege,
          year: initialYear ? Number(initialYear) : 1,
          semester: initialSemester ? Number(initialSemester) : 1
        });
        if (selCollege) {
          fetchDepartments(selCollege);
        }
      }
    }
  }, [isOpen, course, reset, initialCollegeId, initialDepartmentId, initialYear, initialSemester]);

  const fetchInitialData = async () => {
    try {
      setFetchingData(true);
      const [collegesRes] = await Promise.all([
        collegeService.getColleges()
      ]);
      
      if (collegesRes.success) setColleges(collegesRes.data);
    } catch (err) {
      console.error('Error fetching modal data:', err);
    } finally {
      setFetchingData(false);
    }
  };

  const fetchDepartments = async (collegeId: string) => {
    if (!collegeId) {
      setDepartments([]);
      return;
    }
    try {
      const res = await departmentService.getDepartmentsByCollege(collegeId);
      if (res.success) setDepartments(res.data);
    } catch (err) {
      console.error('Error fetching departments:', err);
    }
  };

  const onSubmit = async (data: FormData) => {
    setError(null);
    const { collegeId, ...submitData } = data;

    try {
      let res;
      if (course) {
        res = await coursesService.updateCourse(course.id, submitData);
      } else {
        res = await coursesService.createCourse(submitData);
      }

      if (res.success) {
        onSuccess();
      } else {
        setError(res.message || 'An error occurred');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save course');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-brand-navy-500/40 backdrop-blur-sm" onClick={onClose}></div>
      
      <div className="relative bg-brand-bg-card dark:bg-brand-bg-elevated rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-brand-border dark:border-brand-border flex justify-between items-center bg-brand-bg-page/50 dark:bg-brand-bg-elevated/50">
          <div>
            <h2 className="text-xl font-bold text-brand-text-primary dark:text-brand-text-main text-start">
              {course ? t('courses.addModal.editTitle') : t('courses.addModal.title')}
            </h2>
            <p className="text-sm text-brand-text-secondary dark:text-brand-text-muted mt-0.5 text-start">
              {course ? t('courses.addModal.editSubtitle') : t('courses.addModal.subtitle')}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-brand-text-muted hover:text-brand-text-secondary dark:hover:text-brand-text-secondary hover:bg-brand-bg-page dark:hover:bg-brand-bg-elevated rounded-xl transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-error text-white flex items-center gap-2 animate-in slide-in-from-top-2 duration-300">
              <AlertCircle size={20} />
              <span className="font-medium">{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2 space-y-1.5 text-start">
              <label className="text-sm font-semibold text-brand-text-primary dark:text-brand-text-secondary flex items-center gap-2 ms-1">
                <BookOpen size={14} className="text-brand-text-muted" /> {t('courses.addModal.courseName')} <span className="text-error">*</span>
              </label>
              <Input
                {...register('name')}
                placeholder={t('courses.addModal.courseNamePlaceholder')}
              />
              {errors.name && <p className="text-rose-500 text-xs mt-1">{t('courses.addModal.errors.nameRequired')}</p>}
            </div>

            <div className="space-y-1.5 text-start">
              <label className="text-sm font-semibold text-brand-text-primary dark:text-brand-text-secondary flex items-center gap-2 ms-1">
                <Hash size={14} className="text-brand-text-muted" /> {t('courses.addModal.courseCode')} <span className="text-error">*</span>
              </label>
              <Input
                {...register('courseCode')}
                placeholder={t('courses.addModal.courseCodePlaceholder')}
              />
              {errors.courseCode && <p className="text-rose-500 text-xs mt-1">{t('courses.addModal.errors.codeRequired')}</p>}
            </div>

            <div className="space-y-1.5 text-start">
              <label className="text-sm font-semibold text-brand-text-primary dark:text-brand-text-secondary flex items-center gap-2 ms-1">
                <GraduationCap size={14} className="text-brand-text-muted" /> {t('courses.addModal.credits')} <span className="text-error">*</span>
              </label>
              <Input
                type="number"
                {...register('credits')}
                min="1"
                max="10"
              />
              {errors.credits && <p className="text-rose-500 text-xs mt-1">{t('courses.addModal.errors.creditsRange')}</p>}
            </div>

            <div className="space-y-1.5 text-start">
              <label className="text-sm font-semibold text-brand-text-primary dark:text-brand-text-secondary flex items-center gap-2 ms-1">
                <School size={14} className="text-brand-text-muted" /> {t('courses.addModal.college')} <span className="text-error">*</span>
              </label>
              <select
                {...register('collegeId')}
                className="w-full px-4 py-2 bg-brand-bg-card dark:bg-brand-bg-elevated border border-brand-border dark:border-brand-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 focus:border-brand-primary-500 dark:text-brand-text-main"
              >
                <option value="">{t('courses.addModal.selectCollege')}</option>
                {colleges.map(c => (
                  <option key={c.id} value={c.id}>{isRTL ? c.nameAr || c.name : c.name}</option>
                ))}
              </select>
              {errors.collegeId && <p className="text-rose-500 text-xs mt-1">{t('courses.addModal.errors.collegeRequired')}</p>}
            </div>

            <div className="space-y-1.5 text-start">
              <label className="text-sm font-semibold text-brand-text-primary dark:text-brand-text-secondary flex items-center gap-2 ms-1">
                <GraduationCap size={14} className="text-brand-text-muted" /> {t('courses.addModal.department')} <span className="text-error">*</span>
              </label>
              <select
                {...register('departmentId')}
                disabled={!watchCollegeId}
                className="w-full px-4 py-2 bg-brand-bg-card dark:bg-brand-bg-elevated border border-brand-border dark:border-brand-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 focus:border-brand-primary-500 dark:text-brand-text-main disabled:opacity-50"
              >
                <option value="">{t('courses.addModal.selectDepartment')}</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{isRTL ? d.nameAr || d.name : d.name}</option>
                ))}
              </select>
              {errors.departmentId && <p className="text-rose-500 text-xs mt-1">{t('courses.addModal.errors.departmentRequired')}</p>}
            </div>



            <div className="space-y-1.5 text-start">
              <label className="text-sm font-semibold text-brand-text-primary dark:text-brand-text-secondary flex items-center gap-2 ms-1">
                <User size={14} className="text-brand-text-muted" /> {t('courses.addModal.maxStudents')}
              </label>
              <Input
                type="number"
                {...register('maxStudents')}
                min="1"
              />
              {errors.maxStudents && <p className="text-rose-500 text-xs mt-1">{t('courses.addModal.errors.maxStudentsRequired')}</p>}
            </div>

            <div className="space-y-1.5 text-start">
              <label className="text-sm font-semibold text-brand-text-primary dark:text-brand-text-secondary flex items-center gap-2 ms-1">
                {t('courses.addModal.year')}
              </label>
              <select
                {...register('year')}
                className="w-full px-4 py-2 bg-brand-bg-card dark:bg-brand-bg-elevated border border-brand-border dark:border-brand-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 focus:border-brand-primary-500 dark:text-brand-text-main"
              >
                {[1, 2, 3, 4, 5].map(y => (
                  <option key={y} value={y}>{t(`courses.addModal.year${y}`)}</option>
                ))}
              </select>
              {errors.year && <p className="text-rose-500 text-xs mt-1">{errors.year.message}</p>}
            </div>

            <div className="space-y-1.5 text-start">
              <label className="text-sm font-semibold text-brand-text-primary dark:text-brand-text-secondary flex items-center gap-2 ms-1">
                {t('courses.addModal.semester')}
              </label>
              <select
                {...register('semester')}
                className="w-full px-4 py-2 bg-brand-bg-card dark:bg-brand-bg-elevated border border-brand-border dark:border-brand-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 focus:border-brand-primary-500 dark:text-brand-text-main"
              >
                <option value={1}>{t('courses.addModal.firstSemester')}</option>
                <option value={2}>{t('courses.addModal.secondSemester')}</option>
                <option value={3}>{t('courses.addModal.summerSemester')}</option>
              </select>
              {errors.semester && <p className="text-rose-500 text-xs mt-1">{errors.semester.message}</p>}
            </div>

            <div className="md:col-span-2 space-y-1.5 text-start">
              <label className="text-sm font-semibold text-brand-text-primary dark:text-brand-text-secondary flex items-center gap-2 ms-1">
                <FileText size={14} className="text-brand-text-muted" /> {t('courses.addModal.description')}
              </label>
              <textarea
                {...register('description')}
                rows={3}
                className="w-full px-4 py-2 bg-brand-bg-card dark:bg-brand-bg-elevated border border-brand-border dark:border-brand-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 focus:border-brand-primary-500 dark:text-brand-text-main resize-none"
                placeholder={t('courses.addModal.descriptionPlaceholder')}
              ></textarea>
              {errors.description && <p className="text-rose-500 text-xs mt-1">{errors.description.message}</p>}
            </div>
          </div>

          <div className="mt-8 flex justify-end gap-3 border-t border-brand-border dark:border-brand-border pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              {t('courses.addModal.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-brand-primary-500 hover:bg-brand-primary-600 active:scale-95 text-white font-bold py-2 px-4 rounded-xl shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed min-w-[120px]"
            >
              {isSubmitting && <Loader2 size={16} className="animate-spin inline me-2" />}
              {course ? t('courses.addModal.update') : t('courses.addModal.create')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CourseModal;
