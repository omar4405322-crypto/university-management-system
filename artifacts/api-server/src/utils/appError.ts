/**
 * Base error class for operational errors
 */
export class AppError extends Error {
  public statusCode: number;
  public status: string;
  public isOperational: boolean;
  public code?: string;

  constructor(message: string, statusCode: number, code?: string) {
    super(message);

    // Restore prototype chain for built-in Error subclasses in TS
    Object.setPrototypeOf(this, new.target.prototype);

    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    if (code !== undefined) {
      this.code = code;
    }

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Authentication related errors (401)
 */
export class AuthenticationError extends AppError {
  constructor(message: string = 'Not authenticated', code?: string) {
    super(message, 401, code);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Authorization related errors (403)
 */
export class AuthorizationError extends AppError {
  constructor(message: string = 'Not authorized to perform this action', code?: string) {
    super(message, 403, code);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export const ForbiddenError = AuthorizationError;
export type ForbiddenError = AuthorizationError;

/**
 * Validation related errors (422)
 */
export class ValidationError extends AppError {
  public errors: any[];

  constructor(message: string, errors: any[] = [], code?: string) {
    super(message, 422, code);
    Object.setPrototypeOf(this, new.target.prototype);
    this.errors = errors;
  }
}

/**
 * Resource not found errors (404)
 */
export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found', code?: string) {
    super(message, 404, code);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Conflict errors (409)
 */
export const DUPLICATE_SUBMISSION_DEFAULT_MESSAGE =
  'This file cannot be accepted because an identical submission already exists for this assignment. Please submit your own original work.';

export class DuplicateSubmissionError extends AppError {
  public code: string;
  constructor(
    message: string = DUPLICATE_SUBMISSION_DEFAULT_MESSAGE
  ) {
    super(message, 409, 'DUPLICATE_SUBMISSION');
    this.code = 'DUPLICATE_SUBMISSION';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, code?: string) {
    super(message, 409, code);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
