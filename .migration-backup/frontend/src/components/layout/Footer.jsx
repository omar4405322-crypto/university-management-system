// FIXED: Footer quick links to internal routes; removed placeholder social icons - Phase 5
import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Mail, Phone, MapPin } from 'lucide-react';
import { UNIVERSITY_LOGO_WHITE, UNIVERSITY_LOGO, UNIVERSITY_LOGO_PNG } from '../../constants/universityAssets';
import { useLanguage } from '../../context/LanguageContext';

const Footer = () => {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const currentYear = new Date().getFullYear();
  const [subscribed, setSubscribed] = React.useState(false);
  const [newsletterEmail, setNewsletterEmail] = React.useState('');
  const [newsletterError, setNewsletterError] = React.useState('');

  const handleNewsletter = (e) => {
    e.preventDefault();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!newsletterEmail || !emailRegex.test(newsletterEmail)) {
      setNewsletterError('Please enter a valid email address.');
      return;
    }
    setNewsletterError('');
    setSubscribed(true);
    // TODO: Wire to /api/newsletter endpoint when ready 
    console.warn('[Newsletter] Subscription not yet wired to backend.'); 
  };

  const quickLinks = [
    { key: 'academicCalendar', to: '/schedule' },
    { key: 'campusMap', to: '/colleges' },
    { key: 'careerServices', to: '/courses' },
    { key: 'studentPortal', to: '/dashboard' },
  ];

  return (
    <footer className="shrink-0 bg-brand-navy text-white border-t border-white/10">
      <div className="max-w-7xl mx-auto px-4 py-12 md:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <img
                src={UNIVERSITY_LOGO_WHITE}
                alt={t('footer.universityName')}
                className="h-12 w-12 shrink-0 object-contain"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = UNIVERSITY_LOGO_PNG;
                  e.currentTarget.onerror = () => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = UNIVERSITY_LOGO;
                  };
                }}
              />
              <div className="flex flex-col">
                <span className="text-base font-bold tracking-tight text-white">{t('footer.universityName')}</span>
                {language === 'ar' && (
                  <span className="text-sm font-medium text-white/60 font-arabic">{t('footer.universityNameAr')}</span>
                )}
              </div>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed">{t('footer.tagline')}</p>
          </div>

          <div className="space-y-6">
            <div className="flex items-center gap-2 border-b border-brand-primary-500/30 pb-2 inline-block w-fit">
              <h3 className="text-lg font-bold">{t('footer.quickLinks')}</h3>
            </div>
            <ul className="space-y-3 text-sm text-slate-400">
              {quickLinks.map(({ key, to }) => (
                <li key={key}>
                  <Link
                    to={to}
                    className="hover:text-brand-primary-500 transition-colors underline decoration-white/10 hover:decoration-brand-primary-500"
                  >
                    {t(`footer.${key}`)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-6">
            <h3 className="text-lg font-bold border-b border-brand-primary-500/30 pb-2 inline-block">{t('footer.contactUs')}</h3>
            <ul className="space-y-4 text-sm text-slate-400">
              <li className="flex items-start gap-3">
                <MapPin size={18} className="text-brand-primary-500 shrink-0 mt-0.5" />
                <span>{t('footer.address')}</span>
              </li>
              <li className="flex items-center gap-3">
                <Phone size={18} className="text-brand-primary-500 shrink-0" />
                <a href="tel:+20212345678" className="hover:text-brand-primary-500 transition-colors">+20 (2) 1234-5678</a>
              </li>
              <li className="flex items-center gap-3">
                <Mail size={18} className="text-brand-primary-500 shrink-0" />
                <a href="mailto:info@sout.edu.eg" className="hover:text-brand-primary-500 transition-colors">info@sout.edu.eg</a>
              </li>
            </ul>
          </div>

          <div className="space-y-6">
            <h3 className="text-lg font-bold border-b border-brand-primary-500/30 pb-2 inline-block">{t('footer.newsletter')}</h3>
            <p className="text-sm text-slate-400">{t('footer.newsletterDesc')}</p>
            <form className="flex flex-col gap-2" onSubmit={handleNewsletter}>
              {subscribed ? (
                <p className="text-sm text-brand-primary-400 font-semibold">
                  {t('footer.subscribeSuccess') || "✔ Got it! We'll reach out when the newsletter launches."}
                </p>
              ) : (
                <>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={newsletterEmail}
                      onChange={(e) => setNewsletterEmail(e.target.value)}
                      placeholder={t('footer.emailPlaceholder')}
                      className="bg-slate-800/50 border border-white/10 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-brand-primary-500 text-white placeholder:text-slate-500"
                    />
                    <button type="submit" className="bg-brand-primary-500 text-white px-4 py-2 rounded-lg hover:bg-brand-primary-600 transition-colors text-xs font-black uppercase tracking-widest">
                      {t('footer.subscribe')}
                    </button>
                  </div>
                  {newsletterError && (
                    <p className="text-xs text-red-400 mt-1">{newsletterError}</p>
                  )}
                </>
              )}
            </form>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© {currentYear} {t('footer.universityName')}. {t('footer.copyright')}</p>
          <p className="text-xs text-slate-600 italic">{t('footer.legalComingSoon') || 'Legal pages coming soon'}</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
