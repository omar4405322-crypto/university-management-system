const logger = require('../utils/logger');

/**
 * Global Error Handler Middleware
 */
const globalErrorHandler = (err, req, res, next) => {
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
    if (err.code === 'P2025') error = handlePrismaNotFoundError(err);
    if (err.code === 'P2003') error = handlePrismaForeignKeyError(err);
    if (err.code === 'P1001') error = handlePrismaConnectionError(err);
    if (err.name === 'JsonWebTokenError') error = handleJWTError();
    if (err.name === 'TokenExpiredError') error = handleJWTExpiredError();

    sendErrorProd(error, req, res);
  }
};

const handlePrismaUniqueConstraintError = (err) => {
  const field = err.meta?.target?.[0] || 'field';
  const message = `Duplicate value for ${field}. Please use another value!`;
  return new (require('../utils/appError').ConflictError)(message);
};

const handlePrismaNotFoundError = () => {
  return new (require('../utils/appError').NotFoundError)('The requested resource was not found.');
};

const handlePrismaForeignKeyError = (err) => {
  const message = `Invalid reference: The related record for ${err.meta?.field_name || 'a field'} does not exist.`;
  return new (require('../utils/appError').ValidationError)(message);
};

const handlePrismaConnectionError = () => {
  return new (require('../utils/appError').AppError)('Database connection failed. Please try again later.', 503);
};

const handleJWTError = () => 
  new (require('../utils/appError').AuthenticationError)('Invalid security token. Please login again.');

const handleJWTExpiredError = () => 
  new (require('../utils/appError').AuthenticationError)('Your session has expired! Please login again.');

const sendErrorDev = (err, req, res) => {
  logger.error(`[DEV ERROR] ${err.message}`, { stack: err.stack, path: req.originalUrl });

  res.status(err.statusCode).json({
    success: false,
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack
  });
};

const sendErrorProd = (err, req, res) => {
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    logger.warn(`[OP ERROR] ${err.message}`, { path: req.originalUrl });
    
    res.status(err.statusCode).json({
      success: false,
      status: err.status,
      message: err.message,
      errors: err.errors || undefined
    });
  } 
  // Programming or other unknown error: don't leak error details
  else {
    logger.error(`[CRITICAL ERROR] ${err.message}`, { stack: err.stack, path: req.originalUrl });

    res.status(500).json({
      success: false,
      status: 'error',
      message: 'Something went very wrong!'
    });
  }
};

module.exports = globalErrorHandler;
