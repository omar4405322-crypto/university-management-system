// @ts-nocheck
import React, { useState, useEffect } from 'react';
import {
  User,
  Lock,
  Globe,
  Shield,
  Palette,
  Database,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sun,
  Moon,
  Smartphone,
  Clock,
  KeyRound,
  Check,
  Sparkles,
  Sliders,
} from 'lucide-react';
import {
  getScheduleStartTime,
  setScheduleStartTime,
  getScheduleTimeStep,
  setScheduleTimeStep,
} from '../../utils/scheduleConfig';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/ui/button';
import Badge from '../../components/ui/Badge';
import api from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { FEATURE_FLAGS } from '../../constants/featureFlags';

export function SettingsPage() {
  const { t } = useTranslation();
  const { language, setLanguage, isRTL } = useLanguage();
  const { isDark, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'account' | 'security' | 'appearance' | 'system'>('account');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<any>({});

  // Account Data
  const [accountData, setAccountData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
  });

  useEffect(() => {
    if (user) {
      setAccountData({
        firstName: user.profile?.firstName || user.firstName || '',
        lastName: user.profile?.lastName || user.lastName || '',
        phone: user.profile?.phone || user.phone || '',
      });
    }
  }, [user]);

  // Password Data
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // Schedule Config State
  const [scheduleStartTime, setScheduleStartTimeState] = useState(getScheduleStartTime);
  const [scheduleTimeStep, setScheduleTimeStepState] = useState(getScheduleTimeStep);

  const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(user?.role);
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const twoFactorEnabled = Boolean(user?.twoFactorEnabled);

  const handleAccountUpdate = async (e: any) => {
    e.preventDefault();
    if (!accountData.firstName.trim() || !accountData.lastName.trim()) {
      showToast(isRTL ? 'يرجى إدخال الاسم الأول واسم العائلة' : 'Please enter both first and last name', 'error');
      return;
    }

    setLoading(true);
    try {
      await api.put('/users/profile', accountData);
      showToast(t('settings.profileUpdated', 'Profile updated successfully'), 'success');
    } catch (error: any) {
      showToast(error.response?.data?.message || t('settings.profileUpdateError', 'Error updating profile'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e: any) => {
    e.preventDefault();
    if (!passwordData.currentPassword) {
      showToast(isRTL ? 'يرجى إدخال كلمة المرور الحالية' : 'Current password is required', 'error');
      return;
    }
    if (passwordData.newPassword.length < 8) {
      showToast(isRTL ? 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' : 'Password must be at least 8 characters', 'error');
      return;
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      showToast(isRTL ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match', 'error');
      return;
    }

    setLoading(true);
    try {
      await api.patch('/users/profile/password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
      showToast(t('settings.passwordUpdated', 'Password updated successfully'), 'success');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error: any) {
      showToast(error.response?.data?.message || t('settings.passwordUpdateError', 'Error updating password'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveScheduleConfig = (e: any) => {
    e.preventDefault();
    setScheduleStartTime(scheduleStartTime);
    setScheduleTimeStep(scheduleTimeStep);
    showToast(t('settings.scheduleConfigSaved', 'Schedule settings saved successfully'), 'success');
  };

  const roleLabel = user?.role
    ? user.role === 'SUPER_ADMIN'
      ? isRTL ? 'مدير عام النظام' : 'Super Admin'
      : user.role === 'ADMIN'
      ? isRTL ? 'مدير النظام' : 'System Admin'
      : user.role === 'DOCTOR'
      ? isRTL ? 'عضو هيئة تدريس' : 'Faculty Doctor'
      : user.role === 'TEACHING_ASSISTANT'
      ? isRTL ? 'مساعد تدريس' : 'Teaching Assistant'
      : isRTL ? 'طالب جامعي' : 'Student'
    : '';

  const tabs = [
    { id: 'account', label: isRTL ? 'الحساب والبيانات' : 'Account & Info', icon: User },
    { id: 'security', label: isRTL ? 'الأمان وكلمة المرور' : 'Security & Password', icon: Shield },
    { id: 'appearance', label: isRTL ? 'المظهر واللغة' : 'Appearance & Theme', icon: Palette },
    ...(isAdmin ? [{ id: 'system', label: isRTL ? 'إعدادات النظام والجدول' : 'System & Timetable', icon: Sliders }] : []),
  ];

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            {t('nav.settings', 'Settings')}
          </h1>
          <p className="text-xs text-slate-400 font-semibold mt-0.5">
            {t('settings.subtitle', 'Manage your account and platform preferences')}
          </p>
        </div>
        <Badge variant="info" className="text-xs font-bold">
          {roleLabel}
        </Badge>
      </div>

      {/* Modern Segmented Navigation Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 w-fit">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Tab 1: Account Information ── */}
      {activeTab === 'account' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-700 p-5 shadow-2xs">
          <form onSubmit={handleAccountUpdate} className="space-y-4">
            <div className="border-b border-slate-100 dark:border-slate-700/60 pb-3">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                {t('settings.accountInfo', 'Account Information')}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {t('settings.accountInfoDesc', 'Update your personal details and contact info')}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
              {/* First Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('auth.firstName', 'First Name')}
                </label>
                <input
                  type="text"
                  value={accountData.firstName}
                  onChange={(e) => setAccountData({ ...accountData, firstName: e.target.value })}
                  placeholder={t('settings.firstNamePlaceholder', 'Enter your first name')}
                  className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-1.5 focus:ring-brand-primary-500 outline-none bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                />
              </div>

              {/* Last Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('auth.lastName', 'Last Name')}
                </label>
                <input
                  type="text"
                  value={accountData.lastName}
                  onChange={(e) => setAccountData({ ...accountData, lastName: e.target.value })}
                  placeholder={t('settings.lastNamePlaceholder', 'Enter your last name')}
                  className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-1.5 focus:ring-brand-primary-500 outline-none bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('profile.phone', 'Phone Number')}
                </label>
                <input
                  type="tel"
                  value={accountData.phone}
                  onChange={(e) => setAccountData({ ...accountData, phone: e.target.value })}
                  placeholder="010XXXXXXXX"
                  className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-1.5 focus:ring-brand-primary-500 outline-none bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                />
              </div>

              {/* Email (Read-only) */}
              <div className="sm:col-span-2 md:col-span-3">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('auth.emailAddress', 'Email Address')}
                </label>
                <input
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-100 dark:bg-slate-900/60 text-slate-500 font-mono cursor-not-allowed opacity-80"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  {t('settings.emailCannotBeChanged', 'Email cannot be changed')}
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-700/60 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => (window.location.href = '/profile')}
                className="text-xs font-semibold"
              >
                {t('settings.viewProfile', 'View Full Profile')}
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={loading}
                className="bg-brand-primary-600 hover:bg-brand-primary-700 text-white text-xs font-bold cursor-pointer"
              >
                {loading ? t('common.loading', 'Loading...') : t('common.saveChanges', 'Save Changes')}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* ── Tab 2: Security & Password ── */}
      {activeTab === 'security' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-700 p-5 shadow-2xs">
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div className="border-b border-slate-100 dark:border-slate-700/60 pb-3">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                {t('settings.password', 'Change Password')}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {t('settings.passwordDesc', 'Update your account password')}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {/* Current Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('settings.currentPassword', 'Current Password')}
                </label>
                <input
                  type="password"
                  required
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-1.5 focus:ring-brand-primary-500 outline-none bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                />
              </div>

              {/* New Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('settings.newPassword', 'New Password')}
                </label>
                <input
                  type="password"
                  required
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  placeholder="8 أحرف على الأقل"
                  className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-1.5 focus:ring-brand-primary-500 outline-none bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                />
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('settings.confirmPassword', 'Confirm New Password')}
                </label>
                <input
                  type="password"
                  required
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  placeholder="تأكيد الكلمة"
                  className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-1.5 focus:ring-brand-primary-500 outline-none bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-700/60 flex justify-end">
              <Button
                type="submit"
                size="sm"
                disabled={loading}
                className="bg-brand-primary-600 hover:bg-brand-primary-700 text-white text-xs font-bold cursor-pointer"
              >
                {loading ? t('common.loading', 'Loading...') : t('settings.updatePassword', 'Update Password')}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* ── Tab 3: Appearance & Language ── */}
      {activeTab === 'appearance' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-700 p-5 shadow-2xs space-y-4">
          <div className="border-b border-slate-100 dark:border-slate-700/60 pb-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              {t('settings.appearanceTitle', 'Appearance & Localization')}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {t('settings.appearanceDesc', 'Customize your visual experience and language')}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Dark Mode Toggle */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shadow-2xs">
                  {isDark ? <Moon size={18} className="text-brand-primary-400" /> : <Sun size={18} className="text-amber-500" />}
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                    {t('settings.darkMode', 'Dark Mode')}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {isDark ? (isRTL ? 'الوضع الليلي مفعل حالياً' : 'Dark mode is active') : (isRTL ? 'الوضع النهاري مفعل حالياً' : 'Light mode is active')}
                  </p>
                </div>
              </div>

              <button
                onClick={toggleTheme}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                  isDark ? 'bg-brand-primary-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform ${
                    isDark ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Language Switcher */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shadow-2xs">
                  <Globe size={18} className="text-brand-primary-500" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                    {t('settings.language', 'Display Language')}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {language === 'ar' ? 'العربية (Arabic)' : 'English (الإنجليزية)'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setLanguage('ar')}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                    language === 'ar' ? 'bg-brand-primary-600 text-white' : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  عربي
                </button>
                <button
                  type="button"
                  onClick={() => setLanguage('en')}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                    language === 'en' ? 'bg-brand-primary-600 text-white' : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  English
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 4: System & Timetable Config (Admin Only) ── */}
      {activeTab === 'system' && isAdmin && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-700 p-5 shadow-2xs space-y-4">
          <div className="border-b border-slate-100 dark:border-slate-700/60 pb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                {t('settings.scheduleTimingConfig', 'Schedule Timing Configuration')}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {t('settings.scheduleTimingConfigDesc', 'Configure daily lecture start time and duration intervals across the university.')}
              </p>
            </div>
            <Badge variant="primary" className="text-xs font-bold">
              SUPER ADMIN
            </Badge>
          </div>

          <form onSubmit={handleSaveScheduleConfig} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Lecture Start Time */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('settings.lectureStartTime', 'Daily Schedule Start Time')}
                </label>
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-brand-primary-500 shrink-0" />
                  <select
                    value={scheduleStartTime}
                    onChange={(e) => setScheduleStartTimeState(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-1.5 focus:ring-brand-primary-500 outline-none bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 cursor-pointer"
                  >
                    <option value="07:00">07:00 AM</option>
                    <option value="08:00">08:00 AM</option>
                    <option value="09:00">09:00 AM ({isRTL ? 'مستحسن' : 'Recommended'})</option>
                    <option value="10:00">10:00 AM</option>
                    <option value="11:00">11:00 AM</option>
                  </select>
                </div>
              </div>

              {/* Schedule Time Step */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('settings.scheduleStepMinutes', 'Session Interval (Minutes)')}
                </label>
                <select
                  value={scheduleTimeStep}
                  onChange={(e) => setScheduleTimeStepState(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-1.5 focus:ring-brand-primary-500 outline-none bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 cursor-pointer"
                >
                  <option value="3">كل 3 دقائق (Every 3 mins)</option>
                  <option value="5">كل 5 دقائق (Every 5 mins)</option>
                  <option value="15">كل 15 دقيقة (Every 15 mins)</option>
                  <option value="30">كل 30 دقيقة (Every 30 mins)</option>
                  <option value="60">كل 60 دقيقة (Every hour)</option>
                </select>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-700/60 flex justify-end">
              <Button
                type="submit"
                size="sm"
                className="bg-brand-primary-600 hover:bg-brand-primary-700 text-white text-xs font-bold cursor-pointer"
              >
                {t('common.saveChanges', 'Save Changes')}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default SettingsPage;
