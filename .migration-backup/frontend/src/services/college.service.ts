import { apiRequest } from '../lib/apiClient';
import type { ApiResponse } from '../types/models';
import api from './api';

const collegeService = {
  getColleges: (
    params: Record<string, unknown> = {},
    options: Record<string, unknown> = {}
  ): Promise<ApiResponse<any>> => apiRequest(() => api.get('/colleges', { params, ...options })),

  getCollegeById: (id: string | number): Promise<ApiResponse<any>> => apiRequest(() => api.get(`/colleges/${id}`)),

  createCollege: async (data?: Record<string, unknown>) => {
    const response = await api.post('/colleges', data);
    return { success: true, data: response.data?.data || response.data };
  },

  updateCollege: async (id: string | number, data: Record<string, unknown>) => {
    const response = await api.put(`/colleges/${id}`, data);
    return { success: true, data: response.data?.data || response.data };
  },

  assignAdmin: async (collegeId: string | number, adminId: string | number) => {
    const response = await api.put(`/colleges/${collegeId}/assign-admin`, { adminId });
    return { success: true, data: response.data?.data || response.data };
  },

  deleteCollege: async (id: string | number) => {
    const response = await api.delete(`/colleges/${id}`);
    return { success: true, data: response.data?.data || response.data };
  },
};

export default collegeService;
