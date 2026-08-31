import React, { useState, useEffect, useMemo } from 'react';
import studentsService from '../../services/students.service';
import collegeService from '../../services/college.service';
import departmentService from '../../services/department.service';
import Button from '../../components/ui/button';
import Input from '../../components/ui/input';
import Modal from '../../components/ui/Modal';
import {
  User,
  Mail,
  Phone,
  MapPin,
  AlertCircle,
  CheckCircle,
  School,
  GraduationCap,
  Hash,
  Calendar,
  Loader2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const schema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address').min(1, 'Email is required'),
  phone: z.string().optional(),
  address: z.string().optional(),
  gender: z.string().optional(),
  studentId: z.string().min(1, 'Student ID is required'),
  year: z.coerce.number().min(1, 'Academic division is required').max(4, 'Division must be between 1 and 4'),
  collegeId: z.coerce.number().min(1, 'College is required'),
  departmentId: z.coerce.number().min(1, 'Department is required'),
});

type FormData = z.infer<typeof schema>;

interface College {
  id: number;
  name: string;
  nameAr?: string;
}

interface Department {
  id: number;
  name: string;
  nameAr?: string;
  collegeId?: number;
  college?: { id: number; name: string; nameAr?: string };
}

interface StudentData {
  id: number;
  studentId: string;
  firstName: string;
  lastName: string;
  phone?: string;
  address?: string;
  gender?: string;
  year?: number;
  departmentId?: number;
  email?: string;
  user?: {
    email?: string;
    profilePicture?: string;
  };
  department?: {
    id: number;
    name: string;
    nameAr?: string;
    collegeId?: number;
    college?: { id: number; name: string; nameAr?: string };
  };
}

interface EditStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  student: StudentData | null;
}

