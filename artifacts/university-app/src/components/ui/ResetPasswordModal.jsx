import React, { useState } from 'react'; 
import { useTranslation } from 'react-i18next'; 
import { KeyRound, Eye, EyeOff, X } from 'lucide-react'; 
import Button from './Button'; 
import api from '../../services/api'; 
 
const ResetPasswordModal = ({ isOpen, onClose, person, type }) => { 
  const { t } = useTranslation(); 
  const [newPassword, setNewPassword] = useState(''); 
  const [showPassword, setShowPassword] = useState(false); 
  const [loading, setLoading] = useState(false); 
  const [error, setError] = useState(''); 
  const [success, setSuccess] = useState(''); 
 
  if (!isOpen || !person) return null; 
 
  const handleReset = async () => { 
    if (!newPassword || newPassword.length < 6) { 
      setError('Password must be at least 6 characters'); 
      return; 
    } 
    setLoading(true); 
    setError(''); 
    setSuccess(''); 
    try { 
      const endpoint = type === 'student' 
        ? `/students/${person.id}/reset-password` 
        : `/doctors/${person.id}/reset-password`; 
 
      const res = await api.patch(endpoint, { newPassword }); 
      setSuccess(res.data.message || 'Password reset successfully'); 
      setNewPassword(''); 
    } catch (err) { 
      setError(err.message || 'Failed to reset password'); 
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
 
  return ( 
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"> 
      <div className="bg-brand-bg-page border border-brand-border rounded-2xl shadow-elevated w-full max-w-md mx-4 p-6 space-y-5"> 
        
        <div className="flex items-center justify-between"> 
          <div className="flex items-center gap-3"> 
            <div className="p-2.5 rounded-xl bg-brand-primary-50 text-brand-primary-500"> 
              <KeyRound size={20} /> 
            </div> 
            <div> 
              <h3 className="text-base font-black text-brand-text-primary dark:text-brand-text-main"> 
                Reset Password 
              </h3> 
              <p className="text-xs text-brand-text-muted"> 
                {person.firstName} {person.lastName} 
              </p> 
            </div> 
          </div> 
          <button 
            onClick={handleClose} 
            className="p-2 rounded-xl hover:bg-surface-subtle transition-colors text-brand-text-muted" 
          > 
            <X size={18} /> 
          </button> 
        </div> 
 
        <div className="space-y-2"> 
          <label className="text-xs font-black uppercase tracking-wider text-brand-text-muted"> 
            New Password 
          </label> 
          <div className="relative"> 
            <input 
              type={showPassword ? 'text' : 'password'} 
              value={newPassword} 
              onChange={(e) => setNewPassword(e.target.value)} 
              placeholder="Enter new password..." 
              className="w-full px-4 py-3 pr-11 rounded-xl border border-brand-border bg-surface-subtle text-brand-text-primary dark:text-brand-text-main text-sm focus:outline-none focus:border-brand-primary-500 transition-colors" 
            /> 
            <button 
              type="button" 
              onClick={() => setShowPassword(!showPassword)} 
              className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-text-muted hover:text-brand-text-primary transition-colors" 
            > 
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />} 
            </button> 
          </div> 
          <p className="text-xs text-brand-text-muted">Minimum 6 characters</p> 
        </div> 
 
        {error && ( 
          <div className="px-4 py-3 rounded-xl bg-error/10 border border-error/20 text-sm text-error font-medium"> 
            {error} 
          </div> 
        )} 
 
        {success && ( 
          <div className="px-4 py-3 rounded-xl bg-brand-primary-50 border border-brand-primary-100 text-sm text-brand-primary-600 font-medium"> 
            ✓ {success} 
          </div> 
        )} 
 
        <div className="flex gap-3 pt-1"> 
          <Button 
            variant="ghost" 
            className="flex-1" 
            onClick={handleClose} 
          > 
            Cancel 
          </Button> 
          <Button 
            variant="primary" 
            className="flex-1" 
            onClick={handleReset} 
            disabled={loading || !newPassword} 
          > 
            {loading ? 'Resetting...' : 'Reset Password'} 
          </Button> 
        </div> 
 
      </div> 
    </div> 
  ); 
 }; 
 
 export default ResetPasswordModal; 
