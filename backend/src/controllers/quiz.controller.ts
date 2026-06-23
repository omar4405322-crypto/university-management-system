import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prismaClient';
import { notifyStudentsInCourse, createNotification } from '../utils/notification.utils';
import catchAsync from '../utils/catchAsync';
import { NotFoundError, AuthorizationError, AppError } from '../utils/appError';
import { getScopeWhere } from '../utils/scope.utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getDoctorOrFail(req: Request, next: NextFunction) {
  const doctor = await prisma.doctor.findUnique({ where: { userId: req.user!.id } });
  if (!doctor) {
    next(new AuthorizationError('Only doctors can perform this action'));
    return null;
  }
  return doctor;
}

async function getQuizOrFail(id: number, next: NextFunction) {
  const quiz = await prisma.quiz.findUnique({
    where: { id },
    include: { course: { include: { department: true } } },
  });
  if (!quiz) {
    next(new NotFoundError('Quiz not found'));
    return null;
  }
  return quiz;
}

function isDoctorOwner(req: Request, quiz: { doctorId: number }): boolean {
  // doctor profile may be attached by auth middleware, or check directly
  return req.user!.role === 'SUPER_ADMIN' || req.user!.doctor?.id === quiz.doctorId;
}

// ─── CREATE QUIZ ──────────────────────────────────────────────────────────────

/**
 * POST /api/quizzes
 * Roles: DOCTOR, SUPER_ADMIN
 * Now accepts questions array with optional type (defaults to MCQ for backward compat).
 * Validation middleware still enforces the legacy MCQ-only format via quizValidation.
 */
export const createQuiz = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { title, description, courseId, duration, startTime, endTime, questions } = req.body;

  let finalDoctorId: number;

  if (req.user!.role === 'SUPER_ADMIN') {
    const courseCheck = await prisma.course.findUnique({
      where: { id: parseInt(courseId as string) },
    });
    if (!courseCheck) return next(new NotFoundError('Course not found'));
    if (!courseCheck.doctorId) {
      return next(
        new AppError(
          'This course has no assigned doctor. Please assign a doctor to the course first, or select a different course.',
          400
        )
      );
    }
    finalDoctorId = courseCheck.doctorId;
  } else {
    const doctor = await getDoctorOrFail(req, next);
    if (!doctor) return;
    finalDoctorId = doctor.id;
  }

  // Ensure course within scope
  const course = await prisma.course.findUnique({
    where: { id: parseInt(courseId as string) },
    include: { department: true },
  });
  if (!course) return next(new NotFoundError('Course not found'));
  const courseScope: any = getScopeWhere(req.user!, 'course');
  if (courseScope && Object.keys(courseScope).length) {
    if (courseScope.department && course.department?.collegeId !== courseScope.department.collegeId)
      return next(new AuthorizationError('Access denied'));
    if (courseScope.departmentId && course.departmentId !== courseScope.departmentId)
      return next(new AuthorizationError('Access denied'));
  }

  const quiz = await prisma.quiz.create({
    data: {
      title,
      description,
      courseId: parseInt(courseId as string),
      doctorId: finalDoctorId,
      duration: parseInt(duration as string),
      startTime: startTime ? new Date(startTime as string) : null,
      endTime: endTime ? new Date(endTime as string) : null,
      questions: {
        create: questions.map((q: any, idx: number) => ({
          type: q.type || 'MCQ',
          text: q.text,
          textAr: q.textAr,
          optionA: q.optionA,
          optionB: q.optionB,
          optionC: q.optionC,
          optionD: q.optionD,
          // support both legacy `correct` and new `correctAnswer`
          correctAnswer: q.correctAnswer || q.correct,
          correct: q.correct || q.correctAnswer,
          points: q.points || 1,
          orderIndex: q.orderIndex ?? idx,
          maxWords: q.maxWords,
          allowedFileTypes: q.allowedFileTypes,
        })),
      },
    },
    include: {
      questions: true,
      course: { select: { name: true, nameAr: true } },
    },
  });

  // Notify students
  await notifyStudentsInCourse({
    courseId: quiz.courseId,
    title: 'New Quiz Available',
    message: `A new quiz "${quiz.title}" is available in ${quiz.course.name}.`,
    type: 'QUIZ_PUBLISHED',
    link: '/quizzes',
  });

  res.status(201).json({ success: true, data: quiz });
});

