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
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: unknown } };
      if (axiosErr?.response?.data instanceof Blob) {
        try {
          const text = await (axiosErr.response.data as Blob).text();
          const parsed = JSON.parse(text) as { message?: string; error?: string };
          throw new Error(parsed.message || parsed.error || 'Failed to download receipt');
        } catch (e: unknown) {
          const innerErr = e as Error;
          if (innerErr.message && !innerErr.message.includes('JSON')) throw innerErr;
        }
      }
      throw error;
    }
  },
};

export default paymentsService;

