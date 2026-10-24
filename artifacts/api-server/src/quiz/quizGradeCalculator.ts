import { GradeCalculatorContext, registerGradeCalculator } from '../services/gradebookPublish.service';
import { toHundredths } from '../utils/gradeMath.utils';

/**
 * AUTO_QUIZ Grade Calculator
 *
 * Computes quiz points earned for an enrollment in a course-term:
 * Result = sum over student's GRADED submissions of QUIZ exams in the course-term.
 *
 * Rules (D2):
 * - exam.type === 'QUIZ'
 * - submission.status === 'GRADED'
 * - exam.courseId === courseId
 * - exam.termId === termId, or (termId null when that term is the current term: OD-29)
 * - Legacy MIDTERM/FINAL exams, PENDING and CANCELLED_CHEATING submissions count 0.
 * - Submissions of other courses, terms, or students count 0.
 * - Exact hundredths arithmetic via gradeMath.utils, plain number.
 * - Calculator NEVER modifies Enrollment or any other entity (read-only calculation).
 * - Never a silent cap: a result above maxPoints stays un-clamped so caller throws 409 AUTO_CALCULATOR_INVALID_RESULT.
 */
export async function calculateAutoQuiz(ctx: GradeCalculatorContext): Promise<number> {
  const { enrollmentId, courseId, termId, tx } = ctx;

  const enrollment = await tx.enrollment.findUnique({
    where: { id: enrollmentId },
    select: { studentId: true },
  });

  if (!enrollment) {
    return 0;
  }

  // Determine if termId is the current term (OD-29: null-termId exams count only for current term)
  const term = await tx.academicTerm.findUnique({
    where: { id: termId },
    select: { isCurrent: true },
  });

  const examTermFilter = term?.isCurrent
    ? {
        courseId,
        type: 'QUIZ' as const,
        OR: [{ termId }, { termId: null }],
      }
    : {
        courseId,
        type: 'QUIZ' as const,
        termId,
      };

  const submissions = await tx.examSubmission.findMany({
    where: {
      studentId: enrollment.studentId,
      status: 'GRADED',
      exam: examTermFilter,
    },
    select: {
      score: true,
    },
  });

  let totalHundredths = 0;
  for (const sub of submissions) {
    if (sub.score != null && sub.score > 0) {
      totalHundredths += toHundredths(sub.score);
    }
  }

  return totalHundredths / 100;
}

// Register calculator for AUTO_QUIZ
registerGradeCalculator('AUTO_QUIZ', calculateAutoQuiz);
