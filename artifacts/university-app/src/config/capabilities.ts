/**
 * FRONTEND CAPABILITY SOURCE OF TRUTH (UX-001)
 *
 * Centralized capability matrix mapping user roles to permissions,
 * navigation visibility, route guards, and feature actions.
 *
 * Architecture:
 * Role -> Capabilities -> Navigation Visibility -> Route Access -> Feature Actions
 *
 * Note: Backend authorization remains the authoritative security boundary.
 * This file enforces consistent UX, navigation visibility, and client-side guards.
 */

export type UserRole =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'COLLEGE_ADMIN'
  | 'DEPARTMENT_ADMIN'
  | 'DOCTOR'
  | 'TEACHING_ASSISTANT'
  | 'STUDENT';

export const ALL_ROLES: readonly UserRole[] = [
  'SUPER_ADMIN',
  'ADMIN',
  'COLLEGE_ADMIN',
  'DEPARTMENT_ADMIN',
  'DOCTOR',
  'TEACHING_ASSISTANT',
  'STUDENT',
] as const;

export type Capability =
  | 'dashboard.view'
  | 'colleges.view'
  | 'colleges.manage'
  | 'departments.view'
  | 'departments.manage'
  | 'courses.view'
  | 'courses.manage'
  | 'students.view'
  | 'students.manage'
  | 'doctors.view'
  | 'doctors.manage'
  | 'teaching_assistants.view'
  | 'teaching_assistants.manage'
  | 'admins.view'
  | 'admins.manage'
  | 'groups.view'
  | 'groups.manage'
  | 'registration_requests.view'
  | 'registration_requests.manage'
  | 'schedules.doctor'
  | 'schedules.ta'
  | 'schedules.student'
  | 'schedules.manage'
  | 'schedules.timetable'
  | 'exams.view'
  | 'exams.create'
  | 'exams.take'
  | 'exams.submissions'
  | 'quizzes.view'
  | 'quizzes.create'
  | 'quizzes.take'
  | 'tasks.view'
  | 'tasks.create'
  | 'tasks.grade'
  | 'tasks.submit'
  | 'attendance.view'
  | 'attendance.manage'
  | 'warnings.view'
  | 'statistics.view'
  | 'records.view'
  | 'degree_audit.view'
  | 'finance.view'
  | 'analytics.view'
  | 'notifications.view'
  | 'profile.view'
  | 'settings.view';

/**
 * Capability assignments per role derived from backend authorizations:
 * - Teaching Assistants are assignment-aware and participate in courses, schedules, tasks, quizzes, attendance, and warnings.
 * - Tenant Admins (COLLEGE_ADMIN, DEPARTMENT_ADMIN) have scoped access to academic entities and requests.
 * - SUPER_ADMIN inherently possesses all capabilities.
 */
export const ROLE_CAPABILITY_MATRIX: Record<UserRole, readonly Capability[]> = {
  SUPER_ADMIN: [
    'dashboard.view',
    'colleges.view',
    'colleges.manage',
    'departments.view',
    'departments.manage',
    'courses.view',
    'courses.manage',
    'students.view',
    'students.manage',
    'doctors.view',
    'doctors.manage',
    'teaching_assistants.view',
    'teaching_assistants.manage',
    'admins.view',
    'admins.manage',
    'groups.view',
    'groups.manage',
    'registration_requests.view',
    'registration_requests.manage',
    'schedules.doctor',
    'schedules.ta',
    'schedules.manage',
    'schedules.timetable',
    'exams.view',
    'exams.create',
    'exams.submissions',
    'quizzes.view',
    'quizzes.create',
    'tasks.view',
    'tasks.create',
    'tasks.grade',
    'attendance.view',
    'attendance.manage',
    'warnings.view',
    'records.view',
    'degree_audit.view',
    'finance.view',
    'analytics.view',
    'notifications.view',
    'profile.view',
    'settings.view',
  ],

  ADMIN: [
    'dashboard.view',
    'colleges.view',
    'colleges.manage',
    'departments.view',
    'departments.manage',
    'courses.view',
    'courses.manage',
    'students.view',
    'students.manage',
    'doctors.view',
    'doctors.manage',
    'teaching_assistants.view',
    'teaching_assistants.manage',
    'admins.view',
    'admins.manage',
    'groups.view',
    'groups.manage',
    'registration_requests.view',
    'registration_requests.manage',
    'schedules.doctor',
    'schedules.ta',
    'schedules.manage',
    'schedules.timetable',
    'exams.view',
    'exams.create',
    'exams.submissions',
    'quizzes.view',
    'quizzes.create',
    'tasks.view',
    'tasks.create',
    'tasks.grade',
    'attendance.view',
    'attendance.manage',
    'warnings.view',
    'records.view',
    'degree_audit.view',
    'finance.view',
    'analytics.view',
    'notifications.view',
    'profile.view',
    'settings.view',
  ],

  COLLEGE_ADMIN: [
    'dashboard.view',
    'colleges.view',
    'departments.view',
    'departments.manage',
    'courses.view',
    'courses.manage',
    'students.view',
    'students.manage',
    'doctors.view',
    'doctors.manage',
    'teaching_assistants.view',
    'teaching_assistants.manage',
    'groups.view',
    'groups.manage',
    'registration_requests.view',
    'registration_requests.manage',
    'schedules.doctor',
    'schedules.ta',
    'schedules.manage',
    'schedules.timetable',
    'exams.view',
    'exams.create',
    'quizzes.view',
    'tasks.view',
    'tasks.grade',
    'attendance.view',
    'attendance.manage',
    'warnings.view',
    'records.view',
    'notifications.view',
    'profile.view',
    'settings.view',
  ],

  DEPARTMENT_ADMIN: [
    'dashboard.view',
    'departments.view',
    'courses.view',
    'students.view',
    'doctors.view',
    'teaching_assistants.view',
    'groups.view',
    'groups.manage',
    'registration_requests.view',
    'registration_requests.manage',
    'schedules.doctor',
    'schedules.ta',
    'schedules.manage',
    'schedules.timetable',
    'exams.view',
    'quizzes.view',
    'tasks.view',
    'tasks.grade',
    'attendance.view',
    'attendance.manage',
    'warnings.view',
    'records.view',
    'notifications.view',
    'profile.view',
    'settings.view',
  ],

  DOCTOR: [
    'dashboard.view',
    'courses.view',
    'schedules.doctor',
    'schedules.timetable',
    'exams.view',
    'exams.create',
    'exams.submissions',
    'quizzes.view',
    'quizzes.create',
    'tasks.view',
    'tasks.create',
    'tasks.grade',
    'attendance.view',
    'attendance.manage',
    'warnings.view',
    'records.view',
    'notifications.view',
    'profile.view',
    'settings.view',
  ],

  TEACHING_ASSISTANT: [
    'dashboard.view',
    'courses.view',
    'schedules.ta',
    'schedules.timetable',
    'quizzes.view',
    'tasks.view',
    'attendance.view',
    'warnings.view',
    'notifications.view',
    'profile.view',
    'settings.view',
  ],

  STUDENT: [
    'dashboard.view',
    'courses.view',
    'schedules.student',
    'schedules.timetable',
    'exams.view',
    'exams.take',
    'quizzes.view',
    'quizzes.take',
    'tasks.view',
    'tasks.submit',
    'attendance.view',
    'warnings.view',
    'statistics.view',
    'records.view',
    'degree_audit.view',
    'notifications.view',
    'profile.view',
    'settings.view',
  ],
};

