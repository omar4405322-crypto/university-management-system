import { apiRequest } from '../lib/apiClient';
import type { ApiResponse } from '../types/models';
import api from './api';

const departmentService = {
  getDepartments: (
    params: Record<string, unknown> = {},
    options: Record<string, unknown> = {}
  ): Promise<ApiResponse<any>> => apiRequest(() => api.get('/departments', { params, ...options })),

  getDepartmentsByCollege: async (collegeId: string | number) => {
    const url = `/departments?collegeId=${collegeId}`;
    console.log(`[DEBUG] Calling URL: GET /api${url}`);
    const response = await api.get(url);
    console.log(`[DEBUG] Response from ${url}:`, response.data);
    return { success: true, data: response.data?.data || response.data };
  },

  getDepartmentById: (id: string): Promise<ApiResponse<any>> => apiRequest(() => api.get(`/departments/${id}`)),

  createDepartment: (data?: Record<string, unknown>): Promise<ApiResponse<any>> => apiRequest(() => api.post('/departments', data)),

  updateDepartment: (id: string, data: Record<string, unknown>): Promise<ApiResponse<any>> => apiRequest(() => api.put(`/departments/${id}`, data)),

  deleteDepartment: (id: string): Promise<ApiResponse<any>> => apiRequest(() => api.delete(`/departments/${id}`)),
};

export default departmentService;
