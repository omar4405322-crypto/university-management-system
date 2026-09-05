import type { Prisma } from '@prisma/client';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';

const CAIRO_TZ = 'Africa/Cairo';

export const STUDENT_EXAM_QUESTION_SELECT = {
  id: true,
  examId: true,
  text: true,
  type: true,
  optionA: true,
  optionB: true,
  optionC: true,
  optionD: true,
  points: true,
  order: true,
} as const satisfies Prisma.ExamQuestionSelect;

export const STUDENT_EXAM_REVIEW_QUESTION_SELECT = {
  ...STUDENT_EXAM_QUESTION_SELECT,
  correctAnswer: true,
} as const satisfies Prisma.ExamQuestionSelect;

export type StudentExamQuestionDto = Prisma.ExamQuestionGetPayload<{
  select: typeof STUDENT_EXAM_QUESTION_SELECT;
}>;

export type StudentExamReviewQuestionDto = Prisma.ExamQuestionGetPayload<{
  select: typeof STUDENT_EXAM_REVIEW_QUESTION_SELECT;
}>;

export function canStudentReviewExamAnswers(
  submissionStatus: string,
  exam: { date: Date | null; endTime: string | null },
  now: Date = new Date()
): boolean {
  if (submissionStatus !== 'GRADED' || !exam.date || !exam.endTime) {
    return false;
  }

  const timeParts = exam.endTime.trim().split(':');
  if (timeParts.length !== 2) {
    return false;
  }

  const hours = Number(timeParts[0]);
  const minutes = Number(timeParts[1]);
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59 ||
    Number.isNaN(exam.date.getTime()) ||
    Number.isNaN(now.getTime())
  ) {
    return false;
  }

  const zonedExamDate = toZonedTime(exam.date, CAIRO_TZ);
  zonedExamDate.setHours(hours, minutes, 0, 0);
  const examEnd = fromZonedTime(zonedExamDate, CAIRO_TZ);

  return now.getTime() >= examEnd.getTime();
}
