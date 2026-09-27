import { Role } from '@prisma/client';

export type RoleType =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'COLLEGE_ADMIN'
  | 'DEPARTMENT_ADMIN'
  | 'DOCTOR'
  | 'TEACHING_ASSISTANT'
  | 'STUDENT';

export interface AuthActorStudent {
  id: number;
  firstName: string;
  lastName: string;
  studentId: string;
  year: number;
  departmentId?: number | null;
}

export interface AuthActorDoctor {
  id: number;
  firstName: string;
  lastName: string;
  doctorId: string;
  departmentId?: number | null;
}

export interface AuthActorTeachingAssistant {
  id: number | string;
  employeeId: string;
}

/**
 * Canonical typed identity for authenticated actors across middleware,
 * controllers, services, and authorization boundary scoping.
 */
export interface AuthActor {
  id: number;
  email: string;
  role: RoleType | Role | string;
  adminRole?: string | null;
  collegeId?: number | null;
  departmentId?: number | null;
  managedCollegeId?: number | null;
  managedDepartmentId?: number | null;
  tokenVersion: number;
  profilePicture?: string | null;
  createdAt: Date;
  isActive: boolean;
  student?: AuthActorStudent | null;
  doctor?: AuthActorDoctor | null;
  teachingAssistant?: AuthActorTeachingAssistant | null;
  [key: string]: any;
}
