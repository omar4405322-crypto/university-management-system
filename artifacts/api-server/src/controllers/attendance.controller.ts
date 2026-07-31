import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prismaClient';
import catchAsync from '../utils/catchAsync';
import { createNotification } from '../utils/notification.utils';
import { AppError, AuthorizationError, NotFoundError } from '../utils/appError';
import { getScopeWhere } from '../utils/scope.utils';

const recalculateAbsence = async (studentId: number, courseId: number) => {
  const statsData = await prisma.attendance.groupBy({
    by: ['status'],
    where: { studentId, courseId },
    _count: true
  });

  let total = 0;
  let excused = 0;
  let absent = 0;
  let late = 0;

  statsData.forEach(item => {
    total += item._count;
    if (item.status === 'EXCUSED') excused += item._count;
    if (item.status === 'ABSENT') absent += item._count;
    if (item.status === 'LATE') late += item._count;
  });

  const activeTotal = total - excused;
  if (activeTotal === 0) return;

  const absencePercent = ((absent + (late * 0.5)) / activeTotal) * 100;

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: { department: true }
  });

  const policies = await prisma.absenceThresholdPolicy.findMany({
    where: {
      OR: [
        { courseId },
        { departmentId: course?.departmentId },
        { departmentId: null, courseId: null }
      ]
    }
  });

  let policy = policies.find((p: any) => p.courseId === courseId);
  if (!policy) policy = policies.find((p: any) => p.departmentId === course?.departmentId);
  if (!policy) policy = policies.find((p: any) => p.courseId === null && p.departmentId === null);

  const maxAbsencePercent = policy ? policy.maxAbsencePercent : 25;

  if (absencePercent >= maxAbsencePercent) {
    const enrollment = await prisma.enrollment.findFirst({
      where: { studentId, courseId }
    });

    if (enrollment && enrollment.status !== 'BLOCKED') {
      await prisma.enrollment.update({
        where: { id: enrollment.id },
        data: { status: 'BLOCKED' }
      });

      const student = await prisma.student.findUnique({ where: { id: studentId } });
      if (student) {
        await createNotification({
          userId: student.userId,
          title: 'Enrollment Blocked',
          message: `Your enrollment in ${course?.name} has been blocked due to exceeding the maximum absence limit (${maxAbsencePercent}%).`,
          type: 'error'
        });
      }
    }
  }
};

