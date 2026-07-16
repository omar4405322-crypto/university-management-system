import React, { useState, useEffect } from 'react';
import departmentService from '../../services/department.service';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/input';
import { useTranslation } from 'react-i18next';
import { School, GraduationCap, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  nameAr: z.string().optional(),
  collegeId: z.coerce.number().min(1, 'College is required'),
});

type FormData = z.infer<typeof schema>;

const EditDepartmentModal = ({ isOpen, onClose, department, colleges, onSuccess }) => {
  const { t } = useTranslation();
  const [toast, setToast] = useState(null);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema)
  });

  useEffect(() => {
    if (department && isOpen) {
      reset({
        name: department.name || '',
        nameAr: department.nameAr || '',
        collegeId: department.collegeId || '',
      });
    }
  }, [department, isOpen, reset]);

  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const onSubmit = async (data: FormData) => {
    try {
      const result = await departmentService.updateDepartment(department.id, data);
      if (result.success) {
        onSuccess();
      }
    } catch (error) {
      showToast(error.response?.data?.message || t('departments.updateError'), 'error');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('departments.editDept')}
      subtitle={t('departments.editDesc')}
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
              <School size={14} className="text-brand-text-muted" /> {t('colleges.parentCollege')} <span className="text-rose-500">*</span>
            </label>
            <select
              {...register('collegeId')}
              className="w-full h-10 px-4 bg-brand-bg-page/30 border border-brand-border rounded-xl text-sm text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-green/20 transition-all appearance-none cursor-pointer select-custom-arrow"
            >
              <option value="">{t('auth.selectCollege')}</option>
              {colleges.map(college => (
                <option key={college.id} value={college.id}>{college.name}</option>
              ))}
            </select>
            {errors.collegeId && <p className="text-rose-500 text-xs mt-1">{errors.collegeId.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <GraduationCap size={14} className="text-brand-text-muted" /> {t('departments.nameEn')} <span className="text-rose-500">*</span>
            </label>
            <Input
              {...register('name')}
              placeholder="e.g. Computer Science"
              className="bg-brand-bg-page/30 border-brand-border focus:bg-brand-bg-card transition-all"
            />
            {errors.name && <p className="text-rose-500 text-xs mt-1">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <GraduationCap size={14} className="text-brand-text-muted" /> {t('departments.nameAr')}
            </label>
            <Input
              {...register('nameAr')}
              placeholder="e.g. قسم علوم الحاسب"
              className="bg-brand-bg-page/30 border-brand-border focus:bg-brand-bg-card transition-all font-arabic text-right"
              dir="rtl"
            />
            {errors.nameAr && <p className="text-rose-500 text-xs mt-1">{errors.nameAr.message}</p>}
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-3 border-t border-brand-border pt-6">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isSubmitting}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="min-w-[140px]"
          >
            {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : t('common.saveChanges')}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default EditDepartmentModal;
