import { apiRequest } from '../lib/apiClient';
import type { ApiResponse } from '../types/models';
import api from './api';

const registrationService = {
  getRequests: (): Promise<ApiResponse<any>> => apiRequest(() => api.get('/auth/requests')),

  approveRequest: (id: string | number): Promise<ApiResponse<any>> => apiRequest(() => api.put(`/auth/requests/${id}/approve`, {})),

  rejectRequest: (id: string | number): Promise<ApiResponse<any>> => apiRequest(() => api.put(`/auth/requests/${id}/reject`, {})),
};

export default registrationService;
