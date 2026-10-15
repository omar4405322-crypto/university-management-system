import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prismaClient';
import catchAsync from '../utils/catchAsync';
import { NotFoundError, ValidationError, ConflictError } from '../utils/appError';

export const createAcademicYear = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { name, startDate, endDate } = req.body;

    const existing = await prisma.academicYear.findUnique({
      where: { name },
    });
    if (existing) {
      return next(new ConflictError(`Academic year '${name}' already exists`));
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end <= start) {
      return next(new ValidationError('End date must be after start date'));
    }

    const academicYear = await prisma.academicYear.create({
      data: {
        name,
        startDate: start,
        endDate: end,
        isCurrent: false,
      },
    });

    res.status(201).json({
      success: true,
      data: academicYear,
    });
  }
);

export const getAcademicYears = catchAsync(
  async (_req: Request, res: Response) => {
    const years = await prisma.academicYear.findMany({
      include: {
        terms: {
          orderBy: { semesterNumber: 'asc' },
        },
      },
      orderBy: { startDate: 'desc' },
    });

    res.json({
      success: true,
      data: years,
    });
  }
);

export const updateAcademicYear = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const id = parseInt(req.params.id as string, 10);
    const { name, startDate, endDate } = req.body;

    const existing = await prisma.academicYear.findUnique({
      where: { id },
    });
    if (!existing) {
      return next(new NotFoundError('Academic year not found'));
    }

    const start = startDate ? new Date(startDate) : existing.startDate;
    const end = endDate ? new Date(endDate) : existing.endDate;

    if (end <= start) {
      return next(new ValidationError('End date must be after start date'));
    }

    if (name && name !== existing.name) {
      const nameConflict = await prisma.academicYear.findUnique({ where: { name } });
      if (nameConflict) {
        return next(new ConflictError(`Academic year '${name}' already exists`));
      }
    }

    const updated = await prisma.academicYear.update({
      where: { id },
      data: {
        ...(name ? { name } : {}),
        ...(startDate ? { startDate: start } : {}),
        ...(endDate ? { endDate: end } : {}),
      },
    });

    res.json({
      success: true,
      data: updated,
    });
  }
);

export const createAcademicTerm = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { academicYearId, name, termType, semesterNumber, startDate, endDate } = req.body;

    const year = await prisma.academicYear.findUnique({
      where: { id: academicYearId },
    });
    if (!year) {
      return next(new NotFoundError('Academic year not found'));
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end <= start) {
      return next(new ValidationError('End date must be after start date'));
    }

    // Date overlap check within the same Academic Year
    const siblingTerms = await prisma.academicTerm.findMany({
      where: { academicYearId },
    });

    for (const sibling of siblingTerms) {
      const sStart = new Date(sibling.startDate);
      const sEnd = new Date(sibling.endDate);
      if (start < sEnd && end > sStart) {
        return next(
          new ValidationError(
            `Term dates overlap with existing term '${sibling.name}' (${sStart.toISOString().slice(0, 10)} to ${sEnd.toISOString().slice(0, 10)})`
          )
        );
      }
    }

    const term = await prisma.academicTerm.create({
      data: {
        academicYearId,
        name,
        termType: termType || 'FALL',
        semesterNumber,
        startDate: start,
        endDate: end,
        isCurrent: false,
      },
    });

    res.status(201).json({
      success: true,
      data: term,
    });
  }
);

export const getAcademicTerms = catchAsync(
  async (req: Request, res: Response) => {
    const academicYearId = req.query.academicYearId
      ? parseInt(req.query.academicYearId as string, 10)
      : undefined;

    const terms = await prisma.academicTerm.findMany({
      where: academicYearId ? { academicYearId } : undefined,
      include: {
        academicYear: true,
      },
      orderBy: { startDate: 'desc' },
    });

    res.json({
      success: true,
      data: terms,
    });
  }
);

