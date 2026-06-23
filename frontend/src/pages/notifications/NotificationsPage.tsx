// @ts-nocheck
import React, { useState } from 'react';
import {
  CheckCircle2,
  Trash2,
  Clock,
  AlertCircle,
  Info,
  Loader2,
  Inbox,
  AlertTriangle
} from 'lucide-react';
import { useNotifications } from '../../context/NotificationContext';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../context/LanguageContext';
import { useNavigate } from 'react-router-dom';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { PageHeader } from '../../components/ui/PageHeader';

const formatRelativeTime = (dateString: string, isRTL: boolean) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays >= 30) {
    return date.toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  if (isRTL) {
    if (diffMins < 1) return 'الآن';
    if (diffMins === 1) return 'منذ دقيقة';
    if (diffMins === 2) return 'منذ دقيقتين';
    if (diffMins < 11) return `منذ ${diffMins} دقائق`;
    if (diffMins < 60) return `منذ ${diffMins} دقيقة`;
    
    if (diffHours === 1) return 'منذ ساعة';
    if (diffHours === 2) return 'منذ ساعتين';
    if (diffHours < 11) return `منذ ${diffHours} ساعات`;
    if (diffHours < 24) return `منذ ${diffHours} ساعة`;

    if (diffDays === 1) return 'أمس';
    if (diffDays === 2) return 'منذ يومين';
    if (diffDays < 11) return `منذ ${diffDays} أيام`;
    return `منذ ${diffDays} يوماً`;
  } else {
    if (diffMins < 1) return 'Just now';
    if (diffMins === 1) return '1 minute ago';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours === 1) return '1 hour ago';
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays} days ago`;
  }
};

const NotificationsPage = () => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllNotifications,
  } = useNotifications();

  const [filter, setFilter] = useState('all'); // all, unread, read

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'unread') return !n.isRead;
    if (filter === 'read') return n.isRead;
    return true;
  });

  const getNotificationIcon = (type) => {
    switch (type?.toUpperCase()) {
      case 'SUCCESS':
        return <CheckCircle2 className="text-emerald-500" size={20} />;
      case 'ERROR':
        return <AlertCircle className="text-rose-500" size={20} />;
      case 'WARNING':
        return <AlertTriangle className="text-amber-500" size={20} />;
      default:
        return <Info className="text-blue-500" size={20} />;
    }
  };

  const handleNotificationClick = (notification) => {
    if (!notification.isRead) {
      markAsRead(notification.id);
    }
    if (notification.link) {
      navigate(notification.link);
    }
  };

  return (
    <div className="section-gap animate-in fade-in duration-700">
      <PageHeader
        title={t('notifications.title')}
        subtitle={t('notifications.subtitle')}
      />

      {/* Filter Tabs and Action Buttons */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        {/* Filter Tabs */}
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-brand-border">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 text-xs font-black rounded-xl transition-all ${
              filter === 'all'
                ? 'bg-white dark:bg-slate-700 text-brand-text-primary dark:text-brand-text-main shadow-sm'
                : 'text-brand-text-secondary dark:text-brand-text-muted hover:text-brand-text-primary'
            }`}
          >
            {isRTL ? 'الكل' : 'All'}
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`px-4 py-2 text-xs font-black rounded-xl transition-all flex items-center gap-1.5 ${
              filter === 'unread'
                ? 'bg-white dark:bg-slate-700 text-brand-text-primary dark:text-brand-text-main shadow-sm'
                : 'text-brand-text-secondary dark:text-brand-text-muted hover:text-brand-text-primary'
            }`}
          >
            <span>{isRTL ? 'غير مقروءة' : 'Unread'}</span>
            {unreadCount > 0 && (
              <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brand-green-dark text-[9px] font-black text-white px-1 shadow-sm">
                {unreadCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setFilter('read')}
            className={`px-4 py-2 text-xs font-black rounded-xl transition-all ${
              filter === 'read'
                ? 'bg-white dark:bg-slate-700 text-brand-text-primary dark:text-brand-text-main shadow-sm'
                : 'text-brand-text-secondary dark:text-brand-text-muted hover:text-brand-text-primary'
            }`}
          >
            {isRTL ? 'مقروءة' : 'Read'}
          </button>
        </div>

        {/* Global Actions */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Button
            onClick={markAllAsRead}
            disabled={unreadCount === 0}
            variant="outline"
            size="sm"
            className="flex-1 sm:flex-initial rounded-xl"
          >
            {isRTL ? 'تحديد الكل كمقروء' : 'Mark All Read'}
          </Button>
          <Button
            onClick={deleteAllNotifications}
            disabled={notifications.length === 0}
            variant="danger"
            size="sm"
            className="flex-1 sm:flex-initial rounded-xl flex items-center justify-center gap-1.5"
          >
            <Trash2 size={14} />
            <span>{isRTL ? 'حذف الكل' : 'Delete All'}</span>
          </Button>
        </div>
      </div>

      <Card className="border-l-0" noPadding>
        {loading ? (
          <div className="flex flex-col items-center justify-center h-[400px] gap-4">
            <Loader2 className="animate-spin text-brand-green-dark" size={40} />
            <p className="text-sm text-brand-text-secondary font-bold uppercase tracking-widest">
              {t('common.loading')}
            </p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[400px] text-center p-8">
            <div className="h-20 w-20 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center mb-4 border border-brand-border">
              <Inbox size={40} className="text-brand-text-muted" />
            </div>
            <h3 className="text-lg font-black text-brand-text-primary dark:text-brand-text-main">{t('notifications.empty')}</h3>
            <p className="text-sm text-brand-text-secondary max-w-xs mx-auto mt-1 font-bold">
              {filter === 'unread'
                ? (isRTL ? 'لقد قرأت جميع الإشعارات!' : "You've caught up with everything!")
                : (isRTL ? 'صندوق الإشعارات فارغ حالياً.' : 'Your notification box is empty.')}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-brand-border">
            {filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={`group flex items-start gap-4 p-6 transition-all duration-300 cursor-pointer ${
                  !notification.isRead ? 'bg-brand-green-dark/5' : 'hover:bg-slate-50 dark:hover:bg-slate-800/20'
                }`}
              >
                <div
                  className={`mt-1 p-2.5 rounded-xl shrink-0 ${
                    !notification.isRead
                      ? 'bg-white dark:bg-slate-700 shadow-sm border border-brand-border'
                      : 'bg-slate-100 dark:bg-slate-800/50'
                  }`}
                >
                  {getNotificationIcon(notification.type)}
                </div>

                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <h4
                      className={`text-sm font-black ${
                        !notification.isRead ? 'text-brand-text-primary dark:text-brand-text-main' : 'text-brand-text-secondary'
                      }`}
                    >
                      {notification.title}
                    </h4>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-bold text-brand-text-muted flex items-center gap-1">
                        <Clock size={12} /> {formatRelativeTime(notification.createdAt, isRTL)}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification(notification.id);
                        }}
                        className="p-1.5 text-brand-text-muted hover:text-brand-accent-rose hover:bg-brand-accent-rose/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <p
                    className={`text-sm leading-relaxed ${
                      !notification.isRead
                        ? 'text-brand-text-secondary dark:text-brand-text-main/90 font-bold'
                        : 'text-brand-text-muted font-medium'
                    }`}
                  >
                    {notification.message}
                  </p>
                  {!notification.isRead && (
                    <div className="pt-2">
                      <Badge
                        variant="success"
                        className="text-[10px] py-0.5 px-2 font-black uppercase tracking-tighter"
                      >
                        {isRTL ? 'جديد' : 'New'}
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default NotificationsPage;
