import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

/**
 * Zod-based validation middleware factory.
 * Validates req.body against the given schema and returns 422 on failure.
 */
const validateZod = (schema: ZodSchema<any, any>) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse({ body: req.body, params: req.params, query: req.query });
    if (result.success) {
      // Merge parsed (coerced/defaulted) values back
      req.body = (result.data as any).body ?? req.body;
      return next();
    }
    const errors = (result.error as any).errors.map((e: any) => ({
      [e.path.slice(1).join('.')]: e.message,
    }));
    res.status(422).json({
      success: false,
      message: (result.error as any).errors[0]?.message ?? 'Validation failed',
      errors,
    });
  };
};

export default validateZod;
