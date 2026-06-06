import api from './api';

const doctorsService = {
  getStats: async () => {
    try {
      const response = await api.get('/doctors/stats');
      return { success: true, data: response.data?.data || response.data };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  getDoctors: async (params) => {
    try {
      const response = await api.get('/doctors', { params });
      return { success: true, data: response.data?.data || response.data };
    } catch (error) {
      return { success: false, message: error.message, data: [] };
    }
  },

  getDoctorById: async (id) => {
    try {
      const response = await api.get(`/doctors/${id}`);
      return { success: true, data: response.data?.data || response.data };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  createDoctor: async (data) => {
    try {
      const response = await api.post('/doctors', data);
      return { success: true, data: response.data?.data || response.data };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  updateDoctor: async (id, data) => {
    try {
      const response = await api.put(`/doctors/${id}`, data);
      return { success: true, data: response.data?.data || response.data };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  deleteDoctor: async (id) => {
    try {
      const response = await api.delete(`/doctors/${id}`);
      return { success: true, data: response.data?.data || response.data };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },
};

export default doctorsService;
