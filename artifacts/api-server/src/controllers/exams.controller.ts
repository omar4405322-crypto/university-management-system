// FIXED: Exam fields align with DB (room, no title/location column) - schema sync
import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prismaClient';
import { auditLog } from '../utils/audit.utils';
import catchAsync from '../utils/catchAsync';
import { NotFoundError, AuthorizationError } from '../utils/appError';
import { getScopeWhere } from '../utils/scope.utils';

export const getAllExams = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { type, upcoming } = req.query;

  // Apply centralized scope
  const examScope: any = getScopeWhere(req.user!, 'exam');
  let where: any = {};
  if (examScope && Object.keys(examScope).length) {
    where = { ...where, ...examScope };
  }

  if (type) where.type = type;
  if (upcoming === 'true') {
    where.date = { gte: new Date() };
  }

  const exams = await prisma.exam.findMany({
    where,
    include: {
      course: {
        select: {
          name: true,
          courseCode: true,
        },
      },
    },
    orderBy: { date: 'asc' },
  });

  res.json({ success: true, data: exams });
});

export const getUpcomingExams = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    // Apply centralized scope
    const examScope: any = getScopeWhere(req.user!, 'exam');
    const exams = await prisma.exam.findMany({
      where: {
        ...(examScope && Object.keys(examScope).length ? examScope : {}),
        date: { gte: new Date() },
      },
      include: {
        course: {
          select: {
            name: true,
            courseCode: true,
          },
        },
      },
      orderBy: { date: 'asc' },
    });

    res.json({ success: true, data: exams });
  }
);

export const createExam = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { courseId, type, date, startTime, endTime, room, location } = req.body;

  // Check if course belongs to admin's scope
  const course = await prisma.course.findUnique({
    where: { id: parseInt(courseId as string) },
    include: { department: true },
  });

  if (!course) {
    return next(new NotFoundError('Course not found'));
  }

  // Enforce scope via helper
  const courseScope: any = getScopeWhere(req.user!, 'course');
  if (courseScope && Object.keys(courseScope).length) {
    if (
      courseScope.department &&
      course.department?.collegeId !== courseScope.department.collegeId
    ) {
      return next(new AuthorizationError('Access denied'));
    }
    if (courseScope.departmentId && course.departmentId !== courseScope.departmentId) {
      return next(new AuthorizationError('Access denied'));
    }
  }

  const exam = await prisma.exam.create({
    data: {
      courseId: parseInt(courseId as string),
      type: type || 'MIDTERM',
      date: new Date(date as string),
      startTime,
      endTime,
      room: room || location || 'TBA',
    },
    include: {
      course: {
        select: {
          name: true,
          courseCode: true,
        },
      },
    },
  });

  res.status(201).json({ success: true, data: exam });
});

export const updateExam = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { type, date, startTime, endTime, room } = req.body;
  const id = parseInt(req.params.id as string);

  const exam = await prisma.exam.findUnique({
    where: { id },
    include: { course: { include: { department: true } } },
  });

  if (!exam) {
    return next(new NotFoundError('Exam not found'));
  }

  // Enforce scope via helper
  const examCourseScope: any = getScopeWhere(req.user!, 'course');
  if (examCourseScope && Object.keys(examCourseScope).length) {
    if (
      examCourseScope.department &&
      exam.course?.department?.collegeId !== examCourseScope.department.collegeId
    )
      return next(new AuthorizationError('Access denied'));
    if (examCourseScope.departmentId && exam.course?.departmentId !== examCourseScope.departmentId)
      return next(new AuthorizationError('Access denied'));
  }

  const updatedExam = await prisma.exam.update({
    where: { id },
    data: {
      type,
      date: date ? new Date(date as string) : undefined,
      startTime,
      endTime,
      room,
    },
  });

  res.json({ success: true, data: updatedExam });
});

