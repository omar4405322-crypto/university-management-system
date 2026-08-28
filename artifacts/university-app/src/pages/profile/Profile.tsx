// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/button';
import Input from '../../components/ui/input';
import Badge from '../../components/ui/Badge';
import { useAuth } from '../../context/AuthContext';
import {
  Shield,
  Camera,
  Lock,
  X,
  Loader2,
  Building2,
  Award,
  AlertTriangle,
  User,
  GraduationCap,
  KeyRound,
  CheckCircle2,
  Copy,
  Calendar,
  Phone,
  Mail,
  MapPin,
  Sparkles,
  Eye,
  EyeOff,
  Check,
  Smartphone,
  Globe,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../context/LanguageContext';
import api, { getDynamicBaseUrl } from '../../services/api';
import Modal from '../../components/ui/Modal';
import { Textarea } from '../../components/ui/textarea';
import { logger } from '../../lib/logger';
import { FEATURE_FLAGS } from '../../constants/featureFlags';

export function Profile() {
  const { user, setUser } = useAuth();
  const { t, i18n } = useTranslation();
  const { isRTL } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const [activeTab, setActiveTab] = useState<'PERSONAL' | 'ACADEMIC' | 'SECURITY'>('PERSONAL');
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [copiedEmail, setCopiedEmail] = useState(false);

  // Avatar Modal State
  const [isPicModalOpen, setIsPicModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');

  // Password Modal State
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [passwordError, setPasswordError] = useState('');

  // Profile Form Data
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    address: '',
    bio: '',
    gender: '',
    birthDate: '',
  });

  const [fullProfile, setFullProfile] = useState(null);

  // Sync profile data
  useEffect(() => {
    if (user) {
      const profile = user.profile || {};
      setFormData({
        firstName: profile.firstName || user.firstName || '',
        lastName: profile.lastName || user.lastName || '',
        phone: profile.phone || user.phone || '',
        address: profile.address || user.address || '',
        bio: profile.bio || user.bio || '',
        gender: profile.gender || user.gender || '',
        birthDate:
          profile.birthDate || user.birthDate
            ? (profile.birthDate || user.birthDate).split('T')[0]
            : '',
      });
    }
  }, [user]);

  useEffect(() => {
    const controller = new AbortController();

    const fetchFullProfile = async () => {
      try {
        const response = await api.get('/users/profile', { signal: controller.signal });
        if (response.data.success) {
          const profileData = response.data.data;
          setFullProfile(profileData);

          // Merge loaded fields into form if currently empty
          setFormData((prev) => ({
            firstName: prev.firstName || profileData.firstName || profileData.user?.firstName || '',
            lastName: prev.lastName || profileData.lastName || profileData.user?.lastName || '',
            phone: prev.phone || profileData.phone || profileData.user?.phone || '',
            address: prev.address || profileData.address || profileData.user?.address || '',
            bio: prev.bio || profileData.bio || profileData.user?.bio || '',
            gender: prev.gender || profileData.gender || profileData.user?.gender || '',
            birthDate:
              prev.birthDate ||
              (profileData.birthDate || profileData.user?.birthDate
                ? (profileData.birthDate || profileData.user?.birthDate).split('T')[0]
                : ''),
          }));
        }
      } catch (error: any) {
        import('axios').then((axios) => {
          if (!axios.default.isCancel(error)) {
            logger.error('Error fetching full profile:', error);
          }
        });
      }
    };

    fetchFullProfile();
    return () => controller.abort();
  }, []);

  const handleChange = (e: any) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCopyEmail = () => {
    if (user?.email) {
      navigator.clipboard.writeText(user.email);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    }
  };

  const handleFileChange = (e: any) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setMessage({ type: 'error', text: isRTL ? 'حجم الصورة يجب أن يكون أقل من 5MB' : 'Image size must be under 5MB' });
        return;
      }
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        setMessage({ type: 'error', text: isRTL ? 'يُسمح فقط بصيغ JPG, PNG, WEBP' : 'Only JPG, PNG, WEBP allowed' });
        return;
      }
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      const response = await api.put('/users/profile', formData);
      if (response.data.success) {
        setUser({ ...user, ...response.data.data });
        setMessage({ type: 'success', text: t('profile.successUpdate', 'Profile updated successfully') });
      }
    } catch (error: any) {
      logger.error('Update profile error:', error);
      setMessage({ type: 'error', text: t('profile.errorUpdate', 'Failed to update profile') });
    } finally {
      setLoading(false);
    }
  };

  const handleEnableTwoFactor = async () => {
    setTwoFactorLoading(true);
    try {
      const response = await api.patch('/users/profile/two-factor', { enabled: !user?.twoFactorEnabled });
      if (response.data.success) {
        const isEnabled = !user?.twoFactorEnabled;
        const updated = { ...user, ...response.data.data, twoFactorEnabled: isEnabled };
        setUser(updated);
        localStorage.setItem('user', JSON.stringify(updated));
        setMessage({
          type: 'success',
          text: isEnabled
            ? t('profile.twoFactorEnabled', 'Two-factor authentication enabled.')
            : isRTL ? 'تم تعطيل المصادقة الثنائية.' : 'Two-factor authentication disabled.',
        });
      }
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.message || t('profile.twoFactorError', 'Could not enable two-factor authentication.'),
      });
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const handleUpdatePic = async () => {
    if (!selectedFile) return;
    setLoading(true);
    try {
      const form = new FormData();
      form.append('profilePicture', selectedFile);

      const response = await api.put('/users/profile/picture', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (response.data.success) {
        setUser({ ...user, profilePicture: response.data.data.profilePicture });
        setIsPicModalOpen(false);
        setSelectedFile(null);
        setPreviewUrl('');
        setMessage({ type: 'success', text: t('profile.successUpdatePic', 'Profile picture updated successfully') });
      }
    } catch (error: any) {
      logger.error('Update picture error:', error);
      setMessage({ type: 'error', text: t('profile.errorUpdatePic', 'Failed to update profile picture') });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: any) => {
    e.preventDefault();
    setPasswordError('');

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError(t('profile.passwordMismatch', 'Passwords do not match'));
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      setPasswordError(t('profile.passwordMinLength', 'Password must be at least 8 characters long and contain at least one uppercase letter and one number'));
      return;
    }

    setPasswordLoading(true);
    try {
      const res = await api.patch('/users/profile/password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });

      if (res.data.success) {
        setMessage({ type: 'success', text: t('profile.passwordSuccess', 'Password updated successfully') });
        setIsPasswordModalOpen(false);
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        setPasswordError(res.data.message || t('profile.passwordError', 'Failed to update password. Please check your current password.'));
      }
    } catch (err: any) {
      setPasswordError(
        err.response?.data?.message || t('profile.passwordError', 'Failed to update password. Please check your current password.')
      );
    } finally {
      setPasswordLoading(false);
    }
  };

  const getInitials = () => {
    const f = formData.firstName || user?.firstName || '';
    const l = formData.lastName || user?.lastName || '';
    if (f && l) return `${f[0]}${l[0]}`.toUpperCase();
    if (f) return f[0].toUpperCase();
    return user?.email?.substring(0, 2).toUpperCase() || 'U';
  };

  const getProfilePictureUrl = (path?: string) => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    const baseUrl = getDynamicBaseUrl().replace(/\/api$/, '') || 'http://localhost:5000';
    return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  };

  const roleLabel = user?.role
    ? user.role === 'SUPER_ADMIN'
      ? isRTL ? 'مدير النظام العام' : 'Super Admin'
      : user.role === 'ADMIN'
      ? isRTL ? 'مدير النظام' : 'System Admin'
      : user.role === 'DOCTOR'
      ? isRTL ? 'عضو هيئة تدريس' : 'Faculty Doctor'
      : user.role === 'TEACHING_ASSISTANT'
      ? isRTL ? 'مساعد تدريس (معيد)' : 'Teaching Assistant'
      : isRTL ? 'طالب جامعي' : 'Student'
    : '';

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Toast Alert */}
      {message.text && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs font-semibold ${
            message.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
              : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {message.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            <span>{message.text}</span>
          </div>
          <button onClick={() => setMessage({ type: '', text: '' })} className="p-1 hover:opacity-75 cursor-pointer">
            <X size={14} />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. EXECUTIVE IDENTITY HERO CARD                                           */}
      {/* ========================================================================= */}
      <div className="relative overflow-hidden bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-700 shadow-2xs">
        {/* Banner Top Gradient */}
        <div className="h-24 bg-gradient-to-r from-brand-primary-600 via-brand-primary-700 to-brand-primary-900 relative">
          <div className="absolute inset-0 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px] opacity-10" />
        </div>

        {/* Hero Info Body */}
        <div className="px-5 pb-5 pt-0 relative">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-12 mb-4">
            {/* Avatar with Camera Icon */}
            <div className="flex items-end gap-3.5">
              <div className="relative">
                <div className="h-22 w-22 rounded-2xl bg-white dark:bg-slate-800 p-1 ring-4 ring-white dark:ring-slate-800 shadow-md">
                  <div className="h-full w-full rounded-xl bg-gradient-to-br from-brand-primary-500 to-brand-primary-700 text-white font-bold text-2xl flex items-center justify-center overflow-hidden">
                    {user?.profilePicture ? (
                      <img
                        src={getProfilePictureUrl(user.profilePicture)}
                        alt="Profile"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      getInitials()
                    )}
                  </div>
                </div>

                <button
                  onClick={() => setIsPicModalOpen(true)}
                  className="absolute bottom-1 end-1 p-1.5 rounded-lg bg-brand-primary-600 hover:bg-brand-primary-700 text-white shadow-md border border-white dark:border-slate-800 transition-all cursor-pointer"
                  title={t('profile.uploadPic', 'Update Photo')}
                >
                  <Camera size={13} />
                </button>
              </div>

              {/* Name & Primary Role */}
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                    {formData.firstName || formData.lastName
                      ? `${formData.firstName} ${formData.lastName}`.trim()
                      : user?.email?.split('@')[0]}
                  </h1>
                  <Badge className="bg-brand-primary-50 dark:bg-brand-primary-950/50 text-brand-primary-700 dark:text-brand-primary-300 border border-brand-primary-200/40 text-[10px] font-bold">
                    {roleLabel}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                  <span className="font-mono">{user?.email}</span>
                  <button
                    onClick={handleCopyEmail}
                    className="p-1 text-slate-400 hover:text-brand-primary-600 cursor-pointer"
                    title={isRTL ? 'نسخ البريد' : 'Copy'}
                  >
                    {copiedEmail ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Action Button */}
            <div className="flex items-center gap-2 self-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsPasswordModalOpen(true)}
                className="h-8.5 px-3 rounded-lg text-xs font-semibold border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 gap-1.5 cursor-pointer shadow-2xs"
              >
                <KeyRound size={13} />
                <span>{t('profile.changePassword', 'Change Password')}</span>
              </Button>
            </div>
          </div>

          {/* Quick Stats Ribbon */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-slate-100 dark:border-slate-700/60 text-xs">
            {/* Affiliation */}
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700/50">
              <span className="text-[10px] text-slate-400 block font-semibold">
                {isRTL ? 'الجهة الأكاديمية' : 'Affiliation'}
              </span>
              <span className="font-bold text-slate-800 dark:text-slate-200 truncate block mt-0.5">
                {fullProfile?.department?.college?.name || fullProfile?.department?.name || (isRTL ? 'الإدارة العامة' : 'General Admin')}
              </span>
            </div>

            {/* University ID */}
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700/50">
              <span className="text-[10px] text-slate-400 block font-semibold">
                {isRTL ? 'الرقم التعريفي' : 'ID Code'}
              </span>
              <span className="font-bold text-slate-800 dark:text-slate-200 font-mono block mt-0.5">
                {fullProfile?.studentId || fullProfile?.doctorId || user?.id || '—'}
              </span>
            </div>

            {/* Joined Date */}
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700/50">
              <span className="text-[10px] text-slate-400 block font-semibold">
                {t('profile.joined', 'Joined')}
              </span>
              <span className="font-bold text-slate-800 dark:text-slate-200 block mt-0.5">
                {user?.createdAt
                  ? new Date(user.createdAt).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', {
                      month: 'short',
                      year: 'numeric',
                    })
                  : '—'}
              </span>
            </div>

            {/* 2FA Security Status */}
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700/50 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 block font-semibold">
                  {t('profile.twoFactor', 'Two-Factor Authentication')}
                </span>
                <span
                  className={`text-xs font-bold block mt-0.5 ${
                    user?.twoFactorEnabled
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {user?.twoFactorEnabled ? t('profile.enabled', 'Enabled') : (isRTL ? 'غير مفعلة' : 'Disabled')}
                </span>
              </div>
              <Shield
                size={16}
                className={user?.twoFactorEnabled ? 'text-emerald-500' : 'text-amber-500'}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. SEGMENTED TABS                                                         */}
      {/* ========================================================================= */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 w-fit">
        <button
          onClick={() => setActiveTab('PERSONAL')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'PERSONAL'
              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <User size={14} />
          <span>{t('profile.personalTab', 'Personal Information')}</span>
        </button>

        <button
          onClick={() => setActiveTab('ACADEMIC')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'ACADEMIC'
              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <GraduationCap size={14} />
          <span>{t('profile.academicTab', 'Academic & Role Record')}</span>
        </button>

        <button
          onClick={() => setActiveTab('SECURITY')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'SECURITY'
              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Shield size={14} />
          <span>{t('profile.securityTab', 'Security & Credentials')}</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 3. TAB 1: PERSONAL INFORMATION FORM                                       */}
      {/* ========================================================================= */}
      {activeTab === 'PERSONAL' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-700 p-5 shadow-2xs">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="border-b border-slate-100 dark:border-slate-700/60 pb-3">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                {t('profile.personalInfo', 'Personal Information')}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {t('profile.personalSubtitle', 'Update your basic details here.')}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
              {/* First Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('profile.firstName', 'First Name')}
                </label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  placeholder={t('profile.firstName', 'First Name')}
                  className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-1.5 focus:ring-brand-primary-500 outline-none bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                />
              </div>

              {/* Last Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('profile.lastName', 'Last Name')}
                </label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  placeholder={t('profile.lastName', 'Last Name')}
                  className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-1.5 focus:ring-brand-primary-500 outline-none bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                />
              </div>

              {/* Official Email (Read-only) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('profile.email', 'Email Address')}
                </label>
                <input
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-100 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 font-mono cursor-not-allowed opacity-80"
                />
              </div>

              {/* Phone Number */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('profile.phone', 'Phone Number')}
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="010XXXXXXXX"
                  className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-1.5 focus:ring-brand-primary-500 outline-none bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                />
              </div>

              {/* Date of Birth */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('profile.birthDate', 'Date of Birth')}
                </label>
                <input
                  type="date"
                  name="birthDate"
                  value={formData.birthDate}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-1.5 focus:ring-brand-primary-500 outline-none bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 cursor-pointer"
                />
              </div>

              {/* Address / City */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('profile.address', 'Address / City')}
                </label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  placeholder={isRTL ? 'مثال: 6 أكتوبر، الجيزة' : 'e.g. 6th of October City'}
                  className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-1.5 focus:ring-brand-primary-500 outline-none bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                />
              </div>

              {/* Bio / About */}
              <div className="sm:col-span-2 md:col-span-3">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('profile.bio', 'Bio')}
                </label>
                <textarea
                  name="bio"
                  value={formData.bio}
                  onChange={handleChange}
                  rows={3}
                  placeholder={t('profile.bioPlaceholder', 'Tell us about yourself...')}
                  className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-1.5 focus:ring-brand-primary-500 outline-none bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-700/60 flex justify-end">
              <Button
                type="submit"
                disabled={loading}
                className="h-9 px-5 bg-brand-primary-600 hover:bg-brand-primary-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
              >
                {loading ? t('common.loading', 'Loading...') : t('profile.saveChanges', 'Save Changes')}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. TAB 2: ACADEMIC & ROLE IDENTITY                                        */}
      {/* ========================================================================= */}
      {activeTab === 'ACADEMIC' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-700 p-5 shadow-2xs space-y-4">
          <div className="border-b border-slate-100 dark:border-slate-700/60 pb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                {t('profile.academicInfo', 'Academic Information')}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {t('profile.academicSubtitle', 'View your university records and academic status')}
              </p>
            </div>
            <Badge variant="info" className="text-xs font-bold">
              {roleLabel}
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
            {/* College */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700/50">
              <span className="text-[10px] text-slate-400 block font-semibold">
                {t('profile.college', 'College')}
              </span>
              <span className="font-bold text-xs text-slate-900 dark:text-white block mt-1">
                {fullProfile?.department?.college?.name || (isRTL ? 'جامعة 6 أكتوبر التكنولوجية' : '6th of October Technological University')}
              </span>
            </div>

            {/* Department */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700/50">
              <span className="text-[10px] text-slate-400 block font-semibold">
                {t('profile.department', 'Department')}
              </span>
              <span className="font-bold text-xs text-slate-900 dark:text-white block mt-1">
                {fullProfile?.department?.name || (isRTL ? 'الإدارة المركزية' : 'Central Admin')}
              </span>
            </div>

            {/* Role-Specific: Student Year / Group */}
            {user?.role === 'STUDENT' && (
              <>
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700/50">
                  <span className="text-[10px] text-slate-400 block font-semibold">
                    {t('profile.year', 'Academic Year')}
                  </span>
                  <span className="font-bold text-xs text-slate-900 dark:text-white block mt-1">
                    {isRTL ? `الفرقة ${fullProfile?.year || 1}` : `Year ${fullProfile?.year || 1}`}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700/50">
                  <span className="text-[10px] text-slate-400 block font-semibold">
                    {isRTL ? 'المجموعة / السكشن' : 'Group / Section'}
                  </span>
                  <span className="font-bold text-xs text-slate-900 dark:text-white block mt-1">
                    {fullProfile?.group
                      ? fullProfile.group.parentGroup
                        ? `${fullProfile.group.parentGroup.name} (${fullProfile.group.name})`
                        : fullProfile.group.name
                      : (isRTL ? 'غير محدد' : 'Unassigned')}
                  </span>
                </div>
              </>
            )}

            {/* Doctor / TA Specialty */}
            {(user?.role === 'DOCTOR' || user?.role === 'TEACHING_ASSISTANT') && (
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700/50">
                <span className="text-[10px] text-slate-400 block font-semibold">
                  {isRTL ? 'التخصص الأكاديمي' : 'Specialty'}
                </span>
                <span className="font-bold text-xs text-slate-900 dark:text-white block mt-1">
                  {fullProfile?.specialty || (isRTL ? 'تكنولوجيا المعلومات' : 'Information Technology')}
                </span>
              </div>
            )}

            {/* Admin Scope */}
            {['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'].includes(user?.role || '') && (
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700/50">
                <span className="text-[10px] text-slate-400 block font-semibold">
                  {isRTL ? 'نطاق الصلاحيات' : 'Access Level'}
                </span>
                <span className="font-bold text-xs text-emerald-600 dark:text-emerald-400 block mt-1">
                  {isRTL ? 'صلاحيات إدارة كاملة بالنظام' : 'Full Administrative Access'}
                </span>
              </div>
            )}
          </div>

          <p className="text-[11px] text-slate-400 italic pt-2">
            {t('profile.academicInfoNote', 'Note: Academic information can only be changed by the administrator.')}
          </p>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. TAB 3: SECURITY, PASSWORD, & 2FA                                       */}
      {/* ========================================================================= */}
      {activeTab === 'SECURITY' && (
        <div className="space-y-3.5">
          {/* Password Security Card */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-700 p-4 shadow-2xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
                <Lock size={18} />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                  {t('profile.changePassword', 'Change Password')}
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {t('profile.changePasswordSubtitle', 'Update your account password regularly.')}
                </p>
              </div>
            </div>

            <Button
              size="sm"
              onClick={() => setIsPasswordModalOpen(true)}
              className="h-8 px-3.5 bg-brand-primary-600 hover:bg-brand-primary-700 text-white rounded-lg text-xs font-bold cursor-pointer"
            >
              {t('common.update', 'Refresh')}
            </Button>
          </div>

          {/* 2FA Security Card */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-700 p-4 shadow-2xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  user?.twoFactorEnabled
                    ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400'
                    : 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400'
                }`}
              >
                <Shield size={18} />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                  {t('profile.twoFactor', 'Two-Factor Authentication')}
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {t('profile.twoFactorSubtitle', 'Protect your account with an extra verification step')}
                </p>
              </div>
            </div>

            <Button
              size="sm"
              variant={user?.twoFactorEnabled ? 'outline' : 'default'}
              onClick={handleEnableTwoFactor}
              disabled={twoFactorLoading}
              className={`h-8 px-3.5 rounded-lg text-xs font-bold cursor-pointer ${
                user?.twoFactorEnabled
                  ? 'border-emerald-200 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300'
                  : 'bg-amber-600 hover:bg-amber-700 text-white'
              }`}
            >
              {twoFactorLoading ? (
                <Loader2 className="animate-spin" size={14} />
              ) : user?.twoFactorEnabled ? (
                t('profile.enabled', 'Enabled')
              ) : (
                t('profile.enable2fa', 'Enable 2FA')
              )}
            </Button>
          </div>

          {/* Active Session Info */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-700 p-4 shadow-2xs">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white mb-2.5 flex items-center gap-2">
              <Globe size={14} className="text-brand-primary-500" />
              <span>{isRTL ? 'جلسة تسجيل الدخول الحالية' : 'Current Active Session'}</span>
            </h3>
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 text-xs">
              <div className="flex items-center gap-2.5">
                <Smartphone size={16} className="text-slate-400" />
                <div>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                    {navigator.userAgent.includes('Windows') ? 'Windows PC' : 'Web Device'} — Chrome / Browser
                  </span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                    ● {isRTL ? 'الجلسة الحالية النشطة' : 'Active Now'}
                  </span>
                </div>
              </div>
              <Badge variant="success" className="text-[10px] font-bold">
                {isRTL ? 'آمن وموثق' : 'Verified'}
              </Badge>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. MODALS: CHANGE PASSWORD & AVATAR UPLOAD                                 */}
      {/* ========================================================================= */}

      {/* Change Password Modal */}
      <Modal
        isOpen={isPasswordModalOpen}
        onClose={() => {
          setIsPasswordModalOpen(false);
          setPasswordError('');
        }}
        title={t('profile.changePassword', 'Change Password')}
        subtitle={t('profile.changePasswordSubtitle', 'Update your account password regularly.')}
        size="sm"
      >
        <form onSubmit={handlePasswordSubmit} className="space-y-3 pt-1">
          {passwordError && (
            <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 text-rose-700 dark:text-rose-300 text-xs font-semibold">
              {passwordError}
            </div>
          )}

          {/* Current Password */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t('profile.currentPassword', 'Current Password')}
            </label>
            <div className="relative">
              <input
                type={showPassword.current ? 'text' : 'password'}
                required
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                className="w-full ps-3 pe-8 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-1.5 focus:ring-brand-primary-500 outline-none bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={() => setShowPassword({ ...showPassword, current: !showPassword.current })}
                className="absolute end-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showPassword.current ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t('profile.newPassword', 'New Password')}
            </label>
            <div className="relative">
              <input
                type={showPassword.new ? 'text' : 'password'}
                required
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                className="w-full ps-3 pe-8 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-1.5 focus:ring-brand-primary-500 outline-none bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={() => setShowPassword({ ...showPassword, new: !showPassword.new })}
                className="absolute end-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showPassword.new ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t('profile.confirmPassword', 'Confirm New Password')}
            </label>
            <div className="relative">
              <input
                type={showPassword.confirm ? 'text' : 'password'}
                required
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                className="w-full ps-3 pe-8 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-1.5 focus:ring-brand-primary-500 outline-none bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={() => setShowPassword({ ...showPassword, confirm: !showPassword.confirm })}
                className="absolute end-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showPassword.confirm ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsPasswordModalOpen(false)}
              className="text-xs font-semibold"
            >
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={passwordLoading}
              className="bg-brand-primary-600 hover:bg-brand-primary-700 text-white text-xs font-bold"
            >
              {passwordLoading ? t('common.loading', 'Loading...') : t('common.save', 'Save')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Avatar Photo Upload Modal */}
      <Modal
        isOpen={isPicModalOpen}
        onClose={() => setIsPicModalOpen(false)}
        title={t('profile.uploadPic', 'Update Photo')}
        size="sm"
      >
        <div className="space-y-4 pt-1">
          <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-6 bg-slate-50 dark:bg-slate-900/40">
            {previewUrl ? (
              <div className="relative h-32 w-32 mb-2">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="h-full w-full rounded-2xl object-cover ring-4 ring-brand-primary-100 shadow-md"
                />
                <button
                  onClick={() => {
                    setSelectedFile(null);
                    setPreviewUrl('');
                  }}
                  className="absolute -top-2 -right-2 p-1 bg-rose-600 text-white rounded-full shadow-md hover:bg-rose-700"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <>
                <div className="h-16 w-16 rounded-2xl bg-brand-primary-50 dark:bg-brand-primary-950/50 text-brand-primary-600 flex items-center justify-center mb-3">
                  <Camera size={28} />
                </div>
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                  {t('profile.dropPic', 'Drop your image here')}
                </p>
                <span className="text-[10px] text-slate-400 mb-3">
                  PNG, JPG أو WebP (بحد أقصى 5MB)
                </span>
                <label className="cursor-pointer">
                  <span className="bg-brand-primary-600 hover:bg-brand-primary-700 text-white px-4 py-2 rounded-xl text-xs font-bold inline-block shadow-xs">
                    {t('profile.browseFiles', 'Browse files')}
                  </span>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={handleFileChange}
                  />
                </label>
              </>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsPicModalOpen(false)}
              className="text-xs font-semibold"
            >
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              size="sm"
              onClick={handleUpdatePic}
              disabled={!selectedFile || loading}
              className="bg-brand-primary-600 hover:bg-brand-primary-700 text-white text-xs font-bold"
            >
              {loading ? t('common.loading', 'Loading...') : t('profile.savePic', 'Save Picture')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default Profile;
