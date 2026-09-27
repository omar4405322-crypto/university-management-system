import { Request, Response, NextFunction } from "express";
import prisma from "../utils/prismaClient";
import { auditLog } from "../utils/audit.utils";
import catchAsync from "../utils/catchAsync";
import {
  NotFoundError,
  AuthorizationError,
} from "../utils/appError";
import { getScopeWhere } from "../utils/scope.utils";
import { toZonedTime, fromZonedTime } from "date-fns-tz";

const CAIRO_TZ = "Africa/Cairo";

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
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getMcqOptionMapping(
  studentId: number,
  questionId: number,
  optionLetters: string[],
): string[] {
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
export async function requireStudentExamEnrollment(
  exam: {
    id: number;
    courseId: number;
    academicYear: number;
    semester: number;
  },
  studentId: number,
): Promise<{ id: number; status: string }> {
  const enrollment = await prisma.enrollment.findUnique({
    where: {
      studentId_courseId_semester_academicYear: {
        studentId,
        courseId: exam.courseId,
        academicYear: exam.academicYear,
        semester: exam.semester,
      },
    },
    select: { id: true, status: true },
  });

  if (!enrollment || enrollment.status !== "ENROLLED") {
    if (enrollment?.status === "BLOCKED") {
      throw new AuthorizationError(
        "عذراً، تم حظر تسجيلك في هذا المقرر بسبب تجاوز نسبة الغياب، ولا يمكنك دخول الامتحان. يرجى مراجعة إدارة الكلية.",
      );
    }
    throw new AuthorizationError(
      "عذراً، لا يمكنك دخول هذا الامتحان لأنك غير مسجل حالياً في هذا المقرر الدراسي.",
    );
  }
  return enrollment;
}

export async function verifyStudentExamAccess(
  exam: {
    id: number;
    courseId: number;
    academicYear: number;
    semester: number;
    date?: Date | null;
    startTime?: string | null;
    endTime?: string | null;
  },
  studentId: number,
): Promise<{ id: number; status: string }> {
  // 1. Verify the enrollment for this exact academic offering.
  const enrollment = await requireStudentExamEnrollment(exam, studentId);

  // 2. Ensure exam is active based on date and time
  const now = new Date();

  if (exam.date) {
    // Check start time
    if (exam.startTime) {
      const [h, m] = String(exam.startTime).split(":").map(Number);
      if (!isNaN(h) && !isNaN(m)) {
        const zonedDate = toZonedTime(exam.date, CAIRO_TZ);
        zonedDate.setHours(h, m, 0, 0);
        const startDateTime = fromZonedTime(zonedDate, CAIRO_TZ);
        if (now.getTime() < startDateTime.getTime()) {
          throw new AuthorizationError("Exam has not started yet");
        }
      }
    }

    // Check end time
    if (exam.endTime) {
      const [h, m] = String(exam.endTime).split(":").map(Number);
      if (!isNaN(h) && !isNaN(m)) {
        const zonedDate = toZonedTime(exam.date, CAIRO_TZ);
        zonedDate.setHours(h, m, 0, 0);
        const endDateTime = fromZonedTime(zonedDate, CAIRO_TZ);
        if (now.getTime() > endDateTime.getTime()) {
          throw new AuthorizationError("Exam time has expired");
        }
      }
    }
  }

  // 3. Check if submission already exists and completed
  const submission = await prisma.examSubmission.findUnique({
    where: { examId_studentId: { examId: exam.id, studentId } },
  });

  if (submission && submission.status !== "PENDING") {
    throw new AuthorizationError("You have already completed this exam");
  }

  return enrollment;
}

export function normalizeMcq(val: any, q?: any): string {
  if (!val) return "";
  const str = String(val).trim();
  if (q) {
    if (
      q.optionA &&
      str.toLowerCase() === String(q.optionA).trim().toLowerCase()
    )
      return "A";
    if (
      q.optionB &&
      str.toLowerCase() === String(q.optionB).trim().toLowerCase()
    )
      return "B";
    if (
      q.optionC &&
      str.toLowerCase() === String(q.optionC).trim().toLowerCase()
    )
      return "C";
    if (
      q.optionD &&
      str.toLowerCase() === String(q.optionD).trim().toLowerCase()
    )
      return "D";
  }
  const upper = str.toUpperCase();
  if (["A", "B", "C", "D"].includes(upper)) return upper;
  if (upper.startsWith("OPTION_") || upper.startsWith("OPTION ")) {
    const code = upper.replace(/^OPTION[_\s]*/, "").charAt(0);
    if (["A", "B", "C", "D"].includes(code)) return code;
  }
  if (upper.length <= 3 && ["A", "B", "C", "D"].includes(upper.charAt(0))) {
    return upper.charAt(0);
  }
  return upper;
}

export function normalizeTF(val: any): string {
  if (val === undefined || val === null) return "";
  if (!["string", "boolean", "number"].includes(typeof val)) return "";
  const str = String(val).trim().toUpperCase();
  if (["TRUE", "T", "A", "1", "صواب", "صح"].includes(str)) return "TRUE";
  if (["FALSE", "F", "B", "0", "خطأ"].includes(str)) return "FALSE";
  return str;
}

export function calculateExamScore(
  questions: any[],
  answersMap: Record<string, string>,
  studentId?: number,
): { score: number; maxScore: number } {
  let score = 0;
  let maxScore = 0;

  questions.forEach((q: any) => {
    const qPoints = Number(q.points) || 1;
    maxScore += qPoints;

    const studentAnswer = answersMap[q.id.toString()] || answersMap[q.id];
    if (studentAnswer !== undefined && studentAnswer !== null) {
      const sAnsStr = String(studentAnswer).trim().toUpperCase();
      const cAnsStr = String(q.correctAnswer || "")
        .trim()
        .toUpperCase();

      const qType = (q.type || "").toUpperCase().replace("-", "_");

      const availableLetters = ["A", "B", "C", "D"].filter(
        (l) =>
          q[`option${l}`] !== undefined &&
          q[`option${l}`] !== null &&
          String(q[`option${l}`]).trim().length > 0,
      );
      const isMcq =
        qType === "MCQ" ||
        qType === "MULTIPLE_CHOICE" ||
        (!qType && availableLetters.length > 0);

      if (isMcq) {
        let normS = normalizeMcq(studentAnswer, q);
        const normC = normalizeMcq(q.correctAnswer, q);

        if (studentId !== undefined && availableLetters.length > 1) {
          const mapping = getMcqOptionMapping(
            studentId,
            q.id,
            availableLetters,
          );
          const displayLetters = ["A", "B", "C", "D"].slice(
            0,
            availableLetters.length,
          );
          const dispIdx = displayLetters.indexOf(normS);
          if (dispIdx !== -1 && dispIdx < mapping.length) {
            normS = mapping[dispIdx];
          }
        }

        // Compare mapped letter against correct answer
        if (normS && normC && normS === normC) {
          score += qPoints;
        } else if (
          !studentId &&
          (sAnsStr === cAnsStr || sAnsStr === cAnsStr.replace("OPTION", ""))
        ) {
          score += qPoints;
        }
      } else if (
        qType === "TRUE_FALSE" ||
        qType === "TRUEFALSE" ||
        qType === "TF"
      ) {
        const normS = normalizeTF(studentAnswer);
        const normC = normalizeTF(q.correctAnswer);
        const studentAnswerIsValid = normS === "TRUE" || normS === "FALSE";
        const correctAnswerIsValid = normC === "TRUE" || normC === "FALSE";
        if (studentAnswerIsValid && correctAnswerIsValid && normS === normC) {
          score += qPoints;
        }
      } else if (
        qType === "SHORT_ANSWER" ||
        qType === "ESSAY" ||
        qType === "TEXT"
      ) {
        const normStudent = sAnsStr.replace(/\s+/g, " ").trim();
        const normCorrect = cAnsStr.replace(/\s+/g, " ").trim();
        if (normCorrect && normStudent === normCorrect) {
          score += qPoints;
        }
      }
    }
  });

  return { score, maxScore };
}

export const getExamQuestions = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const examId = parseInt(req.params.id as string, 10);

    let exam: {
      id: number;
      courseId: number;
      academicYear: number;
      semester: number;
      date?: Date | null;
      startTime?: string | null;
      endTime?: string | null;
    } | null = null;

    // If user is STUDENT, check active enrollment and exam timing window
    if (req.user?.role === "STUDENT") {
      const student = await prisma.student.findUnique({
        where: { userId: req.user.id },
      });
      if (!student) {
        return next(new AuthorizationError("Access denied"));
      }

      exam = await prisma.exam.findUnique({ where: { id: examId } });
      if (!exam) return next(new NotFoundError("Exam not found"));

      await verifyStudentExamAccess(exam, student.id);

      const questions = await prisma.examQuestion.findMany({
        where: { examId },
        orderBy: { order: "asc" },
      });

      const studentId = student.id;
      const processedQuestions = questions.map((q: any) => {
        const { correctAnswer, ...rest } = q;
        const qType = (q.type || "").toUpperCase().replace("-", "_");

        const availableLetters = ["A", "B", "C", "D"].filter(
          (l) =>
            q[`option${l}`] !== undefined &&
            q[`option${l}`] !== null &&
            String(q[`option${l}`]).trim().length > 0,
        );

        const isMcq =
          qType === "MCQ" ||
          qType === "MULTIPLE_CHOICE" ||
          (!qType && availableLetters.length > 0);

        if (isMcq && availableLetters.length > 1) {
          const mapping = getMcqOptionMapping(
            studentId,
            q.id,
            availableLetters,
          );
          const displayLetters = ["A", "B", "C", "D"].slice(
            0,
            availableLetters.length,
          );
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
    const examScope: any = getScopeWhere(req.user!, "exam");
    exam = await prisma.exam.findFirst({
      where: {
        id: examId,
        ...(examScope && Object.keys(examScope).length ? examScope : {}),
      },
    });
    if (!exam) return next(new NotFoundError("Exam not found"));

    const questions = await prisma.examQuestion.findMany({
      where: { examId },
      orderBy: { order: "asc" },
    });

    res.json({ success: true, data: questions });
  },
);

export const addExamQuestion = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const examId = parseInt(req.params.id as string, 10);
    const {
      text,
      type,
      optionA,
      optionB,
      optionC,
      optionD,
      correctAnswer,
      points,
      order,
    } = req.body;

    const examScope: any = getScopeWhere(req.user!, "exam");
    const exam = await prisma.exam.findFirst({
      where: {
        id: examId,
        ...(examScope && Object.keys(examScope).length ? examScope : {}),
      },
    });
    if (!exam) return next(new AuthorizationError("Access denied"));

    const question = await prisma.$transaction(async (tx) => {
      const created = await tx.examQuestion.create({
        data: {
          examId,
          text: String(text).trim(),
          type: type || "MCQ",
          optionA:
            optionA !== undefined
              ? optionA
                ? String(optionA).trim()
                : null
              : null,
          optionB:
            optionB !== undefined
              ? optionB
                ? String(optionB).trim()
                : null
              : null,
          optionC:
            optionC !== undefined
              ? optionC
                ? String(optionC).trim()
                : null
              : null,
          optionD:
            optionD !== undefined
              ? optionD
                ? String(optionD).trim()
                : null
              : null,
          correctAnswer: String(correctAnswer).trim(),
          points:
            points !== undefined && points !== ""
              ? parseInt(String(points), 10)
              : 1,
          order:
            order !== undefined && order !== ""
              ? parseInt(String(order), 10)
              : 1,
        },
      });
      await auditLog(
        "CREATE_EXAM_QUESTION",
        "ExamQuestion",
        created.id,
        req,
        {
          after: {
            examId,
            type: created.type,
            points: created.points,
            order: created.order,
          },
        },
        tx,
      );
      return created;
    });

    res.status(201).json({ success: true, data: question });
  },
);

export const updateExamQuestion = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const questionId = parseInt(req.params.questionId as string, 10);
    const {
      text,
      type,
      optionA,
      optionB,
      optionC,
      optionD,
      correctAnswer,
      points,
      order,
    } = req.body;

    const question = await prisma.examQuestion.findUnique({
      where: { id: questionId },
    });
    if (!question) return next(new NotFoundError("Question not found"));

    const examScope: any = getScopeWhere(req.user!, "exam");
    const exam = await prisma.exam.findFirst({
      where: {
        id: question.examId,
        ...(examScope && Object.keys(examScope).length ? examScope : {}),
      },
    });
    if (!exam) return next(new AuthorizationError("Access denied"));

    const data: {
      text?: string;
      type?: "MCQ" | "TRUE_FALSE" | "SHORT_ANSWER";
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
    if (optionA !== undefined)
      data.optionA = optionA ? String(optionA).trim() : null;
    if (optionB !== undefined)
      data.optionB = optionB ? String(optionB).trim() : null;
    if (optionC !== undefined)
      data.optionC = optionC ? String(optionC).trim() : null;
    if (optionD !== undefined)
      data.optionD = optionD ? String(optionD).trim() : null;
    if (correctAnswer !== undefined)
      data.correctAnswer = String(correctAnswer).trim();
    if (points !== undefined && points !== "")
      data.points = parseInt(String(points), 10);
    if (order !== undefined && order !== "")
      data.order = parseInt(String(order), 10);

    const updated = await prisma.$transaction(async (tx) => {
      const changed = await tx.examQuestion.update({
        where: { id: questionId },
        data,
      });
      await auditLog(
        "UPDATE_EXAM_QUESTION",
        "ExamQuestion",
        questionId,
        req,
        {
          before: {
            examId: question.examId,
            type: question.type,
            points: question.points,
            order: question.order,
          },
          after: {
            examId: changed.examId,
            type: changed.type,
            points: changed.points,
            order: changed.order,
          },
        },
        tx,
      );
      return changed;
    });

    res.json({ success: true, data: updated });
  },
);

export const deleteExamQuestion = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const questionId = parseInt(req.params.questionId as string);
    const question = await prisma.examQuestion.findUnique({
      where: { id: questionId },
    });
    if (!question) return next(new NotFoundError("Question not found"));

    const examScope: any = getScopeWhere(req.user!, "exam");
    const exam = await prisma.exam.findFirst({
      where: {
        id: question.examId,
        ...(examScope && Object.keys(examScope).length ? examScope : {}),
      },
    });
    if (!exam) return next(new AuthorizationError("Access denied"));

    await prisma.$transaction(async (tx) => {
      await tx.examQuestion.delete({ where: { id: questionId } });
      await auditLog(
        "DELETE_EXAM_QUESTION",
        "ExamQuestion",
        questionId,
        req,
        {
          before: {
            examId: question.examId,
            type: question.type,
            points: question.points,
            order: question.order,
          },
          after: null,
        },
        tx,
      );
    });
    res.json({ success: true, message: "Question deleted" });
  },
);
