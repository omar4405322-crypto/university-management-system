import api from './api';

const departmentService = {
  getDepartments: async (params) => {
    try {
      const response = await api.get('/departments', { params });
      return { success: true, data: response.data?.data || response.data };
    } catch (error) {
      return { success: false, message: error.message, data: [] };
    }
  },

  getDepartmentById: async (id) => {
    try {
      const response = await api.get(`/departments/${id}`);
      return { success: true, data: response.data?.data || response.data };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  createDepartment: async (data) => {
    try {
      const response = await api.post('/departments', data);
      return { success: true, data: response.data?.data || response.data };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  updateDepartment: async (id, data) => {
    try {
      const response = await api.put(`/departments/${id}`, data);
      return { success: true, data: response.data?.data || response.data };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  deleteDepartment: async (id) => {
    try {
      const response = await api.delete(`/departments/${id}`);
      return { success: true, data: response.data?.data || response.data };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },
};

export default departmentService;
