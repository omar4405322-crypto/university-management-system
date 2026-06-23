import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import collegeService from '../../services/college.service';
import usersService from '../../services/users.service';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { School, Info, AlertCircle, CheckCircle, Loader2, Image, ShieldAlert, UserPlus, Upload } from 'lucide-react';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  nameAr: z.string().optional(),
  description: z.string().optional(),
  descriptionAr: z.string().optional(),
  status: z.string().min(1, 'Status is required'),
  logoUrl: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

const EditCollegeModal = ({ isOpen, onClose, college, onSuccess }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema) });
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<any>(null);
  const [admins, setAdmins] = useState<any[]>([]);
  const [selectedAdminId, setSelectedAdminId] = useState('');

  const logoUrl = watch('logoUrl');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      showToast(t('profile.imageRequirements'), 'error');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        setValue('logoUrl', reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (isOpen && college) {
      const fetchAdmins = async () => {
        try {
          const result = await usersService.getUsers({ role: 'COLLEGE_ADMIN' });
          console.log('EditCollegeModal available admins API response:', result);
          if (result.success) {
            const availableAdmins = (result.data || []).filter(
              (admin: any) => admin.role === 'COLLEGE_ADMIN' && (!admin.managedCollegeId || Number(admin.managedCollegeId) === Number(college.id))
            );
            setAdmins(availableAdmins);
          }
        } catch (error) {
          console.error('Error fetching admins:', error);
        }
      };
      fetchAdmins();
    }
  }, [isOpen, college]);

  useEffect(() => {
    if (college) {
      reset({
        name: college.name || '',
        nameAr: college.nameAr || '',
        description: college.description || '',
        descriptionAr: college.descriptionAr || '',
        status: college.status || 'active',
        logoUrl: college.logoUrl || '',
      });
      setSelectedAdminId(college.assignedAdmin?.id ? String(college.assignedAdmin.id) : '');
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
      const result = await collegeService.updateCollege(college.id, {
        name: data.name,
        nameAr: data.nameAr,
        description: data.description,
        descriptionAr: data.descriptionAr,
        status: data.status,
        logoUrl: data.logoUrl,
      });
      if (result.success) {
        const currentAdminId = college.assignedAdmin?.id ? String(college.assignedAdmin.id) : '';
        if (selectedAdminId !== currentAdminId) {
          await collegeService.assignAdmin(college.id, selectedAdminId || 'clear');
        }
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
              <School size={14} className="text-brand-text-muted" /> {t('colleges.nameEn')} <span className="text-rose-500">*</span>
            </label>
            <Input
              {...register('name')}
              placeholder="e.g. College of Engineering"
              disabled={loading}
              className="bg-brand-bg-page/30 border-brand-border focus:bg-brand-bg-card transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
              className="bg-brand-bg-page/30 border-brand-border focus:bg-brand-bg-card transition-all disabled:opacity-50 disabled:cursor-not-allowed font-arabic"
              dir="rtl"
            />
            {errors.nameAr && <p className="text-rose-500 text-xs mt-1">{errors.nameAr.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <ShieldAlert size={14} className="text-brand-text-muted" /> {t('colleges.status') || 'Status'}
            </label>
            <select
              {...register('status')}
              disabled={loading}
              className="w-full px-4 py-3 bg-brand-bg-page/30 border border-brand-border rounded-xl text-sm text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-green/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="active">{t('colleges.active') || 'Active'}</option>
              <option value="inactive">{t('colleges.inactive') || 'Inactive'}</option>
            </select>
            {errors.status && <p className="text-rose-500 text-xs mt-1">{errors.status.message}</p>}
          </div>

          <div className="space-y-3">
            <label className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <Image size={14} className="text-brand-text-muted" /> {t('colleges.logoUrl') || 'College Logo'}
            </label>

            {/* Current Logo Preview */}
            {logoUrl && (
              <div className="relative w-24 h-24 rounded-2xl overflow-hidden border border-brand-border bg-brand-bg-page/30 p-2 flex items-center justify-center">
                <img
                  src={logoUrl}
                  alt="College Logo Preview"
                  className="max-w-full max-h-full object-contain rounded-xl"
                />
                <button
                  type="button"
                  onClick={() => setValue('logoUrl', '')}
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-rose-500 text-white flex items-center justify-center text-[10px] hover:bg-rose-600 transition-colors shadow-md"
                  title="Remove Image"
                >
                  ✕
                </button>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              {/* File Upload Button */}
              <label className="cursor-pointer flex items-center gap-2 px-4 py-3 bg-brand-navy-500/5 hover:bg-brand-navy-500/10 border border-brand-border rounded-xl text-sm font-bold text-brand-text-main transition-all">
                <Upload size={16} className="text-brand-green" />
                <span>{t('colleges.uploadImage') || 'Upload Image'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                  disabled={loading}
                />
              </label>

              <span className="text-xs text-brand-text-secondary">
                {t('profile.imageRequirements') || 'PNG, JPG or WebP (Max 2MB)'}
              </span>
            </div>

            {/* Fallback URL Text Input */}
            <div className="space-y-1.5 pt-2">
              <label className="text-xs font-semibold text-brand-text-secondary">
                {t('colleges.logoUrlFallback') || 'Or enter image URL directly (fallback)'}
              </label>
              <Input
                {...register('logoUrl')}
                placeholder="e.g. https://example.com/logo.png"
                disabled={loading}
                className="bg-brand-bg-page/30 border-brand-border focus:bg-brand-bg-card transition-all disabled:opacity-50 disabled:cursor-not-allowed text-xs"
              />
              {errors.logoUrl && <p className="text-rose-500 text-xs mt-1">{errors.logoUrl.message}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <UserPlus size={14} className="text-brand-text-muted" /> {t('colleges.assignedAdmin') || 'Assigned Admin'}
            </label>
            <select
              value={selectedAdminId}
              onChange={(e) => setSelectedAdminId(e.target.value)}
              disabled={loading}
              className="w-full px-4 py-3 bg-brand-bg-page/30 border border-brand-border rounded-xl text-sm text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-green/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">{t('colleges.noAdminAssigned') || 'No admin assigned'}</option>
              {admins.map((admin) => (
                <option key={admin.id} value={admin.id}>
                  {admin.email} {admin.managedCollege ? `(${admin.managedCollege.name})` : '(Unassigned)'}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <Info size={14} className="text-brand-text-muted" /> {t('colleges.description')}
            </label>
            <textarea
              {...register('description')}
              rows={3}
              disabled={loading}
              className="w-full px-4 py-3 bg-brand-bg-page/30 border border-brand-border rounded-xl text-sm text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-green/20 transition-all resize-none disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="Brief description of the college..."
            />
            {errors.description && <p className="text-rose-500 text-xs mt-1">{errors.description.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <Info size={14} className="text-brand-text-muted" /> {t('colleges.descriptionAr')}
            </label>
            <textarea
              {...register('descriptionAr')}
              rows={3}
              disabled={loading}
              className="w-full px-4 py-3 bg-brand-bg-page/30 border border-brand-border rounded-xl text-sm text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-green/20 transition-all resize-none disabled:opacity-50 disabled:cursor-not-allowed font-arabic"
              dir="rtl"
              placeholder="الوصف باللغة العربية..."
            />
            {errors.descriptionAr && <p className="text-rose-500 text-xs mt-1">{errors.descriptionAr.message}</p>}
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
            disabled={isSubmitting || loading}
            className="min-w-[140px] flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={20} />
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