const EditStudentModal: React.FC<EditStudentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  student,
}) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language?.startsWith('ar');

  const [colleges, setColleges] = useState<College[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loadingMetadata, setLoadingMetadata] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      address: '',
      gender: '',
      studentId: '',
      year: 1,
      collegeId: undefined,
      departmentId: undefined,
    },
  });

  const watchCollegeId = watch('collegeId');

  // Load colleges & departments once when modal opens
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setLoadingMetadata(true);

    Promise.all([
      collegeService.getColleges().catch(() => ({ success: false, data: [] })),
      departmentService.getDepartments().catch(() => ({ success: false, data: [] })),
    ])
      .then(([collegesRes, deptsRes]) => {
        if (!isMounted) return;

        if (collegesRes?.success) {
          const list = Array.isArray(collegesRes.data)
            ? collegesRes.data
            : collegesRes.data?.data || [];
          setColleges(list);
        }

        if (deptsRes?.success) {
          const list = Array.isArray(deptsRes.data)
            ? deptsRes.data
            : deptsRes.data?.data || [];
          setDepartments(list);
        }
      })
      .finally(() => {
        if (isMounted) setLoadingMetadata(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Pre-fill form values when student is supplied
  useEffect(() => {
    if (student) {
      const collegeId =
        student.department?.collegeId ||
        student.department?.college?.id ||
        (student.departmentId
          ? departments.find((d) => d.id === student.departmentId)?.collegeId
          : undefined);

      reset({
        firstName: student.firstName || '',
        lastName: student.lastName || '',
        email: student.user?.email || student.email || '',
        phone: student.phone || '',
        address: student.address || '',
        gender: student.gender || '',
        studentId: student.studentId || '',
        year: student.year || 1,
        collegeId: collegeId || undefined,
        departmentId: student.departmentId || undefined,
      });
    }
  }, [student, departments, reset]);

  // Filter available departments based on selected college
  const availableDepartments = useMemo(() => {
    if (!watchCollegeId) return [];
    const targetCollegeId = Number(watchCollegeId);
    return departments.filter(
      (dept) =>
        dept.collegeId === targetCollegeId ||
        dept.college?.id === targetCollegeId
    );
  }, [departments, watchCollegeId]);

  const showToast = (message: string, type: 'error' | 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const onSubmit = async (data: FormData) => {
    if (!student?.id) return;
    try {
      // Strip collegeId as it's not a direct column on the Student database model
      const { collegeId: _colId, ...payload } = data;
      const result = await studentsService.updateStudent(String(student.id), payload);

      if (result && result.success) {
        onSuccess();
      } else {
        showToast(result?.message || t('students.updateError'), 'error');
      }
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        t('students.updateError');
      showToast(errorMessage, 'error');
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${t('students.editTitle')}: ${student?.studentId || ''}`}
      subtitle={t('students.editDesc')}
      size="md"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {toast && (
          <div
            className={`p-4 rounded-xl text-white flex items-center gap-2 animate-in slide-in-from-top-2 duration-300 ${
              toast.type === 'error' ? 'bg-rose-500' : 'bg-brand-green'
            }`}
          >
            {toast.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
            <span className="font-medium text-sm">{toast.message}</span>
          </div>
        )}

        {/* Personal Information Section */}
        <div>
          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-brand-border">
            <User size={16} className="text-brand-green" />
            <h3 className="text-sm font-bold text-brand-text-main">
              {t('students.personalInformation', 'Personal Information')}
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-brand-text-main flex items-center gap-2">
                <User size={14} className="text-brand-text-muted" /> {t('students.firstName')}{' '}
                <span className="text-rose-500">*</span>
              </label>
              <Input
                {...register('firstName')}
                placeholder={t('students.firstNamePlaceholder')}
                className="bg-brand-bg-page/30 border-brand-border focus:bg-brand-bg-card transition-all"
              />
              {errors.firstName && (
                <p className="text-rose-500 text-xs mt-1">{errors.firstName.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-bold text-brand-text-main flex items-center gap-2">
                <User size={14} className="text-brand-text-muted" /> {t('students.lastName')}{' '}
                <span className="text-rose-500">*</span>
              </label>
              <Input
                {...register('lastName')}
                placeholder={t('students.lastNamePlaceholder')}
                className="bg-brand-bg-page/30 border-brand-border focus:bg-brand-bg-card transition-all"
              />
              {errors.lastName && (
                <p className="text-rose-500 text-xs mt-1">{errors.lastName.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-bold text-brand-text-main flex items-center gap-2">
                <Mail size={14} className="text-brand-text-muted" /> {t('students.emailAddress')}{' '}
                <span className="text-rose-500">*</span>
              </label>
              <Input
                type="email"
                {...register('email')}
                placeholder={t('students.emailPlaceholder')}
                className="bg-brand-bg-page/30 border-brand-border focus:bg-brand-bg-card transition-all"
              />
              {errors.email && (
                <p className="text-rose-500 text-xs mt-1">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-bold text-brand-text-main flex items-center gap-2">
                <Phone size={14} className="text-brand-text-muted" /> {t('students.phoneNumber')}
              </label>
              <Input
                {...register('phone')}
                placeholder={t('students.phonePlaceholder')}
                className="bg-brand-bg-page/30 border-brand-border focus:bg-brand-bg-card transition-all"
              />
              {errors.phone && (
                <p className="text-rose-500 text-xs mt-1">{errors.phone.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-bold text-brand-text-main flex items-center gap-2">
                <User size={14} className="text-brand-text-muted" /> {t('profile.gender', 'Gender')}
              </label>
              <select
                {...register('gender')}
                className="w-full h-10 px-4 bg-brand-bg-page/30 border border-brand-border rounded-xl text-sm text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-green/20 transition-all appearance-none cursor-pointer"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: isRTL ? 'left 1rem center' : 'right 1rem center',
                  backgroundSize: '1rem',
                }}
              >
                <option value="">{t('common.select', isRTL ? 'اختر الجنس' : 'Select gender')}</option>
                <option value="Male">{isRTL ? 'ذكر' : 'Male'}</option>
                <option value="Female">{isRTL ? 'أنثى' : 'Female'}</option>
                <option value="Other">{isRTL ? 'أخرى' : 'Other'}</option>
              </select>
            </div>

            <div className="md:col-span-2 space-y-1.5">
              <label className="text-sm font-bold text-brand-text-main flex items-center gap-2">
                <MapPin size={14} className="text-brand-text-muted" /> {t('students.homeAddress')}
              </label>
              <textarea
                {...register('address')}
                rows={2}
                className="w-full px-4 py-2 bg-brand-bg-page/30 border border-brand-border rounded-xl text-sm text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-green/20 transition-all resize-none placeholder:text-brand-text-muted"
                placeholder={t('students.addressPlaceholder')}
              />
              {errors.address && (
                <p className="text-rose-500 text-xs mt-1">{errors.address.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Academic Information Section */}
        <div>
          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-brand-border">
            <School size={16} className="text-brand-green" />
            <h3 className="text-sm font-bold text-brand-text-main">
              {t('profile.academicInfo', 'Academic Information')}
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-brand-text-main flex items-center gap-2">
                <Hash size={14} className="text-brand-text-muted" /> {t('profile.studentId')}{' '}
                <span className="text-rose-500">*</span>
              </label>
              <Input
                {...register('studentId')}
                placeholder={t('auth.studentIdPlaceholder')}
                className="bg-brand-bg-page/30 border-brand-border focus:bg-brand-bg-card transition-all"
              />
              {errors.studentId && (
                <p className="text-rose-500 text-xs mt-1">{errors.studentId.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-bold text-brand-text-main flex items-center gap-2">
                <Calendar size={14} className="text-brand-text-muted" /> {t('profile.year')}{' '}
                <span className="text-rose-500">*</span>
              </label>
              <select
                {...register('year')}
                className="w-full h-10 px-4 bg-brand-bg-page/30 border border-brand-border rounded-xl text-sm text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-green/20 transition-all appearance-none cursor-pointer"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: isRTL ? 'left 1rem center' : 'right 1rem center',
                  backgroundSize: '1rem',
                }}
              >
                <option value="1">{t('auth.year1', isRTL ? 'الفرقة الأولى' : 'First Division')}</option>
                <option value="2">{t('auth.year2', isRTL ? 'الفرقة الثانية' : 'Second Division')}</option>
                <option value="3">{t('auth.year3', isRTL ? 'الفرقة الثالثة' : 'Third Division')}</option>
                <option value="4">{t('auth.year4', isRTL ? 'الفرقة الرابعة' : 'Fourth Division')}</option>
              </select>
              {errors.year && (
                <p className="text-rose-500 text-xs mt-1">{errors.year.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-bold text-brand-text-main flex items-center gap-2">
                <School size={14} className="text-brand-text-muted" /> {t('profile.college')}{' '}
                <span className="text-rose-500">*</span>
              </label>
              <select
                {...register('collegeId', {
                  onChange: (e) => {
                    const newCollegeId = Number(e.target.value);
                    // If current department doesn't belong to the newly selected college, clear departmentId
                    const currentDeptId = watch('departmentId');
                    if (currentDeptId) {
                      const dept = departments.find((d) => d.id === Number(currentDeptId));
                      if (dept && (dept.collegeId || dept.college?.id) !== newCollegeId) {
                        setValue('departmentId', 0 as any);
                      }
                    }
                  },
                })}
                disabled={loadingMetadata}
                className="w-full h-10 px-4 bg-brand-bg-page/30 border border-brand-border rounded-xl text-sm text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-green/20 transition-all appearance-none cursor-pointer disabled:opacity-50"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: isRTL ? 'left 1rem center' : 'right 1rem center',
                  backgroundSize: '1rem',
                }}
              >
                <option value="">{t('auth.selectCollege')}</option>
                {colleges.map((college) => (
                  <option key={college.id} value={college.id}>
                    {isRTL ? college.nameAr || college.name : college.name}
                  </option>
                ))}
              </select>
              {errors.collegeId && (
                <p className="text-rose-500 text-xs mt-1">{errors.collegeId.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-bold text-brand-text-main flex items-center gap-2">
                <GraduationCap size={14} className="text-brand-text-muted" /> {t('profile.department')}{' '}
                <span className="text-rose-500">*</span>
              </label>
              <select
                {...register('departmentId')}
                disabled={!watchCollegeId || loadingMetadata}
                className="w-full h-10 px-4 bg-brand-bg-page/30 border border-brand-border rounded-xl text-sm text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-green/20 transition-all appearance-none cursor-pointer disabled:opacity-50"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: isRTL ? 'left 1rem center' : 'right 1rem center',
                  backgroundSize: '1rem',
                }}
              >
                <option value="">{t('auth.selectDept')}</option>
                {availableDepartments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {isRTL ? dept.nameAr || dept.name : dept.name}
                  </option>
                ))}
              </select>
              {errors.departmentId && (
                <p className="text-rose-500 text-xs mt-1">{errors.departmentId.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-brand-border flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
            className="btn-outline px-5"
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting}
            className="min-w-[140px] px-6"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="animate-spin" size={16} />
                <span>{t('common.saving', isRTL ? 'جاري الحفظ...' : 'Saving...')}</span>
              </span>
            ) : (
              t('common.save')
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default EditStudentModal;
