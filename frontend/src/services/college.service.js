import api from './api';

const collegeService = {
  getColleges: async () => {
    const response = await api.get('/colleges');
    return response.data;
  },

  getCollegeById: async (id) => {
    const response = await api.get(`/colleges/${id}`);
    return response.data;
  },

  createCollege: async (data) => {
    const response = await api.post('/colleges', data);
    return response.data;
  },

  updateCollege: async (id, data) => {
    const response = await api.put(`/colleges/${id}`, data);
    return response.data;
  },

  deleteCollege: async (id) => {
    const response = await api.delete(`/colleges/${id}`);
    return response.data;
  },
};

export default collegeService;
