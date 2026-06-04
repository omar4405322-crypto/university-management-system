// FIXED: Login errors, no client lockout, session-expired hint, email normalize - login fix
import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { LogIn, Mail, Lock, AlertCircle, Loader2 } from 'lucide-react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();

  const { login } = useAuth();
  const navigate = useNavigate();

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
      const result = await login(email, password);
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
    <div className="min-h-screen flex items-center justify-center bg-brand-bg-page relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-brand-green/5 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-brand-navy/5 blur-[120px]" />
      </div>

      <div className="w-full max-w-[440px] px-6 py-12 relative z-10">
        <div className="text-center mb-10">
          <img src="/assets/university/logo.svg" alt="" className="h-20 w-auto mx-auto mb-6" />
          <h1 className="tracking-tight">{t('auth.universityName')}</h1>
          <p className="text-brand-text-sub mt-2 font-medium">{t('auth.loginSubtitle')}</p>
        </div>

        <div className="bg-brand-bg-card rounded-3xl shadow-2xl p-8 border border-brand-border/10">
          <form className="form-section" onSubmit={handleSubmit}>
            {error && (
              <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-sm font-medium flex items-center gap-3">
                <AlertCircle size={20} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <p className="text-xs text-brand-text-muted text-center font-medium">
              {t('auth.loginHint')}
            </p>

            <div className="space-y-2">
              <label className="text-brand-text-sub font-bold text-brand-text-main ml-1">{t('auth.emailAddress')}</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-text-muted" size={18} />
                <Input
                  id="email-address"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder={t('auth.emailPlaceholder')}
                  className="pl-12 h-12"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between ml-1">
                <label className="text-brand-text-sub font-bold text-brand-text-main">{t('auth.password')}</label>
                <span 
                  className="text-xs font-bold text-brand-text-muted cursor-not-allowed select-none" 
                  title="Coming soon" 
                > 
                  {t('auth.forgotPassword')} 
                </span>
              </div>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-text-muted" size={18} />
                <Input
                  id="password"
                  type="password"
                  required
                  placeholder={t('auth.passwordPlaceholder')}
                  className="pl-12 h-12"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <Button type="submit" disabled={loading} className="w-full h-12 rounded-2xl">
              {loading ? <Loader2 className="animate-spin" size={20} /> : (
                <>
                  <LogIn size={20} />
                  {t('auth.login')}
                </>
              )}
            </Button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-brand-text-sub font-medium">
              {t('auth.noAccount')}{' '}
              <Link to="/register" className="text-brand-green font-bold">{t('auth.registerHere')}</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
