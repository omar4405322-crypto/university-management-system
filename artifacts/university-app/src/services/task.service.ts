
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
  page?: number;
  limit?: number;
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

  createTask: (data?: Record<string, unknown> | object): Promise<ApiResponse<any>> =>
    apiRequest(() => api.post('/tasks', data)),

  updateTask: (
    id: number | string,
    data: Record<string, unknown> | object
  ): Promise<ApiResponse<any>> =>
    apiRequest(() => api.put(`/tasks/${id}`, data)),

  deleteTask: (
    id: number | string, force?: boolean): Promise<ApiResponse<any>> =>
    apiRequest(() =>
      api.delete(`/tasks/${id}`, { params: force ? { force: 'true' } : {} })
    ),

  submitTask: (
    id: number | string,
    data: Record<string, unknown> | object | FormData
  ): Promise<ApiResponse<any>> =>
    apiRequest(() =>
      api.post(`/tasks/${id}/submit`, data, {
        headers:
          typeof FormData !== 'undefined' && data instanceof FormData
            ? { 'Content-Type': 'multipart/form-data' }
            : undefined,
      })
    ),

  downloadSubmission: async (
    taskId: number | string,
    submissionId: number | string,
    fileName?: string
  ): Promise<void> => {
    try {
      const response = await api.get(
        `/tasks/${taskId}/submissions/${submissionId}/download`,
        {
          responseType: 'blob',
        }
      );
      const contentType = response.headers['content-type'];
      const blob = new Blob([response.data], {
        type: typeof contentType === 'string' ? contentType : 'application/octet-stream',
      });
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName || 'submission_file';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: unknown; status?: number } };
      if (axiosErr?.response?.data instanceof Blob) {
        try {
          const text = await (axiosErr.response.data as Blob).text();
          const parsed = JSON.parse(text) as { message?: string; error?: string };
          const msg =
            parsed.message ||
            parsed.error ||
            `Download failed with status ${axiosErr.response.status}`;
          const error = new Error(msg);
          (error as any).status = axiosErr.response.status;
          throw error;
        } catch (e: unknown) {
          if (e instanceof Error && e.message && !e.message.includes('JSON')) throw e;
        }
      }
      throw err;
    }
  },

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
