// @ts-nocheck
// FIXED: 2FA warning banner, enable action for super admins, prompt query param - Phase 3
import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/button';
import Input from '../../components/ui/input';
import Badge from '../../components/ui/Badge';
import { useAuth } from '../../context/AuthContext';
import { Shield, Camera, Lock, X, Loader2, Building2, Award, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api, { getDynamicBaseUrl } from '../../services/api';
import Modal from '../../components/ui/Modal';
import { Textarea } from '../../components/ui/textarea';
import { logger } from '../../lib/logger';
import { FEATURE_FLAGS } from '../../constants/featureFlags';

const Profile = () => {
  const { user, setUser } = useAuth();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const show2faPrompt = searchParams.get('prompt') === 'enable-2fa';
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    address: '',
    bio: '',
    gender: '',
    birthDate: '',
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [isPicModalOpen, setIsPicModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');

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

  const [fullProfile, setFullProfile] = useState(null);

  useEffect(() => {
    const controller = new AbortController();

    const fetchFullProfile = async () => {
      try {
        const response = await api.get('/users/profile', { signal: controller.signal });
        if (response.data.success) {
          setFullProfile(response.data.data);
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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setMessage({ type: 'error', text: 'حجم الصورة يجب أن يكون أقل من 5MB' });
        return;
      }
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        setMessage({ type: 'error', text: 'يُسمح فقط بصيغ JPG, PNG, WEBP' });
        return;
      }
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      const response = await api.put('/users/profile', formData);
      if (response.data.success) {
        setUser({ ...user, ...response.data.data });
        setMessage({ type: 'success', text: t('profile.successUpdate') });
      }
    } catch (error: any) {
      logger.error('Update profile error:', error);
      setMessage({ type: 'error', text: t('profile.errorUpdate') });
    } finally {
      setLoading(false);
    }
  };

  const handleEnableTwoFactor = async () => {
    setTwoFactorLoading(true);
    try {
      const response = await api.patch('/users/profile/two-factor', { enabled: true });
      if (response.data.success) {
        const updated = { ...user, ...response.data.data, twoFactorEnabled: true };
        setUser(updated);
        localStorage.setItem('user', JSON.stringify(updated));
        setMessage({
          type: 'success',
          text: t('profile.twoFactorEnabled', 'Two-factor authentication enabled.'),
        });
        const returnTo = location.state?.from?.pathname || '/dashboard';
        setTimeout(() => navigate(returnTo, { replace: true }), 800);
      }
    } catch (error: any) {
      setMessage({
        type: 'error',
        text:
          error.message ||
          t('profile.twoFactorError', 'Could not enable two-factor authentication.'),
      });
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const handleUpdatePic = async () => {
    if (!selectedFile) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('profilePicture', selectedFile);

      const response = await api.put('/users/profile/picture', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.success) {
        setUser({ ...user, profilePicture: response.data.data.profilePicture });
        setIsPicModalOpen(false);
        setSelectedFile(null);
        setPreviewUrl('');
        setMessage({ type: 'success', text: t('profile.successUpdatePic') });
      }
    } catch (error: any) {
      logger.error('Update picture error:', error);
      setMessage({ type: 'error', text: t('profile.errorUpdatePic') });
    } finally {
      setLoading(false);
    }
  };

  const getInitials = () => {
    if (formData.firstName && formData.lastName) {
      return `${formData.firstName[0]}${formData.lastName[0]}`.toUpperCase();
    }
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    return user?.email?.substring(0, 2).toUpperCase() || '?';
  };

  const roleLabel = user?.role ? t(`auth.${user.role.toLowerCase()}`) : '';

  const getProfilePictureUrl = (path?: string) => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    const baseUrl = getDynamicBaseUrl().replace(/\/api$/, '') || 'http://localhost:5000';
    return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-brand-text-primary tracking-tight m-0">
            {t('profile.title')}
          </h1>
          <p className="text-brand-text-sub font-bold mt-1.5">{t('profile.subtitle')}</p>
        </div>
        <Badge variant="info" className="px-3 py-1.5 text-xs font-black uppercase tracking-widest">
          {roleLabel}
        </Badge>
      </div>

      {message.text && (
        <div
          className={`p-4 rounded-xl border ${message.type === 'success' ? 'bg-brand-green/10 border-brand-green text-brand-green' : 'bg-error/10 border-error/20 text-error'}`}
        >
          <div className="flex items-center gap-2.5">
            {message.type === 'success' ? (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <X size={18} />
            )}
            <span className="font-bold text-sm">{message.text}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar — Sticky Profile Card */}
        <div className="lg:col-span-1 lg:sticky lg:top-24 self-start space-y-6">
          <Card className="overflow-hidden">
            <div className="relative px-6 pt-8 pb-6 text-center">
              <div className="relative mx-auto h-28 w-28">
                <div className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-brand-primary-500 to-brand-primary-600 text-4xl font-black text-white ring-4 ring-brand-primary-100 shadow-xl overflow-hidden">
                  {user?.profilePicture ? (
                    <img
                      src={getProfilePictureUrl(user.profilePicture)}
                      alt={t('profile.avatar')}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    getInitials()
                  )}
                </div>
                <button
                  onClick={() => setIsPicModalOpen(true)}
                  className="absolute bottom-1 right-1 rounded-full bg-brand-bg-card dark:bg-slate-700 p-1.5 shadow-lg border border-brand-border text-brand-text-sub hover:text-brand-primary-600 transition-colors"
                  title={t('profile.uploadPic')}
                >
                  <Camera size={15} />
                </button>
              </div>
              <h2 className="mt-4 text-xl font-black text-brand-text-primary tracking-tight">
                {formData.firstName} {formData.lastName}
              </h2>
              <p className="text-sm font-semibold text-brand-text-muted">{user?.email}</p>

              {fullProfile && (
                <div className="mt-3 space-y-0.5">
                  {(fullProfile.studentId || fullProfile.doctorId) && (
                    <p className="text-xs font-bold text-brand-primary-600">
                      {fullProfile.studentId || fullProfile.doctorId}
                    </p>
                  )}
                  {fullProfile.department && (
                    <p className="text-xs font-bold text-brand-text-secondary">
                      {fullProfile.department.college
                        ? `${fullProfile.department.college.name}`
                        : fullProfile.department.name}
                    </p>
                  )}
                  {fullProfile.group && (
                    <p className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 inline-block px-2.5 py-1 rounded-lg mt-1 border border-amber-200 dark:border-amber-800">
                      {i18n.language === 'ar' ? 'المجموعة: ' : 'Group: '}
                      {fullProfile.group.parentGroup
                        ? `${fullProfile.group.parentGroup.name} (${fullProfile.group.name})`
                        : fullProfile.group.name}
                    </p>
                  )}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 divide-x divide-brand-border border-t border-brand-border">
              <div className="py-3.5 text-center">
                <p className="text-[10px] font-black text-brand-text-muted uppercase tracking-widest">
                  {t('profile.joined')}
                </p>
                <p className="mt-0.5 text-sm font-bold text-brand-text-primary">
                  {user?.createdAt
                    ? new Date((user as any).createdAt).toLocaleDateString(
                      i18n.language === 'ar' ? 'ar-EG' : 'en-US',
                      { month: 'short', year: 'numeric' }
                    )
                    : '—'}
                </p>
              </div>
              <div className="py-3.5 text-center">
                <p className="text-[10px] font-black text-brand-text-muted uppercase tracking-widest">
                  {t('profile.status')}
                </p>
                <p className="mt-0.5 text-sm font-bold text-brand-green">{t('profile.active')}</p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-black text-brand-text-muted uppercase tracking-widest">
                  {t('profile.profileCompletion')}
                </p>
                <span className="text-sm font-black text-brand-primary-600">
                  {user?.profileCompletion || 85}%
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-brand-bg-page overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand-primary-500 to-brand-primary-600 shadow-sm"
                  style={{ width: `${user?.profileCompletion || 85}%` }}
                ></div>
              </div>
              <p className="text-[10px] font-bold text-brand-text-muted">
                {t('profile.securityTip')}
              </p>
              <Button
                variant="outline"
                className="w-full text-xs py-2 font-black uppercase tracking-widest"
              >
                {t('profile.improveSecurity')}
              </Button>
            </div>
          </Card>

          {fullProfile && fullProfile.department && (
            <Card>
              <div className="space-y-4">
                <p className="text-xs font-black text-brand-text-muted uppercase tracking-widest flex items-center gap-2">
                  <Building2 size={14} className="text-brand-primary-600" /> {t('profile.college')}
                </p>
                <p className="text-sm font-bold text-brand-text-primary">
                  {fullProfile.department.college?.name || fullProfile.department.name}
                </p>
                {fullProfile.department.name && fullProfile.department.college && (
                  <p className="text-xs text-brand-text-muted font-semibold">
                    {fullProfile.department.name}
                  </p>
                )}
              </div>
            </Card>
          )}
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3 space-y-6">
          {/* Personal Information */}
          <Card>
            <div className="px-6 py-5 border-b border-brand-border">
              <h2 className="text-lg font-black text-brand-text-primary tracking-tight m-0">
                {t('profile.personalInfo')}
              </h2>
              <p className="text-xs font-semibold text-brand-text-muted mt-0.5">
                {t('profile.personalSubtitle')}
              </p>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <Input
                    label={t('profile.firstName')}
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                  />
                  <Input
                    label={t('profile.lastName')}
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                  />
                  <Input
                    label={t('profile.email')}
                    value={user?.email || ''}
                    type="email"
                    disabled
                    className="opacity-50"
                  />
                  <Input
                    label={t('profile.phone')}
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="+1 (555) 000-0000"
                  />
                  <div className="md:col-span-2">
                    <Textarea
                      name="bio"
                      value={formData.bio}
                      onChange={handleChange}

                      rows="4"
                      placeholder={t('profile.bioPlaceholder')}
                      label={<>{t('profile.bio')}</>}></Textarea>
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 bg-surface-subtle/50 border-t border-brand-border flex justify-end">
                <Button
                  type="submit"
                  loading={loading}
                  className="px-8 font-black uppercase tracking-widest text-xs"
                >
                  {t('profile.saveChanges')}
                </Button>
              </div>
            </form>
          </Card>

          {/* Academic Information */}
          {fullProfile && (user?.role === 'STUDENT' || user?.role === 'DOCTOR') && (
            <Card>
              <div className="px-6 py-5 border-b border-brand-border">
                <h2 className="text-lg font-black text-brand-text-primary tracking-tight m-0 flex items-center gap-2">
                  <Award size={20} className="text-brand-primary-600" /> {t('profile.academicInfo')}
                </h2>
                <p className="text-xs font-semibold text-brand-text-muted mt-0.5">
                  {t('profile.academicSubtitle')}
                </p>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {fullProfile.department?.college && (
                    <Input
                      label={t('profile.college')}
                      value={fullProfile.department.college.name}
                      disabled
                      className="opacity-50"
                    />
                  )}
                  {fullProfile.department && (
                    <Input
                      label={t('profile.department')}
                      value={fullProfile.department.name}
                      disabled
                      className="opacity-50"
                    />
                  )}
                  {user?.role === 'STUDENT' && (
                    <>
                      <Input
                        label={t('profile.year')}
                        value={`${t('dashboard.yearOfStudy')} ${fullProfile.year || 1}`}
                        disabled
                        className="opacity-50"
                      />
                      <Input
                        label={t('profile.studentId')}
                        value={fullProfile.studentId || ''}
                        disabled
                        className="opacity-50"
                      />
                      <Input
                        label={i18n.language === 'ar' ? 'المجموعة الأكاديمية' : 'Student Group'}
                        value={
                          fullProfile.group
                            ? fullProfile.group.parentGroup
                              ? `${i18n.language === 'ar' ? 'المجموعة' : 'Group'} ${fullProfile.group.parentGroup.name} (${fullProfile.group.name})`
                              : `${i18n.language === 'ar' ? 'المجموعة' : 'Group'} ${fullProfile.group.name}`
                            : (i18n.language === 'ar' ? 'غير محدد' : 'Not Assigned')
                        }
                        disabled
                        className="opacity-50 font-bold"
                      />
                    </>
                  )}
                  {user?.role === 'DOCTOR' && (
                    <Input
                      label={t('profile.doctorId')}
                      value={fullProfile.doctorId || ''}
                      disabled
                      className="opacity-50"
                    />
                  )}
                </div>
                <p className="mt-4 text-[10px] font-bold text-brand-text-muted italic">
                  {t('profile.academicInfoNote')}
                </p>
              </div>
            </Card>
          )}

          {/* Security */}
          <Card>
            <div className="px-6 py-5 border-b border-brand-border">
              <h2 className="text-lg font-black text-brand-text-primary tracking-tight m-0 flex items-center gap-2">
                <Shield size={20} className="text-brand-primary-600" /> {t('profile.security')}
              </h2>
              <p className="text-xs font-semibold text-brand-text-muted mt-0.5">
                {t('profile.securitySubtitle')}
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between p-4 rounded-xl border border-brand-border bg-brand-bg-page/30 hover:bg-brand-bg-page/50 transition-all">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-xl bg-brand-bg-card border border-brand-border flex items-center justify-center text-brand-text-sub shadow-sm">
                    <Lock size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-brand-text-primary">
                      {t('profile.changePassword')}
                    </p>
                    <p className="text-xs font-semibold text-brand-text-muted mt-0.5">
                      {t('profile.changePasswordSubtitle')}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="text-xs px-4 py-2 font-black uppercase tracking-widest"
                >
                  {t('profile.update')}
                </Button>
              </div>
              {FEATURE_FLAGS.REQUIRE_2FA && (show2faPrompt || (user?.role === 'SUPER_ADMIN' && !user?.twoFactorEnabled)) && (
                <div className="p-4 rounded-xl border-2 border-brand-accent-yellow bg-brand-accent-yellow/10 flex gap-3">
                  <AlertTriangle className="text-brand-accent-yellow shrink-0" size={22} />
                  <div>
                    <p className="text-sm font-black text-brand-text-primary">
                      {t('profile.twoFactorRequired', 'Two-factor authentication required')}
                    </p>
                    <p className="text-xs font-bold text-brand-text-muted mt-1">
                      {t(
                        'profile.twoFactorRequiredDesc',
                        'Super administrators must enable 2FA to access management features.'
                      )}
                    </p>
                  </div>
                </div>
              )}
              <div
                className={`flex items-center justify-between p-4 rounded-xl border transition-all ${user?.twoFactorEnabled
                    ? 'border-brand-green/30 bg-brand-green/5'
                    : 'border-brand-accent-yellow bg-brand-accent-yellow/10'
                  }`}
              >
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-xl bg-brand-bg-card border border-brand-border flex items-center justify-center text-brand-text-sub shadow-sm">
                    <Shield size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-brand-text-primary">
                      {t('profile.twoFactor')}
                    </p>
                    <p className="text-xs font-semibold text-brand-text-muted mt-0.5">
                      {t('profile.twoFactorSubtitle')}
                    </p>
                  </div>
                </div>
                {user?.twoFactorEnabled ? (
                  <Badge
                    variant="success"
                    className="text-[10px] px-3 py-1 font-black uppercase tracking-widest"
                  >
                    {t('profile.enabled', 'Enabled')}
                  </Badge>
                ) : (
                  <Button
                    variant="outline"
                    className="text-xs font-black uppercase tracking-widest border-brand-accent-yellow text-brand-accent-yellow"
                    onClick={handleEnableTwoFactor}
                    disabled={twoFactorLoading}
                  >
                    {twoFactorLoading ? (
                      <Loader2 className="animate-spin" size={16} />
                    ) : (
                      t('profile.enable2fa', 'Enable 2FA')
                    )}
                  </Button>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>

      <Modal
        isOpen={isPicModalOpen}
        onClose={() => setIsPicModalOpen(false)}
        title={t('profile.uploadPic')}
      >
        <div className="space-y-4">
          <div className="flex flex-col items-center justify-center border-2 border-dashed border-brand-border rounded-2xl p-8 bg-brand-bg-page/30 transition-all hover:bg-brand-bg-page/50">
            {previewUrl ? (
              <div className="relative h-40 w-40">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="h-full w-full rounded-full object-cover ring-4 ring-brand-primary-100 shadow-xl"
                />
                <button
                  onClick={() => {
                    setSelectedFile(null);
                    setPreviewUrl('');
                  }}
                  className="absolute -top-2 -right-2 p-1.5 bg-error text-white rounded-full shadow-lg hover:bg-error/80 transition-all"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <>
                <div className="h-20 w-20 rounded-full bg-brand-primary-50 flex items-center justify-center text-brand-primary-600 mb-4">
                  <Camera size={40} />
                </div>
                <p className="text-sm font-bold text-brand-text-primary mb-1">
                  {t('profile.dropPic')}
                </p>
                <p className="text-xs font-semibold text-brand-text-muted mb-4">
                  PNG, JPG or WebP (max. 5MB)
                </p>
                <label className="cursor-pointer">
                  <span className="bg-brand-primary-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-brand-primary-600 transition-all inline-block shadow-lg shadow-brand-primary-600/20">
                    {t('profile.browseFiles')}
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

          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="ghost"
              onClick={() => setIsPicModalOpen(false)}
              className="text-xs font-black uppercase tracking-widest"
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleUpdatePic}
              disabled={!selectedFile || loading}
              className="font-black uppercase tracking-widest text-xs"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : t('profile.savePic')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Profile;
