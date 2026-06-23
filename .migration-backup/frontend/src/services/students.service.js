import api from './api';

const studentsService = {
  getStudents: async (params) => {
    try {
      const response = await api.get('/students', { params });
      return { success: true, data: response.data?.data || response.data };
    } catch (error) {
      return { success: false, message: error.message, data: [] };
    }
  },

  getStudentById: async (id) => {
    try {
      const response = await api.get(`/students/${id}`);
      return { success: true, data: response.data?.data || response.data };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  createStudent: async (data) => {
    try {
      const response = await api.post('/students', data);
      return { success: true, data: response.data?.data || response.data };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  updateStudent: async (id, data) => {
    try {
      const response = await api.put(`/students/${id}`, data);
      return { success: true, data: response.data?.data || response.data };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  deleteStudent: async (id) => {
    try {
      const response = await api.delete(`/students/${id}`);
      return { success: true, data: response.data?.data || response.data };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  toggleStatus: async (id) => {
    try {
      const response = await api.patch(`/students/${id}/status`);
      return { success: true, data: response.data?.data || response.data };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },
};

export default studentsService;
