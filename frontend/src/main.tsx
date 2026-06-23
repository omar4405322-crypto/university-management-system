import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider } from './context/LanguageContext';
import { Toaster } from 'react-hot-toast';
import './index.css';
import './i18n';
import i18n from './i18n';

const initLang = i18n.language?.startsWith('ar') ? 'ar' : 'en';
document.documentElement.dir = initLang === 'ar' ? 'rtl' : 'ltr';
document.documentElement.lang = initLang;

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
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
} else {
  throw new Error('Root element not found. Ensure index.html has a <div id="root"></div>');
}
