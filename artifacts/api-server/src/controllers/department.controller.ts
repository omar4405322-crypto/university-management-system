import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../utils/prismaClient';
import { auditLog } from '../utils/audit.utils';
import {
  getEffectiveActiveDoctorWhere,
  getEffectiveActiveStudentWhere,
  getScopeWhere,
} from '../utils/scope.utils';
import catchAsync from '../utils/catchAsync';
import { NotFoundError, AuthorizationError, ValidationError, AppError } from '../utils/appError';
import { getAdminMutationTargetWhere } from '../utils/adminMutationScope.utils';

export const getPublicDepartments = catchAsync(async (req: Request, res: Response) => {
  const { collegeId } = req.query;
  const where: { collegeId?: number } = {};
  if (collegeId) {
    where.collegeId = parseInt(collegeId as string, 10);
  }
  const departments = await prisma.department.findMany({
    where,
    select: {
      id: true,
      name: true,
      nameAr: true,
      collegeId: true,
    },
    orderBy: { name: 'asc' },
  });
  res.json({ success: true, data: departments });
});

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

  const where: any = { ...scopeWhere };
  // For non-COLLEGE_ADMIN or when no collegeId provided, apply query filter
  if (!(req.user && req.user.role === 'COLLEGE_ADMIN' && req.user.managedCollegeId)) {
    if (collegeId) where.collegeId = parseInt(collegeId as string);
  }

  const departments = await prisma.department.findMany({
    where,
    include: {
      college: true,
      _count: {
        select: {
          students: { where: getEffectiveActiveStudentWhere() },
          doctors: { where: getEffectiveActiveDoctorWhere() },
          courses: true,
        },
      },
    },
  });
  res.json({ success: true, data: departments });
});

export const getDepartmentById = catchAsync(async (req: Request, res: Response) => {
  const departmentId = parseInt(req.params.id as string);
  const userRole = req.user?.role;
  const adminRoles = ['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'];
  const nonAdminRoles = ['STUDENT', 'DOCTOR', 'TEACHING_ASSISTANT'];

  // Non-administrative users legitimately need minimal department metadata for navigation,
  // but must never receive student or faculty rosters, courses relations, or sensitive counts.
  if (userRole && nonAdminRoles.includes(userRole)) {
    const department = await prisma.department.findUnique({
      where: { id: departmentId },
      select: {
        id: true,
        name: true,
        nameAr: true,
        collegeId: true,
        college: {
          select: {
            id: true,
            name: true,
            nameAr: true,
          },
        },
      },
    });

    if (!department) {
      throw new NotFoundError('Department not found');
    }

    return res.json({ success: true, data: department });
  }

  // Administrative users: enforce centralized fail-closed scope
  if (userRole && adminRoles.includes(userRole)) {
    const department = await prisma.department.findUnique({
      where: { id: departmentId },
      include: {
        college: true,
        students: {
          where: getEffectiveActiveStudentWhere(),
          select: { id: true, firstName: true, lastName: true, studentId: true, year: true },
          orderBy: { lastName: 'asc' },
        },
        courses: {
          select: {
            id: true,
            name: true,
            courseCode: true,
            credits: true,
            year: true,
            semester: true,
          },
          orderBy: { name: 'asc' },
        },
        doctors: {
          where: getEffectiveActiveDoctorWhere(),
          select: { id: true, firstName: true, lastName: true, doctorId: true, specialty: true },
          orderBy: { lastName: 'asc' },
        },
        _count: {
          select: {
            students: { where: getEffectiveActiveStudentWhere() },
            courses: true,
            doctors: { where: getEffectiveActiveDoctorWhere() },
          },
        },
      },
    });

    if (!department) {
      throw new NotFoundError('Department not found');
    }

    if (!req.user) {
      throw new AuthorizationError('Authentication required');
    }

    if (userRole === 'SUPER_ADMIN') {
      // Super admin has institution-wide administrative access
    } else if (userRole === 'COLLEGE_ADMIN') {
      if (!req.user.managedCollegeId || department.collegeId !== req.user.managedCollegeId) {
        throw new AuthorizationError('Access denied');
      }
    } else if (userRole === 'DEPARTMENT_ADMIN') {
      if (!req.user.managedDepartmentId || department.id !== req.user.managedDepartmentId) {
        throw new AuthorizationError('Access denied');
      }
    } else if (userRole === 'ADMIN') {
      if (!req.user.managedCollegeId || department.collegeId !== req.user.managedCollegeId) {
        throw new AuthorizationError('Access denied');
      }
    } else {
      throw new AuthorizationError('Access denied');
    }

    return res.json({ success: true, data: department });
  }

  // Unknown role or missing authenticated role: fail closed
  throw new AuthorizationError('Access denied');
});

