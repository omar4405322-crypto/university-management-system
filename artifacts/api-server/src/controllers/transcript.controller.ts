import { Request, Response } from 'express';
import catchAsync from '../utils/catchAsync';
import { AppError, AuthorizationError, NotFoundError } from '../utils/appError';
import { EnrollmentService } from '../services/enrollment.service';
import prisma from '../utils/prismaClient';
import { getScopeWhere } from '../utils/scope.utils';

export const getTranscript = catchAsync(async (req: Request, res: Response) => {
  const { studentId: studentIdParam } = req.params;
  const user = req.user!;
  let targetStudentId: number | null = null;

  if (studentIdParam !== undefined) {
    if (studentIdParam === 'me') {
      if (user.role !== 'STUDENT') {
        throw new AuthorizationError('The "me" parameter is only available for student accounts');
      }
      const student = await prisma.student.findUnique({
        where: { userId: user.id },
        select: { id: true },
      });
      if (!student) {
        throw new NotFoundError('Student profile not found');
      }
      targetStudentId = student.id;
    } else {
      const numericStudentId = parseInt(studentIdParam as string, 10);
      if (isNaN(numericStudentId)) {
        throw new AppError('Invalid student ID format', 400);
      }

      if (user.role === 'STUDENT') {
        const myStudent = await prisma.student.findUnique({
          where: { userId: user.id },
          select: { id: true },
        });
        if (!myStudent || myStudent.id !== numericStudentId) {
          throw new AuthorizationError('Access denied: You can only view your own transcript');
        }
        targetStudentId = myStudent.id;
      } else {
        const studentScope = getScopeWhere(user, 'student');
        const studentRecord = await prisma.student.findFirst({
          where: {
            AND: [
              { id: numericStudentId },
              studentScope,
            ],
          },
        });
        if (!studentRecord) {
          throw new AuthorizationError('Access denied: You are not authorized to view this student\'s transcript');
        }
        targetStudentId = numericStudentId;
      }
    }
  } else if (user.role === 'STUDENT') {
    const student = await prisma.student.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!student) {
      throw new NotFoundError('Student profile not found');
    }
    targetStudentId = student.id;
  }

  // Case 1: Student Record view (Specific student)
  if (targetStudentId) {
    const enrollments = await EnrollmentService.getStudentTranscript(targetStudentId);

    const completed = enrollments.filter(
      (e: any) => e.status === 'COMPLETED' && e.finalGrade !== null
    );
    const totalPoints = completed.reduce((sum: number, e: any) => {
      const grade = e.finalGrade;
      const points =
        grade >= 90 ? 4.0 : grade >= 80 ? 3.0 : grade >= 70 ? 2.0 : grade >= 60 ? 1.0 : 0;
      return sum + points * (e.course.credits ?? 3);
    }, 0);

    const totalHours = completed.reduce((sum: number, e: any) => sum + (e.course.credits ?? 3), 0);
    const gpa = totalHours > 0 ? (totalPoints / totalHours).toFixed(2) : '0.00';

    const byYear = enrollments.reduce((acc: any, e: any) => {
      const key = `${e.academicYear}-${e.semester}`;
      if (!acc[key]) acc[key] = { academicYear: e.academicYear, semester: e.semester, courses: [] };
      acc[key].courses.push(e);
      return acc;
    }, {});

    return res.json({
      success: true,
      data: {
        studentId: targetStudentId,
        gpa,
        totalCreditHours: totalHours,
        totalEnrollments: enrollments.length,
        semesters: Object.values(byYear),
        isAdminOverview: false,
      },
    });
  }

  // Case 2: Administrative Overview (Doctors / Admins / Super Admins)
  const now = new Date();

  const [exams, quizzes, tasks] = await Promise.all([
    prisma.exam.findMany({
      where: {
        date: { lte: now },
      },
      include: {
        course: { select: { id: true, name: true, courseCode: true } },
        submissions: {
          include: {
            student: { select: { id: true, firstName: true, lastName: true, studentId: true } },
          },
        },
        _count: { select: { questions: true } },
      },
      orderBy: { date: 'desc' },
    }),
    prisma.quiz.findMany({
      where: {
        endTime: { lte: now },
      },
      include: {
        course: { select: { id: true, name: true, courseCode: true } },
        submissions: {
          include: {
            student: { select: { id: true, firstName: true, lastName: true, studentId: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.task.findMany({
      where: {
        dueDate: { lte: now },
      },
      include: {
        course: { select: { id: true, name: true, courseCode: true } },
        submissions: {
          include: {
            student: { select: { id: true, firstName: true, lastName: true, studentId: true } },
          },
        },
      },
      orderBy: { dueDate: 'desc' },
    }),
  ]);

  const totalSubmissions = exams.reduce((sum, e) => sum + e.submissions.length, 0);
  const scoredExams = exams.flatMap((e) => e.submissions.map((s) => s.score).filter((sc) => sc !== null)) as number[];
  const averageScore = scoredExams.length > 0
    ? (scoredExams.reduce((a, b) => a + b, 0) / scoredExams.length).toFixed(1)
    : '0';

  return res.json({
    success: true,
    data: {
      isAdminOverview: true,
      totalCompletedExams: exams.length,
      totalSubmissions,
      averageScore,
      completedExams: exams.map((ex) => ({
        id: ex.id,
        courseId: ex.courseId,
        courseName: ex.course.name,
        courseCode: ex.course.courseCode,
        type: ex.type,
        date: ex.date,
        startTime: ex.startTime,
        endTime: ex.endTime,
        room: ex.room,
        questionsCount: ex._count.questions,
        submissionsCount: ex.submissions.length,
        submissions: ex.submissions.map((sub) => ({
          id: sub.id,
          studentName: `${sub.student.firstName} ${sub.student.lastName}`,
          studentCode: sub.student.studentId,
          score: sub.score,
          maxScore: sub.maxScore,
          status: sub.status,
          submittedAt: sub.submittedAt,
        })),
      })),
      quizzes: quizzes.map((q) => ({
        id: q.id,
        courseName: q.course.name,
        courseCode: q.course.courseCode,
        title: q.title,
        submissionsCount: q.submissions.length,
      })),
      tasks: tasks.map((t) => ({
        id: t.id,
        courseName: t.course.name,
        courseCode: t.course.courseCode,
        title: t.title,
        submissionsCount: t.submissions.length,
      })),
    },
  });
});
