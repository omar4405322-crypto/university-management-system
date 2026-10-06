import React, { useState, useEffect } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { X, Save, Lock, User, Phone, MapPin, AlignLeft, Info, Calendar } from 'lucide-react';
import usersService from '../../services/users.service';

const generalSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phone: z.string().optional(),
  gender: z.string().optional(),
  birthDate: z.string().optional(),
  address: z.string().optional(),
  bio: z.string().optional(),
});

type GeneralFormData = z.infer<typeof generalSchema>;

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one digit'),
  confirmPassword: z.string().min(1, 'Confirm password is required'),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "New passwords do not match",
  path: ["confirmPassword"]
});

type PasswordFormData = z.infer<typeof passwordSchema>;

export interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profileData?: any;
  onSuccess?: () => void;
}

const EditProfileModal: React.FC<EditProfileModalProps> = ({ isOpen, onClose, profileData, onSuccess }) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language?.startsWith('ar');
  const [activeTab, setActiveTab] = useState('general');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const generalForm = useForm<GeneralFormData>({
    resolver: zodResolver(generalSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      phone: '',
      address: '',
      bio: '',
      gender: '',
      birthDate: '',
    }
  });

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    }
  });

  useEffect(() => {
    if (isOpen) {
      generalForm.reset({
        firstName: profileData?.firstName || '',
        lastName: profileData?.lastName || '',
        phone: profileData?.phone || '',
        address: profileData?.address || '',
        bio: profileData?.bio || '',
        gender: profileData?.gender || '',
        birthDate: profileData?.birthDate ? new Date(profileData.birthDate).toISOString().split('T')[0] : '',
      });
      passwordForm.reset({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setError('');
      setSuccess('');
    }
  }, [isOpen, profileData, generalForm, passwordForm]);

  if (!isOpen) return null;

  const onGeneralSubmit = async (data: GeneralFormData) => {
    setError('');
    setSuccess('');

    try {
      const result = await usersService.updateProfile(data);
      if (result.success) {
        setSuccess(t('profile.profileUpdated', isRTL ? 'تم تحديث الملف الشخصي بنجاح' : 'Profile updated successfully'));
        setTimeout(() => {
          onSuccess?.();
          onClose();
        }, 1500);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || (isRTL ? 'فشل تحديث الملف الشخصي' : 'Failed to update profile'));
    }
  };

  const onPasswordSubmit = async (data: PasswordFormData) => {
    setError('');
    setSuccess('');

    try {
      const result = await usersService.updatePassword({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword
      });
      if (result.success) {
        setSuccess(t('profile.passwordUpdated', isRTL ? 'تم تغيير كلمة المرور بنجاح' : 'Password changed successfully'));
        passwordForm.reset({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setTimeout(() => {
          onClose();
        }, 1500);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || (isRTL ? 'فشلت عملية تغيير كلمة المرور' : 'Failed to change password'));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md transition-all duration-300">
      <div className="bg-brand-bg-card dark:bg-brand-bg-elevated rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in duration-300 border border-brand-border dark:border-brand-border">
        {/* Header */}
        <div className="flex justify-between items-center p-6 sm:p-8 border-b border-brand-border dark:border-brand-border bg-brand-bg-page/50 dark:bg-brand-bg-elevated/50">
          <div>
            <h2 className="text-2xl font-black text-brand-text-primary dark:text-brand-text-main tracking-tight">
              {t('profile.editProfileTitle', isRTL ? 'إعدادات الملف الشخصي' : 'Profile Settings')}
            </h2>
            <p className="text-sm text-brand-text-secondary dark:text-brand-text-muted mt-1">
              {t('profile.editProfileSubtitle', isRTL ? 'إدارة معلومات حسابك وأمانه' : 'Manage your account information and security')}
            </p>
          </div>
          <button 
            onClick={onClose} 
            aria-label={t('common.close', isRTL ? 'إغلاق' : 'Close')}
            className="p-2 text-brand-text-muted hover:text-brand-text-secondary dark:hover:text-brand-text-secondary hover:bg-brand-bg-page dark:hover:bg-brand-bg-elevated rounded-xl transition-all"
          >
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-8 border-b border-brand-border dark:border-brand-border">
          <button 
            type="button"
            onClick={() => setActiveTab('general')}
            className={`flex items-center gap-2 py-4 text-sm font-bold transition-all border-b-2 ${activeTab === 'general' ? 'text-info border-info' : 'text-brand-text-secondary dark:text-brand-text-muted hover:text-brand-text-primary dark:hover:text-brand-text-secondary border-transparent'}`}
          >
            <User size={18} />
            {t('profile.generalInfo', isRTL ? 'المعلومات العامة' : 'General Info')}
          </button>
          <button 
            type="button"
            onClick={() => setActiveTab('password')}
            className={`flex items-center gap-2 py-4 px-6 text-sm font-bold transition-all border-b-2 ${activeTab === 'password' ? 'text-info border-info' : 'text-brand-text-secondary dark:text-brand-text-muted hover:text-brand-text-primary dark:hover:text-brand-text-secondary border-transparent'}`}
          >
            <Lock size={18} />
            {t('profile.security', isRTL ? 'الأمان' : 'Security')}
          </button>
        </div>

        <div className="p-6 sm:p-8 max-h-[70vh] overflow-y-auto no-scrollbar">
          {error && <div className="mb-6 p-4 bg-error/10 dark:bg-error/20 text-error-text text-sm font-bold rounded-2xl border border-error/20 dark:border-error/30 flex items-center gap-3">
            <Info size={18} />
            {error}
          </div>}
          {success && <div className="mb-6 p-4 bg-success/10 dark:bg-success/20 text-success dark:text-success text-sm font-bold rounded-2xl border border-success/20 dark:border-success/30 flex items-center gap-3">
            <Info size={18} />
            {success}
          </div>}

          {activeTab === 'general' ? (
            <form onSubmit={generalForm.handleSubmit(onGeneralSubmit)} className="form-section">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label htmlFor="profile-first-name" className="text-xs font-black text-brand-text-muted uppercase tracking-widest ms-1">
                    {t('profile.firstName', isRTL ? 'الاسم الأول' : 'First Name')} <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative group">
                    <User className="absolute start-4 top-1/2 -translate-y-1/2 text-brand-text-muted group-focus-within:text-info transition-colors" size={18} />
                    <input
                      id="profile-first-name"
                      type="text"
                      autoComplete="given-name"
                      aria-required="true"
                      aria-invalid={!!generalForm.formState.errors.firstName}
                      aria-describedby={generalForm.formState.errors.firstName ? "profile-first-name-error" : undefined}
                      placeholder={t('profile.firstNamePlaceholder', isRTL ? 'أدخل الاسم الأول' : 'Enter first name')}
                      className="w-full ps-12 pe-4 py-3 bg-brand-bg-page dark:bg-brand-bg-elevated/50 border border-brand-border dark:border-brand-border rounded-2xl focus:ring-2 focus:ring-brand-primary-500/30 dark:text-brand-text-main outline-none transition-all font-medium"
                      {...generalForm.register('firstName')}
                    />
                  </div>
                  {generalForm.formState.errors.firstName && <p id="profile-first-name-error" className="text-rose-500 text-xs mt-1" role="alert">{generalForm.formState.errors.firstName.message}</p>}
                </div>
                <div className="space-y-2">
                  <label htmlFor="profile-last-name" className="text-xs font-black text-brand-text-muted uppercase tracking-widest ms-1">
                    {t('profile.lastName', isRTL ? 'الاسم الأخير' : 'Last Name')} <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative group">
                    <User className="absolute start-4 top-1/2 -translate-y-1/2 text-brand-text-muted group-focus-within:text-info transition-colors" size={18} />
                    <input
                      id="profile-last-name"
                      type="text"
                      autoComplete="family-name"
                      aria-required="true"
                      aria-invalid={!!generalForm.formState.errors.lastName}
                      aria-describedby={generalForm.formState.errors.lastName ? "profile-last-name-error" : undefined}
                      placeholder={t('profile.lastNamePlaceholder', isRTL ? 'أدخل الاسم الأخير' : 'Enter last name')}
                      className="w-full ps-12 pe-4 py-3 bg-brand-bg-page dark:bg-brand-bg-elevated/50 border border-brand-border dark:border-brand-border rounded-2xl focus:ring-2 focus:ring-brand-primary-500/30 dark:text-brand-text-main outline-none transition-all font-medium"
                      {...generalForm.register('lastName')}
                    />
                  </div>
                  {generalForm.formState.errors.lastName && <p id="profile-last-name-error" className="text-rose-500 text-xs mt-1" role="alert">{generalForm.formState.errors.lastName.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-6">
                <div className="space-y-2">
                  <label htmlFor="profile-phone" className="text-xs font-black text-brand-text-muted uppercase tracking-widest ms-1">
                    {t('profile.phone', isRTL ? 'رقم الهاتف' : 'Phone Number')}
                  </label>
                  <div className="relative group">
                    <Phone className="absolute start-4 top-1/2 -translate-y-1/2 text-brand-text-muted group-focus-within:text-info transition-colors" size={18} />
                    <input
                      id="profile-phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      aria-invalid={!!generalForm.formState.errors.phone}
                      aria-describedby={generalForm.formState.errors.phone ? "profile-phone-error" : undefined}
                      dir="ltr"
                      placeholder="+20 123 456 7890"
                      className="w-full ps-12 pe-4 py-3 bg-brand-bg-page dark:bg-brand-bg-elevated/50 border border-brand-border dark:border-brand-border rounded-2xl focus:ring-2 focus:ring-brand-primary-500/30 dark:text-brand-text-main outline-none transition-all font-medium text-start"
                      {...generalForm.register('phone')}
                    />
                  </div>
                  {generalForm.formState.errors.phone && <p id="profile-phone-error" className="text-rose-500 text-xs mt-1" role="alert">{generalForm.formState.errors.phone.message}</p>}
                </div>
                <div className="space-y-2">
                  <label htmlFor="profile-gender" className="text-xs font-black text-brand-text-muted uppercase tracking-widest ms-1">
                    {t('profile.gender', isRTL ? 'الجنس' : 'Gender')}
                  </label>
                  <div className="relative group">
                    <User className="absolute start-4 top-1/2 -translate-y-1/2 text-brand-text-muted group-focus-within:text-info transition-colors" size={18} />
                    <select
                      id="profile-gender"
                      aria-invalid={!!generalForm.formState.errors.gender}
                      aria-describedby={generalForm.formState.errors.gender ? "profile-gender-error" : undefined}
                      className="w-full ps-12 pe-4 py-3 bg-brand-bg-page dark:bg-brand-bg-elevated/50 border border-brand-border dark:border-brand-border rounded-2xl focus:ring-2 focus:ring-brand-primary-500/30 dark:text-brand-text-main outline-none transition-all font-medium appearance-none"
                      {...generalForm.register('gender')}
                    >
                      <option value="">{t('profile.selectGender', isRTL ? 'اختر الجنس' : 'Select Gender')}</option>
                      <option value="MALE">{t('profile.genderMale', isRTL ? 'ذكر' : 'Male')}</option>
                      <option value="FEMALE">{t('profile.genderFemale', isRTL ? 'أنثى' : 'Female')}</option>
                      <option value="OTHER">{t('profile.genderOther', isRTL ? 'آخر' : 'Other')}</option>
                    </select>
                  </div>
                  {generalForm.formState.errors.gender && <p id="profile-gender-error" className="text-rose-500 text-xs mt-1" role="alert">{generalForm.formState.errors.gender.message}</p>}
                </div>
              </div>

              <div className="space-y-2 mt-6">
                <label htmlFor="profile-birthdate" className="text-xs font-black text-brand-text-muted uppercase tracking-widest ms-1">
                  {t('profile.birthDate', isRTL ? 'تاريخ الميلاد' : 'Birth Date')}
                </label>
                <div className="relative group">
                  <Calendar className="absolute start-4 top-1/2 -translate-y-1/2 text-brand-text-muted group-focus-within:text-info transition-colors" size={18} />
                  <input
                    id="profile-birthdate"
                    type="date"
                    autoComplete="bday"
                    aria-invalid={!!generalForm.formState.errors.birthDate}
                    aria-describedby={generalForm.formState.errors.birthDate ? "profile-birthdate-error" : undefined}
                    className="w-full ps-12 pe-4 py-3 bg-brand-bg-page dark:bg-brand-bg-elevated/50 border border-brand-border dark:border-brand-border rounded-2xl focus:ring-2 focus:ring-brand-primary-500/30 dark:text-brand-text-main outline-none transition-all font-medium"
                    {...generalForm.register('birthDate')}
                  />
                </div>
                {generalForm.formState.errors.birthDate && <p id="profile-birthdate-error" className="text-rose-500 text-xs mt-1" role="alert">{generalForm.formState.errors.birthDate.message}</p>}
              </div>

              <div className="space-y-2 mt-6">
                <label htmlFor="profile-address" className="text-xs font-black text-brand-text-muted uppercase tracking-widest ms-1">
                  {t('profile.residentialAddress', isRTL ? 'عنوان السكن' : 'Residential Address')}
                </label>
                <div className="relative group">
                  <MapPin className="absolute start-4 top-1/2 -translate-y-1/2 text-brand-text-muted group-focus-within:text-info transition-colors" size={18} />
                  <input
                    id="profile-address"
                    type="text"
                    autoComplete="street-address"
                    aria-invalid={!!generalForm.formState.errors.address}
                    aria-describedby={generalForm.formState.errors.address ? "profile-address-error" : undefined}
                    placeholder={t('profile.addressPlaceholder', isRTL ? 'أدخل عنوانك بالكامل' : 'Enter your full address')}
                    className="w-full ps-12 pe-4 py-3 bg-brand-bg-page dark:bg-brand-bg-elevated/50 border border-brand-border dark:border-brand-border rounded-2xl focus:ring-2 focus:ring-brand-primary-500/30 dark:text-brand-text-main outline-none transition-all font-medium"
                    {...generalForm.register('address')}
                  />
                </div>
                {generalForm.formState.errors.address && <p id="profile-address-error" className="text-rose-500 text-xs mt-1" role="alert">{generalForm.formState.errors.address.message}</p>}
              </div>

              <div className="space-y-2 mt-6">
                <label htmlFor="profile-bio" className="text-xs font-black text-brand-text-muted uppercase tracking-widest ms-1">
                  {t('profile.biography', isRTL ? 'نبذة تعريفية' : 'Biography')}
                </label>
                <div className="relative group">
                  <AlignLeft className="absolute start-4 top-4 text-brand-text-muted group-focus-within:text-info transition-colors" size={18} />
                  <textarea
                    id="profile-bio"
                    rows={4}
                    aria-invalid={!!generalForm.formState.errors.bio}
                    aria-describedby={generalForm.formState.errors.bio ? "profile-bio-error" : undefined}
                    placeholder={t('profile.bioPlaceholder', isRTL ? 'أخبرنا قليلاً عن نفسك...' : 'Tell us about yourself...')}
                    className="w-full ps-12 pe-4 py-3 bg-brand-bg-page dark:bg-brand-bg-elevated/50 border border-brand-border dark:border-brand-border rounded-2xl focus:ring-2 focus:ring-brand-primary-500/30 dark:text-brand-text-main outline-none transition-all font-medium resize-none"
                    {...generalForm.register('bio')}
                  />
                </div>
                {generalForm.formState.errors.bio && <p id="profile-bio-error" className="text-rose-500 text-xs mt-1" role="alert">{generalForm.formState.errors.bio.message}</p>}
              </div>

              <div className="pt-6">
                <button
                  type="submit"
                  disabled={generalForm.formState.isSubmitting}
                  className="w-full flex items-center justify-center gap-2 bg-brand-primary-500 hover:bg-brand-primary-600 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-lg shadow-brand-primary-500/20 dark:shadow-none disabled:opacity-50 cursor-pointer"
                >
                  {generalForm.formState.isSubmitting ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <Save size={20} />
                      <span>{t('profile.saveChanges', isRTL ? 'حفظ التغييرات' : 'Save Changes')}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="form-section">
              <div className="space-y-2">
                <label htmlFor="profile-current-password" className="text-xs font-black text-brand-text-muted uppercase tracking-widest ms-1">
                  {t('profile.currentPassword', isRTL ? 'كلمة المرور الحالية' : 'Current Password')} <span className="text-rose-500">*</span>
                </label>
                <div className="relative group">
                  <Lock className="absolute start-4 top-1/2 -translate-y-1/2 text-brand-text-muted group-focus-within:text-info transition-colors" size={18} />
                  <input
                    id="profile-current-password"
                    type="password"
                    autoComplete="current-password"
                    aria-required="true"
                    aria-invalid={!!passwordForm.formState.errors.currentPassword}
                    aria-describedby={passwordForm.formState.errors.currentPassword ? "profile-current-password-error" : undefined}
                    placeholder="••••••••"
                    className="w-full ps-12 pe-4 py-3 bg-brand-bg-page dark:bg-brand-bg-elevated/50 border border-brand-border dark:border-brand-border rounded-2xl focus:ring-2 focus:ring-brand-primary-500/30 dark:text-brand-text-main outline-none transition-all font-medium"
                    {...passwordForm.register('currentPassword')}
                  />
                </div>
                {passwordForm.formState.errors.currentPassword && <p id="profile-current-password-error" className="text-rose-500 text-xs mt-1" role="alert">{passwordForm.formState.errors.currentPassword.message}</p>}
              </div>
              <div className="space-y-2 mt-6">
                <label htmlFor="profile-new-password" className="text-xs font-black text-brand-text-muted uppercase tracking-widest ms-1">
                  {t('profile.newPassword', isRTL ? 'كلمة المرور الجديدة' : 'New Password')} <span className="text-rose-500">*</span>
                </label>
                <div className="relative group">
                  <Lock className="absolute start-4 top-1/2 -translate-y-1/2 text-brand-text-muted group-focus-within:text-info transition-colors" size={18} />
                  <input
                    id="profile-new-password"
                    type="password"
                    autoComplete="new-password"
                    aria-required="true"
                    aria-invalid={!!passwordForm.formState.errors.newPassword}
                    aria-describedby={passwordForm.formState.errors.newPassword ? "profile-new-password-error" : undefined}
                    placeholder="••••••••"
                    className="w-full ps-12 pe-4 py-3 bg-brand-bg-page dark:bg-brand-bg-elevated/50 border border-brand-border dark:border-brand-border rounded-2xl focus:ring-2 focus:ring-brand-primary-500/30 dark:text-brand-text-main outline-none transition-all font-medium"
                    {...passwordForm.register('newPassword')}
                  />
                </div>
                {passwordForm.formState.errors.newPassword && <p id="profile-new-password-error" className="text-rose-500 text-xs mt-1" role="alert">{passwordForm.formState.errors.newPassword.message}</p>}
              </div>
              <div className="space-y-2 mt-6">
                <label htmlFor="profile-confirm-password" className="text-xs font-black text-brand-text-muted uppercase tracking-widest ms-1">
                  {t('profile.confirmPassword', isRTL ? 'تأكيد كلمة المرور الجديدة' : 'Confirm New Password')} <span className="text-rose-500">*</span>
                </label>
                <div className="relative group">
                  <Lock className="absolute start-4 top-1/2 -translate-y-1/2 text-brand-text-muted group-focus-within:text-info transition-colors" size={18} />
                  <input
                    id="profile-confirm-password"
                    type="password"
                    autoComplete="new-password"
                    aria-required="true"
                    aria-invalid={!!passwordForm.formState.errors.confirmPassword}
                    aria-describedby={passwordForm.formState.errors.confirmPassword ? "profile-confirm-password-error" : undefined}
                    placeholder="••••••••"
                    className="w-full ps-12 pe-4 py-3 bg-brand-bg-page dark:bg-brand-bg-elevated/50 border border-brand-border dark:border-brand-border rounded-2xl focus:ring-2 focus:ring-brand-primary-500/30 dark:text-brand-text-main outline-none transition-all font-medium"
                    {...passwordForm.register('confirmPassword')}
                  />
                </div>
                {passwordForm.formState.errors.confirmPassword && <p id="profile-confirm-password-error" className="text-rose-500 text-xs mt-1" role="alert">{passwordForm.formState.errors.confirmPassword.message}</p>}
              </div>
              <div className="pt-6">
                <button
                  type="submit"
                  disabled={passwordForm.formState.isSubmitting}
                  className="w-full flex items-center justify-center gap-2 bg-brand-primary-500 hover:bg-brand-primary-600 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-lg shadow-brand-primary-500/20 dark:shadow-none disabled:opacity-50 cursor-pointer"
                >
                  {passwordForm.formState.isSubmitting ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <Lock size={20} />
                      <span>{t('profile.updatePassword', isRTL ? 'تحديث كلمة المرور' : 'Update Password')}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default EditProfileModal;
