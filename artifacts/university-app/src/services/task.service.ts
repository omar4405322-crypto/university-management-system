// @ts-nocheck
import { apiRequest } from '../lib/apiClient';
import type { ApiResponse } from '../types/models';
import api from './api';

const taskService = {
  getTasks: (params?: Record<string, unknown>): Promise<ApiResponse<any>> =>
    apiRequest(() => api.get('/tasks', { params })),

  createTask: (data?: Record<string, unknown>): Promise<ApiResponse<any>> =>
    apiRequest(() => api.post('/tasks', data)),

  updateTask: (
    id: number | string,
    data: Record<string, unknown>
  ): Promise<ApiResponse<any>> =>
    apiRequest(() => api.put(`/tasks/${id}`, data)),

  deleteTask: (
    id: number | string, force?: boolean): Promise<ApiResponse<any>> =>
    apiRequest(() =>
      api.delete(`/tasks/${id}`, { params: force ? { force: 'true' } : {} })
    ),

  submitTask: (
    id: number | string, data: Record<string, unknown>): Promise<ApiResponse<any>> =>
    apiRequest(() => api.post(`/tasks/${id}/submit`, data)),

  gradeSubmission: (
    id: number | string,
    submissionId: number | string,
    data: Record<string, unknown>
  ): Promise<ApiResponse<any>> =>
    apiRequest(() =>
      api.put(`/tasks/${id}/submissions/${submissionId}/grade`, data)
    ),

  getTaskSubmissions: (id: number | string): Promise<ApiResponse<any>> =>
    apiRequest(() => api.get(`/tasks/${id}/submissions`)),

  getMySubmission: (id: number | string): Promise<ApiResponse<any>> =>
    apiRequest(() => api.get(`/tasks/${id}/submission`)),
};

export default taskService;
