import { apiRequest } from '../lib/apiClient';
import type { ApiResponse } from '../types/models';
import api from './api';

const quizService = {
  getQuizzes: (params?: Record<string, unknown>): Promise<ApiResponse<any>> => apiRequest(() => api.get('/quizzes', { params })),

  getQuizById: (id: string): Promise<ApiResponse<any>> => apiRequest(() => api.get(`/quizzes/${id}`)),

  createQuiz: (data?: Record<string, unknown>): Promise<ApiResponse<any>> => apiRequest(() => api.post('/quizzes', data)),

  submitQuiz: (id: string, answers: Record<string, unknown>): Promise<ApiResponse<any>> => apiRequest(() => api.post(`/quizzes/${id}/submit`, { answers })),

  getQuizSubmissions: (id: string): Promise<ApiResponse<any>> => apiRequest(() => api.get(`/quizzes/${id}/results`)),
};

export default quizService;
