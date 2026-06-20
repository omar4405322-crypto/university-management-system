// FIXED: Student-only registration, i18n, optional phone - Phase 4 / Phase 6
// CONVERTED: useState form fields → React Hook Form + Zod
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../context/AuthContext';
import departmentService from '../services/department.service';
import collegeService from '../services/college.service';
import {
  UserPlus,
  Mail,
  Lock,
  User,
  GraduationCap,
  AlertCircle,
  Clock,
  School,
  Hash,
  Calendar,
  ChevronDown,
  Phone,
  Eye,
  EyeOff,
  Loader2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { logger } from '../lib/logger';

// ── Zod schema ──────────────────────────────────────────────────────────────
const registerSchema = z.object({
  firstName: z.string().min(2, { message: 'First name is required' }),
  lastName: z.string().min(2, { message: 'Last name is required' }),
  email: z.string().email({ message: 'Please enter a valid email address' }),
  phone: z.string().optional(),
  password: z.string().min(6, { message: 'Password must be at least 6 characters' }),
  collegeId: z.string().min(1, { message: 'College is required' }),
  departmentId: z.string().min(1, { message: 'Department is required' }),
  studentId: z.string().min(1, { message: 'Student ID is required' }),
  year: z.string().min(1, { message: 'Year is required' }),
});

type RegisterFormData = z.infer<typeof registerSchema>;

// ── Component ────────────────────────────────────────────────────────────────
const Register = () => {
  const { t } = useTranslation();

  // UI-only state
  const [colleges, setColleges] = useState<Array<{ id: number; name: string }>>([]);
  const [departments, setDepartments] = useState<Array<{ id: number; name: string }>>([]);
  const [apiError, setApiError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { register: registerAuth } = useAuth();
  const navigate = useNavigate();

  // ── React Hook Form setup ──────────────────────────────────────────────────
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      password: '',
      collegeId: '',
      departmentId: '',
      studentId: '',
      year: '1',
    },
  });

  const selectedCollegeId = watch('collegeId');

  // ── Data Fetching ─────────────────────────────────────────────────────────
  useEffect(() => {
    const controller = new AbortController();

    const fetchColleges = async () => {
      try {
        const result = await collegeService.getColleges({ signal: controller.signal });
        if (result.success) {
          setColleges(result.data || []);
        }
      } catch (err: unknown) {
        const e = err as { __isCanceled?: boolean };
        if (!e.__isCanceled) {
          logger.error('Error fetching colleges:', err);
        }
      }
    };
    fetchColleges();

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!selectedCollegeId) {
      setDepartments([]);
      return;
    }

    const controller = new AbortController();

    const fetchDepartments = async () => {
      try {
        const result = await departmentService.getDepartments(
          { collegeId: selectedCollegeId },
          { signal: controller.signal }
        );
        if (result.success) {
          setDepartments(result.data || []);
        }
      } catch (err: unknown) {
        const e = err as { __isCanceled?: boolean };
        if (!e.__isCanceled) {
          logger.error('Error fetching departments:', err);
        }
      }
    };
    fetchDepartments();

    return () => controller.abort();
  }, [selectedCollegeId]);

  // ── Submit ────────────────────────────────────────────────────────────────
  const onSubmit = async (data: RegisterFormData) => {
    setApiError('');
    setSubmitted(false);

    try {
      const payload = {
        ...data,
        collegeId: parseInt(data.collegeId, 10),
        departmentId: parseInt(data.departmentId, 10),
        year: parseInt(data.year, 10),
        role: 'STUDENT',
      };

      const result = await registerAuth(payload);

      if (result.success) {
        setSubmitted(true);
        reset();
      } else {
        setApiError(result.message || t('auth.regError'));
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      setApiError(e.message || t('common.errorOccurred'));
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-bg-page px-4">
        <div className="max-w-lg w-full bg-brand-bg-card rounded-3xl border border-brand-border p-10 text-center shadow-2xl">
          <div className="w-20 h-20 rounded-full bg-brand-green/10 flex items-center justify-center mx-auto mb-6">
            <Clock size={40} className="text-brand-green" />
          </div>
          <h2 className="text-2xl font-black text-brand-text-main mb-3">
            {t('auth.regPendingTitle')}
          </h2>
          <p className="text-brand-text-sub font-bold leading-relaxed mb-8">
            {t('auth.regPendingReview')}
          </p>
          <Button onClick={() => navigate('/login')} className="w-full">
            {t('auth.backToLogin')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-bg-page relative overflow-hidden py-12 px-4">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-brand-green/5 blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-brand-navy/5 blur-[120px]" />
      </div>

      <div className="w-full max-w-[560px] relative z-10">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center mb-6">
            <img src="/assets/university/logo.svg" alt="University Logo" loading="lazy" decoding="async" className="h-20 w-auto" />
          </div>
          <h1 className="tracking-tight">{t('auth.universityName')}</h1>
          <p className="text-brand-text-sub mt-2 font-medium">
            {t('auth.registerStudentSubtitle')}
          </p>
        </div>

        <div className="bg-brand-bg-card rounded-3xl shadow-2xl shadow-brand-navy/10 p-8 md:p-10 border border-brand-border/10">
          <form className="form-section" onSubmit={handleSubmit(onSubmit)}>
            {apiError && (
              <div className="p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-100 rounded-2xl text-rose-600 text-sm font-medium flex items-center gap-3">
                <AlertCircle size={20} className="shrink-0" />
                <span>{apiError}</span>
              </div>
            )}

            <div className="p-4 bg-brand-accent-yellow/10 border border-brand-accent-yellow/30 rounded-2xl text-sm font-bold text-brand-text-main">
              {t(
                'auth.regReviewNotice',
                'Accounts are not active until an administrator approves your request.'
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-brand-text-sub font-bold text-brand-text-main ml-1">
                  {t('auth.firstName')} *
                </label>
                <div className="relative group">
                  <User
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-text-muted z-10"
                    size={18}
                  />
                  <Input
                    {...register('firstName')}
                    type="text"
                    placeholder={t('auth.firstNamePlaceholder')}
                    className="pl-12 h-12"
                    error={!!errors.firstName}
                  />
                </div>
                {errors.firstName && (
                  <p className="text-red-500 text-xs mt-1">{errors.firstName.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-brand-text-sub font-bold text-brand-text-main ml-1">
                  {t('auth.lastName')} *
                </label>
                <div className="relative group">
                  <User
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-text-muted z-10"
                    size={18}
                  />
                  <Input
                    {...register('lastName')}
                    type="text"
                    placeholder={t('auth.lastNamePlaceholder')}
                    className="pl-12 h-12"
                    error={!!errors.lastName}
                  />
                </div>
                {errors.lastName && (
                  <p className="text-red-500 text-xs mt-1">{errors.lastName.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-brand-text-sub font-bold text-brand-text-main ml-1">
                {t('auth.emailAddress')} *
              </label>
              <div className="relative group">
                <Mail
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-text-muted z-10"
                  size={18}
                />
                <Input
                  {...register('email')}
                  type="email"
                  autoComplete="off"
                  placeholder={t('auth.emailPlaceholder')}
                  className="pl-12 h-12"
                  error={!!errors.email}
                />
              </div>
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-brand-text-sub font-bold text-brand-text-main ml-1">
                {t('profile.phone')}
              </label>
              <div className="relative group">
                <Phone
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-text-muted z-10"
                  size={18}
                />
                <Input
                  {...register('phone')}
                  type="tel"
                  placeholder={t('students.phonePlaceholder')}
                  className="pl-12 h-12"
                  error={!!errors.phone}
                />
              </div>
              {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone.message}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-brand-text-sub font-bold text-brand-text-main ml-1">
                {t('auth.password')} *
              </label>
              <div className="relative group">
                <Lock
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-text-muted z-10 rtl:left-auto rtl:right-4"
                  size={18}
                />
                <Input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  placeholder={t('auth.passwordPlaceholder')}
                  className="pl-12 pr-12 h-12 rtl:pr-12 rtl:pl-12"
                  error={!!errors.password}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 z-10 rtl:right-auto rtl:left-4 text-brand-text-muted hover:text-brand-text-primary transition-colors"
                  aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-brand-text-sub font-bold text-brand-text-main ml-1">
                  {t('auth.college')} *
                </label>
                <div className="relative group">
                  <School
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-text-muted z-10"
                    size={18}
                  />
                  <Select
                    {...register('collegeId')}
                    className={`w-full h-12 pl-12 pr-12 bg-brand-bg-page/30 border ${errors.collegeId ? 'border-red-500' : 'border-brand-border'} rounded-xl font-bold appearance-none cursor-pointer`}
                  >
                    <option value="">{t('auth.selectCollege')}</option>
                    {colleges.map((college) => (
                      <option key={college.id} value={college.id}>
                        {college.name}
                      </option>
                    ))}
                  </Select>
                  <ChevronDown
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-text-muted pointer-events-none"
                    size={18}
                  />
                </div>
                {errors.collegeId && (
                  <p className="text-red-500 text-xs mt-1">{errors.collegeId.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-brand-text-sub font-bold text-brand-text-main ml-1">
                  {t('auth.department')} *
                </label>
                <div className="relative group">
                  <GraduationCap
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-text-muted z-10"
                    size={18}
                  />
                  <Select
                    {...register('departmentId')}
                    disabled={!selectedCollegeId}
                    className={`w-full h-12 pl-12 pr-12 bg-brand-bg-page/30 border ${errors.departmentId ? 'border-red-500' : 'border-brand-border'} rounded-xl font-bold appearance-none cursor-pointer disabled:opacity-50`}
                  >
                    <option value="">{t('auth.selectDept')}</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))}
                  </Select>
                  <ChevronDown
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-text-muted pointer-events-none"
                    size={18}
                  />
                </div>
                {errors.departmentId && (
                  <p className="text-red-500 text-xs mt-1">{errors.departmentId.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-brand-text-sub font-bold text-brand-text-main ml-1">
                  {t('auth.studentId')} *
                </label>
                <div className="relative group">
                  <Hash
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-text-muted z-10"
                    size={18}
                  />
                  <Input
                    {...register('studentId')}
                    type="text"
                    placeholder={t('auth.studentIdPlaceholder')}
                    className="pl-12 h-12"
                    error={!!errors.studentId}
                  />
                </div>
                {errors.studentId && (
                  <p className="text-red-500 text-xs mt-1">{errors.studentId.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-brand-text-sub font-bold text-brand-text-main ml-1">
                  {t('auth.year')} *
                </label>
                <div className="relative group">
                  <Calendar
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-text-muted z-10"
                    size={18}
                  />
                  <Select
                    {...register('year')}
                    className={`w-full h-12 pl-12 pr-12 bg-brand-bg-page/30 border ${errors.year ? 'border-red-500' : 'border-brand-border'} rounded-xl font-bold appearance-none cursor-pointer`}
                  >
                    <option value="1">{t('auth.year1')}</option>
                    <option value="2">{t('auth.year2')}</option>
                    <option value="3">{t('auth.year3')}</option>
                    <option value="4">{t('auth.year4')}</option>
                    <option value="5">{t('auth.year5')}</option>
                  </Select>
                  <ChevronDown
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-text-muted pointer-events-none"
                    size={18}
                  />
                </div>
                {errors.year && <p className="text-red-500 text-xs mt-1">{errors.year.message}</p>}
              </div>
            </div>

            <Button type="submit" disabled={isSubmitting} className="w-full h-12 rounded-2xl mt-4">
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  {t('auth.submittingApplication', 'Submitting...')}
                </>
              ) : (
                <>
                  {t('auth.submitApplication', 'Submit Application')}
                  <UserPlus size={18} />
                </>
              )}
            </Button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-sm text-brand-text-sub font-medium">
              {t('auth.alreadyHaveAccount')}{' '}
              <Link to="/login" className="text-brand-green font-bold">
                {t('auth.loginHere')}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
