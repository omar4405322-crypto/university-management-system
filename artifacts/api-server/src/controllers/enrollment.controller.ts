import { Request, Response } from 'express';
import catchAsync from '../utils/catchAsync';
import {
  ValidationError,
  AppError,
  NotFoundError,
  AuthorizationError,
  ConflictError,
} from '../utils/appError';
import prisma from '../utils/prismaClient';
import { auditLog } from '../utils/audit.utils';
import { EnrollmentService } from '../services/enrollment.service';
import { getScopeWhere } from '../utils/strictScope.utils';
import * as studentGradesService from '../services/studentGrades.service';

export const enrollStudent = catchAsync(async (req: Request, res: Response) => {
  const { studentId, courseId, semester, academicYear, termId } = req.body;

  const parsedStudentId = parseInt(studentId);
  const parsedCourseId = parseInt(courseId);
  const parsedSemester = parseInt(semester);
  const parsedAcademicYear = parseInt(academicYear);

  if (isNaN(parsedStudentId) || isNaN(parsedCourseId) || isNaN(parsedSemester) || isNaN(parsedAcademicYear)) {
    throw new AppError('studentId, courseId, semester, and academicYear must be valid numbers', 400);
  }

  const currentYear = new Date().getFullYear();
  const minYear = currentYear - 1;
  const maxYear = currentYear + 1;
  if (parsedAcademicYear < minYear || parsedAcademicYear > maxYear) {
    throw new AppError(
      `Academic year must be a valid calendar year between ${minYear} and ${maxYear} (received: ${parsedAcademicYear})`,
      400
    );
  }

  if (parsedSemester < 1 || parsedSemester > 3) {
    throw new AppError('Semester must be between 1 and 3 (1 = First, 2 = Second, 3 = Summer)', 400);
  }

  // Approved interim policy: enforce COURSE scope only, not student scope, for COLLEGE_ADMIN/DEPARTMENT_ADMIN/ADMIN.
  // Cross-department elective enrollment by a scoped admin remains intentionally allowed for now.
  // Note: This is an interim policy that may be replaced later by a curriculum-based automatic course-eligibility feature.
  const courseScope = getScopeWhere(req.user, 'course');
  if (courseScope && Object.keys(courseScope).length > 0) {
    const courseCheck = await prisma.course.findFirst({
      where: { AND: [{ id: parsedCourseId }, courseScope] },
    });
    if (!courseCheck) {
      throw new AuthorizationError(
        'Access denied: You are not authorized for this course.'
      );
    }
  }

  const parsedTermId = termId !== undefined && termId !== '' ? parseInt(termId as string, 10) : undefined;
  const enrollArgs: any[] = [parsedStudentId, parsedCourseId, parsedSemester, parsedAcademicYear];
  if (parsedTermId !== undefined) enrollArgs.push(parsedTermId);
  const enrollment = await (EnrollmentService.enrollStudent as any)(...enrollArgs);







  res.status(201).json({ success: true, data: enrollment });
});

export const withdrawStudent = catchAsync(async (req: Request, res: Response) => {
  // DELETE /api/enrollments/:id
  const enrollmentId = parseInt(req.params.id as string);
  if (isNaN(enrollmentId)) {
    throw new AppError('Invalid enrollment ID', 400);
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
  });

  if (!enrollment) {
    throw new NotFoundError('Enrollment not found');
  }

  const enrollmentScope = getScopeWhere(req.user, 'enrollment');
  const scopedEnrollment = await prisma.enrollment.findFirst({
    where: {
      AND: [{ id: enrollmentId }, enrollmentScope],
    },
  });

  if (!scopedEnrollment) {
    throw new AuthorizationError(
      'Access denied: You are not authorized for this enrollment.'
    );
  }

  const withdrawn = await EnrollmentService.withdrawStudent(enrollment.id);
  res.json({ success: true, data: withdrawn });
});

