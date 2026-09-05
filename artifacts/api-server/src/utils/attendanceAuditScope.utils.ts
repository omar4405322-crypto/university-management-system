import { getAdminMutationScopeWhere } from './adminMutationScope.utils';
import type { UserScope } from './scope.utils';

const ADMIN_ROLES = new Set([
  'SUPER_ADMIN',
  'ADMIN',
  'COLLEGE_ADMIN',
  'DEPARTMENT_ADMIN',
]);

const denyAll = (): Record<string, unknown> => ({
  AND: [{ id: { equals: 0 } }, { id: { not: 0 } }],
});

export function getAttendanceAuditCourseWhere(
  user: UserScope | null | undefined
): Record<string, unknown> {
  return user?.role && ADMIN_ROLES.has(user.role)
    ? getAdminMutationScopeWhere(user, 'course')
    : denyAll();
}

export function getFlagOverrideAttendanceWhere(
  user: UserScope | null | undefined,
  attendanceId: number
): Record<string, unknown> {
  if (!user?.role) return { AND: [{ id: attendanceId }, denyAll()] };

  if (ADMIN_ROLES.has(user.role)) {
    return {
      AND: [
        { id: attendanceId },
        { course: getAdminMutationScopeWhere(user, 'course') },
      ],
    };
  }

  if (user.role === 'DOCTOR' && Number.isInteger(user.doctor?.id)) {
    const doctorId = user.doctor.id;
    return {
      AND: [
        { id: attendanceId },
        { course: { scheduleSlots: { some: { doctorId } } } },
        {
          session: {
            is: {
              OR: [
                { doctorId },
                { scheduleSlot: { is: { doctorId } } },
              ],
            },
          },
        },
      ],
    };
  }

  if (
    user.role === 'TEACHING_ASSISTANT' &&
    typeof user.teachingAssistant?.id === 'string' &&
    user.teachingAssistant.id.length > 0
  ) {
    const teachingAssistantId = user.teachingAssistant.id;
    return {
      AND: [
        { id: attendanceId },
        {
          course: {
            scheduleSlots: { some: { teachingAssistantId } },
          },
        },
        {
          session: {
            is: {
              scheduleSlot: { is: { teachingAssistantId } },
            },
          },
        },
      ],
    };
  }

  return { AND: [{ id: attendanceId }, denyAll()] };
}
