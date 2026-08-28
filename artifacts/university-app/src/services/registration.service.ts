import { apiRequest } from '../lib/apiClient';
import type { ApiResponse } from '../types/models';
import api from './api';

const registrationService = {
  getRequests: (): Promise<ApiResponse<any>> => apiRequest(() => api.get('/auth/requests')),

  approveRequest: (id: string | number): Promise<ApiResponse<any>> => apiRequest(() => api.put(`/auth/requests/${id}/approve`, {})),

  rejectRequest: (id: string | number, reason?: string): Promise<ApiResponse<any>> =>
    apiRequest(() => api.put(`/auth/requests/${id}/reject`, { reason })),

  deleteRequest: (id: string | number): Promise<ApiResponse<any>> =>
    apiRequest(() => api.delete(`/auth/requests/${id}`)),
};

export default registrationService;
