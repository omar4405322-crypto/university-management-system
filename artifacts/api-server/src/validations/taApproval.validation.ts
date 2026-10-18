import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../utils/appError';

export const approveTASchema = z.object({
  teachingAssistantId: z
    .string({ required_error: 'teachingAssistantId is required' })
    .min(1, 'teachingAssistantId is required'),
  courseId: z
    .number({ required_error: 'courseId is required' })
    .int('courseId must be an integer')
    .positive('courseId must be a positive integer'),
  reason: z.string().trim().max(500, 'Reason cannot exceed 500 characters').optional(),
});

export const validateZod = (schema: z.ZodTypeAny) => (req: Request, _res: Response, next: NextFunction) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    const message = firstIssue ? `${firstIssue.message}` : 'Validation failed';
    return next(new ValidationError(message, result.error.issues));
  }
  req.body = result.data;
  next();
};
