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

  getExamQuestions: (examId: string): Promise<ApiResponse<any>> => apiRequest(() => api.get(`/exams/${examId}/questions`)),

  addExamQuestion: (examId: string, data: Record<string, unknown>): Promise<ApiResponse<any>> => apiRequest(() => api.post(`/exams/${examId}/questions`, data)),

  updateExamQuestion: (questionId: string, data: Record<string, unknown>): Promise<ApiResponse<any>> => apiRequest(() => api.put(`/exams/questions/${questionId}`, data)),

  deleteExamQuestion: (questionId: string): Promise<ApiResponse<any>> => apiRequest(() => api.delete(`/exams/questions/${questionId}`)),

  startExamSession: (examId: string): Promise<ApiResponse<any>> => apiRequest(() => api.post(`/exams/${examId}/start`)),

  submitExam: (examId: string, data: Record<string, unknown>): Promise<ApiResponse<any>> => apiRequest(() => api.post(`/exams/${examId}/submit`, data)),

  getExamSubmissions: (examId: string): Promise<ApiResponse<any>> => apiRequest(() => api.get(`/exams/${examId}/submissions`)),

  getMyExamSubmission: (examId: string): Promise<ApiResponse<any>> => apiRequest(() => api.get(`/exams/${examId}/my-submission`)),
};

export default examsService;
