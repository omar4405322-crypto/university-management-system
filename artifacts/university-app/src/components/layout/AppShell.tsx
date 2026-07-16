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
      className="min-h-screen bg-brand-bg-page transition-all duration-300 lg:grid"
      style={{
        gridTemplateColumns: `var(--sidebar-width, 0px) 1fr`,
        '--sidebar-width': isSidebarCollapsed ? '80px' : '288px'
      } as React.CSSProperties}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <Sidebar isOpen={isSidebarOpen} onClose={handleSidebarClose} />

      <div className="flex flex-col min-h-screen min-w-0 lg:col-start-2">
        <Header onMenuClick={handleMenuClick} />

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
