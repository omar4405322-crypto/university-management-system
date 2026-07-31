// @ts-nocheck
import axios, { AxiosError } from 'axios';
import type { ApiResponse } from '@/types/models';

export async function apiRequest<T>(
  fn: () => Promise<{ data: ApiResponse<T> }>
): Promise<ApiResponse<T>> {
  try {
    const res = await fn();
    return res.data;
  } catch (error: any) {
    const message =
      error?.message ||
      error?.response?.data?.message ||
      error?.response?.data?.error ||
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
