import { Request, Response, NextFunction } from "express";
import { Prisma, ExamType, ExamViolationType } from "@prisma/client";
import prisma from "../utils/prismaClient";
import { auditLog } from "../utils/audit.utils";
import catchAsync from "../utils/catchAsync";
import {
  NotFoundError,
  AuthorizationError,
  ValidationError,
  ConflictError,
} from "../utils/appError";
import { getScopeWhere } from "../utils/scope.utils";
import { sendToUser } from "../utils/socket";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import {
  canStudentReviewExamAnswers,
  STUDENT_EXAM_QUESTION_SELECT,
  STUDENT_EXAM_REVIEW_QUESTION_SELECT,
  type StudentExamQuestionDto,
  type StudentExamReviewQuestionDto,
} from "../utils/examAnswerReview.utils";

interface AnswerInputItem {
  questionId: string | number;
  answer: string | boolean | number;
}

interface AntiCheatLogEntry {
  sequence?: number;
  type: string;
  details?: string;
  occurredAt?: string | Date;
}

const VALID_VIOLATION_TYPES = new Set<string>(Object.values(ExamViolationType));
function toExamViolationType(type: unknown): ExamViolationType {
  if (typeof type === 'string' && VALID_VIOLATION_TYPES.has(type)) {
    return type as ExamViolationType;
  }
  return ExamViolationType.TAB_SWITCH;
}

// Re-export question bank operations and calculation utilities from dedicated module
export {
  seededRandom,
  hashString,
  getMcqOptionMapping,
  requireStudentExamEnrollment,
  verifyStudentExamAccess,
  normalizeMcq,
  normalizeTF,
  calculateExamScore,
  getExamQuestions,
  addExamQuestion,
  updateExamQuestion,
  deleteExamQuestion,
} from "./examQuestions.controller";

import {
  requireStudentExamEnrollment,
  verifyStudentExamAccess,
  calculateExamScore,
} from "./examQuestions.controller";

// Re-export anti-cheat sequence & violation ingestion operations from dedicated module
export {
  getClientIp,
  resetViolationSequenceForTest,
  getLastAcceptedViolationSequence,
  verifyAndAdvanceViolationSequence,
  ingestViolation,
  getViolationSequence,
} from "./examViolations.controller";

import {
  getClientIp,
  getLastAcceptedViolationSequence,
} from "./examViolations.controller";

const CAIRO_TZ = "Africa/Cairo";

export const getAllExams = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { type, upcoming } = req.query;

    // Apply centralized scope
    const examScope = (getScopeWhere(req.user!, "exam") || {}) as Prisma.ExamWhereInput;
    let where: Prisma.ExamWhereInput = {};
    if (examScope && Object.keys(examScope).length) {
      where = { ...where, ...examScope };
    }

    if (type) where.type = type as ExamType;
    if (upcoming === "true") {
      where.date = { gte: new Date() };
    }
    if (req.user?.role === "STUDENT") {
      const studentId = req.user.student?.id;
      const offerings = studentId
        ? await prisma.enrollment.findMany({
            where: { studentId, status: "ENROLLED" },
            select: { courseId: true, academicYear: true, semester: true },
          })
        : [];
      const andClauses = Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : [];
      where.AND = [
        ...andClauses,
        offerings.length
          ? { OR: offerings.map((offering) => ({ ...offering })) }
          : { id: -1 },
      ];
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
      orderBy: { date: "asc" },
    });

    res.json({ success: true, data: exams });
  },
);

