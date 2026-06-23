import api from './api';

const schedulesService = {
  getSchedules: async (params) => {
    const response = await api.get('/schedules', { params });
    return response.data;
  },

  getWeeklyTimetable: async (params = {}) => {
    const response = await api.get('/schedules/week', { params });
    return response.data;
  },

  createSchedule: async (data) => {
    const response = await api.post('/schedules', data);
    return response.data;
  },

  updateSchedule: async (id, data) => {
    const response = await api.put(`/schedules/${id}`, data);
    return response.data;
  },

  deleteSchedule: async (id) => {
    const response = await api.delete(`/schedules/${id}`);
    return response.data;
  },
};

export default schedulesService;
