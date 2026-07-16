import { apiRequest } from '../lib/apiClient';
import type { ApiResponse } from '../types/models';
import api from './api';

const departmentService = {
  getDepartments: (
    params: Record<string, unknown> = {},
    options: Record<string, unknown> = {}
  ): Promise<ApiResponse<any>> => apiRequest(() => api.get('/departments', { params, ...options })),

  getDepartmentById: (id: string): Promise<ApiResponse<any>> => apiRequest(() => api.get(`/departments/${id}`)),

  getDepartmentsByCollege: (collegeId: string): Promise<ApiResponse<any>> => 
    apiRequest(() => api.get('/departments', { params: { collegeId } })),

  createDepartment: (data?: Record<string, unknown>): Promise<ApiResponse<any>> => apiRequest(() => api.post('/departments', data)),

  updateDepartment: (id: string, data: Record<string, unknown>): Promise<ApiResponse<any>> => apiRequest(() => api.put(`/departments/${id}`, data)),

  deleteDepartment: (id: string): Promise<ApiResponse<any>> => apiRequest(() => api.delete(`/departments/${id}`)),

  autoDivideStudents: (departmentId: string, numberOfGroups: number): Promise<ApiResponse<any>> =>
    apiRequest(() => api.post(`/student-groups/${departmentId}/auto-divide`, { numberOfGroups })),
};

export default departmentService;
