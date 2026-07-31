import { apiRequest } from '../lib/apiClient';
import type { ApiResponse } from '../types/models';
import api from './api';
import type {
  AttendanceBulkPayload,
  AttendanceRecord,
  AttendanceStats,
  AttendanceStudentSummary,
  AttendanceStatus,
} from '../types/models';

const attendanceService = {
  recordAttendance: (
    data: AttendanceBulkPayload
  ): Promise<ApiResponse<AttendanceRecord[]>> =>
    apiRequest(() => api.post('/attendance', data)),

  getCourseAttendance: (
    courseId: number | string,
    date?: string
  ): Promise<ApiResponse<AttendanceRecord[]>> => {
    const params = date ? { date } : {};
    return apiRequest(async () => {
      const res = await api.get(`/attendance/course/${courseId}`, { params });
      return res.data;
    });
  },

  getCourseAttendanceSummary: (
    courseId: number | string
  ): Promise<ApiResponse<AttendanceStudentSummary[]>> =>
    apiRequest(async () => {
      const res = await api.get(`/attendance/course/${courseId}/summary`);
      return res.data;
    }),

  deleteCourseAttendanceForDate: (
    courseId: number | string,
    date: string
  ): Promise<ApiResponse<{ deleted: number; message: string }>> =>
    apiRequest(async () => {
      const res = await api.delete(`/attendance/course/${courseId}`, { params: { date } });
      return res.data;
    }),

  getStudentAttendance: (
    studentId: number | string,
    courseId?: number | string,
    page: number = 1,
    limit: number = 20
  ): Promise<ApiResponse<AttendanceRecord[]>> => {
    const params: Record<string, unknown> = { page, limit };
    if (courseId) params.courseId = courseId;
    return apiRequest(async () => {
      const res = await api.get(`/attendance/student/${studentId}`, { params });
      return res.data;
    });
  },

  updateAttendance: (
    id: number | string,
    data: { status?: AttendanceStatus; remarks?: string | null }
  ): Promise<ApiResponse<AttendanceRecord>> =>
    apiRequest(async () => {
      const res = await api.put(`/attendance/${id}`, data);
      return res.data;
    }),

  deleteAttendance: (
    id: number | string
  ): Promise<ApiResponse<{ message: string }>> =>
    apiRequest(async () => {
      const res = await api.delete(`/attendance/${id}`);
      return res.data;
    }),
};

export type { AttendanceStats, AttendanceStudentSummary, AttendanceStatus, AttendanceRecord, AttendanceBulkPayload };
export default attendanceService;
