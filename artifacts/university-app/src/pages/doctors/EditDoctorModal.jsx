import React, { useState, useEffect } from 'react';
import doctorsService from '../../services/doctors.service';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useTranslation } from 'react-i18next';
import { X, User, Phone, Briefcase, AlertCircle, CheckCircle } from 'lucide-react';

const EditDoctorModal = ({ isOpen, onClose, onSuccess, doctor }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    specialty: '',
  });
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (doctor) {
      setFormData({
        firstName: doctor.firstName || '',
        lastName: doctor.lastName || '',
        phone: doctor.phone || '',
        specialty: doctor.specialty || '',
      });
    }
  }, [doctor]);

  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.firstName || !formData.lastName) {
      showToast(t('doctors.fillRequired'), 'error');
      return;
    }

    try {
      setLoading(true);
      const result = await doctorsService.updateDoctor(doctor.id, formData);
      if (result.success) {
        onSuccess();
      } else {
        showToast(result.message || t('doctors.updateError'), 'error');
      }
    } catch (error) {
      showToast(error.response?.data?.message || t('doctors.updateError'), 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-brand-navy-500/40 backdrop-blur-sm" onClick={onClose}></div>
      
      {/* Modal Content */}
      <div className="relative bg-brand-bg-card dark:bg-brand-bg-elevated rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-brand-border dark:border-brand-border flex justify-between items-center bg-brand-bg-page/50 dark:bg-brand-bg-elevated/50">
          <div>
            <h2 className="text-xl font-bold text-brand-text-primary dark:text-brand-text-main">{t('doctors.editTitle')}: {doctor?.doctorId}</h2>
            <p className="text-sm text-brand-text-secondary dark:text-brand-text-muted mt-0.5">{t('doctors.editDesc')}</p>
          </div>
          <button onClick={onClose} className="p-2 text-brand-text-muted hover:text-brand-text-secondary dark:hover:text-brand-text-secondary hover:bg-brand-bg-page dark:hover:bg-brand-bg-elevated rounded-xl transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {toast && (
            <div className={`mb-6 p-4 rounded-xl text-white flex items-center gap-2 animate-in slide-in-from-top-2 duration-300 ${toast.type === 'error' ? 'bg-error' : 'bg-success'}`}>
              {toast.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
              <span className="font-medium">{toast.message}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-brand-text-primary dark:text-brand-text-secondary flex items-center gap-2 ml-1">
                <User size={14} className="text-brand-text-muted dark:text-brand-text-secondary" /> {t('doctors.firstName')} <span className="text-error">*</span>
              </label>
              <Input
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                placeholder="e.g. Sarah"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-brand-text-primary dark:text-brand-text-secondary flex items-center gap-2 ml-1">
                <User size={14} className="text-brand-text-muted dark:text-brand-text-secondary" /> {t('doctors.lastName')} <span className="text-error">*</span>
              </label>
              <Input
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                placeholder="e.g. Wilson"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-brand-text-primary dark:text-brand-text-secondary flex items-center gap-2 ml-1">
                <Briefcase size={14} className="text-brand-text-muted dark:text-brand-text-secondary" /> {t('doctors.specialty')}
              </label>
              <Input
                name="specialty"
                value={formData.specialty}
                onChange={handleChange}
                placeholder={t('doctors.specialtyPlaceholder')}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-brand-text-primary dark:text-brand-text-secondary flex items-center gap-2 ml-1">
                <Phone size={14} className="text-brand-text-muted dark:text-brand-text-secondary" /> {t('profile.phone')}
              </label>
              <Input
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder={t('doctors.phonePlaceholder')}
              />
            </div>
          </div>

          <div className="mt-8 flex justify-end gap-3 border-t border-brand-border dark:border-brand-border pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              loading={loading}
              className="min-w-[120px]"
            >
              {t('common.saveChanges')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditDoctorModal;