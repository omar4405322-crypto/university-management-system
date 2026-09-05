import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prismaClient';
import { auditLog } from '../utils/audit.utils';
import catchAsync from '../utils/catchAsync';
import { NotFoundError, AuthorizationError, ValidationError } from '../utils/appError';
import { getScopeWhere } from '../utils/scope.utils';
import { sendToUser } from '../utils/socket';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

const CAIRO_TZ = 'Africa/Cairo';

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
  const { courseId, type, title, date, startTime, endTime, room, location } = req.body;

  // Check if course exists
  const course = await prisma.course.findUnique({
    where: { id: parseInt(courseId as string) },
    include: { department: true },
  });

  if (!course) {
    return next(new NotFoundError('Course not found'));
  }

  // ── Doctor ownership check: only allow exams for courses the doctor teaches ──
  if (req.user!.role === 'DOCTOR') {
    const doctor = await prisma.doctor.findUnique({
      where: { userId: req.user!.id },
    });
    if (!doctor) {
      return next(new AuthorizationError('Doctor profile not found'));
    }
    const teachesThisCourse = await prisma.scheduleSlot.findFirst({
      where: {
        doctorId: doctor.id,
        courseId: parseInt(courseId as string),
      },
    });
    if (!teachesThisCourse) {
      return next(new AuthorizationError('You can only create exams for courses you teach'));
    }
  }

  // Enforce scope via helper (for admins)
  if (req.user!.role !== 'DOCTOR') {
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
  }

  // Validate exam date is not in the past
  if (date) {
    const examDate = new Date(date as string);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const examDay = new Date(examDate);
    examDay.setHours(0, 0, 0, 0);
    if (isNaN(examDate.getTime()) || examDay.getTime() < today.getTime()) {
      return next(new ValidationError('Exam date cannot be in the past'));
    }
  }

  // Validate start time precedes end time
  if (startTime && endTime && String(startTime) >= String(endTime)) {
    return next(new ValidationError('Start time must be before end time'));
  }

  const exam = await prisma.exam.create({
    data: {
      courseId: parseInt(courseId as string),
      type: type || 'MIDTERM',
      title: title && String(title).trim() ? String(title).trim() : undefined,
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

  // Notify targeted students
  try {
    const targetStudents = await prisma.student.findMany({
      where: {
        OR: [
          { enrollments: { some: { courseId: parseInt(courseId as string) } } },
          ...(course.departmentId && course.year
            ? [{ departmentId: course.departmentId, year: course.year }]
            : []),
        ],
      },
      select: { userId: true },
    });

    const studentUserIds = Array.from(
      new Set(targetStudents.map((s) => s.userId).filter(Boolean))
    );

    if (studentUserIds.length > 0) {
      const examTypeTitle =
        type === 'FINAL'
          ? 'الامتحان النهائي'
          : type === 'MIDTERM'
          ? 'امتحان منتصف الفصل'
          : 'اختبار قصير';

      const notifTitle = `جدولة امتحان جديد: ${course.name}`;
      const notifMsg = `تم نشر وتخصيص ${examTypeTitle} لمادة (${course.name} - ${course.courseCode}) بتاريخ ${new Date(
        date as string
      ).toLocaleDateString('ar-EG')} بالقاعة/المكان (${room || location || 'TBA'}).`;

      // 1. Create DB Notifications
      await prisma.notification.createMany({
        data: studentUserIds.map((uId) => ({
          userId: uId,
          title: notifTitle,
          message: notifMsg,
          type: 'warning',
        })),
      });

      // 2. Broadcast via Socket.io
      studentUserIds.forEach((uId) => {
        try {
          sendToUser(uId, 'notification', {
            title: notifTitle,
            message: notifMsg,
            type: 'warning',
            createdAt: new Date(),
          });
        } catch (_err) {
          // ignore socket silent failure
        }
      });
    }
  } catch (notifErr) {
    console.error('Failed to dispatch exam notifications:', notifErr);
  }

  res.status(201).json({ success: true, data: exam });
});

export const updateExam = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { type, date, startTime, endTime, room } = req.body;
  const id = parseInt(req.params.id as string);

  const examScope: any = getScopeWhere(req.user!, 'exam');
  const exam = await prisma.exam.findFirst({
    where: {
      id,
      ...(examScope && Object.keys(examScope).length ? examScope : {}),
    },
  });

  if (!exam) {
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

  const examScope: any = getScopeWhere(req.user!, 'exam');
  const exam = await prisma.exam.findFirst({
    where: {
      id,
      ...(examScope && Object.keys(examScope).length ? examScope : {}),
    },
  });

  if (!exam) {
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
  const examScope = getScopeWhere(req.user!, 'exam');
  const exam: any = await prisma.exam.findFirst({
    where: { AND: [{ id }, examScope] },
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
      questions: {
        select: {
          id: true,
          points: true
        }
      }
    },
  });

  if (!exam) {
    return next(new NotFoundError('Exam not found'));
  }

  res.json({ success: true, data: exam });
});


