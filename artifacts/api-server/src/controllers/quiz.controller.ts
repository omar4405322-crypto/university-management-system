import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../utils/prismaClient';
import { notifyStudentsInCourse } from '../utils/notification.utils';
import catchAsync from '../utils/catchAsync';
import {
  NotFoundError,
  AuthorizationError,
  AppError,
  ConflictError,
} from '../utils/appError';
import { getScopeWhere } from '../utils/scope.utils';

type QuizWindow = {
  startTime: Date | string | null;
  endTime: Date | string | null;
  createdAt: Date | string;
  duration: number;
};

function hasScopeFilter(scope: Record<string, any>): boolean {
  return Object.keys(scope).length > 0;
}

/**
 * Quiz access always starts with the shared course scope, then tightens staff and
 * student access to the relationship that authorizes this specific workflow.
 */
export function getQuizCourseScope(user: any): Record<string, any> {
  const sharedScope = getScopeWhere(user, 'course');
  const role = String(user?.role || '').toUpperCase();

  if (role === 'DOCTOR') {
    const doctorId = user?.doctor?.id;
    if (!doctorId) return { id: -1 };
    return {
      AND: [sharedScope, { scheduleSlots: { some: { doctorId } } }],
    };
  }

  if (role === 'TEACHING_ASSISTANT') {
    const teachingAssistantId = user?.teachingAssistant?.id;
    if (!teachingAssistantId) return { id: -1 };
    return {
      AND: [sharedScope, { scheduleSlots: { some: { teachingAssistantId } } }],
    };
  }

  if (role === 'STUDENT') {
    const studentId = user?.student?.id;
    if (!studentId) return { id: -1 };
    return {
      AND: [
        sharedScope,
        { enrollments: { some: { studentId, status: 'ENROLLED' } } },
      ],
    };
  }

  return sharedScope;
}

export function getQuizWhere(id: number, user: any): Record<string, any> {
  const courseScope = getQuizCourseScope(user);
  return {
    AND: [{ id }, hasScopeFilter(courseScope) ? { course: courseScope } : {}],
  };
}

export function assertQuizSubmissionWindow(
  quiz: QuizWindow,
  now: Date = new Date()
): void {
  const startsAt = new Date(quiz.startTime ?? quiz.createdAt);
  const duration = Number(quiz.duration);

  if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(duration) || duration <= 0) {
    throw new AppError('Quiz submission window is not configured correctly', 403);
  }
  if (now.getTime() < startsAt.getTime()) {
    throw new AppError('Quiz has not started yet', 403);
  }

  const durationDeadline = startsAt.getTime() + duration * 60_000;
  const configuredEnd = quiz.endTime ? new Date(quiz.endTime).getTime() : null;
  const closesAt =
    configuredEnd !== null && Number.isFinite(configuredEnd)
      ? Math.min(configuredEnd, durationDeadline)
      : durationDeadline;

  if (now.getTime() > closesAt) {
    throw new AppError('Quiz submission window has closed', 403);
  }
}

export function isQuizSubmissionUniqueConflict(error: any): boolean {
  if (error?.code !== 'P2002') return false;
  const target = error?.meta?.target;
  if (!target) return true;
  const fields = Array.isArray(target) ? target.map(String) : [String(target)];
  return (
    fields.some((field) => field.includes('quizId')) &&
    fields.some((field) => field.includes('studentId'))
  );
}

async function rejectMissingScopedQuiz(id: number): Promise<never> {
  const exists = await prisma.quiz.findUnique({ where: { id }, select: { id: true } });
  if (exists) throw new AuthorizationError('You do not have access to this quiz');
  throw new NotFoundError('Quiz not found');
}

export const createQuiz = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { title, description, courseId, duration, startTime, endTime, questions } = req.body;
  const doctor = req.user?.doctor;

  if (!doctor) return next(new AuthorizationError('Only doctors can create quizzes'));

  const parsedCourseId = parseInt(courseId as string);
  const courseScope = getQuizCourseScope(req.user);
  const course = await prisma.course.findFirst({
    where: {
      AND: [{ id: parsedCourseId }, hasScopeFilter(courseScope) ? courseScope : {}],
    },
    select: { id: true },
  });
  if (!course) {
    const courseExists = await prisma.course.findUnique({
      where: { id: parsedCourseId },
      select: { id: true },
    });
    if (courseExists) {
      return next(new AuthorizationError('You can only create quizzes for courses you teach'));
    }
    return next(new NotFoundError('Course not found'));
  }

  const parsedDuration = parseInt(duration as string);
  const effectiveStartTime = startTime ? new Date(startTime as string) : new Date();
  const effectiveEndTime = endTime
    ? new Date(endTime as string)
    : new Date(effectiveStartTime.getTime() + parsedDuration * 60_000);

  const quiz = await prisma.quiz.create({
    data: {
      title,
      description,
      courseId: parsedCourseId,
      doctorId: doctor.id,
      duration: parsedDuration,
      startTime: effectiveStartTime,
      endTime: effectiveEndTime,
      questions: {
        create: questions.map((q: any) => ({
          text: q.text,
          optionA: q.optionA,
          optionB: q.optionB,
          optionC: q.optionC,
          optionD: q.optionD,
          correct: q.correct,
          points: q.points || 1,
        })),
      },
    },
    include: {
      questions: true,
      course: { select: { name: true } },
    },
  });

  // Notify students
  await notifyStudentsInCourse({
    courseId: quiz.courseId,
    title: 'New Quiz Published',
    message: `A new quiz "${quiz.title}" has been published for course ${quiz.course.name}.`,
    type: 'warning',
  });

  res.status(201).json({ success: true, data: quiz });
});

