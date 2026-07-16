// ===== USER =====
export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'COLLEGE_ADMIN' | 'DEPARTMENT_ADMIN' | 'TEACHING_ASSISTANT' | 'DOCTOR' | 'STUDENT';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  createdAt?: string;
}

// ===== STUDENT =====
export interface Student {
  id: string;
  userId: string;
  studentId: string;
  year: number;
  departmentId: string;
  user: User;
}

// ===== COURSE =====
export interface Course {
  id: string;
  courseCode: string;
  name: string;
  credits: number;
  departmentId: string;
  doctorId?: string;
}

// ===== DEPARTMENT =====
export interface Department {
  id: string;
  name: string;
  collegeId: string;
  description?: string;
}

// ===== API RESPONSE =====
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  pagination?: PaginationMeta;
}
