import React from 'react';
import { Bell, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useNotifications } from '../../context/NotificationContext';

const NotificationBell: React.FC = () => {
  const { t } = useTranslation();
  const { unreadCount } = useNotifications();

  return (
    <Link
      to="/notifications"
      className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl text-brand-text-secondary transition-colors hover:bg-brand-green-dark/10 hover:text-brand-green-dark"
      aria-label={t('nav.notifications', 'Notifications')}
      title={t('nav.notifications', 'Notifications')}
    >
      <Bell size={20} />
      {unreadCount > 0 && (
        <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-500 px-1.5 text-center text-[10px] font-bold leading-5 text-white">
          {unreadCount}
        </span>
      )}
      <ChevronRight size={0} aria-hidden="true" className="hidden" />
    </Link>
  );
};

export default NotificationBell;
