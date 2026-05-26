import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  Bell, 
  Search, 
  ChevronDown, 
  LogOut, 
  User as UserIcon,
  Menu,
  Moon,
  Sun
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useNotifications } from '../../context/NotificationContext';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';

const Header = ({ onMenuClick }) => {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isLangOpen, setIsLangOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const profileRef = useRef(null);
  const langRef = useRef(null);
  const notificationsRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
      if (langRef.current && !langRef.current.contains(event.target)) {
        setIsLangOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target)) {
        setIsNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleLanguage = (lang) => {
    i18n.changeLanguage(lang);
    setIsLangOpen(false);
  };

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
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 px-4 backdrop-blur-md md:px-8">
      <div className="flex items-center gap-4">
        <button 
          onClick={onMenuClick}
          className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800 md:hidden"
        >
          <Menu size={20} className="text-slate-600 dark:text-slate-400" />
        </button>
        
        <div className="relative hidden max-w-md md:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder={t('common.search')}
            className="h-10 w-80 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-10 pr-4 text-sm transition-all focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-4 focus:ring-blue-500/10 dark:text-white"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-4">
        <div className="relative" ref={langRef}>
          <button 
            onClick={() => setIsLangOpen(!isLangOpen)}
            className="flex items-center gap-2 rounded-full p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title={t('header.changeLanguage')}
          >
            <Languages size={20} />
            <span className="hidden text-xs font-bold md:block uppercase">{i18n.language}</span>
          </button>

          {isLangOpen && (
            <div className={`absolute ${i18n.language === 'ar' ? 'left-0' : 'right-0'} mt-2 w-32 origin-top-right rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-1 shadow-xl ring-1 ring-black ring-opacity-5 animate-in fade-in zoom-in duration-100`}>
              <button 
                onClick={() => toggleLanguage('en')}
                className={`flex w-full items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors ${i18n.language === 'en' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-bold' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
              >
                {t('header.english')} {i18n.language === 'en' && <div className="h-1.5 w-1.5 rounded-full bg-blue-600"></div>}
              </button>
              <button 
                onClick={() => toggleLanguage('ar')}
                className={`flex w-full items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors ${i18n.language === 'ar' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-bold' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
              >
                {t('header.arabic')} {i18n.language === 'ar' && <div className="h-1.5 w-1.5 rounded-full bg-blue-600"></div>}
              </button>
            </div>
          )}
        </div>

        <button 
          onClick={toggleTheme}
          className="rounded-full p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          {isDark ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        <div className="relative" ref={notificationsRef}>
          <button 
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            className="relative rounded-full p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white ring-2 ring-white dark:ring-slate-900">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {isNotificationsOpen && (
            <div className={`absolute ${i18n.language === 'ar' ? 'left-0' : 'right-0'} mt-2 w-80 origin-top-right rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl ring-1 ring-black ring-opacity-5 animate-in fade-in zoom-in duration-100 overflow-hidden`}>
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 px-4 py-3">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{t('notifications.title', 'Notifications')}</h3>
                {unreadCount > 0 && (
                  <button 
                    onClick={markAllAsRead}
                    className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {t('notifications.markAllAsRead', 'Mark all as read')}
                  </button>
                )}
              </div>
              <div className="max-h-[400px] overflow-y-auto">
                {notifications.length > 0 ? (
                  <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
                    {notifications.map((notification) => (
                      <div 
                        key={notification.id} 
                        className={`flex gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer ${!notification.isRead ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''}`}
                        onClick={() => {
                          if (!notification.isRead) markAsRead(notification.id);
                        }}
                      >
                        <div className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                          notification.type === 'success' ? 'bg-emerald-100 text-emerald-600' :
                          notification.type === 'warning' ? 'bg-amber-100 text-amber-600' :
                          notification.type === 'error' ? 'bg-rose-100 text-rose-600' :
                          'bg-blue-100 text-blue-600'
                        }`}>
                          <Bell size={14} />
                        </div>
                        <div className="flex-1">
                          <p className={`text-sm ${!notification.isRead ? 'font-semibold text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'}`}>
                            {notification.title}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-500 line-clamp-2">
                            {notification.message}
                          </p>
                          <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-600">
                            {new Date(notification.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        {!notification.isRead && (
                          <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-600"></div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                    <div className="rounded-full bg-slate-100 dark:bg-slate-800 p-3 mb-3">
                      <Bell size={24} className="text-slate-400" />
                    </div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{t('notifications.empty', 'No notifications')}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t('notifications.emptyDesc', 'We\'ll notify you when something important happens.')}</p>
                  </div>
                )}
              </div>
              {notifications.length > 0 && (
                <div className="border-t border-slate-100 dark:border-slate-700 p-2 text-center">
                  <button className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                    {t('notifications.viewAll', 'View all notifications')}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="h-8 w-px bg-slate-200 dark:bg-slate-800 mx-2 hidden md:block"></div>

        <div className="relative" ref={profileRef}>
          <button 
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="flex items-center gap-3 rounded-full p-1 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white ring-2 ring-blue-50 dark:ring-blue-900/20 ring-offset-0 overflow-hidden">
              {user?.profilePicture ? (
                <img src={user.profilePicture} alt="Profile" className="h-full w-full object-cover" />
              ) : getInitials()}
            </div>
            <div className="hidden text-left md:block">
              <p className="text-sm font-semibold text-slate-900 dark:text-white leading-none">{user?.firstName || 'Admin'} {user?.lastName || ''}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-none capitalize">{user?.role?.toLowerCase()?.replace('_', ' ')}</p>
            </div>
            <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${isProfileOpen ? 'rotate-180' : ''}`} />
          </button>

          {isProfileOpen && (
            <div className={`absolute ${i18n.language === 'ar' ? 'left-0' : 'right-0'} mt-2 w-56 origin-top-right rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-1 shadow-xl ring-1 ring-black ring-opacity-5 animate-in fade-in zoom-in duration-100`}>
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
                <p className="text-sm font-medium text-slate-900 dark:text-white">{user?.email}</p>
              </div>
              <div className="py-1">
                <button 
                  onClick={() => { setIsProfileOpen(false); navigate('/profile'); }}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <UserIcon size={16} /> {t('nav.profile')}
                </button>
                <button 
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                >
                  <LogOut size={16} /> {t('nav.logout')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
