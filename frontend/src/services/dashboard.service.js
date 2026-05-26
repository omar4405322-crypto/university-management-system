import api from './api';

const dashboardService = {
  getAdminStats: async () => {
    const response = await api.get('/dashboard/stats');
    return response.data;
  },

  getStudentStats: async () => {
    const response = await api.get('/dashboard/student');
    return response.data;
  },

  getDoctorStats: async () => {
    const response = await api.get('/dashboard/doctor');
    return response.data;
  },
};

export default dashboardService;
