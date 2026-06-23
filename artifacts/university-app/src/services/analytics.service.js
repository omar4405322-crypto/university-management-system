import api from './api';

const analyticsService = {
  getGeneralAnalytics: async () => {
    const response = await api.get('/analytics/general');
    return response.data;
  }
};

export default analyticsService;
