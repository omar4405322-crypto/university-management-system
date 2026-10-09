import React, { useState } from 'react';
import { useToast } from '../../context/ToastContext';
import teachingAssistantsService from '../../services/teachingAssistants.service';
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
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    employeeId: '',
    email: '',
    password: '',
    phone: '',
    specialization: '',
  });
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
    if (!formData.email.trim()) errs.email = required;
    if (!formData.password) {
      errs.password = required;
    } else if (!isStrongPassword(formData.password)) {
      errs.password = t('auth.passwordPolicyError', 'Password must be at least 8 characters with uppercase, lowercase, and a number');
    }
    setFieldErrors(errs);
    const order = ['firstName', 'lastName', 'employeeId', 'email', 'password'];
    const firstInvalid = order.find((k) => errs[k]);
    if (firstInvalid) {
      const ids: Record<string, string> = {
        firstName: 'add-ta-first-name',
        lastName: 'add-ta-last-name',
        employeeId: 'add-ta-employee-id',
        email: 'add-ta-email',
        password: 'add-ta-password',
      };
      document.getElementById(ids[firstInvalid])?.focus();
      return;
    }

    try {
      setLoading(true);
      const result = await teachingAssistantsService.createTeachingAssistant(formData);
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
          <div className="md:col-span-2 space-y-1.5">
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
