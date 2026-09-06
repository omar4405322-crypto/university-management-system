import cron from 'node-cron';
import prisma from './prismaClient';
import logger from './logger';
import { createNotification } from './notification.utils';
import attendanceEngine from '../attendance/attendance.engine';

/**
 * AI Risk Detection Job
 * Runs nightly at 2:00 AM
 */
export const startRiskDetectionJob = (): void => {
  cron.schedule('0 2 * * *', async () => {
    logger.info('[CRON] Starting AI Risk Detection job');

    try {
      const BATCH_SIZE = 50;
      let cursor: number | null = null;
      let processedCount = 0;

      while (true) {
        const batch: any[] = await prisma.student.findMany({
          take: BATCH_SIZE,
          ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
          include: {
            attendance: { select: { status: true } },
            quizSubmissions: { select: { score: true } },
            taskSubmissions: { select: { taskId: true } },
            enrollments: {
              include: {
                course: {
                  include: {
                    tasks: { select: { id: true } },
                  },
                },
              },
            },
          },
          orderBy: { id: 'asc' },
        });

        if (batch.length === 0) break;

        for (const student of batch) {
          // 1. Calculate Attendance Rate
          const totalClasses = student.attendance.length;
          const presentClasses = student.attendance.filter(
            (a: any) => a.status === 'PRESENT' || a.status === 'LATE'
          ).length;
          const attendanceRate = totalClasses > 0 ? (presentClasses / totalClasses) * 100 : 100;

          // 2. Calculate Average Quiz Score
          const quizScores = student.quizSubmissions
            .map((s: any) => s.score)
            .filter((s: any) => s !== null) as number[];
          const averageQuizScore =
            quizScores.length > 0 ? quizScores.reduce((a, b) => a + b, 0) / quizScores.length : 100;

          // 3. Calculate Assignment Completion Rate
          const allAssignedTasks = student.enrollments.reduce(
            (acc: any[], enr: any) => acc.concat(enr.course.tasks),
            [] as { id: number }[]
          );
          const totalAssignments = allAssignedTasks.length;
          const submittedTaskIds = new Set(student.taskSubmissions.map((s: any) => s.taskId));
          const completedAssignments = allAssignedTasks.filter((t: any) =>
            submittedTaskIds.has(t.id)
          ).length;
          const assignmentCompletionRate =
            totalAssignments > 0 ? (completedAssignments / totalAssignments) * 100 : 100;

          // 4. Determine Risk Level
          let predictedRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
          if (attendanceRate < 50 || averageQuizScore < 40) {
            predictedRisk = 'CRITICAL';
          } else if (attendanceRate < 65 || averageQuizScore < 55) {
            predictedRisk = 'HIGH';
          } else if (attendanceRate < 80 || averageQuizScore < 70) {
            predictedRisk = 'MEDIUM';
          }

          // 5. Update Success Metrics
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
};

/**
 * Auto-expiry Job for Attendance Sessions
 * Runs every 5 minutes to close sessions past their expiresAt
 */
export const startSessionAutoExpiryJob = (): void => {
  cron.schedule('*/5 * * * *', async () => {
    try {
      const result = await prisma.attendanceSession.updateMany({
        where: {
          isActive: true,
          expiresAt: { lte: new Date() }
        },
        data: { isActive: false }
      });
      if (result.count > 0) {
        logger.info(`[CRON] Auto-expired ${result.count} attendance sessions`);
      }
    } catch (err: any) {
      logger.error(`[CRON] Auto-expiry Job error: ${err.message}`);
    }
  });
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
    },
  });

  if (expiredRecords.length === 0) {
    return 0;
  }

  const expiredIds = expiredRecords.map((r) => r.id);

  await prisma.attendance.updateMany({
    where: { id: { in: expiredIds } },
    data: {
      status: 'ABSENT',
      pendingApprovedStatus: null,
      locationFlagged: false,
      overrideNote: 'Auto-resolved to ABSENT after 5 calendar days review window',
    },
  });

  const affectedPairs = new Set<string>();
  expiredRecords.forEach((r) =>
    affectedPairs.add(`${r.studentId}:${r.courseId}`)
  );

  for (const pair of affectedPairs) {
    const [studentIdStr, courseIdStr] = pair.split(':');
    try {
      await attendanceEngine.recalculateAbsence(
        parseInt(studentIdStr),
        parseInt(courseIdStr)
      );
    } catch (err: any) {
      logger.error(
        `[CRON] Failed to recalculate absence for student ${studentIdStr} course ${courseIdStr}: ${err.message}`
      );
    }
  }

  return expiredRecords.length;
};

/**
 * Scheduled job to auto-resolve PENDING_REVIEW attendance records older than 5 calendar days.
 * Runs daily at 3:00 AM.
 */
export const startPendingReviewAutoResolveJob = (): void => {
  cron.schedule('0 3 * * *', async () => {
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
};

