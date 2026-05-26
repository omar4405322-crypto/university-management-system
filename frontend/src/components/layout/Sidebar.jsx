import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  BookOpen, 
  Calendar, 
  Building2, 
  GraduationCap, 
  UserCircle, 
  ClipboardList,
  FileText,
  CreditCard,
  ChevronLeft,
  Settings,
  X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

import { useTranslation } from 'react-i18next';

const Sidebar = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();

  const menuItems = [
    {
      title: t('nav.dashboard'),
      path: '/dashboard',
      icon: LayoutDashboard,
      roles: ['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'STUDENT']
    },
    {
      title: t('nav.requests'),
      path: '/registration-requests',
      icon: ClipboardList,
      roles: ['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN']
    },
    {
      title: t('nav.colleges'),
      path: '/colleges',
      icon: Building2,
      roles: ['SUPER_ADMIN', 'ADMIN']
    },
    {
      title: t('nav.schedule'),
      path: '/schedule',
      icon: Calendar,
      roles: ['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'STUDENT']
    },
    {
      title: t('nav.schedulesManagement'),
      path: '/schedules-management',
      icon: Calendar,
      roles: ['SUPER_ADMIN', 'ADMIN']
    },
    {
      title: t('nav.courses'),
      path: '/courses',
      icon: BookOpen,
      roles: ['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'STUDENT']
    },
    {
      title: t('nav.quizzes'),
      path: '/quizzes',
      icon: ClipboardList,
      roles: ['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'STUDENT']
    },
    {
      title: t('nav.tasks'),
      path: '/tasks',
      icon: FileText,
      roles: ['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'STUDENT']
    },
    {
      title: t('nav.students'),
      path: '/students',
      icon: GraduationCap,
      roles: ['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN']
    },
    {
      title: t('nav.doctors'),
      path: '/doctors',
      icon: Users,
      roles: ['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN']
    },
    {
      title: t('nav.finance'),
      path: '/finance',
      icon: CreditCard,
      roles: ['SUPER_ADMIN', 'ADMIN']
    },
    {
      title: t('nav.profile'),
      path: '/profile',
      icon: UserCircle,
      roles: ['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'STUDENT']
    }
  ];

  const filteredItems = menuItems.filter(item => 
    !item.roles || (user && item.roles.includes(user.role))
  );

  return (
    <>
      {/* Mobile Overlay */}
      <div 
        className={`fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm transition-opacity md:hidden ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Sidebar */}
      <aside className={`fixed ${i18n.language === 'ar' ? 'right-0 border-l' : 'left-0 border-r'} top-0 z-50 h-full w-64 border-slate-200 bg-white dark:bg-slate-900 transition-transform duration-300 md:translate-x-0 ${isOpen ? 'translate-x-0' : (i18n.language === 'ar' ? 'translate-x-full' : '-translate-x-full')}`}>
        <div className="flex h-16 items-center justify-between px-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 shadow-lg shadow-blue-200 dark:shadow-blue-900/20">
              <GraduationCap size={20} className="text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">UniSys</span>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 md:hidden">
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col justify-between h-[calc(100%-4rem)] py-6 px-4">
          <nav className="space-y-1">
            {filteredItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => window.innerWidth < 768 && onClose()}
                className={({ isActive }) => `
                  group flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200
                  ${isActive 
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 shadow-sm shadow-blue-100/50 dark:shadow-none' 
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                  }
                `}
              >
                {({ isActive }) => (
                  <>
                    <item.icon size={20} className={`shrink-0 transition-colors ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300'}`} />
                    {item.title}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="mt-auto">
            <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/50 p-4 border border-slate-100 dark:border-slate-700">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{t('dashboard.systemStatus')}</p>
              <div className="mt-3 flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('dashboard.allSystemsOnline')}</p>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
