import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../utils/prismaClient';
import { auditLog } from '../utils/audit.utils';
import { TimetableService } from '../services/timetable.service';
import { getScopeWhere } from '../utils/scope.utils';
import catchAsync from '../utils/catchAsync';
import { NotFoundError, AuthorizationError, AppError } from '../utils/appError';
import { invalidateCache } from '../utils/redis.utils';
import { getAdminMutationScopeWhere } from '../utils/adminMutationScope.utils';

/**
 * @desc    Get all timetables (Admin) or matching timetable (Student)
 * @route   GET /api/timetables
 * @access  Private
 */
export const getTimetables = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { user } = req;
  const { collegeId, departmentId, academicYear, semester, status, page: pageParam, limit: limitParam } = req.query as Record<
    string,
    string
  >;
  const parsedPage = Number(pageParam);
  const parsedLimit = Number(limitParam);
  const page = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const limit = Number.isSafeInteger(parsedLimit) && parsedLimit > 0
    ? Math.min(parsedLimit, 100)
    : 20;

  let where: any = {};

  if (user!.role === 'STUDENT') {
    const student = await prisma.student.findUnique({
      where: { userId: user!.id },
      select: {
        departmentId: true,
        year: true,
        department: {
          select: { collegeId: true },
        },
      },
    });

    if (!student) {
      return next(new NotFoundError('Student profile not found'));
    }

    // Automatically match student profile and require PUBLISHED status
    where = {
      departmentId: student.departmentId,
      collegeId: student.department?.collegeId,
      academicYear: student.year,
      status: 'PUBLISHED',
    };
  } else {
    // Admins/Doctors
    if (collegeId) where.collegeId = parseInt(collegeId as string);
    if (departmentId) where.departmentId = parseInt(departmentId as string);
    if (academicYear) where.academicYear = parseInt(academicYear as string);
    if (semester) where.semester = parseInt(semester as string);
    if (status) where.status = status;

    // Apply scope (COLLEGE_ADMIN/DEPARTMENT_ADMIN)
    const deptScope: any = getScopeWhere(user!, 'department');
    if (deptScope && Object.keys(deptScope).length) {
      if (deptScope.collegeId) where.collegeId = deptScope.collegeId;
      if (deptScope.id) where.departmentId = deptScope.id;
    }
  }

  const [timetables, total] = await Promise.all([
    prisma.timetable.findMany({
      where,
      include: {
        college: { select: { name: true } },
        department: { select: { name: true } },
      },
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.timetable.count({ where }),
  ]);

  res.json({
    success: true,
    data: timetables,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  });
});

/**
 * @desc    Get a single timetable by ID
 * @route   GET /api/timetables/:id
 * @access  Private
 */
export const getTimetableById = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const timetable = await prisma.timetable.findUnique({
      where: { id: parseInt(req.params.id as string) },
      include: {
        college: true,
        department: true,
      },
    });

    if (!timetable) {
      return next(new NotFoundError('Timetable not found'));
    }

    // If requester is a student, ensure timetable is published
    if (req.user && req.user.role === 'STUDENT' && timetable.status !== 'PUBLISHED') {
      return next(new NotFoundError('Timetable not found'));
    }

    // Enforce scope on read
    const deptScope: any = getScopeWhere(req.user!, 'department');
    if (deptScope && Object.keys(deptScope).length) {
      if (deptScope.collegeId && timetable.collegeId !== deptScope.collegeId)
        return next(new AuthorizationError('Access denied'));
      if (deptScope.id && timetable.departmentId !== deptScope.id)
        return next(new AuthorizationError('Access denied'));
    }

    res.json({ success: true, data: timetable });
  }
);

/**
 * @desc    Create a new timetable
 * @route   POST /api/timetables
 * @access  Private (Admin)
 */
export const createTimetable = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const {
      collegeId,
      departmentId,
      academicYear,
      semester,
      title,
      description,
      fileUrl,
      status,
    } = req.body;

    // Validation
    if (!collegeId || !departmentId || !academicYear || !semester || !title) {
      return next(
        new AppError('Faculty, Department, Academic Year, Semester, and Title are required', 400)
      );
    }

    const parsedCollegeId = Number(collegeId);
    const parsedDepartmentId = Number(departmentId);
    const parsedAcademicYear = Number(academicYear);
    const parsedSemester = Number(semester);
    if (
      !Number.isSafeInteger(parsedCollegeId) || parsedCollegeId <= 0 ||
      !Number.isSafeInteger(parsedDepartmentId) || parsedDepartmentId <= 0 ||
      !Number.isSafeInteger(parsedAcademicYear) || parsedAcademicYear <= 0 ||
      !Number.isSafeInteger(parsedSemester) || parsedSemester <= 0
    ) {
      return next(new AppError('Timetable identifiers must be positive integers', 400));
    }

    const department = await prisma.department.findFirst({
      where: {
        AND: [
          { id: parsedDepartmentId, collegeId: parsedCollegeId },
          getAdminMutationScopeWhere(req.user!, 'department'),
        ],
      },
      select: { id: true },
    });
    if (!department) {
      return next(
        new AuthorizationError(
          'Department does not belong to the supplied college or is outside your managed scope'
        )
      );
    }

    // Check for duplicates (handled by unique constraint in DB, but better to check)
    const existing = await prisma.timetable.findUnique({
      where: {
        collegeId_departmentId_academicYear_semester: {
          collegeId: parsedCollegeId,
          departmentId: parsedDepartmentId,
          academicYear: parsedAcademicYear,
          semester: parsedSemester,
        },
      },
    });

    if (existing) {
      return next(
        new AppError(
          'A timetable for this Faculty, Department, Year, and Semester combination already exists.',
          400
        )
      );
    }

    const timetable = await prisma.$transaction(async (tx) => {
      const created = await tx.timetable.create({
        data: {
          collegeId: parsedCollegeId,
          departmentId: parsedDepartmentId,
          academicYear: parsedAcademicYear,
          semester: parsedSemester,
          title,
          description,
          fileUrl,
          status: status || 'DRAFT',
        },
      });

      await auditLog('CREATE_TIMETABLE', 'Timetable', created.id, req, { after: created }, tx);

      return created;
    });

    res.status(201).json({ success: true, data: timetable });
  }
);

