import api from './api';

// Types
export interface ExamSession {
  id: number;
  examId: number;
  courseId: number;
  doctorId: number;
  title: string;
  instructions?: string;
  durationMinutes: number;
  totalPoints: number;
  passingScore: number;
  shuffleQuestions: boolean;
  showResultsAfter: boolean;
  allowedAttempts: number;
  status: 'DRAFT' | 'PUBLISHED' | 'ACTIVE' | 'CLOSED' | 'GRADED';
  opensAt?: string;
  closesAt?: string;
  exam?: { date: string; type: string; room?: string; startTime?: string; endTime?: string };
  course?: { name: string; courseCode: string; departmentId?: number };
  doctor?: { firstName: string; lastName: string };
  questions?: ExamQuestion[];
  _count?: { questions: number; submissions: number };
  createdAt: string;
}

export interface ExamQuestion {
  id: number;
  examSessionId: number;
  type: 'MCQ' | 'TRUE_FALSE' | 'ESSAY' | 'FILE_UPLOAD';
  text: string;
  textAr?: string;
  points: number;
  orderIndex: number;
  optionA?: string;
  optionB?: string;
  optionC?: string;
  optionD?: string;
  correctAnswer?: string; // hidden from students
  maxWords?: number;
  allowedFileTypes?: string;
}

export interface ExamSubmission {
  id: number;
  examSessionId: number;
  studentId: number;
  status: 'IN_PROGRESS' | 'SUBMITTED' | 'GRADED' | 'LATE';
  startedAt: string;
  submittedAt?: string;
  totalScore?: number;
  feedback?: string;
  answers?: ExamAnswer[];
  student?: { firstName: string; lastName: string; studentId: string; user?: { profilePicture?: string } };
}

export interface ExamAnswer {
  id: number;
  questionId: number;
  selectedOption?: string;
  essayText?: string;
  fileUrl?: string;
  score?: number;
  feedback?: string;
  isCorrect?: boolean;
  question?: Partial<ExamQuestion>;
}

// API calls
export const examSessionService = {
  getAll: (params?: { courseId?: number }) => api.get('/exam-sessions', { params }).then(r => r.data.data),
  getById: (id: number) => api.get(`/exam-sessions/${id}`).then(r => r.data.data),
  create: (data: Partial<ExamSession>) => api.post('/exam-sessions', data).then(r => r.data.data),
  update: (id: number, data: Partial<ExamSession>) => api.put(`/exam-sessions/${id}`, data).then(r => r.data.data),
  delete: (id: number) => api.delete(`/exam-sessions/${id}`).then(r => r.data),
  updateStatus: (id: number, status: string) => api.put(`/exam-sessions/${id}/status`, { status }).then(r => r.data.data),

  // Questions
  addQuestion: (sessionId: number, data: Partial<ExamQuestion>) => api.post(`/exam-sessions/${sessionId}/questions`, data).then(r => r.data.data),
  updateQuestion: (sessionId: number, qId: number, data: Partial<ExamQuestion>) => api.put(`/exam-sessions/${sessionId}/questions/${qId}`, data).then(r => r.data.data),
  deleteQuestion: (sessionId: number, qId: number) => api.delete(`/exam-sessions/${sessionId}/questions/${qId}`).then(r => r.data),

  // Student
  startExam: (id: number) => api.post(`/exam-sessions/${id}/start`).then(r => r.data.data),
  submitExam: (id: number, answers: { questionId: number; selectedOption?: string; essayText?: string }[]) =>
    api.post(`/exam-sessions/${id}/submit`, { answers }).then(r => r.data.data),
  getMyResult: (id: number) => api.get(`/exam-sessions/${id}/my-result`).then(r => r.data.data),
  uploadAnswerFile: (sessionId: number, answerId: number, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post(`/exam-sessions/${sessionId}/answers/${answerId}/upload`, form, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }).then(r => r.data.data);
  },

  // Doctor/Admin
  getSubmissions: (id: number) => api.get(`/exam-sessions/${id}/submissions`).then(r => r.data.data),
  gradeSubmission: (sessionId: number, submissionId: number, data: {
    feedback?: string;
    answers: { answerId: number; score: number; feedback?: string }[]
  }) => api.put(`/exam-sessions/${sessionId}/submissions/${submissionId}/grade`, data).then(r => r.data.data),

  // Anti-cheat
  reportViolation: (sessionId: number, type: string, metadata?: object) =>
    api.post(`/exam-sessions/${sessionId}/violations`, { type, metadata }).then(r => r.data.data),

  getViolations: (sessionId: number, submissionId: number) =>
    api.get(`/exam-sessions/${sessionId}/submissions/${submissionId}/violations`).then(r => r.data.data),
};
