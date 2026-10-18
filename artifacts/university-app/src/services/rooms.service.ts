import { apiRequest } from '../lib/apiClient';
import type { ApiResponse } from '../types/models';
import api from './api';

export interface Room {
  id: number;
  name: string;
  latitude?: number | null;
  longitude?: number | null;
  radius?: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface GetRoomsParams {
  search?: string;
  page?: number;
  limit?: number;
  includeInactive?: boolean;
}

export interface GetRoomsResponse {
  rooms: Room[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateRoomInput {
  name: string;
  isActive?: boolean;
}

const roomsService = {
  getRooms: (params?: GetRoomsParams): Promise<ApiResponse<GetRoomsResponse>> =>
    apiRequest(() => api.get('/rooms', { params })),

  createRoom: (data: CreateRoomInput): Promise<ApiResponse<Room>> =>
    apiRequest(() => api.post('/rooms', data)),

  updateRoom: (id: number | string, data: Partial<CreateRoomInput>): Promise<ApiResponse<Room>> =>
    apiRequest(() => api.patch(`/rooms/${id}`, data)),
};

export default roomsService;
