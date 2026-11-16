import type prisma from '../src/utils/prismaClient';

export type TermSwitchFixtureDb = typeof prisma;

export interface TermSwitchFixtureIds {
  termIds?: number[];
  yearId?: number;
  prevActiveYearId?: number;
  prevActiveTermId?: number;
  studentId?: number;
  courseId?: number;
  studentUserId?: number;
  superAdminId?: number;
  departmentId?: number;
  collegeId?: number;
}

function hasId(value: number | undefined | null): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

async function runTeardownStep(
  failures: string[],
  stepName: string,
  operation: () => Promise<unknown>,
): Promise<void> {
  try {
    await operation();
  } catch {
    failures.push(stepName);
  }
}

/**
 * Cleans up term-switch test fixtures in strict reverse dependency order while
 * restoring the previous active AcademicYear and AcademicTerm.
 * Never throws; returns the names of any failed steps.
 */
export async function teardownTermSwitchFixture(
  db: TermSwitchFixtureDb,
  ids: TermSwitchFixtureIds,
): Promise<string[]> {
  const failures: string[] = [];

  const termIds = Array.from(new Set((ids?.termIds ?? []).filter(hasId)));
  const yearId = hasId(ids?.yearId) ? ids.yearId : undefined;
  const prevActiveYearId = hasId(ids?.prevActiveYearId) ? ids.prevActiveYearId : undefined;
  const prevActiveTermId = hasId(ids?.prevActiveTermId) ? ids.prevActiveTermId : undefined;
  const studentId = hasId(ids?.studentId) ? ids.studentId : undefined;
  const courseId = hasId(ids?.courseId) ? ids.courseId : undefined;
  const studentUserId = hasId(ids?.studentUserId) ? ids.studentUserId : undefined;
  const superAdminId = hasId(ids?.superAdminId) ? ids.superAdminId : undefined;
  const departmentId = hasId(ids?.departmentId) ? ids.departmentId : undefined;
  const collegeId = hasId(ids?.collegeId) ? ids.collegeId : undefined;
  const userIds = Array.from(new Set([studentUserId, superAdminId].filter(hasId)));

  // (1) Deactivate fixture AcademicTerms
  if (termIds.length > 0) {
    await runTeardownStep(failures, 'deactivateFixtureTerms', () =>
      db.academicTerm.updateMany({
        where: { id: { in: termIds } },
        data: { isCurrent: false },
      }),
    );
  }

  // (2) Deactivate fixture AcademicYear
  if (yearId !== undefined) {
    await runTeardownStep(failures, 'deactivateFixtureYear', () =>
      db.academicYear.updateMany({
        where: { id: yearId },
        data: { isCurrent: false },
      }),
    );
  }

  // (3) Restore previous active AcademicYear
  if (prevActiveYearId !== undefined) {
    await runTeardownStep(failures, 'restorePrevActiveYear', () =>
      db.academicYear.update({
        where: { id: prevActiveYearId },
        data: { isCurrent: true },
      }),
    );
  }

  // (4) Restore previous active AcademicTerm
  if (prevActiveTermId !== undefined) {
    await runTeardownStep(failures, 'restorePrevActiveTerm', () =>
      db.academicTerm.update({
        where: { id: prevActiveTermId },
        data: { isCurrent: true },
      }),
    );
  }

  // (5) Delete Enrollments matching fixture termIds, studentId, or courseId
  const enrollmentOr: Array<
    { termId: { in: number[] } } | { studentId: number } | { courseId: number }
  > = [];
  if (termIds.length > 0) {
    enrollmentOr.push({ termId: { in: termIds } });
  }
  if (studentId !== undefined) {
    enrollmentOr.push({ studentId });
  }
  if (courseId !== undefined) {
    enrollmentOr.push({ courseId });
  }
  if (enrollmentOr.length > 0) {
    await runTeardownStep(failures, 'deleteEnrollments', () =>
      db.enrollment.deleteMany({
        where: { OR: enrollmentOr },
      }),
    );
  }

  // (6) Delete fixture Course
  if (courseId !== undefined) {
    await runTeardownStep(failures, 'deleteCourse', () =>
      db.course.deleteMany({
        where: { id: courseId },
      }),
    );
  }

  // (7) Delete fixture Student
  if (studentId !== undefined) {
    await runTeardownStep(failures, 'deleteStudent', () =>
      db.student.deleteMany({
        where: { id: studentId },
      }),
    );
  }

  // (8) Delete user-scoped AuditLog, Notification, and RefreshToken rows (each in its own step)
  if (userIds.length > 0) {
    await runTeardownStep(failures, 'deleteAuditLogs', () =>
      db.auditLog.deleteMany({
        where: { userId: { in: userIds } },
      }),
    );
    await runTeardownStep(failures, 'deleteNotifications', () =>
      db.notification.deleteMany({
        where: { userId: { in: userIds } },
      }),
    );
    await runTeardownStep(failures, 'deleteRefreshTokens', () =>
      db.refreshToken.deleteMany({
        where: { userId: { in: userIds } },
      }),
    );
  }

  // (9) Delete fixture Users
  if (userIds.length > 0) {
    await runTeardownStep(failures, 'deleteUsers', () =>
      db.user.deleteMany({
        where: { id: { in: userIds } },
      }),
    );
  }

  // (10) Delete fixture Department
  if (departmentId !== undefined) {
    await runTeardownStep(failures, 'deleteDepartment', () =>
      db.department.deleteMany({
        where: { id: departmentId },
      }),
    );
  }

  // (11) Delete fixture College
  if (collegeId !== undefined) {
    await runTeardownStep(failures, 'deleteCollege', () =>
      db.college.deleteMany({
        where: { id: collegeId },
      }),
    );
  }

  // (12) Delete fixture AcademicTerms in reverse order (term2 then term1) as separate steps
  for (const termId of [...termIds].reverse()) {
    await runTeardownStep(failures, `deleteAcademicTerm(${termId})`, () =>
      db.academicTerm.deleteMany({
        where: { id: termId },
      }),
    );
  }

  // (13) Delete fixture AcademicYear
  if (yearId !== undefined) {
    await runTeardownStep(failures, 'deleteAcademicYear', () =>
      db.academicYear.deleteMany({
        where: { id: yearId },
      }),
    );
  }

  return failures;
}