/**
 * @desc    Update a timetable
 * @route   PUT /api/timetables/:id
 * @access  Private (Admin)
 */
export const updateTimetable = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { title, description, fileUrl, status, academicYear, semester } = req.body;
    const id = parseInt(req.params.id as string);

    // Enforce scope on update
    const deptScope: any = getScopeWhere(req.user!, 'department');
    const existing = await prisma.timetable.findUnique({ where: { id } });
    if (!existing) return next(new NotFoundError('Timetable not found'));
    if (deptScope && Object.keys(deptScope).length) {
      if (deptScope.collegeId && existing.collegeId !== deptScope.collegeId)
        return next(new AuthorizationError('Access denied'));
      if (deptScope.id && existing.departmentId !== deptScope.id)
        return next(new AuthorizationError('Access denied'));
    }

    const timetable = await prisma.$transaction(async (tx) => {
      const updated = await tx.timetable.update({
        where: { id },
        data: {
          title,
          description,
          fileUrl,
          status,
          academicYear: academicYear !== undefined ? parseInt(academicYear as string) : undefined,
          semester: semester !== undefined ? parseInt(semester as string) : undefined,
        },
      });

      await auditLog(
        'UPDATE_TIMETABLE',
        'Timetable',
        id,
        req,
        { before: existing, after: updated },
        tx
      );

      return updated;
    });

    res.json({ success: true, data: timetable });
  }
);

/**
 * @desc    Delete a timetable
 * @route   DELETE /api/timetables/:id
 * @access  Private (Admin)
 */
export const deleteTimetable = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const existing = await prisma.timetable.findUnique({
      where: { id: parseInt(req.params.id as string) },
    });
    if (!existing) return next(new NotFoundError('Timetable not found'));
    const deptScope: any = getScopeWhere(req.user!, 'department');
    if (deptScope && Object.keys(deptScope).length) {
      if (deptScope.collegeId && existing.collegeId !== deptScope.collegeId)
        return next(new AuthorizationError('Access denied'));
      if (deptScope.id && existing.departmentId !== deptScope.id)
        return next(new AuthorizationError('Access denied'));
    }

    await prisma.$transaction(async (tx) => {
      const evidencedSlot = await tx.scheduleSlot.findFirst({
        where: {
          timetableId: existing.id,
          OR: [
            { attendanceSessions: { some: {} } },
            { attendances: { some: {} } },
          ],
        },
        select: { id: true },
      });
      if (evidencedSlot) {
        throw new AppError(
          'Cannot delete timetable: attendance evidence exists. Unpublish it to retain historical session requirements.',
          409
        );
      }

      await tx.timetable.delete({ where: { id: existing.id } });
      await auditLog(
        'DELETE_TIMETABLE',
        'Timetable',
        existing.id,
        req,
        { before: existing, after: null },
        tx
      );
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    res.json({ success: true, message: 'Timetable deleted successfully' });
  }
);

export const publishTimetable = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const id = parseInt(req.params.id as string);
    const existing = await prisma.timetable.findUnique({ where: { id } });
    if (!existing) return next(new NotFoundError('Timetable not found'));
    const deptScope: any = getScopeWhere(req.user!, 'department');
    if (deptScope && Object.keys(deptScope).length) {
      if (deptScope.collegeId && existing.collegeId !== deptScope.collegeId)
        return next(new AuthorizationError('Access denied'));
      if (deptScope.id && existing.departmentId !== deptScope.id)
        return next(new AuthorizationError('Access denied'));
    }

    const timetable = await prisma.$transaction(async (tx) => {
      const updated = await tx.timetable.update({
        where: { id },
        data: { status: 'PUBLISHED' },
      });
      await auditLog(
        'PUBLISH_TIMETABLE',
        'Timetable',
        id,
        req,
        { before: { status: existing.status }, after: { status: updated.status } },
        tx
      );
      return updated;
    });

    await invalidateCache('dashboard:*');
    res.json({ success: true, data: timetable, message: 'Timetable published successfully' });
  }
);

export const unpublishTimetable = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const id = parseInt(req.params.id as string);
    const existing = await prisma.timetable.findUnique({ where: { id } });
    if (!existing) return next(new NotFoundError('Timetable not found'));
    const deptScope: any = getScopeWhere(req.user!, 'department');
    if (deptScope && Object.keys(deptScope).length) {
      if (deptScope.collegeId && existing.collegeId !== deptScope.collegeId)
        return next(new AuthorizationError('Access denied'));
      if (deptScope.id && existing.departmentId !== deptScope.id)
        return next(new AuthorizationError('Access denied'));
    }

    const timetable = await prisma.$transaction(async (tx) => {
      const updated = await tx.timetable.update({
        where: { id },
        data: { status: 'DRAFT' },
      });
      await auditLog(
        'UNPUBLISH_TIMETABLE',
        'Timetable',
        id,
        req,
        { before: { status: existing.status }, after: { status: updated.status } },
        tx
      );
      return updated;
    });

    await invalidateCache('dashboard:*');
    res.json({ success: true, data: timetable, message: 'Timetable set to draft mode' });
  }
);
