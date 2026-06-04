import React, { useState } from 'react';
import { 
  Bell, 
  CheckCircle2, 
  Trash2, 
  Clock, 
  AlertCircle,
  Info,
  MoreVertical,
  CheckCheck,
  Filter,
  Loader2,
  Inbox
} from 'lucide-react';
import { useNotifications } from '../../context/NotificationContext';
import { useTranslation } from 'react-i18next';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';

const NotificationsPage = () => {
  const { t } = useTranslation();
  const { 
    notifications, 
    unreadCount, 
    loading, 
    markAsRead, 
    markAllAsRead, 
    deleteNotification 
  } = useNotifications();
  
  const [filter, setFilter] = useState('all'); // all, unread, read

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread') return !n.isRead;
    if (filter === 'read') return n.isRead;
    return true;
  });

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'SUCCESS': return <CheckCircle2 className="text-brand-accent-emerald" size={20} />;
      case 'ERROR': return <AlertCircle className="text-brand-accent-rose" size={20} />;
      case 'WARNING': return <AlertCircle className="text-brand-accent-yellow" size={20} />;
      default: return <Info className="text-brand-accent-blue" size={20} />;
    }
  };

  const getTimeAgo = (date) => {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " years ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " months ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " days ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " hours ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " minutes ago";
    return Math.floor(seconds) + " seconds ago";
  };

  return (
    <div className="section-gap animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-brand-text-main tracking-tight">
            {t('header.notifications')}
          </h1>
          <p className="text-brand-text-sub font-bold mt-1 uppercase tracking-wider">
            {t('notifications.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            className="flex items-center gap-2 border-brand-border"
            onClick={markAllAsRead}
            disabled={unreadCount === 0}
          >
            <CheckCheck size={18} /> {t('header.markAllRead')}
          </Button>
        </div>
      </div>

      <Card className="border-l-0" noPadding>
            {loading ? (
              <div className="flex flex-col items-center justify-center h-[400px] gap-4">
                <Loader2 className="animate-spin text-brand-green" size={40} />
                <p className="text-sm text-brand-text-sub font-bold uppercase tracking-widest">{t('common.loading')}</p>
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[400px] text-center p-8">
                <div className="h-20 w-20 rounded-full bg-brand-navy/5 flex items-center justify-center mb-4 border border-brand-border">
                  <Inbox size={40} className="text-brand-text-muted" />
                </div>
                <h3 className="text-lg font-black text-brand-text-main">No Notifications</h3>
                <p className="text-sm text-brand-text-sub max-w-xs mx-auto mt-1 font-bold">
                  {filter === 'unread' ? "You've caught up with everything!" : "Your notification box is empty."}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-brand-border">
                {filteredNotifications.map((notification) => (
                  <div 
                    key={notification.id}
                    onClick={() => !notification.isRead && markAsRead(notification.id)}
                    className={`group flex items-start gap-4 p-6 transition-all duration-300 cursor-pointer ${
                      !notification.isRead ? 'bg-brand-green/5' : 'hover:bg-brand-navy/[0.02]'
                    }`}
                  >
                    <div className={`mt-1 p-2 rounded-xl shrink-0 ${
                      !notification.isRead ? 'bg-brand-bg-card dark:bg-slate-700 shadow-sm border border-brand-border' : 'bg-brand-navy/5 dark:bg-slate-800/30'
                    }`}>
                      {getNotificationIcon(notification.type)}
                    </div>
                    
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <h4 className={`text-sm font-black ${
                          !notification.isRead ? 'text-brand-text-main' : 'text-brand-text-sub'
                        }`}>
                          {notification.title}
                        </h4>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-bold text-brand-text-muted flex items-center gap-1">
                            <Clock size={12} /> {getTimeAgo(notification.createdAt)}
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
                      <p className={`text-sm leading-relaxed ${
                        !notification.isRead ? 'text-brand-text-sub font-bold' : 'text-brand-text-muted font-medium'
                      }`}>
                        {notification.message}
                      </p>
                      {!notification.isRead && (
                        <div className="pt-2">
                          <Badge variant="success" className="text-[10px] py-0.5 px-2 font-black uppercase tracking-tighter">New Alert</Badge>
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
