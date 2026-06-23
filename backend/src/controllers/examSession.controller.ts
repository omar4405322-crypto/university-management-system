import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prismaClient';
import catchAsync from '../utils/catchAsync';
import { AppError, NotFoundError, AuthorizationError } from '../utils/appError';
import { getScopeWhere } from '../utils/scope.utils';
import { notifyStudentsInCourse, createNotification } from '../utils/notification.utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Status ordering for transition validation */
const STATUS_ORDER = ['DRAFT', 'PUBLISHED', 'ACTIVE', 'CLOSED', 'GRADED'] as const;
type ExamStatus = (typeof STATUS_ORDER)[number];

function statusRank(s: string): number {
  return STATUS_ORDER.indexOf(s as ExamStatus);
}

/** Fetch an ExamSession and verify the caller is its owner (for DOCTOR role) */
async function getSessionOrFail(id: number, next: NextFunction) {
  const session = await prisma.examSession.findUnique({
    where: { id },
    include: {
      course: { include: { department: true } },
    },
  });
  if (!session) {
    next(new NotFoundError('Exam session not found'));
    return null;
  }
  return session;
}

function isDoctorOwner(req: Request, session: { doctorId: number }): boolean {
  return req.user!.doctor?.id === session.doctorId;
}

// ─── DOCTOR / ADMIN ACTIONS ───────────────────────────────────────────────────

/**
 * POST /api/exam-sessions
 * Roles: DOCTOR, DEPARTMENT_ADMIN, SUPER_ADMIN
 */
export const createExamSession = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const {
    examId,
    title,
    instructions,
    durationMinutes,
    totalPoints,
    passingScore,
    shuffleQuestions,
    showResultsAfter,
    allowedAttempts,
    opensAt,
    closesAt,
  } = req.body;

  // Fetch linked Exam with its course and doctor info
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: { course: { include: { doctor: true } } },
  });
  if (!exam) return next(new NotFoundError('Exam not found'));
  if (!exam.course.doctorId) {
    return next(new AppError('This course has no assigned doctor', 400));
  }

  let doctorId: number;

  if (req.user!.role === 'DOCTOR') {
    if (!req.user!.doctor) return next(new AuthorizationError('Doctor profile not found'));
    // Ensure this doctor owns the course
    if (exam.course.doctorId !== req.user!.doctor.id) {
      return next(new AuthorizationError('You do not own this course'));
    }
    doctorId = req.user!.doctor.id;
  } else {
    // SUPER_ADMIN / DEPARTMENT_ADMIN — use course's assigned doctor
    doctorId = exam.course.doctorId;
  }

  // Check unique: one ExamSession per Exam
  const existing = await prisma.examSession.findUnique({ where: { examId } });
  if (existing) {
    return next(new AppError('An exam session already exists for this exam schedule entry', 409));
  }

  const session = await prisma.examSession.create({
    data: {
      examId,
      courseId: exam.courseId,
      doctorId,
      title,
      instructions,
      durationMinutes,
      totalPoints: totalPoints ?? 100,
      passingScore: passingScore ?? 50,
      shuffleQuestions: shuffleQuestions ?? false,
      showResultsAfter: showResultsAfter ?? true,
      allowedAttempts: allowedAttempts ?? 1,
      opensAt: opensAt ? new Date(opensAt) : undefined,
      closesAt: closesAt ? new Date(closesAt) : undefined,
      status: 'DRAFT',
    },
    include: {
      exam: { select: { date: true, type: true, room: true } },
      course: { select: { name: true, courseCode: true } },
      doctor: { select: { firstName: true, lastName: true } },
    },
  });

  res.status(201).json({ success: true, data: session });
});

/**
 * GET /api/exam-sessions
 * Roles: All (scoped)
 */
