import { getScopeWhere, type UserScope } from './scope.utils';

export interface SearchScopes {
  student: Record<string, unknown>;
  doctor: Record<string, unknown>;
  course: Record<string, unknown>;
  college: Record<string, unknown>;
  department: Record<string, unknown>;
}

const SEARCH_ROLES = new Set([
  'SUPER_ADMIN',
  'ADMIN',
  'COLLEGE_ADMIN',
  'DEPARTMENT_ADMIN',
  'DOCTOR',
  'TEACHING_ASSISTANT',
]);

function hasRequiredSearchScope(user: UserScope): boolean {
  if (user.role === 'SUPER_ADMIN') return true;
  if (user.role === 'ADMIN' || user.role === 'COLLEGE_ADMIN') {
    const managedCollegeId = user.managedCollegeId;
    return Number.isInteger(managedCollegeId) && (managedCollegeId as number) > 0;
  }
  if (user.role === 'DEPARTMENT_ADMIN') {
    const managedDepartmentId = user.managedDepartmentId;
    return Number.isInteger(managedDepartmentId) && (managedDepartmentId as number) > 0;
  }
  if (user.role === 'DOCTOR') return Number.isInteger(user.doctor?.id) && user.doctor.id > 0;
  if (user.role === 'TEACHING_ASSISTANT') {
    return Number.isInteger(user.teachingAssistant?.id) && user.teachingAssistant.id > 0;
  }
  return false;
}

export function getSearchScopes(user: UserScope | null | undefined): SearchScopes | null {
  if (!user?.role || !SEARCH_ROLES.has(user.role) || !hasRequiredSearchScope(user)) return null;

  return {
    student: getScopeWhere(user, 'student'),
    doctor: getScopeWhere(user, 'doctor'),
    course: getScopeWhere(user, 'course'),
    college: getScopeWhere(user, 'college'),
    department: getScopeWhere(user, 'department'),
  };
}
