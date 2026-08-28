import { apiRequest } from '../lib/apiClient';
import type { ApiResponse } from '../types/models';
import type { TimetableItem } from '../pages/schedules/TimetableManagement';
import type { TimetableDocument } from '../types/timetable.types';
import api from './api';

export interface TimetableQueryParams {
  page?: number | { page?: number };
  limit?: number;
  collegeId?: number | string;
  departmentId?: number | string;
  academicYear?: number | string;
  semester?: number | string;
  status?: string;
  [key: string]: unknown;
}

export interface TimetablePaginatedData {
  timetables: TimetableItem[];
  total?: number;
  page?: number;
  totalPages?: number;
}

const timetableService = {
  getTimetables: async (
    params: TimetableQueryParams = {}
  ): Promise<ApiResponse<any>> => {
    let { page = 1, limit = 10, ...filters } = params;
    // Extract page if it is passed as an object (e.g. { page: 1 })
    if (typeof page === 'object' && page !== null) {
      page = (page as { page?: number }).page || 1;
    }
    return apiRequest(() => api.get('/timetable', { params: { ...filters, page, limit } }));
  },

  getTimetableById: (id: string | number): Promise<ApiResponse<TimetableDocument | TimetableItem>> =>
    apiRequest(() => api.get(`/timetable/${id}`)),

  createTimetable: (data?: Record<string, unknown>): Promise<ApiResponse<TimetableItem>> =>
    apiRequest(() => api.post('/timetable', data)),

  updateTimetable: (id: string | number, data: Record<string, unknown>): Promise<ApiResponse<TimetableItem>> =>
    apiRequest(() => api.put(`/timetable/${id}`, data)),

  deleteTimetable: (id: string | number): Promise<ApiResponse<{ success?: boolean; message?: string }>> =>
    apiRequest(() => api.delete(`/timetable/${id}`)),

  publishTimetable: (id: string | number): Promise<ApiResponse<TimetableItem>> =>
    apiRequest(() => api.patch(`/timetable/${id}/publish`)),

  unpublishTimetable: (id: string | number): Promise<ApiResponse<TimetableItem>> =>
    apiRequest(() => api.patch(`/timetable/${id}/unpublish`)),
};

export default timetableService;
