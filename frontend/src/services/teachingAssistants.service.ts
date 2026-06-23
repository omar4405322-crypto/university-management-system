import { apiRequest } from '../lib/apiClient';
import type { ApiResponse } from '../types/models';
import api from './api';

const teachingAssistantsService = {
  getStats: (): Promise<ApiResponse<any>> => apiRequest(() => api.get('/teaching-assistants/stats')),

  getTeachingAssistants: (params?: Record<string, unknown>): Promise<ApiResponse<any>> => apiRequest(() => api.get('/teaching-assistants', { params })),

  getTeachingAssistantById: (id: string): Promise<ApiResponse<any>> => apiRequest(() => api.get(`/teaching-assistants/${id}`)),

  createTeachingAssistant: (data?: Record<string, unknown>): Promise<ApiResponse<any>> => apiRequest(() => api.post('/teaching-assistants', data)),

  updateTeachingAssistant: (id: string, data: Record<string, unknown>): Promise<ApiResponse<any>> => apiRequest(() => api.put(`/teaching-assistants/${id}`, data)),

  deleteTeachingAssistant: (id: string): Promise<ApiResponse<any>> => apiRequest(() => api.delete(`/teaching-assistants/${id}`)),
};

export default teachingAssistantsService;
