import { apiRequest } from '../lib/apiClient';
import type { ApiResponse } from '../types/models';
import api from './api';

const examsService = {
  getExams: (params?: Record<string, unknown>): Promise<ApiResponse<any>> => apiRequest(() => api.get('/exams', { params })),

  getUpcomingExams: (): Promise<ApiResponse<any>> => apiRequest(() => api.get('/exams/upcoming')),

  getExamById: (id: string | number): Promise<ApiResponse<any>> => apiRequest(() => api.get(`/exams/${id}`)),

  createExam: (data?: Record<string, unknown>): Promise<ApiResponse<any>> => apiRequest(() => api.post('/exams', data)),

  updateExam: (id: string | number, data: Record<string, unknown>): Promise<ApiResponse<any>> => apiRequest(() => api.put(`/exams/${id}`, data)),

  deleteExam: (id: string | number): Promise<ApiResponse<any>> => apiRequest(() => api.delete(`/exams/${id}`), { preferRawMessage: true }),

  getExamQuestions: (examId: string | number): Promise<ApiResponse<any>> => apiRequest(() => api.get(`/exams/${examId}/questions`)),

  addExamQuestion: (examId: string | number, data: Record<string, unknown>): Promise<ApiResponse<any>> => apiRequest(() => api.post(`/exams/${examId}/questions`, data), { preferRawMessage: true }),

  updateExamQuestion: (questionId: string | number, data: Record<string, unknown>): Promise<ApiResponse<any>> => apiRequest(() => api.put(`/exams/questions/${questionId}`, data), { preferRawMessage: true }),

  deleteExamQuestion: (questionId: string | number): Promise<ApiResponse<any>> => apiRequest(() => api.delete(`/exams/questions/${questionId}`), { preferRawMessage: true }),

  startExamSession: (examId: string | number, data?: Record<string, unknown>): Promise<ApiResponse<any>> => apiRequest(() => api.post(`/exams/${examId}/start`, data)),

  submitExam: (examId: string | number, data: Record<string, unknown>): Promise<ApiResponse<any>> => apiRequest(() => api.post(`/exams/${examId}/submit`, data)),

  getExamSubmissions: (examId: string | number): Promise<ApiResponse<any>> => apiRequest(() => api.get(`/exams/${examId}/submissions`)),

  getMyExamSubmission: (examId: string | number): Promise<ApiResponse<any>> => apiRequest(() => api.get(`/exams/${examId}/my-submission`)),

  gradeSubmission: (submissionId: string | number, score: number): Promise<ApiResponse<any>> => apiRequest(() => api.put(`/exams/submissions/${submissionId}/grade`, { score })),

  // ── Anti-Cheat Endpoints ──────────────────────────────────────────────────
  reportDeviceInfo: (_examId: string, _deviceInfo: Record<string, unknown>): Promise<ApiResponse<any>> =>
    Promise.resolve({ success: true, data: null }),

  ingestViolation: (examId: string | number, submissionId: string | number, data: Record<string, unknown>): Promise<ApiResponse<any>> =>
    apiRequest(() => api.post(`/exams/${examId}/submissions/${submissionId}/violations`, data)),

  getViolationSequence: (examId: string | number, submissionId: string | number): Promise<ApiResponse<{ sequence: number }>> =>
    apiRequest(() => api.get(`/exams/${examId}/submissions/${submissionId}/violations/sequence`)),

  cancelExam: (examId: string, data?: Record<string, unknown> | string): Promise<ApiResponse<any>> => {
    const payload = typeof data === 'string' ? { reason: data } : (data || {});
    return apiRequest(() => api.post(`/exams/${examId}/cancel`, payload));
  },
};

export default examsService;
