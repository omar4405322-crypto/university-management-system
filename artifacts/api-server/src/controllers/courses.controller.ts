import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prismaClient';
import { auditLog } from '../utils/audit.utils';
import catchAsync from '../utils/catchAsync';
import { NotFoundError } from '../utils/appError';
import { getScopeWhere } from '../utils/scope.utils';

/**
 * @desc    Get all courses with advanced filtering, sorting and pagination
 * @route   GET /api/courses
 * @access  Private
 */
export const getAllCourses = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const {
    search = '',
    page = '1',
    limit = '10',
    sortBy = 'createdAt',
    sortOrder = 'desc',
    departmentId,
    year,
    semester,
  } = req.query as Record<string, string>;

  const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
  const take = parseInt(limit as string);

  // Sorting whitelist
  const COURSE_SORT_FIELDS = ['createdAt', 'name', 'courseCode', 'credits', 'year'];
  const safeSortBy = COURSE_SORT_FIELDS.includes(sortBy as string)
    ? (sortBy as string)
    : 'createdAt';
  const safeSortOrder = ['asc', 'desc'].includes(sortOrder as string)
    ? (sortOrder as string)
    : 'desc';

  // Scoping: use centralized helper
  const scopeWhere: any = getScopeWhere(req.user!, 'course');

  const where: any = {
    ...scopeWhere,
    ...(departmentId && { departmentId: parseInt(departmentId as string) }),
    ...(year && { year: parseInt(year as string) }),
    ...(semester && { semester: parseInt(semester as string) }),
    ...(search && {
      OR: [
        { name: { contains: search as string, mode: 'insensitive' } },
        { courseCode: { contains: search as string, mode: 'insensitive' } },
      ],
    }),
  };

  const [courses, total] = await Promise.all([
    prisma.course.findMany({
      where,
      include: {
        department: { select: { name: true } },
        _count: { select: { enrollments: true } },
      },
      skip,
      take,
      orderBy: { [safeSortBy]: safeSortOrder },
    }),
    prisma.course.count({ where }),
  ]);

  res.json({
    success: true,
    data: {
      courses,
      pagination: {
        total,
        page: parseInt(page as string),
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    },
  });
});

/**
 * @desc    Get course by ID with stats
 * @route   GET /api/courses/:id
 * @access  Private
 */
export const getCourseById = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const course = await prisma.course.findUnique({
    where: { id: parseInt(req.params.id as string) },
    include: {
      department: { include: { college: true } },
      enrollments: {
        include: { student: true },
      },
      _count: {
        select: {
          enrollments: true,
          quizzes: true,
          tasks: true,
          exams: true,
        },
      },
    },
  });

  if (!course) {
    return next(new NotFoundError('Course not found'));
  }

  // Scoped ADMIN enforcement
  if (req.user && req.user.role === 'ADMIN' && req.user.managedCollegeId) {
    if (course.department?.collegeId !== req.user.managedCollegeId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
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
export const getCourseRoster = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const courseId = parseInt(req.params.id as string, 10);
    const course = await prisma.course.findUnique({
      where: { id: courseId }
    });

    if (!course) {
      return next(new NotFoundError('Course not found'));
    }

    const rosterMap = new Map();

    // Build roster from enrollments + department/year students
    const courseWithEnrollments = await prisma.course.findUnique({
      where: { id: courseId },
      select: {
        departmentId: true,
        year: true,
        enrollments: {
          where: { status: 'ENROLLED' },
          select: {
            student: {
              select: { id: true, firstName: true, lastName: true, studentId: true, groupId: true,
                group: { select: { id: true, name: true } }
              },
            },
          },
        },
      },
    });

    if (courseWithEnrollments) {
      courseWithEnrollments.enrollments.forEach((e: any) => rosterMap.set(e.student.id, e.student));

      if (courseWithEnrollments.departmentId) {
        const deptStudents = await prisma.student.findMany({
          where: {
            departmentId: courseWithEnrollments.departmentId,
            year: courseWithEnrollments.year,
            isActive: true,
          },
          select: { id: true, firstName: true, lastName: true, studentId: true, groupId: true,
            group: { select: { id: true, name: true } }
          },
        });
        deptStudents.forEach((s: any) => rosterMap.set(s.id, s));
      }
    }

    const sortedData = Array.from(rosterMap.values()).sort((a: any, b: any) => {
      if (!a.lastName) return 1;
      if (!b.lastName) return -1;
      return a.lastName.localeCompare(b.lastName);
    });

    const dateStr = req.query.date as string;
    if (dateStr) {
      const dateObj = new Date(dateStr);
      dateObj.setHours(0, 0, 0, 0);

      const attendances = await prisma.attendance.findMany({
        where: {
          courseId,
          date: dateObj
        }
      });

      const attendanceMap = new Map();
      const remarksMap = new Map();
      attendances.forEach((att: any) => {
        attendanceMap.set(att.studentId, att.status);
        remarksMap.set(att.studentId, att.remarks);
      });

      const rosterWithStatus = sortedData.map((student: any) => ({
        ...student,
        existingStatus: attendanceMap.get(student.id) || null,
        existingRemarks: remarksMap.get(student.id) || ''
      }));

      return res.json({
        success: true,
        data: rosterWithStatus,
      });
    }

    res.json({
      success: true,
      data: sortedData,
    });
  }
);

