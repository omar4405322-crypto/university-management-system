import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Bell,
  ChevronDown,
  ChevronRight,
  LogOut,
  User as UserIcon,
  Menu,
  Settings
} from 'lucide-react';
import ThemeToggle from '../ui/ThemeToggle';
import { useNotifications } from '../../context/NotificationContext';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageToggle from '../ui/LanguageToggle';
import { useLanguage } from '../../context/LanguageContext';
import GlobalSearch from './GlobalSearch';

const Header = ({ onMenuClick }) => {
  const { user, logout } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const navigate = useNavigate();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const profileRef = useRef(null);
  const notificationsRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target)) {
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

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-brand-border bg-brand-bg-card/90 px-4 backdrop-blur-xl md:px-8 transition-colors duration-300">
      <div className="flex items-center gap-6">
        <button
          onClick={onMenuClick}
          className="rounded-xl p-2 text-brand-text-primary dark:text-brand-text-main hover:bg-slate-100 dark:hover:bg-slate-800 md:hidden transition-colors"
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
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute right-2 rtl:right-auto rtl:left-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-brand-primary-500 text-[10px] font-black text-white ring-2 ring-white dark:ring-slate-900 shadow-sm">
                {unreadCount}
              </span>
            )}
          </button>

          {isNotificationsOpen && (
            <div className={`absolute ${isRTL ? 'left-0' : 'right-0'} mt-3 w-96 origin-top-right rounded-[2rem] border border-brand-border bg-brand-bg-card shadow-elevated ring-1 ring-black/5 animate-in fade-in slide-in-from-top-4 duration-300`}>
              <div className="flex items-center justify-between border-b border-brand-border px-6 py-5">
                <h3 className="text-base font-black text-brand-text-primary dark:text-brand-text-main uppercase tracking-widest">{t('header.notifications')}</h3>
                {unreadCount > 0 && (
                  <button
                    onClick={() => markAllAsRead()}
                    className="label-stat text-brand-primary-500 hover:text-brand-primary-600 transition-colors"
                  >
                    {t('header.markAllRead')}
                  </button>
                )}
              </div>
              <div className="max-h-[32rem] overflow-y-auto py-2 custom-scrollbar">
                {notifications.length === 0 ? (
                  <div className="py-12 text-center">
                    <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-brand-border">
                      <Bell className="h-8 w-8 text-brand-text-muted" />
                    </div>
                    <p className="text-sm font-bold text-brand-text-secondary">{t('header.noNotifications')}</p>
                  </div>
                ) : (
                  notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`px-6 py-4 transition-all hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer border-b border-brand-border last:border-0 ${!notification.isRead ? 'bg-brand-primary-500/5' : ''}`}
                      onClick={() => markAsRead(notification.id)}
                    >
                      <div className="flex gap-4">
                        <div className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full shadow-sm ${!notification.isRead ? 'bg-brand-primary-500 animate-pulse' : 'bg-slate-200 dark:bg-slate-700'}`} />
                        <div>
                          <p className="text-sm font-black text-brand-text-primary dark:text-brand-text-main leading-tight">{notification.title}</p>
                          <p className="text-xs text-brand-text-secondary font-medium mt-1 line-clamp-2 leading-relaxed">{notification.message}</p>
                          <p className="text-[10px] text-brand-text-muted font-bold mt-2 uppercase tracking-wider">{new Date(notification.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
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
                    className="label-stat text-brand-primary-500 hover:text-brand-primary-600 transition-colors flex items-center justify-center gap-2 mx-auto"
                  >
                    {t('header.viewAllNotifications')} <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="flex items-center gap-3 rounded-2xl border border-brand-border bg-slate-50 dark:bg-slate-800/30 p-1.5 pr-4 rtl:pl-4 rtl:pr-1.5 transition-all hover:border-brand-primary-500/50 hover:bg-white dark:hover:bg-slate-800 shadow-sm"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-primary-500 font-black text-white shadow-lg shadow-brand-primary-500/20 ring-2 ring-white dark:ring-slate-900 transition-transform group-hover:scale-105">
              {user?.profilePicture ? (
                <img src={user.profilePicture} alt="Avatar" className="h-full w-full rounded-xl object-cover" />
              ) : getInitials()}
            </div>
            <div className="hidden text-start md:block">
              <p className="text-xs font-black text-brand-text-primary dark:text-brand-text-main leading-none uppercase tracking-wider">{user?.firstName} {user?.lastName}</p>
              <p className="label-stat text-brand-text-secondary mt-1">{user?.role?.replace('_', ' ')}</p>
            </div>
            <ChevronDown size={14} className={`text-brand-text-muted transition-transform duration-300 ${isProfileOpen ? 'rotate-180' : ''}`} />
          </button>

          {isProfileOpen && (
            <div className={`absolute ${isRTL ? 'left-0' : 'right-0'} mt-3 w-64 origin-top-right rounded-[2rem] border border-brand-border bg-brand-bg-card p-2 shadow-elevated ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-200`}>
              <div className="px-4 py-4 mb-2 border-b border-brand-border">
                <p className="label-stat text-brand-text-muted mb-1">{t('header.signedInAs')}</p>
                <p className="text-sm font-black text-brand-text-primary dark:text-brand-text-main truncate">{user?.email}</p>
              </div>
              <button
                onClick={() => { navigate('/profile'); setIsProfileOpen(false); }}
                className="flex w-full items-center gap-3 px-4 py-3 text-sm font-bold text-brand-text-primary dark:text-brand-text-main hover:bg-brand-primary-500 hover:text-white rounded-2xl transition-all group"
              >
                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                  <UserIcon size={18} className="text-brand-text-secondary group-hover:text-white" />
                </div>
                <span className="label-stat">{t('nav.profile')}</span>
              </button>
              <button
                onClick={() => { navigate('/settings'); setIsProfileOpen(false); }}
                className="flex w-full items-center gap-3 px-4 py-3 text-sm font-bold text-brand-text-primary dark:text-brand-text-main hover:bg-brand-primary-500 hover:text-white rounded-2xl transition-all group"
              >
                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                  <Settings size={18} className="text-brand-text-secondary group-hover:text-white" />
                </div>
                <span className="label-stat">{t('nav.settings')}</span>
              </button>
              <div className="my-2 border-t border-brand-border" />
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-3 px-4 py-3 text-sm font-bold text-error hover:bg-error hover:text-white rounded-2xl transition-all group"
              >
                <div className="w-8 h-8 rounded-lg bg-error/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                  <LogOut size={18} />
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
