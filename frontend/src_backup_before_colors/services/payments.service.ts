import { apiRequest } from '../lib/apiClient';
import type { ApiResponse } from '../types/models';
import api from './api';

const paymentsService = {
  getPayments: (params?: Record<string, unknown>): Promise<ApiResponse<any>> => apiRequest(() => api.get('/payments', { params })),

  getMyPayments: (): Promise<ApiResponse<any>> => apiRequest(() => api.get('/payments/my')),

  getStats: (): Promise<ApiResponse<any>> => apiRequest(() => api.get('/payments/stats')),

  createPayment: (data?: Record<string, unknown>): Promise<ApiResponse<any>> => apiRequest(() => api.post('/payments', data)),

  updatePayment: (id: string, data: Record<string, unknown>): Promise<ApiResponse<any>> => apiRequest(() => api.put(`/payments/${id}`, data)),

  markAsPaid: (id: string): Promise<ApiResponse<any>> => apiRequest(() => api.put(`/payments/${id}/pay`)),

  deletePayment: (id: string): Promise<ApiResponse<any>> => apiRequest(() => api.delete(`/payments/${id}`)),
};

export default paymentsService;
