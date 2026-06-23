import api from './api';

const searchService = {
  globalSearch: async (q) => {
    const response = await api.get('/search', { params: { q } });
    return response.data;
  },
};

export default searchService;