export const getUpcomingExams = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    // Apply centralized scope
    const examScope = (getScopeWhere(req.user!, "exam") || {}) as Prisma.ExamWhereInput;
    const where: Prisma.ExamWhereInput = {
      ...(examScope && Object.keys(examScope).length ? examScope : {}),
      date: { gte: new Date() },
    };
    if (req.user?.role === "STUDENT") {
      const studentId = req.user.student?.id;
      const offerings = studentId
        ? await prisma.enrollment.findMany({
            where: { studentId, status: "ENROLLED" },
            select: { courseId: true, academicYear: true, semester: true },
          })
        : [];
      where.AND = [
        offerings.length
          ? { OR: offerings.map((offering) => ({ ...offering })) }
          : { id: -1 },
      ];
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
      orderBy: { date: "asc" },
    });

    res.json({ success: true, data: exams });
  },
);

export const createExam = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { courseId, type, title, date, startTime, endTime, room, location } =
      req.body;

    // Check if course exists
    const course = await prisma.course.findUnique({
      where: { id: parseInt(courseId as string) },
      include: { department: true },
    });

    if (!course) {
      return next(new NotFoundError("Course not found"));
    }

    // ── Doctor ownership check: only allow exams for courses the doctor teaches ──
    if (req.user!.role === "DOCTOR") {
      const doctor = await prisma.doctor.findUnique({
        where: { userId: req.user!.id },
      });
      if (!doctor) {
        return next(new AuthorizationError("Doctor profile not found"));
      }
      const teachesThisCourse = await prisma.scheduleSlot.findFirst({
        where: {
          doctorId: doctor.id,
          courseId: parseInt(courseId as string),
        },
      });
      if (!teachesThisCourse) {
        return next(
          new AuthorizationError(
            "You can only create exams for courses you teach",
          ),
        );
      }
    }

    // Enforce scope via helper (for admins)
    if (req.user!.role !== "DOCTOR") {
      const courseScope = (getScopeWhere(req.user!, "course") || {}) as Prisma.CourseWhereInput & {
        department?: { collegeId?: number | null } | null;
        departmentId?: number | null;
      };
      if (courseScope && Object.keys(courseScope).length) {
        if (
          courseScope.department &&
          course.department?.collegeId !== courseScope.department.collegeId
        ) {
          return next(new AuthorizationError("Access denied"));
        }
        if (
          courseScope.departmentId &&
          course.departmentId !== courseScope.departmentId
        ) {
          return next(new AuthorizationError("Access denied"));
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
        return next(new ValidationError("Exam date cannot be in the past"));
      }
    }

    // Validate start time precedes end time
    if (startTime && endTime && String(startTime) >= String(endTime)) {
      return next(new ValidationError("Start time must be before end time"));
    }

    const exam = await prisma.$transaction(async (tx) => {
      const created = await tx.exam.create({
        data: {
          courseId: parseInt(courseId as string),
          academicYear: toZonedTime(new Date(), CAIRO_TZ).getFullYear(),
          semester: course.semester || 1,
          type: type || "MIDTERM",
          title:
            title && String(title).trim() ? String(title).trim() : undefined,
          date: new Date(date as string),
          startTime,
          endTime,
          room: room || location || "TBA",
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
      await auditLog(
        "CREATE_EXAM",
        "Exam",
        created.id,
        req,
        { after: created },
        tx,
      );
      return created;
    });

    // Notify targeted students
    try {
      const targetStudents = await prisma.student.findMany({
        where: {
          OR: [
            {
              enrollments: {
                some: {
                  courseId: parseInt(courseId as string),
                  academicYear: exam.academicYear,
                  semester: exam.semester,
                  status: "ENROLLED",
                },
              },
            },
            ...(course.departmentId && course.year
              ? [{ departmentId: course.departmentId, year: course.year }]
              : []),
          ],
        },
        select: { userId: true },
      });

      const studentUserIds = Array.from(
        new Set(targetStudents.map((s) => s.userId).filter(Boolean)),
      );

      if (studentUserIds.length > 0) {
        const examTypeTitle =
          type === "FINAL"
            ? "الامتحان النهائي"
            : type === "MIDTERM"
              ? "امتحان منتصف الفصل"
              : "اختبار قصير";

        const notifTitle = `جدولة امتحان جديد: ${course.name}`;
        const notifMsg = `تم نشر وتخصيص ${examTypeTitle} لمادة (${course.name} - ${course.courseCode}) بتاريخ ${new Date(
          date as string,
        ).toLocaleDateString(
          "ar-EG",
        )} بالقاعة/المكان (${room || location || "TBA"}).`;

        // 1. Create DB Notifications
        await prisma.notification.createMany({
          data: studentUserIds.map((uId) => ({
            userId: uId,
            title: notifTitle,
            message: notifMsg,
            type: "warning",
          })),
        });

        // 2. Broadcast via Socket.io
        studentUserIds.forEach((uId) => {
          try {
            sendToUser(uId, "notification", {
              title: notifTitle,
              message: notifMsg,
              type: "warning",
              createdAt: new Date(),
            });
          } catch (_err) {
            // ignore socket silent failure
          }
        });
      }
    } catch (notifErr) {
      console.error("Failed to dispatch exam notifications:", notifErr);
    }

    res.status(201).json({ success: true, data: exam });
  },
);

export const updateExam = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { type, date, startTime, endTime, room } = req.body;
    const id = parseInt(req.params.id as string);

    const examScope = (getScopeWhere(req.user!, "exam") || {}) as Prisma.ExamWhereInput;
    const exam = await prisma.exam.findFirst({
      where: {
        id,
        ...(examScope && Object.keys(examScope).length ? examScope : {}),
      },
    });

    if (!exam) {
      return next(new AuthorizationError("Access denied"));
    }

    const updatedExam = await prisma.$transaction(async (tx) => {
      const updated = await tx.exam.update({
        where: { id },
        data: {
          type,
          date: date ? new Date(date as string) : undefined,
          startTime,
          endTime,
          room,
        },
      });
      await auditLog(
        "UPDATE_EXAM",
        "Exam",
        id,
        req,
        { before: exam, after: updated },
        tx,
      );
      return updated;
    });

    res.json({ success: true, data: updatedExam });
  },
);

