import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import Footer from './Footer';
import SuperAdminTwoFactorBanner from '../SuperAdminTwoFactorBanner';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';

const AppShell = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { isRTL } = useLanguage();
  const { isSidebarCollapsed } = useTheme();

  const sidebarInset = isSidebarCollapsed
    ? (isRTL ? 'md:pr-20' : 'md:pl-20')
    : (isRTL ? 'md:pr-72' : 'md:pl-72');

  return (
    <div
      className="min-h-screen bg-brand-bg-page transition-colors"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <div
        className={`flex flex-col flex-1 min-h-screen min-w-0 transition-all duration-300 ${sidebarInset}`}
      >
        <Header onMenuClick={() => setIsSidebarOpen(true)} />

        <main className="flex-1 min-h-0 overflow-y-auto page-padding">
          <div className="mx-auto content-container pb-8">
            <SuperAdminTwoFactorBanner />
            {children}
          </div>
        </main>

        <Footer />
      </div>
    </div>
  );
};

export default AppShell;
