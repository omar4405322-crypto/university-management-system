// FIXED: i18n placeholders for add teachingAssistant form - Phase 4
import React, { useState } from 'react';
import toast from 'react-hot-toast';
import teachingAssistantsService from '../../services/teachingAssistants.service';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useTranslation } from 'react-i18next';
import {
  User,
  Mail,
  Lock,
  Phone,
  Briefcase,
  Hash,
  AlertCircle,
  CheckCircle,
  Loader2,
} from 'lucide-react';
import Modal from '../../components/ui/Modal';

const AddTeachingAssistantModal = ({ isOpen, onClose, onSuccess }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    specialization: '',
    email: '',
    password: '',
    phone: '',
    specialty: '',
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (
      !formData.firstName ||
      !formData.lastName ||
      !formData.specialization ||
      !formData.email ||
      !formData.password
    ) {
      toast.error(t('teachingAssistants.fillRequired'));
      return;
    }

    if (formData.password.length < 6) {
      toast.error(t('teachingAssistants.passwordLength'));
      return;
    }

    try {
      setLoading(true);
      const result = await teachingAssistantsService.createTeachingAssistant(formData);
      if (result.success) {
        onSuccess();
      } else {
        toast.error(result.message || t('teachingAssistants.createError'));
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || t('teachingAssistants.createError'));
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
      <form onSubmit={handleSubmit} className="form-section">

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <User size={14} className="text-brand-text-muted" /> {t('teachingAssistants.firstName')}{' '}
              <span className="text-rose-500">*</span>
            </label>
            <Input
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
              placeholder={t('teachingAssistants.firstNamePlaceholder')}
              required
              className="bg-brand-bg-page/30 border-brand-border focus:bg-brand-bg-card transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <User size={14} className="text-brand-text-muted" /> {t('teachingAssistants.lastName')}{' '}
              <span className="text-rose-500">*</span>
            </label>
            <Input
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
              placeholder={t('teachingAssistants.lastNamePlaceholder')}
              required
              className="bg-brand-bg-page/30 border-brand-border focus:bg-brand-bg-card transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <Hash size={14} className="text-brand-text-muted" /> {t('teachingAssistants.specialization')}{' '}
              <span className="text-rose-500">*</span>
            </label>
            <Input
              name="specialization"
              value={formData.specialization}
              onChange={handleChange}
              placeholder={t('teachingAssistants.specializationPlaceholder')}
              required
              className="bg-brand-bg-page/30 border-brand-border focus:bg-brand-bg-card transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <Briefcase size={14} className="text-brand-text-muted" /> {t('teachingAssistants.specialty')}
            </label>
            <Input
              name="specialty"
              value={formData.specialty}
              onChange={handleChange}
              placeholder={t('teachingAssistants.specialtyPlaceholder')}
              className="bg-brand-bg-page/30 border-brand-border focus:bg-brand-bg-card transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <Mail size={14} className="text-brand-text-muted" /> {t('profile.email')}{' '}
              <span className="text-rose-500">*</span>
            </label>
            <Input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder={t('teachingAssistants.emailPlaceholder')}
              required
              className="bg-brand-bg-page/30 border-brand-border focus:bg-brand-bg-card transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <Lock size={14} className="text-brand-text-muted" /> {t('profile.password')}{' '}
              <span className="text-rose-500">*</span>
            </label>
            <Input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder={t('teachingAssistants.passwordPlaceholder')}
              required
              className="bg-brand-bg-page/30 border-brand-border focus:bg-brand-bg-card transition-all"
            />
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <label className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <Phone size={14} className="text-brand-text-muted" /> {t('profile.phone')}
            </label>
            <Input
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder={t('teachingAssistants.phonePlaceholder')}
              className="bg-brand-bg-page/30 border-brand-border focus:bg-brand-bg-card transition-all"
            />
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-3 border-t border-brand-border pt-6">
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={loading} className="min-w-[140px]">
            {loading ? <Loader2 className="animate-spin" size={20} /> : t('teachingAssistants.createTeachingAssistant')}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default AddTeachingAssistantModal;
