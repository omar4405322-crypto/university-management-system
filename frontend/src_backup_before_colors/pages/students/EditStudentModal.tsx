// @ts-nocheck
import React, { useState, useEffect } from 'react';
import studentsService from '../../services/students.service';
import collegeService from '../../services/college.service';
import departmentService from '../../services/department.service';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { X, User, Phone, MapPin, AlertCircle, CheckCircle, School, GraduationCap, Hash, Calendar } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { logger } from '../../lib/logger';
import { useToast } from '../../context/ToastContext';

const schema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phone: z.string().optional(),
  address: z.string().optional(),
  studentId: z.string().min(1, 'Student ID is required'),
  year: z.coerce.number().min(1),
  departmentId: z.coerce.number().min(1, 'Department is required'),
  collegeId: z.coerce.number().min(1, 'College is required'),
});

type FormData = z.infer<typeof schema>;

const EditStudentModal = ({ isOpen, onClose, onSuccess, student }) => {
  const { t } = useTranslation();
  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
        resolver: zodResolver(schema),
    defaultValues: {
      firstName: '',
      lastName: '',
      phone: '',
      address: '',
      studentId: '',
      year: 1,
      departmentId: undefined,
      collegeId: undefined,
    }
  });

  const [colleges, setColleges] = useState([]);
  const [departments, setDepartments] = useState([]);
  const { showToast } = useToast();

  const watchCollegeId = watch('collegeId');

  useEffect(() => {
    if (student) {
      reset({
        firstName: student.firstName || '',
        lastName: student.lastName || '',
        phone: student.phone || '',
        address: student.address || '',
        studentId: student.studentId || '',
        year: student.year || 1,
        departmentId: student.departmentId || undefined,
        collegeId: student.department?.collegeId || undefined,
      });
    }
  }, [student, reset]);

  useEffect(() => {
    const fetchColleges = async () => {
      try {
        const result = await collegeService.getColleges();
        if (result.success) {
          setColleges(result.data);
        }
      } catch (err: any) {
        logger.error('Error fetching colleges:', err);
      }
    };
    if (isOpen) fetchColleges();
  }, [isOpen]);

  useEffect(() => {
    const fetchDepartments = async () => {
      if (!watchCollegeId) {
        setDepartments([]);
        return;
      }
      try {
        const result = await departmentService.getDepartments({ collegeId: watchCollegeId });
        if (result.success) {
          setDepartments(result.data);
        }
      } catch (err: any) {
        logger.error('Error fetching departments:', err);
      }
    };
    if (isOpen) fetchDepartments();
  }, [isOpen, watchCollegeId]);


  const onSubmit = async (data: FormData) => {
    try {
      const result = await studentsService.updateStudent(student.id, data);
      if (result.success) {
        onSuccess();
      } else {
        showToast(result.message || t('students.updateError'), 'error');
      }
    } catch (error: any) {
      showToast(error.response?.data?.message || t('students.updateError'), 'error');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-brand-navy-500/40 backdrop-blur-sm" onClick={onClose}></div>
      
      {/* Modal Content */}
      <div className="relative bg-brand-bg-card dark:bg-brand-bg-elevated rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto border border-brand-border dark:border-brand-border">
        <div className="px-6 py-4 border-b border-brand-border dark:border-brand-border flex justify-between items-center bg-brand-bg-page/50 dark:bg-brand-bg-elevated/50">
          <div>
            <h2 className="text-xl font-bold text-brand-text-primary dark:text-brand-text-main">{t('students.editTitle')}: {student?.studentId}</h2>
            <p className="text-sm text-brand-text-secondary dark:text-brand-text-muted mt-0.5">{t('students.editDesc')}</p>
          </div>
          <button onClick={onClose} className="p-2 text-brand-text-muted hover:text-brand-text-secondary dark:hover:text-brand-text-secondary hover:bg-brand-bg-page dark:hover:bg-brand-bg-elevated rounded-xl transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit(onSubmit as any)} className="p-6">
          

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-brand-text-primary dark:text-brand-text-secondary flex items-center gap-2 ml-1">
                <User size={14} className="text-brand-text-muted dark:text-brand-text-secondary" /> {t('students.firstName')} <span className="text-error">*</span>
              </label>
              <Input
                {...register('firstName')}
                placeholder={t('students.firstNamePlaceholder')}
              />
              {errors.firstName && <p className="text-rose-500 text-xs mt-1">{errors.firstName.message}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-brand-text-primary dark:text-brand-text-secondary flex items-center gap-2 ml-1">
                <User size={14} className="text-brand-text-muted dark:text-brand-text-secondary" /> {t('students.lastName')} <span className="text-error">*</span>
              </label>
              <Input
                {...register('lastName')}
                placeholder={t('students.lastNamePlaceholder')}
              />
              {errors.lastName && <p className="text-rose-500 text-xs mt-1">{errors.lastName.message}</p>}
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <label className="text-sm font-semibold text-brand-text-primary dark:text-brand-text-secondary flex items-center gap-2 ml-1">
                <Phone size={14} className="text-brand-text-muted dark:text-brand-text-secondary" /> {t('students.phoneNumber')}
              </label>
              <Input
                {...register('phone')}
                placeholder={t('students.phonePlaceholder')}
              />
              {errors.phone && <p className="text-rose-500 text-xs mt-1">{errors.phone.message}</p>}
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <label className="text-sm font-semibold text-brand-text-primary dark:text-brand-text-secondary flex items-center gap-2 ml-1">
                <MapPin size={14} className="text-brand-text-muted dark:text-brand-text-secondary" /> {t('students.homeAddress')}
              </label>
              <textarea
                {...register('address')}
                rows="3"
                className="w-full px-4 py-2 bg-brand-bg-card dark:bg-brand-bg-elevated border border-brand-border dark:border-brand-border rounded-xl text-sm text-brand-text-primary dark:text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 transition-all resize-none placeholder:text-brand-text-muted dark:placeholder:text-brand-text-muted"
                placeholder={t('students.addressPlaceholder')}
              ></textarea>
              {errors.address && <p className="text-rose-500 text-xs mt-1">{errors.address.message}</p>}
            </div>

            <div className="border-t border-brand-border dark:border-brand-border md:col-span-2 pt-4 mt-2">
              <h3 className="text-sm font-bold text-brand-text-primary dark:text-brand-text-main mb-4 flex items-center gap-2">
                <School size={16} className="text-info" />
                {t('profile.academicInfo')}
              </h3>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-brand-text-primary dark:text-brand-text-secondary flex items-center gap-2 ml-1">
                <Hash size={14} className="text-brand-text-muted dark:text-brand-text-secondary" /> {t('profile.studentId')} <span className="text-error">*</span>
              </label>
              <Input
                {...register('studentId')}
                placeholder={t('auth.studentIdPlaceholder')}
              />
              {errors.studentId && <p className="text-rose-500 text-xs mt-1">{errors.studentId.message}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-brand-text-primary dark:text-brand-text-secondary flex items-center gap-2 ml-1">
                <Calendar size={14} className="text-brand-text-muted dark:text-brand-text-secondary" /> {t('profile.year')} <span className="text-error">*</span>
              </label>
              <select
                {...register('year')}
                className="w-full h-10 px-4 bg-brand-bg-card dark:bg-brand-bg-elevated border border-brand-border dark:border-brand-border rounded-xl text-sm text-brand-text-primary dark:text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 transition-all appearance-none cursor-pointer"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1rem' }}
              >
                <option value="1">Year 1</option>
                <option value="2">Year 2</option>
                <option value="3">Year 3</option>
                <option value="4">Year 4</option>
                <option value="5">Year 5</option>
              </select>
              {errors.year && <p className="text-rose-500 text-xs mt-1">{errors.year.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-brand-text-primary dark:text-brand-text-secondary flex items-center gap-2 ml-1">
                <School size={14} className="text-brand-text-muted dark:text-brand-text-secondary" /> {t('profile.college')} <span className="text-error">*</span>
              </label>
              <select
                {...register('collegeId')}
                className="w-full h-10 px-4 bg-brand-bg-card dark:bg-brand-bg-elevated border border-brand-border dark:border-brand-border rounded-xl text-sm text-brand-text-primary dark:text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 transition-all appearance-none cursor-pointer"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1rem' }}
              >
                <option value="">{t('auth.selectCollege')}</option>
                {colleges.map(college => (
                  <option key={college.id} value={college.id}>{college.name}</option>
                ))}
              </select>
              {errors.collegeId && <p className="text-rose-500 text-xs mt-1">{errors.collegeId.message}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-brand-text-primary dark:text-brand-text-secondary flex items-center gap-2 ml-1">
                <GraduationCap size={14} className="text-brand-text-muted dark:text-brand-text-secondary" /> {t('profile.department')} <span className="text-error">*</span>
              </label>
              <select
                {...register('departmentId')}
                disabled={!watchCollegeId}
                className="w-full h-10 px-4 bg-brand-bg-card dark:bg-brand-bg-elevated border border-brand-border dark:border-brand-border rounded-xl text-sm text-brand-text-primary dark:text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 transition-all appearance-none cursor-pointer disabled:opacity-50"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1rem' }}
              >
                <option value="">{t('auth.selectDept')}</option>
                {departments.map(dept => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
              {errors.departmentId && <p className="text-rose-500 text-xs mt-1">{errors.departmentId.message}</p>}
            </div>
          </div>

          <div className="mt-8 flex justify-end gap-3 border-t border-brand-border dark:border-brand-border pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              loading={isSubmitting}
              disabled={isSubmitting}
              className="min-w-[140px]"
            >
              {t('common.save')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditStudentModal;
