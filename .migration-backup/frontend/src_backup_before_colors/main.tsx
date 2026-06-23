// @ts-nocheck
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider } from './context/LanguageContext';
import { Toaster } from 'react-hot-toast';
import './index.css';
import './i18n/index.js';
import i18n from './i18n/index.js';

const initLang = i18n.language?.startsWith('ar') ? 'ar' : 'en';
document.documentElement.dir = initLang === 'ar' ? 'rtl' : 'ltr';
document.documentElement.lang = initLang;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <LanguageProvider>
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3000,
            style: { fontFamily: 'inherit' },
          }}
        />
        <App />
      </LanguageProvider>
    </ThemeProvider>
  </React.StrictMode>
);
