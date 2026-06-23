import { z } from 'zod';

// ─── Exam Session ─────────────────────────────────────────────────────────────

export const createExamSessionSchema = z.object({
  body: z.object({
    examId: z.number().int().positive(),
    title: z.string().min(3).max(200),
    instructions: z.string().optional(),
    durationMinutes: z.number().int().min(5).max(360),
    totalPoints: z.number().int().min(1).default(100),
    passingScore: z.number().min(0).max(100).default(50),
    shuffleQuestions: z.boolean().default(false),
    showResultsAfter: z.boolean().default(true),
    allowedAttempts: z.number().int().min(1).max(3).default(1),
    opensAt: z.string().datetime().optional(),
    closesAt: z.string().datetime().optional(),
  }),
});

export const updateExamSessionSchema = z.object({
  body: z.object({
    title: z.string().min(3).max(200).optional(),
    instructions: z.string().optional(),
    durationMinutes: z.number().int().min(5).max(360).optional(),
    totalPoints: z.number().int().min(1).optional(),
    passingScore: z.number().min(0).max(100).optional(),
    shuffleQuestions: z.boolean().optional(),
    showResultsAfter: z.boolean().optional(),
    opensAt: z.string().datetime().optional(),
    closesAt: z.string().datetime().optional(),
    status: z.enum(['DRAFT', 'PUBLISHED', 'ACTIVE', 'CLOSED', 'GRADED']).optional(),
  }),
});

export const updateStatusSchema = z.object({
  body: z.object({
    status: z.enum(['DRAFT', 'PUBLISHED', 'ACTIVE', 'CLOSED', 'GRADED']),
  }),
});

// ─── Questions ────────────────────────────────────────────────────────────────

export const addQuestionSchema = z.object({
  body: z.object({
    type: z.enum(['MCQ', 'TRUE_FALSE', 'ESSAY', 'FILE_UPLOAD']),
    text: z.string().min(1),
    textAr: z.string().optional(),
    points: z.number().int().min(1).default(1),
    orderIndex: z.number().int().min(0).default(0),
    optionA: z.string().optional(),
    optionB: z.string().optional(),
    optionC: z.string().optional(),
    optionD: z.string().optional(),
    correctAnswer: z.string().optional(),
    maxWords: z.number().int().optional(),
    allowedFileTypes: z.string().optional(),
  }),
});

// ─── Student Actions ──────────────────────────────────────────────────────────

export const submitAnswersSchema = z.object({
  body: z.object({
    answers: z.array(
      z.object({
        questionId: z.number().int().positive(),
        selectedOption: z.string().optional(),
        essayText: z.string().optional(),
      })
    ),
  }),
});

// ─── Grading ──────────────────────────────────────────────────────────────────

export const gradeSubmissionSchema = z.object({
  body: z.object({
    feedback: z.string().optional(),
    answers: z.array(
      z.object({
        answerId: z.number().int().positive(),
        score: z.number().min(0),
        feedback: z.string().optional(),
      })
    ),
  }),
});
