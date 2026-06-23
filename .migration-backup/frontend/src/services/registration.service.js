import api from './api';

const registrationService = {
  getRequests: async () => {
    try {
      const response = await api.get('/auth/requests');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  approveRequest: async (id) => {
    try {
      const response = await api.put(`/auth/requests/${id}/approve`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  rejectRequest: async (id) => {
    try {
      const response = await api.put(`/auth/requests/${id}/reject`);
      return response.data;
    } catch (error) {
      throw error;
    }
  }
};

export default registrationService;
