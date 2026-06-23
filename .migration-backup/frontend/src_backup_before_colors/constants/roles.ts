export const USER_ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  DOCTOR: 'DOCTOR',
  STUDENT: 'STUDENT',
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];
