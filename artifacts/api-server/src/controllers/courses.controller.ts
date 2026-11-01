import fs from 'fs';
import path from 'path';
import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../utils/prismaClient';
import { auditLog } from '../utils/audit.utils';
import catchAsync from '../utils/catchAsync';
import { AppError, AuthorizationError, ConflictError, NotFoundError, ValidationError } from '../utils/appError';
import type { AuthActor } from '../types/auth.types';
import { getScopeWhere, getEffectiveActiveStudentWhere } from '../utils/scope.utils';
import {
  canManageUnassignedAdminResource,
  getAdminMutationTargetWhere,
} from '../utils/adminMutationScope.utils';
import { EnrollmentService } from '../services/enrollment.service';
import { invalidateCache } from '../utils/redis.utils';
import { normalizeSlotType } from '../utils/slotType.utils';
import * as gradeStructureService from '../services/gradeStructure.service';
import * as gradebookService from '../services/gradebook.service';
import * as gradebookPublishService from '../services/gradebookPublish.service';
import * as gradebookCorrectionService from '../services/gradebookCorrection.service';
import {
  validateSaveGradebookDraftInput,
  validatePublishGradebookInput,
  validateCorrectGradebookInput,
} from '../validations/gradebook.validation';

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

  const queryFilters: Prisma.CourseWhereInput[] = [];
  if (req.user?.role === 'STUDENT') {
    queryFilters.push({ isPublished: true });
  }
  if (collegeId !== undefined && collegeId !== '') {
    const parsedCollegeId = Number(collegeId);
    if (!Number.isSafeInteger(parsedCollegeId) || parsedCollegeId <= 0) {
      return next(new ValidationError('Invalid collegeId'));
    }
    queryFilters.push({ department: { collegeId: parsedCollegeId } });
  }
  if (departmentId !== undefined && departmentId !== '') {
    const parsedDepartmentId = Number(departmentId);
    if (!Number.isSafeInteger(parsedDepartmentId) || parsedDepartmentId <= 0) {
      return next(new ValidationError('Invalid departmentId'));
    }
    queryFilters.push({ departmentId: parsedDepartmentId });
  }
  if (year !== undefined && year !== '') {
    const parsedYear = Number(year);
    if (!Number.isSafeInteger(parsedYear) || parsedYear <= 0) {
      return next(new ValidationError('Invalid year'));
    }
    queryFilters.push({ year: parsedYear });
  }
  if (semester !== undefined && semester !== '') {
    const parsedSemester = Number(semester);
    if (!Number.isSafeInteger(parsedSemester) || parsedSemester <= 0) {
      return next(new ValidationError('Invalid semester'));
    }
    queryFilters.push({ semester: parsedSemester });
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

  const courses = coursesList.map((c) => {
    const normalizedSlots = (c.scheduleSlots || []).map((slot: any) => ({
      ...slot,
      slotType: normalizeSlotType(slot.slotType),
    }));
    return {
      ...c,
      scheduleSlots: normalizedSlots,
      sections: normalizedSlots,
      _count: {
        ...c._count,
        students: c._count?.enrollments || 0,
        enrollments: c._count?.enrollments || 0,
      },
    };
  });

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
        where: { isDeleted: false },
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
              where: {
                status: 'ENROLLED',
                student: {
                  is: getEffectiveActiveStudentWhere(),
                },
              },
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

  // Threat T-A: Teaching assistant read scope: TA must be assigned to the course
  if (req.user && req.user.role === 'TEACHING_ASSISTANT') {
    const canManage = await canUserManageCourseMaterials(req.user, courseId);
    if (!canManage) {
      return next(new NotFoundError('Course not found'));
    }
  }

  // Threat T-E: Student access to materials/tasks: WITHDRAWN and BLOCKED students denied access
  if (req.user && req.user.role === 'STUDENT' && req.user.student?.id) {
    const studentEnrollment = await prisma.enrollment.findFirst({
      where: {
        courseId,
        studentId: req.user.student.id,
      },
      select: { status: true },
    });
    if (studentEnrollment && studentEnrollment.status !== 'ENROLLED') {
      return next(new NotFoundError('Course not found'));
    }
  }

  const normalizedSlots = (course.scheduleSlots || []).map((slot: any) => ({
    ...slot,
    slotType: normalizeSlotType(slot.slotType),
  }));

  res.json({
    success: true,
    data: {
      ...course,
      scheduleSlots: normalizedSlots,
      sections: normalizedSlots,
    },
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

    interface RosterStudent {
      id: number;
      firstName: string;
      lastName: string;
      studentId: string;
      groupId: number | null;
      group: { id: number; name: string } | null;
    }

    const rosterMap = new Map<number, RosterStudent>();

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
      courseWithEnrollments.enrollments.forEach((e) => {
        if (e.student) {
          rosterMap.set(e.student.id, e.student);
        }
      });

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
        deptStudents.forEach((s) => rosterMap.set(s.id, s));
      }
    }

    const sortedData = Array.from(rosterMap.values()).sort((a, b) => {
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

      const attendanceMap = new Map<number, string>();
      const remarksMap = new Map<number, string | null>();
      attendances.forEach((att) => {
        attendanceMap.set(att.studentId, att.status);
        remarksMap.set(att.studentId, att.remarks);
      });

      const rosterWithStatus = sortedData.map((student) => ({
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

  await auditLog('COURSE_CREATED', 'Course', String(newCourse.id), req, {
    name: newCourse.name,
    courseCode: newCourse.courseCode,
    departmentId: newCourse.departmentId,
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

  await auditLog('COURSE_UPDATED', 'Course', String(updatedCourse.id), req, courseUpdateData);

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
    const hasEnrollments = await tx.enrollment.findFirst({
      where: { courseId },
      select: { id: true },
    });
    if (hasEnrollments) {
      throw new ConflictError('Cannot delete course with enrollment history. Unenroll students or archive course instead.');
    }

    const hasQuizSubmissions = await tx.quizSubmission.findFirst({
      where: { quiz: { courseId } },
      select: { id: true },
    });
    const hasTaskSubmissions = await tx.taskSubmission.findFirst({
      where: { task: { courseId } },
      select: { id: true },
    });
    const hasExamSubmissions = await tx.examSubmission.findFirst({
      where: { exam: { courseId } },
      select: { id: true },
    });
    if (hasQuizSubmissions || hasTaskSubmissions || hasExamSubmissions) {
      throw new ConflictError('Cannot delete course with existing student quiz, task, or exam submissions. Student academic history must be preserved.');
    }

    const hasGradeStructures = await tx.courseGradeStructure.findFirst({
      where: { courseId },
      select: { id: true },
    });
    if (hasGradeStructures) {
      throw new ConflictError('Cannot delete course with grade structures. Grade records must be preserved.');
    }

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

  await auditLog('COURSE_DELETED', 'Course', String(courseId), req, {
    name: existingCourse.name,
    courseCode: existingCourse.courseCode,
  });
  res.json({
    success: true,
    message: 'Course deleted successfully',
  });
});

/**
 * Helper to check if a user is allowed to upload/manage course materials for a specific course
 */
export async function canUserManageCourseMaterials(user: AuthActor | undefined | null, courseId: number): Promise<boolean> {
  if (!user || !Number.isInteger(courseId) || courseId <= 0) return false;

  if (user.role === 'SUPER_ADMIN') return true;

  if (['ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'].includes(user.role)) {
    const scopedCourse = await prisma.course.findFirst({
      where: getAdminMutationTargetWhere(user, 'course', courseId),
      select: { id: true },
    });
    return Boolean(scopedCourse);
  }

  const slotTermFilter = {
    isArchived: false,
    OR: [
      { termId: null },
      { term: { isCurrent: true } },
    ],
  };

  if (user.role === 'DOCTOR') {
    if (!user.doctor?.id) return false;
    const slot = await prisma.scheduleSlot.findFirst({
      where: {
        courseId,
        doctorId: user.doctor.id,
        ...slotTermFilter,
      },
      select: { id: true },
    });
    return Boolean(slot);
  }

  if (user.role === 'TEACHING_ASSISTANT') {
    if (!user.teachingAssistant?.id) return false;
    const slot = await prisma.scheduleSlot.findFirst({
      where: {
        courseId,
        teachingAssistantId: user.teachingAssistant.id as any,
        ...slotTermFilter,
      },
      select: { id: true },
    });
    if (!slot) return false;

    // Check department ownership vs cross-department approval
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { departmentId: true },
    });

    if (!course) return false; const taRec = await prisma.teachingAssistant.findUnique({ where: { id: String(user.teachingAssistant.id) }, select: { departmentId: true, userId: true } }); const uId = taRec?.userId ?? (typeof user.id === 'number' ? user.id : undefined); const userRec = (taRec?.departmentId == null && uId) ? await prisma.user.findUnique({ where: { id: uId }, select: { departmentId: true } }) : null; const taHomeDeptId = taRec?.departmentId ?? userRec?.departmentId ?? null;
    if (taHomeDeptId == null || course.departmentId == null || taHomeDeptId !== course.departmentId) {
      const approval = await (prisma as any).tACrossDepartmentApproval?.findUnique({
        where: {
          teachingAssistantId_courseId: {
            teachingAssistantId: String(user.teachingAssistant.id),
            courseId,
          },
        },
        select: { status: true },
      });
      return approval?.status === 'APPROVED';
    }

    return true;
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

  if (!req.user) {
    return next(new AuthorizationError('Authentication required'));
  }

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

  // Threat T-C: TA can only upload TUTORIAL materials
  if (req.user.role === 'TEACHING_ASSISTANT') {
    if (type === 'LECTURE') {
      return res.status(403).json({
        success: false,
        message: 'Teaching assistants can only upload tutorial materials.',
      });
    }
  }

  // Threat T-B: Derive fileUrl on upload; accept body fileUrl ONLY as an HTTPS link
  if (req.file) {
    fileUrl = `/uploads/materials/${req.file.filename}`;
    fileName = req.file.originalname;
    fileSize = req.file.size;
    fileType = req.file.mimetype;
  } else {
    if (!fileUrl || typeof fileUrl !== 'string' || !fileUrl.trim()) {
      return res.status(400).json({ success: false, message: 'File or link URL is required' });
    }
    const trimmedUrl = fileUrl.trim();
    if (trimmedUrl.length > 2048) {
      return res.status(400).json({ success: false, message: 'Material link URL is too long' });
    }
    const CONTROL_CHAR_PATTERN = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/;
    const DANGEROUS_URI_PATTERN = /^(?:javascript|data|vbscript|file):/i;
    if (CONTROL_CHAR_PATTERN.test(trimmedUrl) || DANGEROUS_URI_PATTERN.test(trimmedUrl)) {
      return res.status(400).json({ success: false, message: 'Material link URL contains forbidden or dangerous patterns' });
    }
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(trimmedUrl);
    } catch {
      return res.status(400).json({ success: false, message: 'Material link must be a valid URL' });
    }
    if (parsedUrl.protocol !== 'https:') {
      return res.status(400).json({ success: false, message: 'Material link must use HTTPS' });
    }
    fileUrl = trimmedUrl;
    fileName = undefined;
    fileSize = undefined;
    fileType = 'link';
  }

  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ success: false, message: 'Material title is required' });
  }
  const CONTROL_CHAR_PATTERN = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/;
  const TAG_LIKE_PATTERN = /<[A-Za-z/!?]/;
  if (CONTROL_CHAR_PATTERN.test(title) || TAG_LIKE_PATTERN.test(title)) {
    return res.status(400).json({ success: false, message: 'Material title contains forbidden characters or markup' });
  }
  if (description && typeof description === 'string') {
    if (CONTROL_CHAR_PATTERN.test(description) || TAG_LIKE_PATTERN.test(description)) {
      return res.status(400).json({ success: false, message: 'Material description contains forbidden characters or markup' });
    }
  }

  const materialType = req.user.role === 'TEACHING_ASSISTANT'
    ? 'TUTORIAL'
    : (type === 'TUTORIAL' ? 'TUTORIAL' : 'LECTURE');

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

  if (!Number.isSafeInteger(courseId) || courseId <= 0) {
    return next(new ValidationError('Invalid course ID'));
  }
  if (!Number.isSafeInteger(materialId) || materialId <= 0) {
    return next(new ValidationError('Invalid material ID'));
  }

  if (!req.user) {
    return next(new AuthorizationError('Authentication required'));
  }

  const material = await prisma.courseMaterial.findUnique({
    where: { id: materialId },
  });

  if (!material || material.courseId !== courseId) {
    return next(new NotFoundError('Course material not found'));
  }

  // Threat T-C: TA can only delete their own TUTORIAL material
  if (req.user.role === 'TEACHING_ASSISTANT') {
    if (material.uploadedById !== req.user.id || material.type !== 'TUTORIAL') {
      return res.status(403).json({
        success: false,
        message: 'Teaching assistants can only delete their own tutorial materials.',
      });
    }
  }

  const isAuthorized =
    material.uploadedById === req.user.id || (await canUserManageCourseMaterials(req.user, courseId));

  if (!isAuthorized) {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  // Threat T-B: delete may unlink only the material's own stored file inside the materials directory
  if (
    material.fileUrl &&
    material.fileUrl.startsWith('/uploads/materials/') &&
    !material.fileUrl.includes('..') &&
    material.fileName
  ) {
    const filename = path.basename(material.fileUrl);
    const allowedDir = path.resolve(process.cwd(), 'uploads/materials');
    const filePath = path.resolve(allowedDir, filename);
    if (filePath.startsWith(allowedDir) && fs.existsSync(filePath)) {
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

  if (!Number.isSafeInteger(courseId) || courseId <= 0) {
    return next(new ValidationError('Invalid course ID'));
  }
  if (!Number.isSafeInteger(materialId) || materialId <= 0) {
    return next(new ValidationError('Invalid material ID'));
  }

  const material = await prisma.courseMaterial.findUnique({ where: { id: materialId } });
  if (!material || material.courseId !== courseId) {
    return next(new NotFoundError('Course material not found'));
  }

  // Threat T-C: TA can only toggle their own TUTORIAL material
  if (req.user?.role === 'TEACHING_ASSISTANT') {
    if (material.uploadedById !== req.user.id || material.type !== 'TUTORIAL') {
      return res.status(403).json({
        success: false,
        message: 'Teaching assistants can only toggle publication of their own tutorial materials.',
      });
    }
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

  if (!Number.isSafeInteger(courseId) || courseId <= 0) {
    return next(new ValidationError('Invalid course ID'));
  }

  const course = await prisma.course.findUnique({ where: { id: courseId } });

  if (!course) {
    return next(new NotFoundError('Course not found'));
  }

  // Threat T-C: TA cannot toggle course publication (only doctor and admins)
  if (req.user?.role === 'TEACHING_ASSISTANT') {
    return res.status(403).json({
      success: false,
      message: 'Teaching assistants cannot change course publication status.',
    });
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

/**
 * @desc    Download course material securely (SEC-01)
 * @route   GET /api/courses/:id/materials/:materialId/download
 * @access  Private (Authenticated, Enrolled Student, Assigned Doctor/TA, or Admin)
 */
export const downloadCourseMaterial = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AuthorizationError('Authentication required'));
    }

    const courseId = parseInt(req.params.id as string, 10);
    const materialId = parseInt(req.params.materialId as string, 10);

    if (!Number.isSafeInteger(courseId) || courseId <= 0) {
      return next(new ValidationError('Invalid course ID'));
    }
    if (!Number.isSafeInteger(materialId) || materialId <= 0) {
      return next(new ValidationError('Invalid material ID'));
    }

    const material = await prisma.courseMaterial.findUnique({
      where: { id: materialId },
      include: {
        course: {
          select: {
            id: true,
            isPublished: true,
            departmentId: true,
            department: { select: { collegeId: true } },
          },
        },
      },
    });

    if (!material || material.courseId !== courseId) {
      return next(new NotFoundError('Course material not found'));
    }

    if (req.user.role === 'STUDENT') {
      if (!material.isPublished) {
        return next(new NotFoundError('Course material not found'));
      }
      const studentId = req.user.student?.id;
      const enrollment = studentId
        ? await prisma.enrollment.findFirst({
            where: {
              courseId,
              studentId,
              status: 'ENROLLED',
            },
          })
        : null;

      if (!enrollment) {
        return next(
          new AuthorizationError('Access denied: You are not enrolled in this course')
        );
      }
    } else {
      const isAuthorized = await canUserManageCourseMaterials(req.user, courseId);
      if (!isAuthorized) {
        return next(new AuthorizationError('Access denied'));
      }
    }

    // Check if external URL
    if (!material.fileUrl || material.fileUrl.startsWith('http://') || material.fileUrl.startsWith('https://')) {
      return res.status(400).json({
        success: false,
        message: 'Material is hosted externally',
        external: true,
      });
    }

    // Directory traversal / file location validation
    if (material.fileUrl.includes('..') || !material.fileUrl.startsWith('/uploads/materials/')) {
      return next(new AppError('Invalid material file path', 400));
    }

    const filename = path.basename(material.fileUrl);
    const allowedDir = path.resolve(process.cwd(), 'uploads/materials');
    const resolvedPath = path.resolve(allowedDir, filename);

    if (!resolvedPath.startsWith(allowedDir)) {
      return next(new AppError('Path traversal detected', 400));
    }

    if (!fs.existsSync(resolvedPath)) {
      return next(new NotFoundError('Material file not found on server'));
    }

    const rawFileName = material.fileName || filename;
    const sanitizedFileName = rawFileName.replace(/[\r\n"]/g, '').trim();

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', `attachment; filename="${sanitizedFileName}"`);

    const fileStream = fs.createReadStream(resolvedPath);

    res.on('close', () => {
      if (!fileStream.destroyed) {
        fileStream.destroy();
      }
    });

    fileStream.on('error', (err) => {
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: 'Failed to read material file' });
      } else {
        res.destroy(err);
      }
    });

    fileStream.pipe(res);
  }
);

/**
 * @desc    Get course grade structure for a specific academic term
 * @route   GET /api/courses/:courseId/grade-structure
 * @access  Private (SUPER_ADMIN, scoped COLLEGE/DEPARTMENT_ADMIN, assigned DOCTOR/TA, enrolled STUDENT)
 */
export const getGradeStructure = catchAsync(
  async (req: Request, res: Response, _next: NextFunction) => {
    const courseId = parseInt(req.params.courseId as string, 10);
    const result = await gradeStructureService.getGradeStructure(
      courseId,
      req.query.termId,
      req.user
    );
    res.json({ success: true, data: result });
  }
);

/**
 * @desc    Upsert course grade structure for a specific academic term
 * @route   PUT /api/courses/:courseId/grade-structure
 * @access  Private (SUPER_ADMIN, scoped COLLEGE/DEPARTMENT_ADMIN, assigned DOCTOR)
 */
export const updateGradeStructure = catchAsync(
  async (req: Request, res: Response, _next: NextFunction) => {
    const courseId = parseInt(req.params.courseId as string, 10);
    const result = await gradeStructureService.upsertGradeStructure(
      courseId,
      req.query.termId,
      req.user,
      req,
      {
        passMark: req.body.passMark,
        components: req.body.components,
      }
    );
    res.json({ success: true, data: result });
  }
);

/**
 * @desc    Get course gradebook for a specific academic term
 * @route   GET /api/courses/:courseId/gradebook
 * @access  Private (SUPER_ADMIN, scoped COLLEGE/DEPARTMENT_ADMIN, assigned DOCTOR/TA)
 */
export const getGradebook = catchAsync(
  async (req: Request, res: Response, _next: NextFunction) => {
    const courseId = parseInt(req.params.courseId as string, 10);
    const result = await gradebookService.getGradebook(
      courseId,
      req.query.termId,
      req.user
    );
    res.json({ success: true, data: result });
  }
);

/**
 * @desc    Save draft grade entries for a course-term gradebook
 * @route   POST /api/courses/:courseId/gradebook/draft
 * @access  Private (Assigned DOCTOR, Assigned TA only)
 */
export const saveGradebookDraft = catchAsync(
  async (req: Request, res: Response, _next: NextFunction) => {
    const courseId = parseInt(req.params.courseId as string, 10);
    const validatedInput = validateSaveGradebookDraftInput(req.body);
    const result = await gradebookService.saveGradebookDraft(
      courseId,
      req.query.termId,
      req.user,
      req,
      validatedInput
    );
    res.json({ success: true, data: result });
  }
);

/**
 * @desc    Publish course-term gradebook and evaluate completions
 * @route   POST /api/courses/:courseId/gradebook/publish
 * @access  Private (Assigned DOCTOR only)
 */
export const publishGradebook = catchAsync(
  async (req: Request, res: Response, _next: NextFunction) => {
    const courseId = parseInt(req.params.courseId as string, 10);
    const validatedInput = validatePublishGradebookInput(req.body);
    const result = await gradebookPublishService.publishGradebook(
      courseId,
      req.query.termId,
      req.user,
      req,
      validatedInput
    );
    res.json({ success: true, data: result });
  }
);

/**
 * @desc    Correct published grade entries and recompute totals
 * @route   POST /api/courses/:courseId/gradebook/correct
 * @access  Private (Assigned DOCTOR only)
 */
export const correctGradebook = catchAsync(
  async (req: Request, res: Response, _next: NextFunction) => {
    const courseId = parseInt(req.params.courseId as string, 10);
    const validatedInput = validateCorrectGradebookInput(req.body);
    const result = await gradebookCorrectionService.correctGradebook(
      courseId,
      req.query.termId,
      req.user,
      req,
      validatedInput
    );
    res.json({ success: true, data: result });
  }
);

