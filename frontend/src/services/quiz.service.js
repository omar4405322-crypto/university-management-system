import api from './api';

const quizService = {
  getQuizzes: async (params) => {
    const response = await api.get('/quizzes', { params });
    return response.data;
  },

  getQuizById: async (id) => {
    const response = await api.get(`/quizzes/${id}`);
    return response.data;
  },

  createQuiz: async (data) => {
    const response = await api.post('/quizzes', data);
    return response.data;
  },

  submitQuiz: async (id, answers) => {
    const response = await api.post(`/quizzes/${id}/submit`, { answers });
    return response.data;
  },

  getQuizSubmissions: async (id) => {
    const response = await api.get(`/quizzes/${id}/results`);
    return response.data;
  },
};

export default quizService;