export const createDepartment = catchAsync(async (req: Request, res: Response) => {
  const { name, nameAr, collegeId } = req.body;

  if (!collegeId) {
    throw new ValidationError('collegeId is required');
  }

  const cid = parseInt(collegeId);
  if (isNaN(cid)) {
    throw new ValidationError('Invalid collegeId');
  }

  const destinationCollege = await prisma.college.findFirst({
    where: getAdminMutationTargetWhere(req.user, 'college', cid),
    select: { id: true },
  });
  if (!destinationCollege) {
    throw new AuthorizationError('Access denied: College is outside your managed scope');
  }

  const department = await prisma.$transaction(async (tx) => {
    const created = await tx.department.create({
      data: { name, nameAr, collegeId: destinationCollege.id },
    });
    await auditLog('CREATE_DEPARTMENT', 'Department', created.id, req, { after: created }, tx);
    return created;
  });
  res.status(201).json({ success: true, data: department });
});

export const updateDepartment = catchAsync(async (req: Request, res: Response) => {
  const { name, nameAr, collegeId } = req.body;
  const deptId = parseInt(req.params.id as string);

  const existing = await prisma.department.findFirst({
    where: getAdminMutationTargetWhere(req.user, 'department', deptId),
  });
  if (!existing) {
    throw new NotFoundError('Department not found');
  }

  let destinationCollegeId: number | undefined;
  if (collegeId !== undefined) {
    const parsedCollegeId = parseInt(collegeId, 10);
    const destinationCollege = Number.isInteger(parsedCollegeId) && parsedCollegeId > 0
      ? await prisma.college.findFirst({
          where: getAdminMutationTargetWhere(req.user, 'college', parsedCollegeId),
          select: { id: true },
        })
      : null;
    if (!destinationCollege) {
      throw new AuthorizationError('Access denied: Destination college is outside your managed scope');
    }
    destinationCollegeId = destinationCollege.id;
  }

  const department = await prisma.$transaction(async (tx) => {
    const updated = await tx.department.update({
      where: { id: deptId },
      data: { name, nameAr, collegeId: destinationCollegeId },
    });
    await auditLog(
      'UPDATE_DEPARTMENT',
      'Department',
      deptId,
      req,
      { before: existing, after: updated },
      tx
    );
    return updated;
  });
  res.json({ success: true, data: department });
});

export const deleteDepartment = catchAsync(async (req: Request, res: Response) => {
  const departmentId = parseInt(req.params.id as string);

  // Fetch and scope check
  const existing = await prisma.department.findFirst({
    where: getAdminMutationTargetWhere(req.user, 'department', departmentId),
    include: {
      _count: {
        select: {
          students: true,
          courses: true,
          doctors: true,
          teachingAssistants: true,
          admins: true,
          managedAdmins: true,
          registrationRequests: true,
          timetables: true,
          studentGroups: true,
        },
      },
    },
  });
  if (!existing) {
    throw new NotFoundError('Department not found');
  }

  const linkedRecords = Object.entries(existing._count)
    .filter(([, count]) => count > 0)
    .map(([relation, count]) => `${count} ${relation}`);
  if (linkedRecords.length > 0) {
    throw new AppError(
      `Cannot delete department: linked records remain (${linkedRecords.join(', ')}). Reassign or explicitly remove them first.`,
      409
    );
  }

  await prisma.$transaction(async (tx) => {
    const current = await tx.department.findUnique({
      where: { id: departmentId },
      include: {
        _count: {
          select: {
            students: true,
            courses: true,
            doctors: true,
            teachingAssistants: true,
            admins: true,
            managedAdmins: true,
            registrationRequests: true,
            timetables: true,
            studentGroups: true,
          },
        },
      },
    });
    if (!current) throw new NotFoundError('Department not found');

    const concurrentLinks = Object.values(current._count).some((count) => count > 0);
    if (concurrentLinks) {
      throw new AppError(
        'Cannot delete department: linked records changed during deletion. Reassign or explicitly remove them first.',
        409
      );
    }

    await tx.department.delete({ where: { id: departmentId } });
    await auditLog(
      'DELETE_DEPARTMENT',
      'Department',
      departmentId,
      req,
      { before: current, after: null },
      tx
    );
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  res.json({ success: true, message: 'Department deleted successfully' });
});
