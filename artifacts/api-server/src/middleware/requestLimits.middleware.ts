import { NextFunction, Request, Response } from 'express';
import { ValidationError } from '../utils/appError';
import {
  isBoundedPositiveInteger,
  MAX_PAGE_NUMBER,
  MAX_PAGE_SIZE,
} from '../utils/requestLimits';

export function enforcePaginationBounds(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const query = req.query;
  const checks = [
    { name: 'page', value: query.page, maximum: MAX_PAGE_NUMBER },
    { name: 'limit', value: query.limit, maximum: Number.MAX_SAFE_INTEGER },
  ];

  for (const check of checks) {
    if (check.value === undefined) continue;
    if (!isBoundedPositiveInteger(check.value, check.maximum)) {
      next(
        new ValidationError(
          `${check.name} must be a positive integer no greater than ${check.maximum}`
        )
      );
      return;
    }
  }

  if (query.limit !== undefined && Number(query.limit) > MAX_PAGE_SIZE) {
    Object.defineProperty(req, 'query', {
      configurable: true,
      enumerable: true,
      value: { ...query, limit: String(MAX_PAGE_SIZE) },
    });
  }

  next();
}
