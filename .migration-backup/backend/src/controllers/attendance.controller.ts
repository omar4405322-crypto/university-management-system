import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prismaClient';
import catchAsync from '../utils/catchAsync';
import { createNotification } from '../utils/notification.utils';
import { AppError, AuthorizationError, NotFoundError } from '../utils/appError';
import { getScopeWhere } from '../utils/scope.utils';
import { auditLog } from '../utils/audit.utils';
import logger from '../utils/logger';

const startOfDay = (d: Date | string): Date => {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  return date;
};

const recalculateStudentMetrics = async (studentId: number): Promise<void> => {
  try {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        attendance: { select: { status: true } },
        quizSubmissions: { select: { score: true } },
        taskSubmissions: { select: { taskId: true } },
        enrollments: {
          include: { course: { include: { tasks: { select: { id: true } } } },
        },
      },
    });

    if (!student) return;

    const attendanceRows: any[] = student.attendance as any[];
    const quizRows: any[] = student.quizSubmissions as any[];
    const taskSubmissionRows: any[] = student.taskSubmissions as any[];
    const enrollmentRows: any[] = student.enrollments as any[];

    const totalAttendance = attendanceRows.length;
    const excusedCount = attendanceRows.filter((a: any) => a.status === 'EXCUSED').length;
    const countedTotal = Math.max(0, totalAttendance - excusedCount);
    const presentClasses = attendanceRows.filter(
      (a: any) => a.status === 'PRESENT' || a.status === 'LATE'
    ).length;

    const attendanceRate = countedTotal > 0 ? (presentClasses / countedTotal) * 100 : 100;

    const quizScores = quizRows
      .map((s: any) => s.score)
      .filter((s: any) => s !== null) as number[];
    const averageQuizScore =
      quizScores.length > 0 ? quizScores.reduce((a, b) => a + b, 0) / quizScores.length : 100;

    const allAssignedTasks: Array<{ id: number }> = enrollmentRows.reduce(
      (acc: Array<{ id: number }>, enr: any) => acc.concat(enr?.course?.tasks ?? []),
      [] as Array<{ id: number }>
    );
    const totalAssignments = allAssignedTasks.length;
    const submittedTaskIds = new Set(taskSubmissionRows.map((s: any) => s.taskId));
    const completedAssignments = allAssignedTasks.filter((t) =>
      submittedTaskIds.has(t.id)
    ).length;
    const assignmentCompletionRate =
      totalAssignments > 0 ? (completedAssignments / totalAssignments) * 100 : 100;

    let predictedRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    if (attendanceRate < 50 || averageQuizScore < 40) {
      predictedRisk = 'CRITICAL';
    } else if (attendanceRate < 65 || averageQuizScore < 55) {
      predictedRisk = 'HIGH';
    } else if (attendanceRate < 80 || averageQuizScore < 70) {
      predictedRisk = 'MEDIUM';
    }

    await prisma.studentSuccessMetric.upsert({
      where: { studentId },
      update: {
        attendanceRate,
        averageQuizScore,
        assignmentCompletionRate,
        predictedRisk,
        lastCalculated: new Date(),
      },
      create: {
        studentId,
        attendanceRate,
        averageQuizScore,
        assignmentCompletionRate,
        predictedRisk,
        lastCalculated: new Date(),
      },
    });
  } catch (err: any) {
    logger.error(`[ATTENDANCE] Metrics recalc failed for student ${studentId}: ${err.message}`);
  }
};

/**
 * @desc    Record / update attendance for multiple students (idempotent upsert)
 * @route   POST /api/attendance
 * @access  Private (Doctor/Admin/CollegeAdmin/DeptAdmin)
 */
