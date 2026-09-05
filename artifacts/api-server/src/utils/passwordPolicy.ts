import crypto from 'crypto';
import { AppError } from './appError';

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_STRENGTH_MESSAGE =
  'Password must be at least 8 characters and include uppercase, lowercase, and a number';

export function isPasswordStrong(password: unknown): password is string {
  return (
    typeof password === 'string' &&
    password.length >= PASSWORD_MIN_LENGTH &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password)
  );
}

export function assertPasswordStrength(password: unknown): asserts password is string {
  if (!isPasswordStrong(password)) {
    throw new AppError(PASSWORD_STRENGTH_MESSAGE, 400);
  }
}

export function passwordStrengthValidator(password: unknown): boolean {
  if (!isPasswordStrong(password)) {
    throw new Error(PASSWORD_STRENGTH_MESSAGE);
  }
  return true;
}

export function generateStrongTemporaryPassword(): string {
  return `Aa1!${crypto.randomBytes(12).toString('base64url')}`;
}
