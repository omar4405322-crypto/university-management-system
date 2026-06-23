// FIXED: Login errors, no client lockout, session-expired hint, email normalize - login fix
// CONVERTED: useState form fields → React Hook Form + Zod
import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
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
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

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
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const navigate = useNavigate();

  // ── React Hook Form setup ──────────────────────────────────────────────────
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
  } = useForm<LoginFormData>({
    resolver: zodResolver(getLoginSchema(t)),
    defaultValues: { email: '', password: '', totpToken: '' },
  });

  const emailValue = watch('email');
  const passwordValue = watch('password');

  // Surface session-expiry message from URL param
  useEffect(() => {
    if (searchParams.get('expired') === 'true') {
      setApiError(t('auth.sessionExpired'));
    }
  }, [searchParams, t]);

  // ── Forgot password (no backend endpoint yet — simulated) ─────────────────
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
      className="min-h-screen w-full relative overflow-hidden font-arabic bg-cover bg-center select-none" 
      style={{
        backgroundImage: "url('/assets/university/campus-entrance.png')",
      }}
      dir="rtl"
    >
      <style>{`
        @media (max-height: 820px) {
          .branding-overlay-block {
            display: none !important;
          }
        }
      `}</style>
      {/* Dark Navy Gradient Overlay & CSS Dot Grid Pattern */}
      <div 
        className="absolute inset-0 z-0"
        style={{
          background: "linear-gradient(135deg, var(--brand-navy-dark) 0%, var(--brand-navy) 100%)",
        }}
      />
      
      <div 
        className="absolute inset-0 z-0 opacity-40 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 0)",
          backgroundSize: "24px 24px",
        }}
      />

      {/* Floating Link Back to Home (outside the card) */}
      <Link
        to="/"
        className="fixed top-5 right-6 z-20 flex items-center gap-2 text-white/80 hover:text-white font-bold text-sm transition-all group"
      >
        <span>العودة للرئيسية</span>
        <ArrowRight size={18} strokeWidth={2} className="group-hover:translate-x-1 transition-transform" />
      </Link>

      {/* Centered Login Card */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-full max-w-[440px] px-4 sm:px-0">
        <div 
          className="rounded-[24px] shadow-[0_32px_80px_rgba(0,0,0,0.35)] transition-all duration-300 w-full bg-[var(--brand-bg-card)]"
          style={{
            padding: '48px 40px',
          }}
        >
          {/* Top Center University Logo */}
          <div className="text-center flex flex-col items-center justify-center">
            <img 
              src="/assets/university/logo.svg" 
              alt="شعار الجامعة" 
              className="w-16 h-auto mx-auto" 
            />
            <h2 className="text-[28px] font-bold text-[var(--brand-text-main)] tracking-tight leading-tight text-center mt-4">
              تسجيل الدخول
            </h2>
            <div className="w-10 h-[3px] bg-brand-green rounded-full mx-auto mt-2 mb-4" />
            <p className="text-[13px] text-gray-500 font-medium text-center">
              بوابة جامعة 6 أكتوبر التكنولوجية
            </p>
          </div>

          <div className="w-full mt-6 space-y-6">
            {/* API-level error banner */}
            {apiError && (
              <div className="p-4 bg-red-50 border-l-4 border-l-[var(--error)] rounded-r-xl text-red-700 text-sm font-medium flex items-center gap-3 animate-in fade-in zoom-in-95">
                <AlertCircle size={20} strokeWidth={2} className="shrink-0 text-red-500" />
                <span>{apiError}</span>
              </div>
            )}

            <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
              {!show2FA ? (
                <>
                  {/* ── Email ── */}
                  <div className="space-y-2 text-right">
                    <label className="text-xs font-black uppercase tracking-widest text-brand-text-muted mr-1">
                      {t('auth.emailAddress')}
                    </label>
                    <div className="relative group">
                      <Mail
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-brand-green transition-colors"
                        size={18}
                        strokeWidth={2}
                      />
                      <input
                        {...register('email')}
                        type="email"
                        placeholder={t('auth.emailPlaceholder')}
                        autoComplete="email"
                        className={`w-full h-[52px] pr-12 pl-4 rounded-[10px] border-[1.5px] bg-white text-brand-navy placeholder:text-brand-text-muted text-[15px] focus:outline-none focus:ring-[3px] transition-all duration-200 ${
                          errors.email
                            ? 'border-rose-500 focus:ring-rose-500/15 focus:border-rose-500'
                            : 'border-[var(--brand-border)] focus:ring-[var(--brand-green)]/15 focus:border-brand-green'
                        }`}
                      />
                    </div>
                    {errors.email && (
                      <p className="text-rose-500 text-xs mt-1 mr-1">{errors.email.message}</p>
                    )}
                  </div>

                  {/* ── Password ── */}
                  <div className="space-y-2 text-right">
                    <div className="flex items-center justify-between mr-1">
                      <label className="text-xs font-black uppercase tracking-widest text-brand-text-muted">
                        {t('auth.password')}
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowForgotModal(true)}
                        className="text-xs font-bold text-brand-green hover:text-brand-green-dark transition-colors"
                      >
                        نسيت كلمة المرور؟
                      </button>
                    </div>
                    <div className="relative group">
                      <Lock
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-brand-green transition-colors"
                        size={18}
                        strokeWidth={2}
                      />
                      <input
                        {...register('password')}
                        type={showPassword ? 'text' : 'password'}
                        placeholder={t('auth.passwordPlaceholder')}
                        autoComplete="current-password"
                        className={`w-full h-[52px] pr-12 pl-12 rounded-[10px] border-[1.5px] bg-white text-brand-navy placeholder:text-brand-text-muted text-[15px] focus:outline-none focus:ring-[3px] transition-all duration-200 ${
                          errors.password
                            ? 'border-rose-500 focus:ring-rose-500/15 focus:border-rose-500'
                            : 'border-[var(--brand-border)] focus:ring-[var(--brand-green)]/15 focus:border-brand-green'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                        aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                      >
                        {showPassword ? <EyeOff size={18} strokeWidth={2} /> : <Eye size={18} strokeWidth={2} />}
                      </button>
                    </div>
                    {errors.password && (
                      <p className="text-rose-500 text-xs mt-1 mr-1">{errors.password.message}</p>
                    )}
                  </div>
                </>
              ) : (
                /* ── 2FA step ── */
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
                      <Lock
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-brand-green transition-colors"
                        size={18}
                        strokeWidth={2}
                      />
                      <input
                        {...register('totpToken')}
                        type="text"
                        autoFocus
                        placeholder="000000"
                        maxLength={6}
                        className={`w-full h-[52px] pr-12 pl-4 rounded-[10px] border-[1.5px] bg-white text-brand-navy placeholder:text-brand-text-muted text-sm text-center font-mono tracking-[0.5em] focus:outline-none focus:ring-[3px] transition-all ${
                          errors.totpToken
                            ? 'border-rose-500 focus:ring-rose-500/15 focus:border-rose-500'
                            : 'border-[var(--brand-border)] focus:ring-[var(--brand-green)]/15 focus:border-brand-green'
                        }`}
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

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-[52px] bg-brand-green hover:bg-brand-green-dark text-white font-bold rounded-[10px] shadow-lg shadow-brand-green/20 transition-all flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
              >
                {isSubmitting ? (
                  <Loader2 className="animate-spin" size={24} strokeWidth={2} />
                ) : (
                  <div className="flex items-center justify-center gap-3">
                    <span>{show2FA ? 'التحقق من الرمز' : t('auth.login')}</span>
                    <ArrowLeft size={18} strokeWidth={2} />
                  </div>
                )}
              </button>
            </form>

            {/* Divider "أو" */}
            <div className="relative flex items-center justify-center my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <span className="relative px-3 bg-[var(--brand-bg-card)] text-sm text-gray-400">أو</span>
            </div>

            <div className="text-center">
              <p className="text-sm text-brand-text-muted font-bold">
                {t('auth.noAccount')}{' '}
                <Link
                  to="/register"
                  className="text-brand-green hover:text-brand-green-dark transition-colors border-b-2 border-brand-green/20 pb-0.5"
                >
                  {t('auth.registerHere')}
                </Link>
              </p>
            </div>

            {/* Footer */}
            <div className="text-[11px] text-gray-400 text-center mt-8">
              © 2024 جامعة 6 أكتوبر التكنولوجية
            </div>
          </div>
        </div>
      </div>

      {/* Background Overlay Text (Bottom-Left Corner) */}
      <div className="branding-overlay-block absolute bottom-8 left-8 z-10 hidden md:flex flex-col gap-4 text-right items-start animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="flex items-center gap-3">
          <h2 className="text-[22px] font-bold text-white tracking-tight leading-tight m-0">
            جامعة 6 أكتوبر التكنولوجية
          </h2>
          {/* Pulsing green dot */}
          <span className="relative flex h-3 w-3 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
          </span>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {[
            'نظام إدارة أكاديمية متكامل',
            'واجهة سهلة وسريعة',
            'دعم كامل باللغة العربية'
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
      {/* ── Forgot Password Modal ── */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-brand-bg-card rounded-3xl border border-brand-border shadow-2xl p-8 max-w-sm w-full animate-in fade-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-2xl bg-brand-primary-50 dark:bg-brand-primary-900/20 flex items-center justify-center mx-auto mb-5">
              <Mail size={28} strokeWidth={2} className="text-brand-primary-500" />
            </div>
            <h3 className="text-xl font-black text-center text-brand-text-primary dark:text-brand-text-main mb-2">
              {t('auth.forgotPasswordTitle')}
            </h3>

            {forgotSuccess ? (
              <div className="space-y-6 text-center">
                <p className="text-sm text-brand-text-secondary leading-relaxed">
                  {t('auth.forgotPasswordSuccess') ||
                    'تم إرسال طلبك للإدارة، سيتم التواصل معك قريباً'}
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
                    onChange={(e) => setForgotEmail(e.target.value)}
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
                    {forgotLoading ? (
                      <Loader2 className="animate-spin" size={18} strokeWidth={2} />
                    ) : (
                      t('auth.sendRequest') || 'إرسال طلب'
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
