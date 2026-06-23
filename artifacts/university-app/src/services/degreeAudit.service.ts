import api from './api';

const degreeAuditService = {
  getAudit: async (studentId: number) => {
    const response = await api.get(`/degree-audit/${studentId}`);
    return response.data;
  },

  checkEligibility: async (studentId: number) => {
    const response = await api.get(`/degree-audit/${studentId}/eligible`);
    return response.data;
  },
};

export default degreeAuditService;
