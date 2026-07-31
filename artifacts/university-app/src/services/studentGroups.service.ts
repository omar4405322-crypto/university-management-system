import api from './api';

export const studentGroupsService = {
  getDepartmentGroups: async (departmentId: number | string, year?: number) => {
    const response = await api.get(`/student-groups/departments/${departmentId}/groups`, {
      params: { year }
    });
    return response.data;
  },

  autoDivideStudents: async (departmentId: number | string, data: { numberOfGroups?: number; maxGroupSize?: number; confirmed?: boolean; year?: number }) => {
    const response = await api.post(`/student-groups/departments/${departmentId}/groups/auto-divide`, data);
    return response.data;
  },

  splitGroup: async (groupId: number | string, data: { numberOfSubgroups?: number; maxSubgroupSize?: number; confirmed?: boolean }) => {
    const response = await api.post(`/student-groups/groups/${groupId}/split`, data);
    return response.data;
  },

  deleteGroup: async (groupId: number | string, data?: { confirmed?: boolean }) => {
    const response = await api.delete(`/student-groups/groups/${groupId}`, { data });
    return response.data;
  },

  manualOverrideGroup: async (studentId: number | string, data: { groupId: number }) => {
    const response = await api.put(`/student-groups/students/${studentId}/group`, data);
    return response.data;
  },
};

export default studentGroupsService;
