import type { ApiResponse } from '../types/models';

export async function apiRequest<T>(
  fn: () => Promise<{ data: ApiResponse<T> }>
): Promise<ApiResponse<T>> {
  try {
    const res = await fn();
    return res.data;
  } catch (error: unknown) {
    const normalized = error as { message?: string; response?: { data?: { message?: string; error?: string } } };
    const message =
      normalized?.message ||
      normalized?.response?.data?.message ||
      normalized?.response?.data?.error ||
      'An unexpected error occurred';

    return {
      success: false,
      data: null as unknown as T,
      message,
    };
  }
}

import api from '../services/api';
export default api;
