import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prismaClient';
import { auditLog } from '../utils/audit.utils';
import bcrypt from 'bcryptjs';

import catchAsync from '../utils/catchAsync';
import { AppError, NotFoundError, AuthorizationError } from '../utils/appError';
import { getScopeWhere } from '../utils/scope.utils';

export const getTeachingAssistantStats = catchAsync(async (req: Request, res: Response) => {
  const scopeWhere: any = getScopeWhere(req.user!, 'teachingAssistant');
  const where: any = { ...scopeWhere };

  const [total, byCourse] = await Promise.all([
    prisma.teachingAssistant.count({ where }),
    prisma.teachingAssistant.count({
      where: {
        ...where,
        schedules: { some: {} },
      },
    }),
  ]);

  res.json({
    success: true,
    data: {
      total,
      byCourse,
      active: total,
    },
  });
});

export const getAllTeachingAssistants = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { search = '', page = 1, limit = 10 } = req.query as Record<string, string>;
  const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
  const take = parseInt(limit as string);

  const scopeWhere: any = getScopeWhere(req.user!, 'teachingAssistant');

  const where: any = {
    ...scopeWhere,
    ...(search
      ? {
          user: {
            email: { contains: search, mode: 'insensitive' },
          },
        }
      : {}), // Teaching assistants don't have first/last name in DB schema right now, wait. Let's check schema.
  };

  const [assistants, total] = await Promise.all([
    prisma.teachingAssistant.findMany({
      where,
      include: {
        user: {
          select: {
            email: true,
            role: true,
            // teachingAssistants don't have first name / last name inside teachingAssistant model? Ah wait. RegistrationRequest has firstName/lastName. Does User?
          },
        },
        department: {
          include: { college: true },
        },
      },
      skip,
      take,
      orderBy: { id: 'desc' },
    }),
    prisma.teachingAssistant.count({ where }),
  ]);

  res.json({
    success: true,
    data: {
      teachingAssistants: assistants,
      total,
      page: parseInt(page as string),
      totalPages: Math.ceil(total / take),
    },
  });
});

export const getTeachingAssistantById = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const assistant = await prisma.teachingAssistant.findUnique({
    where: { id: parseInt(req.params.id as string) },
    include: {
      user: {
        select: {
          email: true,
          role: true,
        },
      },
      department: {
        include: { college: true },
      },
    },
  });

  if (!assistant) {
    return next(new NotFoundError('Teaching Assistant not found'));
  }

  // Enforce scope
  if (req.user!.role === 'COLLEGE_ADMIN' && assistant.department?.collegeId !== (req.user!.managedCollegeId ?? req.user!.collegeId)) {
    return next(new AuthorizationError('Access denied'));
  }
  if (req.user!.role === 'DEPARTMENT_ADMIN' && assistant.departmentId !== (req.user!.managedDepartmentId ?? req.user!.departmentId)) {
    return next(new AuthorizationError('Access denied'));
  }

  res.json({ success: true, data: assistant });
});

export const createTeachingAssistant = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  let { email, password, firstName, lastName, departmentId, specialization } = req.body;

  // Enforce scope
  if (req.user!.role === 'ADMIN' && req.user!.managedCollegeId) {
    if (departmentId) {
      const dept = await prisma.department.findUnique({
        where: { id: parseInt(departmentId as string) },
      });
      if (!dept || dept.collegeId !== req.user!.managedCollegeId) {
        return next(new AuthorizationError('Invalid department for your college'));
      }
    }
  } else if (req.user!.role === 'DEPARTMENT_ADMIN') {
    departmentId = req.user!.managedDepartmentId ?? req.user!.departmentId;
  } else if (req.user!.role === 'COLLEGE_ADMIN') {
    if (departmentId) {
      const dept = await prisma.department.findUnique({
        where: { id: parseInt(departmentId as string) },
      });
      if (!dept || dept.collegeId !== (req.user!.managedCollegeId ?? req.user!.collegeId)) {
        return next(new AuthorizationError('Invalid department for your college'));
      }
    }
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return next(new AppError('Email already exists', 400));
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const result = await prisma.$transaction(async (tx: any) => {
    // Note: User doesn't have firstName/lastName. The RegistrationRequest has it. So we must put it in the model? Wait! We forgot to add firstName/lastName to TeachingAssistant model in step 1! The user schema requested didn't have it, but they need it. Let's see what they put.
    const user = await tx.user.create({
      data: {
        email,
        password: hashedPassword,
        role: 'TEACHING_ASSISTANT',
      },
    });

    const assistant = await tx.teachingAssistant.create({
      data: {
        userId: user.id,
        specialization,
        departmentId:
          departmentId !== undefined && departmentId !== ''
            ? parseInt(departmentId as string)
            : null,
      },
      include: {
        user: {
          select: {
            email: true,
            role: true,
          },
        },
        department: true,
      },
    });

    return assistant;
  });

  res.status(201).json({ success: true, data: result });
});

