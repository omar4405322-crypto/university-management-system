const degreeAuditService = {
  getAudit: async (studentId: number) => {
    // TODO: backend endpoints not yet implemented
    // const response = await api.get(`/degree-audit/${studentId}`);
    // return response.data;
    return {
      success: false,
      message: `Degree audit endpoint is not implemented for student ${studentId}.`,
      data: null,
    };
  },

  checkEligibility: async (studentId: number) => {
    // TODO: backend endpoints not yet implemented
    // const response = await api.get(`/degree-audit/${studentId}/eligible`);
    // return response.data;
    return {
      success: false,
      message: `Degree audit eligibility endpoint is not implemented for student ${studentId}.`,
      data: null,
    };
  },
};

export default degreeAuditService;
