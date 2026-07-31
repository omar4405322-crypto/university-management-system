import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

/** @typedef {'ar' | 'en'} Language */

const STORAGE_KEY = 'language';

/** @param {string | null | undefined} lng */
interface LanguageContextType {
  language: string;
  setLanguage: (lang: string) => void;
  toggleLanguage: () => void;
  isRTL: boolean;
}

export const normalizeLanguage = (lng?: string | null): string => {
  if (!lng) return 'ar';
  if (lng === 'ar' || lng.startsWith('ar')) return 'ar';
  return 'en';
};

const readStoredLanguage = (): string => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'ar' || saved === 'en') return saved;
    const legacy = localStorage.getItem('i18nextLng');
    return normalizeLanguage(legacy);
  } catch {
    return 'ar';
  }
};

const LanguageContext = createContext<LanguageContextType>({
  language: 'ar',
  setLanguage: () => {},
  toggleLanguage: () => {},
  isRTL: true,
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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
    const onLanguageChanged = (lng: string) => {
      const next = normalizeLanguage(lng);
      setLanguageState((prev) => (prev === next ? prev : next));
    };
    i18n.on('languageChanged', onLanguageChanged);
    return () => i18n.off('languageChanged', onLanguageChanged);
  }, [i18n]);

  const setLanguage = useCallback((lang: string) => {
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
