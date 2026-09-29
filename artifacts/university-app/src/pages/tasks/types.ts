import type React from "react";

export interface TaskCourse {
  id: number | string;
  name: string;
  courseCode: string;
  year?: number;
  _count?: {
    enrollments?: number;
  };
}

export interface TaskSubmission {
  id: number | string;
  taskId: number | string;
  studentId: number | string;
  status: "SUBMITTED" | "GRADED" | "LATE" | string;
  score?: number | null;
  submittedAt?: string;
  fileUrl?: string;
  notes?: string;
}

export interface TaskItem {
  id: number | string;
  title: string;
  description: string;
  dueDate: string;
  maxScore: number;
  courseId: number | string;
  course?: TaskCourse;
  submissions?: TaskSubmission[];
  mySubmission?: TaskSubmission | null;
  _count?: {
    submissions?: number;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface CourseOption {
  id: number | string;
  name: string;
  courseCode: string;
  year?: number;
}

export interface CreateTaskFormData {
  title: string;
  description: string;
  courseId: string;
  dueDate: string;
  maxScore: number;
}

export interface SubmitTaskFormData {
  notes?: string;
  fileUrl: string;
}

export interface TasksKpiCounts {
  total: number;
  overdue: number;
  upcoming: number;
  submitted: number;
}
