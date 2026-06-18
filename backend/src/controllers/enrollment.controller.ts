import { Request, Response } from 'express';
import catchAsync from '../utils/catchAsync.js';
import { ValidationError, AppError, AuthorizationError } from '../utils/appError.js';
import prisma from '../utils/prismaClient.js';
import { auditLog } from '../utils/audit.utils.js';
import { EnrollmentService } from '../services/enrollment.service.js';

export const enrollStudent = catchAsync(async (req: Request, res: Response) => {
  const { studentId, courseId, semester, academicYear } = req.body;
  const enrollment = await EnrollmentService.enrollStudent(
    parseInt(studentId),
    parseInt(courseId),
    parseInt(semester),
    parseInt(academicYear)
  );
  res.status(201).json({ success: true, data: enrollment });
});

export const withdrawStudent = catchAsync(async (req: Request, res: Response) => {
  // DELETE /api/enrollments/:id
  const enrollment = await prisma.enrollment.findUnique({
    where: { id: parseInt(req.params.id as string) },
  });

  if (!enrollment) {
    throw new ValidationError('Enrollment not found');
  }

  if (req.user!.role === 'STUDENT' && (req.user as any).student?.id !== enrollment.studentId) {
    throw new AuthorizationError('You can only withdraw from your own enrollments');
  }

  const withdrawn = await EnrollmentService.withdrawStudent(enrollment.studentId, enrollment.courseId);
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
      status: finalGrade >= 60 ? 'COMPLETED' : 'FAILED'
    }
  });

  auditLog('UPDATE_GRADE', 'Enrollment', enrollment.id.toString(), req, {
    finalGrade: { from: null, to: finalGrade }
  });

  res.json({ success: true, data: enrollment });
});
