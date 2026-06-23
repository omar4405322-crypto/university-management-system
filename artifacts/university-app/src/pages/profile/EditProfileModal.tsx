import React, { useState, useEffect } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
  newPassword: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string().min(1, 'Confirm password is required'),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "New passwords do not match",
  path: ["confirmPassword"]
});

type PasswordFormData = z.infer<typeof passwordSchema>;

const EditProfileModal = ({ isOpen, onClose, profileData, onSuccess }) => {
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
        setSuccess('Profile updated successfully');
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1500);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update profile');
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
        setSuccess('Password changed successfully');
        passwordForm.reset({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setTimeout(() => {
          onClose();
        }, 1500);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to change password');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md transition-all duration-300">
      <div className="bg-brand-bg-card dark:bg-brand-bg-elevated rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in duration-300 border border-brand-border dark:border-brand-border">
        {/* Header */}
        <div className="flex justify-between items-center p-6 sm:p-8 border-b border-brand-border dark:border-brand-border bg-brand-bg-page/50 dark:bg-brand-bg-elevated/50">
          <div>
            <h2 className="text-2xl font-black text-brand-text-primary dark:text-brand-text-main tracking-tight">Profile Settings</h2>
            <p className="text-sm text-brand-text-secondary dark:text-brand-text-muted mt-1">Manage your account information and security</p>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-brand-text-muted hover:text-brand-text-secondary dark:hover:text-brand-text-secondary hover:bg-brand-bg-page dark:hover:bg-brand-bg-elevated rounded-xl transition-all"
          >
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-8 border-b border-brand-border dark:border-brand-border">
          <button 
            onClick={() => setActiveTab('general')}
            className={`flex items-center gap-2 py-4 text-sm font-bold transition-all border-b-2 ${activeTab === 'general' ? 'text-info border-info' : 'text-brand-text-secondary dark:text-brand-text-muted hover:text-brand-text-primary dark:hover:text-brand-text-secondary border-transparent'}`}
          >
            <User size={18} />
            General Info
          </button>
          <button 
            onClick={() => setActiveTab('password')}
            className={`flex items-center gap-2 py-4 px-6 text-sm font-bold transition-all border-b-2 ${activeTab === 'password' ? 'text-info border-info' : 'text-brand-text-secondary dark:text-brand-text-muted hover:text-brand-text-primary dark:hover:text-brand-text-secondary border-transparent'}`}
          >
            <Lock size={18} />
            Security
          </button>
        </div>

        <div className="p-6 sm:p-8 max-h-[70vh] overflow-y-auto no-scrollbar">
          {error && <div className="mb-6 p-4 bg-error/10 dark:bg-error/20 text-error dark:text-error text-sm font-bold rounded-2xl border border-error/20 dark:border-error/30 flex items-center gap-3">
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
                  <label className="text-xs font-black text-brand-text-muted uppercase tracking-widest ml-1">First Name</label>
                  <div className="relative group">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-text-muted group-focus-within:text-info transition-colors" size={18} />
                    <input
                      type="text"
                      placeholder="Enter first name"
                      className="w-full pl-12 pr-4 py-3 bg-brand-bg-page dark:bg-brand-bg-elevated/50 border border-brand-border dark:border-brand-border rounded-2xl focus:ring-2 focus:ring-brand-primary-500/30 dark:text-brand-text-main outline-none transition-all font-medium"
                      {...generalForm.register('firstName')}
                    />
                  </div>
                  {generalForm.formState.errors.firstName && <p className="text-rose-500 text-xs mt-1">{generalForm.formState.errors.firstName.message}</p>}
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-brand-text-muted uppercase tracking-widest ml-1">Last Name</label>
                  <div className="relative group">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-text-muted group-focus-within:text-info transition-colors" size={18} />
                    <input
                      type="text"
                      placeholder="Enter last name"
                      className="w-full pl-12 pr-4 py-3 bg-brand-bg-page dark:bg-brand-bg-elevated/50 border border-brand-border dark:border-brand-border rounded-2xl focus:ring-2 focus:ring-brand-primary-500/30 dark:text-brand-text-main outline-none transition-all font-medium"
                      {...generalForm.register('lastName')}
                    />
                  </div>
                  {generalForm.formState.errors.lastName && <p className="text-rose-500 text-xs mt-1">{generalForm.formState.errors.lastName.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-black text-brand-text-muted uppercase tracking-widest ml-1">Phone Number</label>
                  <div className="relative group">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-text-muted group-focus-within:text-info transition-colors" size={18} />
                    <input
                      type="tel"
                      placeholder="+20 123 456 7890"
                      className="w-full pl-12 pr-4 py-3 bg-brand-bg-page dark:bg-brand-bg-elevated/50 border border-brand-border dark:border-brand-border rounded-2xl focus:ring-2 focus:ring-brand-primary-500/30 dark:text-brand-text-main outline-none transition-all font-medium"
                      {...generalForm.register('phone')}
                    />
                  </div>
                  {generalForm.formState.errors.phone && <p className="text-rose-500 text-xs mt-1">{generalForm.formState.errors.phone.message}</p>}
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-brand-text-muted uppercase tracking-widest ml-1">Gender</label>
                  <div className="relative group">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-text-muted group-focus-within:text-info transition-colors" size={18} />
                    <select
                      className="w-full pl-12 pr-4 py-3 bg-brand-bg-page dark:bg-brand-bg-elevated/50 border border-brand-border dark:border-brand-border rounded-2xl focus:ring-2 focus:ring-brand-primary-500/30 dark:text-brand-text-main outline-none transition-all font-medium appearance-none"
                      {...generalForm.register('gender')}
                    >
                      <option value="">Select Gender</option>
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                  {generalForm.formState.errors.gender && <p className="text-rose-500 text-xs mt-1">{generalForm.formState.errors.gender.message}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-brand-text-muted uppercase tracking-widest ml-1">Birth Date</label>
                <div className="relative group">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-text-muted group-focus-within:text-info transition-colors" size={18} />
                  <input
                    type="date"
                    className="w-full pl-12 pr-4 py-3 bg-brand-bg-page dark:bg-brand-bg-elevated/50 border border-brand-border dark:border-brand-border rounded-2xl focus:ring-2 focus:ring-brand-primary-500/30 dark:text-brand-text-main outline-none transition-all font-medium"
                    {...generalForm.register('birthDate')}
                  />
                </div>
                {generalForm.formState.errors.birthDate && <p className="text-rose-500 text-xs mt-1">{generalForm.formState.errors.birthDate.message}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-brand-text-muted uppercase tracking-widest ml-1">Residential Address</label>
                <div className="relative group">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-text-muted group-focus-within:text-info transition-colors" size={18} />
                  <input
                    type="text"
                    placeholder="Enter your address"
                    className="w-full pl-12 pr-4 py-3 bg-brand-bg-page dark:bg-brand-bg-elevated/50 border border-brand-border dark:border-brand-border rounded-2xl focus:ring-2 focus:ring-brand-primary-500/30 dark:text-brand-text-main outline-none transition-all font-medium"
                    {...generalForm.register('address')}
                  />
                </div>
                {generalForm.formState.errors.address && <p className="text-rose-500 text-xs mt-1">{generalForm.formState.errors.address.message}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-brand-text-muted uppercase tracking-widest ml-1">Biography</label>
                <div className="relative group">
                  <AlignLeft className="absolute left-4 top-4 text-brand-text-muted group-focus-within:text-info transition-colors" size={18} />
                  <textarea
                    rows={4}
                    placeholder="Tell us about yourself..."
                    className="w-full pl-12 pr-4 py-3 bg-brand-bg-page dark:bg-brand-bg-elevated/50 border border-brand-border dark:border-brand-border rounded-2xl focus:ring-2 focus:ring-brand-primary-500/30 dark:text-brand-text-main outline-none transition-all font-medium resize-none"
                    {...generalForm.register('bio')}
                  />
                </div>
                {generalForm.formState.errors.bio && <p className="text-rose-500 text-xs mt-1">{generalForm.formState.errors.bio.message}</p>}
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={generalForm.formState.isSubmitting}
                  className="w-full flex items-center justify-center space-x-2 bg-brand-primary-500 hover:bg-brand-primary-600 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-lg shadow-brand-primary-500/20 dark:shadow-none disabled:opacity-50"
                >
                  {generalForm.formState.isSubmitting ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <Save size={20} />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="form-section">
              <div className="space-y-2">
                <label className="text-xs font-black text-brand-text-muted uppercase tracking-widest ml-1">Current Password</label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-text-muted group-focus-within:text-info transition-colors" size={18} />
                  <input
                    type="password"
                    placeholder="••••••••"
                    className="w-full pl-12 pr-4 py-3 bg-brand-bg-page dark:bg-brand-bg-elevated/50 border border-brand-border dark:border-brand-border rounded-2xl focus:ring-2 focus:ring-brand-primary-500/30 dark:text-brand-text-main outline-none transition-all font-medium"
                    {...passwordForm.register('currentPassword')}
                  />
                </div>
                {passwordForm.formState.errors.currentPassword && <p className="text-rose-500 text-xs mt-1">{passwordForm.formState.errors.currentPassword.message}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-brand-text-muted uppercase tracking-widest ml-1">New Password</label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-text-muted group-focus-within:text-info transition-colors" size={18} />
                  <input
                    type="password"
                    placeholder="••••••••"
                    className="w-full pl-12 pr-4 py-3 bg-brand-bg-page dark:bg-brand-bg-elevated/50 border border-brand-border dark:border-brand-border rounded-2xl focus:ring-2 focus:ring-brand-primary-500/30 dark:text-brand-text-main outline-none transition-all font-medium"
                    {...passwordForm.register('newPassword')}
                  />
                </div>
                {passwordForm.formState.errors.newPassword && <p className="text-rose-500 text-xs mt-1">{passwordForm.formState.errors.newPassword.message}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-brand-text-muted uppercase tracking-widest ml-1">Confirm New Password</label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-text-muted group-focus-within:text-info transition-colors" size={18} />
                  <input
                    type="password"
                    placeholder="••••••••"
                    className="w-full pl-12 pr-4 py-3 bg-brand-bg-page dark:bg-brand-bg-elevated/50 border border-brand-border dark:border-brand-border rounded-2xl focus:ring-2 focus:ring-brand-primary-500/30 dark:text-brand-text-main outline-none transition-all font-medium"
                    {...passwordForm.register('confirmPassword')}
                  />
                </div>
                {passwordForm.formState.errors.confirmPassword && <p className="text-rose-500 text-xs mt-1">{passwordForm.formState.errors.confirmPassword.message}</p>}
              </div>
              <div className="pt-4">
                <button
                  type="submit"
                  disabled={passwordForm.formState.isSubmitting}
                  className="w-full flex items-center justify-center space-x-2 bg-brand-primary-500 hover:bg-brand-primary-600 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-lg shadow-brand-primary-500/20 dark:shadow-none disabled:opacity-50"
                >
                  {passwordForm.formState.isSubmitting ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <Lock size={20} />
                      <span>Update Password</span>
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
