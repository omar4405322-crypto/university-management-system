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
      const students = await prisma.student.findMany({
        include: {
          attendance: true,
          quizSubmissions: true,
          taskSubmissions: { include: { task: true } },
          successMetric: true
        }
      });

      for (const student of students) {
        // 1. Calculate Attendance Rate
        const totalClasses = student.attendance.length;
        const presentClasses = student.attendance.filter(a => a.status === 'PRESENT' || a.status === 'LATE').length;
        const attendanceRate = totalClasses > 0 ? (presentClasses / totalClasses) * 100 : 100;

        // 2. Calculate Average Quiz Score
        const quizScores = student.quizSubmissions.map(s => s.score);
        const averageQuizScore = quizScores.length > 0 ? (quizScores.reduce((a, b) => a + b, 0) / quizScores.length) : 100;

        // 3. Calculate Assignment Completion Rate
        const totalAssignments = student.taskSubmissions.length;
        const completedAssignments = student.taskSubmissions.filter(s => s.status === 'GRADED' || s.status === 'SUBMITTED').length;
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
            lastUpdated: new Date()
          },
          create: {
            studentId: student.id,
            attendanceRate,
            averageQuizScore,
            assignmentCompletionRate,
            predictedRisk,
            lastUpdated: new Date()
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

      logger.info(`[CRON] AI Risk Detection completed for ${students.length} students`);
    } catch (err) {
      logger.error(`[CRON] AI Risk Detection error: ${err.message}`);
    }
  });
};

module.exports = { startRiskDetectionJob };
