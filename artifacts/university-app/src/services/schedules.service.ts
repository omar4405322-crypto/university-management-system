import { apiRequest } from '../lib/apiClient';
import type { ApiResponse } from '../types/models';
import api from './api';

const schedulesService = {
  getSchedules: (params?: Record<string, unknown>): Promise<ApiResponse<any>> => apiRequest(() => api.get('/schedules', { params })),

  getWeeklyTimetable: (params: Record<string, unknown> = {}): Promise<ApiResponse<any>> => apiRequest(() => api.get('/schedules/week', { params })),

  getAllWeeklyTimetable: async (params: Record<string, unknown> = {}): Promise<ApiResponse<any[]>> => {
    let currentPage = 1;
    const limit = 100;
    let accumulated: any[] = [];
    let totalPages = 1;
    let total = 0;

    do {
      const res = await apiRequest<any>(() =>
        api.get('/schedules/week', {
          params: { ...params, page: currentPage, limit },
        })
      );
      if (!res.success) {
        return res;
      }
      const pageData = Array.isArray(res.data)
        ? res.data
        : (res.data as any)?.schedules || (res.data as any)?.data || [];
      accumulated = accumulated.concat(pageData);
      totalPages = res.pagination?.totalPages ?? 1;
      total = res.pagination?.total ?? accumulated.length;
      currentPage += 1;
    } while (currentPage <= totalPages);

    return {
      success: true,
      data: accumulated,
      pagination: {
        page: 1,
        limit: accumulated.length,
        total,
        totalPages: 1,
      },
    };
  },

  getAllSchedules: async (params: Record<string, unknown> = {}): Promise<ApiResponse<any[]>> => {
    let currentPage = 1;
    const limit = 100;
    let accumulated: any[] = [];
    let totalPages = 1;
    let total = 0;

    do {
      const res = await apiRequest<any>(() =>
        api.get('/schedules', {
          params: { ...params, page: currentPage, limit },
        })
      );
      if (!res.success) {
        return res;
      }
      const pageData = Array.isArray(res.data)
        ? res.data
        : (res.data as any)?.schedules || (res.data as any)?.data || [];
      accumulated = accumulated.concat(pageData);
      totalPages = res.pagination?.totalPages ?? 1;
      total = res.pagination?.total ?? accumulated.length;
      currentPage += 1;
    } while (currentPage <= totalPages);

    return {
      success: true,
      data: accumulated,
      pagination: {
        page: 1,
        limit: accumulated.length,
        total,
        totalPages: 1,
      },
    };
  },

  createSchedule: (data?: Record<string, unknown>): Promise<ApiResponse<any>> => apiRequest(() => api.post('/schedules', data)),

  updateSchedule: (id: string, data: Record<string, unknown>): Promise<ApiResponse<any>> => apiRequest(() => api.put(`/schedules/${id}`, data)),

  deleteSchedule: (id: string): Promise<ApiResponse<any>> => apiRequest(() => api.delete(`/schedules/${id}`)),

  archiveSchedule: (id: string): Promise<ApiResponse<any>> => apiRequest(() => api.post(`/schedules/${id}/archive`)),

  restoreSchedule: (id: string): Promise<ApiResponse<any>> => apiRequest(() => api.post(`/schedules/${id}/restore`)),

  syncGrid: (data: Record<string, unknown>): Promise<ApiResponse<any>> => apiRequest(() => api.post('/schedules/sync-grid', data)),

  checkConflict: (data: Record<string, unknown>): Promise<ApiResponse<any>> => apiRequest(() => api.post('/schedules/check-conflict', data)),
};

export default schedulesService;