export const deleteExam = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const id = parseInt(req.params.id as string);

    const examScope = (getScopeWhere(req.user!, "exam") || {}) as Prisma.ExamWhereInput;
    const exam = await prisma.exam.findFirst({
      where: {
        id,
        ...(examScope && Object.keys(examScope).length ? examScope : {}),
      },
    });

    if (!exam) {
      return next(new AuthorizationError("Access denied"));
    }

    await prisma.$transaction(async (tx) => {
      await tx.exam.delete({ where: { id } });
      await auditLog(
        "DELETE_EXAM",
        "Exam",
        id,
        req,
        { before: exam, after: null },
        tx,
      );
    });
    res.json({ success: true, message: "Exam deleted" });
  },
);

export const getExamById = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const id = parseInt(req.params.id as string);
    const examScope = (getScopeWhere(req.user!, "exam") || {}) as Prisma.ExamWhereInput;
    const exam = await prisma.exam.findFirst({
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
            points: true,
          },
        },
      },
    });

    if (!exam) {
      return next(new NotFoundError("Exam not found"));
    }

    if (req.user?.role === "STUDENT") {
      const studentId = req.user.student?.id;
      if (!studentId)
        return next(new AuthorizationError("Student profile is required"));
      await requireStudentExamEnrollment(exam, studentId);
    }

    res.json({ success: true, data: exam });
  },
);

// --- EXAM SESSIONS & SUBMISSIONS ---

