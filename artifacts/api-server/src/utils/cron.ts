import cron, { type ScheduledTask } from 'node-cron';
import prisma from './prismaClient';
import logger from './logger';
import { createNotification } from './notification.utils';
import attendanceEngine from '../attendance/attendance.engine';
import { ConflictError } from './appError';
import { getCairoCalendarYear } from '../attendance/attendance.calculation';
import { getEffectiveActiveStudentWhere } from './scope.utils';
import { auditLog, SYSTEM_AUDIT_ACTORS } from './audit.utils';
import { withDistributedJobLease, CRON_TIMEZONE } from './distributedLock.utils';
export { CRON_TIMEZONE };

export interface CalculateAcademicRiskEnrollment {
  id: number;
  courseId: number;
  semester: number;
  academicYear: number;
  status: string;
  course?: {
    tasks?: Array<{ id: number; semester?: number; academicYear?: number }>;
  };
  quizSubmissions?: Array<{ score: number | null }>;
  taskSubmissions?: Array<{ taskId: number }>;
}

export interface CalculateAcademicRiskAttendance {
  status: string;
  courseId: number;
  semester?: number | null;
  academicYear?: number | null;
}

export interface CalculateAcademicRiskStudent {
  enrollments?: CalculateAcademicRiskEnrollment[];
  attendance?: CalculateAcademicRiskAttendance[];
}

