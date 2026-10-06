import React, { useState } from 'react';
import { KeyRound, Eye, EyeOff, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Button from './button';
import api from '../../services/api';

export interface ResetPasswordPerson {
  id: number | string;
  firstName?: string;
  lastName?: string;
  name?: string;
}

export interface ResetPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  person?: ResetPasswordPerson | null;
  type: 'student' | 'doctor' | 'admin' | 'teaching-assistant';
}

const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({
  isOpen,
  onClose,
  person,
  type,
}) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language?.startsWith('ar');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (!isOpen || !person) return null;

  const handleReset = async () => {
    if (!newPassword || newPassword.length < 6) {
      setError(t('profile.passwordMinLength', isRTL ? 'يجب أن تكون كلمة المرور 6 أحرف على الأقل' : 'Password must be at least 6 characters'));
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const endpoint =
        type === 'student'
          ? `/students/${person.id}/reset-password`
          : type === 'doctor'
          ? `/doctors/${person.id}/reset-password`
          : type === 'teaching-assistant'
          ? `/teaching-assistants/${person.id}/reset-password`
          : `/users/${person.id}/reset-password`;

      const res = await api.patch(endpoint, { newPassword });
      setSuccess(res.data.message || t('admins.resetPasswordSuccess', isRTL ? 'تمت إعادة تعيين كلمة المرور بنجاح' : 'Password reset successfully'));
      setNewPassword('');
    } catch (err: any) {
      setError(err.message || t('admins.resetPasswordError', isRTL ? 'فشلت إعادة تعيين كلمة المرور' : 'Failed to reset password'));
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setNewPassword('');
    setError('');
    setSuccess('');
    onClose();
  };

  const displayName = person.name || `${person.firstName || ''} ${person.lastName || ''}`.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-brand-bg-page border border-brand-border rounded-2xl shadow-elevated w-full max-w-md mx-4 p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-brand-primary-50 text-brand-primary-600 dark:bg-brand-primary-950/40">
              <KeyRound size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-brand-text-primary dark:text-brand-text-main">
                {t('admins.resetPasswordTitle', isRTL ? 'إعادة تعيين كلمة المرور' : 'Reset Password')}
              </h3>
              <p className="text-xs text-brand-text-muted">
                <bdi>{displayName}</bdi>
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            aria-label={t('common.close', isRTL ? 'إغلاق' : 'Close')}
            className="p-2 rounded-xl hover:bg-surface-subtle transition-colors text-brand-text-muted cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="input-reset-pwd"
            className="text-xs font-black uppercase tracking-wider text-brand-text-muted"
          >
            {t('admins.newPassword', isRTL ? 'كلمة المرور الجديدة' : 'New Password')}
          </label>
          <div className="relative">
            <input
              id="input-reset-pwd"
              type={showPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={t('admins.enterNewPassword', isRTL ? 'أدخل كلمة المرور الجديدة...' : 'Enter new password...')}
              className="w-full ps-4 pe-11 py-3 rounded-xl border border-brand-border bg-surface-subtle text-brand-text-primary dark:text-brand-text-main text-sm focus:outline-none focus:border-brand-primary-600 transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? (isRTL ? 'إخفاء كلمة المرور' : 'Hide password') : (isRTL ? 'إظهار كلمة المرور' : 'Show password')}
              className="absolute end-3 top-1/2 -translate-y-1/2 text-brand-text-muted hover:text-brand-text-primary transition-colors cursor-pointer"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <p className="text-xs text-brand-text-muted">
            {t('admins.min6Chars', isRTL ? 'يجب ألا تقل عن 6 أحرف' : 'Minimum 6 characters')}
          </p>
        </div>

        {error && (
          <div className="px-4 py-3 rounded-xl bg-error/10 border border-error/20 text-sm text-error-text font-medium">
            {error}
          </div>
        )}

        {success && (
          <div className="px-4 py-3 rounded-xl bg-brand-primary-50 border border-brand-primary-100 text-sm text-brand-primary-600 font-medium">
            {success}
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <Button variant="ghost" className="flex-1" onClick={handleClose}>
            {t('common.cancel', isRTL ? 'إلغاء' : 'Cancel')}
          </Button>
          <Button
            variant="primary"
            className="flex-1"
            onClick={handleReset}
            disabled={loading || !newPassword}
          >
            {loading ? t('admins.resettingPassword', isRTL ? 'جاري إعادة التعيين...' : 'Resetting...') : t('admins.resetPasswordTitle', isRTL ? 'إعادة تعيين كلمة المرور' : 'Reset Password')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordModal;
