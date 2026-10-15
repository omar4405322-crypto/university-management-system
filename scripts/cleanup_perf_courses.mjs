import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import prisma from './prisma_client.mjs';
import { createDatabaseBackup } from './backup_db.mjs';

/**
 * Safe cleanup of PERF* test courses (C4 / F-08).
 * Matches pattern: PERF followed by digits only (^PERF\d+$).
 * Dry-run by default; requires explicit --apply to delete.
 * In apply mode, backs up deleted rows to a JSON file before deleting.
 */
export async function runPerfCleanup(options = {}) {
  const { apply = false, backup = true } = options;

  // Retrieve all courses to test against pattern
  const allCourses = await prisma.course.findMany({
    include: {
      _count: {
        select: {
          enrollments: true,
          scheduleSlots: true,
          quizzes: true,
          exams: true,
          tasks: true,
        },
      },
    },
  });

  // Pattern: PERF followed by digits only (^PERF\d+$)
  const perfDigitRegex = /^PERF\d+$/;

  const candidateCourses = allCourses.filter((c) => perfDigitRegex.test(c.courseCode));

  const eligibleForPurge = [];
  const skippedCourses = [];

  for (const course of candidateCourses) {
    const hasReferences =
      course._count.enrollments > 0 ||
      course._count.scheduleSlots > 0 ||
      course._count.quizzes > 0 ||
      course._count.exams > 0 ||
      course._count.tasks > 0;

    if (hasReferences) {
      skippedCourses.push({
        id: course.id,
        courseCode: course.courseCode,
        name: course.name,
        counts: course._count,
        reason: 'Course has existing foreign-key references; preserving data',
      });
    } else {
      eligibleForPurge.push({
        id: course.id,
        courseCode: course.courseCode,
        name: course.name,
        fullRecord: course,
      });
    }
  }

  const report = {
    mode: apply ? 'APPLY' : 'DRY-RUN',
    totalCoursesChecked: allCourses.length,
    matchingPerfCandidates: candidateCourses.length,
    eligibleToPurgeCount: eligibleForPurge.length,
    eligibleCourses: eligibleForPurge.map((c) => ({ id: c.id, courseCode: c.courseCode, name: c.name })),
    skippedCount: skippedCourses.length,
    skippedCourses,
  };

  if (!apply) {
    console.log('[PERF CLEANUP DRY-RUN] Report:', JSON.stringify(report, null, 2));
    return {
      success: true,
      applied: false,
      ...report,
    };
  }

  // APPLY MODE: Back up deleted rows to a JSON file before deleting
  const backupDir = path.join(os.homedir(), 'Desktop', 'unicore_backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const deletedRowsBackupPath = path.join(backupDir, `perf_deleted_courses_${timestamp}.json`);
  fs.writeFileSync(
    deletedRowsBackupPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        eligibleCount: eligibleForPurge.length,
        courses: eligibleForPurge.map((c) => c.fullRecord),
      },
      null,
      2
    ),
    'utf8'
  );
  console.log(`[PERF CLEANUP] Backed up deleted rows to: ${deletedRowsBackupPath}`);

  let backupInfo = null;
  if (backup) {
    console.log('[PERF CLEANUP] Creating pre-cleanup database backup to Desktop...');
    backupInfo = await createDatabaseBackup();
  }

  // Delete orphan courses
  const purgedCourses = [];
  for (const course of eligibleForPurge) {
    await prisma.course.delete({
      where: { id: course.id },
    });
    purgedCourses.push({ id: course.id, courseCode: course.courseCode, name: course.name });
  }

  if (purgedCourses.length > 0) {
    await prisma.auditLog.create({
      data: {
        action: 'PERF_COURSES_PURGED',
        entity: 'Course',
        entityId: 'BATCH_PURGE',
        details: {
          purgedCount: purgedCourses.length,
          purgedCourses,
          skippedCount: skippedCourses.length,
          skippedCourses,
          backupFile: backupInfo?.backupFile,
          deletedRowsBackup: deletedRowsBackupPath,
        },
        userRole: 'SYSTEM',
        actorEmail: 'system:perf-cleanup-runner',
      },
    });
  }

  console.log(`[PERF CLEANUP] Purged ${purgedCourses.length} orphan PERF* test courses. Skipped ${skippedCourses.length} courses with references.`);

  return {
    success: true,
    applied: true,
    purgedCount: purgedCourses.length,
    skippedCount: skippedCourses.length,
    purgedCourses,
    skippedCourses,
    backupFile: backupInfo?.backupFile,
    deletedRowsBackup: deletedRowsBackupPath,
  };
}

function parseCliArgs() {
  const args = process.argv.slice(2);
  return {
    apply: args.includes('--apply'),
  };
}

if (process.argv[1] && process.argv[1].endsWith('cleanup_perf_courses.mjs')) {
  const options = parseCliArgs();
  runPerfCleanup(options)
    .then((res) => {
      console.log('PERF cleanup finished.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('PERF cleanup error:', err);
      process.exit(1);
    });
}
