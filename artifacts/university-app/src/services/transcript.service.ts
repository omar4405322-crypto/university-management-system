import { apiRequest } from '../lib/apiClient';
import type { ApiResponse } from '../types/models';
import api from './api';

export interface ExamDetail {
  id: number;
  title: string;
  score: number | null;
  maxScore: number;
  date: string;
  status: string;
}

export interface QuizDetail {
  id: number;
  title: string;
  score: number | null;
  submittedAt: string;
}

export interface TaskDetail {
  id: number;
  title: string;
  score: number | null;
  maxScore: number;
  submittedAt: string;
}

export interface CourseTranscriptItem {
  id: number;
  studentId: number;
  courseId: number;
  semester: number;
  academicYear: number;
  finalGrade: number | null;
  status: string;
  enrolledAt: string;
  course: {
    id: number;
    name: string;
    courseCode: string;
    credits: number;
    department?: {
      name: string;
    };
  };
  exams: ExamDetail[];
  quizzes: QuizDetail[];
  tasks: TaskDetail[];
}

export interface SemesterTranscript {
  academicYear: number;
  semester: number;
  courses: CourseTranscriptItem[];
}

export interface CompletedExamAdminItem {
  id: number;
  courseId: number;
  courseName: string;
  courseCode: string;
  type: string;
  date: string;
  startTime: string;
  endTime: string;
  room: string;
  questionsCount: number;
  submissionsCount: number;
  submissions: {
    id: number;
    studentName: string;
    studentCode: string;
    score: number | null;
    maxScore: number;
    status: string;
    submittedAt: string;
  }[];
}

export interface TranscriptData {
  studentId?: number;
  gpa?: string;
  totalCreditHours?: number;
  totalEnrollments?: number;
  semesters?: SemesterTranscript[];
  isAdminOverview?: boolean;
  totalCompletedExams?: number;
  totalSubmissions?: number;
  averageScore?: string;
  completedExams?: CompletedExamAdminItem[];
}

const transcriptService = {
  getStudentTranscript: (studentId?: number): Promise<ApiResponse<TranscriptData>> =>
    apiRequest(async () => {
      try {
        return await api.get(studentId ? `/transcripts/${studentId}` : '/transcripts');
      } catch (_err) {
        return await api.get(studentId ? `/transcript/${studentId}` : '/transcript');
      }
    }),
};

export default transcriptService;
