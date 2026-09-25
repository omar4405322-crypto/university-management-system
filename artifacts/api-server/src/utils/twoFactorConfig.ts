export const MANDATORY_2FA_ROLES = [
  'SUPER_ADMIN',
  'ADMIN',
  'COLLEGE_ADMIN',
  'DEPARTMENT_ADMIN',
] as const;

export type Mandatory2FARole = (typeof MANDATORY_2FA_ROLES)[number];

export function isMandatory2FARole(role: string | null | undefined): boolean {
  if (!role) return false;
  return (MANDATORY_2FA_ROLES as readonly string[]).includes(role);
}

export function getTwoFactorConfigError(
  nodeEnv: string | undefined,
  requireTwoFactor: string | undefined
): string | null {
  if (
    nodeEnv?.trim().toLowerCase() === 'production' &&
    requireTwoFactor?.trim().toLowerCase() === 'false'
  ) {
    return 'REQUIRE_2FA=false is forbidden when NODE_ENV=production.';
  }
  return null;
}
