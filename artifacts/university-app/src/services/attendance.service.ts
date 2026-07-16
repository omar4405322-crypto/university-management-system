import { apiRequest } from '../lib/apiClient';
import type { ApiResponse } from '../types/models';
import api from './api';

export interface RosterStudent {
  id: number;
  studentId: string;
  firstName: string;
  lastName: string;
  existingStatus: string | null;
  existingRemarks: string;
  group?: string;
  studentGroupId?: number;
  recordedBy?: any;
  recordedAt?: string;
}

export interface MyAttendanceCourse {
  id: number;
  name: string;
  code: string;
}

const attendanceService = {
  recordAttendance: (data?: Record<string, unknown>): Promise<ApiResponse<any>> => apiRequest(() => api.post('/attendance', data)),

  getCourseAttendance: async (courseId: number, date?: string) => {
    const params = date ? { date } : {};
    const response = await api.get(`/attendance/course/${courseId}`, { params });
    return response.data;
  },

  getCourseRoster: async (courseId: number, date?: string, groupId?: number | null) => {
    const params: any = {};
    if (date) params.date = date;
    if (groupId) params.groupId = groupId;
    const response = await api.get(`/courses/${courseId}/roster`, { params });
    return response.data;
  },

  getStudentAttendance: async (studentId: number, courseId?: number) => {
    const params = courseId ? { courseId } : {};
    const response = await api.get(`/attendance/student/${studentId}`, { params });
    return response.data;
  },

  getMyCourses: async (params?: Record<string, any>): Promise<ApiResponse<MyAttendanceCourse[]>> => {
    const response = await api.get('/attendance/my-courses', { params });
    return response.data;
  },

  getMyAttendance: async (courseId?: number) => {
    const params = courseId ? { courseId } : {};
    const response = await api.get('/attendance/my-attendance', { params });
    return response.data;
  },

  getAttendanceSummary: async (courseId: number) => {
    const response = await api.get(`/attendance/summary/${courseId}`);
    return response.data;
  },

  bulkSave: async (courseId: number, date: string, records: any[]) => {
    const response = await api.post('/attendance/bulk', { courseId, date, records });
    return response.data;
  },

  getAttendanceRecords: async (params: Record<string, any>) => {
    const response = await api.get('/attendance/records', { params });
    return response.data;
  }
};

export default attendanceService;
