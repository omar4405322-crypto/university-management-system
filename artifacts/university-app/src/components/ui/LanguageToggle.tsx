import React from 'react';
import { Languages } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

const LanguageToggle = () => {
  const { language, toggleLanguage } = useLanguage();

  const label = language === 'ar' ? 'Switch to English' : 'التحويل إلى اللغة العربية';

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-brand-text-secondary transition-all duration-200 hover:bg-slate-100 dark:text-brand-text-main dark:hover:bg-slate-800 cursor-pointer"
      aria-label={label}
    >
      <Languages className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="uppercase tracking-widest">{language === 'ar' ? 'EN' : 'AR'}</span>
    </button>
  );
};

export default LanguageToggle;
