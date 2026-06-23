import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prismaClient';
import catchAsync from '../utils/catchAsync';
import { createNotification } from '../utils/notification.utils';
import { AppError, AuthorizationError, NotFoundError } from '../utils/appError';
import { getScopeWhere } from '../utils/scope.utils';

/**
 * @desc    Record attendance for multiple students
 * @route   POST /api/attendance
 * @access  Private (Doctor/Admin)
 */
export const recordAttendance = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { courseId, date, records } = req.body; // records: [{ studentId, status, remarks }]

    // Validate course scope
    const course = await prisma.course.findUnique({
      where: { id: parseInt(courseId as string) },
      include: { department: true },
    });
    if (!course) return next(new AppError('Course not found', 404));
    const courseScope: any = getScopeWhere(req.user!, 'course');
    if (courseScope && Object.keys(courseScope).length) {
      if (
        courseScope.department &&
        course.department?.collegeId !== courseScope.department.collegeId
      )
        return next(new AuthorizationError('Access denied'));
      if (courseScope.departmentId && course.departmentId !== courseScope.departmentId)
        return next(new AuthorizationError('Access denied'));
    }

    const attendanceDate = date ? new Date(date as string) : new Date();

    const createdRecords = await prisma.$transaction(
      records.map((record: any) =>
        prisma.attendance.create({
          data: {
            studentId: parseInt(record.studentId),
            courseId: parseInt(courseId as string),
            date: attendanceDate,
            status: record.status,
            remarks: record.remarks,
          },
          include: {
            student: { select: { userId: true, firstName: true, lastName: true } },
            course: { select: { name: true } },
          },
        })
      )
    );

    // Send attendance notifications concurrently (non-blocking, errors logged)
    Promise.all(
      createdRecords
        .filter((a: any) => a.status === 'ABSENT' || a.status === 'LATE')
        .map(async (attendance: any) => {
          try {
            await createNotification({
              userId: attendance.student.userId,
              title: `Attendance Alert: ${attendance.status}`,
              message: `You were marked ${attendance.status.toLowerCase()} for ${attendance.course.name} on ${attendanceDate.toLocaleDateString()}.`,
              type: attendance.status === 'ABSENT' ? 'error' : 'warning',
            });
          } catch (err: any) {
            const logger = require('../utils/logger.js').default || require('../utils/logger.js');
            logger.error(`[ATTENDANCE] Failed to send notification: ${err.message}`);
          }
        })
    ).catch(() => {}); // Non-blocking: response already sent

    res.status(201).json({ success: true, data: createdRecords });
  }
);

/**
 * @desc    Get attendance for a course on a specific date
 * @route   GET /api/attendance/course/:courseId
 * @access  Private (Doctor/Admin)
 */
export const getCourseAttendance = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { courseId } = req.params;
    const { date } = req.query;

    const where: any = { courseId: parseInt(courseId as string) };

    // Enforce scope: ensure course within admin scope
    const course = await prisma.course.findUnique({
      where: { id: parseInt(courseId as string) },
      include: { department: true },
    });
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
    const courseScope: any = getScopeWhere(req.user!, 'course');
    if (courseScope && Object.keys(courseScope).length) {
      if (
        courseScope.department &&
        course.department?.collegeId !== courseScope.department.collegeId
      )
        return res.status(403).json({ success: false, message: 'Access denied' });
      if (courseScope.departmentId && course.departmentId !== courseScope.departmentId)
        return res.status(403).json({ success: false, message: 'Access denied' });
    }
    if (date) {
      const startOfDay = new Date(date as string);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date as string);
      endOfDay.setHours(23, 59, 59, 999);

      where.date = {
        gte: startOfDay,
        lte: endOfDay,
      };
    }

    const attendance = await prisma.attendance.findMany({
      where,
      include: {
        student: {
          select: { id: true, studentId: true, firstName: true, lastName: true },
        },
      },
      orderBy: { date: 'desc' },
    });

    res.json({ success: true, data: attendance });
  }
);

/**
 * @desc    Get attendance history for a student with stats
 * @route   GET /api/attendance/student/:studentId
 * @access  Private
 */
export const getStudentAttendance = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const studentId = parseInt(req.params.studentId as string);

    // Ownership check for students (Fix IDOR)
    if (req.user!.role === 'STUDENT') {
      const myStudent = await prisma.student.findUnique({
        where: { userId: req.user!.id },
        select: { id: true },
      });
      if (!myStudent || myStudent.id !== studentId) {
        return next(new AuthorizationError('You can only view your own attendance records.'));
      }
    } else {
      // If admin viewing other student's attendance, ensure student is within scope
      const studentRecord = await prisma.student.findUnique({
        where: { id: studentId },
        include: { department: true },
      });
      if (!studentRecord) return next(new NotFoundError('Student not found'));
      const deptScope: any = getScopeWhere(req.user!, 'department');
      if (deptScope && Object.keys(deptScope).length) {
        if (deptScope.collegeId && studentRecord.department?.collegeId !== deptScope.collegeId)
          return next(new AuthorizationError('Access denied'));
        if (deptScope.id && studentRecord.departmentId !== deptScope.id)
          return next(new AuthorizationError('Access denied'));
      }
    }

    const { courseId, page = 1, limit = 20 } = req.query;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: any = { studentId };
    if (courseId) where.courseId = parseInt(courseId as string);

    const [attendance, total, statsData] = await Promise.all([
      prisma.attendance.findMany({
        where,
        include: {
          course: { select: { name: true, courseCode: true } },
        },
        orderBy: { date: 'desc' },
        skip,
        take: parseInt(limit as string),
      }),
      prisma.attendance.count({ where }),
      prisma.attendance.groupBy({
        by: ['status'],
        where,
        _count: true,
      }),
    ]);

    // Transform group by data into stats object
    const stats: any = {
      total,
      PRESENT: 0,
      ABSENT: 0,
      LATE: 0,
      EXCUSED: 0,
    };
    statsData.forEach((item: any) => {
      stats[item.status] = item._count;
    });

    const percentage = total > 0 ? ((stats.PRESENT + stats.LATE * 0.5) / total) * 100 : 0;

    res.json({
      success: true,
      data: attendance,
      pagination: {
        total,
        page: parseInt(page as string),
        totalPages: Math.ceil(total / parseInt(limit as string)),
      },
      stats: {
        ...stats,
        percentage: Math.round(percentage * 100) / 100,
      },
    });
  }
);
