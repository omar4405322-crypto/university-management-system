import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { ValidationError } from '../utils/appError';
import globalErrorHandler from './error.middleware';

/**
 * Centralized validation middleware to handle express-validator results
 */
const validate = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }

  const extractedErrors: Array<Record<string, string>> = [];
  errors.array().map((err: any) => extractedErrors.push({ [err.path]: err.msg }));

  const firstMessage = errors.array()[0]?.msg || 'Validation failed';

  return globalErrorHandler(new ValidationError(firstMessage, extractedErrors), req, res, next);
};

export default validate;
