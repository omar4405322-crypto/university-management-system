import fs from 'fs';
import path from 'path';
import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prismaClient';
import { auditLog } from '../utils/audit.utils';
import catchAsync from '../utils/catchAsync';
import { AuthorizationError, NotFoundError } from '../utils/appError';
import { getScopeWhere } from '../utils/scope.utils';
import {
  canManageUnassignedAdminResource,
  getAdminMutationTargetWhere,
} from '../utils/adminMutationScope.utils';
import { EnrollmentService } from '../services/enrollment.service';
import { invalidateCache } from '../utils/redis.utils';

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
    collegeId,
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
  const scopeWhere = getScopeWhere(req.user!, 'course');

  const queryFilters: any[] = [];
  if (req.user?.role === 'STUDENT') {
    queryFilters.push({ isPublished: true });
  }
  if (collegeId) {
    queryFilters.push({ department: { collegeId: parseInt(collegeId as string, 10) } });
  }
  if (departmentId) {
    queryFilters.push({ departmentId: parseInt(departmentId as string, 10) });
  }
  if (year) {
    queryFilters.push({ year: parseInt(year as string, 10) });
  }
  if (semester) {
    queryFilters.push({ semester: parseInt(semester as string, 10) });
  }
  if (search) {
    queryFilters.push({
      OR: [
        { name: { contains: search as string, mode: 'insensitive' } },
        { courseCode: { contains: search as string, mode: 'insensitive' } },
      ],
    });
  }

  const where = {
    AND: [
      scopeWhere,
      ...queryFilters,
    ],
  };

  const [coursesList, total] = await Promise.all([
    prisma.course.findMany({
      where,
      include: {
        department: {
          select: {
            id: true,
            name: true,
            nameAr: true,
            college: { select: { id: true, name: true, nameAr: true } },
          },
        },
        scheduleSlots: {
          include: {
            doctor: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        _count: { select: { enrollments: true } },
      },
      skip,
      take,
      orderBy: { [safeSortBy]: safeSortOrder },
    }),
    prisma.course.count({ where }),
  ]);

  const courses = coursesList.map((c: any) => ({
    ...c,
    sections: c.scheduleSlots || [],
    _count: {
      ...c._count,
      students: c._count?.enrollments || 0,
      enrollments: c._count?.enrollments || 0,
    },
  }));

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
  const courseId = parseInt(req.params.id as string, 10);
  const scopeWhere = getScopeWhere(req.user, 'course');
  const includeEnrollmentRoster = req.user?.role !== 'STUDENT';
  const course = await prisma.course.findFirst({
    where: {
      AND: [
        { id: courseId },
        scopeWhere,
      ],
    },
    include: {
      department: { include: { college: true } },
      scheduleSlots: {
        include: {
          doctor: {
            include: {
              user: {
                select: { id: true, email: true, profilePicture: true },
              },
            },
          },
          teachingAssistant: {
            include: {
              user: {
                select: { id: true, email: true, profilePicture: true },
              },
            },
          },
        },
      },
      tasks: {
        orderBy: { dueDate: 'asc' },
      },
      materials: {
        where: req.user?.role === 'STUDENT' ? { isPublished: true } : undefined,
        include: {
          uploadedBy: {
            select: {
              id: true,
              email: true,
              role: true,
              profilePicture: true,
              doctor: { select: { firstName: true, lastName: true } },
              teachingAssistant: { select: { firstName: true, lastName: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
      ...(includeEnrollmentRoster
        ? {
            enrollments: {
              include: {
                student: {
                  include: {
                    user: {
                      select: { id: true, email: true, profilePicture: true },
                    },
                  },
                },
              },
            },
          }
        : {}),
      _count: {
        select: {
          enrollments: true,
          quizzes: true,
          tasks: true,
          exams: true,
          materials: true,
        },
      },
    },
  });

  if (!course) {
    return next(new NotFoundError('Course not found'));
  }

  // If requester is a student and course is draft (not published), deny access
  if (req.user && req.user.role === 'STUDENT' && !course.isPublished) {
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
export const getCourseRoster = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const courseId = parseInt(req.params.id as string, 10);
    if (!(await canUserManageCourseMaterials(req.user, courseId))) {
      return next(new AuthorizationError('Access denied: Course roster is restricted to assigned staff'));
    }

    const course = await prisma.course.findUnique({ where: { id: courseId } });

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
              select: {
                id: true, firstName: true, lastName: true, studentId: true, groupId: true,
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
          select: {
            id: true, firstName: true, lastName: true, studentId: true, groupId: true,
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
  const {
    name,
    courseCode,
    credits,
    departmentId,
    year,
    semester,
    description,
    maxStudents,
  } = req.body;

  const parsedDeptId =
    departmentId !== undefined && departmentId !== '' && departmentId !== null
      ? parseInt(departmentId as string, 10)
      : undefined;
  const parsedCredits =
    credits !== undefined && credits !== '' ? parseInt(credits as string, 10) : 3;

  if (!Number.isInteger(parsedDeptId) || (parsedDeptId as number) <= 0) {
    return next(new AuthorizationError('Access denied: A managed department is required'));
  }
  const destinationDepartment = await prisma.department.findFirst({
    where: getAdminMutationTargetWhere(req.user, 'department', parsedDeptId as number),
    select: { id: true },
  });
  if (!destinationDepartment) {
    return next(new AuthorizationError('Access denied: Department is outside your managed scope'));
  }

  const courseCreateData: {
    name: string;
    courseCode: string;
    credits: number;
    departmentId?: number;
    year?: number;
    semester?: number;
    description?: string | null;
    maxStudents?: number;
  } = {
    name: name ? String(name).trim() : '',
    courseCode: courseCode ? String(courseCode).trim() : '',
    credits: parsedCredits,
    ...(parsedDeptId !== undefined ? { departmentId: parsedDeptId } : {}),
    ...(year !== undefined && year !== '' ? { year: parseInt(year as string, 10) } : {}),
    ...(semester !== undefined && semester !== '' ? { semester: parseInt(semester as string, 10) } : {}),
    ...(description !== undefined ? { description: description ? String(description).trim() : null } : {}),
    ...(maxStudents !== undefined && maxStudents !== '' ? { maxStudents: parseInt(maxStudents as string, 10) } : {}),
  };

  const newCourse = await prisma.course.create({
    data: courseCreateData,
  });

  try {
    await EnrollmentService.autoEnrollCourse(newCourse.id);
  } catch (enrollErr) {
    console.warn('Could not auto-enroll students for new course:', enrollErr);
  }

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
  const {
    name,
    courseCode,
    credits,
    departmentId,
    year,
    semester,
    description,
    maxStudents,
  } = req.body;

  const existing = await prisma.course.findFirst({
    where: getAdminMutationTargetWhere(req.user, 'course', parseInt(id as string, 10)),
    include: { department: true },
  });
  if (!existing) return next(new NotFoundError('Course not found'));

  const parsedDeptId =
    departmentId !== undefined && departmentId !== '' && departmentId !== null
      ? parseInt(departmentId as string, 10)
      : undefined;

  if (departmentId !== undefined) {
    if (parsedDeptId === undefined || !Number.isInteger(parsedDeptId) || parsedDeptId <= 0) {
      if (!canManageUnassignedAdminResource(req.user)) {
        return next(new AuthorizationError('Access denied: Scoped admins cannot detach courses'));
      }
    } else {
      const destinationDepartment = await prisma.department.findFirst({
        where: getAdminMutationTargetWhere(req.user, 'department', parsedDeptId),
        select: { id: true },
      });
      if (!destinationDepartment) {
        return next(
          new AuthorizationError('Access denied: Destination department is outside your managed scope')
        );
      }
    }
  }

  const courseUpdateData: {
    name?: string;
    courseCode?: string;
    credits?: number;
    departmentId?: number | null;
    year?: number;
    semester?: number;
    description?: string | null;
    maxStudents?: number;
  } = {};

  if (name !== undefined) courseUpdateData.name = String(name).trim();
  if (courseCode !== undefined) courseUpdateData.courseCode = String(courseCode).trim();
  if (credits !== undefined && credits !== '') courseUpdateData.credits = parseInt(credits as string, 10);
  if (departmentId !== undefined) {
    courseUpdateData.departmentId =
      departmentId !== '' && departmentId !== null ? parseInt(departmentId as string, 10) : null;
  }
  if (year !== undefined && year !== '') courseUpdateData.year = parseInt(year as string, 10);
  if (semester !== undefined && semester !== '') courseUpdateData.semester = parseInt(semester as string, 10);
  if (description !== undefined) courseUpdateData.description = description ? String(description).trim() : null;
  if (maxStudents !== undefined && maxStudents !== '')
    courseUpdateData.maxStudents = parseInt(maxStudents as string, 10);

  const updatedCourse = await prisma.course.update({
    where: { id: parseInt(id as string, 10) },
    data: courseUpdateData,
  });

  if (year !== undefined || departmentId !== undefined) {
    try {
      await EnrollmentService.autoEnrollCourse(updatedCourse.id);
    } catch (enrollErr) {
      console.warn('Could not auto-enroll students on course update:', enrollErr);
    }
  }

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
  const courseId = parseInt(id as string, 10);

  // Ensure scoped ADMIN can only delete within their managed college
  const existingCourse = await prisma.course.findUnique({
    where: { id: courseId },
    include: { department: { select: { collegeId: true } } },
  });
  if (!existingCourse) return next(new NotFoundError('Course not found'));

  // Fail closed for unscoped ADMIN role
  if (req.user && req.user.role === 'ADMIN') {
    if (!req.user.managedCollegeId) {
      return res.status(403).json({ success: false, message: 'Access denied: Unscoped admin cannot delete courses' });
    }
    if (existingCourse.department?.collegeId !== req.user.managedCollegeId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
  }

  await prisma.$transaction(async (tx) => {
    // 1. Delete Attendance records linked directly or via schedule slots
    const slots = await tx.scheduleSlot.findMany({
      where: { courseId },
      select: { id: true },
    });
    const slotIds = slots.map((s) => s.id);

    await tx.attendance.deleteMany({
      where: {
        OR: [
          { courseId },
          ...(slotIds.length > 0 ? [{ scheduleSlotId: { in: slotIds } }] : []),
        ],
      },
    });

    // 2. Delete Quizzes and submissions
    const quizzes = await tx.quiz.findMany({
      where: { courseId },
      select: { id: true },
    });
    if (quizzes.length > 0) {
      const quizIds = quizzes.map((q) => q.id);
      await tx.quizSubmission.deleteMany({ where: { quizId: { in: quizIds } } });
      await tx.question.deleteMany({ where: { quizId: { in: quizIds } } });
      await tx.quiz.deleteMany({ where: { courseId } });
    }

    // 3. Delete Tasks and submissions
    const tasks = await tx.task.findMany({
      where: { courseId },
      select: { id: true },
    });
    if (tasks.length > 0) {
      const taskIds = tasks.map((t) => t.id);
      await tx.taskSubmission.deleteMany({ where: { taskId: { in: taskIds } } });
      await tx.task.deleteMany({ where: { courseId } });
    }

    // 4. Delete Exams and submissions
    const exams = await tx.exam.findMany({
      where: { courseId },
      select: { id: true },
    });
    if (exams.length > 0) {
      const examIds = exams.map((e) => e.id);
      await tx.examViolation.deleteMany({
        where: { submission: { examId: { in: examIds } } },
      });
      await tx.examSubmission.deleteMany({ where: { examId: { in: examIds } } });
      await tx.examQuestion.deleteMany({ where: { examId: { in: examIds } } });
      await tx.exam.deleteMany({ where: { courseId } });
    }

    // 5. Delete Course Materials
    await tx.courseMaterial.deleteMany({ where: { courseId } });

    // 6. Delete Schedule Change Requests
    await tx.scheduleChangeRequest.deleteMany({ where: { courseId } });

    // 7. Delete Absence Threshold Policies
    await tx.absenceThresholdPolicy.deleteMany({ where: { courseId } });

    // 8. Delete Enrollments & Exemption Periods
    const enrollments = await tx.enrollment.findMany({
      where: { courseId },
      select: { id: true },
    });
    if (enrollments.length > 0) {
      const enrollmentIds = enrollments.map((en) => en.id);
      await tx.absenceExemptionPeriod.deleteMany({
        where: { enrollmentId: { in: enrollmentIds } },
      });
      await tx.enrollment.deleteMany({ where: { courseId } });
    }

    // 9. Delete Schedule Slots and their overrides/sessions
    if (slotIds.length > 0) {
      await tx.scheduleOverride.deleteMany({
        where: { scheduleSlotId: { in: slotIds } },
      });
      await tx.attendanceSession.deleteMany({
        where: { scheduleSlotId: { in: slotIds } },
      });
      await tx.scheduleSlot.deleteMany({ where: { courseId } });
    }

    // 10. Delete the Course itself
    await tx.course.delete({ where: { id: courseId } });
  });

  auditLog('DELETE_COURSE', 'Course', req.params.id as string, req);
  res.json({
    success: true,
    message: 'Course deleted successfully',
  });
});

/**
 * Helper to check if a user is allowed to upload/manage course materials for a specific course
 */
export async function canUserManageCourseMaterials(user: any, courseId: number): Promise<boolean> {
  if (!user || !Number.isInteger(courseId) || courseId <= 0) return false;

  if (user.role === 'SUPER_ADMIN') return true;

  if (['ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'].includes(user.role)) {
    const scopedCourse = await prisma.course.findFirst({
      where: getAdminMutationTargetWhere(user, 'course', courseId),
      select: { id: true },
    });
    return Boolean(scopedCourse);
  }

  if (user.role === 'DOCTOR') {
    if (!user.doctor?.id) return false;
    const slot = await prisma.scheduleSlot.findFirst({
      where: { courseId, doctorId: user.doctor.id },
      select: { id: true },
    });
    return Boolean(slot);
  }

  if (user.role === 'TEACHING_ASSISTANT') {
    if (!user.teachingAssistant?.id) return false;
    const slot = await prisma.scheduleSlot.findFirst({
      where: { courseId, teachingAssistantId: user.teachingAssistant.id },
      select: { id: true },
    });
    return Boolean(slot);
  }

  return false;
}

export const requireCourseMaterialManager = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const courseId = parseInt(req.params.id as string, 10);
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true },
    });
    if (!course) return next(new NotFoundError('Course not found'));

    if (!(await canUserManageCourseMaterials(req.user, courseId))) {
      return next(new AuthorizationError('Access denied'));
    }

    next();
  }
);

/**
 * @desc    Upload course material (lecture or tutorial)
 * @route   POST /api/courses/:id/materials
 * @access  Private (Assigned Doctor, TA, or Admin)
 */
export const uploadCourseMaterial = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const courseId = parseInt(req.params.id as string, 10);
  const course = await prisma.course.findUnique({ where: { id: courseId } });

  if (!course) {
    return next(new NotFoundError('Course not found'));
  }

  const isAuthorized = await canUserManageCourseMaterials(req.user, courseId);
  if (!isAuthorized) {
    return res.status(403).json({
      success: false,
      message: 'Only the professor or teaching assistant in charge of this course can upload materials.',
    });
  }

  let { title, description, type, fileUrl } = req.body;
  let fileName: string | undefined = undefined;
  let fileSize: number | undefined = undefined;
  let fileType: string | undefined = undefined;

  if (req.file) {
    fileUrl = `/uploads/materials/${req.file.filename}`;
    fileName = req.file.originalname;
    fileSize = req.file.size;
    fileType = req.file.mimetype;
  }

  if (!title || !title.trim()) {
    return res.status(400).json({ success: false, message: 'Material title is required' });
  }

  if (!fileUrl) {
    return res.status(400).json({ success: false, message: 'File or link URL is required' });
  }

  const materialType = type === 'TUTORIAL' ? 'TUTORIAL' : 'LECTURE';

  const material = await prisma.courseMaterial.create({
    data: {
      title: title.trim(),
      description: description ? description.trim() : null,
      type: materialType,
      fileUrl,
      fileName,
      fileSize,
      fileType,
      courseId,
      uploadedById: req.user.id,
    },
    include: {
      uploadedBy: {
        select: {
          id: true,
          email: true,
          role: true,
          profilePicture: true,
          doctor: { select: { firstName: true, lastName: true } },
          teachingAssistant: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });

  auditLog('UPLOAD_COURSE_MATERIAL', 'CourseMaterial', material.id.toString(), req);

  res.status(201).json({
    success: true,
    data: material,
    message: 'Material uploaded successfully',
  });
});

/**
 * @desc    Delete course material
 * @route   DELETE /api/courses/:id/materials/:materialId
 * @access  Private (Uploader, Assigned Staff, or Admin)
 */
export const deleteCourseMaterial = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const courseId = parseInt(req.params.id as string, 10);
  const materialId = parseInt(req.params.materialId as string, 10);

  const material = await prisma.courseMaterial.findUnique({
    where: { id: materialId },
  });

  if (!material || material.courseId !== courseId) {
    return next(new NotFoundError('Course material not found'));
  }

  const isAuthorized =
    material.uploadedById === req.user.id || (await canUserManageCourseMaterials(req.user, courseId));

  if (!isAuthorized) {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  if (material.fileUrl && material.fileUrl.startsWith('/uploads/materials/')) {
    const filename = path.basename(material.fileUrl);
    const filePath = path.join(process.cwd(), 'uploads/materials', filename);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        console.error('Failed to delete file from disk:', err);
      }
    }
  }

  await prisma.courseMaterial.delete({ where: { id: materialId } });

  auditLog('DELETE_COURSE_MATERIAL', 'CourseMaterial', materialId.toString(), req);

  res.json({
    success: true,
    message: 'Course material deleted successfully',
  });
});

/**
 * @desc    Toggle publication status of course material (Published vs Draft)
 * @route   PATCH /api/courses/:id/materials/:materialId/toggle
 * @access  Private (Uploader, Doctor, TA, or Admin)
 */
export const toggleMaterialPublication = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const courseId = parseInt(req.params.id as string, 10);
  const materialId = parseInt(req.params.materialId as string, 10);

  const material = await prisma.courseMaterial.findUnique({ where: { id: materialId } });
  if (!material || material.courseId !== courseId) {
    return next(new NotFoundError('Course material not found'));
  }

  const isAuthorized = await canUserManageCourseMaterials(req.user, courseId);
  if (!isAuthorized) {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  const updated = await prisma.courseMaterial.update({
    where: { id: materialId },
    data: { isPublished: !material.isPublished },
  });

  await invalidateCache('dashboard:*');
  auditLog('TOGGLE_COURSE_MATERIAL', 'CourseMaterial', materialId.toString(), req);

  res.json({
    success: true,
    data: updated,
    message: updated.isPublished ? 'Material published for students' : 'Material set to draft mode',
  });
});

/**
 * @desc    Toggle publication status of an entire course (Published vs Draft)
 * @route   PATCH /api/courses/:id/toggle-publication
 * @access  Private (Assigned Doctor, TA, or Admin)
 */
export const toggleCoursePublication = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const courseId = parseInt(req.params.id as string, 10);
  const course = await prisma.course.findUnique({ where: { id: courseId } });

  if (!course) {
    return next(new NotFoundError('Course not found'));
  }

  const isAuthorized = await canUserManageCourseMaterials(req.user, courseId);
  if (!isAuthorized) {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  const updated = await prisma.course.update({
    where: { id: courseId },
    data: { isPublished: !course.isPublished },
  });

  await invalidateCache('dashboard:*');
  auditLog('TOGGLE_COURSE_PUBLICATION', 'Course', courseId.toString(), req);

  res.json({
    success: true,
    data: updated,
    message: updated.isPublished ? 'Course published for students' : 'Course set to draft mode',
  });
});