export const startExamSession = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const examId = parseInt(req.params.id as string);
    const student = await prisma.student.findUnique({
      where: { userId: req.user!.id },
    });
    if (!student)
      return next(new AuthorizationError("Only students can start exams"));

    const exam = await prisma.exam.findUnique({ where: { id: examId } });
    if (!exam) return next(new NotFoundError("Exam not found"));

    const enrollment = await verifyStudentExamAccess(exam, student.id);

    // Check if submission already exists
    let submission = await prisma.examSubmission.findUnique({
      where: { examId_studentId: { examId, studentId: student.id } },
    });

    if (submission && submission.status !== "PENDING") {
      return next(
        new AuthorizationError("You have already completed this exam"),
      );
    }

    if (!submission) {
      try {
        submission = await prisma.examSubmission.create({
          data: {
            examId,
            studentId: student.id,
            enrollmentId: enrollment.id,
            answers: [],
            status: "PENDING",
          },
        });
      } catch (err: unknown) {
        if (
          typeof err === "object" &&
          err !== null &&
          "code" in err &&
          (err as { code: unknown }).code === "P2002"
        ) {
          submission = await prisma.examSubmission.findUnique({
            where: { examId_studentId: { examId, studentId: student.id } },
          });
          if (submission && submission.status !== "PENDING") {
            return next(
              new AuthorizationError("You have already completed this exam"),
            );
          }
        } else {
          throw err;
        }
      }
    }

    // Record a SESSION_START audit event with server-captured IP
    if (submission) {
      await prisma.examViolation
        .create({
          data: {
            submissionId: submission.id,
            type: "SESSION_START",
            details: "Exam session started",
            ipAddress: getClientIp(req),
          },
        })
        .catch(() => {
          /* best-effort — do not block exam start */
        });
    }

    const lastAcceptedSequence = submission
      ? await getLastAcceptedViolationSequence(submission.id)
      : 0;
    res
      .status(201)
      .json({ success: true, data: { ...submission, lastAcceptedSequence } });
  },
);

