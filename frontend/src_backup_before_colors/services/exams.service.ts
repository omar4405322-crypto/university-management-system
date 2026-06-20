import { apiRequest } from '../lib/apiClient';
import type { ApiResponse } from '../types/models';
import api from './api';

const examsService = {
  getExams: (params?: Record<string, unknown>): Promise<ApiResponse<any>> => apiRequest(() => api.get('/exams', { params })),

  getUpcomingExams: (): Promise<ApiResponse<any>> => apiRequest(() => api.get('/exams/upcoming')),

  getExamById: (id: string): Promise<ApiResponse<any>> => apiRequest(() => api.get(`/exams/${id}`)),

  createExam: (data?: Record<string, unknown>): Promise<ApiResponse<any>> => apiRequest(() => api.post('/exams', data)),

  updateExam: (id: string, data: Record<string, unknown>): Promise<ApiResponse<any>> => apiRequest(() => api.put(`/exams/${id}`, data)),

  deleteExam: (id: string): Promise<ApiResponse<any>> => apiRequest(() => api.delete(`/exams/${id}`)),
};

export default examsService;
