// @ts-nocheck
// FIXED: Phase 4 — full i18n for tabs, labels, validation, and placeholders
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
  Video,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Badge from '../../components/ui/Badge';
import api from '../../services/api';
import { CAMPUS_HERO_2, UNIVERSITY_PROMO_VIDEO } from '../../constants/universityAssets';
import { useToast } from '../../context/ToastContext';

const SettingsPage = () => {
  const { t } = useTranslation();
  const { language, setLanguage } = useLanguage();
  const { isDark, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('account');
  const [videoError, setVideoError] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const [accountData, setAccountData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
  });

  useEffect(() => {
    if (user) {
      setAccountData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        phone: user.phone || '',
      });
    }
  }, [user]);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();
  const [errors, setErrors] = useState<any>({});

    const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(user?.role);
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const twoFactorEnabled = Boolean(user?.twoFactorEnabled);

  useEffect(() => {
    const handler = (e) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);


  const validateAccount = () => {
    const newErrors: Record<string, unknown> = {};
    if (!accountData.firstName.trim()) newErrors.firstName = t('settings.firstNameRequired');
    if (!accountData.lastName.trim()) newErrors.lastName = t('settings.lastNameRequired');
    if (accountData.phone && !/^\+?[\d\s-]{8,}$/.test(accountData.phone)) {
      newErrors.phone = t('settings.phoneInvalid');
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAccountUpdate = async (e) => {
    e.preventDefault();
    if (!validateAccount()) return;

    setLoading(true);
    try {
      await api.put('/users/profile', accountData);
      showToast(t('settings.profileUpdated'), 'success');
      setIsDirty(false);
    } catch (error: any) {
      showToast(error.response?.data?.message || t('settings.profileUpdateError'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const validatePassword = () => {
    const newErrors: Record<string, unknown> = {};
    if (!passwordData.currentPassword)
      newErrors.currentPassword = t('settings.currentPasswordRequired');
    if (passwordData.newPassword.length < 6) newErrors.newPassword = t('settings.newPasswordMin');
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      newErrors.confirmPassword = t('settings.passwordMismatch');
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (!validatePassword()) return;

    setLoading(true);
    try {
      await api.put('/users/profile/password', passwordData);
      showToast(t('settings.passwordUpdated'), 'success');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setErrors({});
      setIsDirty(false);
    } catch (error: any) {
      showToast(error.response?.data?.message || t('settings.passwordUpdateError'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'account', label: t('settings.account'), icon: User },
    { id: 'security', label: t('settings.security'), icon: Shield },
    { id: 'appearance', label: t('settings.appearance'), icon: Palette },
    ...(isAdmin ? [{ id: 'system', label: t('settings.system'), icon: Database }] : []),
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-brand-text-primary tracking-tight m-0">
            {t('nav.settings')}
          </h1>
          <p className="text-brand-text-sub font-bold mt-1.5">{t('settings.subtitle')}</p>
        </div>
        <Badge variant="info" className="px-3 py-1.5 text-xs font-black uppercase tracking-widest">
          {user?.role?.replace('_', ' ')}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 xl:grid-cols-6 gap-6">
        {/* Sidebar Tabs — compact card */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="p-1.5">
            <nav className="space-y-0.5">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${
                    activeTab === tab.id
                      ? 'bg-brand-brand-green-dark text-white shadow-sm shadow-brand-brand-green-dark/20'
                      : 'text-brand-text-secondary hover:text-brand-text-primary hover:bg-surface-subtle'
                  }`}
                >
                  <tab.icon
                    size={16}
                    className={`shrink-0 ${activeTab === tab.id ? 'text-white' : 'text-brand-text-muted'}`}
                  />
                  <span className="text-xs font-black uppercase tracking-widest">{tab.label}</span>
                </button>
              ))}
            </nav>
          </Card>

          <Button
            variant="outline"
            className="w-full justify-start gap-3 text-error border-error/20 hover:bg-error/5 hover:border-error/30 text-xs font-black uppercase tracking-widest"
            onClick={logout}
          >
            <LogOut size={16} className="rtl:-scale-x-100" /> {t('nav.logout')}
          </Button>
        </div>

        {/* Content Area */}
        <div className="lg:col-span-4 xl:col-span-5 space-y-6">
          {/* ── Account Tab ── */}
          {activeTab === 'account' && (
            <Card>
              <div className="px-6 py-5 border-b border-brand-border">
                <h2 className="text-lg font-black text-brand-text-primary tracking-tight m-0">
                  {t('settings.accountInfo')}
                </h2>
                <p className="text-xs font-semibold text-brand-text-muted mt-0.5">
                  {t('settings.accountInfoDesc')}
                </p>
              </div>

              <div className="p-6 bg-gradient-to-r from-brand-primary-50/50 to-transparent border-b border-brand-border">
                <div className="flex items-center gap-5">
                  <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-brand-brand-green to-brand-primary-600 flex items-center justify-center text-white text-xl font-black shadow-lg shrink-0">
                    {user?.firstName?.[0]}
                    {user?.lastName?.[0]}
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-brand-text-primary">
                      {user?.firstName} {user?.lastName}
                    </h3>
                    <p className="text-sm font-semibold text-brand-text-muted">{user?.email}</p>
                    <Badge
                      variant="info"
                      className="mt-1.5 text-[10px] px-2.5 py-0.5 font-black uppercase tracking-widest"
                    >
                      {user?.role?.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>
              </div>

              <form onSubmit={handleAccountUpdate}>
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-brand-text-muted uppercase tracking-widest ms-1">
                        {t('auth.firstName')}
                      </label>
                      <input
                        value={accountData.firstName}
                        onChange={(e) => {
                          setAccountData({ ...accountData, firstName: e.target.value });
                          setIsDirty(true);
                          if (errors.firstName) setErrors({ ...errors, firstName: null });
                        }}
                        className={`w-full px-4 py-2.5 bg-brand-bg-card dark:bg-brand-bg-elevated border rounded-xl text-sm font-bold text-brand-text-primary placeholder:text-brand-text-muted focus:outline-none focus:ring-2 focus:ring-brand-brand-green-dark/20 transition-all ${errors.firstName ? 'border-error focus:ring-error/20' : 'border-brand-border'}`}
                        placeholder={t('settings.firstNamePlaceholder')}
                      />
                      {errors.firstName && (
                        <p className="text-[10px] font-bold text-error uppercase tracking-widest">
                          {errors.firstName}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-brand-text-muted uppercase tracking-widest ms-1">
                        {t('auth.lastName')}
                      </label>
                      <input
                        value={accountData.lastName}
                        onChange={(e) => {
                          setAccountData({ ...accountData, lastName: e.target.value });
                          setIsDirty(true);
                          if (errors.lastName) setErrors({ ...errors, lastName: null });
                        }}
                        className={`w-full px-4 py-2.5 bg-brand-bg-card dark:bg-brand-bg-elevated border rounded-xl text-sm font-bold text-brand-text-primary placeholder:text-brand-text-muted focus:outline-none focus:ring-2 focus:ring-brand-brand-green-dark/20 transition-all ${errors.lastName ? 'border-error focus:ring-error/20' : 'border-brand-border'}`}
                        placeholder={t('settings.lastNamePlaceholder')}
                      />
                      {errors.lastName && (
                        <p className="text-[10px] font-bold text-error uppercase tracking-widest">
                          {errors.lastName}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-brand-text-muted uppercase tracking-widest ms-1">
                        {t('profile.phone')}
                      </label>
                      <input
                        value={accountData.phone}
                        onChange={(e) => {
                          setAccountData({ ...accountData, phone: e.target.value });
                          setIsDirty(true);
                          if (errors.phone) setErrors({ ...errors, phone: null });
                        }}
                        className={`w-full px-4 py-2.5 bg-brand-bg-card dark:bg-brand-bg-elevated border rounded-xl text-sm font-bold text-brand-text-primary placeholder:text-brand-text-muted focus:outline-none focus:ring-2 focus:ring-brand-brand-green-dark/20 transition-all ${errors.phone ? 'border-error focus:ring-error/20' : 'border-brand-border'}`}
                        placeholder={t('settings.phonePlaceholder')}
                      />
                      {errors.phone && (
                        <p className="text-[10px] font-bold text-error uppercase tracking-widest">
                          {errors.phone}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-brand-text-muted uppercase tracking-widest ms-1">
                        {t('auth.emailAddress')}
                      </label>
                      <input
                        value={user?.email || ''}
                        disabled
                        className="w-full px-4 py-2.5 bg-surface-subtle/50 dark:bg-slate-800/50 border border-brand-border rounded-xl text-sm font-bold text-brand-text-muted cursor-not-allowed"
                      />
                      <p className="text-[10px] font-bold text-brand-text-muted uppercase tracking-widest">
                        {t('settings.emailCannotBeChanged')}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="px-6 py-4 bg-surface-subtle/50 border-t border-brand-border flex justify-end gap-3">
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => (window.location.href = '/profile')}
                    className="text-xs font-black uppercase tracking-widest"
                  >
                    {t('settings.viewProfile')}
                  </Button>
                  <Button
                    type="submit"
                    disabled={loading}
                    className="text-xs font-black uppercase tracking-widest"
                  >
                    {loading ? (
                      <Loader2 className="animate-spin" size={16} />
                    ) : (
                      t('common.saveChanges')
                    )}
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {/* ── Security Tab ── */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              <Card>
                <div className="px-6 py-5 border-b border-brand-border">
                  <h2 className="text-lg font-black text-brand-text-primary tracking-tight m-0">
                    {t('settings.password')}
                  </h2>
                  <p className="text-xs font-semibold text-brand-text-muted mt-0.5">
                    {t('settings.passwordDesc')}
                  </p>
                </div>
                <form onSubmit={handlePasswordChange}>
                  <div className="p-6 space-y-5">
                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-brand-text-muted uppercase tracking-widest ms-1">
                        {t('settings.currentPassword')}
                      </label>
                      <input
                        type="password"
                        value={passwordData.currentPassword}
                        onChange={(e) => {
                          setPasswordData({ ...passwordData, currentPassword: e.target.value });
                          setIsDirty(true);
                          if (errors.currentPassword)
                            setErrors({ ...errors, currentPassword: null });
                        }}
                        className={`w-full px-4 py-2.5 bg-brand-bg-card dark:bg-brand-bg-elevated border rounded-xl text-sm font-bold text-brand-text-primary placeholder:text-brand-text-muted focus:outline-none focus:ring-2 focus:ring-brand-brand-green-dark/20 transition-all ${errors.currentPassword ? 'border-error focus:ring-error/20' : 'border-brand-border'}`}
                        placeholder={t('auth.passwordPlaceholder')}
                      />
                      {errors.currentPassword && (
                        <p className="text-[10px] font-bold text-error uppercase tracking-widest">
                          {errors.currentPassword}
                        </p>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="space-y-1.5">
                        <label className="text-xs font-black text-brand-text-muted uppercase tracking-widest ms-1">
                          {t('settings.newPassword')}
                        </label>
                        <input
                          type="password"
                          value={passwordData.newPassword}
                          onChange={(e) => {
                            setPasswordData({ ...passwordData, newPassword: e.target.value });
                            setIsDirty(true);
                            if (errors.newPassword) setErrors({ ...errors, newPassword: null });
                          }}
                          className={`w-full px-4 py-2.5 bg-brand-bg-card dark:bg-brand-bg-elevated border rounded-xl text-sm font-bold text-brand-text-primary placeholder:text-brand-text-muted focus:outline-none focus:ring-2 focus:ring-brand-brand-green-dark/20 transition-all ${errors.newPassword ? 'border-error focus:ring-error/20' : 'border-brand-border'}`}
                          placeholder={t('settings.minPasswordPlaceholder')}
                        />
                        {errors.newPassword && (
                          <p className="text-[10px] font-bold text-error uppercase tracking-widest">
                            {errors.newPassword}
                          </p>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-black text-brand-text-muted uppercase tracking-widest ms-1">
                          {t('settings.confirmPassword')}
                        </label>
                        <input
                          type="password"
                          value={passwordData.confirmPassword}
                          onChange={(e) => {
                            setPasswordData({ ...passwordData, confirmPassword: e.target.value });
                            setIsDirty(true);
                            if (errors.confirmPassword)
                              setErrors({ ...errors, confirmPassword: null });
                          }}
                          className={`w-full px-4 py-2.5 bg-brand-bg-card dark:bg-brand-bg-elevated border rounded-xl text-sm font-bold text-brand-text-primary placeholder:text-brand-text-muted focus:outline-none focus:ring-2 focus:ring-brand-brand-green-dark/20 transition-all ${errors.confirmPassword ? 'border-error focus:ring-error/20' : 'border-brand-border'}`}
                          placeholder={t('settings.repeatPasswordPlaceholder')}
                        />
                        {errors.confirmPassword && (
                          <p className="text-[10px] font-bold text-error uppercase tracking-widest">
                            {errors.confirmPassword}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="px-6 py-4 bg-surface-subtle/50 border-t border-brand-border flex justify-end">
                    <Button
                      type="submit"
                      disabled={loading}
                      className="text-xs font-black uppercase tracking-widest"
                    >
                      {loading ? (
                        <Loader2 className="animate-spin" size={16} />
                      ) : (
                        t('settings.updatePassword')
                      )}
                    </Button>
                  </div>
                </form>
              </Card>

              <Card>
                <div className="px-6 py-5 border-b border-brand-border">
                  <h2 className="text-lg font-black text-brand-text-primary tracking-tight m-0">
                    {t('settings.twoFactor')}
                  </h2>
                  <p className="text-xs font-semibold text-brand-text-muted mt-0.5">
                    {t('settings.twoFactorDesc')}
                  </p>
                </div>
                <div className="p-6 space-y-4">
                  {isSuperAdmin && !twoFactorEnabled && (
                    <div className="p-4 rounded-xl border-2 border-brand-accent-yellow bg-brand-accent-yellow/10 flex items-start gap-3">
                      <AlertCircle className="text-brand-accent-yellow shrink-0 mt-0.5" size={20} />
                      <p className="text-sm font-bold text-brand-text-primary">
                        {t('settings.twoFactorWarning')}
                      </p>
                    </div>
                  )}
                  <div
                    className={`flex items-center justify-between p-4 rounded-xl border bg-brand-bg-page/30 hover:bg-brand-bg-page/50 transition-all ${
                      isSuperAdmin && !twoFactorEnabled
                        ? 'border-brand-accent-yellow'
                        : 'border-brand-border'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-xl bg-brand-bg-card border border-brand-border flex items-center justify-center text-brand-text-sub shadow-sm">
                        <Smartphone size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-brand-text-primary">
                          {t('settings.authenticatorApp')}
                        </p>
                        <p className="text-xs font-semibold text-brand-text-muted mt-0.5">
                          {t('settings.authenticatorDesc')}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      className="text-xs font-black uppercase tracking-widest"
                    >
                      {t('common.setup')}
                    </Button>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-xl border border-brand-border bg-brand-bg-page/30 opacity-60">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-xl bg-brand-bg-card border border-brand-border flex items-center justify-center text-brand-text-sub shadow-sm">
                        <Lock size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-brand-text-primary">
                          {t('settings.securityKeys')}
                        </p>
                        <p className="text-xs font-semibold text-brand-text-muted mt-0.5">
                          {t('settings.securityKeysDesc')}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant="neutral"
                      className="text-[10px] font-black uppercase tracking-widest"
                    >
                      {t('common.comingSoon')}
                    </Badge>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* ── Appearance Tab ── */}
          {activeTab === 'appearance' && (
            <Card>
              <div className="px-6 py-5 border-b border-brand-border">
                <h2 className="text-lg font-black text-brand-text-primary tracking-tight m-0">
                  {t('settings.appearanceTitle')}
                </h2>
                <p className="text-xs font-semibold text-brand-text-muted mt-0.5">
                  {t('settings.appearanceDesc')}
                </p>
              </div>
              <div className="p-6 space-y-6">
                <div className="flex items-center justify-between p-4 rounded-xl border border-brand-border bg-brand-bg-page/30">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-xl bg-brand-bg-card border border-brand-border flex items-center justify-center shadow-sm">
                      {isDark ? (
                        <Moon size={18} className="text-brand-navy-500" />
                      ) : (
                        <Sun size={18} className="text-brand-accent-yellow" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-brand-text-primary">
                        {t('settings.darkMode')}
                      </p>
                      <p className="text-xs font-semibold text-brand-text-muted mt-0.5">
                        {t('settings.darkModeDesc')}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={toggleTheme}
                    className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-brand-green-dark/30 shrink-0 ${isDark ? 'bg-brand-brand-green-dark' : 'bg-slate-200'}`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${isDark ? 'translate-x-6' : 'translate-x-1'}`}
                    />
                  </button>
                </div>
                <p className="text-xs text-brand-text-muted mt-2">
                  {t('settings.themeNote') || 'You can also toggle theme from the header toolbar.'}
                </p>

                <div className="flex items-center justify-between p-4 rounded-xl border border-brand-border bg-brand-bg-page/30">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-xl bg-brand-bg-card border border-brand-border flex items-center justify-center shadow-sm">
                      <Globe size={18} className="text-brand-brand-green-dark" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-brand-text-primary">
                        {t('settings.language')}
                      </p>
                      <p className="text-xs font-semibold text-brand-text-muted mt-0.5">
                        {t('settings.languageDesc')}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setLanguage('en')}
                      className={`px-3.5 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${language === 'en' ? 'bg-brand-navy-500 text-white shadow-sm' : 'bg-surface-subtle text-brand-text-secondary hover:bg-brand-navy-500/10'}`}
                    >
                      EN
                    </button>
                    <button
                      type="button"
                      onClick={() => setLanguage('ar')}
                      className={`px-3.5 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${language === 'ar' ? 'bg-brand-navy-500 text-white shadow-sm' : 'bg-surface-subtle text-brand-text-secondary hover:bg-brand-navy-500/10'}`}
                    >
                      AR
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* ── System Tab ── */}
          {activeTab === 'system' && isAdmin && (
            <Card>
              <div className="px-6 py-5 border-b border-brand-border">
                <h2 className="text-lg font-black text-brand-text-primary tracking-tight m-0">
                  {t('settings.systemAdmin')}
                </h2>
                <p className="text-xs font-semibold text-brand-text-muted mt-0.5">
                  {t('settings.systemAdminDesc')}
                </p>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between p-4 rounded-xl border border-brand-border bg-brand-bg-page/30 hover:bg-brand-bg-page/50 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-xl bg-brand-bg-card border border-brand-border flex items-center justify-center shadow-sm">
                      <Database size={18} className="text-brand-navy-500" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-brand-text-primary">
                        {t('settings.maintenanceMode')}
                      </p>
                      <p className="text-xs font-semibold text-brand-text-muted mt-0.5">
                        {t('settings.maintenanceDesc')}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant="info"
                    className="text-[10px] font-black uppercase tracking-widest"
                  >
                    {t('common.disabled')}
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-4 rounded-xl border border-brand-border bg-brand-bg-page/30 hover:bg-brand-bg-page/50 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-xl bg-brand-bg-card border border-brand-border flex items-center justify-center shadow-sm">
                      <Shield size={18} className="text-brand-green" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-brand-text-primary">
                        {t('settings.registrationLock')}
                      </p>
                      <p className="text-xs font-semibold text-brand-text-muted mt-0.5">
                        {t('settings.registrationDesc')}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant="success"
                    className="text-[10px] font-black uppercase tracking-widest"
                  >
                    {t('common.open')}
                  </Badge>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-[2rem] shadow-elevated border border-brand-border">
        {!videoError ? (
          <video
            className="w-full max-h-[480px] bg-black object-cover"
            autoPlay
            muted
            loop
            playsInline
            onError={() => setVideoError(true)}
            poster={CAMPUS_HERO_2}
          >
            <source src={UNIVERSITY_PROMO_VIDEO} type="video/mp4" />
            <track kind="captions" />
            <p className="p-4 text-sm text-brand-text-muted">
              {t('settings.videoUnsupported', 'Your browser does not support video playback.')}
            </p>
          </video>
        ) : (
          <div className="w-full aspect-video rounded-2xl bg-surface-subtle border border-brand-border flex flex-col items-center justify-center gap-3 text-brand-text-muted">
            <Video size={48} className="opacity-30" />
            <p className="text-sm font-bold">
              {t('settings.videoUnavailable') || 'Video currently unavailable'}
            </p>
          </div>
        )}
        <div className="bg-brand-navy-500 px-6 py-5">
          <h3 className="text-lg font-black text-white">{t('settings.universityPromoTitle')}</h3>
          <div className="mt-1 flex items-start gap-4">
            <p className="text-sm font-medium text-white/60 flex-1">
              {t('settings.universityPromoDesc')}
            </p>
            <img
              src={CAMPUS_HERO_2}
              alt=""
              className="h-12 w-20 rounded-lg object-cover opacity-50 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-500"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
