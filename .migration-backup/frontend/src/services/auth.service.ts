import { apiRequest } from '../lib/apiClient';
import type { ApiResponse } from '../types/models';
import api from './api';

const authService = {
  getRequests: (): Promise<ApiResponse<any>> => apiRequest(() => api.get('/auth/requests')),

  approveRequest: (id: string): Promise<ApiResponse<any>> => apiRequest(() => api.put(`/auth/requests/${id}/approve`)),

  rejectRequest: (id: string): Promise<ApiResponse<any>> => apiRequest(() => api.put(`/auth/requests/${id}/reject`)),
};

export default authService;
