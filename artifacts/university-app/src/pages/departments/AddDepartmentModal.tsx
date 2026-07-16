import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import departmentService from '../../services/department.service';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/input';
import { useTranslation } from 'react-i18next';
import { School, GraduationCap, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

const schema = z.object({
  name: z.string().min(1, 'Name in English is required'),
  nameAr: z.string().min(1, 'اسم القسم بالعربي مطلوب'),
  collegeId: z.coerce.number().min(1, 'الكلية التابعة مطلوبة'),
});
type FormData = z.infer<typeof schema>;

const AddDepartmentModal = ({ isOpen, onClose, colleges, onSuccess }) => {
  const { t } = useTranslation();
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema) });
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };


  const onSubmit = async (data: FormData) => {
    try {
      setLoading(true);
      const result = await departmentService.createDepartment(data);
      if (result.success) {
        onSuccess();
        reset();
      }
    } catch (error) {
      showToast(error.response?.data?.message || t('departments.createError'), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('departments.addNew')}
      subtitle={t('departments.addDesc')}
      size="sm"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="form-section">
        {toast && (
          <div className={`p-4 rounded-xl text-white flex items-center gap-2 animate-in slide-in-from-top-2 duration-300 ${toast.type === 'error' ? 'bg-rose-500' : 'bg-brand-green'}`}>
            {toast.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
            <span className="font-medium">{toast.message}</span>
          </div>
        )}

        <div className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <GraduationCap size={14} className="text-brand-text-muted" /> اسم القسم (عربي) <span className="text-rose-500">*</span>
            </label>
            <Input
              {...register('nameAr')}
              placeholder="أدخل اسم القسم بالعربية"
              className="bg-brand-bg-page/30 border-brand-border focus:bg-brand-bg-card transition-all font-arabic"
              dir="rtl"
            />
            {errors.nameAr && <p className="text-rose-500 text-xs mt-1">{errors.nameAr.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <GraduationCap size={14} className="text-brand-text-muted" /> Department Name (English) <span className="text-rose-500">*</span>
            </label>
            <Input
              {...register('name')}
              placeholder="Enter department name in English"
              className="bg-brand-bg-page/30 border-brand-border focus:bg-brand-bg-card transition-all"
            />
            {errors.name && <p className="text-rose-500 text-xs mt-1">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <School size={14} className="text-brand-text-muted" /> الكلية التابعة <span className="text-rose-500">*</span>
            </label>
            <select
              {...register('collegeId')}
              className="w-full h-10 px-4 bg-brand-bg-page/30 border border-brand-border rounded-xl text-sm text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-green/20 transition-all appearance-none cursor-pointer select-custom-arrow"
            >
              <option value="">اختر الكلية...</option>
              {colleges.map(college => (
                <option key={college.id} value={college.id}>{college.name}</option>
              ))}
            </select>
            {errors.collegeId && <p className="text-rose-500 text-xs mt-1">{errors.collegeId.message}</p>}
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-3 border-t border-brand-border pt-6">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={loading}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 font-bold px-6 min-h-10 rounded-xl"
          >
            إلغاء
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || loading}
            className="min-w-[140px] bg-[#84cc16] hover:bg-[#65a30d] text-white font-bold rounded-xl border-none shadow-none px-6 min-h-10 transition-all duration-200"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : 'إضافة'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default AddDepartmentModal;
