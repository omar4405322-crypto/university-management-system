import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../utils/appError';

export const createRoomSchema = z.object({
  name: z
    .string({ required_error: 'Room name is required' })
    .trim()
    .min(1, 'Room name cannot be empty')
    .max(100, 'Room name cannot exceed 100 characters'),
  isActive: z.boolean().optional().default(true),
});

export const updateRoomSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Room name cannot be empty')
      .max(100, 'Room name cannot exceed 100 characters')
      .optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => data.name !== undefined || data.isActive !== undefined, {
    message: 'At least one field (name, isActive) must be provided for update',
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