export const recordAttendance = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { courseId, date, records } = req.body as {
      courseId: number | string;
      date?: string;
      records: Array<{ studentId: number | string; status: string; remarks?: string }>;
    };

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

    const attendanceDate = startOfDay(date ?? new Date());

    const result = await prisma.$transaction(
      records.map((record: any) =>
        prisma.attendance.upsert({
          where: {
            studentId_courseId_date: {
              studentId: parseInt(record.studentId),
              courseId: parseInt(courseId as string),
              date: attendanceDate,
            },
          },
          create: {
            studentId: parseInt(record.studentId),
            courseId: parseInt(courseId as string),
            date: attendanceDate,
            status: record.status,
            remarks: record.remarks,
          },
          update: {
            status: record.status,
            remarks: record.remarks,
          },
          include: {
            student: { select: { userId: true, firstName: true, lastName: true, id: true } },
            course: { select: { name: true } },
          },
        })
      )
    );

    const createdOrUpdated = Array.isArray(result) ? result : [];

    Promise.all(
      createdOrUpdated
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
            logger.error(`[ATTENDANCE] Failed to send notification: ${err.message}`);
          }
        })
    ).catch(() => {});

    const affectedStudentIds = Array.from(
      new Set(createdOrUpdated.map((a: any) => a.student.id))
    );
    Promise.all(affectedStudentIds.map((sid: number) => recalculateStudentMetrics(sid))).catch(
      () => {}
    );

    auditLog('RECORD_ATTENDANCE', 'Attendance', `course-${courseId}`, req);
    res.status(200).json({ success: true, data: createdOrUpdated });
  }
);

/**
 * @desc    Update a single attendance record (correction / excuse)
 * @route   PUT /api/attendance/:id
 * @access  Private
 */
export const updateAttendance = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const id = parseInt(req.params.id as string);
    const { status, remarks } = req.body as { status?: string; remarks?: string };

    const existing = await prisma.attendance.findUnique({
      where: { id },
      include: {
        student: { include: { department: true } },
        course: { include: { department: true } },
      },
    });
    if (!existing) return next(new NotFoundError('Attendance record not found'));

    const studentScope: any = getScopeWhere(req.user!, 'student');
    if (studentScope && Object.keys(studentScope).length) {
      if (
        studentScope.department?.collegeId &&
        existing.student.department?.collegeId !== studentScope.department.collegeId
      )
        return next(new AuthorizationError('Access denied'));
      if (studentScope.departmentId && existing.student.departmentId !== studentScope.departmentId)
        return next(new AuthorizationError('Access denied'));
    }

    const updated = await prisma.attendance.update({
      where: { id },
      data: {
        ...(status !== undefined ? { status } : {}),
        ...(remarks !== undefined ? { remarks } : {}),
      },
      include: {
        student: { select: { userId: true, id: true, firstName: true, lastName: true } },
        course: { select: { name: true } },
      },
    });

    Promise.resolve(recalculateStudentMetrics(updated.student.id)).catch(() => {});

    auditLog('UPDATE_ATTENDANCE', 'Attendance', String(id), req);
    res.json({ success: true, data: updated });
  }
);

/**
 * @desc    Delete an attendance record
 * @route   DELETE /api/attendance/:id
 * @access  Private
 */
export const deleteAttendance = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const id = parseInt(req.params.id as string);

    const existing = await prisma.attendance.findUnique({
      where: { id },
      include: { student: { include: { department: true } } },
    });
    if (!existing) return next(new NotFoundError('Attendance record not found'));

    const studentScope: any = getScopeWhere(req.user!, 'student');
    if (studentScope && Object.keys(studentScope).length) {
      if (
        studentScope.department?.collegeId &&
        existing.student.department?.collegeId !== studentScope.department.collegeId
      )
        return next(new AuthorizationError('Access denied'));
      if (studentScope.departmentId && existing.student.departmentId !== studentScope.departmentId)
        return next(new AuthorizationError('Access denied'));
    }

    const studentId = existing.studentId;
    await prisma.attendance.delete({ where: { id } });

    Promise.resolve(recalculateStudentMetrics(studentId)).catch(() => {});

    auditLog('DELETE_ATTENDANCE', 'Attendance', String(id), req);
    res.json({ success: true, message: 'Attendance record deleted successfully' });
  }
);