export const getExamSessions = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { courseId } = req.query;
  const where: any = {};

  if (courseId) where.courseId = parseInt(courseId as string);

  const role = req.user!.role;

  if (role === 'DOCTOR') {
    if (!req.user!.doctor) return next(new AuthorizationError('Doctor profile not found'));
    where.doctorId = req.user!.doctor.id;
  } else if (role === 'STUDENT') {
    where.status = { in: ['PUBLISHED', 'ACTIVE', 'CLOSED', 'GRADED'] };
    where.course = {
      enrollments: {
        some: {
          studentId: req.user.student!.id,
          status: 'ENROLLED'
        }
      }
    };
  } else {
    // Admin roles — apply scope
    const scopeWhere: any = getScopeWhere(req.user!, 'course');
    if (scopeWhere && Object.keys(scopeWhere).length) {
      if (scopeWhere.department) where.course = { department: scopeWhere.department };
      else if (scopeWhere.departmentId) where.course = { departmentId: scopeWhere.departmentId };
    }
  }

  const sessions = await prisma.examSession.findMany({
    where,
    include: {
      exam: { select: { date: true, type: true, room: true, startTime: true, endTime: true } },
      course: { select: { name: true, courseCode: true } },
      doctor: { select: { firstName: true, lastName: true } },
      _count: { select: { questions: true, submissions: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ success: true, data: sessions });
});

/**
 * GET /api/exam-sessions/:id
 * Roles: All (scoped)
 */
export const getExamSession = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const id = parseInt(req.params.id as string);
  const role = req.user!.role;
  const isPrivileged =
    role === 'DOCTOR' || role === 'SUPER_ADMIN' || role === 'ADMIN' ||
    role === 'COLLEGE_ADMIN' || role === 'DEPARTMENT_ADMIN';

  const session = await prisma.examSession.findUnique({
    where: { id },
    include: {
      exam: { select: { date: true, type: true, room: true, startTime: true, endTime: true } },
      course: { select: { name: true, courseCode: true, departmentId: true } },
      doctor: { select: { firstName: true, lastName: true } },
      questions: {
        orderBy: { orderIndex: 'asc' },
        select: {
          id: true,
          type: true,
          text: true,
          textAr: true,
          points: true,
          orderIndex: true,
          optionA: true,
          optionB: true,
          optionC: true,
          optionD: true,
          correctAnswer: isPrivileged,  // hide from students
          maxWords: true,
          allowedFileTypes: true,
        },
      },
      _count: { select: { questions: true, submissions: true } },
    },
  });

  if (!session) return next(new NotFoundError('Exam session not found'));

  // Students can only see non-DRAFT sessions
  if (role === 'STUDENT' && session.status === 'DRAFT') {
    return next(new NotFoundError('Exam session not found'));
  }

  res.json({ success: true, data: session });
});

/**
 * PUT /api/exam-sessions/:id
 * Roles: DOCTOR (own only), SUPER_ADMIN
 */
export const updateExamSession = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const id = parseInt(req.params.id as string);
  const session = await getSessionOrFail(id, next);
  if (!session) return;

  // Ownership check for DOCTOR
  if (req.user!.role === 'DOCTOR' && !isDoctorOwner(req, session)) {
    return next(new AuthorizationError('You do not own this exam session'));
  }

  // Cannot update locked sessions
  if (['ACTIVE', 'CLOSED', 'GRADED'].includes(session.status)) {
    return next(new AppError(`Cannot update a session with status "${session.status}"`, 400));
  }

  const { opensAt, closesAt, ...rest } = req.body;

  const updated = await prisma.examSession.update({
    where: { id },
    data: {
      ...rest,
      ...(opensAt !== undefined ? { opensAt: opensAt ? new Date(opensAt) : null } : {}),
      ...(closesAt !== undefined ? { closesAt: closesAt ? new Date(closesAt) : null } : {}),
    },
  });

  res.json({ success: true, data: updated });
});

/**
 * DELETE /api/exam-sessions/:id
 * Roles: DOCTOR (own only), SUPER_ADMIN
 */