export const submitExam = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const examId = parseInt(req.params.id as string);
    const { answers, antiCheatLogs } = req.body;

    const student = await prisma.student.findUnique({
      where: { userId: req.user!.id },
    });
    if (!student)
      return next(new AuthorizationError("Only students can submit exams"));

    const exam = await prisma.exam.findUnique({ where: { id: examId } });
    if (!exam) return next(new NotFoundError("Exam not found"));

    // Verify student enrollment eligibility
    const enrollment = await prisma.enrollment.findUnique({
      where: {
        studentId_courseId_semester_academicYear: {
          studentId: student.id,
          courseId: exam.courseId,
          academicYear: exam.academicYear,
          semester: exam.semester,
        },
      },
    });

    if (!enrollment || enrollment.status !== "ENROLLED") {
      if (enrollment?.status === "BLOCKED") {
        return next(
          new AuthorizationError(
            "عذراً، تم حظر تسجيلك في هذا المقرر بسبب تجاوز نسبة الغياب، ولا يمكنك دخول الامتحان. يرجى مراجعة إدارة الكلية.",
          ),
        );
      }
      return next(
        new AuthorizationError(
          "عذراً، لا يمكنك دخول هذا الامتحان لأنك غير مسجل حالياً في هذا المقرر الدراسي.",
        ),
      );
    }

    let submission = await prisma.examSubmission.findUnique({
      where: { examId_studentId: { examId, studentId: student.id } },
    });

    if (!submission) {
      return next(
        new NotFoundError(
          "No active exam session found. Please start the exam first.",
        ),
      );
    }

    if (submission.status !== "PENDING") {
      return next(new ConflictError("Exam submission is no longer pending"));
    }

    // Check if exam submission window has closed (allowing 3-minute grace period)
    if (exam.date && exam.endTime) {
      const [h, m] = String(exam.endTime).split(":").map(Number);
      if (!isNaN(h) && !isNaN(m)) {
        const zonedDate = toZonedTime(exam.date, CAIRO_TZ);
        zonedDate.setHours(h, m, 0, 0);
        const endDateTime = fromZonedTime(zonedDate, CAIRO_TZ);
        const gracePeriodMs = 3 * 60 * 1000;
        if (Date.now() > endDateTime.getTime() + gracePeriodMs) {
          return next(
            new AuthorizationError("Exam submission window has closed"),
          );
        }
      }
    }

    const questions = await prisma.examQuestion.findMany({ where: { examId } });

    // answers format: { questionId: string, answer: string }[] OR { [questionId]: string }
    const answersMap: Record<string, string> = Array.isArray(answers)
      ? (answers as AnswerInputItem[]).reduce(
          (acc: Record<string, string>, curr: AnswerInputItem) => ({
            ...acc,
            [String(curr.questionId)]: String(curr.answer ?? ""),
          }),
          {},
        )
      : typeof answers === "object" && answers !== null
        ? (answers as Record<string, string>)
        : {};

    const { score, maxScore } = calculateExamScore(
      questions,
      answersMap,
      student.id,
    );

    const updatedSubmission = await prisma.$transaction(async (tx) => {
      const result = await tx.examSubmission.updateMany({
        where: { id: submission.id, status: "PENDING" },
        data: {
          answers: answersMap,
          score: score,
          maxScore: maxScore || 10,
          status: "GRADED",
          submittedAt: new Date(),
          antiCheatLogs: antiCheatLogs || [],
        },
      });
      if (result.count !== 1) {
        throw new ConflictError("Exam submission is no longer pending");
      }

      const sub = await tx.examSubmission.findUnique({
        where: { id: submission.id },
      });
      if (!sub) {
        throw new NotFoundError("Exam submission not found");
      }

      // Handle violations if any (fallback batch)
      if (Array.isArray(antiCheatLogs) && antiCheatLogs.length > 0) {
        const serverIp = getClientIp(req);
        const lastSeq = await getLastAcceptedViolationSequence(sub.id);
        const fallbackLogs = (antiCheatLogs as AntiCheatLogEntry[]).filter(
          (log: AntiCheatLogEntry) => !log.sequence || log.sequence > lastSeq,
        );
        if (fallbackLogs.length > 0) {
          const violationRecords = fallbackLogs.map((log: AntiCheatLogEntry) => ({
            submissionId: sub.id,
            type: toExamViolationType(log.type),
            details: log.details
              ? `[via fallback batch] ${log.details}`
              : "[via fallback batch]",
            occurredAt: log.occurredAt ? new Date(log.occurredAt) : new Date(),
            receivedAt: new Date(),
            ipAddress: serverIp,
          }));
          await tx.examViolation.createMany({ data: violationRecords });
        }
      }

      // Record a SESSION_END audit event with server-captured IP
      await tx.examViolation.create({
        data: {
          submissionId: sub.id,
          type: "SESSION_END",
          details: "Exam submitted",
          ipAddress: getClientIp(req),
        },
      });

      return sub;
    });

    res.json({ success: true, data: updatedSubmission });
  },
);

