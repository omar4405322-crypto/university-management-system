import prisma from './prismaClient';

export interface SupersededAttempt {
  academicYear: number;
  semester: number;
  finalGrade: number | null;
  status: string;
}

export interface CourseGpaBreakdown {
  courseId: number;
  courseName: string;
  courseCode: string;
  credits: number;
  countedSemester: number;
  countedAcademicYear: number;
  finalGrade: number | null;
  letterGrade: string;
  gradePoints: number;
  status: string;
  isRetake: boolean;
  supersededAttempts: SupersededAttempt[];
}

export interface StudentGpaResult {
  studentId: number;
  cumulativeGpa: number;
  gpaString: string;
  totalPoints: number;
  totalCreditsEarned: number;
  totalCreditsAttempted: number;
  coursesCount: number;
  courses: CourseGpaBreakdown[];
}

/**
 * Maps a final grade percentage and enrollment status to a standard 4.0 letter grade and points.
 */
export function getGradeScale(grade: number | null, status: string): { letterGrade: string; gradePoints: number } {
  if (status === 'FAILED') {
    return { letterGrade: 'F', gradePoints: 0.0 };
  }

  if (grade === null || grade === undefined) {
    return { letterGrade: 'N/A', gradePoints: 0.0 };
  }

  if (grade >= 90) return { letterGrade: 'A', gradePoints: 4.0 };
  if (grade >= 80) return { letterGrade: 'B', gradePoints: 3.0 };
  if (grade >= 70) return { letterGrade: 'C', gradePoints: 2.0 };
  if (grade >= 60) return { letterGrade: 'D', gradePoints: 1.0 };
  return { letterGrade: 'F', gradePoints: 0.0 };
}

/**
 * Calculates a student's cumulative GPA, credit hours, and per-course breakdown.
 * - Groups by courseId and picks the single most recent COMPLETED or FAILED enrollment.
 * - Prior attempts for retaken courses are superseded and excluded from GPA points and hours.
 * - FAILED courses with no subsequent retake count as 0.0 grade points toward attempted credit hours.
 */
export async function calculateStudentGpa(studentId: number): Promise<StudentGpaResult> {
  const enrollments = await prisma.enrollment.findMany({
    where: { studentId },
    include: {
      course: {
        select: {
          id: true,
          name: true,
          courseCode: true,
          credits: true,
        },
      },
    },
    orderBy: [
      { academicYear: 'asc' },
      { semester: 'asc' },
      { id: 'asc' },
    ],
  });

  // Group all enrollments by courseId
  const courseMap = new Map<number, typeof enrollments>();
  for (const e of enrollments) {
    const list = courseMap.get(e.courseId) || [];
    list.push(e);
    courseMap.set(e.courseId, list);
  }

  const courses: CourseGpaBreakdown[] = [];
  let totalPoints = 0;
  let totalCreditsAttempted = 0;
  let totalCreditsEarned = 0;

  for (const [courseId, courseEnrollments] of courseMap.entries()) {
    // Filter for completed or failed enrollments only (ignore in-progress ENROLLED, BLOCKED, WITHDRAWN)
    const qualifying = courseEnrollments.filter(
      (e) => e.status === 'COMPLETED' || e.status === 'FAILED'
    );

    if (qualifying.length === 0) {
      // Course is still in-progress, blocked, or withdrawn with no completed/failed attempt
      continue;
    }

    // Sort chronologically to identify the most recent attempt
    qualifying.sort((a, b) => {
      if (a.academicYear !== b.academicYear) {
        return a.academicYear - b.academicYear;
      }
      return a.semester - b.semester;
    });

    const countedAttempt = qualifying[qualifying.length - 1];
    const courseCredits = countedAttempt.course?.credits ?? 3;

    // Identify superseded prior attempts
    const supersededAttempts: SupersededAttempt[] = courseEnrollments
      .filter((e) => {
        if (e.id === countedAttempt.id) return false;
        // Prior if earlier academic year, or same year earlier semester, or same term earlier id
        if (e.academicYear < countedAttempt.academicYear) return true;
        if (e.academicYear === countedAttempt.academicYear && e.semester < countedAttempt.semester) return true;
        return e.academicYear === countedAttempt.academicYear && e.semester === countedAttempt.semester && e.id < countedAttempt.id;
      })
      .map((e) => ({
        academicYear: e.academicYear,
        semester: e.semester,
        finalGrade: e.finalGrade,
        status: e.status,
      }));

    const isRetake = supersededAttempts.length > 0;

    const { letterGrade, gradePoints } = getGradeScale(countedAttempt.finalGrade, countedAttempt.status);

    totalCreditsAttempted += courseCredits;
    if (countedAttempt.status === 'COMPLETED' && gradePoints > 0) {
      totalCreditsEarned += courseCredits;
    }
    totalPoints += gradePoints * courseCredits;

    courses.push({
      courseId,
      courseName: countedAttempt.course?.name || `Course ${courseId}`,
      courseCode: countedAttempt.course?.courseCode || `C-${courseId}`,
      credits: courseCredits,
      countedSemester: countedAttempt.semester,
      countedAcademicYear: countedAttempt.academicYear,
      finalGrade: countedAttempt.finalGrade,
      letterGrade,
      gradePoints,
      status: countedAttempt.status,
      isRetake,
      supersededAttempts,
    });
  }

  const rawGpa = totalCreditsAttempted > 0 ? totalPoints / totalCreditsAttempted : 0.0;
  const cumulativeGpa = Math.round(rawGpa * 100) / 100;
  const gpaString = rawGpa > 0 ? rawGpa.toFixed(2) : '0.00';

  return {
    studentId,
    cumulativeGpa,
    gpaString,
    totalPoints,
    totalCreditsEarned,
    totalCreditsAttempted,
    coursesCount: courses.length,
    courses,
  };
}
