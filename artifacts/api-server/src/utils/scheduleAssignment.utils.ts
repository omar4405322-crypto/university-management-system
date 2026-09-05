import { AuthorizationError } from './appError';

type ScheduleAssignmentClient = {
  scheduleSlot: {
    findFirst: (args: { where: Record<string, unknown>; select: { id: true } }) => Promise<unknown>;
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
 * A general schedule mutation may add slots for an assignment, but it must not
 * create or transfer that assignment itself.
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
        ...excludeCurrentSlot,
      },
      select: { id: true },
    });

    if (!doctorAssignment) {
      throw new AuthorizationError('Doctor must already be assigned to the target course');
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
        ...excludeCurrentSlot,
      },
      select: { id: true },
    });

    if (!teachingAssistantAssignment) {
      throw new AuthorizationError(
        'Teaching assistant must already be assigned to the target course'
      );
    }
  }
}
