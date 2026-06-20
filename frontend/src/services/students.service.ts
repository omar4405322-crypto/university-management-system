import { apiRequest } from '../lib/apiClient';
import type { ApiResponse } from '../types/models';
import api from './api';

const studentsService = {
  getStudents: (params?: Record<string, unknown>): Promise<ApiResponse<any>> => apiRequest(() => api.get('/students', { params })),

  getStudentById: (id: string): Promise<ApiResponse<any>> => apiRequest(() => api.get(`/students/${id}`)),

  createStudent: (data?: Record<string, unknown>): Promise<ApiResponse<any>> => apiRequest(() => api.post('/students', data)),

  updateStudent: (id: string, data: Record<string, unknown>): Promise<ApiResponse<any>> => apiRequest(() => api.put(`/students/${id}`, data)),

  deleteStudent: (id: string): Promise<ApiResponse<any>> => apiRequest(() => api.delete(`/students/${id}`)),

  toggleStatus: (id: string): Promise<ApiResponse<any>> => apiRequest(() => api.patch(`/students/${id}/status`)),
};

export default studentsService;
