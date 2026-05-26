import api from './api';

const authService = {
  getRequests: async () => {
    const response = await api.get('/auth/requests');
    return response.data;
  },

  approveRequest: async (id) => {
    const response = await api.put(`/auth/requests/${id}/approve`);
    return response.data;
  },

  rejectRequest: async (id) => {
    const response = await api.put(`/auth/requests/${id}/reject`);
    return response.data;
  },
};

export default authService;
