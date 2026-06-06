const cron = require('node-cron');
const prisma = require('./prismaClient');
const logger = require('./logger');
const { createNotification } = require('./notification.utils');

/**
 * AI Risk Detection Job
 * Runs nightly at 2:00 AM
 */
const startRiskDetectionJob = () => {
  cron.schedule('0 2 * * *', async () => {
    logger.info('[CRON] Starting AI Risk Detection job');
    
    try {
      const BATCH_SIZE = 50;
      let cursor = null;
      let processedCount = 0;

      while (true) {
        const batch = await prisma.student.findMany({
          take: BATCH_SIZE,
          ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
          include: {
            attendance: { select: { status: true } },
            quizSubmissions: { select: { score: true } },
            taskSubmissions: { select: { taskId: true } },
            courses: {
              include: {
                tasks: { select: { id: true } }
              }
            }
          },
          orderBy: { id: 'asc' }
        });

        if (batch.length === 0) break;

        for (const student of batch) {
          // 1. Calculate Attendance Rate
          const totalClasses = student.attendance.length;
          const presentClasses = student.attendance.filter(a => a.status === 'PRESENT' || a.status === 'LATE').length;
          const attendanceRate = totalClasses > 0 ? (presentClasses / totalClasses) * 100 : 100;

          // 2. Calculate Average Quiz Score
          const quizScores = student.quizSubmissions.map(s => s.score).filter(s => s !== null);
          const averageQuizScore = quizScores.length > 0 ? (quizScores.reduce((a, b) => a + b, 0) / quizScores.length) : 100;

          // 3. Calculate Assignment Completion Rate
          const allAssignedTasks = student.courses.reduce((acc, course) => acc.concat(course.tasks), []);
          const totalAssignments = allAssignedTasks.length;
          const submittedTaskIds = new Set(student.taskSubmissions.map(s => s.taskId));
          const completedAssignments = allAssignedTasks.filter(t => submittedTaskIds.has(t.id)).length;
          const assignmentCompletionRate = totalAssignments > 0 ? (completedAssignments / totalAssignments) * 100 : 100;

          // 4. Determine Risk Level
          let predictedRisk = 'LOW';
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
              lastCalculated: new Date()
            },
            create: {
              studentId: student.id,
              attendanceRate,
              averageQuizScore,
              assignmentCompletionRate,
              predictedRisk,
              lastCalculated: new Date()
            }
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
                departmentId: student.departmentId
              }
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
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      logger.info(`[CRON] AI Risk Detection completed for ${processedCount} students`);
    } catch (err) {
      logger.error(`[CRON] AI Risk Detection error: ${err.message}`, { stack: err.stack });
    }
  });
};

module.exports = { startRiskDetectionJob };
