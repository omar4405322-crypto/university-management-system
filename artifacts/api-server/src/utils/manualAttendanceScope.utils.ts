import prisma from './prismaClient';
import { AppError, AuthorizationError } from './appError';
import { getAdminMutationScopeWhere } from './adminMutationScope.utils';
import type { DriverValidationContext } from '../attendance/drivers/IAttendanceDriver';
import type { UserScope } from './scope.utils';

export interface ManualAttendanceAccess {
  courseId: number;
  sessionId?: number;
}

const ADMIN_ROLES = new Set([
  'SUPER_ADMIN',
  'ADMIN',
  'COLLEGE_ADMIN',
  'DEPARTMENT_ADMIN',
]);

const manualAccessCache = Symbol('manualAttendanceAccess');
type CachedContext = DriverValidationContext & {
  [manualAccessCache]?: {
    key: string;
    result: Promise<ManualAttendanceAccess>;
  };
};

function positiveInteger(value: unknown, field: string): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new AppError(`${field} must be a positive integer`, 400);
  }
  return parsed;
}

export function getManualAttendanceCourseWhere(
  actor: UserScope | null | undefined,
  courseId: number
): Record<string, unknown> {
  if (actor?.role && ADMIN_ROLES.has(actor.role)) {
    return {
      AND: [{ id: courseId }, getAdminMutationScopeWhere(actor, 'course')],
    };
  }

  if (actor?.role === 'DOCTOR' && Number.isInteger(actor.doctor?.id)) {
    return {
      AND: [
        { id: courseId },
        { scheduleSlots: { some: { doctorId: actor.doctor.id } } },
      ],
    };
  }

  if (
    actor?.role === 'TEACHING_ASSISTANT' &&
    typeof actor.teachingAssistant?.id === 'string' &&
    actor.teachingAssistant.id.length > 0
  ) {
    return {
      AND: [
        { id: courseId },
        {
          scheduleSlots: {
            some: { teachingAssistantId: actor.teachingAssistant.id },
          },
        },
      ],
    };
  }

  return { AND: [{ id: courseId }, { id: { equals: 0 } }, { id: { not: 0 } }] };
}

export function getManualAttendanceSessionWhere(
  actor: UserScope | null | undefined,
  sessionId: number,
  courseId?: number
): Record<string, unknown> {
  const courseMatch = courseId ? { courseId } : {};

  if (actor?.role && ADMIN_ROLES.has(actor.role)) {
    return {
      AND: [
        { id: sessionId },
        {
          scheduleSlot: {
            is: {
              ...courseMatch,
              course: getAdminMutationScopeWhere(actor, 'course'),
            },
          },
        },
      ],
    };
  }

  if (actor?.role === 'DOCTOR' && Number.isInteger(actor.doctor?.id)) {
    return {
      AND: [
        { id: sessionId },
        {
          scheduleSlot: {
            is: { ...courseMatch, doctorId: actor.doctor.id },
          },
        },
      ],
    };
  }

  if (
    actor?.role === 'TEACHING_ASSISTANT' &&
    typeof actor.teachingAssistant?.id === 'string' &&
    actor.teachingAssistant.id.length > 0
  ) {
    return {
      AND: [
        { id: sessionId },
        {
          scheduleSlot: {
            is: {
              ...courseMatch,
              teachingAssistantId: actor.teachingAssistant.id,
            },
          },
        },
      ],
    };
  }

  return { AND: [{ id: sessionId }, { id: { equals: 0 } }, { id: { not: 0 } }] };
}

export async function requireManualAttendanceAccess(
  payload: Record<string, unknown>,
  context: DriverValidationContext
): Promise<ManualAttendanceAccess> {
  const sessionId = positiveInteger(
    payload.sessionId ?? context.sessionId,
    'Session ID'
  );
  const courseId = positiveInteger(
    payload.courseId ?? context.courseId,
    'Course ID'
  );
  if (!sessionId && !courseId) {
    throw new AppError('Either courseId or sessionId must be provided', 400);
  }
  if (!context.actor?.role) {
    throw new AuthorizationError('Authenticated staff identity is required');
  }

  const cachedContext = context as CachedContext;
  const key = `${sessionId ?? ''}:${courseId ?? ''}`;
  const cached = cachedContext[manualAccessCache];
  if (cached?.key === key) {
    return cached.result;
  }
  if (cached) {
    const cachedAccess = await cached.result;
    if (
      cachedAccess.sessionId === sessionId &&
      (!courseId || cachedAccess.courseId === courseId)
    ) {
      return cachedAccess;
    }
    if (!sessionId && !cachedAccess.sessionId && cachedAccess.courseId === courseId) {
      return cachedAccess;
    }
  }

  const result = (async (): Promise<ManualAttendanceAccess> => {
    if (sessionId) {
      const session = await prisma.attendanceSession.findFirst({
        where: getManualAttendanceSessionWhere(context.actor, sessionId, courseId),
        select: {
          scheduleSlot: { select: { courseId: true } },
        },
      });
      if (!session) {
        throw new AuthorizationError(
          'You are not authorized to record attendance for this session'
        );
      }
      return { sessionId, courseId: session.scheduleSlot.courseId };
    }

    const course = await prisma.course.findFirst({
      where: getManualAttendanceCourseWhere(context.actor, courseId!),
      select: { id: true },
    });
    if (!course) {
      throw new AuthorizationError(
        'You are not authorized to record attendance for this course'
      );
    }
    return { courseId: course.id };
  })();

  cachedContext[manualAccessCache] = { key, result };
  return result;
}
