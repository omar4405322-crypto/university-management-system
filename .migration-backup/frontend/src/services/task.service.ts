import { apiRequest } from '../lib/apiClient';
import type { ApiResponse } from '../types/models';
import api from './api';

const taskService = {
  getTasks: (params?: Record<string, unknown>): Promise<ApiResponse<any>> => apiRequest(() => api.get('/tasks', { params })),

  createTask: (data?: Record<string, unknown>): Promise<ApiResponse<any>> => apiRequest(() => api.post('/tasks', data)),

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

  getTaskSubmissions: (id: string): Promise<ApiResponse<any>> => apiRequest(() => api.get(`/tasks/${id}/submissions`)),
};

export default taskService;
