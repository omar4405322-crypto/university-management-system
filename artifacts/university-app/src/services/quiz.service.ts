import { apiRequest } from '../lib/apiClient';
import type { ApiResponse } from '../types/models';
import api from './api';

/** An individual answer entry for a quiz submission. */
export interface QuizAnswer {
  questionId: string | number;
  answer: string | string[] | number | boolean;
}

/** A quiz list item or detail returned by the API. */
export interface QuizData {
  id: string | number;
  title?: string;
  courseId?: number;
  duration?: number;
  startAt?: string;
  endAt?: string;
  status?: string;
  questions?: QuizQuestion[];
  hasSubmitted?: boolean;
}

export interface QuizQuestion {
  id: string | number;
  text?: string;
  type?: string;
  options?: string[];
  points?: number;
}

export interface QuizSubmissionResult {
  submissionId: string | number;
  score?: number;
  totalPoints?: number;
  passed?: boolean;
}

const quizService = {
  getQuizzes: (params?: Record<string, unknown>): Promise<ApiResponse<QuizData[]>> =>
    apiRequest(() => api.get('/quizzes', { params })),

  getQuizById: (id: string): Promise<ApiResponse<QuizData>> =>
    apiRequest(() => api.get(`/quizzes/${id}`)),

  createQuiz: (data?: Record<string, unknown>): Promise<ApiResponse<QuizData>> =>
    apiRequest(() => api.post('/quizzes', data)),

  submitQuiz: (id: string, answers: QuizAnswer[]): Promise<ApiResponse<QuizSubmissionResult>> =>
    apiRequest(() => api.post(`/quizzes/${id}/submit`, { answers })),

  getQuizSubmissions: (id: string): Promise<ApiResponse<QuizSubmissionResult[]>> =>
    apiRequest(() => api.get(`/quizzes/${id}/results`)),
};

export default quizService;