// --- EXAM QUESTIONS ---

export function seededRandom(seed: number): () => number {
  let s = seed | 0;
  if (s === 0) s = 1;
  return () => {
    s ^= s << 13;
    s ^= s >> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

export function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getMcqOptionMapping(studentId: number, questionId: number, optionLetters: string[]): string[] {
  if (!optionLetters || optionLetters.length <= 1) return [...optionLetters];
  const seed = hashString(`${studentId}-${questionId}`);
  const rng = seededRandom(seed);
  const shuffled = [...optionLetters];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Shared helper to verify student eligibility, active enrollment, timing window, and submission status.
 */
async function verifyStudentExamAccess(
  exam: { id: number; courseId: number; date?: Date | null; startTime?: string | null; endTime?: string | null },
  studentId: number
): Promise<void> {
  // 1. Verify student enrollment eligibility
  const enrollment = await prisma.enrollment.findFirst({
    where: {
      studentId,
      courseId: exam.courseId,
    },
    orderBy: [{ academicYear: 'desc' }, { semester: 'desc' }, { id: 'desc' }],
  });

  if (!enrollment || enrollment.status !== 'ENROLLED') {
    if (enrollment?.status === 'BLOCKED') {
      throw new AuthorizationError(
        'عذراً، تم حظر تسجيلك في هذا المقرر بسبب تجاوز نسبة الغياب، ولا يمكنك دخول الامتحان. يرجى مراجعة إدارة الكلية.'
      );
    }
    throw new AuthorizationError(
      'عذراً، لا يمكنك دخول هذا الامتحان لأنك غير مسجل حالياً في هذا المقرر الدراسي.'
    );
  }

  // 2. Ensure exam is active based on date and time
  const now = new Date();

  if (exam.date) {
    // Check start time
    if (exam.startTime) {
      const [h, m] = String(exam.startTime).split(':').map(Number);
      if (!isNaN(h) && !isNaN(m)) {
        const zonedDate = toZonedTime(exam.date, CAIRO_TZ);
        zonedDate.setHours(h, m, 0, 0);
        const startDateTime = fromZonedTime(zonedDate, CAIRO_TZ);
        if (now.getTime() < startDateTime.getTime()) {
          throw new AuthorizationError('Exam has not started yet');
        }
      }
    }

    // Check end time
    if (exam.endTime) {
      const [h, m] = String(exam.endTime).split(':').map(Number);
      if (!isNaN(h) && !isNaN(m)) {
        const zonedDate = toZonedTime(exam.date, CAIRO_TZ);
        zonedDate.setHours(h, m, 0, 0);
        const endDateTime = fromZonedTime(zonedDate, CAIRO_TZ);
        if (now.getTime() > endDateTime.getTime()) {
          throw new AuthorizationError('Exam time has expired');
        }
      }
    }
  }

  // 3. Check if submission already exists and completed
  const submission = await prisma.examSubmission.findUnique({
    where: { examId_studentId: { examId: exam.id, studentId } },
  });

  if (submission && submission.status !== 'PENDING') {
    throw new AuthorizationError('You have already completed this exam');
  }
}

export const getExamQuestions = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const examId = parseInt(req.params.id as string, 10);

  let exam: { id: number; courseId: number; date?: Date | null; startTime?: string | null; endTime?: string | null } | null = null;

  // If user is STUDENT, check active enrollment and exam timing window
  if (req.user?.role === 'STUDENT') {
    const student = await prisma.student.findUnique({ where: { userId: req.user.id } });
    if (!student) {
      return next(new AuthorizationError('Access denied'));
    }

    exam = await prisma.exam.findUnique({ where: { id: examId } });
    if (!exam) return next(new NotFoundError('Exam not found'));

    await verifyStudentExamAccess(exam, student.id);

    const questions = await prisma.examQuestion.findMany({
      where: { examId },
      orderBy: { order: 'asc' },
    });

    const studentId = student.id;
    const processedQuestions = questions.map((q: any) => {
      const { correctAnswer, ...rest } = q;
      const qType = (q.type || '').toUpperCase().replace('-', '_');

      const availableLetters = ['A', 'B', 'C', 'D'].filter(
        (l) => q[`option${l}`] !== undefined && q[`option${l}`] !== null && String(q[`option${l}`]).trim().length > 0
      );

      const isMcq = qType === 'MCQ' || qType === 'MULTIPLE_CHOICE' || (!qType && availableLetters.length > 0);

      if (isMcq && availableLetters.length > 1) {
        const mapping = getMcqOptionMapping(studentId, q.id, availableLetters);
        const displayLetters = ['A', 'B', 'C', 'D'].slice(0, availableLetters.length);
        const shuffledOptions: Record<string, string | null> = {
          optionA: null,
          optionB: null,
          optionC: null,
          optionD: null,
        };

        displayLetters.forEach((dispLetter, idx) => {
          const origLetter = mapping[idx];
          shuffledOptions[`option${dispLetter}`] = q[`option${origLetter}`];
        });

        return {
          ...rest,
          ...shuffledOptions,
        };
      }

      return rest;
    });

    return res.json({ success: true, data: processedQuestions });
  }

  // Doctor / Admin: Enforce centralized exam scope check
  const examScope: any = getScopeWhere(req.user!, 'exam');
  exam = await prisma.exam.findFirst({
    where: {
      id: examId,
      ...(examScope && Object.keys(examScope).length ? examScope : {}),
    },
  });
  if (!exam) return next(new NotFoundError('Exam not found'));

  const questions = await prisma.examQuestion.findMany({
    where: { examId },
    orderBy: { order: 'asc' },
  });

  res.json({ success: true, data: questions });
});

export const addExamQuestion = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const examId = parseInt(req.params.id as string, 10);
  const { text, type, optionA, optionB, optionC, optionD, correctAnswer, points, order } = req.body;

  const examScope: any = getScopeWhere(req.user!, 'exam');
  const exam = await prisma.exam.findFirst({
    where: {
      id: examId,
      ...(examScope && Object.keys(examScope).length ? examScope : {}),
    },
  });
  if (!exam) return next(new AuthorizationError('Access denied'));

  const question = await prisma.examQuestion.create({
    data: {
      examId,
      text: String(text).trim(),
      type: type || 'MCQ',
      optionA: optionA !== undefined ? (optionA ? String(optionA).trim() : null) : null,
      optionB: optionB !== undefined ? (optionB ? String(optionB).trim() : null) : null,
      optionC: optionC !== undefined ? (optionC ? String(optionC).trim() : null) : null,
      optionD: optionD !== undefined ? (optionD ? String(optionD).trim() : null) : null,
      correctAnswer: String(correctAnswer).trim(),
      points: points !== undefined && points !== '' ? parseInt(String(points), 10) : 1,
      order: order !== undefined && order !== '' ? parseInt(String(order), 10) : 1,
    },
  });

  res.status(201).json({ success: true, data: question });
});

export const updateExamQuestion = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const questionId = parseInt(req.params.questionId as string, 10);
  const { text, type, optionA, optionB, optionC, optionD, correctAnswer, points, order } = req.body;

  const question = await prisma.examQuestion.findUnique({ where: { id: questionId } });
  if (!question) return next(new NotFoundError('Question not found'));

  const examScope: any = getScopeWhere(req.user!, 'exam');
  const exam = await prisma.exam.findFirst({
    where: {
      id: question.examId,
      ...(examScope && Object.keys(examScope).length ? examScope : {}),
    },
  });
  if (!exam) return next(new AuthorizationError('Access denied'));

  const data: {
    text?: string;
    type?: 'MCQ' | 'TRUE_FALSE' | 'SHORT_ANSWER';
    optionA?: string | null;
    optionB?: string | null;
    optionC?: string | null;
    optionD?: string | null;
    correctAnswer?: string;
    points?: number;
    order?: number;
  } = {};

  if (text !== undefined) data.text = String(text).trim();
  if (type !== undefined) data.type = type;
  if (optionA !== undefined) data.optionA = optionA ? String(optionA).trim() : null;
  if (optionB !== undefined) data.optionB = optionB ? String(optionB).trim() : null;
  if (optionC !== undefined) data.optionC = optionC ? String(optionC).trim() : null;
  if (optionD !== undefined) data.optionD = optionD ? String(optionD).trim() : null;
  if (correctAnswer !== undefined) data.correctAnswer = String(correctAnswer).trim();
  if (points !== undefined && points !== '') data.points = parseInt(String(points), 10);
  if (order !== undefined && order !== '') data.order = parseInt(String(order), 10);

  const updated = await prisma.examQuestion.update({
    where: { id: questionId },
    data,
  });

  res.json({ success: true, data: updated });
});