export const getCurrentTerm = catchAsync(
  async (_req: Request, res: Response) => {
    const currentTerm = await prisma.academicTerm.findFirst({
      where: { isCurrent: true },
      include: {
        academicYear: true,
      },
    });

    if (!currentTerm) {
      return res.json({
        success: true,
        data: {
          currentTerm: null,
          status: 'NO_ACTIVE_TERM',
          message: 'No active academic term configured. Please contact Super Admin to activate a term.',
        },
      });
    }

    return res.json({
      success: true,
      data: {
        currentTerm,
        status: 'ACTIVE',
      },
    });
  }
);

export const updateAcademicTerm = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const id = parseInt(req.params.id as string, 10);
    const { name, termType, semesterNumber, startDate, endDate } = req.body;

    const existing = await prisma.academicTerm.findUnique({
      where: { id },
    });
    if (!existing) {
      return next(new NotFoundError('Academic term not found'));
    }

    const start = startDate ? new Date(startDate) : existing.startDate;
    const end = endDate ? new Date(endDate) : existing.endDate;

    if (end <= start) {
      return next(new ValidationError('End date must be after start date'));
    }

    if (startDate || endDate) {
      const siblingTerms = await prisma.academicTerm.findMany({
        where: {
          academicYearId: existing.academicYearId,
          id: { not: id },
        },
      });

      for (const sibling of siblingTerms) {
        const sStart = new Date(sibling.startDate);
        const sEnd = new Date(sibling.endDate);
        if (start < sEnd && end > sStart) {
          return next(
            new ValidationError(
              `Term dates overlap with existing term '${sibling.name}' (${sStart.toISOString().slice(0, 10)} to ${sEnd.toISOString().slice(0, 10)})`
            )
          );
        }
      }
    }

    const updated = await prisma.academicTerm.update({
      where: { id },
      data: {
        ...(name ? { name } : {}),
        ...(termType ? { termType } : {}),
        ...(semesterNumber ? { semesterNumber } : {}),
        ...(startDate ? { startDate: start } : {}),
        ...(endDate ? { endDate: end } : {}),
      },
    });

    res.json({
      success: true,
      data: updated,
    });
  }
);

export const getTermSwitchPreview = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const id = parseInt(req.params.id as string, 10);
    const targetTerm = await prisma.academicTerm.findUnique({
      where: { id },
      include: { academicYear: true },
    });

    if (!targetTerm) {
      return next(new NotFoundError('Academic term not found'));
    }

    const activeStudents = await prisma.student.findMany({
      where: { isActive: true },
      select: { id: true, departmentId: true, year: true },
    });

    const matchingCourses = await prisma.course.findMany({
      where: {
        isPublished: true,
        semester: targetTerm.semesterNumber,
      },
      select: { id: true, departmentId: true, year: true, name: true, courseCode: true },
    });

    const potentialPairs: Array<{ studentId: number; courseId: number; departmentId: number }> = [];
    for (const student of activeStudents) {
      if (!student.departmentId || !student.year) continue;
      for (const course of matchingCourses) {
        if (course.departmentId === student.departmentId && course.year === student.year) {
          potentialPairs.push({
            studentId: student.id,
            courseId: course.id,
            departmentId: student.departmentId,
          });
        }
      }
    }

    const existingEnrollments = await prisma.enrollment.findMany({
      where: {
        OR: [
          { termId: targetTerm.id },
          {
            semester: targetTerm.semesterNumber,
            academicYear: targetTerm.startDate.getFullYear(),
          },
        ],
      },
      select: { studentId: true, courseId: true },
    });

    const existingSet = new Set(existingEnrollments.map((e) => `${e.studentId}:${e.courseId}`));
    const newEnrollments = potentialPairs.filter((p) => !existingSet.has(`${p.studentId}:${p.courseId}`));

    const deptBreakdown: Record<number, number> = {};
    for (const pair of newEnrollments) {
      deptBreakdown[pair.departmentId] = (deptBreakdown[pair.departmentId] || 0) + 1;
    }

    res.json({
      success: true,
      data: {
        targetTerm,
        eligibleStudentsCount: activeStudents.length,
        matchingCoursesCount: matchingCourses.length,
        newEnrollmentsCount: newEnrollments.length,
        departmentBreakdown: deptBreakdown,
      },
    });
  }
);

