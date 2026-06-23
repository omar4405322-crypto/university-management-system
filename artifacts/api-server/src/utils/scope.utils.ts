export interface UserScope {
  role?: string;
  managedCollegeId?: number | null;
  managedDepartmentId?: number | null;
  [key: string]: any;
}

export type EntityType =
  | 'department'
  | 'course'
  | 'schedule'
  | 'exam'
  | 'student'
  | 'doctor'
  | 'timetable'
  | string;

export const getScopeWhere = (
  user: UserScope | undefined | null,
  entity?: EntityType
): Record<string, any> => {
  // Returns a Prisma where filter appropriate for the entity based on user scope
  if (!user) return { id: -1 };

  // SUPER_ADMIN: no filter
  if (user.role === 'SUPER_ADMIN') return {};

  // COLLEGE_ADMIN: scoped to managedCollegeId
  if (user.role === 'COLLEGE_ADMIN' && user.managedCollegeId) {
    // Most entities are related via department.collegeId; for department entity itself we filter by collegeId
    if (entity === 'department') return { collegeId: user.managedCollegeId };
    if (entity === 'course') return { department: { collegeId: user.managedCollegeId } };
    if (entity === 'schedule')
      return { course: { department: { collegeId: user.managedCollegeId } } };
    if (entity === 'exam') return { course: { department: { collegeId: user.managedCollegeId } } };
    if (entity === 'student') return { department: { collegeId: user.managedCollegeId } };
    if (entity === 'doctor') return { department: { collegeId: user.managedCollegeId } };
    if (entity === 'timetable') return { department: { collegeId: user.managedCollegeId } };
    return { department: { collegeId: user.managedCollegeId } };
  }

  // DEPARTMENT_ADMIN: scoped to managedDepartmentId
  if (user.role === 'DEPARTMENT_ADMIN' && user.managedDepartmentId) {
    // For department entity, match id; for others, departmentId
    if (entity === 'department') return { id: user.managedDepartmentId };
    if (entity === 'course') return { departmentId: user.managedDepartmentId };
    if (entity === 'schedule') return { course: { departmentId: user.managedDepartmentId } };
    if (entity === 'exam') return { course: { departmentId: user.managedDepartmentId } };
    if (entity === 'student') return { departmentId: user.managedDepartmentId };
    if (entity === 'doctor') return { departmentId: user.managedDepartmentId };
    if (entity === 'timetable') return { departmentId: user.managedDepartmentId };
    return { departmentId: user.managedDepartmentId };
  }

  // Backwards-compat: support legacy ADMIN with managedCollegeId (temporary)
  if (user.role === 'ADMIN' && user.managedCollegeId) {
    if (entity === 'department') return { collegeId: user.managedCollegeId };
    if (entity === 'course') return { department: { collegeId: user.managedCollegeId } };
    if (entity === 'schedule')
      return { course: { department: { collegeId: user.managedCollegeId } } };
    if (entity === 'exam') return { course: { department: { collegeId: user.managedCollegeId } } };
    if (entity === 'student') return { department: { collegeId: user.managedCollegeId } };
    if (entity === 'doctor') return { department: { collegeId: user.managedCollegeId } };
    if (entity === 'timetable') return { department: { collegeId: user.managedCollegeId } };
    return { department: { collegeId: user.managedCollegeId } };
  }

  return { id: -1 };
};
