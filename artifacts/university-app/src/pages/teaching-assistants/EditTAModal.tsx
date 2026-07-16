// @ts-nocheck
import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import teachingAssistantsService from '../../services/teachingAssistants.service';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/input';
import { useTranslation } from 'react-i18next';
import { X, User, Phone, Briefcase } from 'lucide-react';

const EditTAModal = ({ isOpen, onClose, onSuccess, ta }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    specialization: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (ta) {
      setFormData({
        firstName: ta.firstName || '',
        lastName: ta.lastName || '',
        phone: ta.phone || '',
        specialization: ta.specialization || '',
      });
    }
  }, [ta]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.firstName || !formData.lastName) {
      toast.error(t('teachingAssistants.fillRequired'));
      return;
    }

    try {
      setLoading(true);
      const result = await teachingAssistantsService.updateTeachingAssistant(ta.id, formData);
      if (result.success) {
        onSuccess();
      } else {
        toast.error(result.message || t('teachingAssistants.updateError'));
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || t('teachingAssistants.updateError'));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-brand-navy-500/40 backdrop-blur-sm"
        onClick={onClose}
      ></div>

      {/* Modal Content */}
      <div className="relative bg-brand-bg-card dark:bg-brand-bg-elevated rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-brand-border dark:border-brand-border flex justify-between items-center bg-brand-bg-page/50 dark:bg-brand-bg-elevated/50">
          <div>
            <h2 className="text-xl font-bold text-brand-text-primary dark:text-brand-text-main">
              {t('teachingAssistants.editTitle')}: {ta?.employeeId}
            </h2>
            <p className="text-sm text-brand-text-secondary dark:text-brand-text-muted mt-0.5">
              {t('teachingAssistants.editDesc')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-brand-text-muted hover:text-brand-text-secondary dark:hover:text-brand-text-secondary hover:bg-brand-bg-page dark:hover:bg-brand-bg-elevated rounded-xl transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-brand-text-primary dark:text-brand-text-secondary flex items-center gap-2 ml-1">
                <User size={14} className="text-brand-text-muted dark:text-brand-text-secondary" />{' '}
                {t('students.firstName')} <span className="text-error">*</span>
              </label>
              <Input
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                placeholder={t('students.firstNamePlaceholder')}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-brand-text-primary dark:text-brand-text-secondary flex items-center gap-2 ml-1">
                <User size={14} className="text-brand-text-muted dark:text-brand-text-secondary" />{' '}
                {t('students.lastName')} <span className="text-error">*</span>
              </label>
              <Input
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                placeholder={t('students.lastNamePlaceholder')}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-brand-text-primary dark:text-brand-text-secondary flex items-center gap-2 ml-1">
                <Briefcase
                  size={14}
                  className="text-brand-text-muted dark:text-brand-text-secondary"
                />{' '}
                {t('teachingAssistants.specialization')}
              </label>
              <Input
                name="specialization"
                value={formData.specialization}
                onChange={handleChange}
                placeholder={t('teachingAssistants.specializationPlaceholder')}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-brand-text-primary dark:text-brand-text-secondary flex items-center gap-2 ml-1">
                <Phone size={14} className="text-brand-text-muted dark:text-brand-text-secondary" />{' '}
                {t('profile.phone')}
              </label>
              <Input
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder={t('students.phonePlaceholder')}
              />
            </div>
          </div>

          <div className="mt-8 flex justify-end gap-3 border-t border-brand-border dark:border-brand-border pt-6">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={loading} className="min-w-[120px]">
              {t('common.saveChanges')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditTAModal;