/**
              message: `You were marked ${attendance.status.toLowerCase()} for ${attendance.course.name} on ${attendanceDate.toLocaleDateString()}.`,
              type: attendance.status === 'ABSENT' ? 'error' : 'warning',
            });
          } catch (err: any) {
            const logger = require('../utils/logger.js').default || require('../utils/logger.js');
            logger.error(`[ATTENDANCE] Failed to send notification: ${err.message}`);
          }
        }),
      ...Array.from(new Set(records.map((r: any) => parseInt(r.studentId)))).map(
        (studentId: number) => recalculateAbsence(studentId, parseInt(courseId as string))
      )
    ]).catch(() => { }); // Non-blocking: response already sent

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

    // Enforce scope: ensure course within admin/doctor scope
    const courseScope: any = getScopeWhere(req.user!, 'course');
    const course = await prisma.course.findFirst({
      where: {
        AND: [
          { id: parseInt(courseId as string) },
          courseScope
        ]
      },
      include: { department: true },
    });
    if (!course) return res.status(403).json({ success: false, message: 'Access denied: You are not authorized for this course.' });
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
          select: { id: true, studentId: true, firstName: true, lastName: true, group: { select: { id: true, name: true } } },
        },
        recordedBy: {
          select: {
            id: true,
            role: true,
            doctor: { select: { firstName: true, lastName: true } },
            teachingAssistant: { select: { firstName: true, lastName: true } }
          }
        }
      },
      orderBy: { date: 'desc' },
    });

    const mappedData = attendance.map((record: any) => ({
      ...record,
      recordedBy: record.recordedBy ? {
        id: record.recordedBy.id,
        role: record.recordedBy.role,
        firstName: record.recordedBy.doctor?.firstName || record.recordedBy.teachingAssistant?.firstName || 'Admin',
        lastName: record.recordedBy.doctor?.lastName || record.recordedBy.teachingAssistant?.lastName || 'User'
      } : null,
      group: record.student.studentGroup || null,
      recordedAt: record.createdAt
    }));

    return res.json({ success: true, data: mappedData });
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
      const studentScope: any = getScopeWhere(req.user!, 'student');
      const studentRecord = await prisma.student.findFirst({
        where: {
          AND: [
            { id: studentId },
            studentScope
          ]
        },
      });
      if (!studentRecord) return next(new AuthorizationError('Access denied or Student not found'));
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

    const effectiveTotal = total - stats.EXCUSED;
    const percentage = effectiveTotal > 0 ? ((stats.PRESENT + stats.LATE * 0.5) / effectiveTotal) * 100 : 0;

    return res.json({
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

export const getMyCourses = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const userId = req.user!.id;
  const userRole = req.user!.role;

  if (['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'].includes(userRole)) {
    const courseScope = getScopeWhere(req.user!, 'course');
    const courses = await prisma.course.findMany({
      where: courseScope,
      select: { id: true, name: true, courseCode: true }
    });
    return res.json({ success: true, data: courses });
  }

  if (userRole === 'STUDENT') {
    const myStudent = await prisma.student.findUnique({ where: { userId } });
    if (!myStudent) return res.json({ success: true, data: [] });

    // Get courses from schedule slots matching the student's group
    const slotCourseIds: number[] = [];
    if (myStudent.groupId) {
      const slots = await prisma.scheduleSlot.findMany({
        where: { groupId: myStudent.groupId },
        select: { courseId: true }
      });
      slots.forEach((s: any) => slotCourseIds.push(s.courseId));
    }

    // Also get courses from enrollments
    const enrollments = await prisma.enrollment.findMany({
      where: { studentId: myStudent.id, status: 'ENROLLED' },
      select: { courseId: true }
    });

    // Also get courses from same department/year
    const deptCourses = myStudent.departmentId ? await prisma.course.findMany({
      where: { departmentId: myStudent.departmentId, year: myStudent.year },
      select: { id: true }
    }) : [];

    const courseIds = Array.from(new Set([
      ...slotCourseIds,
      ...enrollments.map((e: any) => e.courseId),
      ...deptCourses.map((c: any) => c.id)
    ]));

    const courses = await prisma.course.findMany({
      where: { id: { in: courseIds } },
      select: { id: true, name: true, courseCode: true }
    });

    return res.json({ success: true, data: courses });
  }

  if (userRole === 'TEACHING_ASSISTANT') {
    const myTA = await prisma.teachingAssistant.findUnique({ where: { userId } });
    if (!myTA) return res.json({ success: true, data: [] });

    const slots = await prisma.scheduleSlot.findMany({
      where: { teachingAssistantId: myTA.id },
      select: { courseId: true }
    });

    const courseIds = Array.from(new Set(slots.map((s: any) => s.courseId)));
    let courses = await prisma.course.findMany({
      where: { id: { in: courseIds } },
      select: { id: true, name: true, courseCode: true }
    });

    if (courses.length === 0 && myTA.departmentId) {
      courses = await prisma.course.findMany({
        where: { departmentId: myTA.departmentId },
        select: { id: true, name: true, courseCode: true }
      });
    }

    return res.json({ success: true, data: courses });
  }

  if (userRole === 'DOCTOR') {
    const myDoctor = await prisma.doctor.findUnique({ where: { userId } });
    if (!myDoctor) return res.json({ success: true, data: [] });

    const slots = await prisma.scheduleSlot.findMany({
      where: { doctorId: myDoctor.id },
      select: { courseId: true }
    });

    const courseIds = Array.from(new Set(slots.map((s: any) => s.courseId)));
    let courses = await prisma.course.findMany({
      where: { id: { in: courseIds } },
      select: { id: true, name: true, courseCode: true }
    });

    if (courses.length === 0 && myDoctor.departmentId) {
      courses = await prisma.course.findMany({
        where: { departmentId: myDoctor.departmentId },
        select: { id: true, name: true, courseCode: true }
      });
    }

    return res.json({ success: true, data: courses });
  }

  return res.json({ success: true, data: [] });
});

export const getMySlots = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const userRole = req.user!.role;
  let slots: any[] = [];

  const selectFields = {
    course: { select: { id: true, name: true, courseCode: true } },
    group: { select: { id: true, name: true } },
    doctor: { select: { firstName: true, lastName: true } },
    teachingAssistant: { select: { firstName: true, lastName: true } }
  };
  const orderBy: any = [{ dayOfWeek: 'asc' }, { startTime: 'asc' }];

  if (userRole === 'DOCTOR') {
    const myDoctor = await prisma.doctor.findUnique({ where: { userId: req.user!.id } });
    if (myDoctor) {
      slots = await prisma.scheduleSlot.findMany({
        where: { doctorId: myDoctor.id },
        include: selectFields,
        orderBy
      });

      if (slots.length === 0 && myDoctor.departmentId) {
        slots = await prisma.scheduleSlot.findMany({
          where: { course: { departmentId: myDoctor.departmentId } },
          include: selectFields,
          orderBy
        });
      }
    }
  } else if (userRole === 'TEACHING_ASSISTANT') {
    const myTA = await prisma.teachingAssistant.findUnique({ where: { userId: req.user!.id } });
    if (myTA) {
      slots = await prisma.scheduleSlot.findMany({
        where: { teachingAssistantId: myTA.id },
        include: selectFields,
        orderBy
      });

      if (slots.length === 0 && myTA.departmentId) {
        slots = await prisma.scheduleSlot.findMany({
          where: { course: { departmentId: myTA.departmentId } },
          include: selectFields,
          orderBy
        });
      }
    }
  } else if (['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'].includes(userRole)) {
    const courseScope: any = getScopeWhere(req.user!, 'course');
    const where: any = (courseScope && Object.keys(courseScope).length > 0) ? { course: courseScope } : {};
    slots = await prisma.scheduleSlot.findMany({
      where,
      include: selectFields,
      orderBy
    });
  }

  // Global fallback if still 0 slots found
  if (slots.length === 0 && ['DOCTOR', 'TEACHING_ASSISTANT', 'SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'].includes(userRole)) {
    slots = await prisma.scheduleSlot.findMany({
      include: selectFields,
      orderBy
    });
  }

  return res.json({ success: true, data: slots });
});

export const getMyAttendance = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const student = await prisma.student.findUnique({
    where: { userId: req.user!.id }
  });
  if (!student) return next(new AuthorizationError('Student profile not found.'));

  const studentId = student.id;
  const { courseId } = req.query;
  
  if (!courseId) {
    return next(new AppError('courseId is required', 400));
  }

  // 1. Find all slots for this student and course
  // They could be in the slot via groupId or it's a general lecture (no groupId)
  const slots = await prisma.scheduleSlot.findMany({
    where: {
      courseId: parseInt(courseId as string),
      OR: [
        { groupId: student.groupId },
        { groupId: null }
      ]
    }
  });

  const slotIds = slots.map(s => s.id);

  // 2. Find all sessions for these slots
  const sessions = await prisma.attendanceSession.findMany({
    where: { scheduleSlotId: { in: slotIds } },
    orderBy: { createdAt: 'desc' },
    include: { scheduleSlot: { include: { course: true } } }
  });

  // 3. Find student's attendance records for these sessions
  const attendances = await prisma.attendance.findMany({
    where: {
      studentId,
      sessionId: { in: sessions.map(s => s.id) }
    }
  });

  const attendanceMap = new Map();
  attendances.forEach((a: any) => attendanceMap.set(a.sessionId, a));

  // 4. Combine
  const data = sessions.map(session => {
    const record = attendanceMap.get(session.id);
    return {
      sessionId: session.id,
      date: session.createdAt,
      course: session.scheduleSlot.course,
      status: record ? record.status : 'ABSENT', // Implicit absence
      remarks: record ? record.remarks : null
    };
  });

  return res.json({ success: true, data });
});

export const getAttendanceSummary = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { courseId } = req.params;

  const courseScope: any = getScopeWhere(req.user!, 'course');
  const course = await prisma.course.findFirst({
    where: {
      AND: [
        { id: parseInt(courseId as string) },
        courseScope
      ]
    }
  });
  if (!course) return next(new AuthorizationError('Access denied: You are not authorized for this course.'));

  const statsData = await prisma.attendance.groupBy({
    by: ['status'],
    where: { courseId: parseInt(courseId as string) },
    _count: true
  });
  const stats: any = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 };
  statsData.forEach(item => stats[item.status] = item._count);
  return res.json({ success: true, data: stats });
});



export const getAttendanceRecords = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { courseId, date, departmentId, collegeId, page = 1, limit = 50 } = req.query;

  const where: any = {};

  if (courseId) where.courseId = parseInt(courseId as string);
  if (date) {
    const startOfDay = new Date(date as string);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date as string);
    endOfDay.setHours(23, 59, 59, 999);
    where.date = { gte: startOfDay, lte: endOfDay };
  }

  if (departmentId) {
    where.course = { departmentId: parseInt(departmentId as string) };
  } else if (collegeId) {
    where.course = { department: { collegeId: parseInt(collegeId as string) } };
  }

  const courseScope: any = getScopeWhere(req.user!, 'course');
  if (courseScope && Object.keys(courseScope).length) {
    if (where.course) {
      where.course = { AND: [where.course, courseScope] };
    } else {
      where.course = courseScope;
    }
  }

  const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

  const [attendance, total] = await Promise.all([
    prisma.attendance.findMany({
      where,
      include: {
        student: {
          select: { id: true, studentId: true, firstName: true, lastName: true, group: { select: { id: true, name: true } } },
        },
        course: { select: { name: true, courseCode: true } },
        recordedBy: {
          select: {
            id: true,
            role: true,
            doctor: { select: { firstName: true, lastName: true } },
            teachingAssistant: { select: { firstName: true, lastName: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit as string),
    }),
    prisma.attendance.count({ where })
  ]);

  const mappedData = attendance.map((record: any) => ({
    ...record,
    recordedBy: record.recordedBy ? {
      id: record.recordedBy.id,
      role: record.recordedBy.role,
      firstName: record.recordedBy.doctor?.firstName || record.recordedBy.teachingAssistant?.firstName || 'Admin',
      lastName: record.recordedBy.doctor?.lastName || record.recordedBy.teachingAssistant?.lastName || 'User'
    } : null,
    group: record.student.studentGroup || null,
    recordedAt: record.createdAt
  }));

  return res.json({
    success: true,
    data: mappedData,
    pagination: {
      total,
      page: parseInt(page as string),
      totalPages: Math.ceil(total / parseInt(limit as string))
    }
  });
});

export const unblockEnrollment = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { enrollmentId } = req.params;

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: parseInt(enrollmentId as string) },
    include: { course: true, student: true }
  });

  if (!enrollment) return next(new NotFoundError('Enrollment not found'));

  const courseScope: any = getScopeWhere(req.user!, 'course');
  if (courseScope && Object.keys(courseScope).length) {
    const courseCheck = await prisma.course.findFirst({
      where: { AND: [{ id: enrollment.courseId }, courseScope] }
    });
    if (!courseCheck) return next(new AuthorizationError('Access denied: You are not authorized for this course.'));
  }

  if (enrollment.status !== 'BLOCKED') return res.json({ success: true, message: 'Enrollment is not blocked' });

  await prisma.enrollment.update({
    where: { id: enrollment.id },
    data: { status: 'ENROLLED' }
  });

  return res.json({ success: true, message: 'Student unblocked successfully' });
});

export const getAuditDuplicateDevices = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  // Find deviceIds that have been used by more than one distinct student
  const duplicates: any[] = await prisma.$queryRaw`
    SELECT "deviceId", 
           COUNT(DISTINCT "studentId")::int as "studentCount", 
           array_agg(DISTINCT "studentId") as "studentIds"
    FROM "Attendance"
    WHERE "deviceId" IS NOT NULL
    GROUP BY "deviceId"
    HAVING COUNT(DISTINCT "studentId") > 1
  `;
  
  if (!duplicates || duplicates.length === 0) {
    return res.json({ success: true, data: [] });
  }

  // Enrich with student details
  const enrichedDuplicates = await Promise.all(duplicates.map(async (dup) => {
    const students = await prisma.student.findMany({
      where: { id: { in: dup.studentIds } },
      select: { id: true, studentId: true, firstName: true, lastName: true, user: { select: { email: true } } }
    });
    return {
      deviceId: dup.deviceId,
      studentCount: dup.studentCount,
      students
    };
  }));

  return res.json({ success: true, data: enrichedDuplicates });
});

