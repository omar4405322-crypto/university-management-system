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

export function getScheduleSlotOverrideAccessWhere(
  user: UserScope | null | undefined
): Record<string, unknown> {
  if (!user?.role) return denyAll();

  if (ADMIN_ROLES.has(user.role)) {
    return { course: getAdminMutationScopeWhere(user, 'course') };
  }

  if (user.role === 'DOCTOR') {
    return Number.isInteger(user.doctor?.id)
      ? { doctorId: user.doctor.id }
      : denyAll();
  }

  if (user.role === 'TEACHING_ASSISTANT') {
    return typeof user.teachingAssistant?.id === 'string' && user.teachingAssistant.id.length > 0
      ? { teachingAssistantId: user.teachingAssistant.id }
      : denyAll();
  }

  if (user.role === 'STUDENT') {
    return Number.isInteger(user.student?.id)
      ? {
          course: {
            enrollments: {
              some: { studentId: user.student.id, status: 'ENROLLED' },
            },
          },
        }
      : denyAll();
  }

  return denyAll();
}

export function getScopedScheduleSlotForOverrideWhere(
  user: UserScope | null | undefined,
  slotId: number
): Record<string, unknown> {
  return {
    AND: [{ id: slotId }, getScheduleSlotOverrideAccessWhere(user)],
  };
}

export function getScopedScheduleOverrideWhere(
  user: UserScope | null | undefined,
  overrideId: number
): Record<string, unknown> {
  return {
    AND: [
      { id: overrideId },
      { scheduleSlot: getScheduleSlotOverrideAccessWhere(user) },
    ],
  };
}
