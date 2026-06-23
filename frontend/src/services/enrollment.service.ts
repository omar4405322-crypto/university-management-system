import api from './api';
import { logger } from '../lib/logger';

export interface Enrollment {
  id: number;
  studentId: number;
  courseId: number;
  semester: number;
  academicYear: number;
  status: string;
  finalGrade?: number;
  student?: any;
  course?: any;
  createdAt: string;
  updatedAt: string;
}

export interface EnrollmentFilters {
  studentId?: number;
  courseId?: number;
  semester?: number;
}

const enrollmentService = {
  getEnrollments: async (filters: EnrollmentFilters = {}) => {
    try {
      const params = new URLSearchParams();
      if (filters.studentId) params.append('studentId', filters.studentId.toString());
      if (filters.courseId) params.append('courseId', filters.courseId.toString());
      if (filters.semester) params.append('semester', filters.semester.toString());

      const response = await api.get(`/enrollments?${params.toString()}`);
      return response.data;
    } catch (error) {
      logger.error('Error fetching enrollments:', error);
      throw error;
    }
  },

  enrollStudent: async (payload: { studentId: number; courseId: number; semester: number; academicYear: number }) => {
    try {
      const response = await api.post('/enrollments', payload);
      return response.data;
    } catch (error) {
      logger.error('Error enrolling student:', error);
      throw error;
    }
  },

  withdrawStudent: async (id: number) => {
    try {
      const response = await api.delete(`/enrollments/${id}`);
      return response.data;
    } catch (error) {
      logger.error('Error withdrawing student:', error);
      throw error;
    }
  },

  updateGrade: async (id: number, finalGrade: number) => {
    try {
      const response = await api.patch(`/enrollments/${id}/grade`, { finalGrade });
      return response.data;
    } catch (error) {
      logger.error('Error updating grade:', error);
      throw error;
    }
  }
};

export default enrollmentService;
