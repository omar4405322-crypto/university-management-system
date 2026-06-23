import { Request, Response, NextFunction } from 'express';
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
 */
const globalErrorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  // Always log to console for immediate visibility during debugging
  console.error('Global error:', err?.message, err?.stack);
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, req, res);
  } else {
    let error = { ...err };
    error.message = err.message;

    // Handle specific Prisma errors
    if (err.code === 'P2002') error = handlePrismaUniqueConstraintError(err);
    if (err.code === 'P2025') error = handlePrismaNotFoundError();
    if (err.code === 'P2003') error = handlePrismaForeignKeyError(err);
    if (err.code === 'P1001') error = handlePrismaConnectionError();
    if (err.name === 'JsonWebTokenError') error = handleJWTError();
    if (err.name === 'TokenExpiredError') error = handleJWTExpiredError();

    sendErrorProd(error, req, res);
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

const sendErrorDev = (err: any, req: Request, res: Response) => {
  logger.error(`[DEV ERROR] ${err.message}`, { stack: err.stack, path: req.originalUrl });

  res.status(err.statusCode).json({
    success: false,
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack,
  });
};

const sendErrorProd = (err: any, req: Request, res: Response) => {
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    logger.warn(`[OP ERROR] ${err.message}`, { path: req.originalUrl });

    res.status(err.statusCode).json({
      success: false,
      status: err.status,
      message: err.message,
      errors: err.errors || undefined,
    });
  }
  // Programming or other unknown error: don't leak error details
  else {
    logger.error(`[CRITICAL ERROR] ${err.message}`, { stack: err.stack, path: req.originalUrl });

    res.status(500).json({
      success: false,
      status: 'error',
      message: 'Something went very wrong!',
    });
  }
};

export default globalErrorHandler;
