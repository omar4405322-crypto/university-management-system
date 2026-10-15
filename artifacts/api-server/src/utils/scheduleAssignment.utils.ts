import { AuthorizationError } from './appError';

type ScheduleAssignmentClient = {
  scheduleSlot: {
    findFirst: (args: { where: Record<string, unknown>; select: { id: true } }) => Promise<unknown>;
  };
  course?: {
    findUnique: (args: { where: { id: number }; select: { departmentId: true } }) => Promise<{ departmentId: number | null } | null>;
  };
  doctor?: {
    findUnique: (args: { where: { id: number }; select: { departmentId: true } }) => Promise<{ departmentId: number | null } | null>;
  };
  teachingAssistant?: {
    findUnique: (args: { where: { id: string }; select: { departmentId: true } }) => Promise<{ departmentId: number | null } | null>;
  };
};

type ScheduleAssignmentRequirement = {
  courseId: number;
  doctorId?: number | null;
  teachingAssistantId?: string | null;
  excludeSlotId?: number;
};

/**
 * Schedule slots are the current source of truth for staff/course assignments.
 * A general schedule mutation may add slots for an assignment, or allow scheduling
 * a Doctor or TA belonging to the course's department on their first slot.
 */
export async function requireExistingCourseStaffAssignments(
  client: ScheduleAssignmentClient,
  requirement: ScheduleAssignmentRequirement
): Promise<void> {
  const excludeCurrentSlot = requirement.excludeSlotId
    ? { id: { not: requirement.excludeSlotId } }
    : {};

  if (requirement.doctorId !== undefined && requirement.doctorId !== null) {
    const doctorAssignment = await client.scheduleSlot.findFirst({
      where: {
        courseId: requirement.courseId,
        doctorId: requirement.doctorId,
        isArchived: false,
        ...excludeCurrentSlot,
      },
      select: { id: true },
    });

    if (!doctorAssignment) {
      let isDepartmentStaff = false;
      if (client.course?.findUnique && client.doctor?.findUnique) {
        const course = await client.course.findUnique({
          where: { id: requirement.courseId },
          select: { departmentId: true },
        });
        const doctor = await client.doctor.findUnique({
          where: { id: requirement.doctorId },
          select: { departmentId: true },
        });
        if (
          course?.departmentId &&
          doctor?.departmentId &&
          course.departmentId === doctor.departmentId
        ) {
          isDepartmentStaff = true;
        }
      }

      if (!isDepartmentStaff) {
        throw new AuthorizationError('Doctor must already be assigned to the target course');
      }
    }
  }

  if (
    requirement.teachingAssistantId !== undefined &&
    requirement.teachingAssistantId !== null
  ) {
    const teachingAssistantAssignment = await client.scheduleSlot.findFirst({
      where: {
        courseId: requirement.courseId,
        teachingAssistantId: requirement.teachingAssistantId,
        isArchived: false,
        ...excludeCurrentSlot,
      },
      select: { id: true },
    });

    if (!teachingAssistantAssignment) {
      let isDepartmentStaff = false;
      if (client.course?.findUnique && client.teachingAssistant?.findUnique) {
        const course = await client.course.findUnique({
          where: { id: requirement.courseId },
          select: { departmentId: true },
        });
        const ta = await client.teachingAssistant.findUnique({
          where: { id: requirement.teachingAssistantId },
          select: { departmentId: true },
        });
        if (
          course?.departmentId &&
          ta?.departmentId &&
          course.departmentId === ta.departmentId
        ) {
          isDepartmentStaff = true;
        }
      }

      if (!isDepartmentStaff) {
        throw new AuthorizationError(
          'Teaching assistant must already be assigned to the target course'
        );
      }
    }
  }
}
