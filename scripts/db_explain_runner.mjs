import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: 'artifacts/api-server/.env' });

const prisma = new PrismaClient();

async function main() {
  try {
    const versionRes = await prisma.$queryRawUnsafe('SELECT version(), current_database()');
    console.log('PostgreSQL Version & Database:', versionRes);

    // 1. Table Row Counts
    const tables = [
      'User', 'Student', 'Doctor', 'TeachingAssistant', 'College', 'Department',
      'Course', 'Enrollment', 'Attendance', 'AttendanceSession',
      'ScheduleSlot', 'ScheduleOverride', 'Timetable', 'Exam', 'ExamQuestion',
      'ExamSubmission', 'ExamViolation', 'Quiz', 'QuizSubmission',
      'Task', 'TaskSubmission', 'Payment', 'Notification', 'AuditLog'
    ];

    console.log('\n--- CURRENT ROW COUNTS ---');
    for (const tbl of tables) {
      try {
        const countRes = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int as count FROM "${tbl}"`);
        console.log(`${tbl.padEnd(25)}: ${countRes[0].count} rows`);
      } catch (e) {
        console.log(`${tbl.padEnd(25)}: [Table not found or error]`);
      }
    }

    // 2. EXPLAIN queries for major workload queries
    console.log('\n--- EXPLAIN PLANS FOR MAJOR WORKLOAD QUERIES ---');

    // Query 1: Student List / Search
    console.log('\n1. Student Search: ILIKE with leading wildcard on firstName/lastName/studentId');
    const q1 = `
      EXPLAIN (ANALYZE, BUFFERS)
      SELECT s.id, s."firstName", s."lastName", s."studentId", s."departmentId"
      FROM "Student" s
      JOIN "User" u ON s."userId" = u.id
      WHERE (
        s."firstName" ILIKE '%john%' OR
        s."lastName" ILIKE '%john%' OR
        s."studentId" ILIKE '%john%' OR
        u.email ILIKE '%john%'
      )
      LIMIT 10;
    `;
    const plan1 = await prisma.$queryRawUnsafe(q1);
    console.log(plan1.map(r => r['QUERY PLAN']).join('\n'));

    // Query 2: Attendance Duplicate Device Check
    console.log('\n2. Attendance Duplicate Device Check (sessionId, deviceId)');
    const q2 = `
      EXPLAIN (ANALYZE, BUFFERS)
      SELECT id, status, "deviceId"
      FROM "Attendance"
      WHERE "sessionId" = 1 AND "deviceId" = 'device-abc-123' AND "studentId" != 10;
    `;
    const plan2 = await prisma.$queryRawUnsafe(q2);
    console.log(plan2.map(r => r['QUERY PLAN']).join('\n'));

    // Query 3: Schedule Slot Conflict by Room & Day
    console.log('\n3. Schedule Slot Conflict by Day, Room, and Time Overlap');
    const q3 = `
      EXPLAIN (ANALYZE, BUFFERS)
      SELECT id, "dayOfWeek", room, "startTime", "endTime"
      FROM "ScheduleSlot"
      WHERE "dayOfWeek" = 'MONDAY'
        AND "isArchived" = false
        AND LOWER(room) = 'lab 1'
        AND "startTime" < '12:00'
        AND "endTime" > '10:00';
    `;
    const plan3 = await prisma.$queryRawUnsafe(q3);
    console.log(plan3.map(r => r['QUERY PLAN']).join('\n'));

    // Query 4: Payment Filter by status and student
    console.log('\n4. Payment Filter by studentId and status');
    const q4 = `
      EXPLAIN (ANALYZE, BUFFERS)
      SELECT id, amount, status, "createdAt"
      FROM "Payment"
      WHERE "studentId" = 5 AND status = 'COMPLETED'
      ORDER BY "createdAt" DESC
      LIMIT 20;
    `;
    const plan4 = await prisma.$queryRawUnsafe(q4);
    console.log(plan4.map(r => r['QUERY PLAN']).join('\n'));

    // Query 5: Monthly Enrollment Aggregate
    console.log('\n5. Monthly Enrollment Trends Aggregate');
    const q5 = `
      EXPLAIN (ANALYZE, BUFFERS)
      SELECT DATE_TRUNC('month', s."enrolledAt") AS "month",
             COUNT(*)::bigint AS "count"
      FROM "Student" s
      GROUP BY DATE_TRUNC('month', s."enrolledAt")
      ORDER BY "month" ASC;
    `;
    const plan5 = await prisma.$queryRawUnsafe(q5);
    console.log(plan5.map(r => r['QUERY PLAN']).join('\n'));

  } catch (err) {
    console.error('Error running DB explains:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
