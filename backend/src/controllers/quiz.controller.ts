import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prismaClient.js';
import { notifyStudentsInCourse } from '../utils/notification.utils.js';
import catchAsync from '../utils/catchAsync.js';
import { NotFoundError, AuthorizationError, AppError } from '../utils/appError.js';
import { getScopeWhere } from '../utils/scope.utils.js';

export const createQuiz = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { title, description, courseId, duration, startTime, endTime, questions } = req.body;
  const doctor = await prisma.doctor.findUnique({ where: { userId: req.user!.id } });

  if (!doctor) return next(new AuthorizationError('Only doctors can create quizzes'));

  // Ensure course within scope
  const course = await prisma.course.findUnique({ where: { id: parseInt(courseId as string) }, include: { department: true } });
  if (!course) return next(new NotFoundError('Course not found'));
  const courseScope: any = getScopeWhere(req.user!, 'course');
  if (courseScope && Object.keys(courseScope).length) {
    if (courseScope.department && course.department?.collegeId !== courseScope.department.collegeId) return next(new AuthorizationError('Access denied'));
    if (courseScope.departmentId && course.departmentId !== courseScope.departmentId) return next(new AuthorizationError('Access denied'));
  }

  const quiz = await prisma.quiz.create({
    data: {
      title,
      description,
      courseId: parseInt(courseId as string),
      doctorId: doctor.id,
      duration: parseInt(duration as string),
      startTime: startTime ? new Date(startTime as string) : null,
      endTime: endTime ? new Date(endTime as string) : null,
      questions: {
        create: questions.map((q: any) => ({
          text: q.text,
          optionA: q.optionA,
          optionB: q.optionB,
          optionC: q.optionC,
          optionD: q.optionD,
          correct: q.correct,
          points: q.points || 1
        }))
      }
    },
    include: { 
      questions: true,
      course: { select: { name: true } }
    }
  });

  // Notify students
  await notifyStudentsInCourse({
    courseId: quiz.courseId,
    title: 'New Quiz Published',
    message: `A new quiz "${quiz.title}" has been published for course ${quiz.course.name}.`,
    type: 'warning'
  });

  res.status(201).json({ success: true, data: quiz });
});

export const getQuizzes = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { courseId } = req.query;
  let where: any = {};

  if (courseId) {
    where.courseId = parseInt(courseId as string);
  }

  // Role-based filtering
  if (req.user!.role === 'DOCTOR') {
    const doctor = await prisma.doctor.findUnique({ where: { userId: req.user!.id } });
    if (doctor) {
      where.doctorId = doctor.id;
    }
  } else if (req.user!.role === 'STUDENT') {
    const student = await prisma.student.findUnique({ where: { userId: req.user!.id } });
    if (student) {
      where.course = {
        enrollments: { some: { studentId: student.id, status: 'ENROLLED' } }
      };
    }
  }

  // Apply admin scope
  const courseScope: any = getScopeWhere(req.user!, 'course');
  if (courseScope && Object.keys(courseScope).length) {
    if (courseScope.department) where.course = courseScope.department;
    else if (courseScope.departmentId) where.course = { departmentId: courseScope.departmentId };
  }

  const quizzes = await prisma.quiz.findMany({
    where,
    include: {
      course: { select: { name: true, courseCode: true } },
      doctor: { select: { firstName: true, lastName: true } },
      _count: { select: { submissions: true } }
    },
    orderBy: { createdAt: 'desc' }
  });

  res.json({ success: true, data: quizzes });
});

export const getQuizById = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const quiz: any = await prisma.quiz.findUnique({
    where: { id: parseInt(req.params.id as string) },
    include: { 
      questions: req.user!.role === 'DOCTOR' || req.user!.role === 'SUPER_ADMIN', // Hide correct answers for students? 
      // Actually, we need questions for students to take the quiz, but maybe hide the 'correct' field.
      course: true,
      doctor: true
    }
  });

  if (!quiz) return next(new NotFoundError('Quiz not found'));

  // If student, remove the 'correct' field from questions
  if (req.user!.role === 'STUDENT') {
    const student: any = await prisma.student.findUnique({ where: { userId: req.user!.id } });
    const studentSubmission = await prisma.quizSubmission.findFirst({
      where: { quizId: quiz.id, studentId: student.id }
    });
    
    quiz.questions = quiz.questions.map((q: any) => {
      const { correct, ...rest } = q;
      return studentSubmission ? q : rest; // Show correct answers only if already submitted
    });
    quiz.hasSubmitted = !!studentSubmission;
  }

  res.json({ success: true, data: quiz });
});

export const submitQuiz = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const { answers } = req.body; // { questionId: "A", ... }
  const student = await prisma.student.findUnique({ where: { userId: req.user!.id } });

  if (!student) return next(new AuthorizationError('Only students can submit quizzes'));

  const quiz: any = await prisma.quiz.findUnique({
    where: { id: parseInt(id as string) },
    include: { questions: true, course: { include: { department: true } } }
  });

  if (!quiz) return next(new NotFoundError('Quiz not found'));

  // Enforce scope on submission
  const courseScope2: any = getScopeWhere(req.user!, 'course');
  if (courseScope2 && Object.keys(courseScope2).length) {
    if (courseScope2.department && quiz.course?.department?.collegeId !== courseScope2.department.collegeId) return next(new AuthorizationError('Access denied'));
    if (courseScope2.departmentId && quiz.course?.departmentId !== courseScope2.departmentId) return next(new AuthorizationError('Access denied'));
  }

  // Check if already submitted
  const existingSubmission = await prisma.quizSubmission.findFirst({
    where: { quizId: quiz.id, studentId: student.id }
  });
  if (existingSubmission) return next(new AppError('Already submitted', 400));

  // Auto-grading
  let score = 0;
  let totalPoints = 0;
  quiz.questions.forEach((q: any) => {
    totalPoints += q.points;
    if (answers[q.id] === q.correct) {
      score += q.points;
    }
  });

  const submission = await prisma.quizSubmission.create({
    data: {
      quizId: quiz.id,
      studentId: student.id,
      answers,
      score: (score / totalPoints) * 100
    }
  });

  res.status(201).json({ success: true, data: submission });
});

export const getQuizResults = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const quiz = await prisma.quiz.findUnique({
    where: { id: parseInt(id as string) },
    include: {
      submissions: { include: { student: true } },
      course: { include: { department: true } }
    }
  });

  if (!quiz) return next(new NotFoundError('Quiz not found'));

  // Enforce scope for results
  const courseScope3: any = getScopeWhere(req.user!, 'course');
  if (courseScope3 && Object.keys(courseScope3).length) {
    if (courseScope3.department && quiz.course?.department?.collegeId !== courseScope3.department.collegeId) return next(new AuthorizationError('Access denied'));
    if (courseScope3.departmentId && quiz.course?.departmentId !== courseScope3.departmentId) return next(new AuthorizationError('Access denied'));
  }

  res.json({ success: true, data: quiz.submissions });
});