export const deleteExamSession = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const id = parseInt(req.params.id as string);
  const session = await getSessionOrFail(id, next);
  if (!session) return;

  if (req.user!.role === 'DOCTOR' && !isDoctorOwner(req, session)) {
    return next(new AuthorizationError('You do not own this exam session'));
  }

  const activeSubmissions = await prisma.examSubmission.count({
    where: {
      examSessionId: Number(id),
      status: { in: ['SUBMITTED', 'GRADED'] }
    }
  });
  if (activeSubmissions > 0) {
    return next(new AppError('Cannot delete a session that has submitted or graded work', 400));
  }

  await prisma.examSession.delete({ where: { id } });
  res.json({ success: true, message: 'Exam session deleted' });
});

/**
 * PUT /api/exam-sessions/:id/status
 * Roles: DOCTOR (own only), SUPER_ADMIN
 * Enforces forward-only status transitions
 */
export const updateExamSessionStatus = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const id = parseInt(req.params.id as string);
  const { status: newStatus } = req.body;

  if (!newStatus) return next(new AppError('status is required', 400));

  const session = await getSessionOrFail(id, next);
  if (!session) return;

  if (req.user!.role === 'DOCTOR' && !isDoctorOwner(req, session)) {
    return next(new AuthorizationError('You do not own this exam session'));
  }

  const currentRank = statusRank(session.status);
  const newRank = statusRank(newStatus);

  if (newRank === -1) return next(new AppError('Invalid status value', 400));
  if (newRank <= currentRank) {
    return next(new AppError(`Cannot transition from "${session.status}" to "${newStatus}". Status can only move forward.`, 400));
  }

  // Extra validation when activating
  if (newStatus === 'ACTIVE') {
    const questionCount = await prisma.examQuestion.count({ where: { examSessionId: id } });
    if (questionCount === 0) {
      return next(new AppError('Cannot activate a session with no questions', 400));
    }
    if (!session.opensAt) {
      return next(new AppError('opensAt must be set before activating the session', 400));
    }
  }

  const updated = await prisma.examSession.update({
    where: { id },
    data: { status: newStatus },
  });

  // Notify students when published
  if (newStatus === 'PUBLISHED') {
    const course = await prisma.course.findUnique({ where: { id: session.courseId }, select: { name: true } });
    await notifyStudentsInCourse({
      courseId: session.courseId,
      title: 'New Exam Available',
      message: `"${session.title}" has been published in ${course?.name || 'your course'}.`,
      type: 'EXAM_PUBLISHED',
      link: `/exam-sessions/${session.id}`,
    });
  }

  res.json({ success: true, data: updated });
});

// ─── QUESTION MANAGEMENT ──────────────────────────────────────────────────────

/**
 * POST /api/exam-sessions/:id/questions
 * Roles: DOCTOR (own session only), SUPER_ADMIN
 */
export const addQuestion = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const sessionId = parseInt(req.params.id as string);
  const session = await getSessionOrFail(sessionId, next);
  if (!session) return;

  if (req.user!.role === 'DOCTOR' && !isDoctorOwner(req, session)) {
    return next(new AuthorizationError('You do not own this exam session'));
  }

  if (!['DRAFT', 'PUBLISHED'].includes(session.status)) {
    return next(new AppError('Cannot add questions to a session that is not in DRAFT or PUBLISHED status', 400));
  }

  const { type, text, textAr, points, orderIndex, optionA, optionB, optionC, optionD, correctAnswer, maxWords, allowedFileTypes } = req.body;

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

  const question = await prisma.examQuestion.create({
    data: {
      examSessionId: sessionId,
      type,
      text,
      textAr,
      points: points ?? 1,
      orderIndex: orderIndex ?? 0,
      optionA,
      optionB,
      optionC,
      optionD,
      correctAnswer,
      maxWords,
      allowedFileTypes,
    },
  });

  res.status(201).json({ success: true, data: question });
});

/**
 * PUT /api/exam-sessions/:id/questions/:questionId
 * Roles: DOCTOR (own only), SUPER_ADMIN
 */
