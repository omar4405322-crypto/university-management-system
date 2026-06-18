import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prismaClient.js';
import { auditLog } from '../utils/audit.utils.js';
import { getScopeWhere } from '../utils/scope.utils.js';
import catchAsync from '../utils/catchAsync.js';
import { NotFoundError, AuthorizationError, AppError } from '../utils/appError.js';

export const getAllSchedules = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { courseId, departmentId, collegeId, year, semester } = req.query as Record<string, string>;
  const { user } = req;

  let where: any = {};
  
  // Role-based filtering
  if (user!.role === 'STUDENT') {
    const student = await prisma.student.findUnique({
      where: { userId: user!.id },
      select: { id: true, departmentId: true, enrolledAt: true }
    });

    if (!student) {
      return next(new NotFoundError('Student profile not found'));
    }

    // Calculate year and semester if not provided
    let filterYear = year !== undefined ? parseInt(year as string) : null;
    let filterSemester = semester !== undefined ? parseInt(semester as string) : null;

    if (!filterYear) {
      const enrolledDate = new Date(student.enrolledAt);
      const now = new Date();
      const yearsDiff = now.getFullYear() - enrolledDate.getFullYear();
      filterYear = Math.max(1, yearsDiff + 1);
    }

    if (!filterSemester) {
      const month = new Date().getMonth() + 1;
      filterSemester = (month >= 2 && month <= 6) ? 2 : (month >= 7 && month <= 8) ? 3 : 1;
    }

    where.course = {
      departmentId: student.departmentId,
      year: filterYear,
      semester: filterSemester
    };
  } else {
      // For Admins and Doctors
      if (courseId) {
        where.courseId = parseInt(courseId as string);
      } else if (departmentId) {
        where.course = { departmentId: parseInt(departmentId as string) };
      } else if (collegeId) {
        where.course = { department: { collegeId: parseInt(collegeId as string) } };
      }

      if (year !== undefined) {
        where.course = { ...where.course, year: parseInt(year as string) };
      }
      if (semester !== undefined) {
        where.course = { ...where.course, semester: parseInt(semester as string) };
      }

      // Apply role scoping via helper (for COLLEGE_ADMIN / DEPARTMENT_ADMIN)
      const scheduleScope: any = getScopeWhere(user!, 'schedule');
      if (scheduleScope && Object.keys(scheduleScope).length) {
        where = { ...where, ...scheduleScope };
      }
    }

  const schedules = await prisma.schedule.findMany({
    where,
    include: {
      course: {
        include: {
          department: {
            include: {
              college: true
            }
          },
          doctor: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
    orderBy: [
      { dayOfWeek: 'asc' },
      { startTime: 'asc' },
    ],
  });

  res.json({ success: true, data: schedules });
});

export const getWeeklyTimetable = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { departmentId, collegeId, courseId, year, semester } = req.query as Record<string, string>;
  const { user } = req;

  let where: any = {};
  
  // Role-based filtering
  if (user!.role === 'STUDENT') {
    const student = await prisma.student.findUnique({
      where: { userId: user!.id },
      select: { id: true, departmentId: true, enrolledAt: true }
    });

    if (!student) {
      return next(new NotFoundError('Student profile not found'));
    }

    let filterYear = year !== undefined ? parseInt(year as string) : null;
    let filterSemester = semester !== undefined ? parseInt(semester as string) : null;

    if (!filterYear) {
      const enrolledDate = new Date(student.enrolledAt);
      const now = new Date();
      const yearsDiff = now.getFullYear() - enrolledDate.getFullYear();
      filterYear = Math.max(1, yearsDiff + 1);
    }

    if (!filterSemester) {
      const month = new Date().getMonth() + 1;
      filterSemester = (month >= 2 && month <= 6) ? 2 : (month >= 7 && month <= 8) ? 3 : 1;
    }

    where.course = {
      departmentId: student.departmentId,
      year: filterYear,
      semester: filterSemester
    };
  } else {
    if (courseId) {
      where.courseId = parseInt(courseId as string);
    } else if (departmentId) {
      where.course = { departmentId: parseInt(departmentId as string) };
    } else if (collegeId) {
      where.course = { department: { collegeId: parseInt(collegeId as string) } };
    }

    if (year !== undefined) {
      where.course = { ...where.course, year: parseInt(year as string) };
    }
    if (semester !== undefined) {
      where.course = { ...where.course, semester: parseInt(semester as string) };
    }

    // Apply role scoping via helper
    const scheduleScope: any = getScopeWhere(user!, 'schedule');
    if (scheduleScope && Object.keys(scheduleScope).length) {
      where = { ...where, ...scheduleScope };
    }
  }

  const schedules = await prisma.schedule.findMany({
    where,
    include: {
      course: {
        include: {
          department: {
            include: {
              college: true
            }
          },
          doctor: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
  });

  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const timetable = days.reduce((acc: any, day: string) => {
    acc[day] = schedules
      .filter((s: any) => s.dayOfWeek === day)
      .sort((a: any, b: any) => a.startTime.localeCompare(b.startTime));
    return acc;
  }, {});

  res.json({ success: true, data: timetable });
});

export const createSchedule = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { courseId, dayOfWeek, startTime, endTime, room } = req.body;

  // Validate course exists and is within user's scope
  const course = await prisma.course.findUnique({ where: { id: parseInt(courseId as string) }, include: { department: true } });
  if (!course) return next(new NotFoundError('Course not found'));
  const courseScope: any = getScopeWhere(req.user!, 'course');
  if (courseScope && Object.keys(courseScope).length) {
    if (courseScope.department && course.department?.collegeId !== courseScope.department.collegeId) {
      return next(new AuthorizationError('Access denied'));
    }
    if (courseScope.departmentId && course.departmentId !== courseScope.departmentId) {
      return next(new AuthorizationError('Access denied'));
    }
  }

  // Validate: no time conflict for same room on same day
  const conflict = await prisma.schedule.findFirst({
    where: {
      dayOfWeek,
      room,
      OR: [
        {
          AND: [
            { startTime: { lte: startTime } },
            { endTime: { gt: startTime } },
          ],
        },
        {
          AND: [
            { startTime: { lt: endTime } },
            { endTime: { gte: endTime } },
          ],
        },
      ],
    },
  });

  if (conflict) {
    return next(new AppError(`Time conflict in room ${room} on ${dayOfWeek}`, 400));
  }

  const schedule = await prisma.schedule.create({
    data: {
      courseId: parseInt(courseId as string),
      dayOfWeek,
      startTime,
      endTime,
      room,
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

  res.status(201).json({ success: true, data: schedule });
});

export const updateSchedule = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { dayOfWeek, startTime, endTime, room } = req.body;

  const existing = await prisma.schedule.findUnique({ where: { id: parseInt(req.params.id as string) }, include: { course: { include: { department: true } } } });
  if (!existing) return next(new NotFoundError('Schedule not found'));

  // Enforce scope
  const courseScope: any = getScopeWhere(req.user!, 'course');
  if (courseScope && Object.keys(courseScope).length) {
    if (courseScope.department && existing.course?.department?.collegeId !== courseScope.department.collegeId) {
      return next(new AuthorizationError('Access denied'));
    }
    if (courseScope.departmentId && existing.course?.departmentId !== courseScope.departmentId) {
      return next(new AuthorizationError('Access denied'));
    }
  }

  const schedule = await prisma.schedule.update({
    where: { id: parseInt(req.params.id as string) },
    data: {
      dayOfWeek,
      startTime,
      endTime,
      room,
    },
  });

  res.json({ success: true, data: schedule });
});

export const deleteSchedule = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const existing = await prisma.schedule.findUnique({ where: { id: parseInt(req.params.id as string) }, include: { course: { include: { department: true } } } });
  if (!existing) return next(new NotFoundError('Schedule not found'));

  // Enforce scope
  const courseScope: any = getScopeWhere(req.user!, 'course');
  if (courseScope && Object.keys(courseScope).length) {
    if (courseScope.department && existing.course?.department?.collegeId !== courseScope.department.collegeId) {
      return next(new AuthorizationError('Access denied'));
    }
    if (courseScope.departmentId && existing.course?.departmentId !== courseScope.departmentId) {
      return next(new AuthorizationError('Access denied'));
    }
  }

  await prisma.schedule.delete({ where: { id: parseInt(req.params.id as string) } });
  auditLog('DELETE_SCHEDULE', 'Schedule', req.params.id as string, req);
  res.json({ success: true, message: 'Schedule deleted' });
});
