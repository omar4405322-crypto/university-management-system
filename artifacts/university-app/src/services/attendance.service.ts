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

  getMySlots: async (params?: Record<string, any>) => {
    const response = await api.get('/attendance/my-slots', { params });
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

  markStudentAttendance: async (sessionId: number, studentId: string, status: 'PRESENT' | 'LATE' | 'ABSENT') => {
    const response = await api.post(`/attendance/session/${sessionId}/mark`, { studentId, status });
    return response.data;
  },

  getAttendanceRecords: async (params: Record<string, any>) => {
    const response = await api.get('/attendance/records', { params });
    return response.data;
  },

  startSession: async (data: { scheduleSlotId?: number; courseId?: number; latitude?: number; longitude?: number; radius?: number; gracePeriodMins?: number }) => {
    const response = await api.post('/attendance/session/start', data);
    return response.data;
  },

  stopSession: async (sessionId: number) => {
    const response = await api.post(`/attendance/session/stop/${sessionId}`);
    return response.data;
  },

  getActiveSession: async (courseId?: number, scheduleSlotId?: number) => {
    const params: any = {};
    if (courseId) params.courseId = courseId;
    if (scheduleSlotId) params.scheduleSlotId = scheduleSlotId;
    const response = await api.get('/attendance/session/active', { params });
    return response.data;
  },

  getCurrentCode: async (sessionId: number, step: number = 10) => {
    const response = await api.get(`/attendance/session/${sessionId}/current-code?step=${step}`);
    return response.data;
  },

  recordAttendanceWithQR: async (payload: { sessionId: number; token: string; step?: number }, location?: { latitude: number; longitude: number }) => {
    const data = { ...payload, ...location };
    const response = await api.post('/attendance/scan-qr', data);
    return response.data;
  },

  scanQr: async (data: { sessionId?: number; token: string; step?: number; latitude?: number; longitude?: number; deviceId?: string }) => {
    const response = await api.post('/attendance/scan-qr', data);
    return response.data;
  },

  getFlaggedRecords: async (sessionId: number) => {
    const response = await api.get(`/attendance/session/${sessionId}/flagged`);
    return response.data;
  },

  overrideFlaggedRecord: async (attendanceId: number, note?: string) => {
    const response = await api.post(`/attendance/record/${attendanceId}/override`, { note });
    return response.data;
  },

  getSlotSessions: async (slotId: number) => {
    const response = await api.get(`/attendance/slot/${slotId}/sessions`);
    return response.data;
  },

  getSessionRoster: async (sessionId: number) => {
    const response = await api.get(`/attendance/session/${sessionId}/roster`);
    return response.data;
  },

  updateSessionLocation: async (sessionId: number, location: { latitude: number; longitude: number; radius?: number }) => {
    const response = await api.put(`/attendance/session/${sessionId}/location`, location);
    return response.data;
  }
};

export default attendanceService;
