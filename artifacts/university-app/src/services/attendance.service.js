import api from './api';

const attendanceService = {
  recordAttendance: async (data) => {
    const response = await api.post('/attendance', data);
    return response.data;
  },

  getCourseAttendance: async (courseId, date) => {
    const params = date ? { date } : {};
    const response = await api.get(`/attendance/course/${courseId}`, { params });
    return response.data;
  },

  getStudentAttendance: async (studentId, courseId) => {
    const params = courseId ? { courseId } : {};
    const response = await api.get(`/attendance/student/${studentId}`, { params });
    return response.data;
  }
};

export default attendanceService;