export const deleteExamQuestion = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const questionId = parseInt(req.params.questionId as string);
  const question = await prisma.examQuestion.findUnique({ where: { id: questionId } });
  if (!question) return next(new NotFoundError('Question not found'));

  const examScope: any = getScopeWhere(req.user!, 'exam');
  const exam = await prisma.exam.findFirst({
    where: {
      id: question.examId,
      ...(examScope && Object.keys(examScope).length ? examScope : {}),
    },
  });
  if (!exam) return next(new AuthorizationError('Access denied'));

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

  await verifyStudentExamAccess(exam, student.id);

  // Check if submission already exists
  let submission = await prisma.examSubmission.findUnique({
    where: { examId_studentId: { examId, studentId: student.id } }
  });

  if (submission && submission.status !== 'PENDING') {
    return next(new AuthorizationError('You have already completed this exam'));
  }

  if (!submission) {
    try {
      submission = await prisma.examSubmission.create({
        data: {
          examId,
          studentId: student.id,
          answers: [],
          status: 'PENDING',
        }
      });
    } catch (err: any) {
      if (err.code === 'P2002') {
        submission = await prisma.examSubmission.findUnique({
          where: { examId_studentId: { examId, studentId: student.id } }
        });
        if (submission && submission.status !== 'PENDING') {
          return next(new AuthorizationError('You have already completed this exam'));
        }
      } else {
        throw err;
      }
    }
  }

  res.status(201).json({ success: true, data: submission });
});

function normalizeMcq(val: any, q?: any): string {
  if (!val) return '';
  const str = String(val).trim();
  if (q) {
    if (q.optionA && str.toLowerCase() === String(q.optionA).trim().toLowerCase()) return 'A';
    if (q.optionB && str.toLowerCase() === String(q.optionB).trim().toLowerCase()) return 'B';
    if (q.optionC && str.toLowerCase() === String(q.optionC).trim().toLowerCase()) return 'C';
    if (q.optionD && str.toLowerCase() === String(q.optionD).trim().toLowerCase()) return 'D';
  }
  const upper = str.toUpperCase();
  if (['A', 'B', 'C', 'D'].includes(upper)) return upper;
  if (upper.startsWith('OPTION_') || upper.startsWith('OPTION ')) {
    const code = upper.replace(/^OPTION[_\s]*/, '').charAt(0);
    if (['A', 'B', 'C', 'D'].includes(code)) return code;
  }
  if (upper.length <= 3 && ['A', 'B', 'C', 'D'].includes(upper.charAt(0))) {
    return upper.charAt(0);
  }
  return upper;
}