export const updateQuestion = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const sessionId = parseInt(req.params.id as string);
  const questionId = parseInt(req.params.questionId as string);

  const session = await getSessionOrFail(sessionId, next);
  if (!session) return;

  if (req.user!.role === 'DOCTOR' && !isDoctorOwner(req, session)) {
    return next(new AuthorizationError('You do not own this exam session'));
  }

  const question = await prisma.examQuestion.findFirst({
    where: { id: questionId, examSessionId: sessionId },
  });
  if (!question) return next(new NotFoundError('Question not found'));

  const updated = await prisma.examQuestion.update({
    where: { id: questionId },
    data: req.body,
  });

  res.json({ success: true, data: updated });
});

/**
 * DELETE /api/exam-sessions/:id/questions/:questionId
 * Roles: DOCTOR (own only), SUPER_ADMIN
 */
export const deleteQuestion = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const sessionId = parseInt(req.params.id as string);
  const questionId = parseInt(req.params.questionId as string);

  const session = await getSessionOrFail(sessionId, next);
  if (!session) return;

  if (req.user!.role === 'DOCTOR' && !isDoctorOwner(req, session)) {
    return next(new AuthorizationError('You do not own this exam session'));
  }

  if (session.status === 'ACTIVE') {
    return next(new AppError('Cannot delete questions from an ACTIVE session', 400));
  }

  const question = await prisma.examQuestion.findFirst({
    where: { id: questionId, examSessionId: sessionId },
  });
  if (!question) return next(new NotFoundError('Question not found'));

  await prisma.examQuestion.delete({ where: { id: questionId } });
  res.json({ success: true, message: 'Question deleted' });
});

// ─── STUDENT ACTIONS ──────────────────────────────────────────────────────────

/**
 * POST /api/exam-sessions/:id/start
 * Roles: STUDENT only
 */
export const startExam = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const sessionId = parseInt(req.params.id as string);

  const student = await prisma.student.findUnique({ where: { userId: req.user!.id } });
  if (!student) return next(new AuthorizationError('Student profile not found'));

  const session = await prisma.examSession.findUnique({
    where: { id: sessionId },
    include: {
      questions: {
        orderBy: { orderIndex: 'asc' },
        select: {
          id: true,
          type: true,
          text: true,
          textAr: true,
          points: true,
          orderIndex: true,
          optionA: true,
          optionB: true,
          optionC: true,
          optionD: true,
          // correctAnswer intentionally excluded
          maxWords: true,
          allowedFileTypes: true,
        },
      },
    },
  });

  if (!session) return next(new NotFoundError('Exam session not found'));
  if (session.status !== 'ACTIVE') {
    return next(new AppError('This exam session is not currently active', 400));
  }

  const now = new Date();
  if (session.opensAt && now < new Date(session.opensAt)) {
    return next(new AppError('Exam has not opened yet', 400));
  }
  if (session.closesAt && now > new Date(session.closesAt)) {
    return next(new AppError('Exam window has closed', 400));
  }

  // Check enrollment
  const enrollment = await prisma.enrollment.findFirst({
    where: { studentId: student.id, courseId: session.courseId, status: 'ENROLLED' },
  });
  if (!enrollment) {
    return next(new AuthorizationError('You are not enrolled in this course'));
  }

  // Check if already submitted
  const existing = await prisma.examSubmission.findUnique({
    where: { examSessionId_studentId: { examSessionId: sessionId, studentId: student.id } },
  });
  if (existing && existing.status !== 'IN_PROGRESS') {
    return next(new AppError('You have already submitted this exam', 400));
  }

  // Create or return existing IN_PROGRESS submission
  const submission =
    existing ??
    (await prisma.examSubmission.create({
      data: {
        examSessionId: sessionId,
        studentId: student.id,
        status: 'IN_PROGRESS',
        startedAt: now,
      },
    }));

  // Shuffle questions if required
  let questions = session.questions;
  if (session.shuffleQuestions) {
    questions = [...questions].sort(() => Math.random() - 0.5);
  }

  // Calculate remaining time
  const elapsed = Math.floor((now.getTime() - submission.startedAt.getTime()) / 1000);
  const totalSeconds = session.durationMinutes * 60;
  const timeRemainingSeconds = Math.max(0, totalSeconds - elapsed);

  res.status(201).json({
    success: true,
    data: { submission, questions, timeRemainingSeconds },
  });
});

