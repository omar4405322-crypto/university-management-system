import { apiRequest } from '../lib/apiClient';
import type { ApiResponse } from '../types/models';
import api from './api';

const searchService = {
  globalSearch: (q: string): Promise<ApiResponse<any>> => apiRequest(() => api.get('/search', { params: { q } })),
};

export default searchService;