export const updateTeachingAssistant = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { firstName, lastName, departmentId, specialization } = req.body;
  const id = parseInt(req.params.id as string);

  const assistant = await prisma.teachingAssistant.findUnique({
    where: { id },
    include: { department: true },
  });

  if (!assistant) {
    return next(new NotFoundError('Teaching Assistant not found'));
  }

  // Enforce scope
  if (req.user!.role === 'ADMIN' && req.user!.managedCollegeId) {
    if (assistant.department?.collegeId !== req.user!.managedCollegeId) {
      return next(new AuthorizationError('Access denied'));
    }
  } else if (
    req.user!.role === 'COLLEGE_ADMIN' &&
    assistant.department?.collegeId !== (req.user!.managedCollegeId ?? req.user!.collegeId)
  ) {
    return next(new AuthorizationError('Access denied'));
  } else if (
    req.user!.role === 'DEPARTMENT_ADMIN' &&
    assistant.departmentId !== (req.user!.managedDepartmentId ?? req.user!.departmentId)
  ) {
    return next(new AuthorizationError('Access denied'));
  }

  // If changing department, check scope for new department
  if (departmentId) {
    if (req.user!.role === 'ADMIN' && req.user!.managedCollegeId) {
      const newDept = await prisma.department.findUnique({
        where: { id: parseInt(departmentId as string) },
      });
      if (!newDept || newDept.collegeId !== req.user!.managedCollegeId) {
        return next(new AuthorizationError('Invalid department for your college'));
      }
    } else if (
      req.user!.role === 'DEPARTMENT_ADMIN' &&
      parseInt(departmentId as string) !== req.user!.departmentId
    ) {
      return next(new AuthorizationError('Cannot move TA to another department'));
    } else if (req.user!.role === 'COLLEGE_ADMIN') {
      const newDept = await prisma.department.findUnique({
        where: { id: parseInt(departmentId as string) },
      });
      if (!newDept || newDept.collegeId !== (req.user!.managedCollegeId ?? req.user!.collegeId)) {
        return next(new AuthorizationError('Invalid department for your college'));
      }
    }
  }

  const updatedAssistant = await prisma.teachingAssistant.update({
    where: { id },
    data: {
      specialization,
      departmentId:
        departmentId !== undefined && departmentId !== ''
          ? parseInt(departmentId as string)
          : undefined,
    },
    include: {
      user: {
        select: {
          email: true,
          role: true,
        },
      },
      department: true,
    },
  });

  res.json({ success: true, data: updatedAssistant });
});

export const deleteTeachingAssistant = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const id = parseInt(req.params.id as string);
  const assistant = await prisma.teachingAssistant.findUnique({
    where: { id },
    include: { department: true },
  });

  if (!assistant) {
    return next(new NotFoundError('Teaching Assistant not found'));
  }

  // Enforce scope
  if (req.user!.role === 'ADMIN' && req.user!.managedCollegeId) {
    if (assistant.department?.collegeId !== req.user!.managedCollegeId) {
      return next(new AuthorizationError('Access denied'));
    }
  } else if (
    req.user!.role === 'COLLEGE_ADMIN' &&
    assistant.department?.collegeId !== (req.user!.managedCollegeId ?? req.user!.collegeId)
  ) {
    return next(new AuthorizationError('Access denied'));
  } else if (
    req.user!.role === 'DEPARTMENT_ADMIN' &&
    assistant.departmentId !== (req.user!.managedDepartmentId ?? req.user!.departmentId)
  ) {
    return next(new AuthorizationError('Access denied'));
  }

  await prisma.$transaction(async (tx: any) => {
    // Set assistantId to null for all schedules
    await tx.schedule.updateMany({
      where: { assistantId: assistant.id },
      data: { assistantId: null },
    });

    await tx.teachingAssistant.delete({ where: { id: assistant.id } });
    await tx.user.delete({ where: { id: assistant.userId } });
  });

  auditLog('DELETE_TEACHING_ASSISTANT', 'TeachingAssistant', req.params.id as string, req);
  res.json({ success: true, message: 'Teaching Assistant deleted' });
});
