import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

/** @typedef {'ar' | 'en'} Language */

const STORAGE_KEY = 'language';

/** @param {string | null | undefined} lng */
export const normalizeLanguage = (lng) => {
  if (!lng) return 'ar';
  if (lng === 'ar' || lng.startsWith('ar')) return 'ar';
  return 'en';
};

const readStoredLanguage = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'ar' || saved === 'en') return saved;
    const legacy = localStorage.getItem('i18nextLng');
    return normalizeLanguage(legacy);
  } catch {
    return 'ar';
  }
};

const LanguageContext = createContext({
  language: 'ar',
  setLanguage: () => {},
  toggleLanguage: () => {},
  isRTL: true,
});

export const LanguageProvider = ({ children }) => {
  const { i18n } = useTranslation();
  const [language, setLanguageState] = useState(() => readStoredLanguage());

  const isRTL = language === 'ar';

  useEffect(() => {
    const next = normalizeLanguage(language);
    i18n.changeLanguage(next);
    document.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, [language, i18n]);

  useEffect(() => {
    const onLanguageChanged = (lng) => {
      const next = normalizeLanguage(lng);
      setLanguageState((prev) => (prev === next ? prev : next));
    };
    i18n.on('languageChanged', onLanguageChanged);
    return () => i18n.off('languageChanged', onLanguageChanged);
  }, [i18n]);

  const setLanguage = useCallback((lang) => {
    setLanguageState(normalizeLanguage(lang));
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguageState((prev) => (prev === 'ar' ? 'en' : 'ar'));
  }, []);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, isRTL }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
