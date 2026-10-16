import React, { useState, useEffect } from 'react';
import { useToast } from '../../context/ToastContext';
import teachingAssistantsService from '../../services/teachingAssistants.service';
import departmentService from '../../services/department.service';
import useScope from '../../hooks/useScope';
import Button from '../../components/ui/button';
import Input from '../../components/ui/input';
import { useTranslation } from 'react-i18next';
import {
  User,
  Mail,
  Lock,
  Phone,
  Briefcase,
  Hash,
  Building2,
  Loader2,
} from 'lucide-react';
import Modal from '../../components/ui/Modal';

interface AddTAModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const AddTAModal: React.FC<AddTAModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { isCollegeAdmin, isDeptAdmin, effectiveCollegeId, effectiveDepartmentId } = useScope();

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    employeeId: '',
    departmentId: '',
    email: '',
    password: '',
    phone: '',
    specialization: '',
  });
  const [departments, setDepartments] = useState<any[]>([]);
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const fetchDepartments = async () => {
      setLoadingDepartments(true);
      try {
        const params: Record<string, unknown> = {};
        if (isCollegeAdmin && effectiveCollegeId) {
          params.collegeId = effectiveCollegeId;
        }
        const res = await departmentService.getDepartments(params);
        if (isMounted && res.success) {
          const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
          if (isDeptAdmin && effectiveDepartmentId) {
            const filtered = list.filter((d: any) => String(d.id) === String(effectiveDepartmentId));
            setDepartments(filtered);
            setFormData((prev) => ({ ...prev, departmentId: String(effectiveDepartmentId) }));
          } else {
            setDepartments(list);
          }
        }
      } catch (err) {
        console.error('Failed to load departments', err);
      } finally {
        if (isMounted) setLoadingDepartments(false);
      }
    };

    fetchDepartments();
    return () => {
      isMounted = false;
    };
  }, [isOpen, isCollegeAdmin, isDeptAdmin, effectiveCollegeId, effectiveDepartmentId]);

  useEffect(() => {
    if (isOpen) {
      setFormData({
        firstName: '',
        lastName: '',
        employeeId: '',
        departmentId: isDeptAdmin && effectiveDepartmentId ? String(effectiveDepartmentId) : '',
        email: '',
        password: '',
        phone: '',
        specialization: '',
      });
      setFieldErrors({});
    }
  }, [isOpen, isDeptAdmin, effectiveDepartmentId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) setFieldErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const fieldProps = (name: string) => ({
    'aria-invalid': !!fieldErrors[name],
    'aria-describedby': fieldErrors[name] ? `add-ta-${name}-err` : undefined,
  });

  const fieldError = (name: string) =>
    fieldErrors[name] ? (
      <p id={`add-ta-${name}-err`} role="alert" className="text-rose-500 text-xs mt-1">
        {fieldErrors[name]}
      </p>
    ) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    const required = t('teachingAssistants.fillRequired');
    const isStrongPassword = (pwd: string) =>
      pwd.length >= 8 && /[A-Z]/.test(pwd) && /[a-z]/.test(pwd) && /\d/.test(pwd);

    const errs: Record<string, string> = {};
    if (!formData.firstName.trim()) errs.firstName = required;
    if (!formData.lastName.trim()) errs.lastName = required;
    if (!formData.employeeId.trim()) errs.employeeId = required;
    if (!formData.departmentId) errs.departmentId = required;
    if (!formData.email.trim()) errs.email = required;
    if (!formData.password) {
      errs.password = required;
    } else if (!isStrongPassword(formData.password)) {
      errs.password = t('auth.passwordPolicyError', 'Password must be at least 8 characters with uppercase, lowercase, and a number');
    }
    setFieldErrors(errs);
    const order = ['firstName', 'lastName', 'employeeId', 'departmentId', 'email', 'password'];
    const firstInvalid = order.find((k) => errs[k]);
    if (firstInvalid) {
      const ids: Record<string, string> = {
        firstName: 'add-ta-first-name',
        lastName: 'add-ta-last-name',
        employeeId: 'add-ta-employee-id',
        departmentId: 'add-ta-department-id',
        email: 'add-ta-email',
        password: 'add-ta-password',
      };
      document.getElementById(ids[firstInvalid])?.focus();
      return;
    }

    try {
      setLoading(true);
      const payload: Record<string, unknown> = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        employeeId: formData.employeeId.trim(),
        departmentId: Number(formData.departmentId),
        email: formData.email.trim(),
        password: formData.password,
        phone: formData.phone.trim() || undefined,
        specialization: formData.specialization.trim() || undefined,
      };
      const result = await teachingAssistantsService.createTeachingAssistant(payload);
      if (result.success) {
        showToast(t('teachingAssistants.addSuccess', 'Teaching assistant created successfully'), 'success');
        onSuccess();
      } else {
        showToast(result.message || t('teachingAssistants.createError'), 'error');
      }
    } catch (error: any) {
      showToast(error.response?.data?.message || t('teachingAssistants.createError'), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('teachingAssistants.addNew')}
      subtitle={t('teachingAssistants.addDesc')}
    >
      <form onSubmit={handleSubmit} noValidate className="form-section">

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <label htmlFor="add-ta-first-name" className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <User size={14} className="text-brand-text-muted" /> {t('students.firstName')}{' '}
              <span className="text-rose-500">*</span>
            </label>
            <Input
              id="add-ta-first-name"
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
              autoComplete="given-name"
              placeholder={t('students.firstNamePlaceholder')}
              required
              aria-required="true"
              className="bg-brand-bg-page/30 border-brand-border focus:bg-brand-bg-card transition-all"
              {...fieldProps('firstName')}
            />
            {fieldError('firstName')}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="add-ta-last-name" className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <User size={14} className="text-brand-text-muted" /> {t('students.lastName')}{' '}
              <span className="text-rose-500">*</span>
            </label>
            <Input
              id="add-ta-last-name"
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
              autoComplete="family-name"
              placeholder={t('students.lastNamePlaceholder')}
              required
              aria-required="true"
              className="bg-brand-bg-page/30 border-brand-border focus:bg-brand-bg-card transition-all"
              {...fieldProps('lastName')}
            />
            {fieldError('lastName')}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="add-ta-employee-id" className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <Hash size={14} className="text-brand-text-muted" /> {t('teachingAssistants.employeeId')}{' '}
              <span className="text-rose-500">*</span>
            </label>
            <Input
              id="add-ta-employee-id"
              name="employeeId"
              value={formData.employeeId}
              onChange={handleChange}
              autoComplete="off"
              placeholder={t('teachingAssistants.employeeIdPlaceholder')}
              required
              aria-required="true"
              className="bg-brand-bg-page/30 border-brand-border focus:bg-brand-bg-card transition-all"
              {...fieldProps('employeeId')}
            />
            {fieldError('employeeId')}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="add-ta-department-id" className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <Building2 size={14} className="text-brand-text-muted" /> {t('departments.department', 'Department')}{' '}
              <span className="text-rose-500">*</span>
            </label>
            <select
              id="add-ta-department-id"
              name="departmentId"
              value={formData.departmentId}
              onChange={handleChange}
              disabled={isDeptAdmin || loadingDepartments}
              required
              aria-required="true"
              className="w-full px-4 py-2.5 rounded-xl border border-brand-border bg-brand-bg-page/30 text-brand-text-primary dark:text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 focus:border-brand-primary-500 transition-all cursor-pointer text-sm appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
              {...fieldProps('departmentId')}
            >
              <option value="">{t('departments.selectDepartment', 'Select Department')}</option>
              {departments.map((dept: any) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
            {fieldError('departmentId')}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="add-ta-specialization" className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <Briefcase size={14} className="text-brand-text-muted" /> {t('teachingAssistants.specialization')}
            </label>
            <Input
              id="add-ta-specialization"
              name="specialization"
              value={formData.specialization}
              onChange={handleChange}
              placeholder={t('teachingAssistants.specializationPlaceholder')}
              className="bg-brand-bg-page/30 border-brand-border focus:bg-brand-bg-card transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="add-ta-email" className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <Mail size={14} className="text-brand-text-muted" /> {t('profile.email')}{' '}
              <span className="text-rose-500">*</span>
            </label>
            <Input
              id="add-ta-email"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              autoComplete="email"
              placeholder={t('teachingAssistants.emailPlaceholder')}
              required
              aria-required="true"
              className="bg-brand-bg-page/30 border-brand-border focus:bg-brand-bg-card transition-all"
              {...fieldProps('email')}
            />
            {fieldError('email')}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="add-ta-password" className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <Lock size={14} className="text-brand-text-muted" /> {t('profile.password')}{' '}
              <span className="text-rose-500">*</span>
            </label>
            <Input
              id="add-ta-password"
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              autoComplete="new-password"
              placeholder={t('teachingAssistants.passwordPlaceholder')}
              required
              aria-required="true"
              className="bg-brand-bg-page/30 border-brand-border focus:bg-brand-bg-card transition-all"
              {...fieldProps('password')}
            />
            {fieldError('password')}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="add-ta-phone" className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <Phone size={14} className="text-brand-text-muted" /> {t('profile.phone')}
            </label>
            <Input
              id="add-ta-phone"
              type="tel" dir="ltr"
              inputMode="tel"
              autoComplete="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder={t('students.phonePlaceholder')}
              className="bg-brand-bg-page/30 border-brand-border focus:bg-brand-bg-card transition-all"
            />
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-3 border-t border-brand-border pt-6">
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={loading} className="min-w-[140px]">
            {loading ? <Loader2 className="animate-spin" size={20} /> : t('teachingAssistants.createTA')}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default AddTAModal;
