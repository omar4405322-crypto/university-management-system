import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';

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

  return res.status(422).json({
    success: false,
    message: firstMessage,
    errors: extractedErrors,
  });
};

export = validate;
