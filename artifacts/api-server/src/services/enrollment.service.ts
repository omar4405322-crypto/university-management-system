import prisma from '../utils/prismaClient';
import {
  AppError,
  AuthorizationError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../utils/appError';
import { getScopeWhere } from '../utils/scope.utils';
import { attendanceEngine } from '../attendance/attendance.engine';

class EnrollmentService {
  static async enrollStudent(
    studentId: number,
    courseId: number,
    semester: number,
    academicYear: number
  ) {
    const currentYear = new Date().getFullYear();
    const minYear = currentYear - 1;
    const maxYear = currentYear + 1;
    if (academicYear < minYear || academicYear > maxYear) {
      throw new AppError(
        `Academic year must be a valid calendar year between ${minYear} and ${maxYear} (received: ${academicYear})`,
        400
      );
    }

    if (semester < 1 || semester > 3) {
      throw new AppError('Semester must be between 1 and 3 (1 = First, 2 = Second, 3 = Summer)', 400);
    }

    return prisma.$transaction(async (tx) => {
      const existing = await tx.enrollment.findUnique({
        where: {
          studentId_courseId_semester_academicYear: {
            studentId,
            courseId,
            semester,
            academicYear,
          },
        },
      });

      if (existing) {
        if (existing.status === 'ENROLLED') {
          throw new ConflictError('Student is already enrolled in this course for this semester');
        }

        const course = await tx.course.findUnique({
          where: { id: courseId },
          include: {
            _count: {
              select: {
                enrollments: {
                  where: {
                    semester,
                    academicYear,
                    status: 'ENROLLED',
                  },
                },
              },
            },
          },
        });

        if (!course) {
          throw new NotFoundError('Course not found');
        }
        if (course._count.enrollments >= course.maxStudents) {
          throw new ConflictError('Course has reached maximum enrollment capacity');
        }

        return tx.enrollment.update({
          where: { id: existing.id },
          data: {
            status: 'ENROLLED',
            enrolledAt: new Date(),
          },
          include: {
            course: {
              select: { id: true, name: true, courseCode: true, credits: true },
            },
          },
        });
      }

      const course = await tx.course.findUnique({
        where: { id: courseId },
        include: {
          _count: {
            select: {
              enrollments: {
                where: {
                  semester,
                  academicYear,
                  status: 'ENROLLED',
                },
              },
            },
          },
        },
      });

      if (!course) {
        throw new NotFoundError('Course not found');
      }
      if (course._count.enrollments >= course.maxStudents) {
        throw new ConflictError('Course has reached maximum enrollment capacity');
      }

      return tx.enrollment.create({
        data: { studentId, courseId, semester, academicYear, status: 'ENROLLED' },
        include: {
          course: {
            select: { id: true, name: true, courseCode: true, credits: true },
          },
        },
      });
    });
  }

  static async withdrawStudent(enrollmentIdOrStudentId: number, courseId?: number) {
    if (courseId !== undefined) {
      const enrollment = await prisma.enrollment.findFirst({
        where: { studentId: enrollmentIdOrStudentId, courseId, status: 'ENROLLED' },
      });
      if (!enrollment) {
        throw new NotFoundError('No active enrollment found for this student and course');
      }

      return prisma.enrollment.update({
        where: { id: enrollment.id },
        data: { status: 'WITHDRAWN' },
        include: {
          course: { select: { id: true, name: true, courseCode: true } },
        },
      });
    }

    const enrollment = await prisma.enrollment.findUnique({
      where: { id: enrollmentIdOrStudentId },
    });
    if (!enrollment) {
      throw new NotFoundError('Enrollment not found');
    }

    return prisma.enrollment.update({
      where: { id: enrollmentIdOrStudentId },
      data: { status: 'WITHDRAWN' },
      include: {
        course: { select: { id: true, name: true, courseCode: true } },
      },
    });
  }

  static async setCustomAbsenceThreshold(
    user: any,
    enrollmentId: number,
    customAbsenceThreshold: number | null
  ) {
    if (
      customAbsenceThreshold !== null &&
      (typeof customAbsenceThreshold !== 'number' ||
        isNaN(customAbsenceThreshold) ||
        customAbsenceThreshold < 0 ||
        customAbsenceThreshold > 100)
    ) {
      throw new ValidationError('customAbsenceThreshold must be null or a number between 0 and 100');
    }

    const enrollment = await prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: { course: true, student: true },
    });

    if (!enrollment) {
      throw new NotFoundError('Enrollment not found');
    }

    const courseScope: any = getScopeWhere(user, 'course');
    if (courseScope && Object.keys(courseScope).length) {
      const courseCheck = await prisma.course.findFirst({
        where: { AND: [{ id: enrollment.courseId }, courseScope] },
      });
      if (!courseCheck) {
        throw new AuthorizationError(
          'Access denied: You are not authorized for this course.'
        );
      }
    }

    await prisma.enrollment.update({
      where: { id: enrollmentId },
      data: {
        customAbsenceThreshold,
      },
    });

    await attendanceEngine.recalculateAbsence(enrollment.studentId, enrollment.courseId);

    const finalEnrollment = await prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: {
        course: { select: { id: true, name: true, courseCode: true } },
        student: { select: { id: true, firstName: true, lastName: true, studentId: true } },
      },
    });

    return finalEnrollment;
  }

  static async createExemptionPeriod(
    user: any,
    enrollmentId: number,
    data: { startDate: string | Date; endDate: string | Date; reason: string }
  ) {
    const { startDate, endDate, reason } = data;
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new ValidationError('startDate and endDate must be valid dates');
    }

    if (start.getTime() > end.getTime()) {
      throw new ValidationError('startDate must be before or equal to endDate');
    }

    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      throw new ValidationError('reason is required');
    }

    const enrollment = await prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: { course: true, student: true },
    });

    if (!enrollment) {
      throw new NotFoundError('Enrollment not found');
    }

    const courseScope: any = getScopeWhere(user, 'course');
    if (courseScope && Object.keys(courseScope).length) {
      const courseCheck = await prisma.course.findFirst({
        where: { AND: [{ id: enrollment.courseId }, courseScope] },
      });
      if (!courseCheck) {
        throw new AuthorizationError(
          'Access denied: You are not authorized for this course.'
        );
      }
    }

    const exemption = await prisma.absenceExemptionPeriod.create({
      data: {
        enrollmentId,
        startDate: start,
        endDate: end,
        reason: reason.trim(),
        createdById: user.id,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            role: true,
            doctor: { select: { firstName: true, lastName: true } },
            student: { select: { firstName: true, lastName: true } },
            teachingAssistant: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    await attendanceEngine.recalculateAbsence(enrollment.studentId, enrollment.courseId);

    const updatedEnrollment = await prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      select: {
        id: true,
        status: true,
        customAbsenceThreshold: true,
      },
    });

    const firstName =
      exemption.createdBy.doctor?.firstName ||
      exemption.createdBy.student?.firstName ||
      exemption.createdBy.teachingAssistant?.firstName ||
      exemption.createdBy.email.split('@')[0];
    const lastName =
      exemption.createdBy.doctor?.lastName ||
      exemption.createdBy.student?.lastName ||
      exemption.createdBy.teachingAssistant?.lastName ||
      '';

    return {
      exemptionPeriod: {
        id: exemption.id,
        enrollmentId: exemption.enrollmentId,
        startDate: exemption.startDate,
        endDate: exemption.endDate,
        reason: exemption.reason,
        createdById: exemption.createdById,
        createdAt: exemption.createdAt,
        createdBy: {
          id: exemption.createdBy.id,
          email: exemption.createdBy.email,
          firstName,
          lastName,
        },
      },
      enrollment: updatedEnrollment,
    };
  }

  static async getExemptionPeriods(user: any, enrollmentId: number) {
    const enrollment = await prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: { course: true, student: true },
    });

    if (!enrollment) {
      throw new NotFoundError('Enrollment not found');
    }

    if (user.role === 'STUDENT') {
      const studentId = user.student?.id;
      if (enrollment.studentId !== studentId && enrollment.student?.userId !== user.id) {
        throw new AuthorizationError('Access denied: You can only view your own exemption periods.');
      }
    } else if (['SUPER_ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'].includes(user.role)) {
      const courseScope: any = getScopeWhere(user, 'course');
      if (courseScope && Object.keys(courseScope).length) {
        const courseCheck = await prisma.course.findFirst({
          where: { AND: [{ id: enrollment.courseId }, courseScope] },
        });
        if (!courseCheck) {
          throw new AuthorizationError(
            'Access denied: You are not authorized for this course.'
          );
        }
      }
    } else {
      throw new AuthorizationError(
        'Access denied: You are not authorized to view exemption periods.'
      );
    }

    const exemptionPeriods = await prisma.absenceExemptionPeriod.findMany({
      where: { enrollmentId },
      orderBy: { startDate: 'desc' },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            role: true,
            doctor: { select: { firstName: true, lastName: true } },
            student: { select: { firstName: true, lastName: true } },
            teachingAssistant: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    return exemptionPeriods.map((p) => {
      const firstName =
        p.createdBy.doctor?.firstName ||
        p.createdBy.student?.firstName ||
        p.createdBy.teachingAssistant?.firstName ||
        p.createdBy.email.split('@')[0];
      const lastName =
        p.createdBy.doctor?.lastName ||
        p.createdBy.student?.lastName ||
        p.createdBy.teachingAssistant?.lastName ||
        '';

      return {
        id: p.id,
        enrollmentId: p.enrollmentId,
        startDate: p.startDate,
        endDate: p.endDate,
        reason: p.reason,
        createdById: p.createdById,
        createdAt: p.createdAt,
        createdBy: {
          id: p.createdBy.id,
          email: p.createdBy.email,
          firstName,
          lastName,
        },
      };
    });
  }

  static async deleteExemptionPeriod(user: any, enrollmentId: number, exemptionId: number) {
    const enrollment = await prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: { course: true, student: true },
    });

    if (!enrollment) {
      throw new NotFoundError('Enrollment not found');
    }

    const courseScope: any = getScopeWhere(user, 'course');
    if (courseScope && Object.keys(courseScope).length) {
      const courseCheck = await prisma.course.findFirst({
        where: { AND: [{ id: enrollment.courseId }, courseScope] },
      });
      if (!courseCheck) {
        throw new AuthorizationError(
          'Access denied: You are not authorized for this course.'
        );
      }
    }

    const exemption = await prisma.absenceExemptionPeriod.findFirst({
      where: { id: exemptionId, enrollmentId },
    });

    if (!exemption) {
      throw new NotFoundError('Exemption period not found for this enrollment');
    }

    await prisma.absenceExemptionPeriod.delete({
      where: { id: exemption.id },
    });

    await attendanceEngine.recalculateAbsence(enrollment.studentId, enrollment.courseId);

    const updatedEnrollment = await prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      select: {
        id: true,
        status: true,
        customAbsenceThreshold: true,
      },
    });

    return {
      message: 'Exemption period deleted successfully',
      enrollment: updatedEnrollment,
    };
  }

  static async getStudentTranscript(studentId: number) {
    const [enrollments, examSubmissions, quizSubmissions, taskSubmissions] = await Promise.all([
      prisma.enrollment.findMany({
        where: { studentId },
        include: {
          course: {
            select: {
              id: true,
              name: true,
              courseCode: true,
              credits: true,
              department: { select: { name: true } },
            },
          },
        },
        orderBy: [{ academicYear: 'asc' }, { semester: 'asc' }],
      }),
      prisma.examSubmission.findMany({
        where: { studentId },
        include: {
          exam: {
            select: {
              id: true,
              type: true,
              courseId: true,
              date: true,
            },
          },
        },
      }),
      prisma.quizSubmission.findMany({
        where: { studentId },
        include: {
          quiz: {
            select: {
              id: true,
              title: true,
              courseId: true,
            },
          },
        },
      }),
      prisma.taskSubmission.findMany({
        where: { studentId },
        include: {
          task: {
            select: {
              id: true,
              title: true,
              courseId: true,
              maxScore: true,
            },
          },
        },
      }),
    ]);

    return enrollments.map((e) => {
      const courseId = e.courseId;
      const courseExams = examSubmissions
        .filter((sub) => sub.exam.courseId === courseId)
        .map((sub) => ({
          id: sub.id,
          title: sub.exam.type,
          score: sub.score,
          maxScore: sub.maxScore,
          date: sub.exam.date,
          status: sub.status,
        }));

      const courseQuizzes = quizSubmissions
        .filter((sub) => sub.quiz.courseId === courseId)
        .map((sub) => ({
          id: sub.id,
          title: sub.quiz.title,
          score: sub.score,
          submittedAt: sub.submittedAt,
        }));

      const courseTasks = taskSubmissions
        .filter((sub) => sub.task.courseId === courseId)
        .map((sub) => ({
          id: sub.id,
          title: sub.task.title,
          score: sub.score,
          maxScore: sub.task.maxScore,
          submittedAt: sub.submittedAt,
        }));

      return {
        ...e,
        exams: courseExams,
        quizzes: courseQuizzes,
        tasks: courseTasks,
      };
    });
  }
}

export { EnrollmentService };

