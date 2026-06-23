import { apiRequest } from '../lib/apiClient';
import type { ApiResponse } from '../types/models';
import api from './api';

const analyticsService = {
  getGeneralAnalytics: (params?: Record<string, unknown>): Promise<ApiResponse<any>> => apiRequest(() => api.get('/analytics/general', { params })),
};

export default analyticsService;
