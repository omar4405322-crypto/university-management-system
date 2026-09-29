import { apiRequest } from '../lib/apiClient';
import type { ApiResponse } from '../types/models';
import api from './api';

/** Shape of a single schedule slot as returned by the API list endpoints. */
export interface ScheduleSlotData {
  id?: number | string;
  dayOfWeek?: string;
  day?: string;
  startTime?: string;
  endTime?: string;
  room?: string;
  slotType?: string;
  courseId?: number;
  course?: { id?: number; name?: string; code?: string } | null;
  doctorId?: number;
  doctor?: { id?: number; firstName?: string; lastName?: string } | null;
  teachingAssistantId?: string | number;
  teachingAssistant?: { id?: number; firstName?: string; lastName?: string } | null;
  groupId?: number | null;
  group?: { id?: number; name?: string } | null;
  timetableId?: number;
  departmentId?: number;
  department?: { id?: number; name?: string; collegeId?: number } | null;
  year?: number;
  semester?: number;
  isArchived?: boolean;
  createdAt?: string;
}

export type SchedulesData =
  | ScheduleSlotData[]
  | { schedules?: ScheduleSlotData[]; data?: ScheduleSlotData[] };

const schedulesService = {
  getSchedules: (params?: Record<string, unknown>): Promise<ApiResponse<SchedulesData>> =>
    apiRequest(() => api.get('/schedules', { params })),

  getWeeklyTimetable: (params: Record<string, unknown> = {}): Promise<ApiResponse<ScheduleSlotData[]>> =>
    apiRequest(() => api.get('/schedules/week', { params })),

  getAllWeeklyTimetable: async (params: Record<string, unknown> = {}): Promise<ApiResponse<ScheduleSlotData[]>> => {
    let currentPage = 1;
    const limit = 100;
    let accumulated: ScheduleSlotData[] = [];
    let totalPages = 1;
    let total = 0;

    do {
      const res = await apiRequest<ScheduleSlotData[]>(() =>
        api.get('/schedules/week', {
          params: { ...params, page: currentPage, limit },
        })
      );
      if (!res.success) {
        return res;
      }
      const raw = res.data as ScheduleSlotData[] | { schedules?: ScheduleSlotData[]; data?: ScheduleSlotData[] } | null;
      const pageData: ScheduleSlotData[] = Array.isArray(raw)
        ? raw
        : ((raw as { schedules?: ScheduleSlotData[] })?.schedules ??
          (raw as { data?: ScheduleSlotData[] })?.data ??
          []);
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

  getAllSchedules: async (params: Record<string, unknown> = {}): Promise<ApiResponse<ScheduleSlotData[]>> => {
    let currentPage = 1;
    const limit = 100;
    let accumulated: ScheduleSlotData[] = [];
    let totalPages = 1;
    let total = 0;

    do {
      const res = await apiRequest<ScheduleSlotData[]>(() =>
        api.get('/schedules', {
          params: { ...params, page: currentPage, limit },
        })
      );
      if (!res.success) {
        return res;
      }
      const raw = res.data as ScheduleSlotData[] | { schedules?: ScheduleSlotData[]; data?: ScheduleSlotData[] } | null;
      const pageData: ScheduleSlotData[] = Array.isArray(raw)
        ? raw
        : ((raw as { schedules?: ScheduleSlotData[] })?.schedules ??
          (raw as { data?: ScheduleSlotData[] })?.data ??
          []);
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

  createSchedule: (data?: Record<string, unknown>): Promise<ApiResponse<ScheduleSlotData>> =>
    apiRequest(() => api.post('/schedules', data)),

  updateSchedule: (id: string, data: Record<string, unknown>): Promise<ApiResponse<ScheduleSlotData>> =>
    apiRequest(() => api.put(`/schedules/${id}`, data)),

  deleteSchedule: (id: string): Promise<ApiResponse<null>> =>
    apiRequest(() => api.delete(`/schedules/${id}`)),

  archiveSchedule: (id: string): Promise<ApiResponse<ScheduleSlotData>> =>
    apiRequest(() => api.post(`/schedules/${id}/archive`)),

  restoreSchedule: (id: string): Promise<ApiResponse<ScheduleSlotData>> =>
    apiRequest(() => api.post(`/schedules/${id}/restore`)),

  syncGrid: (data: Record<string, unknown>): Promise<ApiResponse<unknown>> =>
    apiRequest(() => api.post('/schedules/sync-grid', data)),

  checkConflict: (data: Record<string, unknown>): Promise<ApiResponse<unknown>> =>
    apiRequest(() => api.post('/schedules/check-conflict', data)),
};

export default schedulesService;
