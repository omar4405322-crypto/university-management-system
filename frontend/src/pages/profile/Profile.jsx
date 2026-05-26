import React, { useState, useEffect } from 'react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Badge from '../../components/ui/Badge';
import { useAuth } from '../../context/AuthContext';
import { User, Mail, Shield, Bell, Camera, Globe, Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';

const Profile = () => {
  const { user, setUser } = useAuth();
  const { t, i18n } = useTranslation();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    address: '',
    bio: '',
    gender: '',
    birthDate: ''
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
        birthDate: (profile.birthDate || user.birthDate) ? (profile.birthDate || user.birthDate).split('T')[0] : ''
      });
    }
  }, [user]);

  const fetchFullProfile = async () => {
    try {
      const response = await api.get('/users/profile');
      if (response.data.success) {
        setFullProfile(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching full profile:', error);
    }
  };

  useEffect(() => {
    fetchFullProfile();
  }, []);

  const [fullProfile, setFullProfile] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
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
    } catch (error) {
      console.error('Update profile error:', error);
      setMessage({ type: 'error', text: t('profile.errorUpdate') });
    } finally {
      setLoading(false);
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
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data.success) {
        setUser({ ...user, profilePicture: response.data.data.profilePicture });
        setIsPicModalOpen(false);
        setSelectedFile(null);
        setPreviewUrl('');
        setMessage({ type: 'success', text: t('profile.successUpdatePic') });
      }
    } catch (error) {
      console.error('Update picture error:', error);
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

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('profile.title')}</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">{t('profile.subtitle')}</p>
      </div>

      {message.text && (
        <div className={`p-4 rounded-xl border ${message.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-900/30 dark:text-emerald-400' : 'bg-rose-50 border-rose-100 text-rose-700 dark:bg-rose-900/20 dark:border-rose-900/30 dark:text-rose-400'}`}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Left Column: Avatar & Summary */}
        <div className="space-y-6">
          <Card className="text-center relative overflow-visible">
            <div className="relative mx-auto h-32 w-32">
              <div className="flex h-full w-full items-center justify-center rounded-full bg-blue-600 text-4xl font-bold text-white ring-4 ring-blue-50 dark:ring-blue-900/20 overflow-hidden shadow-xl">
                {user?.profilePicture ? (
                  <img src={user.profilePicture} alt={t('profile.avatar')} className="h-full w-full object-cover" />
                ) : getInitials()}
              </div>
              <button 
                onClick={() => setIsPicModalOpen(true)}
                className="absolute bottom-0 right-0 rounded-full bg-white dark:bg-slate-800 p-2 shadow-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                title={t('profile.uploadPic')}
              >
                <Camera size={18} />
              </button>
            </div>
            <h2 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">{formData.firstName} {formData.lastName}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{user?.email}</p>
            
            {fullProfile && (
              <div className="mt-2 space-y-1">
                {(fullProfile.studentId || fullProfile.doctorId) && (
                  <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
                    {fullProfile.studentId || fullProfile.doctorId}
                  </p>
                )}
                {fullProfile.department && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {fullProfile.department.name} {fullProfile.department.college ? `• ${fullProfile.department.college.name}` : ''}
                  </p>
                )}
              </div>
            )}

            <div className="mt-4 flex justify-center">
              <Badge variant="info" className="capitalize px-3 py-1">
                {user?.role ? t(`auth.${user.role.toLowerCase()}`) : ''}
              </Badge>
            </div>
            <div className="mt-8 grid grid-cols-2 gap-4 border-t border-slate-100 dark:border-slate-700 pt-6">
              <div className="text-center">
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{t('profile.joined')}</p>
                <p className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-200">
                  {user?.createdAt ? new Date(user.createdAt).toLocaleDateString(i18n.language === 'ar' ? 'ar-EG' : 'en-US', { month: 'short', year: 'numeric' }) : 'Jan 2026'}
                </p>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{t('profile.status')}</p>
                <p className="mt-1 text-sm font-bold text-emerald-600 dark:text-emerald-400">{t('profile.active')}</p>
              </div>
            </div>
          </Card>

          <Card title={t('profile.securityScore')}>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600 dark:text-slate-400">{t('profile.profileCompletion')}</span>
                <span className="text-sm font-bold text-blue-600 dark:text-blue-400">{user?.profileCompletion || '85'}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-700">
                <div 
                  className="h-full rounded-full bg-blue-600 shadow-sm shadow-blue-500/50" 
                  style={{ width: `${user?.profileCompletion || 85}%` }}
                ></div>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-500">{t('profile.securityTip')}</p>
              <Button variant="outline" className="w-full text-xs py-2">{t('profile.improveSecurity')}</Button>
            </div>
          </Card>
        </div>

        {/* Right Column: Detailed Forms */}
        <div className="lg:col-span-2 space-y-6">
          <Card title={t('profile.personalInfo')} subtitle={t('profile.personalSubtitle')}>
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
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
                />
                <Input 
                  label={t('profile.phone')} 
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+1 (555) 000-0000" 
                />
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1.5">{t('profile.bio')}</label>
                  <textarea 
                    name="bio"
                    value={formData.bio}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    rows="4"
                    placeholder={t('profile.bioPlaceholder')}
                  ></textarea>
                </div>
              </div>
              <div className="mt-8 flex justify-end">
                <Button type="submit" loading={loading}>{t('profile.saveChanges')}</Button>
              </div>
            </form>
          </Card>

          {fullProfile && (user?.role === 'STUDENT' || user?.role === 'DOCTOR') && (
            <Card title={t('profile.academicInfo')} subtitle={t('profile.academicSubtitle')}>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {fullProfile.department?.college && (
                  <Input 
                    label={t('profile.college')} 
                    value={fullProfile.department.college.name} 
                    disabled 
                  />
                )}
                {fullProfile.department && (
                  <Input 
                    label={t('profile.department')} 
                    value={fullProfile.department.name} 
                    disabled 
                  />
                )}
                {user?.role === 'STUDENT' && (
                  <>
                    <Input 
                      label={t('profile.year')} 
                      value={`${t('dashboard.yearOfStudy')} ${fullProfile.year || 1}`} 
                      disabled 
                    />
                    <Input 
                      label={t('profile.studentId')} 
                      value={fullProfile.studentId || ''} 
                      disabled 
                    />
                  </>
                )}
                {user?.role === 'DOCTOR' && (
                  <Input 
                    label={t('profile.doctorId')} 
                    value={fullProfile.doctorId || ''} 
                    disabled 
                  />
                )}
              </div>
              <p className="mt-4 text-xs text-slate-500 italic">
                {t('profile.academicInfoNote')}
              </p>
            </Card>
          )}

          <Card title={t('profile.security')} subtitle={t('profile.securitySubtitle')}>
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-white dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 border border-slate-100 dark:border-slate-700 shadow-sm">
                    <Lock size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{t('profile.changePassword')}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-500">{t('profile.changePasswordSubtitle')}</p>
                  </div>
                </div>
                <Button variant="outline" className="text-xs px-4 py-2">{t('profile.update')}</Button>
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-white dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 border border-slate-100 dark:border-slate-700 shadow-sm">
                    <Shield size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{t('profile.twoFactor')}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-500">{t('profile.twoFactorSubtitle')}</p>
                  </div>
                </div>
                <Badge variant="warning" className="px-2 py-0.5">{t('profile.disabled')}</Badge>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Profile Picture Modal */}
      {isPicModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-2xl border border-slate-200 dark:border-slate-700">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">{t('profile.uploadPic')}</h3>
            <div className="space-y-4">
              <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-8 hover:border-blue-500 transition-colors cursor-pointer relative overflow-hidden group">
                {previewUrl ? (
                  <img src={previewUrl} alt="Preview" className="h-32 w-32 rounded-full object-cover shadow-md" />
                ) : (
                  <div className="h-32 w-32 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-slate-400 dark:text-slate-600">
                    <Camera size={40} />
                  </div>
                )}
                <p className="mt-4 text-sm text-slate-500 dark:text-slate-400 font-medium">
                  {selectedFile ? selectedFile.name : t('profile.selectImage')}
                </p>
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={handleFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-500 text-center">
                {t('profile.imageRequirements')}
              </p>
              <div className="flex justify-end gap-3 mt-6">
                <Button variant="outline" onClick={() => {
                  setIsPicModalOpen(false);
                  setSelectedFile(null);
                  setPreviewUrl('');
                }}>{t('common.cancel')}</Button>
                <Button onClick={handleUpdatePic} loading={loading} disabled={!selectedFile}>{t('common.save')}</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
