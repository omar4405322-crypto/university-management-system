// FIXED: i18n placeholders for add doctor form - Phase 4
import React, { useState } from 'react';
import doctorsService from '../../services/doctors.service';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useTranslation } from 'react-i18next';
import { User, Mail, Lock, Phone, Briefcase, Hash, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import Modal from '../../components/ui/Modal';

const AddDoctorModal = ({ isOpen, onClose, onSuccess }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    doctorId: '',
    email: '',
    password: '',
    phone: '',
    specialty: '',
  });
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.firstName || !formData.lastName || !formData.doctorId || !formData.email || !formData.password) {
      showToast(t('doctors.fillRequired'), 'error');
      return;
    }

    if (formData.password.length < 6) {
      showToast(t('doctors.passwordLength'), 'error');
      return;
    }

    try {
      setLoading(true);
      const result = await doctorsService.createDoctor(formData);
      if (result.success) {
        onSuccess();
      } else {
        showToast(result.message || t('doctors.createError'), 'error');
      }
    } catch (error) {
      showToast(error.response?.data?.message || t('doctors.createError'), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('doctors.addNew')}
      subtitle={t('doctors.addDesc')}
    >
      <form onSubmit={handleSubmit} className="form-section">
        {toast && (
          <div className={`p-4 rounded-xl text-white flex items-center gap-2 animate-in slide-in-from-top-2 duration-300 ${toast.type === 'error' ? 'bg-rose-500' : 'bg-brand-green'}`}>
            {toast.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
            <span className="font-medium">{toast.message}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <User size={14} className="text-brand-text-muted" /> {t('doctors.firstName')} <span className="text-rose-500">*</span>
            </label>
            <Input
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
              placeholder={t('doctors.firstNamePlaceholder')}
              required
              className="bg-brand-bg-page/30 border-brand-border focus:bg-brand-bg-card transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <User size={14} className="text-brand-text-muted" /> {t('doctors.lastName')} <span className="text-rose-500">*</span>
            </label>
            <Input
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
              placeholder={t('doctors.lastNamePlaceholder')}
              required
              className="bg-brand-bg-page/30 border-brand-border focus:bg-brand-bg-card transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <Hash size={14} className="text-brand-text-muted" /> {t('doctors.doctorId')} <span className="text-rose-500">*</span>
            </label>
            <Input
              name="doctorId"
              value={formData.doctorId}
              onChange={handleChange}
              placeholder={t('doctors.doctorIdPlaceholder')}
              required
              className="bg-brand-bg-page/30 border-brand-border focus:bg-brand-bg-card transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <Briefcase size={14} className="text-brand-text-muted" /> {t('doctors.specialty')}
            </label>
            <Input
              name="specialty"
              value={formData.specialty}
              onChange={handleChange}
              placeholder={t('doctors.specialtyPlaceholder')}
              className="bg-brand-bg-page/30 border-brand-border focus:bg-brand-bg-card transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <Mail size={14} className="text-brand-text-muted" /> {t('profile.email')} <span className="text-rose-500">*</span>
            </label>
            <Input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder={t('doctors.emailPlaceholder')}
              required
              className="bg-brand-bg-page/30 border-brand-border focus:bg-brand-bg-card transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <Lock size={14} className="text-brand-text-muted" /> {t('profile.password')} <span className="text-rose-500">*</span>
            </label>
            <Input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder={t('doctors.passwordPlaceholder')}
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
              placeholder={t('doctors.phonePlaceholder')}
              className="bg-brand-bg-page/30 border-brand-border focus:bg-brand-bg-card transition-all"
            />
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-3 border-t border-brand-border pt-6">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={loading}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            disabled={loading}
            className="min-w-[140px]"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : t('doctors.createDoctor')}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default AddDoctorModal;