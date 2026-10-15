import { apiRequest } from '../lib/apiClient';
import type { ApiResponse } from '../types/models';
import api from './api';

export interface AcademicYearData {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  terms?: AcademicTermData[];
}

export interface AcademicTermData {
  id: number;
  academicYearId: number;
  name: string;
  termType: string;
  semesterNumber: number;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  academicYear?: AcademicYearData;
}

export interface CreateYearPayload {
  name: string;
  startDate: string;
  endDate: string;
}

export interface CreateTermPayload {
  academicYearId: number;
  name: string;
  termType?: string;
  semesterNumber: number;
  startDate: string;
  endDate: string;
}

export interface TermSwitchPreviewData {
  targetTerm: {
    id: number;
    name: string;
    semesterNumber: number;
    academicYearName: string;
  };
  metrics: {
    studentsEligible: number;
    publishedCourses: number;
    estimatedNewEnrollments: number;
  };
}

const academicTermService = {
  getAcademicYears: (): Promise<ApiResponse<AcademicYearData[]>> =>
    apiRequest(() => api.get('/academic-years')),

  createAcademicYear: (data: CreateYearPayload): Promise<ApiResponse<AcademicYearData>> =>
    apiRequest(() => api.post('/academic-years', data)),

  updateAcademicYear: (id: number, data: Partial<CreateYearPayload>): Promise<ApiResponse<AcademicYearData>> =>
    apiRequest(() => api.patch(`/academic-years/${id}`, data)),

  getAcademicTerms: (params?: { academicYearId?: number }): Promise<ApiResponse<AcademicTermData[]>> =>
    apiRequest(() => api.get('/academic-terms', { params })),

  getCurrentTerm: (): Promise<ApiResponse<{ currentTerm: AcademicTermData | null; status: string }>> =>
    apiRequest(() => api.get('/academic-terms/current')),

  createAcademicTerm: (data: CreateTermPayload): Promise<ApiResponse<AcademicTermData>> =>
    apiRequest(() => api.post('/academic-terms', data)),

  updateAcademicTerm: (id: number, data: Partial<CreateTermPayload>): Promise<ApiResponse<AcademicTermData>> =>
    apiRequest(() => api.patch(`/academic-terms/${id}`, data)),

  getActivatePreview: (id: number): Promise<ApiResponse<TermSwitchPreviewData>> =>
    apiRequest(() => api.post(`/academic-terms/${id}/activate-preview`)),

  activateTerm: (id: number): Promise<ApiResponse<{ enrolledCount: number; message: string }>> =>
    apiRequest(() => api.post(`/academic-terms/${id}/activate`)),
};

export default academicTermService;