export const activateAcademicTerm = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const id = parseInt(req.params.id as string, 10);
    const targetTerm = await prisma.academicTerm.findUnique({
      where: { id },
      include: { academicYear: true },
    });

    if (!targetTerm) {
      return next(new NotFoundError('Academic term not found'));
    }

    const previousTerm = await prisma.academicTerm.findFirst({
      where: { isCurrent: true },
    });

    const result = await prisma.$transaction(async (tx) => {
      // 1. Deactivate current terms and years
      await tx.academicTerm.updateMany({
        where: { isCurrent: true },
        data: { isCurrent: false },
      });

      await tx.academicYear.updateMany({
        where: { isCurrent: true },
        data: { isCurrent: false },
      });

      // 2. Activate target term and its year
      const activatedTerm = await tx.academicTerm.update({
        where: { id: targetTerm.id },
        data: { isCurrent: true },
        include: { academicYear: true },
      });

      await tx.academicYear.update({
        where: { id: targetTerm.academicYearId },
        data: { isCurrent: true },
      });

      // 3. Auto-enroll active students into target term courses
      const activeStudents = await tx.student.findMany({
        where: { isActive: true },
        select: { id: true, departmentId: true, year: true },
      });

      const matchingCourses = await tx.course.findMany({
        where: {
          isPublished: true,
          semester: targetTerm.semesterNumber,
        },
        select: { id: true, departmentId: true, year: true },
      });

      const potentialPairs: Array<{ studentId: number; courseId: number }> = [];
      for (const student of activeStudents) {
        if (!student.departmentId || !student.year) continue;
        for (const course of matchingCourses) {
          if (course.departmentId === student.departmentId && course.year === student.year) {
            potentialPairs.push({
              studentId: student.id,
              courseId: course.id,
            });
          }
        }
      }

      const existingEnrollments = await tx.enrollment.findMany({
        where: {
          studentId: { in: activeStudents.map((s) => s.id) },
          courseId: { in: matchingCourses.map((c) => c.id) },
          termId: targetTerm.id,
        },
        select: { studentId: true, courseId: true },
      });

      const existingSet = new Set(existingEnrollments.map((e) => `${e.studentId}:${e.courseId}`));
      const toEnroll = potentialPairs.filter((p) => !existingSet.has(`${p.studentId}:${p.courseId}`));

      const yearMatch = targetTerm.academicYear.name.match(/\d{4}/);
      const calendarYearInt = yearMatch
        ? parseInt(yearMatch[0], 10)
        : targetTerm.startDate.getFullYear();

      if (toEnroll.length > 0) {
        await tx.enrollment.createMany({
          data: toEnroll.map((p) => ({
            studentId: p.studentId,
            courseId: p.courseId,
            semester: targetTerm.semesterNumber,
            academicYear: calendarYearInt,
            termId: targetTerm.id,
            status: 'ENROLLED',
          })),
          skipDuplicates: true,
        });
      }

      // 4. Audit Log Entries
      const user = (req as any).user;
      await tx.auditLog.create({
        data: {
          userId: user?.id ?? null,
          userEmail: user?.email ?? null,
          userRole: user?.role ?? 'SUPER_ADMIN',
          action: 'TERM_SWITCHED',
          entity: 'AcademicTerm',
          entityId: String(targetTerm.id),
          details: {
            previousTermId: previousTerm?.id ?? null,
            newTermId: targetTerm.id,
            termName: targetTerm.name,
            academicYearId: targetTerm.academicYearId,
          },
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
        },
      });

      await tx.auditLog.create({
        data: {
          userId: user?.id ?? null,
          userEmail: user?.email ?? null,
          userRole: user?.role ?? 'SUPER_ADMIN',
          action: 'AUTO_ENROLLMENT_TRIGGERED',
          entity: 'Enrollment',
          entityId: null,
          details: {
            termId: targetTerm.id,
            newEnrollmentsCount: toEnroll.length,
            studentCount: activeStudents.length,
          },
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
        },
      });

      return { activatedTerm, enrollmentsCreated: toEnroll.length };
    });

    (req as any).auditLogWritten = true;

    res.json({
      success: true,
      data: result,
    });
  }
);

