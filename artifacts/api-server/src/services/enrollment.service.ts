import prisma from '../utils/prismaClient';
import { AppError, ConflictError, NotFoundError } from '../utils/appError';

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
