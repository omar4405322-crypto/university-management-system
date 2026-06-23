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
  | 'teachingAssistant'
  | 'timetable'
  | string;

export const getScopeWhere = (
  user: UserScope | undefined | null,
  entity?: EntityType
): Record<string, any> => {
  // Returns a Prisma where filter appropriate for the entity based on user scope
  // NOTE: This function assumes the user is authenticated. Authentication must be
  // enforced by middleware (protect) before this is called. If user is null/undefined,
  // we return an impossible filter to prevent accidental data leakage, but the
  // primary defense is the auth middleware.
  if (!user) return { id: -1 }; // Defensive: impossible filter for unauthenticated

  // SUPER_ADMIN: no filter
  if (user.role === 'SUPER_ADMIN') return {};

  // DOCTOR: scoped to their own courses
  if (user.role === 'DOCTOR') {
    if (entity === 'course') return { doctor: { userId: user.id } };
    if (entity === 'schedule' || entity === 'timetable') return { course: { doctor: { userId: user.id } } };
    return {};
  }

  // TEACHING_ASSISTANT: scoped to their own schedules
  if (user.role === 'TEACHING_ASSISTANT') {
    if (entity === 'schedule') return { assistant: { userId: user.id } };
    if (entity === 'course') return { schedules: { some: { assistant: { userId: user.id } } } };
    return {};
  }

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
    if (entity === 'teachingAssistant') return { department: { collegeId: user.managedCollegeId } };
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
    if (entity === 'teachingAssistant') return { departmentId: user.managedDepartmentId };
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
    if (entity === 'teachingAssistant') return { department: { collegeId: user.managedCollegeId } };
    if (entity === 'timetable') return { department: { collegeId: user.managedCollegeId } };
    return { department: { collegeId: user.managedCollegeId } };
  }

  // For other authenticated roles (STUDENT, TEACHING_ASSISTANT, etc.), return empty scope
  // They should be handled by route-level authorization, not by data scoping
  return {};
};
