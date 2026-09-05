import { getScopeWhere, type UserScope } from './scope.utils';

export interface AdministrativeAnalyticsScopes {
  cacheScope: string;
  college: Record<string, unknown>;
  department: Record<string, unknown>;
  student: Record<string, unknown>;
  doctor: Record<string, unknown>;
  course: Record<string, unknown>;
  exam: Record<string, unknown>;
  payment: Record<string, unknown>;
  user: Record<string, unknown>;
}

function collegeUserScope(collegeId: number): Record<string, unknown> {
  return {
    OR: [
      { collegeId },
      { managedCollegeId: collegeId },
      { department: { collegeId } },
      { student: { department: { collegeId } } },
      { doctor: { department: { collegeId } } },
      { teachingAssistant: { department: { collegeId } } },
    ],
  };
}

export function getAdministrativeAnalyticsScopes(
  user: UserScope | null | undefined
): AdministrativeAnalyticsScopes | null {
  if (!user?.role) return null;

  if (user.role === 'SUPER_ADMIN') {
    return {
      cacheScope: 'global',
      college: {},
      department: {},
      student: {},
      doctor: {},
      course: {},
      exam: {},
      payment: {},
      user: {},
    };
  }

  if (user.role === 'ADMIN' || user.role === 'COLLEGE_ADMIN') {
    const collegeId = user.managedCollegeId;
    if (!Number.isInteger(collegeId) || (collegeId as number) <= 0) return null;

    return {
      cacheScope: `college:${collegeId}`,
      college: getScopeWhere(user, 'college'),
      department: getScopeWhere(user, 'department'),
      student: getScopeWhere(user, 'student'),
      doctor: getScopeWhere(user, 'doctor'),
      course: getScopeWhere(user, 'course'),
      exam: getScopeWhere(user, 'exam'),
      payment: getScopeWhere(user, 'payment'),
      user:
        user.role === 'ADMIN'
          ? collegeUserScope(collegeId as number)
          : getScopeWhere(user, 'user'),
    };
  }

  if (user.role === 'DEPARTMENT_ADMIN') {
    const departmentId = user.managedDepartmentId;
    if (!Number.isInteger(departmentId) || (departmentId as number) <= 0) return null;

    return {
      cacheScope: `department:${departmentId}`,
      college: getScopeWhere(user, 'college'),
      department: getScopeWhere(user, 'department'),
      student: getScopeWhere(user, 'student'),
      doctor: getScopeWhere(user, 'doctor'),
      course: getScopeWhere(user, 'course'),
      exam: getScopeWhere(user, 'exam'),
      payment: getScopeWhere(user, 'payment'),
      user: getScopeWhere(user, 'user'),
    };
  }

  return null;
}