export const getQuizzes = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { courseId } = req.query;
  const courseScope = getQuizCourseScope(req.user);
  const where = {
    AND: [
      ...(courseId ? [{ courseId: parseInt(courseId as string) }] : []),
      hasScopeFilter(courseScope) ? { course: courseScope } : {},
    ],
  };

  const quizzes = await prisma.quiz.findMany({
    where,
    include: {
      course: { select: { name: true, courseCode: true } },
      doctor: { select: { firstName: true, lastName: true } },
      _count: { select: { submissions: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ success: true, data: quizzes });
});

export const getQuizById = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const quizId = parseInt(req.params.id as string);
  const isStudent = String(req.user?.role || '').toUpperCase() === 'STUDENT';
  const quiz: any = await prisma.quiz.findFirst({
    where: getQuizWhere(quizId, req.user),
    include: {
      questions: isStudent
        ? {
            select: {
              id: true,
              text: true,
              optionA: true,
              optionB: true,
              optionC: true,
              optionD: true,
              points: true,
            },
          }
        : true,
      course: { select: { id: true, name: true, courseCode: true } },
      doctor: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  if (!quiz) {
    return rejectMissingScopedQuiz(quizId);
  }

  if (isStudent) {
    const studentId = req.user?.student?.id;
    if (!studentId) return next(new AuthorizationError('Student profile is required'));
    const studentSubmission = await prisma.quizSubmission.findFirst({
      where: { quizId: quiz.id, studentId },
      select: { id: true },
    });
    quiz.hasSubmitted = !!studentSubmission;
  }

  res.json({ success: true, data: quiz });
});

export const submitQuiz = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const { answers } = req.body;
  const studentId = req.user?.student?.id;

  if (!studentId) return next(new AuthorizationError('Only students can submit quizzes'));

  const quizId = parseInt(id as string);
  const preflightQuiz = await prisma.quiz.findFirst({
    where: getQuizWhere(quizId, req.user),
    select: { id: true },
  });
  if (!preflightQuiz) {
    return rejectMissingScopedQuiz(quizId);
  }

  const normalizedAnswers: Record<string, unknown> = Array.isArray(answers)
    ? Object.fromEntries(answers.map((entry: any) => [String(entry.questionId), entry.answer]))
    : answers;

  let submission;
  try {
    submission = await prisma.$transaction(
      async (tx) => {
        const quiz: any = await tx.quiz.findFirst({
          where: getQuizWhere(quizId, req.user),
          include: { questions: true },
        });
        if (!quiz) throw new AuthorizationError('You do not have access to this quiz');

        assertQuizSubmissionWindow(quiz);

        const existingSubmission = await tx.quizSubmission.findFirst({
          where: { quizId, studentId },
          select: { id: true },
        });
        if (existingSubmission) {
          throw new ConflictError('You have already submitted this quiz');
        }

        let score = 0;
        let totalPoints = 0;
        quiz.questions.forEach((question: any) => {
          totalPoints += question.points;
          if (normalizedAnswers[String(question.id)] === question.correct) {
            score += question.points;
          }
        });
        if (totalPoints <= 0) throw new AppError('Quiz has no gradable questions', 409);

        return tx.quizSubmission.create({
          data: {
            quizId,
            studentId,
            answers: normalizedAnswers as Prisma.InputJsonObject,
            score: (score / totalPoints) * 100,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  } catch (error: any) {
    if (isQuizSubmissionUniqueConflict(error)) {
      return next(new ConflictError('You have already submitted this quiz'));
    }
    if (error?.code === 'P2034') {
      return next(new ConflictError('A concurrent quiz submission was detected. Please retry.'));
    }
    throw error;
  }

  res.status(201).json({ success: true, data: submission });
});

export const getQuizResults = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const quizId = parseInt(id as string);
    const quiz = await prisma.quiz.findFirst({
      where: getQuizWhere(quizId, req.user),
      include: {
        submissions: { include: { student: true } },
      },
    });

    if (!quiz) {
      return rejectMissingScopedQuiz(quizId);
    }

    res.json({ success: true, data: quiz.submissions });
  }
);