/**
 * Check if a role possesses a specific capability.
 */
export function hasCapability(
  role: UserRole | string | undefined | null,
  capability: Capability
): boolean {
  if (!role) return false;
  if (role === 'SUPER_ADMIN') return true;
  const capabilities = ROLE_CAPABILITY_MATRIX[role as UserRole];
  return capabilities ? capabilities.includes(capability) : false;
}

/**
 * Get all roles that possess a given capability.
 */
export function getRolesForCapability(capability: Capability): UserRole[] {
  return ALL_ROLES.filter((role) => hasCapability(role, capability));
}

/**
 * Check if a role matches any of the required capabilities.
 */
export function hasAnyCapability(
  role: UserRole | string | undefined | null,
  capabilities: Capability[]
): boolean {
  return capabilities.some((cap) => hasCapability(role, cap));
}

/**
 * Route-to-capability definition mapping.
 * Used by ProtectedRoute and Route Guards to enforce capability rules.
 */
export const ROUTE_CAPABILITY_MAP: Record<string, Capability> = {
  '/dashboard': 'dashboard.view',
  '/colleges': 'colleges.view',
  '/departments': 'departments.view',
  '/courses': 'courses.view',
  '/students': 'students.view',
  '/doctors': 'doctors.view',
  '/teaching-assistants': 'teaching_assistants.view',
  '/admins': 'admins.view',
  '/groups': 'groups.view',
  '/registration-requests': 'registration_requests.view',
  '/schedules/doctor': 'schedules.doctor',
  '/schedules/ta': 'schedules.ta',
  '/schedules/student': 'schedules.student',
  '/schedules/timetable': 'schedules.timetable',
  '/schedules-management': 'schedules.manage',
  '/timetables-management': 'schedules.manage',
  '/exams': 'exams.view',
  '/exams/create': 'exams.create',
  '/quizzes': 'quizzes.view',
  '/quizzes/create': 'quizzes.create',
  '/tasks': 'tasks.view',
  '/attendance': 'attendance.view',
  '/warnings': 'warnings.view',
  '/statistics': 'statistics.view',
  '/record': 'records.view',
  '/finance': 'finance.view',
  '/analytics': 'analytics.view',
  '/notifications': 'notifications.view',
  '/profile': 'profile.view',
  '/settings': 'settings.view',
};

/**
 * Check if a role is allowed to access a given URL route.
 */
export function canAccessRoute(
  role: UserRole | string | undefined | null,
  routePath: string
): boolean {
  if (!role) return false;
  if (role === 'SUPER_ADMIN') return true;

  // Direct map match
  const directCap = ROUTE_CAPABILITY_MAP[routePath];
  if (directCap) {
    return hasCapability(role, directCap);
  }

  // Prefix/wildcard match
  for (const [routePattern, cap] of Object.entries(ROUTE_CAPABILITY_MAP)) {
    if (routePath.startsWith(routePattern)) {
      return hasCapability(role, cap);
    }
  }

  // Open routes within protected shell (e.g. general pages)
  return true;
}
