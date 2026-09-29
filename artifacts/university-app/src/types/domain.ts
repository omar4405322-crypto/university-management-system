/**
 * Shared domain types for the University Management System frontend.
 *
 * These are the "row" shapes returned by the list endpoints and used throughout
 * hooks, pages, and components. They are intentionally kept concise — only the
 * fields actually consumed by the UI are declared.  Optional fields use `?` so
 * that partial server responses are still assignable.
 */

// ── Admin / User ──────────────────────────────────────────────────────────────

export interface AdminUser {
  id: string | number;
  email: string;
  role: string;
  firstName?: string;
  lastName?: string;
  isActive?: boolean;
  createdAt?: string;
  deactivatedAt?: string;
  managedCollege?: { id: number; name: string } | null;
  college?: { id: number; name: string } | null;
  department?: { id: number; name: string } | null;
  avatar?: string;
  phone?: string;
}

// ── Student ───────────────────────────────────────────────────────────────────

export interface StudentRow {
  id: number;
  userId?: number;
  studentId: string;
  year?: number;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  isActive?: boolean;
  status?: string;
  createdAt?: string;
  enrolledAt?: string;
  departmentId?: number;
  department?: { id: number; name: string; nameAr?: string; college?: { id: number; name: string; nameAr?: string } } | null;
  user?: { id: number; email: string; firstName?: string; lastName?: string; role?: string; profilePicture?: string } | null;
  enrollments?: EnrollmentRow[];
  gpa?: number;
  totalCredits?: number;
  group?: { id: number; name: string; parentGroup?: { id: number; name: string } | null } | null;
}

export interface StudentProfile extends StudentRow {
  address?: string;
  nationalId?: string;
  avatar?: string;
  gender?: string;
  enrollments: EnrollmentRow[];
  payments?: PaymentRow[];
}

export interface EnrollmentRow {
  id: number;
  courseId: number;
  studentId: number;
  status?: string;
  grade?: number | null;
  letterGrade?: string | null;
  absences?: number;
  maxAbsences?: number;
  customAbsenceThreshold?: number | null;
  course?: CourseRow | null;
}

// ── Course ────────────────────────────────────────────────────────────────────

export interface CourseRow {
  id: number;
  name: string;
  nameAr?: string;
  code?: string;
  courseCode?: string;
  credits?: number;
  year?: number;
  semester?: number;
  departmentId?: number;
  collegeId?: number;
  doctor?: { id: number; firstName: string; lastName: string } | null;
  department?: {
    id: number;
    name: string;
    nameAr?: string;
    collegeId?: number;
    college?: { id: number; name: string; nameAr?: string };
  } | null;
  enrollmentCount?: number;
  isActive?: boolean;
  isPublished?: boolean;
  sections?: Array<{ id?: number; doctor?: { id?: number; firstName?: string; lastName?: string } | null; [key: string]: unknown }>;
  scheduleSlots?: Array<{ id?: number; doctor?: { id?: number; firstName?: string; lastName?: string } | null; [key: string]: unknown }>;
  _count?: { enrollments?: number; students?: number; sections?: number; scheduleSlots?: number };
}

// ── Department ────────────────────────────────────────────────────────────────

export interface DepartmentRow {
  id: number;
  name: string;
  nameAr?: string;
  collegeId: number;
  college?: { id: number; name: string } | null;
  description?: string;
  isActive?: boolean;
  studentCount?: number;
  doctorCount?: number;
}

// ── Doctor ────────────────────────────────────────────────────────────────────

export interface DoctorRow {
  id: number;
  firstName: string;
  lastName: string;
  email?: string;
  userId?: string | number;
  doctorId?: string;
  specialty?: string;
  phone?: string;
  isActive?: boolean;
  department?: { id: number; name: string; collegeId?: number } | null;
  college?: { id: number; name: string } | null;
  courseCount?: number;
  avatar?: string;
}

// ── Teaching Assistant ────────────────────────────────────────────────────────

export interface TeachingAssistantRow {
  id: string | number;
  firstName: string;
  lastName: string;
  name?: string;
  email?: string;
  phone?: string;
  userId?: string | number;
  employeeId?: string;
  specialization?: string;
  isActive?: boolean;
  status?: string;
  departmentId?: number;
  department?: {
    id: number;
    name: string;
    nameAr?: string;
    collegeId?: number;
    college?: { id: number; name: string; nameAr?: string };
  } | null;
  college?: { id: number; name: string; nameAr?: string } | null;
  avatar?: string;
  user?: {
    id?: number;
    email: string;
    firstName?: string;
    lastName?: string;
    role?: string;
  } | null;
  doctors?: Array<{
    doctorId: number;
    doctor?: { id: number; firstName: string; lastName: string };
  }>;
  taughtCourses?: CourseRow[];
  scheduleSlots?: Array<Record<string, unknown>>;
}

// ── College ───────────────────────────────────────────────────────────────────

export interface CollegeRow {
  id: number;
  name: string;
  nameAr?: string;
  code?: string;
  image?: string;
  description?: string;
  descriptionAr?: string;
  departments?: DepartmentRow[];
  admin?: { id: number; firstName: string; lastName: string; email: string } | null;
  adminId?: number | null;
  assignedAdmin?: { id?: number | string; name?: string; email?: string } | null;
  _count?: { departments?: number; doctors?: number; students?: number };
}

// ── Exam ──────────────────────────────────────────────────────────────────────

export interface ExamItem {
  id: string | number;
  title: string;
  type?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  duration?: number;
  room?: string;
  courseId?: number;
  course?: CourseRow | null;
  department?: { id: number; name: string; college?: { id: number; name: string } } | null;
  collegeId?: number;
  year?: number;
  semester?: number;
  createdAt?: string;
  isArchived?: boolean;
}

// ── Student Group ─────────────────────────────────────────────────────────────

export interface StudentGroup {
  id: number;
  name: string;
  departmentId?: number;
  year?: number;
  maxSize?: number;
  currentSize?: number;
  isActive?: boolean;
  department?: { id: number; name: string; college?: { id: number; name: string } } | null;
  members?: Array<{ id: number; studentId?: string; firstName?: string; lastName?: string }>;
}

// ── Payment ───────────────────────────────────────────────────────────────────

export interface PaymentRow {
  id: string | number;
  amount: number;
  status?: string;
  type?: string;
  method?: string;
  dueDate?: string;
  paidAt?: string;
  createdAt?: string;
  date?: string;
  description?: string;
}