export const cancelExam = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const examId = parseInt(req.params.id as string);
    const { reason, antiCheatLogs, answers } = req.body;

    const student = await prisma.student.findUnique({
      where: { userId: req.user!.id },
    });
    if (!student)
      return next(
        new AuthorizationError(
          "Only students can cancel their own exam sessions",
        ),
      );

    const exam = await prisma.exam.findUnique({ where: { id: examId } });
    if (!exam) return next(new NotFoundError("Exam not found"));

    const submission = await prisma.examSubmission.findUnique({
      where: { examId_studentId: { examId, studentId: student.id } },
    });

    if (!submission) {
      return next(new NotFoundError("No active exam session found"));
    }

    if (submission.status !== "PENDING") {
      return next(new ConflictError("Exam submission is no longer pending"));
    }

    const questions = await prisma.examQuestion.findMany({ where: { examId } });
    const maxScore = questions.reduce(
      (sum: number, q: { points?: number | null }) => sum + (Number(q.points) || 1),
      0,
    );

    // Normalize answers if provided, otherwise preserve existing submission.answers
    let answersMap = submission.answers as Record<string, string>;
    if (answers !== undefined && answers !== null) {
      answersMap = Array.isArray(answers)
        ? (answers as AnswerInputItem[]).reduce(
            (acc: Record<string, string>, curr: AnswerInputItem) => ({
              ...acc,
              [String(curr.questionId)]: String(curr.answer ?? ""),
            }),
            {},
          )
        : typeof answers === "object" && answers !== null
          ? (answers as Record<string, string>)
          : answersMap;
    }

    const updatedSubmission = await prisma.$transaction(async (tx) => {
      const result = await tx.examSubmission.updateMany({
        where: { id: submission.id, status: "PENDING" },
        data: {
          answers: answersMap,
          score: 0,
          maxScore: maxScore || 10,
          status: "CANCELLED_CHEATING",
          submittedAt: new Date(),
          antiCheatLogs: antiCheatLogs || [],
        },
      });
      if (result.count !== 1) {
        throw new ConflictError("Exam submission is no longer pending");
      }

      const sub = await tx.examSubmission.findUnique({
        where: { id: submission.id },
      });
      if (!sub) {
        throw new NotFoundError("Exam submission not found");
      }

      // Handle violations if any (fallback batch)
      if (Array.isArray(antiCheatLogs) && antiCheatLogs.length > 0) {
        const serverIp = getClientIp(req);
        const lastSeq = await getLastAcceptedViolationSequence(sub.id);
        const fallbackLogs = (antiCheatLogs as AntiCheatLogEntry[]).filter(
          (log: AntiCheatLogEntry) => !log.sequence || log.sequence > lastSeq,
        );
        if (fallbackLogs.length > 0) {
          const violationRecords = fallbackLogs.map((log: AntiCheatLogEntry) => ({
            submissionId: sub.id,
            type: toExamViolationType(log.type),
            details: log.details
              ? `[via fallback batch] ${log.details}`
              : reason
                ? `Auto-cancelled: ${reason} [via fallback batch]`
                : "[via fallback batch]",
            occurredAt: log.occurredAt ? new Date(log.occurredAt) : new Date(),
            receivedAt: new Date(),
            ipAddress: serverIp,
          }));
          await tx.examViolation.createMany({ data: violationRecords });
        }
      }

      // Record a SESSION_END audit event with server-captured IP
      await tx.examViolation.create({
        data: {
          submissionId: sub.id,
          type: "SESSION_END",
          details: reason
            ? `Exam cancelled: ${reason}`
            : "Exam cancelled (anti-cheat)",
          ipAddress: getClientIp(req),
        },
      });

      return sub;
    });

    auditLog(
      "CANCEL_EXAM_CHEATING",
      "ExamSubmission",
      submission.id.toString(),
      req,
    );

    res.json({ success: true, data: updatedSubmission });
  },
);

export const getExamSubmissions = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const examId = parseInt(req.params.id as string);

    // Scope check
    const examScope = (getScopeWhere(req.user!, "exam") || {}) as Prisma.ExamWhereInput;
    const exam = await prisma.exam.findFirst({
      where: {
        id: examId,
        ...(examScope && Object.keys(examScope).length ? examScope : {}),
      },
    });

    if (!exam) {
      return next(new AuthorizationError("Access denied"));
    }

    const questions = await prisma.examQuestion.findMany({ where: { examId } });

    const submissions = await prisma.examSubmission.findMany({
      where: { examId },
      include: {
        student: {
          include: { user: { select: { email: true } } },
        },
        violations: true,
      },
      orderBy: { submittedAt: "desc" },
    });

    // Auto-calculate score for display for any submission missing score without persisting side-effects
    const updatedSubmissions = submissions.map((sub) => {
      if (
        sub.score === null ||
        sub.score === undefined ||
        sub.status === "PENDING"
      ) {
        const answersMap: Record<string, string> =
          typeof sub.answers === "object" && sub.answers !== null
            ? (sub.answers as Record<string, string>)
            : {};

        const { score: calcScore, maxScore: totalMax } = calculateExamScore(
          questions,
          answersMap,
          sub.studentId,
        );

        return {
          ...sub,
          provisionalScore: calcScore,
          provisionalMaxScore: totalMax || 10,
        };
      }
      return sub;
    });

    res.json({ success: true, data: updatedSubmissions });
  },
);

