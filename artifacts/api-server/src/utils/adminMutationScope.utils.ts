import { getScopeWhere, type UserScope } from './scope.utils';

export type AdminMutationEntity = 'college' | 'department' | 'course' | 'student';

const ADMIN_MUTATION_ROLES = new Set([
  'SUPER_ADMIN',
  'ADMIN',
  'COLLEGE_ADMIN',
  'DEPARTMENT_ADMIN',
]);

const denyAll = (): Record<string, unknown> => ({
  AND: [{ id: { equals: 0 } }, { id: { not: 0 } }],
});

export function getAdminMutationScopeWhere(
  user: UserScope | null | undefined,
  entity: AdminMutationEntity
): Record<string, unknown> {
  if (!user?.role || !ADMIN_MUTATION_ROLES.has(user.role)) return denyAll();
  if (user.role === 'SUPER_ADMIN') return {};
  if (
    (user.role === 'ADMIN' || user.role === 'COLLEGE_ADMIN') &&
    (!Number.isInteger(user.managedCollegeId) || (user.managedCollegeId as number) <= 0)
  ) {
    return denyAll();
  }
  if (
    user.role === 'DEPARTMENT_ADMIN' &&
    (!Number.isInteger(user.managedDepartmentId) || (user.managedDepartmentId as number) <= 0)
  ) {
    return denyAll();
  }

  const scope = getScopeWhere(user, entity);
  if (Object.keys(scope).length === 0 || (Object.keys(scope).length === 1 && scope.id === -1)) {
    return denyAll();
  }

  return scope;
}

export function getAdminMutationTargetWhere(
  user: UserScope | null | undefined,
  entity: AdminMutationEntity,
  id: number
): Record<string, unknown> {
  return {
    AND: [{ id }, getAdminMutationScopeWhere(user, entity)],
  };
}

export function canManageUnassignedAdminResource(user: UserScope | null | undefined): boolean {
  return user?.role === 'SUPER_ADMIN';
}
