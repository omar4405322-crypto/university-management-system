import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import collegeService from '../../services/college.service';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/input';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { School, Info, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  nameAr: z.string().optional(),
  description: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

const EditCollegeModal = ({ isOpen, onClose, college, onSuccess }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema) });
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (college) {
      reset({
        name: college.name || '',
        nameAr: college.nameAr || '',
        description: college.description || '',
      });
    }
  }, [college, isOpen, reset]);

  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const getErrorMessage = (error) => {
    if (error.status === 403) {
      return t('colleges.insufficientPermissions', 'You do not have permission to edit colleges. Only Super Admins can edit colleges.');
    }
    if (error.status === 401) {
      return t('colleges.sessionExpired', 'Your session has expired. Please login again.');
    }
    if (error.data?.message) {
      return error.data.message;
    }
    if (error.message) {
      return error.message;
    }
    return t('colleges.updateError', 'Failed to update college. Please try again.');
  };

  const onSubmit = async (data: FormData) => {
    try {
      setLoading(true);
      const result = await collegeService.updateCollege(college.id, data);
      if (result.success) {
        showToast(t('colleges.updateSuccess', 'College updated successfully!'), 'success');
        onSuccess();
      }
    } catch (error) {
      console.error('Error updating college:', error);
      showToast(getErrorMessage(error), 'error');
    } finally {
      setLoading(false);
    }
  };

  // Guard: Only SUPER_ADMIN can access this modal
  if (!isOpen || user?.role !== 'SUPER_ADMIN') {
    return null;
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('colleges.editTitle') || 'Edit College'}
      subtitle={t('colleges.editDesc') || 'Update college information'}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {toast && (
          <div className={`p-4 mb-6 rounded-xl text-white flex items-center gap-2 animate-in slide-in-from-top-2 duration-300 ${toast.type === 'error' ? 'bg-rose-500' : 'bg-brand-green'}`}>
            {toast.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
            <span className="font-medium text-sm">{toast.message}</span>
          </div>
        )}

        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
                <School size={14} className="text-brand-text-muted" /> {t('colleges.nameEn')} <span className="text-rose-500">*</span>
              </label>
              <Input
                {...register('name')}
                placeholder="e.g. College of Engineering"
                disabled={loading}
                className="bg-brand-bg-page/30 border-brand-border focus:bg-brand-bg-card transition-all disabled:opacity-50 disabled:cursor-not-allowed h-11 rounded-xl"
              />
              {errors.name && <p className="text-rose-500 text-xs mt-1">{errors.name.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
                <School size={14} className="text-brand-text-muted" /> {t('colleges.nameAr')}
              </label>
              <Input
                {...register('nameAr')}
                placeholder={t('colleges.nameArPlaceholder', 'e.g. Faculty of Engineering')}
                disabled={loading}
                className="bg-brand-bg-page/30 border-brand-border focus:bg-brand-bg-card transition-all disabled:opacity-50 disabled:cursor-not-allowed font-arabic h-11 rounded-xl"
                dir="rtl"
              />
              {errors.nameAr && <p className="text-rose-500 text-xs mt-1">{errors.nameAr.message}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <Info size={14} className="text-brand-text-muted" /> {t('colleges.description')}
            </label>
            <textarea
              {...register('description')}
              rows={4}
              disabled={loading}
              className="w-full px-4 py-3 bg-brand-bg-page/30 border border-brand-border rounded-xl text-sm text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 focus:border-brand-primary-500 transition-all resize-none placeholder:text-brand-text-muted disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="Brief description of the college..."
            />
            {errors.description && <p className="text-rose-500 text-xs mt-1">{errors.description.message}</p>}
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-3 border-t border-brand-border pt-6">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={loading}
            className="text-xs font-black uppercase tracking-wider px-5 py-3"
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting || loading}
            className="min-w-[140px] flex items-center justify-center gap-2 text-xs font-black uppercase tracking-wider px-6 py-3"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={16} />
                <span>{t('common.saving', 'Saving...')}</span>
              </>
            ) : (
              t('common.saveChanges')
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default EditCollegeModal;
