import { Request, Response } from 'express';
import catchAsync from '../utils/catchAsync';
import { ValidationError, AppError, NotFoundError } from '../utils/appError';
import prisma from '../utils/prismaClient';
import { auditLog } from '../utils/audit.utils';
import { EnrollmentService } from '../services/enrollment.service';

export const enrollStudent = catchAsync(async (req: Request, res: Response) => {
  const { studentId, courseId, semester, academicYear } = req.body;

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

  const enrollment = await EnrollmentService.enrollStudent(
    parsedStudentId,
    parsedCourseId,
    parsedSemester,
    parsedAcademicYear
  );
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

  const withdrawn = await EnrollmentService.withdrawStudent(enrollment.id);
  res.json({ success: true, data: withdrawn });
});

export const getEnrollments = catchAsync(async (req: Request, res: Response) => {
  const { studentId, courseId, semester } = req.query;
  const where: any = {};
  if (studentId) where.studentId = parseInt(studentId as string);
  if (courseId) where.courseId = parseInt(courseId as string);
  if (semester) where.semester = parseInt(semester as string);

  const enrollments = await prisma.enrollment.findMany({ where });
  res.json({ success: true, data: enrollments });
});

export const updateGrade = catchAsync(async (req: Request, res: Response) => {
  const { finalGrade } = req.body;

  if (finalGrade < 0 || finalGrade > 100) {
    throw new ValidationError('Grade must be between 0 and 100');
  }

  const enrollment = await prisma.enrollment.update({
    where: { id: parseInt(req.params.id as string) },
    data: {
      finalGrade,
      status: finalGrade >= 60 ? 'COMPLETED' : 'FAILED',
    },
  });

  auditLog('UPDATE_GRADE', 'Enrollment', enrollment.id.toString(), req, {
    finalGrade: { from: null, to: finalGrade },
  });

  res.json({ success: true, data: enrollment });
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