// ─── GET QUIZZES ──────────────────────────────────────────────────────────────

export const getQuizzes = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { courseId } = req.query;
  const where: any = {};

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
        enrollments: { some: { studentId: student.id, status: 'ENROLLED' } },
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
      course: { select: { name: true, nameAr: true, courseCode: true } },
      doctor: { select: { firstName: true, lastName: true } },
      _count: { select: { submissions: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ success: true, data: quizzes });
});

// ─── GET QUIZ BY ID ───────────────────────────────────────────────────────────

export const getQuizById = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const quiz: any = await prisma.quiz.findUnique({
    where: { id: parseInt(req.params.id as string) },
    include: {
      questions: { orderBy: { orderIndex: 'asc' } },
      course: true,
      doctor: true,
    },
  });

  if (!quiz) return next(new NotFoundError('Quiz not found'));

  // If student, strip correct answers from questions not yet submitted
  if (req.user!.role === 'STUDENT') {
    const student: any = await prisma.student.findUnique({ where: { userId: req.user!.id } });
    const studentSubmission = await prisma.quizSubmission.findFirst({
      where: { quizId: quiz.id, studentId: student.id },
    });

    quiz.questions = quiz.questions.map((q: any) => {
      const { correct, correctAnswer, ...rest } = q;
      return studentSubmission ? q : rest; // Show correct answers only after submission
    });
    quiz.hasSubmitted = !!studentSubmission;
  }

  res.json({ success: true, data: quiz });
});

// ─── ADD QUESTION TO EXISTING QUIZ ───────────────────────────────────────────

/**
 * POST /api/quizzes/:id/questions
 * Roles: DOCTOR (own quiz), SUPER_ADMIN
 * Supports all 4 question types: MCQ, TRUE_FALSE, ESSAY, FILE_UPLOAD
 */
export const addQuestionToQuiz = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const quizId = parseInt(req.params.id as string);
    const quiz = await getQuizOrFail(quizId, next);
    if (!quiz) return;

    if (!isDoctorOwner(req, quiz)) {
      return next(new AuthorizationError('You do not own this quiz'));
    }

    const {
      type = 'MCQ',
      text,
      textAr,
      points,
      orderIndex,
      optionA,
      optionB,
      optionC,
      optionD,
      correctAnswer,
      maxWords,
      allowedFileTypes,
    } = req.body;

    // Validate question type
    const validTypes = ['MCQ', 'TRUE_FALSE', 'ESSAY', 'FILE_UPLOAD'];
    if (!validTypes.includes(type)) {
      return next(new AppError(`Invalid question type. Must be one of: ${validTypes.join(', ')}`, 400));
    }

    if (!text || !text.trim()) {
      return next(new AppError('Question text is required', 400));
    }

    // Type-specific validation
    if (type === 'MCQ') {
      if (!optionA || !optionB || !optionC || !optionD) {
        return next(new AppError('MCQ questions require all four options (A, B, C, D)', 400));
      }
      if (!correctAnswer || !['A', 'B', 'C', 'D'].includes(correctAnswer)) {
        return next(new AppError('MCQ correctAnswer must be one of: A, B, C, D', 400));
      }
    }

    if (type === 'TRUE_FALSE') {
      if (!correctAnswer || !['TRUE', 'FALSE'].includes(correctAnswer)) {
        return next(new AppError('TRUE_FALSE correctAnswer must be "TRUE" or "FALSE"', 400));
      }
    }

    // Determine order index: append to end if not specified
    const lastQuestion = await prisma.question.findFirst({
      where: { quizId },
      orderBy: { orderIndex: 'desc' },
      select: { orderIndex: true },
    });
    const nextOrderIndex = orderIndex ?? (lastQuestion ? lastQuestion.orderIndex + 1 : 0);

    const question = await prisma.question.create({
      data: {
        quizId,
        type,
        text,
        textAr,
        points: points ?? 1,
        orderIndex: nextOrderIndex,
        optionA,
        optionB,
        optionC,
        optionD,
        correctAnswer,
        correct: correctAnswer, // keep legacy field in sync
        maxWords,
        allowedFileTypes,
      },
    });

    res.status(201).json({ success: true, data: question });
  }
);