/**
 * POST /api/exam-sessions/:id/submit
 * Roles: STUDENT only
 */
export const submitExam = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const sessionId = parseInt(req.params.id as string);
  const { answers } = req.body as {
    answers: { questionId: number; selectedOption?: string; essayText?: string }[];
  };

  const student = await prisma.student.findUnique({ where: { userId: req.user!.id } });
  if (!student) return next(new AuthorizationError('Student profile not found'));

  const submission = await prisma.examSubmission.findUnique({
    where: { examSessionId_studentId: { examSessionId: sessionId, studentId: student.id } },
  });
  if (!submission) {
    return next(new AppError('You have not started this exam yet. Call /start first.', 400));
  }
  if (submission.status !== 'IN_PROGRESS') {
    return next(new AppError('This exam has already been submitted', 400));
  }

  // Fetch all questions with correct answers for auto-grading
  const questions = await prisma.examQuestion.findMany({
    where: { examSessionId: sessionId },
  });

  const questionMap = new Map(questions.map((q) => [q.id, q]));

  // Upsert each answer and auto-grade MCQ / TRUE_FALSE
  let autoScore = 0;
  let autoGradedPoints = 0;
  let totalAutoGradeable = 0;

  const answerOps = answers.map((a) => {
    const question = questionMap.get(a.questionId);
    if (!question) return null;

    let isCorrect: boolean | undefined;
    let score: number | undefined;

    if (question.type === 'MCQ' || question.type === 'TRUE_FALSE') {
      totalAutoGradeable += question.points;
      isCorrect = a.selectedOption === question.correctAnswer;
      score = isCorrect ? question.points : 0;
      autoScore += score;
      autoGradedPoints += question.points;
    }

    return prisma.examAnswer.upsert({
      where: { submissionId_questionId: { submissionId: submission.id, questionId: a.questionId } },
      create: {
        submissionId: submission.id,
        questionId: a.questionId,
        selectedOption: a.selectedOption,
        essayText: a.essayText,
        isCorrect,
        score,
        gradedAt: isCorrect !== undefined ? new Date() : undefined,
      },
      update: {
        selectedOption: a.selectedOption,
        essayText: a.essayText,
        isCorrect,
        score,
        gradedAt: isCorrect !== undefined ? new Date() : undefined,
      },
    });
  });

  const gradedAnswers = await Promise.all(answerOps.filter(Boolean));

  const session = await prisma.examSession.findUnique({
    where: { id: sessionId },
    include: { questions: true }
  });
  if (!session) return next(new NotFoundError('Exam session not found'));

  const isLate = session.closesAt && new Date() > new Date(session.closesAt);

  const allAutoGradeable = session.questions.every(
    q => q.type === 'MCQ' || q.type === 'TRUE_FALSE'
  );
  const hasManualQuestions = !allAutoGradeable;

  const finalStatus = isLate ? 'LATE' : allAutoGradeable ? 'GRADED' : 'SUBMITTED';
  const totalScore = allAutoGradeable
    ? (gradedAnswers.filter(Boolean) as any[]).reduce((sum, a) => sum + (a.score ?? 0), 0)
    : null;

  const updatedSubmission = await prisma.examSubmission.update({
    where: { id: submission.id },
    data: {
      status: finalStatus,
      submittedAt: new Date(),
      totalScore: totalScore ?? undefined,
    },
    include: {
      answers: true,
    }
  });

  res.json({
    success: true,
    data: {
      submission: updatedSubmission,
      autoScore,
      totalAutoGradedPoints: autoGradedPoints,
      requiresManualGrading: hasManualQuestions,
      message: hasManualQuestions
        ? 'Exam submitted. Some answers require manual grading by your doctor.'
        : 'Exam submitted and auto-graded successfully.',
    },
  });
});

