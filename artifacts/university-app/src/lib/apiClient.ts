import type { ApiResponse } from '../types/models';

export interface ApiRequestOptions {
  preferRawMessage?: boolean;
}

export async function apiRequest<T>(
  fn: () => Promise<{ data: ApiResponse<T> }>,
  options?: ApiRequestOptions
): Promise<ApiResponse<T>> {
  try {
    const res = await fn();
    return res.data;
  } catch (error: unknown) {
    const normalized = error as {
      message?: string;
      rawMessage?: string;
      status?: number;
      response?: { data?: { message?: string; error?: string }; status?: number };
    };

    const message = options?.preferRawMessage
      ? (normalized?.rawMessage ||
         normalized?.response?.data?.message ||
         normalized?.message ||
         normalized?.response?.data?.error ||
         'An unexpected error occurred')
      : (normalized?.message ||
         normalized?.response?.data?.message ||
         normalized?.response?.data?.error ||
         'An unexpected error occurred');

    const status = options?.preferRawMessage
      ? (normalized?.status ?? normalized?.response?.status)
      : normalized?.status;

    return {
      success: false,
      data: null as unknown as T,
      message,
      status,
      error: normalized,
    };
  }
}

import api from '../services/api';
export default api;
