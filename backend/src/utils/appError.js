/**
 * Base error class for operational errors
 */
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);

    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Authentication related errors (401)
 */
class AuthenticationError extends AppError {
  constructor(message = 'Not authenticated') {
    super(message, 401);
  }
}

/**
 * Authorization related errors (403)
 */
class AuthorizationError extends AppError {
  constructor(message = 'Not authorized to perform this action') {
    super(message, 403);
  }
}

/**
 * Validation related errors (422)
 */
class ValidationError extends AppError {
  constructor(message, errors = []) {
    super(message, 422);
    this.errors = errors;
  }
}

/**
 * Resource not found errors (404)
 */
class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404);
  }
}

/**
 * Conflict errors (409)
 */
class ConflictError extends AppError {
  constructor(message) {
    super(message, 409);
  }
}

module.exports = {
  AppError,
  AuthenticationError,
  AuthorizationError,
  ValidationError,
  NotFoundError,
  ConflictError
};
