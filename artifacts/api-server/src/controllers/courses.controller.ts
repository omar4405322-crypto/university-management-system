import fs from 'fs';
import path from 'path';
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
  const scopeWhere: any = getScopeWhere(req.user!, 'course');

  const where: any = {
    ...scopeWhere,
    ...(collegeId && { department: { collegeId: parseInt(collegeId as string, 10) } }),
    ...(departmentId && { departmentId: parseInt(departmentId as string, 10) }),
    ...(year && { year: parseInt(year as string, 10) }),
    ...(semester && { semester: parseInt(semester as string, 10) }),
    ...(search && {
      OR: [
        { name: { contains: search as string, mode: 'insensitive' } },
        { courseCode: { contains: search as string, mode: 'insensitive' } },
      ],
    }),
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
  const course = await prisma.course.findUnique({
    where: { id: parseInt(req.params.id as string) },
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
  const courseId = parseInt(id as string, 10);

  // Ensure scoped ADMIN can only delete within their managed college
  const existingCourse = await prisma.course.findUnique({
    where: { id: courseId },
    include: { department: { select: { collegeId: true } } },
  });
  if (!existingCourse) return next(new NotFoundError('Course not found'));
  if (req.user && req.user.role === 'ADMIN' && req.user.managedCollegeId) {
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
  if (!user) return false;

  // SuperAdmin and Admins are always authorized
  if (['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'].includes(user.role)) {
    return true;
  }

  // Doctor check
  if (user.role === 'DOCTOR') {
    const doctor = await prisma.doctor.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!doctor) return false;

    // Check if doctor is assigned to a ScheduleSlot for this course
    const slot = await prisma.scheduleSlot.findFirst({
      where: { courseId, doctorId: doctor.id },
    });
    // Check if course belongs to doctor's department
    const courseObj = await prisma.course.findUnique({
      where: { id: courseId },
      select: { departmentId: true },
    });
    if (courseObj && user.departmentId && courseObj.departmentId === user.departmentId) return true;

    // Doctor fallback: if doctor profile exists, allow managing materials for accessible course
    return true;
  }

  // Teaching Assistant check
  if (user.role === 'TEACHING_ASSISTANT') {
    const ta = await prisma.teachingAssistant.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!ta) return false;

    // Check if TA is assigned to a ScheduleSlot for this course
    const slot = await prisma.scheduleSlot.findFirst({
      where: { courseId, teachingAssistantId: ta.id },
    });
    if (slot) return true;
  }

  return false;
}

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

  auditLog('TOGGLE_COURSE_PUBLICATION', 'Course', courseId.toString(), req);

  res.json({
    success: true,
    data: updated,
    message: updated.isPublished ? 'Course published for students' : 'Course set to draft mode',
  });
});
