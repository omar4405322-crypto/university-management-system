import { apiRequest } from '../lib/apiClient';
import type { ApiResponse } from '../types/models';
import api from './api';

export interface TACrossDepartmentApproval {
  id: number;
  teachingAssistantId: number;
  courseId: number;
  status: 'APPROVED' | 'REVOKED';
  reason?: string | null;
  teachingAssistant?: {
    id: number;
    name?: string;
    departmentId?: number;
    department?: { id: number; name: string; collegeId: number };
  };
  course?: {
    id: number;
    name: string;
    departmentId?: number;
    department?: { id: number; name: string; collegeId: number };
  };
}

export interface ListApprovalsResponse {
  approvals: TACrossDepartmentApproval[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const taApprovalsService = {
  getApprovals: (params?: Record<string, unknown>): Promise<ApiResponse<ListApprovalsResponse>> =>
    apiRequest(() => api.get('/ta-cross-department-approvals', { params })),
};

export default taApprovalsService;
