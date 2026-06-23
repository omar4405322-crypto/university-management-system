import { apiRequest } from '../lib/apiClient';
import type { ApiResponse } from '../types/models';
import api from './api';

const quizService = {
  getQuizzes: (params?: Record<string, unknown>): Promise<ApiResponse<any>> => apiRequest(() => api.get('/quizzes', { params })),

  getQuizById: (id: string): Promise<ApiResponse<any>> => apiRequest(() => api.get(`/quizzes/${id}`)),

  createQuiz: (data?: Record<string, unknown>): Promise<ApiResponse<any>> => apiRequest(() => api.post('/quizzes', data)),

  submitQuiz: (id: string, answers: Record<string, unknown>): Promise<ApiResponse<any>> => apiRequest(() => api.post(`/quizzes/${id}/submit`, { answers })),

  getQuizSubmissions: (id: string): Promise<ApiResponse<any>> => apiRequest(() => api.get(`/quizzes/${id}/results`)),

  addQuestion: (quizId: number, data: Record<string, unknown>): Promise<ApiResponse<any>> =>
    apiRequest(() => api.post(`/quizzes/${quizId}/questions`, data)),

  uploadAnswerFile: (quizId: number, questionId: number, file: File): Promise<ApiResponse<any>> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('questionId', String(questionId));
    return apiRequest(() => api.post(`/quizzes/${quizId}/upload-answer`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }));
  },

  gradeSubmission: (quizId: number, submissionId: number, data: Record<string, unknown>): Promise<ApiResponse<any>> =>
    apiRequest(() => api.put(`/quizzes/${quizId}/submissions/${submissionId}/grade`, data)),
};

export default quizService;
