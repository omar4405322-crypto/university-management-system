const KNOWN_WEAK_JWT_SECRETS = new Set([
  'your-super-secret-key-change-this',
  'secret',
  'changeme',
  'replace-with-any-32-char-string-for-tests',
]);

export const getJwtSecretValidationError = (
  secret: string | undefined,
  minimumLength: number
): string | null => {
  if (!secret) return 'JWT_SECRET environment variable is required.';

  const normalized = secret.trim().toLowerCase();
  if (KNOWN_WEAK_JWT_SECRETS.has(normalized)) {
    return 'JWT_SECRET is using a known default or insecure value.';
  }

  if (secret.length < minimumLength) {
    return `JWT_SECRET must be at least ${minimumLength} characters.`;
  }

  return null;
};
