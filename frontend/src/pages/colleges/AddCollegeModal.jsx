import React, { useState } from 'react';
import collegeService from '../../services/college.service';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useTranslation } from 'react-i18next';
import { School, Info, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

const AddCollegeModal = ({ isOpen, onClose, onSuccess }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    name: '',
    nameAr: '',
    description: '',
  });
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name) {
      showToast(t('colleges.enterName'), 'error');
      return;
    }

    try {
      setLoading(true);
      const result = await collegeService.createCollege(formData);
      if (result.success) {
        onSuccess();
        setFormData({ name: '', nameAr: '', description: '' });
      }
    } catch (error) {
      showToast(error.response?.data?.message || t('colleges.createError'), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('colleges.addNew')}
      subtitle={t('colleges.addDesc')}
    >
      <form onSubmit={handleSubmit} className="form-section">
        {toast && (
          <div className={`p-4 rounded-xl text-white flex items-center gap-2 animate-in slide-in-from-top-2 duration-300 ${toast.type === 'error' ? 'bg-rose-500' : 'bg-brand-green'}`}>
            {toast.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
            <span className="font-medium">{toast.message}</span>
          </div>
        )}

        <div className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <School size={14} className="text-brand-text-muted" /> {t('colleges.nameEn')} <span className="text-rose-500">*</span>
            </label>
            <Input
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g. College of Engineering"
              required
              className="bg-brand-bg-page/30 border-brand-border focus:bg-brand-bg-card transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <School size={14} className="text-brand-text-muted" /> {t('colleges.nameAr')}
            </label>
            <Input
              name="nameAr"
              value={formData.nameAr}
              onChange={handleChange}
              placeholder={t('colleges.nameArPlaceholder', 'e.g. Faculty of Engineering')}
              className="bg-brand-bg-page/30 border-brand-border focus:bg-brand-bg-card transition-all font-arabic"
              dir="rtl"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <Info size={14} className="text-brand-text-muted" /> {t('colleges.description')}
            </label>
            <textarea
              name="description"
              rows="3"
              value={formData.description}
              onChange={handleChange}
              placeholder={t('colleges.descPlaceholder')}
              className="w-full px-4 py-2 bg-brand-bg-page/30 border border-brand-border rounded-xl text-sm text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-green/20 transition-all resize-none placeholder:text-brand-text-muted"
            ></textarea>
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
            {loading ? <Loader2 className="animate-spin" size={20} /> : t('colleges.addCollege')}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default AddCollegeModal;
