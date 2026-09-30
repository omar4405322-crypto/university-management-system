import React, { useState, useCallback } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import AdminFooter from './AdminFooter';
import SuperAdminTwoFactorBanner from '../SuperAdminTwoFactorBanner';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';

const AppShell = ({ children }: { children: React.ReactNode }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { isRTL } = useLanguage();
  const { isSidebarCollapsed } = useTheme();

  // PERF: stable callbacks — Sidebar and Header won't re-render when AppShell re-renders
  const handleSidebarClose = useCallback(() => setIsSidebarOpen(false), []);
  const handleMenuClick = useCallback(() => setIsSidebarOpen(true), []);

  return (
    <div 
      className="min-h-screen bg-brand-bg-page transition-all duration-300 lg:grid overflow-x-hidden w-full max-w-full"
      style={{
        gridTemplateColumns: `var(--sidebar-width, 0px) 1fr`,
        '--sidebar-width': isSidebarCollapsed ? '80px' : '288px'
      } as React.CSSProperties}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* WCAG 2.4.1: Skip to main content landmark */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:start-4 focus:z-[9999] focus:px-4 focus:py-2.5 focus:bg-brand-primary-600 focus:text-white focus:font-black focus:rounded-xl focus:shadow-2xl focus:outline-none focus:ring-2 focus:ring-white"
      >
        {isRTL ? 'الانتقال إلى المحتوى الرئيسي' : 'Skip to main content'}
      </a>

      <Sidebar isOpen={isSidebarOpen} onClose={handleSidebarClose} />

      <div className="flex flex-col min-h-screen min-w-0 w-full max-w-full lg:col-start-2 overflow-x-hidden">
        <Header onMenuClick={handleMenuClick} isSidebarOpen={isSidebarOpen} />

        <main id="main-content" tabIndex={-1} className="flex-1 min-h-0 overflow-y-auto page-padding outline-none">
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