export const getMyExamSubmission = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const examId = parseInt(req.params.id as string);
    const student = await prisma.student.findUnique({
      where: { userId: req.user!.id },
    });
    if (!student) return next(new AuthorizationError("Access denied"));

    const submission = await prisma.examSubmission.findUnique({
      where: { examId_studentId: { examId, studentId: student.id } },
      include: { violations: true },
    });

    if (!submission) return next(new NotFoundError("Submission not found"));

    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      select: {
        id: true,
        courseId: true,
        date: true,
        endTime: true,
      },
    });
    if (!exam) return next(new NotFoundError("Exam not found"));

    const canReviewAnswers = canStudentReviewExamAnswers(
      submission.status,
      exam,
    );
    let questions: Array<StudentExamQuestionDto | StudentExamReviewQuestionDto>;

    if (canReviewAnswers) {
      questions = await prisma.examQuestion.findMany({
        where: { examId },
        select: STUDENT_EXAM_REVIEW_QUESTION_SELECT,
        orderBy: { order: "asc" },
      });
    } else {
      questions = await prisma.examQuestion.findMany({
        where: { examId },
        select: STUDENT_EXAM_QUESTION_SELECT,
        orderBy: { order: "asc" },
      });
    }

    // Fallback: If no questions attached directly to examId, load questions from any exam of the same course
    if (questions.length === 0 && exam.courseId) {
      questions = await prisma.examQuestion.findMany({
        where: { exam: { courseId: exam.courseId } },
        select: STUDENT_EXAM_QUESTION_SELECT,
        orderBy: { order: "asc" },
      });
    }

    const lastAcceptedSequence = await getLastAcceptedViolationSequence(
      submission.id,
    );

    res.json({
      success: true,
      data: {
        ...submission,
        lastAcceptedSequence,
        questions,
      },
    });
  },
);

export const gradeSubmission = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const submissionId = parseInt(req.params.submissionId as string);
    const { score } = req.body;

    const submission = await prisma.examSubmission.findUnique({
      where: { id: submissionId },
    });

    if (!submission) {
      return next(new NotFoundError("Submission not found"));
    }

    // Scope check on parent exam
    const examScope = (getScopeWhere(req.user!, "exam") || {}) as Prisma.ExamWhereInput;
    const exam = await prisma.exam.findFirst({
      where: {
        id: submission.examId,
        ...(examScope && Object.keys(examScope).length ? examScope : {}),
      },
    });

    if (!exam) {
      return next(new AuthorizationError("Access denied"));
    }

    // Score validation
    const numericScore = Number(score);
    if (
      score === undefined ||
      score === null ||
      score === "" ||
      isNaN(numericScore) ||
      !Number.isFinite(numericScore) ||
      numericScore < 0 ||
      numericScore > submission.maxScore
    ) {
      return next(new ValidationError("Invalid score value"));
    }

    const result = await prisma.examSubmission.updateMany({
      where: {
        id: submissionId,
        status: { in: ["PENDING", "GRADED"] },
      },
      data: {
        score: numericScore,
        status: "GRADED",
      },
    });
    if (result.count !== 1) {
      return next(
        new ConflictError(
          "Cancelled exam submissions cannot be graded without an explicit reversal",
        ),
      );
    }

    const updated = await prisma.examSubmission.findUnique({
      where: { id: submissionId },
    });
    if (!updated) {
      return next(new NotFoundError("Submission not found"));
    }

    auditLog(
      "GRADE_SUBMISSION",
      "ExamSubmission",
      submissionId.toString(),
      req,
    );

    res.json({ success: true, data: updated });
  },
);
