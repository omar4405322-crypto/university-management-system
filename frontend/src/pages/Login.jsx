// FIXED: Login errors, no client lockout, session-expired hint, email normalize - login fix
import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { LogIn, Mail, Lock, AlertCircle, Loader2, Eye, EyeOff, ArrowRight, CheckCircle2 } from 'lucide-react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotForgotEmail] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [show2FA, setShow2FA] = useState(false);
  const [totpToken, setTotpToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;

    setForgotLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      setForgotSuccess(true);
    } catch (err) {
      console.error(err);
    } finally {
      setForgotLoading(false);
    }
  };

  const closeForgotModal = () => {
    setShowForgotModal(false);
    setForgotForgotEmail('');
    setForgotSuccess(false);
  };

  useEffect(() => {
    if (searchParams.get('expired') === 'true') {
      setError(t('auth.sessionExpired'));
    }
  }, [searchParams, t]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await login(email, password, show2FA ? totpToken : null);
      
      if (result.requires2FA) {
        setShow2FA(true);
        setLoading(false);
        return;
      }

      if (result.success) {
        navigate('/dashboard', { replace: true });
        return;
      }

      if (result.status === 429) {
        setError(t('auth.tooManyAttempts'));
      } else if (result.status === 401) {
        setError(result.message || t('auth.invalidCredentials'));
      } else {
        setError(result.message || t('common.errorOccurred'));
      }
    } catch (err) {
      if (err.status === 429) {
        setError(t('auth.tooManyAttempts'));
      } else if (err.status === 401) {
        setError(err.message || t('auth.invalidCredentials'));
      } else {
        setError(err.message || t('common.errorOccurred'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-white font-arabic overflow-hidden" dir="rtl">
      {/* Left Side: Visuals (Hidden on Mobile) */}
      <div className="hidden lg:flex lg:w-[60%] relative items-center justify-center overflow-hidden">
        {/* Background Image & Overlay */}
        <div className="absolute inset-0 z-0">
          <img 
            src="/assets/university/campus-hero-2.png" 
            alt="Campus" 
            className="w-full h-full object-cover" 
          />
          <div className="absolute inset-0 bg-brand-navy/70 backdrop-blur-[2px]" />
        </div>

        {/* Content Overlay */}
        <div className="relative z-10 text-center space-y-8 px-12 animate-in fade-in duration-700">
          <Link to="/" className="absolute top-12 right-12 flex items-center gap-2 text-white/70 hover:text-white font-bold text-sm transition-all group">
            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            العودة للرئيسية
          </Link>

          <img src="/assets/university/logo-white.svg" alt="University Logo" className="h-24 w-auto mx-auto drop-shadow-2xl" />
          
          <div className="space-y-4">
            <h1 className="text-5xl font-black text-white leading-tight tracking-tightest drop-shadow-lg">
              جامعة ٦ أكتوبر <br />
              <span className="text-brand-green">التكنولوجية</span>
            </h1>
            <p className="text-xl text-white/80 font-medium max-w-md mx-auto">
              بوابتك نحو مستقبل أكاديمي متميز
            </p>
          </div>

          <div className="flex flex-col gap-4 pt-8 max-w-xs mx-auto">
            {[
              'نظام إدارة أكاديمية متكامل',
              'واجهة سهلة وسريعة',
              'دعم كامل باللغة العربية'
            ].map((feature, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md">
                <CheckCircle2 size={18} className="text-brand-green shrink-0" />
                <span className="text-white text-sm font-bold">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Side: Form */}
      <div className="w-full lg:w-[40%] flex items-center justify-center p-6 md:p-12 relative bg-brand-bg-page transition-colors duration-300">
        <div className="w-full max-w-md space-y-10 animate-in fade-in slide-in-from-left-8 duration-700">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center">
            <img src="/assets/university/logo.svg" alt="" className="h-16 w-auto mx-auto mb-6" />
          </div>

          <div className="space-y-3 text-right">
            <h2 className="text-3xl font-black text-brand-text-primary dark:text-brand-text-main tracking-tight">
              مرحباً بعودتك 👋
            </h2>
            <p className="text-brand-text-secondary font-medium">
              أدخل بياناتك للدخول إلى حسابك
            </p>
          </div>

          <div className="bg-brand-bg-card rounded-[2rem] shadow-soft p-8 md:p-10 border border-brand-border/10">
            <form className="space-y-6" onSubmit={handleSubmit}>
              {error && (
                <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-sm font-medium flex items-center gap-3 animate-in fade-in zoom-in-95">
                  <AlertCircle size={20} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {!show2FA ? (
                <>
                  <div className="space-y-2 text-right">
                    <label className="text-xs font-black uppercase tracking-widest text-brand-text-muted mr-1">
                      {t('auth.emailAddress')}
                    </label>
                    <div className="relative group">
                      <Mail className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-text-muted group-focus-within:text-brand-green transition-colors" size={18} />
                      <input
                        type="email"
                        required
                        placeholder={t('auth.emailPlaceholder')}
                        className="w-full h-12 pr-12 pl-4 rounded-xl border border-brand-border bg-surface-subtle text-brand-text-primary dark:text-brand-text-main text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green transition-all"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2 text-right">
                    <div className="flex items-center justify-between mr-1">
                      <label className="text-xs font-black uppercase tracking-widest text-brand-text-muted">
                        {t('auth.password')}
                      </label>
                      <button 
                        type="button" 
                        onClick={() => setShowForgotModal(true)} 
                        className="text-[10px] font-black uppercase tracking-widest text-brand-green hover:text-brand-green-dark transition-colors" 
                      > 
                        {t('auth.forgotPassword')} 
                      </button>
                    </div>
                    <div className="relative group">
                      <Lock className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-text-muted group-focus-within:text-brand-green transition-colors" size={18} />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        placeholder={t('auth.passwordPlaceholder')}
                        className="w-full h-12 pr-12 pl-12 rounded-xl border border-brand-border bg-surface-subtle text-brand-text-primary dark:text-brand-text-main text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green transition-all"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <button 
                        type="button" 
                        onClick={() => setShowPassword(prev => !prev)} 
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-text-muted hover:text-brand-text-primary transition-colors" 
                      > 
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />} 
                      </button> 
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                  <div className="p-4 bg-brand-primary-50 dark:bg-brand-primary-900/10 rounded-2xl border border-brand-primary-100 dark:border-brand-primary-900/20 text-center">
                    <p className="text-sm font-bold text-brand-primary-600 dark:text-brand-primary-400">
                      Two-Factor Authentication Required
                    </p>
                    <p className="text-xs text-brand-text-secondary mt-1">
                      Enter the 6-digit code from your authenticator app
                    </p>
                  </div>
                  
                  <div className="space-y-2 text-right">
                    <label className="text-xs font-black uppercase tracking-widest text-brand-text-muted mr-1">
                      Verification Code
                    </label>
                    <div className="relative group">
                      <Lock className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-text-muted group-focus-within:text-brand-primary-500 transition-colors" size={18} />
                      <input
                        type="text"
                        required
                        autoFocus
                        placeholder="000000"
                        maxLength={6}
                        className="w-full h-12 pr-12 pl-4 rounded-xl border border-brand-border bg-surface-subtle text-brand-text-primary dark:text-brand-text-main text-sm text-center font-mono tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 focus:border-brand-primary-500 transition-all"
                        value={totpToken}
                        onChange={(e) => setTotpToken(e.target.value.replace(/\D/g, ''))}
                      />
                    </div>
                  </div>
                  
                  <button 
                    type="button"
                    onClick={() => setShow2FA(false)}
                    className="text-[10px] font-black uppercase tracking-widest text-brand-text-muted hover:text-brand-text-primary transition-colors"
                  >
                    ← Back to login
                  </button>
                </div>
              )}

              <Button 
                type="submit" 
                disabled={loading} 
                className="w-full h-14 bg-brand-green hover:bg-brand-green-dark text-white font-black rounded-2xl shadow-xl shadow-brand-green/20 transition-all active:scale-[0.98]"
              >
                {loading ? <Loader2 className="animate-spin" size={24} /> : (
                  <div className="flex items-center justify-center gap-3">
                    {show2FA ? <CheckCircle2 size={20} /> : <LogIn size={20} />}
                    {show2FA ? 'Verify Code' : t('auth.login')}
                  </div>
                )}
              </Button>
            </form>

            <div className="mt-8 text-center">
              <p className="text-sm text-brand-text-muted font-bold">
                {t('auth.noAccount')}{' '}
                <Link to="/register" className="text-brand-green hover:text-brand-green-dark transition-colors border-b-2 border-brand-green/20 pb-0.5">
                  {t('auth.registerHere')}
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>

      {showForgotModal && ( 
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"> 
          <div className="bg-brand-bg-card rounded-3xl border border-brand-border shadow-2xl p-8 max-w-sm w-full animate-in fade-in zoom-in-95 duration-200"> 
            <div className="w-14 h-14 rounded-2xl bg-brand-primary-50 dark:bg-brand-primary-900/20 flex items-center justify-center mx-auto mb-5"> 
              <Mail size={28} className="text-brand-primary-500" /> 
            </div> 
            <h3 className="text-xl font-black text-center text-brand-text-primary dark:text-brand-text-main mb-2"> 
              {t('auth.forgotPasswordTitle')} 
            </h3> 
            
            {forgotSuccess ? (
              <div className="space-y-6 text-center">
                <p className="text-sm text-brand-text-secondary leading-relaxed">
                  {t('auth.forgotPasswordSuccess') || 'تم إرسال طلبك للإدارة، سيتم التواصل معك قريباً'}
                </p>
                <Button 
                  type="button" 
                  onClick={closeForgotModal} 
                  variant="primary" 
                  className="w-full rounded-2xl" 
                > 
                  {t('auth.understood')} 
                </Button>
              </div>
            ) : (
              <form onSubmit={handleForgotSubmit} className="space-y-6">
                <p className="text-sm text-center text-brand-text-secondary leading-relaxed"> 
                  {t('auth.forgotPasswordInstructions')} 
                </p> 
                <div className="space-y-2">
                  <label className="text-xs font-bold text-brand-text-muted uppercase tracking-widest ml-1">
                    {t('auth.emailAddress')}
                  </label>
                  <Input 
                    type="email"
                    required
                    placeholder="example@university.edu"
                    value={forgotEmail}
                    onChange={(e) => setForgotForgotEmail(e.target.value)}
                    className="h-12"
                  />
                </div>
                <div className="flex gap-3">
                  <Button 
                    type="button" 
                    onClick={closeForgotModal} 
                    variant="ghost" 
                    className="flex-1 rounded-2xl" 
                  > 
                    {t('common.cancel')} 
                  </Button> 
                  <Button 
                    type="submit" 
                    disabled={forgotLoading || !forgotEmail.trim()}
                    variant="primary" 
                    className="flex-1 rounded-2xl" 
                  > 
                    {forgotLoading ? <Loader2 className="animate-spin" size={18} /> : t('auth.sendRequest') || 'إرسال طلب'}
                  </Button> 
                </div>
              </form>
            )}
          </div> 
        </div> 
      )} 
    </div>
  );
};

export default Login;
