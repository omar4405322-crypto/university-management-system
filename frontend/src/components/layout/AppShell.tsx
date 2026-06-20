import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import AdminFooter from './AdminFooter';
import SuperAdminTwoFactorBanner from '../SuperAdminTwoFactorBanner';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';

const AppShell = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { isRTL } = useLanguage();
  const { isSidebarCollapsed } = useTheme();

  // SIDEBAR LOGIC:
  // On mobile (< 768px): Sidebar is HIDDEN by default (translate-x-full/translate-x--full)
  // On desktop (>= 768px): Sidebar is ALWAYS VISIBLE (md:translate-x-0)
  const sidebarInset = isSidebarCollapsed
    ? isRTL
      ? 'md:mr-20'
      : 'md:ml-20'
    : isRTL
      ? 'md:mr-72'
      : 'md:ml-72';

  return (
    <div className="min-h-screen bg-brand-bg-page transition-colors" dir={isRTL ? 'rtl' : 'ltr'}>
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

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

        <AdminFooter />
      </div>
    </div>
  );
};

export default AppShell;
