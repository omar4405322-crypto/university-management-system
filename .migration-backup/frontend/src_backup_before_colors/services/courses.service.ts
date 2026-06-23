import { apiRequest } from '../lib/apiClient';
import type { ApiResponse } from '../types/models';
import api from './api';

const coursesService = {
  getCourses: (params?: Record<string, unknown>): Promise<ApiResponse<any>> => apiRequest(() => api.get('/courses', { params })),

  getCourseById: (id: string): Promise<ApiResponse<any>> => apiRequest(() => api.get(`/courses/${id}`)),

  getCourseRoster: (id: string): Promise<ApiResponse<any>> => apiRequest(() => api.get(`/courses/${id}/roster`)),

  createCourse: (data?: Record<string, unknown>): Promise<ApiResponse<any>> => apiRequest(() => api.post('/courses', data)),

  updateCourse: (id: string, data: Record<string, unknown>): Promise<ApiResponse<any>> => apiRequest(() => api.put(`/courses/${id}`, data)),

  deleteCourse: (id: string): Promise<ApiResponse<any>> => apiRequest(() => api.delete(`/courses/${id}`)),
};

export default coursesService;