// ─── SUBMIT QUIZ ──────────────────────────────────────────────────────────────

/**
 * POST /api/quizzes/:id/submit
 * Roles: STUDENT only
 * Auto-grades MCQ and TRUE_FALSE. Marks ESSAY and FILE_UPLOAD as needsGrading.
 */
export const submitQuiz = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const { answers } = req.body as {
    answers: {
      questionId: number;
      selectedOption?: string;
      essayText?: string;
      fileUrl?: string;
    }[];
  };

  const student = await prisma.student.findUnique({ where: { userId: req.user!.id } });
  if (!student) return next(new AuthorizationError('Only students can submit quizzes'));

  const quiz: any = await prisma.quiz.findUnique({
    where: { id: parseInt(id as string) },
    include: {
      questions: { orderBy: { orderIndex: 'asc' } },
      course: { include: { department: true } },
    },
  });

  if (!quiz) return next(new NotFoundError('Quiz not found'));

  // Enforce scope on submission
  const courseScope2: any = getScopeWhere(req.user!, 'course');
  if (courseScope2 && Object.keys(courseScope2).length) {
    if (
      courseScope2.department &&
      quiz.course?.department?.collegeId !== courseScope2.department.collegeId
    )
      return next(new AuthorizationError('Access denied'));
    if (courseScope2.departmentId && quiz.course?.departmentId !== courseScope2.departmentId)
      return next(new AuthorizationError('Access denied'));
  }

  // Check if already submitted
  const existingSubmission = await prisma.quizSubmission.findFirst({
    where: { quizId: quiz.id, studentId: student.id },
  });
  if (existingSubmission) return next(new AppError('Already submitted', 400));

  const questionMap = new Map(quiz.questions.map((q: any) => [q.id, q]));

  // Determine if any question requires manual grading
  let autoScore = 0;
  let totalAutoPoints = 0;
  let requiresManualGrading = false;

  // Build per-question answer records
  const answerRecords: {
    questionId: number;
    selectedOption?: string;
    essayText?: string;
    fileUrl?: string;
    isCorrect?: boolean;
    score?: number;
    gradedAt?: Date;
  }[] = [];

  // Build legacy answers snapshot (questionId → selectedOption/text)
  const legacyAnswers: Record<number, string> = {};

  for (const a of answers) {
    const question: any = questionMap.get(a.questionId);
    if (!question) continue;

    const answerRecord: (typeof answerRecords)[number] = {
      questionId: a.questionId,
      selectedOption: a.selectedOption,
      essayText: a.essayText,
      fileUrl: a.fileUrl,
    };

    if (question.type === 'MCQ' || question.type === 'TRUE_FALSE') {
      // Auto-grade
      const correctAns = question.correctAnswer || question.correct;
      const isCorrect = a.selectedOption === correctAns;
      const score = isCorrect ? question.points : 0;
      answerRecord.isCorrect = isCorrect;
      answerRecord.score = score;
      answerRecord.gradedAt = new Date();
      autoScore += score;
      totalAutoPoints += question.points;
      legacyAnswers[a.questionId] = a.selectedOption || '';
    } else {
      // ESSAY or FILE_UPLOAD — needs manual grading
      requiresManualGrading = true;
      legacyAnswers[a.questionId] = a.essayText || a.fileUrl || '';
    }

    answerRecords.push(answerRecord);
  }

  // Calculate partial score (auto-graded portion only)
  const autoScorePercent =
    totalAutoPoints > 0 ? (autoScore / totalAutoPoints) * 100 : null;

  // Create submission
  const submission = await prisma.quizSubmission.create({
    data: {
      quizId: quiz.id,
      studentId: student.id,
      answers: legacyAnswers,
      score: requiresManualGrading ? null : autoScorePercent,
      needsGrading: requiresManualGrading,
      quizAnswers: {
        create: answerRecords,
      },
    },
    include: {
      quizAnswers: true,
    },
  });

  res.status(201).json({
    success: true,
    data: {
      ...submission,
      autoScore: autoScorePercent,
      needsGrading: requiresManualGrading,
      message: requiresManualGrading
        ? 'Quiz submitted. Some answers require manual grading by your doctor.'
        : 'Quiz submitted and graded successfully.',
    },
  });
});