export interface AcademicRiskResult {
  attendanceRate: number;
  averageQuizScore: number;
  assignmentCompletionRate: number;
  predictedRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

/**
 * BL-001: Scoped Academic Risk Calculation
 * Evaluates exclusively the student's authoritative CURRENT ACTIVE enrollment attempt.
 * Excludes historical FAILED, COMPLETED, WITHDRAWN/DROPPED attempts, previous attempts of retakes,
 * and historical tasks, quizzes, and attendance belonging to past offerings.
 */
export function calculateStudentRisk(student: CalculateAcademicRiskStudent): AcademicRiskResult {
  // 1. Filter strictly to ENROLLED status
  const enrolledAttempts = (student.enrollments || []).filter(
    (e) => e.status === 'ENROLLED'
  );

  if (enrolledAttempts.length === 0) {
    return {
      attendanceRate: 100,
      averageQuizScore: 100,
      assignmentCompletionRate: 100,
      predictedRisk: 'LOW',
    };
  }

  // 2. Resolve authoritative current offering per course (protect against multiple/stale ENROLLED records)
  const maxAcademicYear = Math.max(...enrolledAttempts.map((e) => e.academicYear));
  const currentYearAttempts = enrolledAttempts.filter(
    (e) => e.academicYear === maxAcademicYear
  );

  // Group by courseId and take the latest attempt (highest semester, highest id)
  const activeOfferingsByCourse = new Map<number, CalculateAcademicRiskEnrollment>();
  for (const enr of currentYearAttempts) {
    const existing = activeOfferingsByCourse.get(enr.courseId);
    if (!existing) {
      activeOfferingsByCourse.set(enr.courseId, enr);
    } else {
      if (
        enr.semester > existing.semester ||
        (enr.semester === existing.semester && enr.id > existing.id)
      ) {
        activeOfferingsByCourse.set(enr.courseId, enr);
      }
    }
  }

  const activeEnrollments = Array.from(activeOfferingsByCourse.values());

  // Set of offering keys: "courseId:semester:academicYear"
  const activeOfferingKeys = new Set(
    activeEnrollments.map((e) => `${e.courseId}:${e.semester}:${e.academicYear}`)
  );

  // 3. Calculate Attendance Rate scoped strictly to active offerings
  const scopedAttendance = (student.attendance || []).filter(
    (a) =>
      a.semester != null &&
      a.academicYear != null &&
      activeOfferingKeys.has(`${a.courseId}:${a.semester}:${a.academicYear}`)
  );

  const totalClasses = scopedAttendance.length;
  const presentClasses = scopedAttendance.filter(
    (a) => a.status === 'PRESENT' || a.status === 'LATE'
  ).length;
  const attendanceRate = totalClasses > 0 ? (presentClasses / totalClasses) * 100 : 100;

  // 4. Calculate Average Quiz Score scoped strictly to active enrollments
  const quizScores = activeEnrollments
    .flatMap((e) => e.quizSubmissions || [])
    .map((s) => s.score)
    .filter((s): s is number => s !== null && s !== undefined);
  const averageQuizScore =
    quizScores.length > 0
      ? quizScores.reduce((a, b) => a + b, 0) / quizScores.length
      : 100;

  // 5. Calculate Assignment Completion Rate scoped strictly to active offerings
  const allAssignedTasks = activeEnrollments.flatMap((enr) =>
    (enr.course?.tasks || []).filter(
      (t) =>
        (t.semester === undefined || t.semester === enr.semester) &&
        (t.academicYear === undefined || t.academicYear === enr.academicYear)
    )
  );
  const totalAssignments = allAssignedTasks.length;
  const submittedTaskIds = new Set(
    activeEnrollments.flatMap((e) => e.taskSubmissions || []).map((s) => s.taskId)
  );
  const completedAssignments = allAssignedTasks.filter((t) =>
    submittedTaskIds.has(t.id)
  ).length;
  const assignmentCompletionRate =
    totalAssignments > 0 ? (completedAssignments / totalAssignments) * 100 : 100;

  // 6. Determine Risk Level
  let predictedRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
  if (attendanceRate < 50 || averageQuizScore < 40) {
    predictedRisk = 'CRITICAL';
  } else if (attendanceRate < 65 || averageQuizScore < 55) {
    predictedRisk = 'HIGH';
  } else if (attendanceRate < 80 || averageQuizScore < 70) {
    predictedRisk = 'MEDIUM';
  }

  return {
    attendanceRate,
    averageQuizScore,
    assignmentCompletionRate,
    predictedRisk,
  };
}

const activeCronTasks: ScheduledTask[] = [];

export const getActiveCronTasksCount = (): number => activeCronTasks.length;

export const stopAllCronJobs = (): void => {
  for (const task of activeCronTasks) {
    try {
      task.stop();
    } catch {
      // Ignore stop errors
    }
  }
  activeCronTasks.length = 0;
  logger.info("[CRON] Stopped all scheduled cron jobs");
};

/**
 * AI Risk Detection Job
 * Runs nightly at 2:00 AM
 */
export const startRiskDetectionJob = (): ScheduledTask => {
  const task = cron.schedule(
    '0 2 * * *',
    async () => {
      await withDistributedJobLease('risk-detection', 3600, async () => {
        logger.info('[CRON] Starting AI Risk Detection job');

        try {
          const BATCH_SIZE = 50;
          let cursor: number | null = null;
          let processedCount = 0;

          while (true) {
            const batch: any[] = await prisma.student.findMany({
              where: getEffectiveActiveStudentWhere(),
              take: BATCH_SIZE,
              ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
              include: {
                attendance: {
                  select: {
                    status: true,
                    courseId: true,
                    semester: true,
                    academicYear: true,
                  },
                },
                enrollments: {
                  where: { status: 'ENROLLED' },
                  include: {
                    course: {
                      include: {
                        tasks: {
                          where: { isDeleted: false },
                          select: { id: true, semester: true, academicYear: true },
                        },
                      },
                    },
                    quizSubmissions: { select: { score: true } },
                    taskSubmissions: {
                      where: { task: { isDeleted: false } },
                      select: { taskId: true },
                    },
                  },
                },
              },
              orderBy: { id: 'asc' },
            });

            if (batch.length === 0) break;

            for (const student of batch) {
              const {
                attendanceRate,
                averageQuizScore,
                assignmentCompletionRate,
                predictedRisk,
              } = calculateStudentRisk(student);

              // Update Success Metrics
              await prisma.studentSuccessMetric.upsert({
                where: { studentId: student.id },
                update: {
                  attendanceRate,
                  averageQuizScore,
                  assignmentCompletionRate,
                  predictedRisk,
                  lastCalculated: new Date(),
                },
                create: {
                  studentId: student.id,
                  attendanceRate,
                  averageQuizScore,
                  assignmentCompletionRate,
                  predictedRisk,
                  lastCalculated: new Date(),
                },
              });

              // 6. Send Notifications for At-Risk Students
              if (['CRITICAL', 'HIGH'].includes(predictedRisk)) {
                // Notify Student
                await createNotification({
                  userId: student.userId,
                  title: 'Academic Alert',
                  message: `Our system detected a ${predictedRisk} risk to your academic progress. Please contact your advisor.`,
                });

                // Notify Department Admin
                const deptAdmin = await prisma.user.findFirst({
                  where: {
                    role: 'DEPARTMENT_ADMIN',
                    departmentId: student.departmentId,
                  },
                });

                if (deptAdmin) {
                  await createNotification({
                    userId: deptAdmin.id,
                    title: 'At-Risk Student Detected',
                    message: `Student ${student.firstName} ${student.lastName} (${student.studentId}) is flagged as ${predictedRisk} risk.`,
                  });
                }
              }
            }

            processedCount += batch.length;
            cursor = batch[batch.length - 1].id;

            // Small delay between batches to avoid DB lock contention
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          logger.info(`[CRON] AI Risk Detection completed for ${processedCount} students`);
        } catch (err: any) {
          logger.error(`[CRON] AI Risk Detection error: ${err.message}`, { stack: err.stack });
        }
      });
    },
    { timezone: CRON_TIMEZONE }
  );
  activeCronTasks.push(task);
  return task;
};

/**
 * Auto-expiry Job for Attendance Sessions
 * Runs every 5 minutes to close sessions past their expiresAt
 */
export const startSessionAutoExpiryJob = (): ScheduledTask => {
  const task = cron.schedule(
    '*/5 * * * *',
    async () => {
      await withDistributedJobLease('session-auto-expiry', 240, async () => {
        try {
          const closedCount = await closeExpiredAttendanceSessions();
          if (closedCount > 0) {
            logger.info(`[CRON] Auto-expired ${closedCount} attendance sessions`);
          }
        } catch (err: any) {
          logger.error(`[CRON] Auto-expiry Job error: ${err.message}`);
        }
      });
    },
    { timezone: CRON_TIMEZONE }
  );
  activeCronTasks.push(task);
  return task;
};

export const closeExpiredAttendanceSessions = async (
  now: Date = new Date()
): Promise<number> => {
  const sessions = await prisma.attendanceSession.findMany({
    where: { isActive: true, expiresAt: { lte: now } },
    select: {
      id: true,
      createdAt: true,
      scheduleSlot: {
        select: {
          courseId: true,
          course: { select: { semester: true } },
          timetable: { select: { semester: true } },
        },
      },
    },
  });
  if (sessions.length === 0) return 0;

  const result = await prisma.attendanceSession.updateMany({
    where: {
      id: { in: sessions.map((session) => session.id) },
      isActive: true,
      expiresAt: { lte: now },
    },
    data: { isActive: false },
  });

  // Idempotency guard: if another worker already closed the sessions, skip recalculation
  if (result.count === 0) {
    return 0;
  }

  const attempts = new Map<string, {
    courseId: number;
    semester: number;
    academicYear: number;
  }>();
  for (const session of sessions) {
    const semester =
      session.scheduleSlot.timetable?.semester ??
      session.scheduleSlot.course.semester;
    const academicYear = getCairoCalendarYear(session.createdAt);
    attempts.set(`${session.scheduleSlot.courseId}:${semester}:${academicYear}`, {
      courseId: session.scheduleSlot.courseId,
      semester,
      academicYear,
    });
  }
  await Promise.all(
    [...attempts.values()].map((attempt) =>
      attendanceEngine.queueCourseAttemptRecalculation(
        attempt.courseId,
        attempt.semester,
        attempt.academicYear
      )
    )
  );
  return result.count;
};

/**
 * Core auto-resolve logic for PENDING_REVIEW records older than 5 calendar days.
 * Sets status to ABSENT, clears pendingApprovedStatus, sets locationFlagged to false,
 * and triggers attendanceEngine.recalculateAbsence for affected student/course pairs.
 * Note: School-day tracking doesn't exist in this codebase; calendar days are used as a documented simplification.
 */
export const autoResolvePendingAttendance = async (
  cutoffDate?: Date
): Promise<number> => {
  const cutoff = cutoffDate || new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);

  const expiredRecords = await prisma.attendance.findMany({
    where: {
      status: 'PENDING_REVIEW',
      createdAt: { lte: cutoff },
    },
    select: {
      id: true,
      studentId: true,
      courseId: true,
      semester: true,
      academicYear: true,
    },
  });

  if (expiredRecords.length === 0) {
    return 0;
  }

  const resolvedRecords: typeof expiredRecords = [];
  for (const record of expiredRecords) {
    try {
      await prisma.$transaction(async (tx) => {
        const updated = await tx.attendance.updateMany({
          where: {
            id: record.id,
            status: 'PENDING_REVIEW',
            locationFlagged: true,
            createdAt: { lte: cutoff },
          },
          data: {
            status: 'ABSENT',
            pendingApprovedStatus: null,
            locationFlagged: false,
            overrideNote: 'Auto-resolved to ABSENT after 5 calendar days review window',
          },
        });
        if (updated.count !== 1) {
          throw new ConflictError(
            `Attendance record ${record.id} was resolved concurrently`
          );
        }
        await auditLog(
          'AUTO_RESOLVE_ATTENDANCE',
          'Attendance',
          record.id,
          { ...SYSTEM_AUDIT_ACTORS.ATTENDANCE_CRON },
          {
            status: { from: 'PENDING_REVIEW', to: 'ABSENT' },
            locationFlagged: { from: true, to: false },
            process: 'pending-review-auto-resolve',
          },
          tx
        );
      });
      resolvedRecords.push(record);
    } catch (error) {
      if (error instanceof ConflictError) continue;
      throw error;
    }
  }

  const affectedAttempts = new Map<string, (typeof resolvedRecords)[number]>();
  for (const record of resolvedRecords) {
    affectedAttempts.set(
      `${record.studentId}:${record.courseId}:${record.semester ?? '*'}:${record.academicYear ?? '*'}`,
      record
    );
  }

  for (const record of affectedAttempts.values()) {
    try {
      await attendanceEngine.recalculateAbsence(
        record.studentId,
        record.courseId,
        record.semester,
        record.academicYear
      );
    } catch (err: any) {
      logger.error(
        `[CRON] Failed to recalculate absence for student ${record.studentId} course ${record.courseId}: ${err.message}`
      );
    }
  }

  return resolvedRecords.length;
};

/**
 * Scheduled job to auto-resolve PENDING_REVIEW attendance records older than 5 calendar days.
 * Runs daily at 3:00 AM.
 */
export const startPendingReviewAutoResolveJob = (): ScheduledTask => {
  const task = cron.schedule(
    '0 3 * * *',
    async () => {
      await withDistributedJobLease('pending-review-auto-resolve', 3600, async () => {
        logger.info('[CRON] Starting Pending Review Auto-Resolve job');
        try {
          const resolvedCount = await autoResolvePendingAttendance();
          if (resolvedCount > 0) {
            logger.info(
              `[CRON] Auto-resolved ${resolvedCount} pending attendance records to ABSENT`
            );
          }
        } catch (err: any) {
          logger.error(`[CRON] Pending Review Auto-Resolve Job error: ${err.message}`);
        }
      });
    },
    { timezone: CRON_TIMEZONE }
  );
  activeCronTasks.push(task);
  return task;
};