export const getEnrollments = catchAsync(async (req: Request, res: Response) => {
  const { studentId, courseId, semester, termId } = req.query;
  const whereFilters: any = {};
  if (studentId !== undefined && studentId !== '') {
    const parsed = Number(studentId);
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
      throw new ValidationError('Invalid studentId parameter');
    }
    whereFilters.studentId = parsed;
  }
  if (courseId !== undefined && courseId !== '') {
    const parsed = Number(courseId);
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
      throw new ValidationError('Invalid courseId parameter');
    }
    whereFilters.courseId = parsed;
  }
  if (semester !== undefined && semester !== '') {
    const parsed = Number(semester);
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
      throw new ValidationError('Invalid semester parameter');
    }
    whereFilters.semester = parsed;
  }
  if (termId !== undefined && termId !== '') {
    const parsed = Number(termId);
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
      throw new ValidationError('Invalid termId parameter');
    }
    whereFilters.termId = parsed;
  }

  const scopeWhere = getScopeWhere(req.user, 'enrollment');
  const where: any = {
    AND: [
      whereFilters,
      scopeWhere,
    ],
  };

  const enrollments = await prisma.enrollment.findMany({ where });
  res.json({ success: true, data: enrollments });
});

/**
 * @desc    Get current student's grades
 * @route   GET /api/enrollments/my-grades
 * @access  Private (STUDENT only)
 */
export const getMyGrades = catchAsync(async (req: Request, res: Response) => {
  const data = await studentGradesService.getStudentMyGrades(req.user);
  res.json({ success: true, data });
});

/**
 * @desc    Update enrollment grade (Discontinued - S7)
 * @route   PATCH /api/enrollments/:id/grade
 * @access  Private (DOCTOR, COLLEGE_ADMIN, SUPER_ADMIN)
 */
export const updateGrade = catchAsync(async (req: Request, res: Response) => {
  throw new ConflictError(
    'Direct grading via PATCH /api/enrollments/:id/grade is discontinued. Use the gradebook publish service at POST /api/courses/:courseId/gradebook/publish instead.'
  );
});


export const setCustomAbsenceThreshold = catchAsync(async (req: Request, res: Response) => {
  const enrollmentId = parseInt(req.params.id as string);
  if (isNaN(enrollmentId)) {
    throw new AppError('Invalid enrollment ID', 400);
  }

  const { customAbsenceThreshold } = req.body;
  const result = await EnrollmentService.setCustomAbsenceThreshold(
    req.user,
    enrollmentId,
    customAbsenceThreshold !== undefined ? customAbsenceThreshold : null
  );

  res.json({ success: true, data: result });
});

export const createExemptionPeriod = catchAsync(async (req: Request, res: Response) => {
  const enrollmentId = parseInt(req.params.id as string);
  if (isNaN(enrollmentId)) {
    throw new AppError('Invalid enrollment ID', 400);
  }

  const { startDate, endDate, reason } = req.body;
  const result = await EnrollmentService.createExemptionPeriod(req.user, enrollmentId, {
    startDate,
    endDate,
    reason,
  });

  res.status(201).json({ success: true, data: result });
});

export const getExemptionPeriods = catchAsync(async (req: Request, res: Response) => {
  const enrollmentId = parseInt(req.params.id as string);
  if (isNaN(enrollmentId)) {
    throw new AppError('Invalid enrollment ID', 400);
  }

  const result = await EnrollmentService.getExemptionPeriods(req.user, enrollmentId);
  res.json({ success: true, data: result });
});

export const deleteExemptionPeriod = catchAsync(async (req: Request, res: Response) => {
  const enrollmentId = parseInt(req.params.id as string);
  const exemptionId = parseInt(req.params.exemptionId as string);
  if (isNaN(enrollmentId) || isNaN(exemptionId)) {
    throw new AppError('Invalid enrollment or exemption ID', 400);
  }

  const result = await EnrollmentService.deleteExemptionPeriod(
    req.user,
    enrollmentId,
    exemptionId
  );
  res.json({ success: true, data: result });
});

export const syncAllEnrollments = catchAsync(async (req: Request, res: Response) => {
  const result = await EnrollmentService.syncAllEnrollments({
    actor: req.user ? { id: req.user.id, email: req.user.email, role: req.user.role } : undefined,
  });
  auditLog('SYNC_ALL_ENROLLMENTS', 'Enrollment', 'all', req, result);
  res.json({
    success: true,
    message: `Enrollment synchronization complete. Processed ${result.totalStudents} students with ${result.totalEnrolled} new enrollments.`,
    data: result,
  });
});

