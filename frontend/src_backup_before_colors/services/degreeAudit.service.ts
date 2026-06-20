import { apiRequest } from '../lib/apiClient';
import type { ApiResponse } from '../types/models';
import api from './api';

const degreeAuditService = {
  getAudit: (studentId: number): Promise<ApiResponse<any>> => apiRequest(() => api.get(`/degree-audit/${studentId}`)),

  checkEligibility: (studentId: number): Promise<ApiResponse<any>> => apiRequest(() => api.get(`/degree-audit/${studentId}/eligible`)),
};

export default degreeAuditService;
