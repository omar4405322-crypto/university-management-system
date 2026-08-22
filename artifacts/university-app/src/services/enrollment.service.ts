import { apiRequest } from '../lib/apiClient';
import type { ApiResponse } from '../types/models';
import api from './api';

export interface EnrollStudentPayload {
  studentId: number | string;
  courseId: number | string;
  semester: number | string;
  academicYear: number | string;
}

const enrollmentService = {
  enrollStudent: (data: EnrollStudentPayload): Promise<ApiResponse<any>> =>
    apiRequest(() => api.post('/enrollments', {
      studentId: typeof data.studentId === 'string' ? parseInt(data.studentId, 10) : data.studentId,
      courseId: typeof data.courseId === 'string' ? parseInt(data.courseId, 10) : data.courseId,
      semester: typeof data.semester === 'string' ? parseInt(data.semester, 10) : data.semester,
      academicYear: typeof data.academicYear === 'string' ? parseInt(data.academicYear, 10) : data.academicYear,
    })),

  withdrawStudent: (enrollmentId: number | string): Promise<ApiResponse<any>> =>
    apiRequest(() => api.delete(`/enrollments/${enrollmentId}`)),

  getEnrollments: (params?: Record<string, unknown>): Promise<ApiResponse<any>> =>
    apiRequest(() => api.get('/enrollments', { params })),

  updateGrade: (enrollmentId: number | string, finalGrade: number): Promise<ApiResponse<any>> =>
    apiRequest(() => api.patch(`/enrollments/${enrollmentId}/grade`, { finalGrade })),

  setAbsenceThreshold: (
    enrollmentId: number | string,
    customAbsenceThreshold: number | null
  ): Promise<ApiResponse<any>> =>
    apiRequest(() =>
      api.patch(`/enrollments/${enrollmentId}/absence-threshold`, {
        customAbsenceThreshold,
      })
    ),

  createExemptionPeriod: (
    enrollmentId: number | string,
    data: { startDate: string; endDate: string; reason: string }
  ): Promise<ApiResponse<any>> =>
    apiRequest(() => api.post(`/enrollments/${enrollmentId}/exemption-periods`, data)),

  getExemptionPeriods: (
    enrollmentId: number | string
  ): Promise<ApiResponse<any>> =>
    apiRequest(() => api.get(`/enrollments/${enrollmentId}/exemption-periods`)),

  deleteExemptionPeriod: (
    enrollmentId: number | string,
    exemptionId: number | string
  ): Promise<ApiResponse<any>> =>
    apiRequest(() =>
      api.delete(`/enrollments/${enrollmentId}/exemption-periods/${exemptionId}`)
    ),
};

export default enrollmentService;

