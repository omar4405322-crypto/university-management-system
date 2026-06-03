import api from './api';

const doctorsService = {
  getStats: async () => {
    const response = await api.get('/doctors/stats');
    return response.data;
  },

  getDoctors: async (params) => {
    const response = await api.get('/doctors', { params });
    return response.data;
  },

  getDoctorById: async (id) => {
    const response = await api.get(`/doctors/${id}`);
    return response.data;
  },

  createDoctor: async (data) => {
    const response = await api.post('/doctors', data);
    return response.data;
  },

  updateDoctor: async (id, data) => {
    const response = await api.put(`/doctors/${id}`, data);
    return response.data;
  },

  deleteDoctor: async (id) => {
    const response = await api.delete(`/doctors/${id}`);
    return response.data;
  },
};

export default doctorsService;
