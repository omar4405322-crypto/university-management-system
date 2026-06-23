import api from './api';

const taskService = {
  getTasks: async (params) => {
    const response = await api.get('/tasks', { params });
    return response.data;
  },

  createTask: async (data) => {
    const response = await api.post('/tasks', data);
    return response.data;
  },

  submitTask: async (id, data) => {
    // data can be { fileUrl, notes }
    const response = await api.post(`/tasks/${id}/submit`, data);
    return response.data;
  },

  gradeSubmission: async (id, submissionId, data) => {
    // data is { score }
    const response = await api.put(`/tasks/${id}/submissions/${submissionId}/grade`, data);
    return response.data;
  },

  getTaskSubmissions: async (id) => {
    const response = await api.get(`/tasks/${id}/submissions`);
    return response.data;
  },
};

export default taskService;
