import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Bell,
  ChevronDown,
  ChevronRight,
  LogOut,
  User as UserIcon,
  Menu,
  Settings,
} from 'lucide-react';
import ThemeToggle from '../ui/ThemeToggle';
import { useNotifications } from '../../context/NotificationContext';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageToggle from '../ui/LanguageToggle';
import { useLanguage } from '../../context/LanguageContext';
import GlobalSearch from './GlobalSearch';
import { getDynamicBaseUrl } from '../../services/api';

const Header = ({ onMenuClick }: { onMenuClick: () => void }) => {
  const { user, logout } = useAuth();
  const { notifications, unreadCount, pendingRequestsCount, markAsRead, markAllAsRead } = useNotifications();
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const navigate = useNavigate();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getInitials = () => {
    if (!user) return '?';
    if (user.firstName && user.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    return user.email.substring(0, 2).toUpperCase();
  };

  const getProfilePictureUrl = (path?: string) => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    const baseUrl = getDynamicBaseUrl().replace(/\/api$/, '') || 'http://localhost:5000';
    return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-brand-border bg-brand-bg-card/90 px-4 backdrop-blur-xl md:px-8 transition-colors duration-300">
      <div className="flex items-center gap-6">
        <button
          onClick={onMenuClick}
          className="rounded-xl p-2 text-brand-text-primary dark:text-brand-text-main hover:bg-slate-100 dark:hover:bg-slate-800 md:hidden transition-colors"
          aria-label={t('nav.openMenu')}
        >
          <Menu size={22} />
        </button>

        <GlobalSearch />
      </div>

      <div className="flex items-center gap-2 md:gap-4">
        <LanguageToggle />
        <ThemeToggle />

        <div className="relative" ref={notificationsRef}>
          <button
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            className="relative rounded-xl p-2 text-brand-text-secondary dark:text-brand-text-main hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
            aria-label={t('header.notifications')}
            aria-expanded={isNotificationsOpen}
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 rtl:-right-auto rtl:-left-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-brand-green-dark text-[10px] font-black text-white ring-2 ring-brand-bg-card shadow-sm">
                {unreadCount}
              </span>
            )}
            {pendingRequestsCount > 0 && (
              <span className="absolute -top-1 -left-1 rtl:-left-auto rtl:-right-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-500 animate-pulse text-[10px] font-black text-white ring-2 ring-brand-bg-card shadow-sm">
                {pendingRequestsCount}
              </span>
            )}
          </button>

          {isNotificationsOpen && (
            <div
              className={`fixed inset-x-2 top-20 z-50 md:absolute md:inset-x-auto ${isRTL ? 'md:left-0' : 'md:right-0'} md:top-full mt-3 w-[calc(100vw-2rem)] md:w-96 origin-top-right rounded-[2rem] border border-brand-border bg-brand-bg-card shadow-elevated ring-1 ring-black/5 animate-in fade-in slide-in-from-top-4 duration-300`}
            >
              <div className="flex items-center justify-between border-b border-brand-border px-6 py-5">
                <h3 className="text-base font-black text-brand-text-primary dark:text-brand-text-main uppercase tracking-widest">
                  {t('header.notifications')}
                </h3>
                {unreadCount > 0 && (
                  <button
                    onClick={() => markAllAsRead()}
                    className="label-stat text-brand-brand-green-dark hover:text-brand-primary-600 transition-colors font-bold"
                  >
                    {t('header.markAllRead')}
                  </button>
                )}
              </div>
              <div className="max-h-[60vh] md:max-h-[32rem] overflow-y-auto py-2 custom-scrollbar">
                {pendingRequestsCount > 0 && (
                  <div 
                    onClick={() => {
                      navigate('/registration-requests');
                      setIsNotificationsOpen(false);
                    }}
                    className="mx-4 my-2 p-3 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-2xl flex items-center justify-between cursor-pointer transition-all animate-pulse"
                  >
                    <div className="text-start">
                      <p className="text-xs font-black text-red-600 dark:text-red-400 uppercase tracking-wider">
                        {isRTL ? 'طلبات تسجيل معلقة' : 'Pending Requests'}
                      </p>
                      <p className="text-sm font-bold text-slate-800 dark:text-white mt-0.5">
                        {isRTL 
                          ? `هناك ${pendingRequestsCount} طلب تسجيل بانتظار المراجعة` 
                          : `There are ${pendingRequestsCount} registration requests awaiting review`
                        }
                      </p>
                    </div>
                    <ChevronRight size={16} className="text-red-500 rtl:-scale-x-100" />
                  </div>
                )}
                {notifications.length === 0 ? (
                  <div className="py-12 text-center">
                    <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-brand-border">
                      <Bell className="h-8 w-8 text-brand-text-muted" />
                    </div>
                    <p className="text-sm font-bold text-brand-text-secondary">
                      {t('header.noNotifications')}
                    </p>
                  </div>
                ) : (
                  notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`px-6 py-4 transition-all hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer border-b border-brand-border last:border-0 ${!notification.isRead ? 'bg-brand-brand-green-dark/5' : ''}`}
                      onClick={() => markAsRead(notification.id)}
                    >
                      <div className="flex gap-4">
                        <div
                          className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full shadow-sm ${!notification.isRead ? 'bg-brand-brand-green-dark animate-pulse' : 'bg-slate-200 dark:bg-slate-700'}`}
                        />
                        <div>
                          <p className="text-sm font-black text-brand-text-primary dark:text-brand-text-main leading-tight">
                            {notification.title}
                          </p>
                          <p className="text-xs text-brand-text-secondary font-medium mt-1 line-clamp-2 leading-relaxed">
                            {notification.message}
                          </p>
                          <p className="text-[10px] text-brand-text-muted font-bold mt-2 uppercase tracking-wider">
                            {new Date(notification.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              {notifications.length > 0 && (
                <div className="border-t border-brand-border p-4 bg-slate-50/50 dark:bg-slate-800/30">
                  <button
                    onClick={() => {
                      navigate('/notifications');
                      setIsNotificationsOpen(false);
                    }}
                    className="label-stat text-brand-brand-green-dark hover:text-brand-primary-600 transition-colors flex items-center justify-center gap-2 mx-auto"
                  >
                    {t('header.viewAllNotifications')}{' '}
                    <ChevronRight size={14} className="rtl:-scale-x-100" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className={`flex items-center gap-2 md:gap-3 rounded-2xl border transition-all shadow-sm p-1.5 md:pr-4 md:rtl:pl-4 md:rtl:pr-1.5 ${
              isProfileOpen
                ? 'border-brand-green bg-brand-primary-50/50 dark:bg-brand-primary-950/20'
                : 'border-brand-border bg-slate-50 dark:bg-slate-800/30 hover:border-brand-green/50 hover:bg-brand-bg-card'
            }`}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-brand-green-dark font-black text-white shadow-lg shadow-brand-brand-green-dark/20 ring-2 ring-brand-bg-card transition-transform group-hover:scale-105 shrink-0 overflow-hidden">
              {user?.profilePicture ? (
                <img
                  src={getProfilePictureUrl(user.profilePicture)}
                  alt="Avatar"
                  className="h-full w-full object-cover"
                />
              ) : (
                getInitials()
              )}
            </div>
            <div className="hidden md:flex flex-col items-end">
              <span className="text-sm font-black text-brand-text-primary dark:text-brand-text-main truncate max-w-[120px]">
                {user?.firstName} {user?.lastName}
              </span>
              <span className={`text-[10px] font-black uppercase tracking-tighter transition-colors ${
                isProfileOpen ? 'text-brand-green' : 'text-brand-brand-green-dark'
              }`}>
                {user?.role?.replace('_', ' ')}
              </span>
            </div>
            <ChevronDown
              size={16}
              className={`transition-transform duration-300 shrink-0 ${
                isProfileOpen ? 'rotate-180 text-brand-green-dark' : 'text-brand-text-muted'
              }`}
            />
          </button>

          {isProfileOpen && (
            <div
              className={`absolute ${isRTL ? 'left-0' : 'right-0'} mt-3 w-64 origin-top-right rounded-[2rem] border border-brand-border bg-brand-bg-card p-2 shadow-elevated ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-200`}
            >
              <div className="px-4 py-4 mb-2 border-b border-brand-border">
                <p className="label-stat text-brand-text-muted mb-1">{t('header.signedInAs')}</p>
                <p className="text-sm font-black text-brand-text-primary dark:text-brand-text-main truncate">
                  {user?.email}
                </p>
              </div>
              <button
                onClick={() => {
                  navigate('/profile');
                  setIsProfileOpen(false);
                }}
                className="flex w-full items-center gap-3 px-4 py-3 text-sm font-bold text-brand-text-primary dark:text-brand-text-main hover:bg-brand-green-dark hover:text-white transition-all group rounded-2xl"
              >
                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                  <UserIcon
                    size={18}
                    className="text-brand-text-secondary group-hover:text-white"
                  />
                </div>
                <span className="label-stat group-hover:text-white">{t('nav.profile')}</span>
              </button>
              <button
                onClick={() => {
                  navigate('/settings');
                  setIsProfileOpen(false);
                }}
                className="flex w-full items-center gap-3 px-4 py-3 text-sm font-bold text-brand-text-primary dark:text-brand-text-main hover:bg-brand-green-dark hover:text-white transition-all group rounded-2xl"
              >
                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                  <Settings
                    size={18}
                    className="text-brand-text-secondary group-hover:text-white"
                  />
                </div>
                <span className="label-stat group-hover:text-white">{t('nav.settings')}</span>
              </button>
              <div className="my-2 border-t border-brand-border" />
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-3 px-4 py-3 text-sm font-bold text-error hover:bg-error hover:text-white rounded-2xl transition-all group"
              >
                <div className="w-8 h-8 rounded-lg bg-error/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                  <LogOut size={18} className="rtl:-scale-x-100" />
                </div>
                <span className="label-stat">{t('nav.logout')}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
