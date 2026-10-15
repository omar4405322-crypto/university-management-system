import prisma from './prisma_client.mjs';

/**
 * CLI-driven academic term backfill script (C1 / OD-14).
 * ZERO hard-coded dates or names. Requires explicit owner inputs.
 * Defaults to dry-run unless --apply is passed.
 */
export async function runBackfill(options = {}) {
  const {
    yearName,
    yearStartDate: rawYearStart,
    yearEndDate: rawYearEnd,
    termName,
    termStartDate: rawTermStart,
    termEndDate: rawTermEnd,
    semesterNumber: rawSemester,
    termType = 'FALL',
    apply = false,
  } = options;

  if (!yearName || !rawYearStart || !rawYearEnd || !termName || !rawTermStart || !rawTermEnd || rawSemester === undefined) {
    throw new Error(
      'Missing required calendar parameters. yearName, yearStartDate, yearEndDate, termName, termStartDate, termEndDate, and semesterNumber must be explicitly provided. Hardcoded defaults are forbidden (OD-14).'
    );
  }

  const yearStartDate = new Date(rawYearStart);
  const yearEndDate = new Date(rawYearEnd);
  const termStartDate = new Date(rawTermStart);
  const termEndDate = new Date(rawTermEnd);
  const semesterNumber = Number(rawSemester);

  if (isNaN(yearStartDate.getTime()) || isNaN(yearEndDate.getTime()) || isNaN(termStartDate.getTime()) || isNaN(termEndDate.getTime())) {
    throw new Error('Invalid date format provided.');
  }

  if (termStartDate >= termEndDate) {
    throw new Error('termStartDate must be before termEndDate.');
  }

  if (yearStartDate >= yearEndDate) {
    throw new Error('yearStartDate must be before yearEndDate.');
  }

  // Derive calendar year integer for matching legacy rows (e.g. 2026 from 2026-09-15)
  const calendarYearInt = termStartDate.getFullYear();

  // 1. Inspect unlinked legacy rows in all 4 models
  const [unlinkedEnrollments, unlinkedQuizzes, unlinkedExams, unlinkedTasks] = await Promise.all([
    prisma.enrollment.findMany({
      where: { termId: null },
      select: { id: true, academicYear: true, semester: true },
    }),
    prisma.quiz.findMany({
      where: { termId: null },
      select: { id: true, academicYear: true, semester: true },
    }),
    prisma.exam.findMany({
      where: { termId: null },
      select: { id: true, academicYear: true, semester: true },
    }),
    prisma.task.findMany({
      where: { termId: null },
      select: { id: true, academicYear: true, semester: true },
    }),
  ]);

  const matchesKey = (row) => row.academicYear === calendarYearInt && row.semester === semesterNumber;

  const matchedEnrollmentIds = unlinkedEnrollments.filter(matchesKey).map((r) => r.id);
  const unmappedEnrollments = unlinkedEnrollments.filter((r) => !matchesKey(r));

  const matchedQuizIds = unlinkedQuizzes.filter(matchesKey).map((r) => r.id);
  const unmappedQuizzes = unlinkedQuizzes.filter((r) => !matchesKey(r));

  const matchedExamIds = unlinkedExams.filter(matchesKey).map((r) => r.id);
  const unmappedExams = unlinkedExams.filter((r) => !matchesKey(r));

  const matchedTaskIds = unlinkedTasks.filter(matchesKey).map((r) => r.id);
  const unmappedTasks = unlinkedTasks.filter((r) => !matchesKey(r));

  const report = {
    mode: apply ? 'APPLY' : 'DRY-RUN',
    targetCalendarYear: calendarYearInt,
    targetSemester: semesterNumber,
    termName,
    yearName,
    matchedCounts: {
      enrollments: matchedEnrollmentIds.length,
      quizzes: matchedQuizIds.length,
      exams: matchedExamIds.length,
      tasks: matchedTaskIds.length,
    },
    unmappedCounts: {
      enrollments: unmappedEnrollments.length,
      quizzes: unmappedQuizzes.length,
      exams: unmappedExams.length,
      tasks: unmappedTasks.length,
    },
    unmappedDetails: {
      enrollments: unmappedEnrollments,
      quizzes: unmappedQuizzes,
      exams: unmappedExams,
      tasks: unmappedTasks,
    },
  };

  if (!apply) {
    console.log('[BACKFILL DRY-RUN] Report:', JSON.stringify(report, null, 2));
    return report;
  }

  // --- APPLY MODE: Idempotently upsert year and term, then update matching rows ---
  let academicYear = await prisma.academicYear.findUnique({
    where: { name: yearName },
  });

  if (!academicYear) {
    const hasActiveYear = await prisma.academicYear.findFirst({ where: { isCurrent: true } });
    academicYear = await prisma.academicYear.create({
      data: {
        name: yearName,
        startDate: yearStartDate,
        endDate: yearEndDate,
        isCurrent: !hasActiveYear,
      },
    });
  }

  let academicTerm = await prisma.academicTerm.findFirst({
    where: { academicYearId: academicYear.id, semesterNumber },
  });

  if (!academicTerm) {
    const hasActiveTerm = await prisma.academicTerm.findFirst({ where: { isCurrent: true } });
    academicTerm = await prisma.academicTerm.create({
      data: {
        academicYearId: academicYear.id,
        name: termName,
        termType,
        semesterNumber,
        startDate: termStartDate,
        endDate: termEndDate,
        isCurrent: !hasActiveTerm,
      },
    });
  }

  // Transactionally stamp termId on matching rows only
  const [enrUpdate, qzUpdate, exUpdate, tkUpdate] = await prisma.$transaction([
    prisma.enrollment.updateMany({
      where: { id: { in: matchedEnrollmentIds } },
      data: { termId: academicTerm.id },
    }),
    prisma.quiz.updateMany({
      where: { id: { in: matchedQuizIds } },
      data: { termId: academicTerm.id },
    }),
    prisma.exam.updateMany({
      where: { id: { in: matchedExamIds } },
      data: { termId: academicTerm.id },
    }),
    prisma.task.updateMany({
      where: { id: { in: matchedTaskIds } },
      data: { termId: academicTerm.id },
    }),
  ]);

  // Log audit
  await prisma.auditLog.create({
    data: {
      action: 'BACKFILL_EXECUTED',
      entity: 'AcademicTerm',
      entityId: String(academicTerm.id),
      details: {
        termName: academicTerm.name,
        semesterNumber,
        calendarYearInt,
        updatedEnrollments: enrUpdate.count,
        updatedQuizzes: qzUpdate.count,
        updatedExams: exUpdate.count,
        updatedTasks: tkUpdate.count,
        unmappedCount:
          unmappedEnrollments.length +
          unmappedQuizzes.length +
          unmappedExams.length +
          unmappedTasks.length,
      },
      userRole: 'SYSTEM',
      actorEmail: 'system:backfill-runner',
    },
  });

  return {
    ...report,
    applied: true,
    termId: academicTerm.id,
    academicYearId: academicYear.id,
    updatedCounts: {
      enrollments: enrUpdate.count,
      quizzes: qzUpdate.count,
      exams: exUpdate.count,
      tasks: tkUpdate.count,
    },
  };
}

function parseCliArgs() {
  const args = process.argv.slice(2);
  const options = { apply: false };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--apply') {
      options.apply = true;
    } else if (arg === '--year-name' && args[i + 1]) {
      options.yearName = args[++i];
    } else if (arg === '--year-start' && args[i + 1]) {
      options.yearStartDate = args[++i];
    } else if (arg === '--year-end' && args[i + 1]) {
      options.yearEndDate = args[++i];
    } else if (arg === '--term-name' && args[i + 1]) {
      options.termName = args[++i];
    } else if (arg === '--term-start' && args[i + 1]) {
      options.termStartDate = args[++i];
    } else if (arg === '--term-end' && args[i + 1]) {
      options.termEndDate = args[++i];
    } else if (arg === '--semester' && args[i + 1]) {
      options.semesterNumber = Number(args[++i]);
    } else if (arg === '--term-type' && args[i + 1]) {
      options.termType = args[++i];
    }
  }

  return options;
}

if (process.argv[1] && process.argv[1].endsWith('backfill_initial_term.mjs')) {
  const options = parseCliArgs();
  runBackfill(options)
    .then((res) => {
      console.log('Backfill process complete.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Backfill error:', err.message);
      process.exit(1);
    });
}