export const deleteExam = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const id = parseInt(req.params.id as string);
  const exam = await prisma.exam.findUnique({
    where: { id },
    include: { course: { include: { department: true } } },
  });

  if (!exam) {
    return next(new NotFoundError('Exam not found'));
  }

  // Enforce scope via helper
  const examCourseScope: any = getScopeWhere(req.user!, 'course');
  if (examCourseScope && Object.keys(examCourseScope).length) {
    if (
      examCourseScope.department &&
      exam.course?.department?.collegeId !== examCourseScope.department.collegeId
    )
      return next(new AuthorizationError('Access denied'));
    if (examCourseScope.departmentId && exam.course?.departmentId !== examCourseScope.departmentId)
      return next(new AuthorizationError('Access denied'));
  }

  await prisma.exam.delete({
    where: { id },
  });
  auditLog('DELETE_EXAM', 'Exam', req.params.id as string, req);
  res.json({ success: true, message: 'Exam deleted' });
});

export const getExamById = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const id = parseInt(req.params.id as string);
  const exam: any = await prisma.exam.findUnique({
    where: { id },
    include: {
      course: {
        select: {
          name: true,
          courseCode: true,
          department: {
            select: {
              name: true,
              college: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  if (!exam) {
    return next(new NotFoundError('Exam not found'));
  }

  // Enforce scope on read
  const courseScope: any = getScopeWhere(req.user!, 'course');
  if (courseScope && Object.keys(courseScope).length) {
    if (
      courseScope.department &&
      exam.course?.department?.collegeId !== courseScope.department.collegeId
    ) {
      return next(new AuthorizationError('Access denied'));
    }
    if (courseScope.departmentId && exam.course?.departmentId !== courseScope.departmentId) {
      return next(new AuthorizationError('Access denied'));
    }
  }

  res.json({ success: true, data: exam });
});


// --- EXAM QUESTIONS ---

export const getExamQuestions = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const examId = parseInt(req.params.id as string);
  const exam = await prisma.exam.findUnique({ where: { id: examId } });
  if (!exam) return next(new NotFoundError('Exam not found'));

  const questions = await prisma.examQuestion.findMany({
    where: { examId },
    orderBy: { order: 'asc' },
  });

  // If user is STUDENT, strip the correctAnswer
  if (req.user?.role === 'STUDENT') {
    const stripped = questions.map((q: any) => {
      const { correctAnswer, ...rest } = q;
      return rest;
    });
    return res.json({ success: true, data: stripped });
  }

  res.json({ success: true, data: questions });
});

export const addExamQuestion = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const examId = parseInt(req.params.id as string);
  const { text, type, optionA, optionB, optionC, optionD, correctAnswer, points, order } = req.body;

  const exam = await prisma.exam.findUnique({ where: { id: examId } });
  if (!exam) return next(new NotFoundError('Exam not found'));

  const question = await prisma.examQuestion.create({
    data: {
      examId, text, type, optionA, optionB, optionC, optionD, correctAnswer, points: points || 1, order: order || 1
    }
  });

  res.status(201).json({ success: true, data: question });
});

export const updateExamQuestion = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const questionId = parseInt(req.params.questionId as string);
  const { text, type, optionA, optionB, optionC, optionD, correctAnswer, points, order } = req.body;

  const question = await prisma.examQuestion.findUnique({ where: { id: questionId } });
  if (!question) return next(new NotFoundError('Question not found'));

  const updated = await prisma.examQuestion.update({
    where: { id: questionId },
    data: { text, type, optionA, optionB, optionC, optionD, correctAnswer, points, order }
  });

  res.json({ success: true, data: updated });
});

export const deleteExamQuestion = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const questionId = parseInt(req.params.questionId as string);
  const question = await prisma.examQuestion.findUnique({ where: { id: questionId } });
  if (!question) return next(new NotFoundError('Question not found'));

  await prisma.examQuestion.delete({ where: { id: questionId } });
  res.json({ success: true, message: 'Question deleted' });
});

// --- EXAM SESSIONS & SUBMISSIONS ---

