import { apiRequest } from '../lib/apiClient';
import type { ApiResponse } from '../types/models';
import api from './api';

const attendanceService = {
  recordAttendance: (data?: Record<string, unknown>): Promise<ApiResponse<any>> => apiRequest(() => api.post('/attendance', data)),

  getCourseAttendance: async (courseId, date) => {
    const params = date ? { date } : {};
    const response = await api.get(`/attendance/course/${courseId}`, { params });
    return response.data;
  },

  getStudentAttendance: async (studentId, courseId) => {
    const params = courseId ? { courseId } : {};
    const response = await api.get(`/attendance/student/${studentId}`, { params });
    return response.data;
  },
};

export default attendanceService;
