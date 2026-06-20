/**
 * Base error class for operational errors
 */
export class AppError extends Error {
  public statusCode: number;
  public status: string;
  public isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);

    // Restore prototype chain for built-in Error subclasses in TS
    Object.setPrototypeOf(this, new.target.prototype);

    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Authentication related errors (401)
 */
export class AuthenticationError extends AppError {
  constructor(message: string = 'Not authenticated') {
    super(message, 401);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Authorization related errors (403)
 */
export class AuthorizationError extends AppError {
  constructor(message: string = 'Not authorized to perform this action') {
    super(message, 403);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Validation related errors (422)
 */
export class ValidationError extends AppError {
  public errors: any[];

  constructor(message: string, errors: any[] = []) {
    super(message, 422);
    Object.setPrototypeOf(this, new.target.prototype);
    this.errors = errors;
  }
}

/**
 * Resource not found errors (404)
 */
export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Conflict errors (409)
 */
export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
