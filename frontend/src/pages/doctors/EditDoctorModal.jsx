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
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}></div>
      
      {/* Modal Content */}
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('doctors.editTitle')}: {doctor?.doctorId}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{t('doctors.editDesc')}</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {toast && (
            <div className={`mb-6 p-4 rounded-xl text-white flex items-center gap-2 animate-in slide-in-from-top-2 duration-300 ${toast.type === 'error' ? 'bg-rose-500' : 'bg-emerald-500'}`}>
              {toast.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
              <span className="font-medium">{toast.message}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 ml-1">
                <User size={14} className="text-slate-400 dark:text-slate-500" /> {t('doctors.firstName')} <span className="text-rose-500">*</span>
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
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 ml-1">
                <User size={14} className="text-slate-400 dark:text-slate-500" /> {t('doctors.lastName')} <span className="text-rose-500">*</span>
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
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 ml-1">
                <Briefcase size={14} className="text-slate-400 dark:text-slate-500" /> {t('doctors.specialty')}
              </label>
              <Input
                name="specialty"
                value={formData.specialty}
                onChange={handleChange}
                placeholder={t('doctors.specialtyPlaceholder')}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 ml-1">
                <Phone size={14} className="text-slate-400 dark:text-slate-500" /> {t('profile.phone')}
              </label>
              <Input
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder={t('doctors.phonePlaceholder')}
              />
            </div>
          </div>

          <div className="mt-8 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800 pt-6">
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