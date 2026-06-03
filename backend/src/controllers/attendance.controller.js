const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const catchAsync = require('../utils/catchAsync');
const { createNotification } = require('../utils/notification.utils');
const { AppError } = require('../utils/appError');

/**
 * @desc    Record attendance for multiple students
 * @route   POST /api/attendance
 * @access  Private (Doctor/Admin)
 */
exports.recordAttendance = catchAsync(async (req, res, next) => {
  const { courseId, date, records } = req.body; // records: [{ studentId, status, remarks }]

  const attendanceDate = date ? new Date(date) : new Date();

  const createdRecords = await prisma.$transaction(
    records.map((record) => 
      prisma.attendance.create({
        data: {
          studentId: parseInt(record.studentId),
          courseId: parseInt(courseId),
          date: attendanceDate,
          status: record.status,
          remarks: record.remarks
        },
        include: {
          student: { select: { userId: true, firstName: true, lastName: true } },
          course: { select: { name: true } }
        }
      })
    )
  );

  // Async notifications - don't block the response
  createdRecords.forEach(async (attendance) => {
    if (attendance.status === 'ABSENT' || attendance.status === 'LATE') {
      await createNotification({
        userId: attendance.student.userId,
        title: `Attendance Alert: ${attendance.status}`,
        message: `You were marked ${attendance.status.toLowerCase()} for ${attendance.course.name} on ${attendanceDate.toLocaleDateString()}.`,
        type: attendance.status === 'ABSENT' ? 'error' : 'warning'
      });
    }
  });

  res.status(201).json({ success: true, data: createdRecords });
});

/**
 * @desc    Get attendance for a course on a specific date
 * @route   GET /api/attendance/course/:courseId
 * @access  Private (Doctor/Admin)
 */
exports.getCourseAttendance = catchAsync(async (req, res, next) => {
  const { courseId } = req.params;
  const { date } = req.query;

  const where = { courseId: parseInt(courseId) };
  if (date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    where.date = {
      gte: startOfDay,
      lte: endOfDay
    };
  }

  const attendance = await prisma.attendance.findMany({
    where,
    include: {
      student: {
        select: { id: true, studentId: true, firstName: true, lastName: true }
      }
    },
    orderBy: { date: 'desc' }
  });

  res.json({ success: true, data: attendance });
});

/**
 * @desc    Get attendance history for a student with stats
 * @route   GET /api/attendance/student/:studentId
 * @access  Private
 */
exports.getStudentAttendance = catchAsync(async (req, res, next) => {
  const studentId = parseInt(req.params.studentId);
  const { courseId, page = 1, limit = 20 } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const where = { studentId };
  if (courseId) where.courseId = parseInt(courseId);

  const [attendance, total, statsData] = await Promise.all([
    prisma.attendance.findMany({
      where,
      include: {
        course: { select: { name: true, courseCode: true } }
      },
      orderBy: { date: 'desc' },
      skip,
      take: parseInt(limit)
    }),
    prisma.attendance.count({ where }),
    prisma.attendance.groupBy({
      by: ['status'],
      where,
      _count: true
    })
  ]);

  // Transform group by data into stats object
  const stats = {
    total,
    PRESENT: 0,
    ABSENT: 0,
    LATE: 0,
    EXCUSED: 0
  };
  statsData.forEach(item => {
    stats[item.status] = item._count;
  });

  const percentage = total > 0 
    ? ((stats.PRESENT + (stats.LATE * 0.5)) / total) * 100 
    : 0;

  res.json({
    success: true,
    data: attendance,
    pagination: {
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit))
    },
    stats: {
      ...stats,
      percentage: Math.round(percentage * 100) / 100
    }
  });
});
