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
  ShieldAlert,
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
import { UNIVERSITY_LOGO, UNIVERSITY_LOGO_WHITE } from '../../constants/universityAssets';
import { useNotifications } from '../../context/NotificationContext';

// PERF: React.memo prevents re-render when item's own props haven't changed
const SidebarItem: React.FC<any> = React.memo(({ item, isCollapsed, isChild = false }) => {
  const { t } = useTranslation();
  const { pendingRequestsCount } = useNotifications();
  const isRequestsItem = item.path === '/registration-requests';

  return (
    <NavLink
      to={item.path}
      className={({ isActive }) => `
        group flex items-center gap-3 rounded-2xl transition-all duration-150 w-full relative
        ${isChild ? 'px-4 py-2 text-xs' : 'px-4 py-3 text-sm'}
        ${
          isActive
            ? 'bg-brand-primary-600 text-white shadow-elevated shadow-brand-primary-600/20'
            : 'text-slate-300 hover:bg-white/5 hover:text-white/90 dark:text-slate-400 dark:hover:text-white/90'
        }
        ${isCollapsed ? 'justify-center px-2' : ''}
      `}
    >
      {({ isActive }) => (
        <>
          <item.icon
            size={isChild ? 16 : 20}
            className={`shrink-0 transition-all duration-150 ${isActive ? 'text-white scale-110' : 'text-slate-400 group-hover:text-white/90 group-hover:scale-110'}`}
          />
          {!isCollapsed && (
            <span
              className={`font-black uppercase tracking-widest transition-all ${isActive ? 'translate-x-1 rtl:-translate-x-1' : ''}`}
            >
              {t(item.title)}
            </span>
          )}
          
          {isRequestsItem && pendingRequestsCount > 0 && (
            <span className={`inline-flex items-center justify-center min-w-5 h-5 px-1.5 text-[10px] font-black rounded-full bg-red-500 text-white shadow-sm transition-all ${
              isCollapsed ? 'absolute -top-1 -right-1 scale-90' : 'ms-auto'
            }`}>
              {pendingRequestsCount}
            </span>
          )}

          {isActive && !isCollapsed && !isChild && !isRequestsItem && (
            <div className="ms-auto w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          )}
        </>
      )}
    </NavLink>
  );
});

const groupIcons = {
  'nav.academic': BookOpen,
  'nav.users': Users,
  'nav.operations': Activity,
  'nav.system': Settings,
};

// PERF: React.memo prevents full group re-render when unrelated routes change
const SidebarGroup: React.FC<any> = React.memo(({ group, isCollapsed }) => {
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
        className="w-full flex items-center justify-between px-4 py-2.5 label-stat text-slate-500 hover:text-brand-primary-400 transition-colors group"
      >
        <div className="flex items-center gap-3">
          {GroupIcon && (
            <GroupIcon
              size={14}
              className="text-slate-500 group-hover:text-brand-primary-400 transition-colors"
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
});

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
            title: 'nav.groups', // Ensure 'nav.groups' exists in translations or use a generic title
            path: '/groups',
            icon: Users,
            roles: ['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'],
          },
          { title: 'schedule.doctorScheduleTitle', path: '/schedules/doctor', icon: Calendar, roles: ['DOCTOR', 'SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'] },
          {
            title: 'nav.mySchedule',
            path: '/schedules/student',
            icon: Calendar,
            roles: ['STUDENT'],
          },
          {
            title: 'schedule.taScheduleTitle',
            path: '/schedules/ta',
            icon: Calendar,
            roles: ['TEACHING_ASSISTANT', 'SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'],
          },
          {
            title: 'nav.schedulesManagement',
            path: '/schedules-management',
            icon: Calendar,
            roles: ['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'],
          },
          {
            title: 'timetables.title',
            path: '/timetables-management',
            icon: Calendar,
            roles: ['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'],
          },
          {
            title: 'nav.exams',
            path: '/exams',
            icon: FileText,
            roles: ['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'STUDENT'],
          },
          {
            title: 'nav.record',
            path: '/record',
            icon: GraduationCap,
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
            title: 'nav.teachingAssistants',
            path: '/teaching-assistants',
            icon: GraduationCap,
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
            title: 'nav.warnings',
            path: '/warnings',
            icon: ShieldAlert,
            roles: ['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'STUDENT'],
          },
          {
            title: 'nav.statistics',
            path: '/statistics',
            icon: BarChart3,
            roles: ['STUDENT'],
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
        className={`fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm transition-opacity lg:hidden ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      <aside
        className={`
        fixed top-0 z-50 h-full border-white/10 bg-brand-sidebar dark:bg-slate-900 transition-all duration-300 shadow-elevated
        start-0 border-e
        ${isCollapsed ? 'w-20' : 'w-72'}
        ${isOpen ? 'translate-x-0' : isRTL ? 'translate-x-full' : '-translate-x-full'}
        lg:translate-x-0
      `}
      >
        {/* ── Sidebar Header ── */}
        <div className="flex h-20 items-center justify-between border-b border-white/10 px-4"
          style={{ background: 'linear-gradient(135deg, rgba(0,0,0,0.25) 0%, rgba(255,255,255,0.03) 100%)' }}
        >
          {/* Expanded state: logo + bilingual name */}
          <Link
            to="/dashboard"
            onClick={() => navigate('/dashboard')}
            className={`flex min-w-0 flex-1 items-center gap-3 hover:opacity-90 transition-opacity duration-200 ${isCollapsed ? 'hidden' : 'flex'}`}
          >
            {/* Logo badge */}
            <div className="relative shrink-0">
              <div className="absolute inset-0 rounded-2xl bg-brand-primary-500/20 blur-md" />
              <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20 shadow-lg backdrop-blur-sm">
                <img
                  src={UNIVERSITY_LOGO_WHITE}
                  alt={isRTL ? 'جامعة 6 أكتوبر التكنولوجية' : '6th of October University of Technology'}
                  className="h-7 w-7 object-contain"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = UNIVERSITY_LOGO;
                  }}
                />
              </div>
            </div>

            {/* Text identity */}
            <div className="flex min-w-0 flex-col" dir={isRTL ? 'rtl' : 'ltr'}>
              <span className="truncate text-sm font-black leading-tight text-white"
                style={{ letterSpacing: '0.01em' }}>
                {isRTL ? 'جامعة 6 أكتوبر التكنولوجية' : '6th of October University of Technology'}
              </span>
              <span className="text-[10px] font-bold leading-tight tracking-wide text-brand-primary-400 mt-0.5">
                {isRTL ? 'نظام الإدارة' : 'Management System'}
              </span>
            </div>
          </Link>

          {/* Collapsed state: logo only, centred */}
          {isCollapsed && (
            <Link
              to="/dashboard"
              onClick={() => navigate('/dashboard')}
              className="mx-auto block hover:opacity-90 transition-opacity duration-200"
            >
              <div className="relative">
                <div className="absolute inset-0 rounded-xl bg-brand-primary-500/20 blur-sm" />
                <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20 shadow-md">
                  <img
                    src={UNIVERSITY_LOGO_WHITE}
                    alt={isRTL ? 'جامعة 6 أكتوبر التكنولوجية' : '6th of October University of Technology'}
                    className="h-6 w-6 object-contain"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = UNIVERSITY_LOGO;
                    }}
                  />
                </div>
              </div>
            </Link>
          )}

          {/* Mobile close button */}
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-white/70 hover:bg-white/10 lg:hidden transition-colors"
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
                group flex items-center gap-3 rounded-2xl transition-all duration-150 w-full px-4 py-3 text-sm
                ${isActive
                  ? 'bg-brand-primary-600 text-white shadow-elevated shadow-brand-primary-600/20'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white/90 dark:text-slate-400 dark:hover:text-white/90'
                }
                ${isCollapsed ? 'justify-center px-2' : ''}
              `}
            >
              {({ isActive }) => (
                <>
                  <LayoutDashboard size={20} className={`shrink-0 transition-all duration-150 ${isActive ? 'text-white scale-110' : 'text-slate-400 group-hover:text-white/90 group-hover:scale-110'}`} />
                  {!isCollapsed && <span className={`font-black uppercase tracking-widest transition-all ${isActive ? 'translate-x-1 rtl:-translate-x-1' : ''}`}>{t('nav.dashboard', 'Dashboard')}</span>}
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
              <div className="w-11 h-11 rounded-2xl bg-brand-primary-600 text-white flex items-center justify-center font-black shadow-lg shadow-brand-primary-600/30 ring-2 ring-white/10">
                {initials}
              </div>
              {!isCollapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-white truncate uppercase tracking-wider">
                    {fullName}
                  </p>
                  <p className="label-stat text-brand-primary-400 mt-1 opacity-80">
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
            'hidden lg:flex absolute top-24 h-6 w-6',
            'items-center justify-center rounded-full',
            'border border-white/20 bg-brand-sidebar text-white',
            'shadow-md transition-all duration-300 z-30',
            '-end-3',
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
