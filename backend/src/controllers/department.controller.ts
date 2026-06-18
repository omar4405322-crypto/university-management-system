import { Request, Response } from 'express';
import prisma from '../utils/prismaClient.js';
import { auditLog } from '../utils/audit.utils.js';
import { getScopeWhere } from '../utils/scope.utils.js';
import catchAsync from '../utils/catchAsync.js';
import { NotFoundError, AuthorizationError, ValidationError } from '../utils/appError.js';

export const getAllDepartments = catchAsync(async (req: Request, res: Response) => {
  const { collegeId } = req.query;
  
  // For COLLEGE_ADMIN, explicitly check if they're trying to access another college
  if (req.user && req.user.role === 'COLLEGE_ADMIN' && req.user.managedCollegeId && collegeId) {
    if (parseInt(collegeId as string) !== req.user.managedCollegeId) {
      throw new AuthorizationError('Access denied: Cannot access departments of another college');
    }
  }

  // Scope support via helper
  const scopeWhere = getScopeWhere(req.user, 'department');

  let where: any = { ...scopeWhere };
  // For non-COLLEGE_ADMIN or when no collegeId provided, apply query filter
  if (!(req.user && req.user.role === 'COLLEGE_ADMIN' && req.user.managedCollegeId)) {
    if (collegeId) where.collegeId = parseInt(collegeId as string);
  }

  const departments = await prisma.department.findMany({
    where,
    include: { 
      college: true,
      _count: {
        select: { students: true, doctors: true, courses: true }
      }
    }
  });
  res.json({ success: true, data: departments });
});

export const getDepartmentById = catchAsync(async (req: Request, res: Response) => {
  const department = await prisma.department.findUnique({
    where: { id: parseInt(req.params.id as string) },
    include: {
      college: true,
      students: {
        select: { id: true, firstName: true, lastName: true, studentId: true, year: true },
        orderBy: { lastName: 'asc' },
      },
      courses: {
        select: { id: true, name: true, courseCode: true, credits: true, year: true, semester: true },
        orderBy: { name: 'asc' },
      },
      doctors: {
        select: { id: true, firstName: true, lastName: true, doctorId: true, specialty: true },
        orderBy: { lastName: 'asc' },
      },
      _count: { select: { students: true, courses: true, doctors: true } },
    },
  });
  if (!department) {
    throw new NotFoundError('Department not found');
  }

  // Enforce scope: COLLEGE_ADMIN/DEPARTMENT_ADMIN
  if (req.user && req.user.role === 'COLLEGE_ADMIN' && department.collegeId !== req.user.managedCollegeId) {
    throw new AuthorizationError('Access denied');
  }
  if (req.user && req.user.role === 'DEPARTMENT_ADMIN' && department.id !== req.user.managedDepartmentId) {
    throw new AuthorizationError('Access denied');
  }

  res.json({ success: true, data: department });
});

export const createDepartment = catchAsync(async (req: Request, res: Response) => {
  let { name, nameAr, collegeId } = req.body;

  // If user is COLLEGE_ADMIN, enforce managedCollegeId or set automatically
  if (req.user && req.user.role === 'COLLEGE_ADMIN' && req.user.managedCollegeId) {
    if (collegeId && parseInt(collegeId) !== req.user.managedCollegeId) {
      throw new AuthorizationError('Access denied');
    }
    collegeId = req.user.managedCollegeId;
  }

  if (!collegeId) {
    throw new ValidationError('collegeId is required');
  }

  const cid = parseInt(collegeId);
  if (isNaN(cid)) {
    throw new ValidationError('Invalid collegeId');
  }

  const department = await prisma.department.create({
    data: { name, nameAr, collegeId: cid }
  });
  res.status(201).json({ success: true, data: department });
});

export const updateDepartment = catchAsync(async (req: Request, res: Response) => {
  const { name, nameAr, collegeId } = req.body;
  const deptId = parseInt(req.params.id as string);

  // Fetch existing for scope check
  const existing = await prisma.department.findUnique({ where: { id: deptId } });
  if (!existing) {
    throw new NotFoundError('Department not found');
  }

  if (req.user && req.user.role === 'COLLEGE_ADMIN' && req.user.managedCollegeId) {
    if (existing.collegeId !== req.user.managedCollegeId) {
      throw new AuthorizationError('Access denied');
    }
    if (collegeId && parseInt(collegeId) !== req.user.managedCollegeId) {
      throw new AuthorizationError('Access denied');
    }
  }

  const department = await prisma.department.update({
    where: { id: deptId },
    data: { name, nameAr, collegeId: collegeId ? parseInt(collegeId) : undefined }
  });
  res.json({ success: true, data: department });
});

export const deleteDepartment = catchAsync(async (req: Request, res: Response) => {
  const departmentId = parseInt(req.params.id as string);

  // Fetch and scope check
  const existing = await prisma.department.findUnique({ where: { id: departmentId } });
  if (!existing) {
    throw new NotFoundError('Department not found');
  }
  if (req.user && req.user.role === 'COLLEGE_ADMIN' && req.user.managedCollegeId) {
    if (existing.collegeId !== req.user.managedCollegeId) {
      throw new AuthorizationError('Access denied');
    }
  }

  await prisma.$transaction(async (tx) => {
    // 1. Nullify references in related models
    await tx.student.updateMany({ where: { departmentId }, data: { departmentId: null } });
    await tx.doctor.updateMany({ where: { departmentId }, data: { departmentId: null } });
    await tx.course.updateMany({ where: { departmentId }, data: { departmentId: null } });
    await tx.user.updateMany({ where: { departmentId }, data: { departmentId: null } });

    // 2. Delete dependent records that can't exist without a department
    await tx.registrationRequest.deleteMany({ where: { departmentId } });

    // 3. Delete the department
    await tx.department.delete({
      where: { id: departmentId }
    });
  });

  auditLog('DELETE_DEPARTMENT', 'Department', req.params.id as string, req);
  res.json({ success: true, message: 'Department deleted successfully' });
});
