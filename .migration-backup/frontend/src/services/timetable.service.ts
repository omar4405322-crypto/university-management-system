// @ts-nocheck
import { apiRequest } from '../lib/apiClient';
import type { ApiResponse } from '../types/models';
import api from './api';

const timetableService = {
  getTimetables: async (params: Record<string, unknown> = {}) => {
    let { page = 1, limit = 10, ...filters } = params;
    // Extract page if it is passed as an object (e.g. { page: 1 })
    if (typeof page === 'object' && page !== null) {
            page = page.page || 1;
    }
    const response = await api.get('/timetable', { params: { ...filters, page, limit } });
    return response.data;
  },

  getTimetableById: (id: string): Promise<ApiResponse<any>> => apiRequest(() => api.get(`/timetable/${id}`)),

  createTimetable: (data?: Record<string, unknown>): Promise<ApiResponse<any>> => apiRequest(() => api.post('/timetable', data)),

  updateTimetable: (id: string, data: Record<string, unknown>): Promise<ApiResponse<any>> => apiRequest(() => api.put(`/timetable/${id}`, data)),

  deleteTimetable: (id: string): Promise<ApiResponse<any>> => apiRequest(() => api.delete(`/timetable/${id}`)),

  publishTimetable: (id: string): Promise<ApiResponse<any>> => apiRequest(() => api.patch(`/timetable/${id}/publish`)),

  unpublishTimetable: (id: string): Promise<ApiResponse<any>> => apiRequest(() => api.patch(`/timetable/${id}/unpublish`)),
};

export default timetableService;
