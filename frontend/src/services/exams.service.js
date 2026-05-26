import api from './api';

const examsService = {
  getExams: async (params) => {
    const response = await api.get('/exams', { params });
    return response.data;
  },

  getUpcomingExams: async () => {
    const response = await api.get('/exams/upcoming');
    return response.data;
  },

  createExam: async (data) => {
    const response = await api.post('/exams', data);
    return response.data;
  },

  updateExam: async (id, data) => {
    const response = await api.put(`/exams/${id}`, data);
    return response.data;
  },

  deleteExam: async (id) => {
    const response = await api.delete(`/exams/${id}`);
    return response.data;
  },
};

export default examsService;