function normalizeTF(val: any): string {
  if (!val) return '';
  const str = String(val).trim().toUpperCase();
  if (['TRUE', 'T', 'A', '1', 'صواب', 'صح'].includes(str)) return 'TRUE';
  if (['FALSE', 'F', 'B', '0', 'خطأ'].includes(str)) return 'FALSE';
  return str;
}

export function calculateExamScore(
  questions: any[],
  answersMap: Record<string, string>,
  studentId?: number
): { score: number; maxScore: number } {
  let score = 0;
  let maxScore = 0;

  questions.forEach((q: any) => {
    const qPoints = Number(q.points) || 1;
    maxScore += qPoints;

    const studentAnswer = answersMap[q.id.toString()] || answersMap[q.id];
    if (studentAnswer !== undefined && studentAnswer !== null) {
      const sAnsStr = String(studentAnswer).trim().toUpperCase();
      const cAnsStr = String(q.correctAnswer || '').trim().toUpperCase();

      const qType = (q.type || '').toUpperCase().replace('-', '_');

      const availableLetters = ['A', 'B', 'C', 'D'].filter(
        (l) => q[`option${l}`] !== undefined && q[`option${l}`] !== null && String(q[`option${l}`]).trim().length > 0
      );
      const isMcq = qType === 'MCQ' || qType === 'MULTIPLE_CHOICE' || (!qType && availableLetters.length > 0);

      if (isMcq) {
        let normS = normalizeMcq(studentAnswer, q);
        const normC = normalizeMcq(q.correctAnswer, q);

        if (studentId !== undefined && availableLetters.length > 1) {
          const mapping = getMcqOptionMapping(studentId, q.id, availableLetters);
          const displayLetters = ['A', 'B', 'C', 'D'].slice(0, availableLetters.length);
          const dispIdx = displayLetters.indexOf(normS);
          if (dispIdx !== -1 && dispIdx < mapping.length) {
            normS = mapping[dispIdx];
          }
        }

        // Compare mapped letter against correct answer
        if (normS && normC && normS === normC) {
          score += qPoints;
        } else if (!studentId && (sAnsStr === cAnsStr || sAnsStr === cAnsStr.replace('OPTION', ''))) {
          score += qPoints;
        }
      } else if (qType === 'TRUE_FALSE' || qType === 'TRUEFALSE' || qType === 'TF') {
        const normS = normalizeTF(studentAnswer);
        const normC = normalizeTF(q.correctAnswer);
        // Check for common variations if normalize fails
        const isStudentTrue = normS === 'TRUE' || sAnsStr === 'TRUE' || sAnsStr === 'A' || sAnsStr === '1' || sAnsStr === 'صواب' || sAnsStr === 'صح';
        const isCorrectTrue = normC === 'TRUE' || cAnsStr === 'TRUE' || cAnsStr === 'A' || cAnsStr === '1' || cAnsStr === 'صواب' || cAnsStr === 'صح';
        if (isStudentTrue === isCorrectTrue) {
          score += qPoints;
        }
      } else if (qType === 'SHORT_ANSWER' || qType === 'ESSAY' || qType === 'TEXT') {
        const normStudent = sAnsStr.replace(/\s+/g, ' ').trim();
        const normCorrect = cAnsStr.replace(/\s+/g, ' ').trim();
        if (normCorrect && normStudent === normCorrect) {
          score += qPoints;
        }
      }
    }
  });

  return { score, maxScore };
}