/**
 * GET /api/exam-sessions/:id/my-result
 * Roles: STUDENT only
 */
export const getMyResult = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const sessionId = parseInt(req.params.id as string);

  const student = await prisma.student.findUnique({ where: { userId: req.user!.id } });
  if (!student) return next(new AuthorizationError('Student profile not found'));

  const session = await prisma.examSession.findUnique({ where: { id: sessionId } });
  if (!session) return next(new NotFoundError('Exam session not found'));

  const submission = await prisma.examSubmission.findUnique({
    where: { examSessionId_studentId: { examSessionId: sessionId, studentId: student.id } },
    include: {
      examSession: true,
      answers: {
        include: {
          question: {
            select: {
              id: true,
              type: true,
              text: true,
              textAr: true,
              points: true,
              optionA: true,
              optionB: true,
              optionC: true,
              optionD: true,
              correctAnswer: true, // show correct answer in results
            },
          },
        },
      },
    },
  });

  if (!submission) return next(new AppError('You have not taken this exam', 404));

  res.json({ success: true, data: submission });
});

// ─── GRADING ──────────────────────────────────────────────────────────────────

/**
 * GET /api/exam-sessions/:id/submissions
 * Roles: DOCTOR (own session), SUPER_ADMIN, DEPARTMENT_ADMIN
 */
export const getSubmissions = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const sessionId = parseInt(req.params.id as string);
  const session = await getSessionOrFail(sessionId, next);
  if (!session) return;

  if (req.user!.role === 'DOCTOR' && !isDoctorOwner(req, session)) {
    return next(new AuthorizationError('You do not own this exam session'));
  }

  const submissions = await prisma.examSubmission.findMany({
    where: { examSessionId: sessionId },
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          studentId: true,
          user: { select: { email: true, profilePicture: true } },
        },
      },
      answers: {
        include: {
          question: { select: { id: true, type: true, text: true, points: true } },
        },
        orderBy: { question: { orderIndex: 'asc' } },
      },
    },
    orderBy: { submittedAt: 'asc' },
  });

  res.json({ success: true, data: submissions });
});

/**
 * PUT /api/exam-sessions/:id/submissions/:submissionId/grade
 * Roles: DOCTOR (own session), SUPER_ADMIN
 */
export const gradeSubmission = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const sessionId = parseInt(req.params.id as string);
  const submissionId = parseInt(req.params.submissionId as string);
  const { feedback: overallFeedback, answers } = req.body as {
    feedback?: string;
    answers: { answerId: number; score: number; feedback?: string }[];
  };

  const session = await getSessionOrFail(sessionId, next);
  if (!session) return;

  if (req.user!.role === 'DOCTOR' && !isDoctorOwner(req, session)) {
    return next(new AuthorizationError('You do not own this exam session'));
  }

  const submission = await prisma.examSubmission.findUnique({
    where: { id: submissionId },
    include: { answers: true },
  });
  if (!submission || submission.examSessionId !== sessionId) {
    return next(new NotFoundError('Submission not found'));
  }

  const now = new Date();

  // Grade each specified answer
  await Promise.all(
    answers.map((a) =>
      prisma.examAnswer.update({
        where: { id: a.answerId },
        data: {
          score: a.score,
          feedback: a.feedback,
          gradedAt: now,
        },
      })
    )
  );

  // Recalculate total score from all answers
  const allAnswers = await prisma.examAnswer.findMany({
    where: { submissionId },
    select: { score: true },
  });
  const totalScore = allAnswers.reduce((sum, a) => sum + (a.score ?? 0), 0);

  const updatedSubmission = await prisma.examSubmission.update({
    where: { id: submissionId },
    data: {
      totalScore,
      status: 'GRADED',
      feedback: overallFeedback,
    },
    include: {
      answers: true,
      student: { select: { firstName: true, lastName: true, userId: true } },
    },
  });

  // Notify student
  if (updatedSubmission.student) {
    await createNotification({
      userId: updatedSubmission.student.userId,
      title: 'Exam Graded',
      message: `Your submission for "${session.title}" has been graded. Score: ${totalScore}/${session.totalPoints}`,
      type: 'SUBMISSION_GRADED',
      link: `/exam-sessions/${sessionId}/result`,
    });
  }

  res.json({ success: true, data: updatedSubmission });
});

