// @ts-nocheck
import axios, { AxiosError } from 'axios';
import type { ApiResponse } from '@/types/models';

export async function apiRequest<T>(
  fn: () => Promise<{ data: ApiResponse<T> }>
): Promise<ApiResponse<T>> {
  try {
    const res = await fn();
    return res.data;
  } catch (error: unknown) {
    let message = 'An unexpected error occurred';

    if (axios.isAxiosError(error)) {
      const axiosErr = error as AxiosError<{ message?: string }>;
      message = axiosErr.response?.data?.message ?? axiosErr.message;
    }

    return {
      success: false,
      data: null as unknown as T,
      message,
    };
  }
}
