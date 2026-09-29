// FIXED: Login errors, no client lockout, session-expired hint, email normalize - login fix
// CONVERTED: useState form fields → React Hook Form + Zod
import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { TFunction } from 'i18next';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { UNIVERSITY_LOGO, UNIVERSITY_LOGO_WHITE } from '../constants/universityAssets';
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
  Globe,
  Sun,
  Moon,
} from 'lucide-react';
import Button from '../components/ui/button';
import Input from '../components/ui/input';

// ── Zod schema ──────────────────────────────────────────────────────────────
const getLoginSchema = (t: TFunction) => z.object({
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
  const { isRTL, language, toggleLanguage } = useLanguage();
  const { isDark, toggleTheme } = useTheme();
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
        .login-input:focus, .login-input:focus-visible {
          outline: 2px solid #84cc16 !important;
          outline-offset: 2px !important;
          border-color: #84cc16 !important;
          box-shadow: 0 0 0 3px rgba(132,204,22,0.25) !important;
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

      {/* ── Top Navigation Bar with Brand, Language & Theme Controls ── */}
      <div className="fixed top-5 inset-x-6 z-20 flex items-center justify-between pointer-events-none">
        <Link
          to="/"
          className="pointer-events-auto flex items-center gap-3 text-white/90 hover:text-white transition-opacity"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20 backdrop-blur-md">
            <img src={UNIVERSITY_LOGO_WHITE} alt="Logo" className="h-6 w-6 object-contain" />
          </div>
          <span className="text-xs font-bold hidden sm:inline-block text-white leading-tight">
            {isRTL ? 'جامعة 6 أكتوبر التكنولوجية' : '6th of October University of Technology'}
          </span>
        </Link>

        <div className="pointer-events-auto flex items-center gap-2.5">
          {/* Language Toggle */}
          <button
            type="button"
            onClick={toggleLanguage}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold backdrop-blur-md border border-white/15 transition-all cursor-pointer"
            aria-label="Toggle language"
          >
            <Globe size={14} />
            <span>{language === 'ar' ? 'English' : 'العربية'}</span>
          </button>

          {/* Theme Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white backdrop-blur-md border border-white/15 transition-all cursor-pointer"
            aria-label="Toggle theme"
          >
            {isDark ? <Sun size={15} /> : <Moon size={15} />}
          </button>

          {/* Back to Home Link */}
          <Link
            to="/"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold backdrop-blur-md border border-white/15 transition-all"
          >
            <span>{isRTL ? 'الرئيسية' : 'Home'}</span>
            {isRTL ? (
              <ArrowLeft size={14} strokeWidth={2} />
            ) : (
              <ArrowRight size={14} strokeWidth={2} />
            )}
          </Link>
        </div>
      </div>

      <div className="absolute top-1/2 left-1/2 z-10 w-full max-w-[420px] px-4 sm:px-0 card-entrance">
        <div 
          className="rounded-2xl shadow-2xl transition-all duration-300 w-full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-slate-900 dark:text-white"
          style={{
            padding: '36px 32px',
            borderTop: '3px solid var(--color-brand-primary-500)',
          }}
        >
          <div className="text-center flex flex-col items-center justify-center">
            {/* University Crest Logo */}
            <div className="flex justify-center mb-3">
              <div className="h-12 w-12 rounded-xl bg-brand-navy-500 flex items-center justify-center p-2 shadow-sm ring-1 ring-white/10">
                <img src={UNIVERSITY_LOGO_WHITE} alt="Logo" className="h-full w-full object-contain" />
              </div>
            </div>

            <h1 className="text-base font-bold text-slate-800 dark:text-slate-200 leading-tight">
              {isRTL ? 'جامعة 6 أكتوبر التكنولوجية' : '6th of October University of Technology'}
            </h1>
            <div className="w-10 h-[3px] bg-brand-primary-500 rounded-full mx-auto mt-2 mb-2" />
            <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold">
              {isRTL ? 'نظام الإدارة الأكاديمية' : 'Academic Management System'}
            </p>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-tight mt-4">
              {isRTL ? 'تسجيل الدخول' : 'Sign In'}
            </h2>
          </div>

          <div className="w-full mt-6 space-y-5">
            {apiError && (
              <div className="p-3.5 bg-red-50 dark:bg-red-950/30 border-s-4 border-s-red-500 rounded-e-xl text-red-700 dark:text-red-400 text-xs font-semibold flex items-center gap-2.5 animate-in fade-in zoom-in-95">
                <AlertCircle size={18} strokeWidth={2} className="shrink-0 text-red-500" />
                <span>{apiError}</span>
              </div>
            )}

            <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
              {!show2FA ? (
                <>
                  <div className="space-y-1.5 text-start">
                    <label htmlFor="login-email" className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 ms-1">
                      {t('auth.emailAddress')}
                    </label>
                    <div className="relative group">
                      <Mail
                        className="absolute start-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-primary-500 transition-colors"
                        size={17}
                        strokeWidth={2}
                      />
                      <input
                        {...register('email')}
                        id="login-email"
                        type="email"
                        placeholder={t('auth.emailPlaceholder')}
                        autoComplete="email"
                        className={`login-input w-full h-[48px] ps-11 pe-4 rounded-xl border bg-slate-50/60 dark:bg-slate-800/60 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 text-sm focus:outline-none transition-all duration-200 ${
                          errors.email
                            ? 'border-rose-500'
                            : 'border-slate-200 dark:border-slate-700'
                        }`}
                      />
                    </div>
                    {errors.email && (
                      <p className="text-rose-500 text-xs mt-1 ms-1">{errors.email.message}</p>
                    )}
                  </div>

                  <div className="space-y-1.5 text-start">
                    <div className="flex items-center justify-between mx-1">
                      <label htmlFor="login-password" className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        {t('auth.password')}
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowForgotModal(true)}
                        className="text-xs font-semibold text-brand-navy-600 dark:text-brand-primary-400 hover:text-brand-primary-600 dark:hover:text-brand-primary-300 transition-colors cursor-pointer"
                      >
                        {isRTL ? 'نسيت كلمة المرور؟' : 'Forgot password?'}
                      </button>
                    </div>
                    <div className="relative group">
                      <Lock
                        className="absolute start-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-primary-500 transition-colors"
                        size={17}
                        strokeWidth={2}
                      />
                      <input
                        {...register('password')}
                        id="login-password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder={t('auth.passwordPlaceholder')}
                        autoComplete="current-password"
                        className={`login-input w-full h-[48px] ps-11 pe-11 rounded-xl border bg-slate-50/60 dark:bg-slate-800/60 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 text-sm focus:outline-none transition-all duration-200 ${
                          errors.password
                            ? 'border-rose-500'
                            : 'border-slate-200 dark:border-slate-700'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute end-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                        aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                      >
                        {showPassword ? <EyeOff size={17} strokeWidth={2} /> : <Eye size={17} strokeWidth={2} />}
                      </button>
                    </div>
                    {errors.password && (
                      <p className="text-rose-500 text-xs mt-1 ms-1">{errors.password.message}</p>
                    )}
                  </div>
                </>
              ) : (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                  <div className="p-4 bg-brand-primary-50 dark:bg-brand-primary-950/30 rounded-xl border border-brand-primary-200 dark:border-brand-primary-900 text-center">
                    <p className="text-sm font-bold text-brand-primary-700 dark:text-brand-primary-400">
                      Two-Factor Authentication
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Enter the 6-digit code
                    </p>
                  </div>

                  <div className="space-y-1.5 text-start">
                    <label htmlFor="login-totp" className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 ms-1">
                      Code
                    </label>
                    <div className="relative group">
                      <Lock
                        className="absolute start-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-primary-500 transition-colors"
                        size={17}
                        strokeWidth={2}
                      />
                      <input
                        {...register('totpToken')}
                        id="login-totp"
                        type="text"
                        autoFocus
                        placeholder="000000"
                        maxLength={6}
                        className={`login-input w-full h-[48px] ps-11 pe-4 rounded-xl border bg-slate-50/60 dark:bg-slate-800/60 text-slate-900 dark:text-white placeholder:text-slate-400 text-sm text-center font-mono tracking-[0.5em] focus:outline-none transition-all ${
                          errors.totpToken
                            ? 'border-rose-500'
                            : 'border-slate-200 dark:border-slate-700'
                        }`}
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShow2FA(false)}
                    className="text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    {isRTL ? '→ العودة لتسجيل الدخول' : '← Back to login'}
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-[48px] bg-brand-primary-500 hover:bg-brand-primary-400 text-brand-navy-950 font-black rounded-xl shadow-sm hover:shadow transition-all flex items-center justify-center gap-2.5 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer text-sm uppercase tracking-wider"
              >
                {isSubmitting ? (
                  <Loader2 className="animate-spin text-brand-navy-950" size={20} strokeWidth={2.5} />
                ) : (
                  <span>{show2FA ? (isRTL ? 'التحقق' : 'Verify') : t('auth.login')}</span>
                )}
              </button>
            </form>

            <div className="text-center pt-1">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {t('auth.noAccount')}{' '}
                <Link
                  to="/register"
                  className="text-brand-primary-600 dark:text-brand-primary-400 font-bold hover:underline transition-colors"
                >
                  {t('auth.registerHere')}
                </Link>
              </p>
            </div>

            <div className="text-[11px] text-slate-400 dark:text-slate-500 text-center mt-6">
              © {new Date().getFullYear()} {isRTL ? 'جامعة 6 أكتوبر التكنولوجية' : '6th of October University of Technology'}
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
