// @ts-nocheck
// FIXED: isOpen prop, auto-generate student ID, strip collegeId on POST - Phase 5
import React, { useState, useEffect } from 'react';
import studentsService from '../../services/students.service';
import collegeService from '../../services/college.service';
import departmentService from '../../services/department.service';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { User, Mail, Lock, Phone, MapPin, Hash, AlertCircle, CheckCircle, School, GraduationCap, Calendar, Loader2, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import Modal from '../../components/ui/Modal';
import { logger } from '../../lib/logger';
import { useToast } from '../../context/ToastContext';

const schema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  studentId: z.string().min(1, 'Student ID is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  phone: z.string().optional(),
  address: z.string().optional(),
  year: z.coerce.number().min(1),
  collegeId: z.coerce.number().min(1, 'College is required'),
  departmentId: z.coerce.number().min(1, 'Department is required'),
});

type FormData = z.infer<typeof schema>;

const AddStudentModal = ({ isOpen, onClose, onSuccess }) => {
  const { t } = useTranslation();
  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
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

  const [colleges, setColleges] = useState([]);
  const [departments, setDepartments] = useState([]);
  const { showToast } = useToast();

  const watchCollegeId = watch('collegeId');

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


  const generateStudentId = () => {
    const year = new Date().getFullYear();
    const suffix = String(Math.floor(1000 + Math.random() * 9000));
    setValue('studentId', `${year}${suffix}`);
  };

  const onSubmit = async (data: FormData) => {
    try {
      const { collegeId, ...payload } = data;
      const result = await studentsService.createStudent(payload);
      if (result.success) {
        onSuccess();
      } else {
        showToast(result.message || t('students.createError'), 'error');
      }
    } catch (error: any) {
      showToast(error.response?.data?.message || t('students.createError'), 'error');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('students.addNew')}
      subtitle={t('students.addDesc')}
    >
      <form onSubmit={handleSubmit(onSubmit as any)} className="form-section">
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <User size={14} className="text-brand-text-muted" /> {t('students.firstName')} <span className="text-rose-500">*</span>
            </label>
            <Input
              {...register('firstName')}
              placeholder={t('students.firstNamePlaceholder')}
              className="bg-brand-bg-page/30 border-brand-border focus:bg-brand-bg-card transition-all"
            />
            {errors.firstName && <p className="text-rose-500 text-xs mt-1">{errors.firstName.message}</p>}
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <User size={14} className="text-brand-text-muted" /> {t('students.lastName')} <span className="text-rose-500">*</span>
            </label>
            <Input
              {...register('lastName')}
              placeholder={t('students.lastNamePlaceholder')}
              className="bg-brand-bg-page/30 border-brand-border focus:bg-brand-bg-card transition-all"
            />
            {errors.lastName && <p className="text-rose-500 text-xs mt-1">{errors.lastName.message}</p>}
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <Hash size={14} className="text-brand-text-muted" /> {t('students.studentId')} <span className="text-rose-500">*</span>
            </label>
            <div className="flex gap-2">
              <Input
                {...register('studentId')}
                placeholder={t('students.studentIdPlaceholder')}
                className="bg-brand-bg-page/30 border-brand-border focus:bg-brand-bg-card transition-all flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={generateStudentId}
                title={t('students.generateId')}
                className="shrink-0 px-3"
              >
                <RefreshCw size={16} />
              </Button>
            </div>
            {errors.studentId && <p className="text-rose-500 text-xs mt-1">{errors.studentId.message}</p>}
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <Mail size={14} className="text-brand-text-muted" /> {t('students.emailAddress')} <span className="text-rose-500">*</span>
            </label>
            <Input
              type="email"
              {...register('email')}
              placeholder={t('students.emailPlaceholder')}
              className="bg-brand-bg-page/30 border-brand-border focus:bg-brand-bg-card transition-all"
            />
            {errors.email && <p className="text-rose-500 text-xs mt-1">{errors.email.message}</p>}
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <Lock size={14} className="text-brand-text-muted" /> {t('students.password')} <span className="text-rose-500">*</span>
            </label>
            <Input
              type="password"
              {...register('password')}
              placeholder={t('students.passwordPlaceholder')}
              className="bg-brand-bg-page/30 border-brand-border focus:bg-brand-bg-card transition-all"
            />
            {errors.password && <p className="text-rose-500 text-xs mt-1">{errors.password.message}</p>}
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <Phone size={14} className="text-brand-text-muted" /> {t('students.phoneNumber')}
            </label>
            <Input
              {...register('phone')}
              placeholder={t('students.phonePlaceholder')}
              className="bg-brand-bg-page/30 border-brand-border focus:bg-brand-bg-card transition-all"
            />
            {errors.phone && <p className="text-rose-500 text-xs mt-1">{errors.phone.message}</p>}
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <Textarea
              {...register('address')}
              label={<><MapPin size={14} className="text-brand-text-muted" /> {t('students.homeAddress')}</>}
              rows={3}
              placeholder={t('students.addressPlaceholder')}
              error={errors.address?.message}
            />
          </div>

          <div className="border-t border-brand-border md:col-span-2 pt-4 mt-2">
            <h3 className="text-sm font-bold text-brand-text-main mb-4 flex items-center gap-2">
              <School size={16} className="text-brand-green" />
              {t('profile.academicInfo')}
            </h3>
          </div>

          <div className="space-y-1.5">
            <Select
              {...register('year')}
              label={<><Calendar size={14} className="text-brand-text-muted" /> {t('profile.year')} <span className="text-rose-500">*</span></>}
              error={errors.year?.message}
            >
              <option value="1">{t('auth.year1')}</option>
              <option value="2">{t('auth.year2')}</option>
              <option value="3">{t('auth.year3')}</option>
              <option value="4">{t('auth.year4')}</option>
              <option value="5">{t('auth.year5')}</option>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Select
              {...register('collegeId')}
              label={<><School size={14} className="text-brand-text-muted" /> {t('profile.college')} <span className="text-rose-500">*</span></>}
              error={errors.collegeId?.message}
            >
              <option value="">{t('auth.selectCollege')}</option>
              {colleges.map(college => (
                <option key={college.id} value={college.id}>{college.name}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Select
              {...register('departmentId')}
              disabled={!watchCollegeId}
              label={<><GraduationCap size={14} className="text-brand-text-muted" /> {t('profile.department')} <span className="text-rose-500">*</span></>}
              error={errors.departmentId?.message}
            >
              <option value="">{t('auth.selectDept')}</option>
              {departments.map(dept => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </Select>
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
            {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : t('students.createStudent')}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default AddStudentModal;
