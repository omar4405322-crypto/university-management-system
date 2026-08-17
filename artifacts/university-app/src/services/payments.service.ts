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

  downloadReceipt: async (id: string | number): Promise<void> => {
    try {
      const response = await api.get(`/payments/${id}/receipt`, {
        responseType: 'blob',
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `receipt-${id}.pdf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      if (error?.response?.data instanceof Blob) {
        try {
          const text = await error.response.data.text();
          const parsed = JSON.parse(text);
          throw new Error(parsed.message || parsed.error || 'Failed to download receipt');
        } catch (e: any) {
          if (e.message && !e.message.includes('JSON')) throw e;
        }
      }
      throw error;
    }
  },
};

export default paymentsService;

