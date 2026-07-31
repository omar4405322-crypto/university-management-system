// ===== USER =====
export type UserRole =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'DOCTOR'
  | 'STUDENT'
  | 'COLLEGE_ADMIN'
  | 'DEPARTMENT_ADMIN';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  createdAt?: string;
  student?: { id: number; firstName?: string; lastName?: string; studentId?: string; year?: number; departmentId?: number | null; };
  doctor?: { id: number; firstName?: string; lastName?: string; doctorId?: string; };
  managedCollegeId?: number | null;
  managedDepartmentId?: number | null;
  collegeId?: number | null;
  departmentId?: number | null;
  adminRole?: string;
  profilePicture?: string | null;
  tokenVersion?: number;
}

// ===== STUDENT =====
export interface Student {
  id: number;
  userId?: number;
  firstName: string;
  lastName: string;
  studentId: string;
  year: number;
  isActive?: boolean;
  phone?: string | null;
  address?: string | null;
  bio?: string | null;
  gender?: string | null;
  birthDate?: string | null;
  enrolledAt?: string;
  departmentId?: number | null;
  department?: { id: number; name: string; collegeId?: number; } | null;
  user?: { id: number; email: string; role: UserRole; } | null;
  status?: 'active' | 'inactive';
  successMetrics?: {
    attendanceRate: number;
    averageQuizScore: number;
    assignmentCompletionRate: number;
    predictedRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    lastCalculated: string;
  } | null;
}

// ===== COURSE =====
export interface Course {
  id: number;
  courseCode: string;
  name: string;
  credits: number;
  maxStudents?: number;
  year?: number;
  semester?: number;
  description?: string | null;
  departmentId?: number | null;
  doctorId?: number | null;
  department?: { id: number; name: string; } | null;
  doctor?: { id: number; firstName: string; lastName: string; } | null;
  _count?: { enrollments: number; quizzes?: number; tasks?: number; exams?: number; };
  createdAt?: string;
}

// ===== ATTENDANCE =====
export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';

export interface AttendanceRecord {
  id: number;
  studentId: number;
  courseId: number;
  date: string;
  status: AttendanceStatus;
  remarks?: string | null;
  createdAt: string;
  student?: { id: number; studentId: string; firstName: string; lastName: string; userId?: number; };
  course?: { id: number; name: string; courseCode: string; };
}

export interface AttendanceStats {
  total: number;
  PRESENT: number;
  ABSENT: number;
  LATE: number;
  EXCUSED: number;
  percentage: number;
}

export interface AttendanceStudentSummary {
  studentId: number;
  PRESENT: number;
  ABSENT: number;
  LATE: number;
  EXCUSED: number;
  total: number;
  percentage: number;
}

export interface AttendanceBulkPayload {
  courseId: number;
  date?: string;
  records: Array<{ studentId: number; status: AttendanceStatus; remarks?: string; }>;
}

// ===== DEPARTMENT =====
export interface Department {
  id: number;
  name: string;
  collegeId: number;
  description?: string;
  nameAr?: string | null;
}

// ===== COLLEGE =====
export interface College {
  id: number;
  name: string;
  nameAr?: string | null;
  description?: string | null;
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
  stats?: AttendanceStats;
  deleted?: number;
  fromCache?: boolean;
}
