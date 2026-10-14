import { apiRequest } from '../lib/apiClient';
import type { ApiResponse } from '../types/models';
import api from './api';

export interface DepartmentBreakdownItem {
  departmentId: number;
  departmentName: string;
  departmentNameAr: string | null;
  collegeId: number;
  collegeName?: string;
  collegeNameAr?: string | null;
  totalStudents: number;
  activeStudents: number;
}

export interface CollegeBreakdownItem {
  collegeId: number;
  collegeName: string;
  collegeNameAr: string | null;
  totalStudents: number;
  activeStudents: number;
}

export interface YearBreakdownItem {
  year: number;
  totalStudents: number;
  activeStudents: number;
}

export interface StandingDistributionItem {
  standing: string;
  count: number;
  percentage: number;
}

export interface StatisticsOverviewData {
  scope: 'UNIVERSITY' | 'COLLEGE' | 'DEPARTMENT';
  entityId: number | null;
  totalStudents: number;
  activeStudents: number;
  averageGpa: number;
  standingDistribution: StandingDistributionItem[];
  byDepartment: DepartmentBreakdownItem[];
  byCollege?: CollegeBreakdownItem[];
  byYear: YearBreakdownItem[];
}

const statisticsService = {
  getOverview: (): Promise<ApiResponse<StatisticsOverviewData>> =>
    apiRequest(() => api.get('/statistics/overview')),
};

export default statisticsService;