// ─── GET QUIZ RESULTS ─────────────────────────────────────────────────────────

export const getQuizResults = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const quiz = await prisma.quiz.findUnique({
      where: { id: parseInt(id as string) },
      include: {
        submissions: {
          include: {
            student: true,
            quizAnswers: { include: { question: true } },
          },
        },
        course: { include: { department: true } },
      },
    });

    if (!quiz) return next(new NotFoundError('Quiz not found'));

    // Enforce scope for results
    const courseScope3: any = getScopeWhere(req.user!, 'course');
    if (courseScope3 && Object.keys(courseScope3).length) {
      if (
        courseScope3.department &&
        quiz.course?.department?.collegeId !== courseScope3.department.collegeId
      )
        return next(new AuthorizationError('Access denied'));
      if (courseScope3.departmentId && quiz.course?.departmentId !== courseScope3.departmentId)
        return next(new AuthorizationError('Access denied'));
    }

    res.json({ success: true, data: quiz.submissions });
  }
);

// ─── GRADE QUIZ SUBMISSION ────────────────────────────────────────────────────

/**
 * PUT /api/quizzes/:id/submissions/:submissionId/grade
 * Roles: DOCTOR (own quiz), SUPER_ADMIN
 * Allows doctor to assign score + feedback per question and an overall feedback.
 * Recalculates total score after grading.
 */
export const gradeQuizSubmission = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const quizId = parseInt(req.params.id as string);
    const submissionId = parseInt(req.params.submissionId as string);

    const quiz = await getQuizOrFail(quizId, next);
    if (!quiz) return;

    if (!isDoctorOwner(req, quiz)) {
      return next(new AuthorizationError('You do not own this quiz'));
    }

    const submission = await prisma.quizSubmission.findUnique({
      where: { id: submissionId },
      include: {
        quizAnswers: { include: { question: true } },
      },
    });

    if (!submission || submission.quizId !== quizId) {
      return next(new NotFoundError('Submission not found'));
    }

    const {
      grades, // Array: [{ questionId, score, feedback }]
      feedback, // Overall submission feedback
    } = req.body as {
      grades: { questionId: number; score: number; feedback?: string }[];
      feedback?: string;
    };

    if (!Array.isArray(grades) || grades.length === 0) {
      return next(new AppError('grades array is required', 400));
    }

    const now = new Date();

    // Update each answer that was graded
    const updateOps = grades.map((g) =>
      prisma.quizAnswer.updateMany({
        where: {
          submissionId,
          questionId: g.questionId,
        },
        data: {
          score: g.score,
          feedback: g.feedback,
          gradedAt: now,
        },
      })
    );

    await prisma.$transaction(updateOps);

    // Recalculate total score across ALL answers
    const allAnswers = await prisma.quizAnswer.findMany({
      where: { submissionId },
      include: { question: true },
    });

    const totalPoints = allAnswers.reduce((sum, a) => sum + a.question.points, 0);
    const earnedPoints = allAnswers.reduce((sum, a) => sum + (a.score ?? 0), 0);
    const totalScorePercent = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0;

    const updatedSubmission = await prisma.quizSubmission.update({
      where: { id: submissionId },
      data: {
        score: totalScorePercent,
        feedback,
        needsGrading: false,
        gradedAt: now,
      },
      include: {
        quizAnswers: {
          include: { question: true },
        },
        student: { select: { firstName: true, lastName: true, userId: true } },
      },
    });

    // Notify student
    if (updatedSubmission.student) {
      await createNotification({
        userId: updatedSubmission.student.userId,
        title: 'Quiz Graded',
        message: `Your quiz "${quiz.title}" has been graded. Score: ${totalScorePercent.toFixed(1)}%`,
        type: 'SUBMISSION_GRADED',
        link: '/quizzes',
      });
    }

    res.json({
      success: true,
      data: {
        ...updatedSubmission,
        totalScore: totalScorePercent,
        message: 'Submission graded successfully.',
      },
    });
  }
);
