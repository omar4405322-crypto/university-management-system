import api from './api';

const timetableService = {
  getTimetables: async (params = {}) => {
    let { page = 1, limit = 10, ...filters } = params;
    // Extract page if it is passed as an object (e.g. { page: 1 })
    if (typeof page === 'object' && page !== null) {
      page = page.page || 1;
    }
    const response = await api.get('/timetable', { params: { ...filters, page, limit } });
    return response.data;
  },

  getTimetableById: async (id) => {
    const response = await api.get(`/timetable/${id}`);
    return response.data;
  },

  createTimetable: async (data) => {
    const response = await api.post('/timetable', data);
    return response.data;
  },

  updateTimetable: async (id, data) => {
    const response = await api.put(`/timetable/${id}`, data);
    return response.data;
  },

  deleteTimetable: async (id) => {
    const response = await api.delete(`/timetable/${id}`);
    return response.data;
  },

  publishTimetable: async (id) => {
    const response = await api.patch(`/timetable/${id}/publish`);
    return response.data;
  },

  unpublishTimetable: async (id) => {
    const response = await api.patch(`/timetable/${id}/unpublish`);
    return response.data;
  },
};

export default timetableService;
