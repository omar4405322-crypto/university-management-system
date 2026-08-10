
import { apiRequest } from '../lib/apiClient';
import type { ApiResponse } from '../types/models';
import api from './api';

export type GetTasksParams = {
  courseId?: number;
  status?: 'ACTIVE' | 'OVERDUE';
  dueFrom?: string;
  dueTo?: string;
  sortBy?:
    | 'DUE_DATE_ASC'
    | 'DUE_DATE_DESC'
    | 'CREATED_AT_ASC'
    | 'CREATED_AT_DESC'
    | 'SUBMISSIONS_COUNT_ASC'
    | 'SUBMISSIONS_COUNT_DESC';
  search?: string;
  year?: number;
};

export type SubmissionsStatus =
  | 'ALL'
  | 'SUBMITTED'
  | 'GRADED'
  | 'UNGRADED'
  | 'LATE'
  | 'NOT_SUBMITTED';

export type GetTaskSubmissionsParams = {
  page?: number;
  limit?: number;
  search?: string;
  status?: SubmissionsStatus;
  studentYear?: number;
};

const taskService = {
  getTasks: (params?: GetTasksParams): Promise<ApiResponse<any>> =>
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

  getTaskSubmissions: (
    id: number | string,
    params?: GetTaskSubmissionsParams
  ): Promise<ApiResponse<any>> =>
    apiRequest(() => api.get(`/tasks/${id}/submissions`, { params })),

  getMySubmission: (id: number | string): Promise<ApiResponse<any>> =>
    apiRequest(() => api.get(`/tasks/${id}/submission`)),
};

export default taskService;
