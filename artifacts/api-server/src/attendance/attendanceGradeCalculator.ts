import { Prisma } from '@prisma/client';
import { GradeCalculatorContext, registerGradeCalculator } from '../services/gradebookPublish.service';
import { toHundredths } from '../utils/gradeMath.utils';

/**
 * AUTO_ATTENDANCE Grade Calculator
 *
 * Computes attendance points earned for an enrollment in a course-term:
 * Result = sum over student's sessions of (sessionPoints * weight(status))
 * using exact hundredths arithmetic, plain number, rounded to 2 decimals.
 *
 * Rules:
 * - Only approved PRESENT (status === 'PRESENT' && !locationFlagged) counts full session points (weight 1.0).
 * - ABSENT counts 0 points (weight 0.0).
 * - LATE, EXCUSED, PENDING_REVIEW use data weights from AttendanceStatusWeight (unset = 0.0).
 * - Unrecorded sessions count 0 points.
 * - Sessions of other courses or other terms are strictly excluded.
 * - Calculator NEVER modifies Enrollment or any other entity (read-only calculation).
 */
export async function calculateAutoAttendance(ctx: GradeCalculatorContext): Promise<number> {
  const { enrollmentId, courseId, termId, tx } = ctx;

  const enrollment = await tx.enrollment.findUnique({
    where: { id: enrollmentId },
    select: { studentId: true },
  });

  if (!enrollment) {
    return 0;
  }

  // Determine if termId is the current term (OD-29: null-termId slots count only for current term)
  const term = await tx.academicTerm.findUnique({
    where: { id: termId },
    select: { isCurrent: true },
  });

  const slotTermFilter = term?.isCurrent
    ? {
        courseId,
        OR: [{ termId }, { termId: null }],
      }
    : {
        courseId,
        termId,
      };

  // Find all attendance sessions for this course and term with non-null points
  const sessions = await tx.attendanceSession.findMany({
    where: {
      scheduleSlot: slotTermFilter,
      sessionPoints: { not: null },
    },
    select: {
      id: true,
      sessionPoints: true,
    },
  });

  if (sessions.length === 0) {
    return 0;
  }

  const sessionIds = sessions.map((s) => s.id);

  // Load student attendances for these sessions
  const attendances = await tx.attendance.findMany({
    where: {
      studentId: enrollment.studentId,
      sessionId: { in: sessionIds },
    },
    select: {
      sessionId: true,
      status: true,
      locationFlagged: true,
    },
  });

  const attendanceBySessionId = new Map<number, (typeof attendances)[0]>();
  for (const att of attendances) {
    if (att.sessionId) {
      attendanceBySessionId.set(att.sessionId, att);
    }
  }

  // Load status weights from database
  const weights = await tx.attendanceStatusWeight.findMany();
  const weightMap = new Map<string, number>();
  for (const w of weights) {
    weightMap.set(w.status, w.weight);
  }

  let totalHundredths = 0;

  for (const session of sessions) {
    const sessionPoints = session.sessionPoints ?? 0;
    if (sessionPoints <= 0) continue;

    const att = attendanceBySessionId.get(session.id);
    let weight = 0.0;

    if (!att || att.locationFlagged) {
      // Unrecorded session or flagged/unreviewed = 0 weight
      weight = 0.0;
    } else if (att.status === 'PRESENT') {
      // Only approved PRESENT counts full points
      weight = 1.0;
    } else if (att.status === 'ABSENT') {
      weight = 0.0;
    } else if (att.status === 'LATE') {
      weight = weightMap.get('LATE') ?? 0.0;
    } else if (att.status === 'EXCUSED') {
      weight = weightMap.get('EXCUSED') ?? 0.0;
    } else if (att.status === 'PENDING_REVIEW') {
      weight = weightMap.get('PENDING_REVIEW') ?? 0.0;
    }

    const sessionHundredths = toHundredths(sessionPoints);
    const weightHundredths = toHundredths(weight);
    // Exact hundredths arithmetic
    const earnedHundredths = Math.round((sessionHundredths * weightHundredths) / 100);
    totalHundredths += earnedHundredths;
  }

  return totalHundredths / 100;
}

// Register calculator for AUTO_ATTENDANCE
registerGradeCalculator('AUTO_ATTENDANCE', calculateAutoAttendance);