export const submitExam = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const examId = parseInt(req.params.id as string);
  const { answers, antiCheatLogs } = req.body;
  
  const student = await prisma.student.findUnique({ where: { userId: req.user!.id } });
  if (!student) return next(new AuthorizationError('Only students can submit exams'));

  const exam = await prisma.exam.findUnique({ where: { id: examId } });
  if (!exam) return next(new NotFoundError('Exam not found'));

  // Verify student enrollment eligibility
  const enrollment = await prisma.enrollment.findFirst({
    where: {
      studentId: student.id,
      courseId: exam.courseId,
    },
    orderBy: [{ academicYear: 'desc' }, { semester: 'desc' }, { id: 'desc' }],
  });

  if (!enrollment || enrollment.status !== 'ENROLLED') {
    if (enrollment?.status === 'BLOCKED') {
      return next(
        new AuthorizationError(
          'عذراً، تم حظر تسجيلك في هذا المقرر بسبب تجاوز نسبة الغياب، ولا يمكنك دخول الامتحان. يرجى مراجعة إدارة الكلية.'
        )
      );
    }
    return next(
      new AuthorizationError(
        'عذراً، لا يمكنك دخول هذا الامتحان لأنك غير مسجل حالياً في هذا المقرر الدراسي.'
      )
    );
  }

  let submission = await prisma.examSubmission.findUnique({
    where: { examId_studentId: { examId, studentId: student.id } }
  });

  if (!submission) {
    return next(new NotFoundError('No active exam session found. Please start the exam first.'));
  }

  if (submission.status !== 'PENDING') {
    return next(new AuthorizationError('Exam already submitted'));
  }

  // Check if exam submission window has closed (allowing 3-minute grace period)
  if (exam.date && exam.endTime) {
    const [h, m] = String(exam.endTime).split(':').map(Number);
    if (!isNaN(h) && !isNaN(m)) {
      const zonedDate = toZonedTime(exam.date, CAIRO_TZ);
      zonedDate.setHours(h, m, 0, 0);
      const endDateTime = fromZonedTime(zonedDate, CAIRO_TZ);
      const gracePeriodMs = 3 * 60 * 1000;
      if (Date.now() > endDateTime.getTime() + gracePeriodMs) {
        return next(new AuthorizationError('Exam submission window has closed'));
      }
    }
  }

  const questions = await prisma.examQuestion.findMany({ where: { examId } });

  // answers format: { questionId: string, answer: string }[] OR { [questionId]: string }
  const answersMap: Record<string, string> = Array.isArray(answers) 
    ? answers.reduce((acc: any, curr: any) => ({ ...acc, [String(curr.questionId)]: String(curr.answer || '') }), {})
    : (typeof answers === 'object' && answers !== null ? answers : {});

  const { score, maxScore } = calculateExamScore(questions, answersMap, student.id);

  const updatedSubmission = await prisma.$transaction(async (tx) => {
    const sub = await tx.examSubmission.update({
      where: { id: submission.id },
      data: {
        answers: answersMap,
        score: score,
        maxScore: maxScore || 10,
        status: 'GRADED',
        submittedAt: new Date(),
        antiCheatLogs: antiCheatLogs || []
      }
    });

    // Handle violations if any
    if (Array.isArray(antiCheatLogs) && antiCheatLogs.length > 0) {
      const violationRecords = antiCheatLogs.map((log: any) => ({
        submissionId: sub.id,
        type: log.type,
        details: log.details || null,
        occurredAt: log.occurredAt ? new Date(log.occurredAt) : new Date()
      }));
      await tx.examViolation.createMany({ data: violationRecords });
    }

    return sub;
  });

  res.json({ success: true, data: updatedSubmission });
});

export const cancelExam = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const examId = parseInt(req.params.id as string);
  const { reason, antiCheatLogs, answers } = req.body;

  const student = await prisma.student.findUnique({ where: { userId: req.user!.id } });
  if (!student) return next(new AuthorizationError('Only students can cancel their own exam sessions'));

  const exam = await prisma.exam.findUnique({ where: { id: examId } });
  if (!exam) return next(new NotFoundError('Exam not found'));

  const submission = await prisma.examSubmission.findUnique({
    where: { examId_studentId: { examId, studentId: student.id } }
  });

  if (!submission) {
    return next(new NotFoundError('No active exam session found'));
  }

  if (submission.status !== 'PENDING') {
    return next(new AuthorizationError('Exam already submitted'));
  }

  const questions = await prisma.examQuestion.findMany({ where: { examId } });
  const maxScore = questions.reduce((sum: number, q: any) => sum + (Number(q.points) || 1), 0);

  // Normalize answers if provided, otherwise preserve existing submission.answers
  let answersMap = submission.answers as Record<string, string>;
  if (answers !== undefined && answers !== null) {
    answersMap = Array.isArray(answers)
      ? answers.reduce((acc: any, curr: any) => ({ ...acc, [String(curr.questionId)]: String(curr.answer || '') }), {})
      : (typeof answers === 'object' ? answers : answersMap);
  }

  const updatedSubmission = await prisma.$transaction(async (tx) => {
    const sub = await tx.examSubmission.update({
      where: { id: submission.id },
      data: {
        answers: answersMap,
        score: 0,
        maxScore: maxScore || 10,
        status: 'CANCELLED_CHEATING',
        submittedAt: new Date(),
        antiCheatLogs: antiCheatLogs || []
      }
    });

    // Handle violations if any
    if (Array.isArray(antiCheatLogs) && antiCheatLogs.length > 0) {
      const violationRecords = antiCheatLogs.map((log: any) => ({
        submissionId: sub.id,
        type: log.type,
        details: log.details || (reason ? `Auto-cancelled: ${reason}` : null),
        occurredAt: log.occurredAt ? new Date(log.occurredAt) : new Date()
      }));
      await tx.examViolation.createMany({ data: violationRecords });
    }

    return sub;
  });

  auditLog('CANCEL_EXAM_CHEATING', 'ExamSubmission', submission.id.toString(), req);

  res.json({ success: true, data: updatedSubmission });
});

