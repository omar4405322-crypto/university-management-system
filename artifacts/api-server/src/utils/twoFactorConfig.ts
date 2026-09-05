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
