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

  const role = (user.role || '').toString().toUpperCase();
  const adminRole = (user.adminRole || '').toString().toUpperCase();

  // 1. Scoped Department Administrator:
  // Role is DEPARTMENT_ADMIN, or identity constrained to managedDepartmentId (without higher global unconstrained status)
  const hasManagedDept = Number.isInteger(user.managedDepartmentId) && (user.managedDepartmentId as number) > 0;
  const isDeptRole = role === 'DEPARTMENT_ADMIN' || adminRole === 'DEPARTMENT_ADMIN';

  if (isDeptRole || (hasManagedDept && !user.managedCollegeId)) {
    const departmentId = user.managedDepartmentId;
    if (!Number.isInteger(departmentId) || (departmentId as number) <= 0) return null;

    const scopedUser: UserScope = { ...user, role: 'DEPARTMENT_ADMIN', managedDepartmentId: departmentId };

    return {
      cacheScope: `department:${departmentId}`,
      college: getScopeWhere(scopedUser, 'college'),
      department: getScopeWhere(scopedUser, 'department'),
      student: getScopeWhere(scopedUser, 'student'),
      doctor: getScopeWhere(scopedUser, 'doctor'),
      course: getScopeWhere(scopedUser, 'course'),
      exam: getScopeWhere(scopedUser, 'exam'),
      payment: getScopeWhere(scopedUser, 'payment'),
      user: getScopeWhere(scopedUser, 'user'),
    };
  }

  // 2. Scoped College Administrator:
  // Role is COLLEGE_ADMIN or ADMIN with managedCollegeId, or any identity constrained by managedCollegeId
  const hasManagedCollege = Number.isInteger(user.managedCollegeId) && (user.managedCollegeId as number) > 0;
  const isCollegeRole = role === 'COLLEGE_ADMIN' || adminRole === 'COLLEGE_ADMIN';

  if (isCollegeRole || hasManagedCollege) {
    const collegeId = user.managedCollegeId;
    if (!Number.isInteger(collegeId) || (collegeId as number) <= 0) return null;

    const scopedUser: UserScope = { ...user, role: 'COLLEGE_ADMIN', managedCollegeId: collegeId };

    return {
      cacheScope: `college:${collegeId}`,
      college: getScopeWhere(scopedUser, 'college'),
      department: getScopeWhere(scopedUser, 'department'),
      student: getScopeWhere(scopedUser, 'student'),
      doctor: getScopeWhere(scopedUser, 'doctor'),
      course: getScopeWhere(scopedUser, 'course'),
      exam: getScopeWhere(scopedUser, 'exam'),
      payment: getScopeWhere(scopedUser, 'payment'),
      user:
        role === 'ADMIN'
          ? collegeUserScope(collegeId as number)
          : getScopeWhere(scopedUser, 'user'),
    };
  }

  // 3. True Platform / Global Administrator:
  // Must be SUPER_ADMIN (or platform ADMIN with explicit adminRole='SUPER_ADMIN')
  // and MUST NOT have any tenant constraints (no managedCollegeId, no managedDepartmentId, and no tenant adminRole)
  const isPlatformSuperAdmin =
    (role === 'SUPER_ADMIN' || (role === 'ADMIN' && adminRole === 'SUPER_ADMIN')) &&
    !user.managedCollegeId &&
    !user.managedDepartmentId &&
    adminRole !== 'COLLEGE_ADMIN' &&
    adminRole !== 'DEPARTMENT_ADMIN';

  if (isPlatformSuperAdmin) {
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

  // 4. Default Fail-Closed:
  // Generic ADMIN or non-admin roles without verified tenant scope or platform authority cannot access analytics
  return null;
}
