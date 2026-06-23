import { apiRequest } from '../lib/apiClient';
import type { ApiResponse } from '../types/models';
import api from './api';

const schedulesService = {
  getSchedules: (params?: Record<string, unknown>): Promise<ApiResponse<any>> => apiRequest(() => api.get('/schedules', { params })),

  getWeeklyTimetable: (params: Record<string, unknown> = {}): Promise<ApiResponse<any>> => apiRequest(() => api.get('/schedules/week', { params })),

  createSchedule: (data?: Record<string, unknown>): Promise<ApiResponse<any>> => apiRequest(() => api.post('/schedules', data)),

  updateSchedule: (id: string, data: Record<string, unknown>): Promise<ApiResponse<any>> => apiRequest(() => api.put(`/schedules/${id}`, data)),

  deleteSchedule: (id: string): Promise<ApiResponse<any>> => apiRequest(() => api.delete(`/schedules/${id}`)),
};

export default schedulesService;
