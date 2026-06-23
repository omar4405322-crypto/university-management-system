import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './en.json';
import ar from './ar.json';

const STORAGE_KEY = 'language';

const getInitialLanguage = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'ar' || saved === 'en') return saved;
    const legacy = localStorage.getItem('i18nextLng');
    if (legacy?.startsWith('ar')) return 'ar';
    if (legacy?.startsWith('en')) return 'en';
  } catch {
    /* ignore */
  }
  return 'ar';
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      ar: { translation: ar },
      en: { translation: en },
    },
    lng: getInitialLanguage(),
    fallbackLng: 'en',
    supportedLngs: ['ar', 'en'],
    nonExplicitSupportedLngs: true,
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: STORAGE_KEY,
    },
  });

export default i18n;
