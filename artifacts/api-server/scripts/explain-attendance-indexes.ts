import prisma from '../src/utils/prismaClient';

type PlanNode = { 'Node Type'?: string; 'Index Name'?: string; Plans?: PlanNode[] };
const planResults: string[] = [];

function indexNames(node: PlanNode): string[] {
  return [
    ...(node['Index Name'] ? [node['Index Name']] : []),
    ...(node.Plans?.flatMap(indexNames) ?? []),
  ];
}

try {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "Attendance_studentId_courseId_date_idx" ON "Attendance"("studentId", "courseId", "date")');
    await tx.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "Attendance_studentId_date_status_idx" ON "Attendance"("studentId", "date", "status")');
    await tx.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "Attendance_sessionId_ipAddress_deviceId_idx" ON "Attendance"("sessionId", "ipAddress", "deviceId")');
    await tx.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "Enrollment_courseId_status_idx" ON "Enrollment"("courseId", "status")');
    await tx.$executeRawUnsafe('DROP INDEX IF EXISTS "Attendance_studentId_courseId_idx"');
    await tx.$executeRawUnsafe('DROP INDEX IF EXISTS "Attendance_sessionId_idx"');
    await tx.$executeRawUnsafe('DROP INDEX IF EXISTS "Enrollment_courseId_idx"');
    await tx.$executeRawUnsafe('SET LOCAL enable_seqscan = off');

    const checks = [
      ['attendance student/course/date', 'SELECT "status", COUNT(*) FROM "Attendance" WHERE "studentId" = 1 AND "courseId" = 1 GROUP BY "status"'],
      ['attendance student/date/status', 'SELECT "id" FROM "Attendance" WHERE "studentId" = 1 AND "date" = TIMESTAMP \'2026-09-01 00:00:00\' AND "status" IN (\'PRESENT\', \'LATE\')'],
      ['attendance session/ip/device', 'SELECT "id" FROM "Attendance" WHERE "sessionId" = 1 AND "ipAddress" = \'127.0.0.1\' AND "deviceId" = \'plan-check\' AND "studentId" <> 1'],
      ['enrollment course/status', 'SELECT "id" FROM "Enrollment" WHERE "courseId" = 1 AND "status" IN (\'ENROLLED\', \'BLOCKED\')'],
    ] as const;

    for (const [name, query] of checks) {
      const rows = (await tx.$queryRawUnsafe(`EXPLAIN (FORMAT JSON, COSTS OFF) ${query}`)) as Array<{ 'QUERY PLAN': Array<{ Plan: PlanNode }> }>;
      planResults.push(`${name}: ${indexNames(rows[0]['QUERY PLAN'][0].Plan).join(', ')}`);
    }
    throw new Error('ROLLBACK_PLAN_CHECK');
  }, { timeout: 30_000 });
} catch (error) {
  if (!(error instanceof Error) || error.message !== 'ROLLBACK_PLAN_CHECK') throw error;
} finally {
  await prisma.$disconnect();
}

planResults.forEach((result) => console.log(result));
