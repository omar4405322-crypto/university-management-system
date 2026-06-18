import prisma from '../utils/prismaClient.js';
import { ConflictError, NotFoundError } from '../utils/appError.js';

class EnrollmentService {
  static async enrollStudent(
    studentId: number,
    courseId: number,
    semester: number,
    academicYear: number
  ) {
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

  static async withdrawStudent(studentId: number, courseId: number) {
    const enrollment = await prisma.enrollment.findFirst({
      where: { studentId, courseId, status: 'ENROLLED' },
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

  static async getStudentTranscript(studentId: number) {
    return prisma.enrollment.findMany({
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
    });
  }
}

export { EnrollmentService };
