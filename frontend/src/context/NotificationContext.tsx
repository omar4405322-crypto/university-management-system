import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';
import { logger } from '../lib/logger';

interface NotificationContextType {
  notifications: any[];
  unreadCount: number;
  pendingRequestsCount: number;
  setPendingRequestsCount: (n: number) => void;
  loading: boolean;
  fetchNotifications: () => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  markAsRead: (id: any) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: any) => Promise<void>;
  deleteAllNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingRequestsCount, setPendingRequestsCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const response = await api.get('/notifications');
      if (response.data.success) {
        setNotifications(response.data.data);
      }
    } catch (error: any) {
      logger.error('Fetch notifications error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnreadCount = async () => {
    if (!user) return;
    try {
      const response = await api.get('/notifications/unread-count');
      if (response.data.success) {
        console.log('Unread count received in TSX context:', response.data.count);
        setUnreadCount(response.data.count);
      }
    } catch (error: any) {
      logger.error('Fetch unread count error:', error);
    }
  };

  useEffect(() => {
    if (user) {
      fetchNotifications();
      fetchUnreadCount();
      const countInterval = setInterval(fetchUnreadCount, 30000);
      return () => clearInterval(countInterval);
    } else {
      setNotifications([]);
      setUnreadCount(0);
    }
  }, [user]);

  const markAsRead = async (id) => {
    try {
      const response = await api.patch(`/notifications/${id}/read`);
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
      const response = await api.patch('/notifications/read-all');
      if (response.data.success) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        setUnreadCount(0);
      }
    } catch (error: any) {
      logger.error('Mark all as read error:', error);
    }
  };

  const deleteNotification = async (id) => {
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

  const deleteAllNotifications = async () => {
    try {
      const response = await api.delete('/notifications/all');
      if (response.data.success) {
        setNotifications([]);
        setUnreadCount(0);
      }
    } catch (error: any) {
      logger.error('Delete all notifications error:', error);
    }
  };

  const fetchPendingRequestsCount = async () => {
    console.log('[PendingRequests] Current user:', user?.role);
    if (!user) return;
    const allowedRoles = ['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'];
    if (!allowedRoles.includes(user.role)) return;
    try {
      console.log('[PendingRequests] Fetching from API client...');
      const response = await api.get('/auth/requests?status=PENDING');
      const data = response.data;
      console.log('[PendingRequests] Response data:', data);
      if (data.success && Array.isArray(data.data)) {
        console.log('[PendingRequests] Count set to:', data.data.length);
        setPendingRequestsCount(data.data.length);
      }
    } catch (error) {
      console.error('Failed to fetch pending requests count:', error);
    }
  };

  useEffect(() => {
    if (user) {
      fetchPendingRequestsCount();
      const interval = setInterval(fetchPendingRequestsCount, 60000);
      return () => clearInterval(interval);
    } else {
      setPendingRequestsCount(0);
    }
  }, [user]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        pendingRequestsCount,
        setPendingRequestsCount,
        loading,
        fetchNotifications,
        fetchUnreadCount,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        deleteAllNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};
