// @ts-nocheck
import React, { useState, useEffect, useMemo } from 'react';
import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
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
  DollarSign,
  ChevronDown,
  Settings,
  X,
  BarChart3,
  UserCheck,
  Bell,
  LogOut,
  ShieldCheck,
  Layers,
  CheckSquare,
  Activity,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { UNIVERSITY_LOGO, UNIVERSITY_LOGO_PNG } from '../../constants/universityAssets';

const SidebarItem: React.FC<any> = ({ item, isCollapsed, isChild = false }) => {
  const { t } = useTranslation();
  return (
    <NavLink
      to={item.path}
      className={({ isActive }) => `
        group flex items-center gap-3 rounded-2xl transition-all duration-300
        ${isChild ? 'px-4 py-2 text-xs' : 'px-4 py-3 text-sm'}
        ${
          isActive
            ? 'bg-brand-brand-green-dark text-white shadow-elevated shadow-brand-brand-green-dark/20'
            : 'text-brand-text-secondary hover:bg-brand-brand-green-dark/10 hover:text-brand-brand-green-dark dark:text-slate-400 dark:hover:text-brand-brand-green'
        }
        ${isCollapsed ? 'justify-center px-2' : ''}
      `}
    >
      {({ isActive }) => (
        <>
          <item.icon
            size={isChild ? 16 : 20}
            className={`shrink-0 transition-all duration-300 ${isActive ? 'text-white scale-110' : 'text-brand-text-muted group-hover:text-brand-brand-green-dark group-hover:scale-110'}`}
          />
          {!isCollapsed && (
            <span
              className={`font-black uppercase tracking-widest transition-all ${isActive ? 'translate-x-1 rtl:-translate-x-1' : ''}`}
            >
              {t(item.title)}
            </span>
          )}
          {isActive && !isCollapsed && !isChild && (
            <div className="ml-auto rtl:mr-auto w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          )}
        </>
      )}
    </NavLink>
  );
};

const groupIcons = {
  'nav.academic': BookOpen,
  'nav.users': Users,
  'nav.operations': Activity,
  'nav.system': Settings,
};

const SidebarGroup: React.FC<any> = ({ group, isCollapsed }) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(true);
  const location = useLocation();
  const GroupIcon = groupIcons[group.title];

  useEffect(() => {
    const hasActiveChild = group.items.some((item) => location.pathname === item.path);
    if (hasActiveChild) setIsOpen(true);
  }, [location.pathname, group.items]);

  if (isCollapsed) {
    return (
      <div className="py-2 space-y-1">
        {group.items.map((item) => (
          <SidebarItem key={item.path} item={item} isCollapsed={true} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-2.5 label-stat text-brand-text-muted hover:text-brand-brand-green-dark transition-colors group"
      >
        <div className="flex items-center gap-3">
          {GroupIcon && (
            <GroupIcon
              size={14}
              className="text-brand-text-muted group-hover:text-brand-brand-green-dark transition-colors"
            />
          )}
          <span>{t(group.title)}</span>
        </div>
        <div className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
          <ChevronDown size={14} />
        </div>
      </button>

      {isOpen && (
        <div className="space-y-1 animate-in slide-in-from-top-2 duration-300">
          {group.items.map((item) => (
            <SidebarItem key={item.path} item={item} isCollapsed={false} />
          ))}
        </div>
      )}
    </div>
  );
};

const Sidebar = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { isSidebarCollapsed: isCollapsed, toggleSidebar } = useTheme();

  const navigationConfig = useMemo(() => [
      {
        title: 'nav.academic',
        items: [
          {
            title: 'nav.colleges',
            path: '/colleges',
            icon: Building2,
            roles: ['SUPER_ADMIN', 'ADMIN'],
          },
          {
            title: 'nav.departments',
            path: '/departments',
            icon: Layers,
            roles: ['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN'],
          },
          {
            title: 'nav.courses',
            path: '/courses',
            icon: BookOpen,
            roles: ['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'STUDENT'],
          },
          {
            title: 'nav.schedule',
            path: '/schedule',
            icon: Calendar,
            roles: ['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'STUDENT'],
          },
          { title: 'nav.mySchedule', path: '/schedules/doctor', icon: Calendar, roles: ['DOCTOR'] },
          {
            title: 'nav.mySchedule',
            path: '/schedules/student',
            icon: Calendar,
            roles: ['STUDENT'],
          },
          {
            title: 'nav.schedulesManagement',
            path: '/schedules-management',
            icon: Calendar,
            roles: ['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN'],
          },
          {
            title: 'nav.timetableGrid',
            path: '/schedules/timetable',
            icon: Calendar,
            roles: ['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN'],
          },
          {
            title: 'nav.exams',
            path: '/exams',
            icon: FileText,
            roles: ['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'STUDENT'],
          },
          {
            title: 'timetables.title',
            path: '/timetables-management',
            icon: Calendar,
            roles: ['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'],
          },
          {
            title: 'nav.quizzes',
            path: '/quizzes',
            icon: CheckSquare,
            roles: ['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'STUDENT'],
          },
        ],
      },
      {
        title: 'nav.users',
        items: [
          {
            title: 'nav.students',
            path: '/students',
            icon: GraduationCap,
            roles: ['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'],
          },
          {
            title: 'nav.doctors',
            path: '/doctors',
            icon: Users,
            roles: ['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'],
          },
          {
            title: 'nav.admins',
            path: '/admins',
            icon: ShieldCheck,
            roles: ['SUPER_ADMIN', 'ADMIN'],
          },
        ],
      },
      {
        title: 'nav.operations',
        items: [
          {
            title: 'nav.requests',
            path: '/registration-requests',
            icon: ClipboardList,
            roles: ['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'],
          },
          {
            title: 'nav.attendance',
            path: '/attendance',
            icon: UserCheck,
            roles: ['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'STUDENT'],
          },
          {
            title: 'nav.tasks',
            path: '/tasks',
            icon: Activity,
            roles: ['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'STUDENT'],
          },
          {
            title: 'nav.finance',
            path: '/finance',
            icon: DollarSign,
            roles: ['SUPER_ADMIN', 'ADMIN'],
          },
        ],
      },
      {
        title: 'nav.system',
        items: [
          {
            title: 'nav.notifications',
            path: '/notifications',
            icon: Bell,
            roles: ['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'STUDENT'],
          },
          {
            title: 'nav.analytics',
            path: '/analytics',
            icon: BarChart3,
            roles: ['SUPER_ADMIN', 'ADMIN'],
          },
          {
            title: 'nav.profile',
            path: '/profile',
            icon: UserCircle,
            roles: ['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'STUDENT'],
          },
          {
            title: 'nav.settings',
            path: '/settings',
            icon: Settings,
            roles: ['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'STUDENT'],
          },
        ],
      },
    ],
    []
  );

  const filteredNav = useMemo(() => {
    return navigationConfig
      .map((group) => ({
        ...group,
        items: group.items.filter(
          (item) => !item.roles || (user && item.roles.includes(user.role))
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [navigationConfig, user]);

  const initials = useMemo(() => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    return user?.email?.[0]?.toUpperCase() ?? '?';
  }, [user]);

  const fullName = useMemo(() => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return user?.email?.split('@')[0] || 'User';
  }, [user]);

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm transition-opacity md:hidden ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      <aside
        className={`
        fixed top-0 z-50 h-full border-white/10 bg-brand-sidebar dark:bg-slate-900 transition-all duration-300 shadow-elevated
        ${isRTL ? 'right-0 border-l' : 'left-0 border-r'}
        ${isCollapsed ? 'w-20' : 'w-72'}
        ${isOpen ? 'translate-x-0' : isRTL ? 'translate-x-full' : '-translate-x-full'}
        md:translate-x-0
      `}
      >
        <div className="flex h-20 items-center justify-between border-b border-white/10 bg-black/10 px-4">
          <Link
            to="/dashboard"
            onClick={(e) => {
              // Force navigation as backup in case standard Link is intercepted
              navigate('/dashboard');
            }}
            className={`flex min-w-0 flex-1 items-center gap-3 hover:opacity-80 transition-opacity ${isCollapsed ? 'hidden' : 'flex'}`}
          >
            <img
              src={UNIVERSITY_LOGO_PNG}
              alt=""
              className="h-10 w-10 shrink-0 object-contain"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = UNIVERSITY_LOGO;
              }}
            />
            <div className="flex min-w-0 flex-col">
              <span className="text-xs font-black uppercase leading-tight tracking-widest text-white">
                {t('common.university', 'University')}
              </span>
              <span className="text-[10px] font-bold uppercase leading-tight tracking-tighter text-brand-brand-green-dark">
                {t('common.managementSystem', 'Management System')}
              </span>
            </div>
          </Link>

          {isCollapsed && (
            <Link 
              to="/dashboard" 
              onClick={(e) => navigate('/dashboard')}
              className="mx-auto block hover:opacity-80 transition-opacity"
            >
              <img
                src={UNIVERSITY_LOGO_PNG}
                alt="University"
                className="h-9 w-9 object-contain"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = UNIVERSITY_LOGO;
                }}
              />
            </Link>
          )}

          <button
            onClick={onClose}
            className="rounded-xl p-2 text-white/70 hover:bg-white/10 md:hidden"
            aria-label={t('nav.closeSidebar')}
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col h-[calc(100%-5rem)]">
          {/* ALWAYS VISIBLE HOME BUTTON (Right below logo area) */}
          <div className="px-4 py-2 border-b border-white/5 shrink-0">
            <NavLink
              to="/dashboard"
              className={({ isActive }) => `
                group flex items-center gap-3 rounded-2xl transition-all duration-300 px-4 py-3 text-sm
                ${isActive
                  ? 'bg-brand-brand-green-dark text-white shadow-elevated shadow-brand-brand-green-dark/20'
                  : 'text-brand-text-secondary hover:bg-brand-brand-green-dark/10 hover:text-brand-brand-green-dark dark:text-slate-400 dark:hover:text-brand-brand-green'
                }
                ${isCollapsed ? 'justify-center px-2' : ''}
              `}
            >
              {({ isActive }) => (
                <>
                  <LayoutDashboard size={20} className={`shrink-0 transition-all duration-300 ${isActive ? 'text-white scale-110' : 'text-brand-text-muted group-hover:text-brand-brand-green-dark group-hover:scale-110'}`} />
                  {!isCollapsed && <span className={`font-black uppercase tracking-widest transition-all ${isActive ? 'translate-x-1 rtl:-translate-x-1' : ''}`}>{t('nav.dashboard', 'الرئيسية')}</span>}
                </>
              )}
            </NavLink>
          </div>

          <div className="flex-1 overflow-y-auto py-6 px-4 custom-scrollbar space-y-8">
            {filteredNav.map((group, idx) => {
              if (group.flat) {
                return (
                  <div key={idx} className="space-y-1">
                    {group.items.map((item) => (
                      <SidebarItem key={item.path} item={item} isCollapsed={isCollapsed} />
                    ))}
                  </div>
                );
              }
              return <SidebarGroup key={idx} group={group} isCollapsed={isCollapsed} />;
            })}
          </div>

          <div className="p-6 border-t border-white/5 bg-black/10 backdrop-blur-md">
            <div className={`flex items-center gap-4 ${isCollapsed ? 'justify-center' : 'px-2'}`}>
              <div className="w-11 h-11 rounded-2xl bg-brand-brand-green-dark text-white flex items-center justify-center font-black shadow-lg shadow-brand-brand-green-dark/30 ring-2 ring-white/10">
                {initials}
              </div>
              {!isCollapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-white truncate uppercase tracking-wider">
                    {fullName}
                  </p>
                  <p className="label-stat text-brand-brand-green-dark mt-1 opacity-80">
                    {user?.role.replace('_', ' ')}
                  </p>
                </div>
              )}
              {!isCollapsed && (
                <button
                  onClick={logout}
                  className="p-2.5 rounded-xl bg-white/5 text-white/40 hover:text-rose-500 hover:bg-rose-500/10 transition-all duration-300"
                  title={t('nav.logout')}
                  aria-label={t('nav.logout')}
                >
                  <LogOut size={18} className="rtl:-scale-x-100" />
                </button>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={toggleSidebar}
          className={[
            'hidden md:flex absolute top-24 h-6 w-6',
            'items-center justify-center rounded-full',
            'border border-white/20 bg-brand-sidebar text-white',
            'shadow-md transition-all duration-300 z-30',
            isRTL ? '-left-3' : '-right-3',
            isRTL
              ? isCollapsed
                ? 'rotate-180'
                : 'rotate-0'
              : isCollapsed
                ? 'rotate-0'
                : 'rotate-180',
          ].join(' ')}
          aria-label={isCollapsed ? t('nav.expandSidebar') : t('nav.collapseSidebar')}
        >
          <ChevronLeft size={14} className="rtl:-scale-x-100" />
        </button>
      </aside>
    </>
  );
};

export default Sidebar;
