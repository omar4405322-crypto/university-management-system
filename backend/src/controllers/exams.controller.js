// FIXED: Exam fields align with DB (room, no title/location column) - schema sync
const prisma = require('../utils/prismaClient');
const { auditLog } = require('../utils/audit.utils');
const catchAsync = require('../utils/catchAsync');
const { NotFoundError, AuthorizationError } = require('../utils/appError');
const { getScopeWhere } = require('../utils/scope.utils');

exports.getAllExams = catchAsync(async (req, res, next) => {
  const { type, upcoming } = req.query;

  // Apply centralized scope
  const examScope = getScopeWhere(req.user, 'exam');
  let where = {};
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

exports.getUpcomingExams = catchAsync(async (req, res, next) => {
  // Apply centralized scope
  const examScope = getScopeWhere(req.user, 'exam');
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

exports.createExam = catchAsync(async (req, res, next) => {
  const { courseId, type, date, startTime, endTime, room, location } = req.body;

  // Check if course belongs to admin's scope
  const course = await prisma.course.findUnique({
    where: { id: parseInt(courseId) },
    include: { department: true }
  });

  if (!course) {
    return next(new NotFoundError('Course not found'));
  }

  // Enforce scope via helper
  const courseScope = getScopeWhere(req.user, 'course');
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
      courseId: parseInt(courseId),
      type: type || 'MIDTERM',
      date: new Date(date),
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

exports.updateExam = catchAsync(async (req, res, next) => {
  const { type, date, startTime, endTime, room } = req.body;
  const id = parseInt(req.params.id);

  const exam = await prisma.exam.findUnique({
    where: { id },
    include: { course: { include: { department: true } } }
  });

  if (!exam) {
    return next(new NotFoundError('Exam not found'));
  }

  // Enforce scope via helper
  const examCourseScope = getScopeWhere(req.user, 'course');
  if (examCourseScope && Object.keys(examCourseScope).length) {
    if (examCourseScope.department && exam.course?.department?.collegeId !== examCourseScope.department.collegeId) return next(new AuthorizationError('Access denied'));
    if (examCourseScope.departmentId && exam.course?.departmentId !== examCourseScope.departmentId) return next(new AuthorizationError('Access denied'));
  }

  const updatedExam = await prisma.exam.update({
    where: { id },
    data: {
      type,
      date: date ? new Date(date) : undefined,
      startTime,
      endTime,
      room,
    },
  });

  res.json({ success: true, data: updatedExam });
});

exports.deleteExam = catchAsync(async (req, res, next) => {
  const id = parseInt(req.params.id);
  const exam = await prisma.exam.findUnique({
    where: { id },
    include: { course: { include: { department: true } } }
  });

  if (!exam) {
    return next(new NotFoundError('Exam not found'));
  }

  // Enforce scope via helper
  const examCourseScope = getScopeWhere(req.user, 'course');
  if (examCourseScope && Object.keys(examCourseScope).length) {
    if (examCourseScope.department && exam.course?.department?.collegeId !== examCourseScope.department.collegeId) return next(new AuthorizationError('Access denied'));
    if (examCourseScope.departmentId && exam.course?.departmentId !== examCourseScope.departmentId) return next(new AuthorizationError('Access denied'));
  }

  await prisma.exam.delete({
    where: { id },
  });
  auditLog('DELETE_EXAM', 'Exam', req.params.id, req);
  res.json({ success: true, message: 'Exam deleted' });
});

exports.getExamById = catchAsync(async (req, res, next) => {
  const id = parseInt(req.params.id);
  const exam = await prisma.exam.findUnique({
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
  const courseScope = getScopeWhere(req.user, 'course');
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
