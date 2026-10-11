import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt.utils';
import prisma from '../utils/prismaClient';
import catchAsync from '../utils/catchAsync';
import { AuthActor } from '../types/auth.types';
import { AuthenticationError, AuthorizationError, AppError } from '../utils/appError';
import globalErrorHandler from './error.middleware';

declare global {
  namespace Express {
    interface Request {
      user?: AuthActor;
      cookies?: any;
    }
  }
}

/**
 * Protect routes - ensures user is authenticated
 */
const protect = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  let token: string | undefined;
  if (req.cookies?.auth_token) {
    token = req.cookies.auth_token;
  } else if (req.headers.authorization?.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return globalErrorHandler(new AuthenticationError('Access denied. No security token provided.'), req, res, next);
  }

  // Verify token
  const decoded = verifyToken(token);

  // Check if user still exists
  const user = await prisma.user.findUnique({
    where: { id: decoded.id },
    select: {
      id: true,
      email: true,
      role: true,
      adminRole: true,
      collegeId: true,
      departmentId: true,
      managedCollegeId: true,
      managedDepartmentId: true,
      tokenVersion: true,
      profilePicture: true,
      createdAt: true,
      isActive: true,
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          studentId: true,
          year: true,
          departmentId: true,
        },
      },
      doctor: { select: { id: true, firstName: true, lastName: true, doctorId: true, departmentId: true } },
      teachingAssistant: { select: { id: true, employeeId: true } },
    },
  });

  if (!user) {
    return globalErrorHandler(new AuthenticationError('The user belonging to this token no longer exists.'), req, res, next);
  }

  if (user.isActive === false) {
    return globalErrorHandler(new AuthenticationError('Your account has been deactivated. Please contact support.'), req, res, next);
  }

  if (decoded.tokenVersion !== user.tokenVersion) {
    return globalErrorHandler(new AuthenticationError('Session invalidated. Please login again.'), req, res, next);
  }

  // Attach user (including managedCollegeId) to request for downstream scope checks
  req.user = user;
  next();
});

/**
 * Authorize roles - ensures user has required permissions
 */
const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return globalErrorHandler(new AppError('Authorization check failed. User not authenticated.', 500), req, res, next);
    }

    // Normalize role comparison to be case-insensitive and robust
    const userRole = (req.user.role || '').toString().toUpperCase();

    // SUPER_ADMIN has god-mode access
    if (userRole === 'SUPER_ADMIN') {
      return next();
    }

    const allowed = roles.map((r) => r.toString().toUpperCase());
    if (!allowed.includes(userRole)) {
      return globalErrorHandler(
        new AuthorizationError(
          `Forbidden: Your role (${req.user.role}) does not have permission for this action.`
        ),
        req,
        res,
        next
      );
    }

    next();
  };
};

export { protect, authorize };
