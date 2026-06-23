import { apiRequest } from '../lib/apiClient';
import type { ApiResponse } from '../types/models';
import api from './api';

const dashboardService = {
  getAdminStats: (): Promise<ApiResponse<any>> => apiRequest(() => api.get('/dashboard/stats')),

  getStudentStats: (): Promise<ApiResponse<any>> => apiRequest(() => api.get('/dashboard/student')),

  getDoctorStats: (): Promise<ApiResponse<any>> => apiRequest(() => api.get('/dashboard/doctor')),
};

export default dashboardService;
