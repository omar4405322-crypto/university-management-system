import { getSecretStrengthValidationError } from './secretValidation';

export const getJwtSecretValidationError = (
  secret: string | undefined,
  minimumLength: number
): string | null => {
  if (!secret) return 'JWT_SECRET environment variable is required.';

  const trimmed = secret.trim();
  if (trimmed.length < minimumLength) {
    return `JWT_SECRET must be at least ${minimumLength} characters.`;
  }

  return getSecretStrengthValidationError(trimmed, 'JWT_SECRET');
};
