import api from './api';

const notificationsService = {
  getNotifications: async () => {
    const response = await api.get('/notifications');
    return response.data;
  },
  getUnreadCount: async () => {
    const response = await api.get('/notifications/unread-count');
    return response.data;
  },
  markAsRead: async (id: number | string) => {
    const response = await api.patch(`/notifications/${id}/read`);
    return response.data;
  },
  markAllAsRead: async () => {
    const response = await api.patch('/notifications/read-all');
    return response.data;
  },
  deleteNotification: async (id: number | string) => {
    const response = await api.delete(`/notifications/${id}`);
    return response.data;
  },
  deleteAllNotifications: async () => {
    const response = await api.delete('/notifications');
    return response.data;
  }
};

export default notificationsService;
