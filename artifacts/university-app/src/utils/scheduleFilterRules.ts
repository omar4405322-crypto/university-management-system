/**
 * scheduleFilterRules.ts
 *
 * Pure TypeScript module defining role-scoped filter permissions and canonical day values
 * for schedule views across the UniCore web application.
 *
 * Invariants:
 * - Pure logic only: no React, hooks, or DOM dependencies.
 * - Unknown / undefined role = most restrictive filter set (['search', 'course', 'type', 'day']).
 * - Day values strictly reflect canonical uppercase day identifiers accepted by the API.
 */

export const API_SCHEDULE_DAYS = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
] as const;

export type ApiScheduleDay = (typeof API_SCHEDULE_DAYS)[number];

export type ScheduleFilterKey =
  | 'search'
  | 'course'
  | 'type'
  | 'day'
  | 'year'
  | 'semester'
  | 'college'
  | 'department'
  | 'doctor'
  | 'teachingAssistant'
  | 'archiveStatus';

export interface ScheduleFilterPermissions {
  search: boolean;
  course: boolean;
  type: boolean;
  day: boolean;
  year: boolean;
  semester: boolean;
  college: boolean;
  department: boolean;
  doctor: boolean;
  teachingAssistant: boolean;
  archiveStatus: boolean;
}

const MOST_RESTRICTIVE_FILTER_SET: readonly ScheduleFilterKey[] = Object.freeze([
  'search',
  'course',
  'type',
  'day',
]);

export const ROLE_SCHEDULE_FILTERS: Record<string, readonly ScheduleFilterKey[]> = {
  STUDENT: ['search', 'course', 'type', 'day'],
  TEACHING_ASSISTANT: ['search', 'course', 'type', 'day'],
  DOCTOR: ['search', 'course', 'year', 'type', 'day'],
  DEPARTMENT_ADMIN: ['search', 'course', 'year', 'semester', 'type', 'day', 'archiveStatus'],
  COLLEGE_ADMIN: ['search', 'course', 'department', 'year', 'semester', 'type', 'day', 'archiveStatus'],
  SUPER_ADMIN: [
    'search',
    'course',
    'college',
    'department',
    'year',
    'semester',
    'type',
    'day',
    'doctor',
    'teachingAssistant',
    'archiveStatus',
  ],
  ADMIN: [
    'search',
    'course',
    'college',
    'department',
    'year',
    'semester',
    'type',
    'day',
    'doctor',
    'teachingAssistant',
    'archiveStatus',
  ],
};

/**
 * Validates whether a day string matches one of the canonical days accepted by the schedules API.
 */
export function isValidScheduleDay(day?: string | null): boolean {
  if (!day || typeof day !== 'string') return false;
  const upper = day.trim().toUpperCase();
  return (API_SCHEDULE_DAYS as readonly string[]).includes(upper);
}

/**
 * Returns the list of filter keys permitted for the given user role.
 * Unknown, empty, or undefined roles fallback to the most restrictive filter set.
 */
export function getAllowedScheduleFilters(role?: string | null): readonly ScheduleFilterKey[] {
  if (!role || typeof role !== 'string') {
    return MOST_RESTRICTIVE_FILTER_SET;
  }
  const normalized = role.trim().toUpperCase();
  return ROLE_SCHEDULE_FILTERS[normalized] || MOST_RESTRICTIVE_FILTER_SET;
}

/**
 * Checks whether a specific filter key is permitted for the given role.
 */
export function isScheduleFilterAllowed(
  role: string | null | undefined,
  filter: ScheduleFilterKey
): boolean {
  const allowed = getAllowedScheduleFilters(role);
  return allowed.includes(filter);
}

/**
 * Returns a boolean lookup map for all schedule filters for the given role.
 */
export function getScheduleFilterPermissions(role?: string | null): ScheduleFilterPermissions {
  const allowed = new Set(getAllowedScheduleFilters(role));
  return {
    search: allowed.has('search'),
    course: allowed.has('course'),
    type: allowed.has('type'),
    day: allowed.has('day'),
    year: allowed.has('year'),
    semester: allowed.has('semester'),
    college: allowed.has('college'),
    department: allowed.has('department'),
    doctor: allowed.has('doctor'),
    teachingAssistant: allowed.has('teachingAssistant'),
    archiveStatus: allowed.has('archiveStatus'),
  };
}
