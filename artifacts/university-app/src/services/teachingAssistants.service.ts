import { apiRequest } from '../lib/apiClient';
import type { ApiResponse } from '../types/models';
import api from './api';

const teachingAssistantsService = {
  getStats: (): Promise<ApiResponse<any>> => apiRequest(() => api.get('/teaching-assistants/stats')),

  getTeachingAssistants: (params?: Record<string, unknown>): Promise<ApiResponse<any>> => apiRequest(() => api.get('/teaching-assistants', { params })),
  
  getSuggestedTeachingAssistants: (courseId: string | number): Promise<ApiResponse<any>> => apiRequest(() => api.get(`/teaching-assistants/suggested`, { params: { courseId } })),

  getTeachingAssistantById: (id: string): Promise<ApiResponse<any>> => apiRequest(() => api.get(`/teaching-assistants/${id}`)),

  createTeachingAssistant: (data?: Record<string, unknown>): Promise<ApiResponse<any>> => apiRequest(() => api.post('/teaching-assistants', data)),

  updateTeachingAssistant: (id: string, data: Record<string, unknown>): Promise<ApiResponse<any>> => apiRequest(() => api.put(`/teaching-assistants/${id}`, data)),

  deleteTeachingAssistant: (id: string): Promise<ApiResponse<any>> => apiRequest(() => api.delete(`/teaching-assistants/${id}`)),

  assignToDoctor: (id: string, doctorId: number): Promise<ApiResponse<any>> => apiRequest(() => api.post(`/teaching-assistants/${id}/assign`, { doctorId })),

  unassignFromDoctor: (id: string, doctorId: number): Promise<ApiResponse<any>> => apiRequest(() => api.delete(`/teaching-assistants/${id}/assign/${doctorId}`)),
};

export default teachingAssistantsService;
