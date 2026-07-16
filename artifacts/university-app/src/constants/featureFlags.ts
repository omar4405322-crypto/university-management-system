// Feature flags for the UMS application
export const FEATURE_FLAGS = {
  // TEMP-DISABLED-2FA: Set to false to temporarily disable 2FA warnings and requirements.
  // Re-enable this before production launch — see Task 53 in UI-UX-IMPROVEMENT-LOG.md
  REQUIRE_2FA: false,
} as const;