/**
 * @desc    Bulk delete attendance records for a course+date
 * @route   DELETE /api/attendance/course/:courseId
 * @access  Private
 */
export const deleteCourseAttendanceForDate = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const courseId = parseInt(req.params.courseId as string);
    const { date } = req.query as { date?: string };
    if (!date) return next(new AppError('date query parameter is required', 400));

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: { department: true },
    });
    if (!course) return next(new NotFoundError('Course not found'));

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

    const targetDate = startOfDay(date);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const affected = await prisma.attendance.findMany({
      where: { courseId, date: { gte: targetDate, lte: endOfDay } },
      select: { studentId: true },
    });

    await prisma.attendance.deleteMany({
      where: { courseId, date: { gte: targetDate, lte: endOfDay } },
    });

    const studentIds: number[] = Array.from(new Set(affected.map((a: { studentId: number }) => a.studentId)));
    Promise.all(studentIds.map((sid: number) => recalculateStudentMetrics(sid))).catch(() => {});

    auditLog('BULK_DELETE_ATTENDANCE', 'Attendance', `course-${courseId}-${date}`, req);
    res.json({
      success: true,
      message: `Deleted ${affected.length} attendance records`,
      deleted: affected.length,
    });
  }
);

/**
 * @desc    Get attendance for a course on a specific date
 * @route   GET /api/attendance/course/:courseId
 * @access  Private (Doctor/Admin/CollegeAdmin/DeptAdmin)
 */
export const getCourseAttendance = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { courseId } = req.params;
    const { date } = req.query;

    const where: any = { courseId: parseInt(courseId as string) };

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
      const startOfTarget = startOfDay(date as string);
      const endOfTarget = new Date(startOfTarget);
      endOfTarget.setHours(23, 59, 59, 999);

      where.date = {
        gte: startOfTarget,
        lte: endOfTarget,
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
 * @desc    Get attendance summary per student for a course (all dates)
 * @route   GET /api/attendance/course/:courseId/summary
 * @access  Private
 */
export const getCourseAttendanceSummary = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const courseId = parseInt(req.params.courseId as string);

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: { department: true },
    });
    if (!course) return next(new NotFoundError('Course not found'));

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

    const records = await prisma.attendance.groupBy({
      by: ['studentId', 'status'],
      where: { courseId },
      _count: true,
    });

    const byStudent: Record<string, Record<string, number>> = {};
    records.forEach((r: any) => {
      if (!byStudent[r.studentId]) byStudent[r.studentId] = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 };
      byStudent[r.studentId][r.status] = r._count;
    });

    const summary = Object.entries(byStudent).map(([sid, counts]) => {
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      const countedTotal = Math.max(0, total - (counts.EXCUSED || 0));
      const presentLate = (counts.PRESENT || 0) + 0.5 * (counts.LATE || 0);
      const percentage = countedTotal > 0 ? Math.round((presentLate / countedTotal) * 10000) / 100 : 100;
      return {
        studentId: parseInt(sid),
        ...counts,
        total,
        percentage,
      };
    });

    res.json({ success: true, data: summary });
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

    if (req.user!.role === 'STUDENT') {
      const myStudent = await prisma.student.findUnique({
        where: { userId: req.user!.id },
        select: { id: true },
      });
      if (!myStudent || myStudent.id !== studentId) {
        return next(new AuthorizationError('You can only view your own attendance records.'));
      }
    } else {
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

    const { courseId, page = 1, limit = 20 } = req.query as {
      courseId?: string;
      page?: string | number;
      limit?: string | number;
    };

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

    const stats: Record<string, number> = {
      total,
      PRESENT: 0,
      ABSENT: 0,
      LATE: 0,
      EXCUSED: 0,
    };
    statsData.forEach((item: any) => {
      stats[item.status] = item._count;
    });

    const countedTotal = Math.max(0, total - stats.EXCUSED);
    const percentage =
      countedTotal > 0 ? ((stats.PRESENT + stats.LATE * 0.5) / countedTotal) * 100 : 100;

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
