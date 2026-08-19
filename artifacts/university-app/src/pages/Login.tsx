// FIXED: Login errors, no client lockout, session-expired hint, email normalize - login fix
// CONVERTED: useState form fields → React Hook Form + Zod
import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../context/LanguageContext';
import {
  LogIn,
  Mail,
  Lock,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
} from 'lucide-react';
import Button from '../components/ui/button';
import Input from '../components/ui/input';

// ── Zod schema ──────────────────────────────────────────────────────────────
const getLoginSchema = (t: any) => z.object({
  email: z.string().min(1, { message: t('validation.emailRequired') }).email({ message: t('validation.emailInvalid') }),
  password: z.string().min(1, { message: t('validation.passwordRequired') }).min(8, { message: t('validation.passwordMin') }),
  totpToken: z.string().optional(),
});

type LoginFormData = z.infer<ReturnType<typeof getLoginSchema>>;

// ── Component ────────────────────────────────────────────────────────────────
const Login = () => {
  // UI-only state (not form field state)
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [show2FA, setShow2FA] = useState(false);
  // API-level errors (not field-level validation)
  const [apiError, setApiError] = useState('');

  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const navigate = useNavigate();

  // ── React Hook Form setup ──────────────────────────────────────────────────
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(getLoginSchema(t)),
    defaultValues: { email: '', password: '', totpToken: '' },
  });

  // Surface session-expiry message from URL param
  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam === 'session_expired') {
      setApiError(t('auth.sessionExpiredNotice') || 'انتهت جلستك، يرجى تسجيل الدخول مرة أخرى');
    }
  }, [searchParams, t]);

  // ── Forgot password (simulated) ─────────────────
  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;
    setForgotLoading(true);
    try {
      await new Promise<void>((resolve) => setTimeout(resolve, 1000));
      setForgotSuccess(true);
    } catch (err) {
      console.error(err);
    } finally {
      setForgotLoading(false);
    }
  };

  const closeForgotModal = () => {
    setShowForgotModal(false);
    setForgotEmail('');
    setForgotSuccess(false);
  };

  // ── Login submit ──────────────────────────────────────────────────────────
  const onSubmit = async (data: LoginFormData) => {
    setApiError('');

    try {
      const result = await login(
        data.email.trim().toLowerCase(),
        data.password,
        show2FA ? (data.totpToken ?? null) : null,
      );

      if (result.requires2FA) {
        setShow2FA(true);
        return;
      }

      if (result.success) {
        navigate('/dashboard', { replace: true });
        return;
      }

      if (result.status === 429) {
        setApiError(t('auth.tooManyAttempts'));
      } else if (result.status === 401) {
        setApiError(result.message || t('auth.invalidCredentials'));
      } else {
        setApiError(result.message || t('common.errorOccurred'));
      }
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      if (e.status === 429) {
        setApiError(t('auth.tooManyAttempts'));
      } else if (e.status === 401) {
        setApiError(e.message || t('auth.invalidCredentials'));
      } else {
        setApiError(e.message || t('common.errorOccurred'));
      }
    }
  };

  return (
    <div 
      className="min-h-screen w-full relative overflow-hidden font-arabic select-none" 
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <style>{`
        @media (max-height: 820px) {
          .branding-overlay-block {
            display: none !important;
          }
        }
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translate(-50%, calc(-50% + 20px));
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%);
          }
        }
        .card-entrance {
          animation: fadeInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .login-input {
          transition: all 0.2s ease !important;
        }
        .login-input::placeholder {
          opacity: 0.5 !important;
        }
        .login-input:focus {
          border-color: #84cc16 !important;
          box-shadow: 0 0 0 3px rgba(132,204,22,0.15) !important;
        }
        .login-btn {
          background: linear-gradient(135deg, #65a30d, #84cc16) !important;
          transition: all 0.2s ease !important;
        }
        .login-btn:hover:not(:disabled) {
          transform: scale(1.01);
          background: linear-gradient(135deg, #4d7c0f, #65a30d) !important;
        }
        .login-btn:active:not(:disabled) {
          transform: scale(0.99);
        }
      `}</style>

      <div 
        className="absolute inset-0 z-0"
        style={{
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f2027 100%)",
        }}
      />
      
      <div 
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage: `
            repeating-linear-gradient(0deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 24px),
            repeating-linear-gradient(90deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 24px)
          `,
        }}
      />

      <Link
        to="/"
        className="fixed top-5 end-6 z-20 flex items-center gap-2 text-white/85 hover:text-white font-bold text-sm transition-all duration-200 hover:underline group"
      >
        <span>{isRTL ? 'العودة للرئيسية' : 'Back to Home'}</span>
        {isRTL ? (
          <ArrowLeft size={18} strokeWidth={2} className="group-hover:-translate-x-1 transition-transform" />
        ) : (
          <ArrowRight size={18} strokeWidth={2} className="group-hover:translate-x-1 transition-transform" />
        )}
      </Link>

      <div className="absolute top-1/2 left-1/2 z-10 w-full max-w-[420px] px-4 sm:px-0 card-entrance">
        <div 
          className="rounded-[16px] shadow-[0_25px_50px_rgba(0,0,0,0.4)] transition-all duration-300 w-full bg-white"
          style={{
            padding: '48px 40px',
            borderTop: '3px solid #84cc16',
          }}
        >
          <div className="text-center flex flex-col items-center justify-center">
            <h1 className="text-[18px] font-bold text-slate-800 leading-tight">
              {isRTL ? 'جامعة 6 أكتوبر التكنولوجية' : '6th of October University of Technology'}
            </h1>
            <div className="w-10 h-[3px] bg-[#84cc16] rounded-full mx-auto mt-2.5 mb-2.5" />
            <p className="text-[12px] text-gray-400 font-semibold">
              {isRTL ? 'نظام الإدارة الأكاديمية' : 'Academic Management System'}
            </p>
            <h2 className="text-[26px] font-black text-slate-900 tracking-tight leading-tight mt-5">
              {isRTL ? 'تسجيل الدخول' : 'Sign In'}
            </h2>
          </div>

          <div className="w-full mt-6 space-y-6">
            {apiError && (
              <div className="p-4 bg-red-50 border-s-4 border-s-[var(--error)] rounded-e-xl text-red-700 text-sm font-medium flex items-center gap-3 animate-in fade-in zoom-in-95">
                <AlertCircle size={20} strokeWidth={2} className="shrink-0 text-red-500" />
                <span>{apiError}</span>
              </div>
            )}

            <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
              {!show2FA ? (
                <>
                  <div className="space-y-2 text-start">
                    <label className="text-xs font-black uppercase tracking-widest text-brand-text-muted ms-1">
                      {t('auth.emailAddress')}
                    </label>
                    <div className="relative group">
                      <Mail
                        className="absolute start-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#84cc16] transition-colors"
                        size={18}
                        strokeWidth={2}
                      />
                      <input
                        {...register('email')}
                        type="email"
                        placeholder={t('auth.emailPlaceholder')}
                        autoComplete="email"
                        className={`login-input w-full h-[52px] ps-12 pe-4 rounded-[10px] border-[1.5px] bg-white text-brand-navy placeholder:text-brand-text-muted text-[15px] focus:outline-none transition-all duration-200 ${
                          errors.email
                            ? 'border-rose-500'
                            : 'border-[var(--brand-border)]'
                        }`}
                      />
                    </div>
                    {errors.email && (
                      <p className="text-rose-500 text-xs mt-1 ms-1">{errors.email.message}</p>
                    )}
                  </div>

                  <div className="space-y-2 text-start">
                    <div className="flex items-center justify-between mx-1">
                      <label className="text-xs font-black uppercase tracking-widest text-brand-text-muted">
                        {t('auth.password')}
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowForgotModal(true)}
                        className="text-xs font-bold text-[#84cc16] hover:text-[#65a30d] transition-colors cursor-pointer"
                      >
                        {isRTL ? 'نسيت كلمة المرور؟' : 'Forgot password?'}
                      </button>
                    </div>
                    <div className="relative group">
                      <Lock
                        className="absolute start-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#84cc16] transition-colors"
                        size={18}
                        strokeWidth={2}
                      />
                      <input
                        {...register('password')}
                        type={showPassword ? 'text' : 'password'}
                        placeholder={t('auth.passwordPlaceholder')}
                        autoComplete="current-password"
                        className={`login-input w-full h-[52px] ps-12 pe-12 rounded-[10px] border-[1.5px] bg-white text-brand-navy placeholder:text-brand-text-muted text-[15px] focus:outline-none transition-all duration-200 ${
                          errors.password
                            ? 'border-rose-500'
                            : 'border-[var(--brand-border)]'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute end-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                        aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                      >
                        {showPassword ? <EyeOff size={18} strokeWidth={2} /> : <Eye size={18} strokeWidth={2} />}
                      </button>
                    </div>
                    {errors.password && (
                      <p className="text-rose-500 text-xs mt-1 ms-1">{errors.password.message}</p>
                    )}
                  </div>
                </>
              ) : (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                  <div className="p-4 bg-brand-primary-50 rounded-2xl border border-brand-primary-100 text-center">
                    <p className="text-sm font-bold text-brand-primary-600">
                      Two-Factor Authentication
                    </p>
                    <p className="text-xs text-brand-text-secondary mt-1">
                      Enter the 6-digit code
                    </p>
                  </div>

                  <div className="space-y-2 text-start">
                    <label className="text-xs font-black uppercase tracking-widest text-brand-text-muted ms-1">
                      Code
                    </label>
                    <div className="relative group">
                      <Lock
                        className="absolute start-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#84cc16] transition-colors"
                        size={18}
                        strokeWidth={2}
                      />
                      <input
                        {...register('totpToken')}
                        type="text"
                        autoFocus
                        placeholder="000000"
                        maxLength={6}
                        className={`login-input w-full h-[52px] ps-12 pe-4 rounded-[10px] border-[1.5px] bg-white text-brand-navy placeholder:text-brand-text-muted text-sm text-center font-mono tracking-[0.5em] focus:outline-none transition-all ${
                          errors.totpToken
                            ? 'border-rose-500'
                            : 'border-[var(--brand-border)]'
                        }`}
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShow2FA(false)}
                    className="text-[10px] font-black uppercase tracking-widest text-brand-text-muted hover:text-brand-text-primary transition-colors"
                  >
                    {isRTL ? '← العودة لتسجيل الدخول' : '← Back to login'}
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="login-btn w-full h-[52px] text-white font-bold rounded-[10px] shadow-lg transition-all flex items-center justify-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
              >
                {isSubmitting ? (
                  <Loader2 className="animate-spin" size={24} strokeWidth={2} />
                ) : (
                  <span>{show2FA ? (isRTL ? 'التحقق' : 'Verify') : t('auth.login')}</span>
                )}
              </button>
            </form>

            <div className="text-center pt-2">
              <p className="text-sm text-gray-500 font-medium">
                {t('auth.noAccount')}{' '}
                <Link
                  to="/register"
                  className="text-[#84cc16] font-bold hover:underline transition-colors"
                >
                  {t('auth.registerHere')}
                </Link>
              </p>
            </div>

            <div className="text-[11px] text-gray-400 text-center mt-8">
              © 2024 جامعة 6 أكتوبر التكنولوجية
            </div>
          </div>
        </div>
      </div>

      <div className="branding-overlay-block absolute bottom-8 start-8 z-10 hidden md:flex flex-col gap-4 text-start items-start animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="flex items-center gap-3">
          <h2 className="text-[22px] font-bold text-white tracking-tight leading-tight m-0">
            {isRTL ? 'جامعة 6 أكتوبر التكنولوجية' : '6th of October University of Technology'}
          </h2>
          <span className="relative flex h-3 w-3 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
          </span>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {[
            isRTL ? 'نظام إدارة أكاديمية متكامل' : 'Integrated Academic Management',
            isRTL ? 'واجهة سهلة وسريعة' : 'Fast & Intuitive Interface',
            isRTL ? 'دعم كامل باللغة العربية' : 'Full Multilingual Support'
          ].map((feature, i) => (
            <div
              key={i}
              className="flex items-center gap-2 border border-white/15 rounded-[50px] backdrop-blur-[8px] text-white text-[13px] font-semibold"
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                padding: '8px 18px',
              }}
            >
              <CheckCircle2 size={15} strokeWidth={2} className="text-brand-green shrink-0" />
              <span>{feature}</span>
            </div>
          ))}
        </div>
      </div>

      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full animate-in fade-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-2xl bg-brand-primary-50 flex items-center justify-center mx-auto mb-5">
              <Mail size={28} strokeWidth={2} className="text-brand-primary-500" />
            </div>
            <h3 className="text-xl font-black text-center text-slate-800 mb-2">
              {isRTL ? 'استعادة كلمة المرور' : 'Forgot Password'}
            </h3>

            {forgotSuccess ? (
              <div className="space-y-6 text-center">
                <p className="text-sm text-gray-500 leading-relaxed">
                  {isRTL ? 'تم إرسال طلبك للإدارة' : 'Your request has been submitted.'}
                </p>
                <Button type="button" onClick={closeForgotModal} className="w-full rounded-2xl">
                  {isRTL ? 'حسناً' : 'Understood'}
                </Button>
              </div>
            ) : (
              <form onSubmit={handleForgotSubmit} className="space-y-6">
                <p className="text-sm text-center text-gray-500 leading-relaxed">
                  {isRTL ? 'أدخل بريدك الإلكتروني' : 'Enter your registered email'}
                </p>
                <div className="space-y-2 text-start">
                  <label className="text-xs font-bold text-gray-400 uppercase ms-1">Email</label>
                  <Input
                    type="email"
                    required
                    placeholder="example@university.edu"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="h-12"
                  />
                </div>
                <div className="flex gap-3">
                  <Button type="button" onClick={closeForgotModal} variant="ghost" className="flex-1 rounded-2xl">
                    {t('common.cancel') || (isRTL ? 'إلغاء' : 'Cancel')}
                  </Button>
                  <Button
                    type="submit"
                    disabled={forgotLoading || !forgotEmail.trim()}
                    variant="default"
                    className="flex-1 rounded-2xl"
                  >
                    {forgotLoading ? (
                      <Loader2 className="animate-spin" size={18} strokeWidth={2} />
                    ) : (
                      t('auth.sendRequest') || (isRTL ? 'إرسال طلب' : 'Send Request')
                    )}
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
