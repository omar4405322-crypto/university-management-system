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

  uploadCourseMaterial: (id: string, formData: FormData): Promise<ApiResponse<any>> =>
    apiRequest(() =>
      api.post(`/courses/${id}/materials`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    ),

  deleteCourseMaterial: (id: string, materialId: number): Promise<ApiResponse<any>> =>
    apiRequest(() => api.delete(`/courses/${id}/materials/${materialId}`)),

  toggleCourseMaterial: (id: string, materialId: number): Promise<ApiResponse<any>> =>
    apiRequest(() => api.patch(`/courses/${id}/materials/${materialId}/toggle`)),

  toggleCoursePublication: (id: string): Promise<ApiResponse<any>> =>
    apiRequest(() => api.patch(`/courses/${id}/toggle-publication`)),
};

export default coursesService;
