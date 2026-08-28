import { apiRequest } from '../lib/apiClient';
import type { ApiResponse } from '../types/models';
import api from './api';

const getProfile = (): Promise<ApiResponse<any>> => apiRequest(() => api.get('/users/profile'));

const updateProfile = (data?: Record<string, unknown>): Promise<ApiResponse<any>> => apiRequest(() => api.put('/users/profile', data));

const updatePassword = (data?: Record<string, unknown>): Promise<ApiResponse<any>> => apiRequest(() => api.put('/users/profile/password', data));

const getUsers = async (params: Record<string, unknown> = {}) => {
  const query: Record<string, unknown> = { ...params };
  if (Array.isArray(query.role)) {
    query.role = query.role.join(',');
  }
  const response = await api.get('/users', { params: query });
  return response.data;
};

const createAdmin = (data?: Record<string, unknown>): Promise<ApiResponse<any>> => apiRequest(() => api.post('/users/admins', data));

const updateAdmin = (id: string | number, data?: Record<string, unknown>): Promise<ApiResponse<any>> => apiRequest(() => api.put(`/users/${id}`, data));

const resetPassword = (id: string | number, data?: Record<string, unknown>): Promise<ApiResponse<any>> => apiRequest(() => api.patch(`/users/${id}/reset-password`, data));

const deleteUser = (id: string | number): Promise<ApiResponse<any>> => apiRequest(() => api.delete(`/users/${id}`));

const reactivateUser = (id: string | number): Promise<ApiResponse<any>> => apiRequest(() => api.patch(`/users/${id}/reactivate`));

const hardDeleteUser = (id: string | number, confirmEmail: string): Promise<ApiResponse<any>> => apiRequest(() => api.delete(`/users/${id}/permanent`, { data: { confirmEmail } }));

const usersService = {
  getProfile,
  updateProfile,
  updatePassword,
  getUsers,
  createAdmin,
  updateAdmin,
  resetPassword,
  deleteUser,
  reactivateUser,
  hardDeleteUser,
};

export default usersService;