export const startExamSession = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const examId = parseInt(req.params.id as string);
  const student = await prisma.student.findUnique({ where: { userId: req.user!.id } });
  if (!student) return next(new AuthorizationError('Only students can start exams'));

  const exam = await prisma.exam.findUnique({ where: { id: examId } });
  if (!exam) return next(new NotFoundError('Exam not found'));

  // Check if submission already exists
  let submission = await prisma.examSubmission.findUnique({
    where: { examId_studentId: { examId, studentId: student.id } }
  });

  if (submission && submission.status !== 'PENDING') {
    return next(new AuthorizationError('You have already completed this exam'));
  }

  if (!submission) {
    submission = await prisma.examSubmission.create({
      data: {
        examId,
        studentId: student.id,
        answers: [],
        status: 'PENDING',
      }
    });
  }

  res.status(201).json({ success: true, data: submission });
});

export const submitExam = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const examId = parseInt(req.params.id as string);
  const { answers, antiCheatLogs } = req.body;
  
  const student = await prisma.student.findUnique({ where: { userId: req.user!.id } });
  if (!student) return next(new AuthorizationError('Only students can submit exams'));

  let submission = await prisma.examSubmission.findUnique({
    where: { examId_studentId: { examId, studentId: student.id } }
  });

  if (!submission) {
    return next(new NotFoundError('No active exam session found. Please start the exam first.'));
  }

  if (submission.status !== 'PENDING') {
    return next(new AuthorizationError('Exam already submitted'));
  }

  const questions = await prisma.examQuestion.findMany({ where: { examId } });
  let score = 0;
  let maxScore = 0;
  let allAutoGradeable = true;

  // answers format: { questionId: string, answer: string }[] OR { [questionId]: string }
  // depending on frontend. Let's support object map:
  const answersMap: Record<string, string> = Array.isArray(answers) 
    ? answers.reduce((acc: any, curr: any) => ({ ...acc, [curr.questionId]: curr.answer }), {})
    : answers || {};

  questions.forEach((q: any) => {
    maxScore += q.points;
    if (q.type === 'SHORT_ANSWER') {
      allAutoGradeable = false;
    } else {
      const studentAnswer = answersMap[q.id.toString()];
      if (studentAnswer && studentAnswer.toString().toUpperCase() === q.correctAnswer.toUpperCase()) {
        score += q.points;
      }
    }
  });

  const updatedSubmission = await prisma.examSubmission.update({
    where: { id: submission.id },
    data: {
      answers: answersMap,
      score: allAutoGradeable ? score : null, // If there's short answer, score is pending manual review
      maxScore,
      status: allAutoGradeable ? 'GRADED' : 'PENDING',
      submittedAt: new Date(),
      antiCheatLogs: antiCheatLogs || []
    }
  });

  // Handle violations if any
  if (Array.isArray(antiCheatLogs) && antiCheatLogs.length > 0) {
    const violationRecords = antiCheatLogs.map((log: any) => ({
      submissionId: updatedSubmission.id,
      type: log.type,
      details: log.details || null,
      occurredAt: log.occurredAt ? new Date(log.occurredAt) : new Date()
    }));
    await prisma.examViolation.createMany({ data: violationRecords });
  }

  res.json({ success: true, data: updatedSubmission });
});

export const getExamSubmissions = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const examId = parseInt(req.params.id as string);
  
  const submissions = await prisma.examSubmission.findMany({
    where: { examId },
    include: {
      student: {
        include: { user: { select: { email: true } } }
      },
      violations: true
    },
    orderBy: { submittedAt: 'desc' }
  });

  res.json({ success: true, data: submissions });
});

export const getMyExamSubmission = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const examId = parseInt(req.params.id as string);
  const student = await prisma.student.findUnique({ where: { userId: req.user!.id } });
  if (!student) return next(new AuthorizationError('Access denied'));

  const submission = await prisma.examSubmission.findUnique({
    where: { examId_studentId: { examId, studentId: student.id } },
    include: { violations: true }
  });

  if (!submission) return next(new NotFoundError('Submission not found'));

  res.json({ success: true, data: submission });
});
