import React, { useState, useEffect } from 'react';
import departmentService from '../../services/department.service';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useTranslation } from 'react-i18next';
import { School, GraduationCap, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

const EditDepartmentModal = ({ isOpen, onClose, department, colleges, onSuccess }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    name: '',
    nameAr: '',
    collegeId: '',
  });
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (department) {
      setFormData({
        name: department.name || '',
        nameAr: department.nameAr || '',
        collegeId: department.collegeId || '',
      });
    }
  }, [department, isOpen]);

  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ 
      ...formData, 
      [name]: name === 'collegeId' ? parseInt(value) || '' : value 
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.collegeId) {
      showToast(t('departments.fillRequired'), 'error');
      return;
    }

    try {
      setLoading(true);
      const result = await departmentService.updateDepartment(department.id, formData);
      if (result.success) {
        onSuccess();
      }
    } catch (error) {
      showToast(error.response?.data?.message || t('departments.updateError'), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('departments.editDept')}
      subtitle={t('departments.editDesc')}
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
              <School size={14} className="text-brand-text-muted" /> {t('colleges.parentCollege')} <span className="text-rose-500">*</span>
            </label>
            <select
              name="collegeId"
              value={formData.collegeId}
              onChange={handleChange}
              className="w-full h-10 px-4 bg-brand-bg-page/30 border border-brand-border rounded-xl text-sm text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-green/20 transition-all appearance-none cursor-pointer select-custom-arrow"
              required
            >
              <option value="">{t('auth.selectCollege')}</option>
              {colleges.map(college => (
                <option key={college.id} value={college.id}>{college.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <GraduationCap size={14} className="text-brand-text-muted" /> {t('departments.nameEn')} <span className="text-rose-500">*</span>
            </label>
            <Input
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g. Computer Science"
              required
              className="bg-brand-bg-page/30 border-brand-border focus:bg-brand-bg-card transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <GraduationCap size={14} className="text-brand-text-muted" /> {t('departments.nameAr')}
            </label>
            <Input
              name="nameAr"
              value={formData.nameAr}
              onChange={handleChange}
              placeholder="e.g. قسم علوم الحاسب"
              className="bg-brand-bg-page/30 border-brand-border focus:bg-brand-bg-card transition-all font-arabic text-right"
              dir="rtl"
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
            {loading ? <Loader2 className="animate-spin" size={20} /> : t('common.saveChanges')}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default EditDepartmentModal;
