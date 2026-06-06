const prisma = require('../utils/prismaClient');
const catchAsync = require('../utils/catchAsync');
const { NotFoundError } = require('../utils/appError');

/**
 * @desc    Get all courses with advanced filtering, sorting and pagination
 * @route   GET /api/courses
 * @access  Private
 */
exports.getAllCourses = catchAsync(async (req, res, next) => {
  const { 
    search = '', 
    page = 1, 
    limit = 10, 
    sortBy = 'createdAt', 
    sortOrder = 'desc',
    departmentId,
    year,
    semester
  } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const take = parseInt(limit);

  const where = {
    ...(departmentId && { departmentId: parseInt(departmentId) }),
    ...(year && { year: parseInt(year) }),
    ...(semester && { semester: parseInt(semester) }),
    ...(search && {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { courseCode: { contains: search, mode: 'insensitive' } },
      ],
    }),
  };

  const [courses, total] = await Promise.all([
    prisma.course.findMany({
      where,
      include: {
        department: { select: { name: true } },
        doctor: { select: { firstName: true, lastName: true } },
        _count: { select: { students: true } }
      },
      skip,
      take,
      orderBy: { [sortBy]: sortOrder },
    }),
    prisma.course.count({ where })
  ]);

  res.json({
    success: true,
    data: {
      courses,
      pagination: {
        total,
        page: parseInt(page),
        limit: take,
        totalPages: Math.ceil(total / take),
      }
    },
  });
});

/**
 * @desc    Get course by ID with stats
 * @route   GET /api/courses/:id
 * @access  Private
 */
exports.getCourseById = catchAsync(async (req, res, next) => {
  const course = await prisma.course.findUnique({
    where: { id: parseInt(req.params.id) },
    include: {
      department: { include: { college: true } },
      doctor: true,
      students: {
        select: { id: true, firstName: true, lastName: true, studentId: true },
      },
      schedules: true,
      _count: {
        select: {
          students: true,
          quizzes: true,
          tasks: true,
          exams: true
        }
      }
    },
  });

  if (!course) {
    return next(new NotFoundError('Course not found'));
  }

  res.json({
    success: true,
    data: course,
  });
});

/**
 * @desc    Course roster for attendance (enrolled + same dept/year)
 * @route   GET /api/courses/:id/roster
 * @access  Private
 */
exports.getCourseRoster = catchAsync(async (req, res, next) => {
  const courseId = parseInt(req.params.id, 10);
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: {
      id: true,
      departmentId: true,
      year: true,
      students: {
        select: { id: true, firstName: true, lastName: true, studentId: true },
      },
    },
  });

  if (!course) {
    return next(new NotFoundError('Course not found'));
  }

  const rosterMap = new Map();
  course.students.forEach((s) => rosterMap.set(s.id, s));

  if (course.departmentId) {
    const deptStudents = await prisma.student.findMany({
      where: {
        departmentId: course.departmentId,
        year: course.year,
        OR: [{ bio: null }, { bio: { not: 'INACTIVE' } }],
      },
      select: { id: true, firstName: true, lastName: true, studentId: true },
      orderBy: { lastName: 'asc' },
    });
    deptStudents.forEach((s) => rosterMap.set(s.id, s));
  }

  res.json({
    success: true,
    data: Array.from(rosterMap.values()),
  });
});

/**
 * @desc    Create new course
 * @route   POST /api/courses
 * @access  Private (Admin)
 */
exports.createCourse = catchAsync(async (req, res, next) => {
  const courseData = req.body;
  
  const newCourse = await prisma.course.create({
    data: {
      ...courseData,
      credits: parseInt(courseData.credits),
      departmentId: parseInt(courseData.departmentId),
      doctorId: courseData.doctorId ? parseInt(courseData.doctorId) : undefined,
      maxStudents: courseData.maxStudents ? parseInt(courseData.maxStudents) : undefined,
      year: courseData.year ? parseInt(courseData.year) : undefined,
      semester: courseData.semester ? parseInt(courseData.semester) : undefined,
    },
  });

  res.status(201).json({
    success: true,
    data: newCourse,
  });
});

/**
 * @desc    Update course
 * @route   PUT /api/courses/:id
 * @access  Private (Admin)
 */
exports.updateCourse = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const updateData = req.body;

  const updatedCourse = await prisma.course.update({
    where: { id: parseInt(id) },
    data: {
      ...updateData,
      credits: updateData.credits ? parseInt(updateData.credits) : undefined,
      departmentId: updateData.departmentId ? parseInt(updateData.departmentId) : undefined,
      doctorId: updateData.doctorId ? parseInt(updateData.doctorId) : undefined,
      maxStudents: updateData.maxStudents ? parseInt(updateData.maxStudents) : undefined,
      year: updateData.year ? parseInt(updateData.year) : undefined,
      semester: updateData.semester ? parseInt(updateData.semester) : undefined,
    },
  });

  res.json({
    success: true,
    data: updatedCourse,
  });
});

/**
 * @desc    Delete course
 * @route   DELETE /api/courses/:id
 * @access  Private (Admin)
 */
exports.deleteCourse = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  await prisma.$transaction([
    prisma.schedule.deleteMany({ where: { courseId: parseInt(id) } }),
    prisma.attendance.deleteMany({ where: { courseId: parseInt(id) } }),
    prisma.course.delete({ where: { id: parseInt(id) } }),
  ]);

  res.json({
    success: true,
    message: 'Course deleted successfully',
  });
});
