import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import prisma from './prisma_client.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backupDir = path.join(process.env.USERPROFILE || 'C:\\Users\\omar4', 'Desktop', 'unicore_backups');

export async function createDatabaseBackup() {
  await fs.mkdir(backupDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(backupDir, `db_backup_${timestamp}.json`);

  console.log(`Starting database backup to ${backupFile}...`);

  const tables = {
    users: await prisma.user.findMany(),
    colleges: await prisma.college.findMany(),
    departments: await prisma.department.findMany(),
    students: await prisma.student.findMany(),
    courses: await prisma.course.findMany(),
    enrollments: await prisma.enrollment.findMany(),
    quizzes: await prisma.quiz.findMany(),
    exams: await prisma.exam.findMany(),
    tasks: await prisma.task.findMany(),
    scheduleSlots: await prisma.scheduleSlot.findMany(),
    academicYears: await prisma.academicYear.findMany(),
    academicTerms: await prisma.academicTerm.findMany(),
  };

  const metadata = {
    timestamp: new Date().toISOString(),
    recordCounts: Object.fromEntries(
      Object.entries(tables).map(([key, val]) => [key, val.length])
    ),
  };

  const payload = {
    metadata,
    data: tables,
  };

  await fs.writeFile(backupFile, JSON.stringify(payload, null, 2), 'utf8');
  console.log('Database backup completed successfully:', metadata.recordCounts);

  return { backupFile, metadata };
}

// Allow CLI execution
if (process.argv[1] && process.argv[1].endsWith('backup_db.mjs')) {
  createDatabaseBackup()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Backup failed:', err);
      process.exit(1);
    });
}
