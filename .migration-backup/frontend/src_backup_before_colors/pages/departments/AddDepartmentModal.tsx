// @ts-nocheck
import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import departmentService from '../../services/department.service';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useTranslation } from 'react-i18next';
import { School, GraduationCap, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { Select } from '../../components/ui/Select';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  nameAr: z.string().optional(),
  collegeId: z.coerce.number().min(1, 'College is required'),
});
type FormData = z.infer<typeof schema>;

const AddDepartmentModal = ({ isOpen, onClose, colleges, onSuccess }) => {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
    } = useForm<any>({ resolver: zodResolver(schema) as unknown as Record<string, unknown> });
  const [loading, setLoading] = useState(false);

  const onSubmit = async (data: FormData) => {
    try {
      setLoading(true);
      const result = await departmentService.createDepartment(data);
      if (result.success) {
        onSuccess();
        reset();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || t('departments.createError'));
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
    >
      <form
                onSubmit={handleSubmit((data: Record<string, unknown>) => onSubmit(data))}
        className="form-section"
      >

        <div className="space-y-5">
          <div className="space-y-1.5">
            <Select
              {...register('collegeId')}
              
             label={<><School size={14} className="text-brand-text-muted" /> {t('colleges.parentCollege')}{' '}
              <span className="text-rose-500">*</span></>} error={errors.collegeId?.message}>
              <option value="">{t('auth.selectCollege')}</option>
              {colleges.map((college) => (
                <option key={college.id} value={college.id}>
                  {college.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <GraduationCap size={14} className="text-brand-text-muted" />{' '}
              {t('departments.nameAr')}
            </label>
            <Input
              {...register('nameAr')}
              placeholder="e.g. قسم علوم الحاسب"
              className="bg-brand-bg-page/30 border-brand-border focus:bg-brand-bg-card transition-all font-arabic"
              dir="rtl"
            />
            {errors.nameAr && <p className="text-rose-500 text-xs mt-1">{errors.nameAr.message}</p>}
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-3 border-t border-brand-border pt-6">
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={isSubmitting || loading} className="min-w-[140px]">
            {loading ? <Loader2 className="animate-spin" size={20} /> : t('departments.addDept')}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default AddDepartmentModal;
