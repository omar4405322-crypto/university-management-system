import React, { useState, useEffect } from 'react';
import { useToast } from '../../context/ToastContext';
import teachingAssistantsService from '../../services/teachingAssistants.service';
import departmentService from '../../services/department.service';
import useScope from '../../hooks/useScope';
import Button from '../../components/ui/button';
import Input from '../../components/ui/input';
import { useTranslation } from 'react-i18next';
import { User, Phone, Briefcase, Building2, Loader2 } from 'lucide-react';
import Modal from '../../components/ui/Modal';

import type { TeachingAssistantRow } from '../../types/domain';

interface EditTAModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  ta: TeachingAssistantRow;
}

const EditTAModal: React.FC<EditTAModalProps> = ({ isOpen, onClose, onSuccess, ta }) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { isCollegeAdmin, isDeptAdmin, effectiveCollegeId, effectiveDepartmentId } = useScope();

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    specialization: '',
    departmentId: '',
  });
  const [departments, setDepartments] = useState<any[]>([]);
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

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
    if (ta) {
      setFormData({
        firstName: ta.firstName || '',
        lastName: ta.lastName || '',
        phone: ta.phone || '',
        specialization: ta.specialization || '',
        departmentId: ta.departmentId
          ? String(ta.departmentId)
          : ta.department?.id
          ? String(ta.department.id)
          : isDeptAdmin && effectiveDepartmentId
          ? String(effectiveDepartmentId)
          : '',
      });
      setFieldErrors({});
    }
  }, [ta, isDeptAdmin, effectiveDepartmentId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) setFieldErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const fieldProps = (name: string) => ({
    'aria-invalid': !!fieldErrors[name],
    'aria-describedby': fieldErrors[name] ? `edit-ta-${name}-err` : undefined,
  });

  const fieldError = (name: string) =>
    fieldErrors[name] ? (
      <p id={`edit-ta-${name}-err`} role="alert" className="text-rose-500 text-xs mt-1">
        {fieldErrors[name]}
      </p>
    ) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    const required = t('teachingAssistants.fillRequired');
    const errs: Record<string, string> = {};
    if (!formData.firstName.trim()) errs.firstName = required;
    if (!formData.lastName.trim()) errs.lastName = required;
    if (!formData.departmentId) errs.departmentId = required;
    setFieldErrors(errs);
    const order = ['firstName', 'lastName', 'departmentId'];
    const firstInvalid = order.find((k) => errs[k]);
    if (firstInvalid) {
      const ids: Record<string, string> = {
        firstName: 'edit-ta-first-name',
        lastName: 'edit-ta-last-name',
        departmentId: 'edit-ta-department-id',
      };
      document.getElementById(ids[firstInvalid])?.focus();
      return;
    }

    try {
      setLoading(true);
      const payload: Record<string, unknown> = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        phone: formData.phone.trim() || undefined,
        specialization: formData.specialization.trim() || undefined,
        departmentId: Number(formData.departmentId),
      };
      const result = await teachingAssistantsService.updateTeachingAssistant(String(ta.id), payload);
      if (result.success) {
        showToast(t('teachingAssistants.updateSuccess', 'Teaching assistant updated successfully'), 'success');
        onSuccess();
      } else {
        showToast(result.message || t('teachingAssistants.updateError'), 'error');
      }
    } catch (error: any) {
      showToast(error.response?.data?.message || t('teachingAssistants.updateError'), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${t('teachingAssistants.editTitle')}: ${ta?.employeeId ?? ''}`}
      subtitle={t('teachingAssistants.editDesc')}
    >
      <form onSubmit={handleSubmit} noValidate className="form-section">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <label htmlFor="edit-ta-first-name" className="text-sm font-semibold text-brand-text-primary flex items-center gap-2 ml-1">
              <User size={14} className="text-brand-text-muted" aria-hidden="true" /> {t('students.firstName')}{' '}
              <span className="text-error" aria-hidden="true">*</span>
            </label>
            <Input
              id="edit-ta-first-name"
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
              autoComplete="given-name"
              placeholder={t('students.firstNamePlaceholder')}
              required
              aria-required="true"
              {...fieldProps('firstName')}
            />
            {fieldError('firstName')}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="edit-ta-last-name" className="text-sm font-semibold text-brand-text-primary flex items-center gap-2 ml-1">
              <User size={14} className="text-brand-text-muted" aria-hidden="true" /> {t('students.lastName')}{' '}
              <span className="text-error" aria-hidden="true">*</span>
            </label>
            <Input
              id="edit-ta-last-name"
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
              autoComplete="family-name"
              placeholder={t('students.lastNamePlaceholder')}
              required
              aria-required="true"
              {...fieldProps('lastName')}
            />
            {fieldError('lastName')}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="edit-ta-department-id" className="text-sm font-semibold text-brand-text-primary flex items-center gap-2 ml-1">
              <Building2 size={14} className="text-brand-text-muted" aria-hidden="true" /> {t('departments.department', 'Department')}{' '}
              <span className="text-error" aria-hidden="true">*</span>
            </label>
            <select
              id="edit-ta-department-id"
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
            <label htmlFor="edit-ta-specialization" className="text-sm font-semibold text-brand-text-primary flex items-center gap-2 ml-1">
              <Briefcase size={14} className="text-brand-text-muted" aria-hidden="true" /> {t('teachingAssistants.specialization')}
            </label>
            <Input
              id="edit-ta-specialization"
              name="specialization"
              value={formData.specialization}
              onChange={handleChange}
              placeholder={t('teachingAssistants.specializationPlaceholder')}
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <label htmlFor="edit-ta-phone" className="text-sm font-semibold text-brand-text-primary flex items-center gap-2 ml-1">
              <Phone size={14} className="text-brand-text-muted" aria-hidden="true" /> {t('profile.phone')}
            </label>
            <Input
              id="edit-ta-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              dir="ltr"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder={t('students.phonePlaceholder')}
            />
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-3 border-t border-brand-border pt-6">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={loading} aria-busy={loading} className="min-w-[120px]">
            {loading ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : t('common.saveChanges')}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default EditTAModal;