/**
 * @desc    Create new course
 * @route   POST /api/courses
 * @access  Private (Admin)
 */
export const createCourse = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const courseData = req.body;

  // If scoped ADMIN, ensure department belongs to managedCollegeId or set automatically
  if (req.user && req.user.role === 'ADMIN' && req.user.managedCollegeId) {
    const dept = await prisma.department.findUnique({
      where: { id: parseInt(courseData.departmentId as string) },
    });
    if (!dept || dept.collegeId !== req.user.managedCollegeId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
  }

  const newCourse = await prisma.course.create({
    data: {
      ...courseData,
      credits: parseInt(courseData.credits as string),
      departmentId: parseInt(courseData.departmentId as string),
      maxStudents: courseData.maxStudents ? parseInt(courseData.maxStudents as string) : undefined,
      year: courseData.year ? parseInt(courseData.year as string) : undefined,
      semester: courseData.semester ? parseInt(courseData.semester as string) : undefined,
    },
  });

  return res.status(201).json({
    success: true,
    data: newCourse,
  });
});

/**
 * @desc    Update course
 * @route   PUT /api/courses/:id
 * @access  Private (Admin)
 */
export const updateCourse = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const updateData = req.body;

  // fetch existing and enforce scope for scoped ADMIN
  const existing = await prisma.course.findUnique({
    where: { id: parseInt(id as string) },
    include: { department: true },
  });
  if (!existing) return next(new NotFoundError('Course not found'));
  if (req.user && req.user.role === 'ADMIN' && req.user.managedCollegeId) {
    if (existing.department?.collegeId !== req.user.managedCollegeId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    if (updateData.departmentId) {
      const newDept = await prisma.department.findUnique({
        where: { id: parseInt(updateData.departmentId as string) },
      });
      if (!newDept || newDept.collegeId !== req.user.managedCollegeId) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    }
  }

  const updatedCourse = await prisma.course.update({
    where: { id: parseInt(id as string) },
    data: {
      ...updateData,
      credits:
        updateData.credits !== undefined ? parseInt(updateData.credits as string) : undefined,
      departmentId:
        updateData.departmentId !== undefined
          ? parseInt(updateData.departmentId as string)
          : undefined,
      maxStudents:
        updateData.maxStudents !== undefined
          ? parseInt(updateData.maxStudents as string)
          : undefined,
      year: updateData.year !== undefined ? parseInt(updateData.year as string) : undefined,
      semester:
        updateData.semester !== undefined ? parseInt(updateData.semester as string) : undefined,
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
export const deleteCourse = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;

  // Ensure scoped ADMIN can only delete within their managed college
  const existingCourse = await prisma.course.findUnique({
    where: { id: parseInt(id as string) },
    include: { department: { select: { collegeId: true } } },
  });
  if (!existingCourse) return next(new NotFoundError('Course not found'));
  if (req.user && req.user.role === 'ADMIN' && req.user.managedCollegeId) {
    if (existingCourse.department?.collegeId !== req.user.managedCollegeId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
  }

  await prisma.$transaction([
    prisma.attendance.deleteMany({ where: { courseId: parseInt(id as string) } }),
    prisma.course.delete({ where: { id: parseInt(id as string) } }),
  ]);

  auditLog('DELETE_COURSE', 'Course', req.params.id as string, req);
  res.json({
    success: true,
    message: 'Course deleted successfully',
  });
});
