import {
  getScopeWhere as getLegacyScopeWhere,
  type UserScope,
} from './scope.utils';

export const STRICT_SCOPE_ENTITIES = [
  'department',
  'course',
  'exam',
  'student',
  'doctor',
  'teachingAssistant',
  'timetable',
  'payment',
  'user',
  'enrollment',
] as const;

export type StrictScopeEntity = (typeof STRICT_SCOPE_ENTITIES)[number];

const SUPPORTED_ROLES = new Set([
  'SUPER_ADMIN',
  'ADMIN',
  'COLLEGE_ADMIN',
  'DEPARTMENT_ADMIN',
  'DOCTOR',
  'TEACHING_ASSISTANT',
  'STUDENT',
]);

const isStrictScopeEntity = (entity: unknown): entity is StrictScopeEntity =>
  typeof entity === 'string' &&
  (STRICT_SCOPE_ENTITIES as readonly string[]).includes(entity);

const denyAll = (): Record<string, any> => ({
  AND: [{ id: { equals: 0 } }, { id: { not: 0 } }],
});

const isLegacyDenyAll = (where: Record<string, any>): boolean =>
  Object.keys(where).length === 1 && where.id === -1;

/**
 * Strict, fail-closed scope primitive for new call sites.
 *
 * Existing callers intentionally remain on scope.utils.ts until they can be
 * migrated and verified separately.
 */
export const getScopeWhere = (
  user: UserScope | undefined | null,
  entity: StrictScopeEntity
): Record<string, any> => {
  if (!user || !isStrictScopeEntity(entity) || !SUPPORTED_ROLES.has(String(user.role))) {
    return denyAll();
  }

  if (user.role === 'SUPER_ADMIN') return {};

  const where = getLegacyScopeWhere(user, entity);
  if (Object.keys(where).length === 0 || isLegacyDenyAll(where)) return denyAll();

  return where;
};
