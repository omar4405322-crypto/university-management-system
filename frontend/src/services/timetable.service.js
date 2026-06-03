import api from './api';

const timetableService = {
  getTimetables: async (params) => {
    const response = await api.get('/timetables', { params });
    return response.data;
  },

  getTimetableById: async (id) => {
    const response = await api.get(`/timetables/${id}`);
    return response.data;
  },

  createTimetable: async (data) => {
    const response = await api.post('/timetables', data);
    return response.data;
  },

  updateTimetable: async (id, data) => {
    const response = await api.put(`/timetables/${id}`, data);
    return response.data;
  },

  deleteTimetable: async (id) => {
    const response = await api.delete(`/timetables/${id}`);
    return response.data;
  }
};

export default timetableService;
