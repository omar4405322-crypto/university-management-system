// FIXED: Exam fields align with DB (room, no title/location column) - schema sync
const prisma = require('../utils/prismaClient');
const catchAsync = require('../utils/catchAsync');
const { NotFoundError, AuthorizationError } = require('../utils/appError');

exports.getAllExams = catchAsync(async (req, res, next) => {
  const { type, upcoming } = req.query;

  // Enforce scope
  const scopeWhere = {};
  if (req.user.role === 'COLLEGE_ADMIN') {
    scopeWhere.course = { department: { collegeId: req.user.collegeId } };
  } else if (req.user.role === 'DEPARTMENT_ADMIN') {
    scopeWhere.course = { departmentId: req.user.departmentId };
  }

  let where = { ...scopeWhere };
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
  // Enforce scope
  const scopeWhere = {};
  if (req.user.role === 'COLLEGE_ADMIN') {
    scopeWhere.course = { department: { collegeId: req.user.collegeId } };
  } else if (req.user.role === 'DEPARTMENT_ADMIN') {
    scopeWhere.course = { departmentId: req.user.departmentId };
  }

  const exams = await prisma.exam.findMany({
    where: {
      ...scopeWhere,
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

  if (req.user.role === 'COLLEGE_ADMIN' && course.department?.collegeId !== req.user.collegeId) {
    return next(new AuthorizationError('Access denied'));
  }
  if (req.user.role === 'DEPARTMENT_ADMIN' && course.departmentId !== req.user.departmentId) {
    return next(new AuthorizationError('Access denied'));
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

  // Enforce scope
  if (req.user.role === 'COLLEGE_ADMIN' && exam.course?.department?.collegeId !== req.user.collegeId) {
    return next(new AuthorizationError('Access denied'));
  }
  if (req.user.role === 'DEPARTMENT_ADMIN' && exam.course?.departmentId !== req.user.departmentId) {
    return next(new AuthorizationError('Access denied'));
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

  // Enforce scope
  if (req.user.role === 'COLLEGE_ADMIN' && exam.course?.department?.collegeId !== req.user.collegeId) {
    return next(new AuthorizationError('Access denied'));
  }
  if (req.user.role === 'DEPARTMENT_ADMIN' && exam.course?.departmentId !== req.user.departmentId) {
    return next(new AuthorizationError('Access denied'));
  }

  await prisma.exam.delete({
    where: { id },
  });
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

  res.json({ success: true, data: exam });
});