// ─── FILE UPLOAD ──────────────────────────────────────────────────────────────

/**
 * POST /api/exam-sessions/:id/answers/:answerId/upload
 * Roles: STUDENT only
 */
export const uploadAnswerFile = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const answerId = parseInt(req.params.answerId as string);

  if (!req.file) return next(new AppError('No file uploaded', 400));

  const student = await prisma.student.findUnique({ where: { userId: req.user!.id } });
  if (!student) return next(new AuthorizationError('Student profile not found'));

  // Verify answer belongs to this student's submission
  const answer = await prisma.examAnswer.findUnique({
    where: { id: answerId },
    include: { submission: true },
  });
  if (!answer) return next(new NotFoundError('Answer not found'));
  if (answer.submission.studentId !== student.id) {
    return next(new AuthorizationError('This answer does not belong to you'));
  }

  const file = req.file as Express.Multer.File & { path?: string; secure_url?: string; public_id?: string };
  const fileUrl = (file as any).secure_url ?? (file as any).path ?? '';
  const fileKey = (file as any).public_id ?? file.filename ?? '';

  const updated = await prisma.examAnswer.update({
    where: { id: answerId },
    data: { fileUrl, fileKey },
  });

  res.json({ success: true, data: updated });
});

// ─── ANTI-CHEAT ───────────────────────────────────────────────────────────────

/**
 * POST /api/exam-sessions/:id/violations
 * Roles: STUDENT only
 * Called by frontend whenever a cheating violation is detected.
 */
export const reportViolation = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const sessionId = Number(req.params.id as string);
  const { type, metadata } = req.body;

  const student = await prisma.student.findUnique({ where: { userId: req.user!.id } });
  if (!student) return next(new AuthorizationError('Student profile not found'));

  // Find the student's IN_PROGRESS submission for this session
  const submission = await prisma.examSubmission.findFirst({
    where: {
      examSessionId: sessionId,
      studentId: student.id,
      status: 'IN_PROGRESS',
    },
  });

  if (!submission) {
    return next(new AppError('No active submission found', 404));
  }

  // Log the violation
  await prisma.examViolation.create({
    data: {
      submissionId: submission.id,
      type,
      metadata: metadata ?? {},
    },
  });

  // Increment violationCount on the submission
  await prisma.examSubmission.update({
    where: { id: submission.id },
    data: { violationCount: { increment: 1 } },
  });

  // Check latest count
  const updatedSubmission = await prisma.examSubmission.findUnique({
    where: { id: submission.id },
    select: { violationCount: true },
  });

  // Auto-submit if violations exceed threshold (5 violations = force submit)
  if (updatedSubmission!.violationCount >= 5) {
    await prisma.examSubmission.update({
      where: { id: submission.id },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
      },
    });
    return res.status(200).json({
      success: true,
      data: { autoSubmitted: true, message: 'Exam auto-submitted due to repeated violations' },
    });
  }

  return res.status(200).json({
    success: true,
    data: {
      autoSubmitted: false,
      violationCount: updatedSubmission!.violationCount,
      warningsRemaining: 5 - updatedSubmission!.violationCount,
    },
  });
});

/**
 * GET /api/exam-sessions/:id/submissions/:submissionId/violations
 * Roles: DOCTOR, SUPER_ADMIN, DEPARTMENT_ADMIN
 */
export const getSubmissionViolations = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const submissionId = Number(req.params.submissionId as string);

  const violations = await prisma.examViolation.findMany({
    where: { submissionId },
    orderBy: { detectedAt: 'asc' },
  });

  const summary = violations.reduce((acc, v) => {
    acc[v.type] = (acc[v.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return res.status(200).json({
    success: true,
    data: { violations, summary, total: violations.length },
  });
});

