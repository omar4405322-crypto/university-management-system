import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';
import { logger } from '../lib/logger';

interface Notification {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  [key: string]: any;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  pendingRequestsCount: number;
  loading: boolean;
  fetchNotifications: () => Promise<void>;
  fetchPendingRequestsCount: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }: { children: React.ReactNode }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const response = await api.get('/notifications');
      if (response.data.success) {
        setNotifications(response.data.data);
        setUnreadCount(response.data.data.filter((n: Notification) => !n.isRead).length);
      }
    } catch (error: any) {
      logger.error('Fetch notifications error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingRequestsCount = async () => {
    if (!user) {
      setPendingRequestsCount(0);
      return;
    }
    const adminRoles = ['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'];
    if (!adminRoles.includes(user.role)) {
      setPendingRequestsCount(0);
      return;
    }
    try {
      const response = await api.get('/auth/requests');
      if (response.data.success) {
        const pendingCount = response.data.data.filter((r: any) => r.status === 'PENDING').length;
        setPendingRequestsCount(pendingCount);
      }
    } catch (error: any) {
      logger.error('Fetch pending requests count error:', error);
    }
  };

  useEffect(() => {
    fetchNotifications();
    fetchPendingRequestsCount();
    // Poll for notifications and requests every 1 minute
    const interval = setInterval(() => {
      fetchNotifications();
      fetchPendingRequestsCount();
    }, 60000);
    return () => clearInterval(interval);
  }, [user]);

  const markAsRead = async (id: string) => {
    try {
      const response = await api.put(`/notifications/${id}/read`);
      if (response.data.success) {
        setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (error: any) {
      logger.error('Mark as read error:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const response = await api.put('/notifications/read-all');
      if (response.data.success) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        setUnreadCount(0);
      }
    } catch (error: any) {
      logger.error('Mark all as read error:', error);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      const response = await api.delete(`/notifications/${id}`);
      if (response.data.success) {
        const deleted = notifications.find((n) => n.id === id);
        setNotifications((prev) => prev.filter((n) => n.id !== id));
        if (deleted && !deleted.isRead) {
          setUnreadCount((prev) => Math.max(0, prev - 1));
        }
      }
    } catch (error: any) {
      logger.error('Delete notification error:', error);
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        pendingRequestsCount,
        loading,
        fetchNotifications,
        fetchPendingRequestsCount,
        markAsRead,
        markAllAsRead,
        deleteNotification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};
