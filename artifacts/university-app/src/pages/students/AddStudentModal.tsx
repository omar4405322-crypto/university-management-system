// FIXED: isOpen prop, auto-generate student ID, strip collegeId on POST - Phase 5
import React, { useState, useEffect } from 'react';
import studentsService from '../../services/students.service';
import collegeService from '../../services/college.service';
import departmentService from '../../services/department.service';
import Button from '../../components/ui/button';
import Input from '../../components/ui/input';
import { User, Mail, Lock, Phone, MapPin, Hash, AlertCircle, CheckCircle, School, GraduationCap, Calendar, Loader2, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import Modal from '../../components/ui/Modal';

const schema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  studentId: z.string().min(1, 'Student ID is required'),
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must include at least one uppercase letter')
    .regex(/[a-z]/, 'Password must include at least one lowercase letter')
    .regex(/\d/, 'Password must include at least one number'),
  phone: z.string().optional(),
  address: z.string().optional(),
  year: z.coerce.number().min(1, 'Academic division is required').max(4, 'Division must be between 1 and 4'),
  collegeId: z.coerce.number().min(1, 'College is required'),
  departmentId: z.coerce.number().min(1, 'Department is required'),
});

type StudentFormData = z.infer<typeof schema>;

export interface AddStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const AddStudentModal: React.FC<AddStudentModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language?.startsWith('ar');
  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<StudentFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: '',
      lastName: '',
      studentId: '',
      email: '',
      password: '',
      phone: '',
      address: '',
      year: 1,
      collegeId: undefined,
      departmentId: undefined,
    }
  });

  const [colleges, setColleges] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const watchCollegeId = watch('collegeId');
  const prevCollegeIdRef = React.useRef(watchCollegeId);

  useEffect(() => {
    if (prevCollegeIdRef.current !== undefined && prevCollegeIdRef.current !== watchCollegeId) {
      setValue('departmentId', '' as any);
    }
    prevCollegeIdRef.current = watchCollegeId;
  }, [watchCollegeId, setValue]);

  useEffect(() => {
    const fetchColleges = async () => {
      try {
        const result = await collegeService.getColleges();
        if (result.success) {
          setColleges(result.data);
        }
      } catch (err) {
        console.error('Error fetching colleges:', err);
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
      } catch (err) {
        console.error('Error fetching departments:', err);
      }
    };
    if (isOpen) fetchDepartments();
  }, [isOpen, watchCollegeId]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const generateStudentId = () => {
    const year = new Date().getFullYear();
    const suffix = String(Math.floor(1000 + Math.random() * 9000));
    setValue('studentId', `${year}${suffix}`);
  };

  const onSubmit = async (data: StudentFormData) => {
    try {
      const { collegeId, ...payload } = data;
      const result = await studentsService.createStudent(payload);
      if (result && result.success) {
        onSuccess?.();
      } else {
        showToast(result?.message || t('students.createError'), 'error');
      }
    } catch (error: any) {
      showToast(error?.message || error?.response?.data?.message || t('students.createError'), 'error');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('students.addNew')}
      subtitle={t('students.addDesc')}
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
            <label htmlFor="add-student-first-name" className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <User size={14} className="text-brand-text-muted" /> {t('students.firstName')} <span className="text-rose-500">*</span>
            </label>
            <Input
              {...register('firstName')}
              id="add-student-first-name"
              autoComplete="given-name"
              aria-required="true"
              aria-invalid={!!errors.firstName}
              aria-describedby={errors.firstName ? 'add-student-first-name-err' : undefined}
              placeholder={t('students.firstNamePlaceholder')}
              className="bg-brand-bg-page/30 border-brand-border focus:bg-brand-bg-card transition-all"
            />
            {errors.firstName && <p id="add-student-first-name-err" className="text-rose-500 text-xs mt-1">{errors.firstName.message}</p>}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="add-student-last-name" className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <User size={14} className="text-brand-text-muted" /> {t('students.lastName')} <span className="text-rose-500">*</span>
            </label>
            <Input
              {...register('lastName')}
              id="add-student-last-name"
              autoComplete="family-name"
              aria-required="true"
              aria-invalid={!!errors.lastName}
              aria-describedby={errors.lastName ? 'add-student-last-name-err' : undefined}
              placeholder={t('students.lastNamePlaceholder')}
              className="bg-brand-bg-page/30 border-brand-border focus:bg-brand-bg-card transition-all"
            />
            {errors.lastName && <p id="add-student-last-name-err" className="text-rose-500 text-xs mt-1">{errors.lastName.message}</p>}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="add-student-id" className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <Hash size={14} className="text-brand-text-muted" /> {t('students.studentId')} <span className="text-rose-500">*</span>
            </label>
            <div className="flex gap-2">
              <Input
                {...register('studentId')}
                id="add-student-id"
                autoComplete="off"
                aria-required="true"
                aria-invalid={!!errors.studentId}
                aria-describedby={errors.studentId ? 'add-student-id-err' : undefined}
                placeholder={t('students.studentIdPlaceholder')}
                className="bg-brand-bg-page/30 border-brand-border focus:bg-brand-bg-card transition-all flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={generateStudentId}
                title={t('students.generateId')}
                aria-label={t('students.generateId')}
                className="shrink-0 px-3"
              >
                <RefreshCw size={16} />
              </Button>
            </div>
            {errors.studentId && <p id="add-student-id-err" className="text-rose-500 text-xs mt-1">{errors.studentId.message}</p>}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="add-student-email" className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <Mail size={14} className="text-brand-text-muted" /> {t('students.emailAddress')} <span className="text-rose-500">*</span>
            </label>
            <Input
              type="email"
              {...register('email')}
              id="add-student-email"
              autoComplete="email"
              aria-required="true"
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'add-student-email-err' : undefined}
              placeholder={t('students.emailPlaceholder')}
              className="bg-brand-bg-page/30 border-brand-border focus:bg-brand-bg-card transition-all"
            />
            {errors.email && <p id="add-student-email-err" className="text-rose-500 text-xs mt-1">{errors.email.message}</p>}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="add-student-password" className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <Lock size={14} className="text-brand-text-muted" /> {t('students.password')} <span className="text-rose-500">*</span>
            </label>
            <Input
              type="password"
              {...register('password')}
              id="add-student-password"
              autoComplete="new-password"
              aria-required="true"
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? 'add-student-password-err' : undefined}
              placeholder={t('students.passwordPlaceholder')}
              className="bg-brand-bg-page/30 border-brand-border focus:bg-brand-bg-card transition-all"
            />
            {errors.password && <p id="add-student-password-err" className="text-rose-500 text-xs mt-1">{errors.password.message}</p>}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="add-student-phone" className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <Phone size={14} className="text-brand-text-muted" /> {t('students.phoneNumber')}
            </label>
            <Input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              {...register('phone')}
              id="add-student-phone"
              aria-invalid={!!errors.phone}
              aria-describedby={errors.phone ? 'add-student-phone-err' : undefined}
              placeholder={t('students.phonePlaceholder')}
              className="bg-brand-bg-page/30 border-brand-border focus:bg-brand-bg-card transition-all"
            />
            {errors.phone && <p id="add-student-phone-err" className="text-rose-500 text-xs mt-1">{errors.phone.message}</p>}
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <label htmlFor="add-student-address" className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <MapPin size={14} className="text-brand-text-muted" /> {t('students.homeAddress')}
            </label>
            <textarea
              {...register('address')}
              id="add-student-address"
              autoComplete="street-address"
              rows={3}
              aria-invalid={!!errors.address}
              aria-describedby={errors.address ? 'add-student-address-err' : undefined}
              className="w-full px-4 py-2 bg-brand-bg-page/30 border border-brand-border rounded-xl text-sm text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-green/20 transition-all resize-none placeholder:text-brand-text-muted"
              placeholder={t('students.addressPlaceholder')}
            ></textarea>
            {errors.address && <p id="add-student-address-err" className="text-rose-500 text-xs mt-1">{errors.address.message}</p>}
          </div>

          <div className="border-t border-brand-border md:col-span-2 pt-4 mt-2">
            <h3 className="text-sm font-bold text-brand-text-main mb-4 flex items-center gap-2">
              <School size={16} className="text-brand-green" />
              {t('profile.academicInfo')}
            </h3>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="add-student-year" className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <Calendar size={14} className="text-brand-text-muted" /> {t('profile.year')} <span className="text-rose-500">*</span>
            </label>
            <select
              {...register('year')}
              id="add-student-year"
              aria-required="true"
              aria-invalid={!!errors.year}
              aria-describedby={errors.year ? 'add-student-year-err' : undefined}
              className="w-full h-10 px-4 bg-brand-bg-page/30 border border-brand-border rounded-xl text-sm text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-green/20 transition-all appearance-none cursor-pointer"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23132231'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: isRTL ? 'left 1rem center' : 'right 1rem center', backgroundSize: '1rem' }}
            >
              <option value="1">{t('auth.year1')}</option>
              <option value="2">{t('auth.year2')}</option>
              <option value="3">{t('auth.year3')}</option>
              <option value="4">{t('auth.year4')}</option>
            </select>
            {errors.year && <p id="add-student-year-err" className="text-rose-500 text-xs mt-1">{errors.year.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="add-student-college" className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <School size={14} className="text-brand-text-muted" /> {t('profile.college')} <span className="text-rose-500">*</span>
            </label>
            <select
              {...register('collegeId')}
              id="add-student-college"
              aria-required="true"
              aria-invalid={!!errors.collegeId}
              aria-describedby={errors.collegeId ? 'add-student-college-err' : undefined}
              className="w-full h-10 px-4 bg-brand-bg-page/30 border border-brand-border rounded-xl text-sm text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-green/20 transition-all appearance-none cursor-pointer"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23132231'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: isRTL ? 'left 1rem center' : 'right 1rem center', backgroundSize: '1rem' }}
            >
              <option value="">{t('auth.selectCollege')}</option>
              {colleges.map(college => (
                <option key={college.id} value={college.id}>{isRTL ? college.nameAr || college.name : college.name}</option>
              ))}
            </select>
            {errors.collegeId && <p id="add-student-college-err" className="text-rose-500 text-xs mt-1">{errors.collegeId.message}</p>}
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <label htmlFor="add-student-department" className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <GraduationCap size={14} className="text-brand-text-muted" /> {t('profile.department')} <span className="text-rose-500">*</span>
            </label>
            <select
              {...register('departmentId')}
              id="add-student-department"
              disabled={!watchCollegeId}
              aria-required="true"
              aria-invalid={!!errors.departmentId}
              aria-describedby={errors.departmentId ? 'add-student-department-err' : undefined}
              className="w-full h-10 px-4 bg-brand-bg-page/30 border border-brand-border rounded-xl text-sm text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-green/20 transition-all appearance-none cursor-pointer disabled:opacity-50"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23132231'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: isRTL ? 'left 1rem center' : 'right 1rem center', backgroundSize: '1rem' }}
            >
              <option value="">{t('auth.selectDept')}</option>
              {departments.map(dept => (
                <option key={dept.id} value={dept.id}>{isRTL ? dept.nameAr || dept.name : dept.name}</option>
              ))}
            </select>
            {errors.departmentId && <p id="add-student-department-err" className="text-rose-500 text-xs mt-1">{errors.departmentId.message}</p>}
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-3 border-t border-brand-border pt-6">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
            className="btn-outline"
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting}
            className="min-w-[140px]"
          >
            {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : t('students.createStudent')}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default AddStudentModal;