export const getExamSubmissions = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const examId = parseInt(req.params.id as string);
  
  // Scope check
  const examScope: any = getScopeWhere(req.user!, 'exam');
  const exam = await prisma.exam.findFirst({
    where: {
      id: examId,
      ...(examScope && Object.keys(examScope).length ? examScope : {}),
    },
  });

  if (!exam) {
    return next(new AuthorizationError('Access denied'));
  }

  const questions = await prisma.examQuestion.findMany({ where: { examId } });

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

  // Auto-calculate score for display for any submission missing score without persisting side-effects
  const updatedSubmissions = submissions.map((sub: any) => {
    if (sub.score === null || sub.score === undefined || sub.status === 'PENDING') {
      const answersMap: Record<string, string> =
        typeof sub.answers === 'object' && sub.answers !== null
          ? (sub.answers as Record<string, string>)
          : {};

      const { score: calcScore, maxScore: totalMax } = calculateExamScore(questions, answersMap, sub.studentId);

      return { ...sub, score: calcScore, maxScore: totalMax || 10, status: 'GRADED' };
    }
    return sub;
  });

  res.json({ success: true, data: updatedSubmissions });
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

  const exam = await prisma.exam.findUnique({ where: { id: examId } });

  let questions = await prisma.examQuestion.findMany({
    where: { examId },
    orderBy: { order: 'asc' },
  });

  // Fallback: If no questions attached directly to examId, load questions from any exam of the same course
  if (questions.length === 0 && exam?.courseId) {
    questions = await prisma.examQuestion.findMany({
      where: { exam: { courseId: exam.courseId } },
      orderBy: { order: 'asc' },
    });
  }

  res.json({
    success: true,
    data: {
      ...submission,
      questions,
    },
  });
});

export const gradeSubmission = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const submissionId = parseInt(req.params.submissionId as string);
  const { score } = req.body;

  const submission = await prisma.examSubmission.findUnique({
    where: { id: submissionId },
  });

  if (!submission) {
    return next(new NotFoundError('Submission not found'));
  }

  // Scope check on parent exam
  const examScope: any = getScopeWhere(req.user!, 'exam');
  const exam = await prisma.exam.findFirst({
    where: {
      id: submission.examId,
      ...(examScope && Object.keys(examScope).length ? examScope : {}),
    },
  });

  if (!exam) {
    return next(new AuthorizationError('Access denied'));
  }

  // Score validation
  const numericScore = Number(score);
  if (
    score === undefined ||
    score === null ||
    score === '' ||
    isNaN(numericScore) ||
    !Number.isFinite(numericScore) ||
    numericScore < 0 ||
    numericScore > submission.maxScore
  ) {
    return next(new ValidationError('Invalid score value'));
  }

  const updated = await prisma.examSubmission.update({
    where: { id: submissionId },
    data: {
      score: numericScore,
      status: 'GRADED',
    },
  });

  auditLog('GRADE_SUBMISSION', 'ExamSubmission', submissionId.toString(), req);

  res.json({ success: true, data: updated });
});
