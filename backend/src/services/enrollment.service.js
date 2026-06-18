const prisma = require('../utils/prismaClient.js');
const { ConflictError, NotFoundError } = require('../utils/appError.js');

class EnrollmentService {
  static async enrollStudent(
    studentId,
    courseId,
    semester,
    academicYear
  ) {
    const existing = await prisma.enrollment.findFirst({
      where: { studentId, courseId, semester, academicYear },
    });
    if (existing) {
      throw new ConflictError('Student is already enrolled in this course for this semester');
    }

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: { _count: { select: { enrollments: true } } },
    });
    if (!course) {
      throw new NotFoundError('Course not found');
    }
    if (course._count.enrollments >= course.maxStudents) {
      throw new ConflictError('Course has reached maximum enrollment capacity');
    }

    return prisma.$transaction(async (tx) => {
      const enrollment = await tx.enrollment.create({
        data: { studentId, courseId, semester, academicYear },
        include: {
          course: {
            select: { id: true, name: true, courseCode: true, credits: true },
          },
        },
      });
      return enrollment;
    });
  }

  static async withdrawStudent(studentId, courseId) {
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

  static async getStudentTranscript(studentId) {
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

module.exports = { EnrollmentService };
