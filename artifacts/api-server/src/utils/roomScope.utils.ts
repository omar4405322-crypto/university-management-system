import { getAdminMutationScopeWhere } from './adminMutationScope.utils';
import type { UserScope } from './scope.utils';

const denyAll = (): Record<string, unknown> => ({
  AND: [{ id: { equals: 0 } }, { id: { not: 0 } }],
});

export function getRoomCoordinateAccessWhere(
  user: UserScope | null | undefined,
  roomId: number
): Record<string, unknown> {
  if (user?.role === 'SUPER_ADMIN') return { id: roomId };

  if (
    user?.role === 'ADMIN' ||
    user?.role === 'COLLEGE_ADMIN' ||
    user?.role === 'DEPARTMENT_ADMIN'
  ) {
    return {
      AND: [
        { id: roomId },
        {
          scheduleSlots: {
            some: { course: getAdminMutationScopeWhere(user, 'course') },
          },
        },
      ],
    };
  }

  if (user?.role === 'DOCTOR' && Number.isInteger(user.doctor?.id)) {
    return {
      AND: [
        { id: roomId },
        { scheduleSlots: { some: { doctorId: user.doctor.id } } },
      ],
    };
  }

  return { AND: [{ id: roomId }, denyAll()] };
}
