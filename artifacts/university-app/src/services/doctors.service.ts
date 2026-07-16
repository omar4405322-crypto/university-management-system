import { apiRequest } from '../lib/apiClient';
import type { ApiResponse } from '../types/models';
import api from './api';

const doctorsService = {
  getStats: (): Promise<ApiResponse<any>> => apiRequest(() => api.get('/doctors/stats')),

  getDoctors: (params?: Record<string, unknown>): Promise<ApiResponse<any>> => apiRequest(() => api.get('/doctors', { params })),
  
  getSuggestedDoctors: (courseId: string | number): Promise<ApiResponse<any>> => apiRequest(() => api.get(`/doctors/suggested`, { params: { courseId } })),

  getDoctorById: (id: string): Promise<ApiResponse<any>> => apiRequest(() => api.get(`/doctors/${id}`)),

  createDoctor: (data?: Record<string, unknown>): Promise<ApiResponse<any>> => apiRequest(() => api.post('/doctors', data)),

  updateDoctor: (id: string, data: Record<string, unknown>): Promise<ApiResponse<any>> => apiRequest(() => api.put(`/doctors/${id}`, data)),

  deleteDoctor: (id: string): Promise<ApiResponse<any>> => apiRequest(() => api.delete(`/doctors/${id}`)),
};

export default doctorsService;
