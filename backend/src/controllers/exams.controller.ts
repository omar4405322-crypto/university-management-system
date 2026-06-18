// FIXED: Exam fields align with DB (room, no title/location column) - schema sync
import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prismaClient.js';
import { auditLog } from '../utils/audit.utils.js';
import catchAsync from '../utils/catchAsync.js';
import { NotFoundError, AuthorizationError } from '../utils/appError.js';
import { getScopeWhere } from '../utils/scope.utils.js';

export const getAllExams = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { type, upcoming } = req.query;

  // Apply centralized scope
  const examScope: any = getScopeWhere(req.user!, 'exam');
  let where: any = {};
  if (examScope && Object.keys(examScope).length) {
    where = { ...where, ...examScope };
  }

  if (type) where.type = type;
  if (upcoming === 'true') {
    where.date = { gte: new Date() };
  }

  const exams = await prisma.exam.findMany({
    where,
    include: {
      course: {
        select: {
          name: true,
          courseCode: true,
        },
      },
    },
    orderBy: { date: 'asc' },
  });

  res.json({ success: true, data: exams });
});

export const getUpcomingExams = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  // Apply centralized scope
  const examScope: any = getScopeWhere(req.user!, 'exam');
  const exams = await prisma.exam.findMany({
    where: {
      ...(examScope && Object.keys(examScope).length ? examScope : {}),
      date: { gte: new Date() },
    },
    include: {
      course: {
        select: {
          name: true,
          courseCode: true,
        },
      },
    },
    orderBy: { date: 'asc' },
  });

  res.json({ success: true, data: exams });
});

export const createExam = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { courseId, type, date, startTime, endTime, room, location } = req.body;

  // Check if course belongs to admin's scope
  const course = await prisma.course.findUnique({
    where: { id: parseInt(courseId as string) },
    include: { department: true }
  });

  if (!course) {
    return next(new NotFoundError('Course not found'));
  }

  // Enforce scope via helper
  const courseScope: any = getScopeWhere(req.user!, 'course');
  if (courseScope && Object.keys(courseScope).length) {
    if (courseScope.department && course.department?.collegeId !== courseScope.department.collegeId) {
      return next(new AuthorizationError('Access denied'));
    }
    if (courseScope.departmentId && course.departmentId !== courseScope.departmentId) {
      return next(new AuthorizationError('Access denied'));
    }
  }

  const exam = await prisma.exam.create({
    data: {
      courseId: parseInt(courseId as string),
      type: type || 'MIDTERM',
      date: new Date(date as string),
      startTime,
      endTime,
      room: room || location || 'TBA',
    },
    include: {
      course: {
        select: {
          name: true,
          courseCode: true,
        },
      },
    },
  });

  res.status(201).json({ success: true, data: exam });
});

export const updateExam = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { type, date, startTime, endTime, room } = req.body;
  const id = parseInt(req.params.id as string);

  const exam = await prisma.exam.findUnique({
    where: { id },
    include: { course: { include: { department: true } } }
  });

  if (!exam) {
    return next(new NotFoundError('Exam not found'));
  }

  // Enforce scope via helper
  const examCourseScope: any = getScopeWhere(req.user!, 'course');
  if (examCourseScope && Object.keys(examCourseScope).length) {
    if (examCourseScope.department && exam.course?.department?.collegeId !== examCourseScope.department.collegeId) return next(new AuthorizationError('Access denied'));
    if (examCourseScope.departmentId && exam.course?.departmentId !== examCourseScope.departmentId) return next(new AuthorizationError('Access denied'));
  }

  const updatedExam = await prisma.exam.update({
    where: { id },
    data: {
      type,
      date: date ? new Date(date as string) : undefined,
      startTime,
      endTime,
      room,
    },
  });

  res.json({ success: true, data: updatedExam });
});

export const deleteExam = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const id = parseInt(req.params.id as string);
  const exam = await prisma.exam.findUnique({
    where: { id },
    include: { course: { include: { department: true } } }
  });

  if (!exam) {
    return next(new NotFoundError('Exam not found'));
  }

  // Enforce scope via helper
  const examCourseScope: any = getScopeWhere(req.user!, 'course');
  if (examCourseScope && Object.keys(examCourseScope).length) {
    if (examCourseScope.department && exam.course?.department?.collegeId !== examCourseScope.department.collegeId) return next(new AuthorizationError('Access denied'));
    if (examCourseScope.departmentId && exam.course?.departmentId !== examCourseScope.departmentId) return next(new AuthorizationError('Access denied'));
  }

  await prisma.exam.delete({
    where: { id },
  });
  auditLog('DELETE_EXAM', 'Exam', req.params.id as string, req);
  res.json({ success: true, message: 'Exam deleted' });
});

export const getExamById = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const id = parseInt(req.params.id as string);
  const exam: any = await prisma.exam.findUnique({
    where: { id },
    include: {
      course: {
        select: {
          name: true,
          courseCode: true,
          department: {
            select: {
              name: true,
              college: { select: { name: true } }
            }
          }
        },
      },
    },
  });

  if (!exam) {
    return next(new NotFoundError('Exam not found'));
  }

  // Enforce scope on read
  const courseScope: any = getScopeWhere(req.user!, 'course');
  if (courseScope && Object.keys(courseScope).length) {
    if (courseScope.department && exam.course?.department?.collegeId !== courseScope.department.collegeId) {
      return next(new AuthorizationError('Access denied'));
    }
    if (courseScope.departmentId && exam.course?.departmentId !== courseScope.departmentId) {
      return next(new AuthorizationError('Access denied'));
    }
  }

  res.json({ success: true, data: exam });
});
