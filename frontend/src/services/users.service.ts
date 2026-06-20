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

const deleteUser = (id: string): Promise<ApiResponse<any>> => apiRequest(() => api.delete(`/users/${id}`));

const usersService = {
  getProfile,
  updateProfile,
  updatePassword,
  getUsers,
  createAdmin,
  deleteUser,
};

export default usersService;
