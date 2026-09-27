import { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";
import prisma from "../utils/prismaClient";
import { notifyStudentsInCourse } from "../utils/notification.utils";
import catchAsync from "../utils/catchAsync";
import {
  NotFoundError,
  AuthorizationError,
  AppError,
  ConflictError,
} from "../utils/appError";
import { getScopeWhere } from "../utils/scope.utils";
import { toZonedTime } from "date-fns-tz";
import type { AuthActor } from "../types/auth.types";

const CAIRO_TZ = "Africa/Cairo";

type QuizWindow = {
  startTime: Date | string | null;
  endTime: Date | string | null;
  createdAt: Date | string;
  duration: number;
};

type QuizOffering = {
  courseId: number;
  academicYear: number;
  semester: number;
};

type EnrollmentQueryClient = {
  enrollment: {
    findUnique: typeof prisma.enrollment.findUnique;
  };
};

export interface QuestionInput {
  text: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correct: string;
  points?: number;
}

export interface AnswerEntry {
  questionId: string | number;
  answer: string | boolean;
}

export type SanitizedQuestion = {
  id: number;
  text: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  points: number;
};

async function requireQuizEnrollment(
  client: EnrollmentQueryClient,
  quiz: QuizOffering,
  studentId: number,
) {
  const enrollment = await client.enrollment.findUnique({
    where: {
      studentId_courseId_semester_academicYear: {
        studentId,
        courseId: quiz.courseId,
        academicYear: quiz.academicYear,
        semester: quiz.semester,
      },
    },
    select: { id: true, status: true },
  });
  if (!enrollment || enrollment.status !== "ENROLLED") {
    if (enrollment?.status === "BLOCKED") {
      throw new AuthorizationError(
        "Access denied: your enrollment for this quiz offering is blocked",
      );
    }
    throw new AuthorizationError(
      "Access denied: you are not enrolled in this quiz offering",
    );
  }
  return enrollment;
}

function hasScopeFilter(scope: Prisma.CourseWhereInput | Record<string, unknown>): boolean {
  return Object.keys(scope).length > 0;
}

/**
 * Quiz access always starts with the shared course scope, then tightens staff and
 * student access to the relationship that authorizes this specific workflow.
 */
export function getQuizCourseScope(user: AuthActor | undefined): Prisma.CourseWhereInput {
  const sharedScope = (getScopeWhere(user, "course") || {}) as Prisma.CourseWhereInput;
  const role = String(user?.role || "").toUpperCase();

  if (role === "DOCTOR") {
    const doctorId = user?.doctor?.id;
    if (!doctorId) return { id: -1 };
    return {
      AND: [sharedScope, { scheduleSlots: { some: { doctorId } } }],
    };
  }

  if (role === "TEACHING_ASSISTANT") {
    const teachingAssistantId = user?.teachingAssistant?.id;
    if (!teachingAssistantId) return { id: -1 };
    return {
      AND: [sharedScope, { scheduleSlots: { some: { teachingAssistantId: String(teachingAssistantId) } } }],
    };
  }

  if (role === "STUDENT") {
    const studentId = user?.student?.id;
    if (!studentId) return { id: -1 };
    return {
      AND: [
        sharedScope,
        { enrollments: { some: { studentId, status: "ENROLLED" } } },
      ],
    };
  }

  return sharedScope;
}

export function getQuizWhere(id: number, user: AuthActor | undefined): Prisma.QuizWhereInput {
  const courseScope = getQuizCourseScope(user);
  return {
    AND: [{ id }, hasScopeFilter(courseScope) ? { course: courseScope } : {}],
  };
}

export function getQuizTimingWindow(quiz: QuizWindow): {
  startsAt: Date;
  closesAt: Date;
  durationDeadline: number;
} {
  const startsAt = new Date(quiz.startTime ?? quiz.createdAt);
  const duration = Number(quiz.duration);

  if (
    !Number.isFinite(startsAt.getTime()) ||
    !Number.isFinite(duration) ||
    duration <= 0
  ) {
    throw new AppError(
      "Quiz submission window is not configured correctly",
      403,
    );
  }

  const durationDeadline = startsAt.getTime() + duration * 60_000;
  const configuredEnd = quiz.endTime ? new Date(quiz.endTime).getTime() : null;
  const closesAtTime =
    configuredEnd !== null && Number.isFinite(configuredEnd)
      ? Math.min(configuredEnd, durationDeadline)
      : durationDeadline;

  return {
    startsAt,
    closesAt: new Date(closesAtTime),
    durationDeadline,
  };
}

export function assertQuizSubmissionWindow(
  quiz: QuizWindow,
  now: Date = new Date(),
): void {
  const { startsAt, closesAt } = getQuizTimingWindow(quiz);
  const nowTime = now.getTime();

  if (nowTime < startsAt.getTime()) {
    throw new AppError("Quiz has not started yet", 403);
  }

  if (nowTime > closesAt.getTime()) {
    throw new AppError("Quiz submission window has closed", 403);
  }
}

export function isQuizSubmissionUniqueConflict(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const err = error as { code?: unknown; meta?: { target?: unknown } };
  if (err.code !== "P2002") return false;
  const target = err.meta?.target;
  if (!target) return true;
  const fields = Array.isArray(target) ? target.map(String) : [String(target)];
  return (
    fields.some((field) => field.includes("quizId")) &&
    fields.some((field) => field.includes("studentId"))
  );
}

async function rejectMissingScopedQuiz(id: number): Promise<never> {
  const exists = await prisma.quiz.findUnique({
    where: { id },
    select: { id: true },
  });
  if (exists)
    throw new AuthorizationError("You do not have access to this quiz");
  throw new NotFoundError("Quiz not found");
}

export const createQuiz = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const {
      title,
      description,
      courseId,
      duration,
      startTime,
      endTime,
      questions,
    } = req.body;
    const doctor = req.user?.doctor;

    if (!doctor)
      return next(new AuthorizationError("Only doctors can create quizzes"));

    const parsedCourseId = parseInt(courseId as string);
    const courseScope = getQuizCourseScope(req.user);
    const course = await prisma.course.findFirst({
      where: {
        AND: [
          { id: parsedCourseId },
          hasScopeFilter(courseScope) ? courseScope : {},
        ],
      },
      select: { id: true, semester: true },
    });
    if (!course) {
      const courseExists = await prisma.course.findUnique({
        where: { id: parsedCourseId },
        select: { id: true },
      });
      if (courseExists) {
        return next(
          new AuthorizationError(
            "You can only create quizzes for courses you teach",
          ),
        );
      }
      return next(new NotFoundError("Course not found"));
    }

    const parsedDuration = parseInt(duration as string);
    const effectiveStartTime = startTime
      ? new Date(startTime as string)
      : new Date();
    const effectiveEndTime = endTime
      ? new Date(endTime as string)
      : new Date(effectiveStartTime.getTime() + parsedDuration * 60_000);

    const quiz = await prisma.quiz.create({
      data: {
        title,
        description,
        courseId: parsedCourseId,
        academicYear: toZonedTime(new Date(), CAIRO_TZ).getFullYear(),
        semester: course.semester || 1,
        doctorId: doctor.id,
        duration: parsedDuration,
        startTime: effectiveStartTime,
        endTime: effectiveEndTime,
        questions: {
          create: (questions as QuestionInput[]).map((q) => ({
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
      title: "New Quiz Published",
      message: `A new quiz "${quiz.title}" has been published for course ${quiz.course.name}.`,
      type: "warning",
    });

    res.status(201).json({ success: true, data: quiz });
  },
);

export const getQuizzes = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { courseId } = req.query;
    const courseScope = getQuizCourseScope(req.user);
    const where: Prisma.QuizWhereInput = {
      AND: [
        ...(courseId ? [{ courseId: parseInt(courseId as string) }] : []),
        hasScopeFilter(courseScope) ? { course: courseScope } : {},
      ],
    };

    if (String(req.user?.role || "").toUpperCase() === "STUDENT") {
      const studentId = req.user?.student?.id;
      const offerings = studentId
        ? await prisma.enrollment.findMany({
            where: { studentId, status: "ENROLLED" },
            select: { courseId: true, academicYear: true, semester: true },
          })
        : [];
      const andClauses = Array.isArray(where.AND)
        ? where.AND
        : where.AND
          ? [where.AND]
          : [];
      where.AND = [
        ...andClauses,
        offerings.length
          ? {
              OR: offerings.map((offering) => ({
                courseId: offering.courseId,
                academicYear: offering.academicYear,
                semester: offering.semester,
              })),
            }
          : { id: -1 },
      ];
    }

    const quizzes = await prisma.quiz.findMany({
      where,
      include: {
        course: { select: { name: true, courseCode: true } },
        doctor: { select: { firstName: true, lastName: true } },
        _count: { select: { submissions: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ success: true, data: quizzes });
  },
);

export const getQuizById = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const quizId = parseInt(req.params.id as string);
    if (isNaN(quizId)) {
      return rejectMissingScopedQuiz(quizId);
    }
    const role = String(req.user?.role || "").toUpperCase();
    const isStudent = role === "STUDENT";
    const isInstructorOrAdmin =
      role === "DOCTOR" ||
      ["SUPER_ADMIN", "ADMIN", "COLLEGE_ADMIN", "DEPARTMENT_ADMIN"].includes(
        role,
      );

    // 1. Resolve scoped quiz metadata FIRST (without fetching questions)
    const quiz = await prisma.quiz.findFirst({
      where: getQuizWhere(quizId, req.user),
      include: {
        course: { select: { id: true, name: true, courseCode: true } },
        doctor: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (!quiz) {
      return rejectMissingScopedQuiz(quizId);
    }

    let hasSubmitted = false;
    let questions: SanitizedQuestion[] | Prisma.QuestionGetPayload<Record<string, never>>[] = [];

    if (isStudent) {
      const studentId = req.user?.student?.id;
      if (!studentId)
        return next(new AuthorizationError("Student profile is required"));

      await requireQuizEnrollment(prisma, quiz, studentId);

      // 2. Resolve student submission state
      const studentSubmission = await prisma.quizSubmission.findFirst({
        where: { quizId: quiz.id, studentId },
        select: { id: true },
      });
      hasSubmitted = !!studentSubmission;

      // 3. Timing window check for student question disclosure
      const reqWithNow = req as Request & { now?: string | Date };
      const now = reqWithNow.now ? new Date(reqWithNow.now) : new Date();
      let canDiscloseQuestions = false;

      if (!hasSubmitted) {
        try {
          const { startsAt, closesAt } = getQuizTimingWindow(quiz);
          const nowTime = now.getTime();
          if (nowTime >= startsAt.getTime() && nowTime <= closesAt.getTime()) {
            canDiscloseQuestions = true;
          }
        } catch {
          canDiscloseQuestions = false;
        }
      }

      if (canDiscloseQuestions) {
        // 4. Query questions explicitly without 'correct' answer key
        questions = await prisma.question.findMany({
          where: { quizId: quiz.id },
          select: {
            id: true,
            text: true,
            optionA: true,
            optionB: true,
            optionC: true,
            optionD: true,
            points: true,
          },
          orderBy: { id: "asc" },
        });
      } else {
        // Prior to start, after submission, or when window closed: questions/options absent
        questions = [];
      }
    } else if (isInstructorOrAdmin) {
      // 5. Authorized instructor/admin preview retains full questions including answer key
      questions = await prisma.question.findMany({
        where: { quizId: quiz.id },
        orderBy: { id: "asc" },
      });
    } else {
      // Teaching assistants and any other non-authorized roles receive no questions
      questions = [];
    }

    const data = {
      ...quiz,
      hasSubmitted,
      questions,
    };

    res.json({ success: true, data });
  },
);

export const submitQuiz = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { answers } = req.body;
    const studentId = req.user?.student?.id;

    if (!studentId)
      return next(new AuthorizationError("Only students can submit quizzes"));

    const quizId = parseInt(id as string);
    const preflightQuiz = await prisma.quiz.findFirst({
      where: getQuizWhere(quizId, req.user),
      select: { id: true, courseId: true, academicYear: true, semester: true },
    });
    if (!preflightQuiz) {
      return rejectMissingScopedQuiz(quizId);
    }
    await requireQuizEnrollment(prisma, preflightQuiz, studentId);

    const normalizedAnswers: Record<string, unknown> = Array.isArray(answers)
      ? Object.fromEntries(
          (answers as AnswerEntry[]).map((entry) => [String(entry.questionId), entry.answer]),
        )
      : (answers as Record<string, unknown>);

    let submission;
    try {
      submission = await prisma.$transaction(
        async (tx) => {
          const quiz = await tx.quiz.findFirst({
            where: getQuizWhere(quizId, req.user),
            include: { questions: true },
          });
          if (!quiz)
            throw new AuthorizationError("You do not have access to this quiz");

          const enrollment = await requireQuizEnrollment(
            tx,
            quiz,
            studentId,
          );

          assertQuizSubmissionWindow(quiz);

          const existingSubmission = await tx.quizSubmission.findFirst({
            where: { quizId, studentId },
            select: { id: true },
          });
          if (existingSubmission) {
            throw new ConflictError("You have already submitted this quiz");
          }

          let score = 0;
          let totalPoints = 0;
          quiz.questions.forEach((question) => {
            totalPoints += question.points;
            if (normalizedAnswers[String(question.id)] === question.correct) {
              score += question.points;
            }
          });
          if (totalPoints <= 0)
            throw new AppError("Quiz has no gradable questions", 409);

          return tx.quizSubmission.create({
            data: {
              quizId,
              studentId,
              enrollmentId: enrollment.id,
              answers: normalizedAnswers as Prisma.InputJsonObject,
              score: (score / totalPoints) * 100,
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error: unknown) {
      if (isQuizSubmissionUniqueConflict(error)) {
        return next(new ConflictError("You have already submitted this quiz"));
      }
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code: unknown }).code === "P2034"
      ) {
        return next(
          new ConflictError(
            "A concurrent quiz submission was detected. Please retry.",
          ),
        );
      }
      throw error;
    }

    res.status(201).json({ success: true, data: submission });
  },
);

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
  },
);
