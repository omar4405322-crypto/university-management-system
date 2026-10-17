/**
 * Pure TypeScript selection rules and state transitions for schedule management tables.
 * Framework-agnostic: no React dependencies.
 */

export const ADMIN_SELECTION_ROLES = [
  'SUPER_ADMIN',
  'ADMIN',
  'COLLEGE_ADMIN',
  'DEPARTMENT_ADMIN',
] as const;

export type AdminSelectionRole = (typeof ADMIN_SELECTION_ROLES)[number];

/**
 * Checks if the specified user role is permitted to use bulk selection.
 * Only administrative roles are allowed; students, doctors, and TAs return false.
 */
export function isSelectionAllowedForRole(role?: string | null): boolean {
  if (!role) return false;
  return (ADMIN_SELECTION_ROLES as readonly string[]).includes(role);
}

/**
 * Toggles single item selection.
 */
export function toggleOne<T extends string | number>(selected: Set<T>, id: T): Set<T> {
  const next = new Set(selected);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  return next;
}

/**
 * Determines whether all items on the current page are currently selected.
 */
export function isAllPageSelected<T extends string | number>(
  selected: Set<T>,
  currentPageIds: T[]
): boolean {
  if (!currentPageIds.length) return false;
  return currentPageIds.every((id) => selected.has(id));
}

/**
 * Determines whether some (but not all) items on the current page are currently selected (indeterminate state).
 */
export function isSomePageSelected<T extends string | number>(
  selected: Set<T>,
  currentPageIds: T[]
): boolean {
  if (!currentPageIds.length) return false;
  const allSelected = isAllPageSelected(selected, currentPageIds);
  if (allSelected) return false;
  return currentPageIds.some((id) => selected.has(id));
}

/**
 * Toggles selection for all items on the current page.
 * If all items on the current page are selected, deselects them.
 * Otherwise, selects all items on the current page.
 * Preserves selections from other pages.
 */
export function toggleCurrentPage<T extends string | number>(
  selected: Set<T>,
  currentPageIds: T[]
): Set<T> {
  const next = new Set(selected);
  if (!currentPageIds.length) return next;

  const allSelected = isAllPageSelected(selected, currentPageIds);
  if (allSelected) {
    currentPageIds.forEach((id) => next.delete(id));
  } else {
    currentPageIds.forEach((id) => next.add(id));
  }
  return next;
}

/**
 * Clears the selection set completely.
 */
export function clearSelection<T extends string | number>(): Set<T> {
  return new Set<T>();
}
