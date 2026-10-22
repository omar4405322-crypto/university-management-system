export interface GradeMathComponent {
  id: number;
  maxPoints: number;
}

export interface GradeMathEntry {
  componentId: number;
  score: number | null;
  isAbsent: boolean;
}

export interface EnrollmentGradeTotalsResult {
  finalPointsEarned: number;
  finalPointsMax: number;
  finalGrade: number;
  status: 'COMPLETED' | 'FAILED';
}

/**
 * Converts a point value (with up to 2 decimal places) to exact integer hundredths.
 */
export function toHundredths(points: number): number {
  return Math.round(points * 100);
}

/**
 * Evaluates whether points earned meet or exceed passMark using exact integer hundredths arithmetic.
 */
export function evaluateGradeOutcome(
  pointsEarned: number,
  passMark: number
): 'COMPLETED' | 'FAILED' {
  const earnedHundredths = toHundredths(pointsEarned);
  const passMarkHundredths = toHundredths(passMark);
  const isPassed = earnedHundredths >= passMarkHundredths;
  return isPassed ? 'COMPLETED' : 'FAILED';
}

/**
 * Computes enrollment grade totals and completion outcome from structure components, published entries, and passMark.
 */
export function computeEnrollmentGradeTotals(
  components: ReadonlyArray<GradeMathComponent>,
  entries: ReadonlyArray<GradeMathEntry>,
  passMark: number
): EnrollmentGradeTotalsResult {
  let earnedHundredths = 0;
  let maxHundredths = 0;

  for (const comp of components) {
    const entry = entries.find((ge) => ge.componentId === comp.id);
    maxHundredths += toHundredths(comp.maxPoints);
    if (!entry || entry.isAbsent) {
      // Absent or missing counts as 0 points
    } else {
      earnedHundredths += toHundredths(entry.score ?? 0);
    }
  }

  const finalPointsEarned = earnedHundredths / 100;
  const finalPointsMax = maxHundredths / 100;
  const status = evaluateGradeOutcome(finalPointsEarned, passMark);
  const finalGrade =
    maxHundredths > 0
      ? Math.round(((earnedHundredths / maxHundredths) * 100) * 100) / 100
      : 0;

  return {
    finalPointsEarned,
    finalPointsMax,
    finalGrade,
    status,
  };
}
