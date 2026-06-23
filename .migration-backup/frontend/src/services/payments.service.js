import api from './api';

const paymentsService = {
  getPayments: async (params) => {
    const response = await api.get('/payments', { params });
    return response.data;
  },

  getMyPayments: async () => {
    const response = await api.get('/payments/my');
    return response.data;
  },

  getStats: async () => {
    const response = await api.get('/payments/stats');
    return response.data;
  },

  createPayment: async (data) => {
    const response = await api.post('/payments', data);
    return response.data;
  },

  updatePayment: async (id, data) => {
    const response = await api.put(`/payments/${id}`, data);
    return response.data;
  },

  markAsPaid: async (id) => {
    const response = await api.put(`/payments/${id}/pay`);
    return response.data;
  },

  deletePayment: async (id) => {
    const response = await api.delete(`/payments/${id}`);
    return response.data;
  },
};

export default paymentsService;
