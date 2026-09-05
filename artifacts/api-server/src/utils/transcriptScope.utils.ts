import { getScopeWhere, type UserScope } from './scope.utils';

const TRANSCRIPT_OVERVIEW_ROLES = new Set([
  'SUPER_ADMIN',
  'ADMIN',
  'COLLEGE_ADMIN',
  'DEPARTMENT_ADMIN',
  'DOCTOR',
]);

export interface TranscriptOverviewWhere {
  exam: Record<string, unknown>;
  quiz: Record<string, unknown>;
  task: Record<string, unknown>;
}

export function getTranscriptOverviewWhere(
  user: UserScope,
  completedBefore: Date
): TranscriptOverviewWhere | null {
  if (!user.role || !TRANSCRIPT_OVERVIEW_ROLES.has(user.role)) return null;

  const courseScope = getScopeWhere(user, 'course');

  return {
    exam: {
      AND: [{ date: { lte: completedBefore } }, getScopeWhere(user, 'exam')],
    },
    quiz: {
      AND: [{ endTime: { lte: completedBefore } }, { course: courseScope }],
    },
    task: {
      AND: [{ dueDate: { lte: completedBefore } }, { course: courseScope }],
    },
  };
}
