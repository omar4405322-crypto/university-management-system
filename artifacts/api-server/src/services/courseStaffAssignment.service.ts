import prisma from '../utils/prismaClient';

/**
 * Checks whether a doctor is assigned to teach a course, optionally restricted to an academic term.
 * Assignment is defined via active (isArchived: false) ScheduleSlots.
 */
export async function isDoctorAssignedToCourse(
  doctorId: number,
  courseId: number,
  termId?: number
): Promise<boolean> {
  const slot = await prisma.scheduleSlot.findFirst({
    where: {
      courseId,
      doctorId,
      isArchived: false,
      ...(termId !== undefined && termId !== null ? { termId } : {}),
    },
    select: { id: true },
  });
  return slot !== null;
}

/**
 * Checks whether a teaching assistant is assigned to a course, optionally restricted to an academic term.
 * Assignment is defined via active (isArchived: false) ScheduleSlots.
 */
export async function isTAAssignedToCourse(
  taId: string,
  courseId: number,
  termId?: number
): Promise<boolean> {
  const slot = await prisma.scheduleSlot.findFirst({
    where: {
      courseId,
      teachingAssistantId: taId,
      isArchived: false,
      ...(termId !== undefined && termId !== null ? { termId } : {}),
    },
    select: { id: true },
  });
  return slot !== null;
}

/**
 * Checks whether a student is enrolled in a course, optionally restricted to an academic term.
 */
export async function isStudentEnrolledInCourse(
  studentId: number,
  courseId: number,
  termId?: number
): Promise<boolean> {
  const enrollment = await prisma.enrollment.findFirst({
    where: {
      studentId,
      courseId,
      status: { in: ['ENROLLED', 'COMPLETED', 'FAILED'] },
      ...(termId !== undefined && termId !== null ? { termId } : {}),
    },
    select: { id: true },
  });
  return enrollment !== null;
}

/**
 * Evaluates whether an authenticated actor has read access to the grade structure of a course.
 */
export async function canUserReadGradeStructure(
  actor: any,
  courseId: number,
  termId: number,
  course?: { id: number; departmentId?: number | null; department?: { id: number; collegeId?: number | null } | null } | null
): Promise<boolean> {
  if (!actor || !actor.role) return false;

  if (actor.role === 'SUPER_ADMIN') return true;

  // Resolve course with department/college if not passed
  let resolvedCourse = course;
  if (!resolvedCourse) {
    resolvedCourse = await prisma.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        departmentId: true,
        department: { select: { id: true, collegeId: true } },
      },
    });
  }
  if (!resolvedCourse) return false;

  if (actor.role === 'COLLEGE_ADMIN' || actor.role === 'ADMIN') {
    const managedCollegeId = actor.managedCollegeId || actor.collegeId;
    if (!managedCollegeId) return false;
    return resolvedCourse.department?.collegeId === managedCollegeId;
  }

  if (actor.role === 'DEPARTMENT_ADMIN') {
    const managedDeptId = actor.managedDepartmentId || actor.departmentId;
    if (!managedDeptId) return false;
    return resolvedCourse.departmentId === managedDeptId;
  }

  if (actor.role === 'DOCTOR') {
    const doctorId = actor.doctor?.id;
    if (!doctorId) return false;
    return await isDoctorAssignedToCourse(doctorId, courseId, termId);
  }

  if (actor.role === 'TEACHING_ASSISTANT') {
    const taId = actor.teachingAssistant?.id;
    if (!taId) return false;
    return await isTAAssignedToCourse(taId, courseId, termId);
  }

  if (actor.role === 'STUDENT') {
    const studentId = actor.student?.id;
    if (!studentId) return false;
    return await isStudentEnrolledInCourse(studentId, courseId, termId);
  }

  return false;
}

/**
 * Evaluates whether an authenticated actor has write/modify access to the grade structure of a course.
 * TAs and Students are strictly forbidden.
 */
export async function canUserWriteGradeStructure(
  actor: any,
  courseId: number,
  termId: number,
  course?: { id: number; departmentId?: number | null; department?: { id: number; collegeId?: number | null } | null } | null
): Promise<boolean> {
  if (!actor || !actor.role) return false;

  if (actor.role === 'SUPER_ADMIN') return true;

  // Resolve course with department/college if not passed
  let resolvedCourse = course;
  if (!resolvedCourse) {
    resolvedCourse = await prisma.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        departmentId: true,
        department: { select: { id: true, collegeId: true } },
      },
    });
  }
  if (!resolvedCourse) return false;

  if (actor.role === 'COLLEGE_ADMIN' || actor.role === 'ADMIN') {
    const managedCollegeId = actor.managedCollegeId || actor.collegeId;
    if (!managedCollegeId) return false;
    return resolvedCourse.department?.collegeId === managedCollegeId;
  }

  if (actor.role === 'DEPARTMENT_ADMIN') {
    const managedDeptId = actor.managedDepartmentId || actor.departmentId;
    if (!managedDeptId) return false;
    return resolvedCourse.departmentId === managedDeptId;
  }

  // Doctor, TA, and Student are read-only per S2
  return false;
}
