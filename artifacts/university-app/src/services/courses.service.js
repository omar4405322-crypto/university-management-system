import api from './api';

const coursesService = {
  getCourses: async (params) => {
    try {
      const response = await api.get('/courses', { params });
      return { success: true, data: response.data?.data || response.data };
    } catch (error) {
      return { success: false, message: error.message, data: [] };
    }
  },

  getCourseById: async (id) => {
    try {
      const response = await api.get(`/courses/${id}`);
      return { success: true, data: response.data?.data || response.data };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  getCourseRoster: async (id) => {
    try {
      const response = await api.get(`/courses/${id}/roster`);
      return { success: true, data: response.data?.data || response.data };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  createCourse: async (data) => {
    try {
      const response = await api.post('/courses', data);
      return { success: true, data: response.data?.data || response.data };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  updateCourse: async (id, data) => {
    try {
      const response = await api.put(`/courses/${id}`, data);
      return { success: true, data: response.data?.data || response.data };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  deleteCourse: async (id) => {
    try {
      const response = await api.delete(`/courses/${id}`);
      return { success: true, data: response.data?.data || response.data };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },
};

export default coursesService;
