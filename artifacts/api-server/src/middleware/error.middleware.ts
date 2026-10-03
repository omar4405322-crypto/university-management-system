import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import logger from '../utils/logger';
import {
  AppError,
  ConflictError,
  NotFoundError,
  ValidationError,
  AuthenticationError,
} from '../utils/appError';

/**
 * Global Error Handler Middleware
 * SEC-001: Structured production error logging without raw stack traces or internal leaks.
 */
const globalErrorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  if (err?.type === 'entity.parse.failed') {
    err = new AppError('Malformed JSON body', 400);
  }
  const isDev = process.env.NODE_ENV === 'development';

  // In development, log to console for developer workflow; never in production
  if (isDev) {
    console.error('[DEV GLOBAL ERROR]', err?.message, err?.stack);
  }

  const errorId =
    (req.headers['x-request-id'] as string) ||
    (req.headers['x-correlation-id'] as string) ||
    crypto.randomUUID();

  res.setHeader('X-Error-Id', errorId);

  if (err?.type === 'entity.too.large') {
    err = new AppError('Request body is too large', 413);
  } else if (err?.name === 'MulterError' && err?.code === 'LIMIT_FILE_SIZE') {
    err = new AppError('Uploaded file is too large', 413);
  }

  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (isDev) {
    sendErrorDev(err, req, res, errorId);
  } else {
    let error = { ...err };
    error.message = err.message;
    error.name = err.name;
    error.statusCode = err.statusCode;
    error.status = err.status;
    error.isOperational = err.isOperational;

    // Handle specific Prisma errors
    if (err.code === 'P2002') error = handlePrismaUniqueConstraintError(err);
    if (err.code === 'P2025') error = handlePrismaNotFoundError();
    if (err.code === 'P2003') error = handlePrismaForeignKeyError(err);
    if (err.code === 'P1001') error = handlePrismaConnectionError();
    if (err.name === 'JsonWebTokenError') error = handleJWTError();
    if (err.name === 'TokenExpiredError') error = handleJWTExpiredError();

    sendErrorProd(error, req, res, errorId);
  }
};

const handlePrismaUniqueConstraintError = (err: any) => {
  const field = err.meta?.target?.[0] || 'field';
  const message = `Duplicate value for ${field}. Please use another value!`;
  return new ConflictError(message);
};

const handlePrismaNotFoundError = () => {
  return new NotFoundError('The requested resource was not found.');
};

const handlePrismaForeignKeyError = (err: any) => {
  const message = `Invalid reference: The related record for ${err.meta?.field_name || 'a field'} does not exist.`;
  return new ValidationError(message);
};

const handlePrismaConnectionError = () => {
  return new AppError('Database connection failed. Please try again later.', 503);
};

const handleJWTError = () => new AuthenticationError('Invalid security token. Please login again.');

const handleJWTExpiredError = () =>
  new AuthenticationError('Your session has expired! Please login again.');

const sendErrorDev = (err: any, req: Request, res: Response, errorId: string) => {
  logger.error(`[DEV ERROR] ${err.message}`, {
    errorId,
    stack: err.stack,
    path: req.originalUrl?.split('?')[0],
    method: req.method,
  });

  res.status(err.statusCode).json({
    success: false,
    status: err.status,
    errorId,
    error: err,
    message: err.message,
    stack: err.stack,
  });
};

const sendErrorProd = (err: any, req: Request, res: Response, errorId: string) => {
  // Operational, trusted error: send structured message to client
  if (err.isOperational) {
    logger.warn(`[OP ERROR] ${err.message}`, {
      errorId,
      path: req.originalUrl?.split('?')[0],
      method: req.method,
      statusCode: err.statusCode,
      code: err.code || err.name,
    });

    res.status(err.statusCode).json({
      success: false,
      status: err.status,
      message: err.message,
      errorId,
      errors: err.errors || undefined,
    });
  }
  // Programming or other unknown error: don't leak error details or raw stack traces in production
  else {
    logger.error(`[CRITICAL ERROR] Reference ${errorId}`, {
      errorId,
      type: err.name || 'InternalServerError',
      statusCode: 500,
      path: req.originalUrl?.split('?')[0],
      method: req.method,
      timestamp: new Date().toISOString(),
    });

    res.status(500).json({
      success: false,
      status: 'error',
      message: `Something went wrong. Reference: ${errorId}`,
      errorId,
    });
  }
};

export default globalErrorHandler;
