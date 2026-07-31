export interface UserScope {
  role?: string;
  managedCollegeId?: number | null;
  managedDepartmentId?: number | null;
  [key: string]: any;
}

export type EntityType =
  | 'department'
  | 'course'
  | 'exam'
  | 'student'
  | 'timetable'
  | string;

export const getScopeWhere = (
  user: UserScope | undefined | null,
  entity?: EntityType
): Record<string, any> => {
  // Returns a Prisma where filter appropriate for the entity based on user scope
  if (!user) {
    if (entity === 'department') return {};
    return { id: -1 };
  }

  // SUPER_ADMIN: no filter
  if (user.role === 'SUPER_ADMIN') return {};

  // COLLEGE_ADMIN: scoped to managedCollegeId
  if (user.role === 'COLLEGE_ADMIN' && user.managedCollegeId) {
    // Most entities are related via department.collegeId; for department entity itself we filter by collegeId
    if (entity === 'department') return { collegeId: user.managedCollegeId };
    if (entity === 'course') return { department: { collegeId: user.managedCollegeId } };
    if (entity === 'exam') return { course: { department: { collegeId: user.managedCollegeId } } };
    if (entity === 'student') return { department: { collegeId: user.managedCollegeId } };
    if (entity === 'timetable') return { department: { collegeId: user.managedCollegeId } };
    return { department: { collegeId: user.managedCollegeId } };
  }

  // DEPARTMENT_ADMIN: scoped to managedDepartmentId
  if (user.role === 'DEPARTMENT_ADMIN' && user.managedDepartmentId) {
    // For department entity, match id; for others, departmentId
    if (entity === 'department') return { id: user.managedDepartmentId };
    if (entity === 'course') return { departmentId: user.managedDepartmentId };
    if (entity === 'exam') return { course: { departmentId: user.managedDepartmentId } };
    if (entity === 'student') return { departmentId: user.managedDepartmentId };
    if (entity === 'timetable') return { departmentId: user.managedDepartmentId };
    return { departmentId: user.managedDepartmentId };
  }

  // Backwards-compat: support legacy ADMIN with managedCollegeId (temporary)
  if (user.role === 'ADMIN' && user.managedCollegeId) {
    if (entity === 'department') return { collegeId: user.managedCollegeId };
    if (entity === 'course') return { department: { collegeId: user.managedCollegeId } };
    if (entity === 'exam') return { course: { department: { collegeId: user.managedCollegeId } } };
    if (entity === 'student') return { department: { collegeId: user.managedCollegeId } };
    if (entity === 'timetable') return { department: { collegeId: user.managedCollegeId } };
    return { department: { collegeId: user.managedCollegeId } };
  }

  // DOCTOR: scoped to the sections they teach
  if (user.role === 'DOCTOR' && user.doctor?.id) {
    if (entity === 'course') return { scheduleSlots: { some: { doctorId: user.doctor.id } } };
    if (entity === 'exam') return { course: { scheduleSlots: { some: { doctorId: user.doctor.id } } } };
    if (entity === 'timetable') return { doctorId: user.doctor.id }; // ScheduleSlot entity
    return { id: -1 }; // Doctors shouldn't query departments/students universally without scope
  }

  // TEACHING_ASSISTANT: scoped to the sections/slots they are assigned
  if (user.role === 'TEACHING_ASSISTANT' && user.teachingAssistant?.id) {
    if (entity === 'timetable') return { teachingAssistantId: user.teachingAssistant.id }; // ScheduleSlot entity
    return { id: -1 };
  }

  // STUDENT: scoped to their department and year OR explicit enrollments
  if (user.role === 'STUDENT' && user.student) {
    if (entity === 'exam') {
      return {
        course: {
          OR: [
            {
              departmentId: user.student.departmentId,
              year: user.student.year,
            },
            { enrollments: { some: { studentId: user.student.id } } },
          ],
        },
      };
    }
    if (entity === 'course') return {
      OR: [
        { 
          departmentId: user.student.departmentId,
          year: user.student.year
        },
        { enrollments: { some: { studentId: user.student.id } } }
      ]
    };
    if (entity === 'department') return { id: user.student.departmentId };
    if (entity === 'timetable') return { departmentId: user.student.departmentId };
    return { id: -1 };
  }

  return { id: -1 };
};
