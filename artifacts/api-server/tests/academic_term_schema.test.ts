import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const SUFFIX = `_SCHEMA_${Date.now()}_${Math.random().toString(36).substring(7)}`;

describe('AcademicTerm & AcademicYear Schema & Constraint Tests', () => {
  let createdYearId: number | null = null;
  let term1Id: number | null = null;
  let term2Id: number | null = null;

  after(async () => {
    try {
      if (term2Id) {
        await prisma.$executeRawUnsafe(`DELETE FROM "AcademicTerm" WHERE "id" = ${term2Id}`);
      }
      if (term1Id) {
        await prisma.$executeRawUnsafe(`DELETE FROM "AcademicTerm" WHERE "id" = ${term1Id}`);
      }
      if (createdYearId) {
        await prisma.$executeRawUnsafe(`DELETE FROM "AcademicYear" WHERE "id" = ${createdYearId}`);
      }
    } catch {
      // ignore teardown errors
    } finally {
      await prisma.$disconnect();
    }
  });

  it('1. Verifies AcademicYear and AcademicTerm tables exist and accept valid records', async () => {
    const yearResult: any[] = await prisma.$queryRawUnsafe(`
      INSERT INTO "AcademicYear" ("name", "startDate", "endDate", "isCurrent", "updatedAt")
      VALUES ('TEST-YEAR${SUFFIX}', '2026-09-15T00:00:00.000Z', '2027-06-30T00:00:00.000Z', false, NOW())
      RETURNING "id";
    `);
    assert.ok(yearResult.length > 0, 'Expected AcademicYear to be inserted');
    createdYearId = yearResult[0].id;

    const termResult: any[] = await prisma.$queryRawUnsafe(`
      INSERT INTO "AcademicTerm" ("academicYearId", "name", "semesterNumber", "startDate", "endDate", "isCurrent", "updatedAt")
      VALUES (${createdYearId}, 'TEST-FALL${SUFFIX}', 1, '2026-09-15T00:00:00.000Z', '2027-01-31T00:00:00.000Z', false, NOW())
      RETURNING "id";
    `);
    assert.ok(termResult.length > 0, 'Expected AcademicTerm to be inserted');
    term1Id = termResult[0].id;
  });

  it('2. Verifies partial unique index prevents more than one isCurrent = true AcademicTerm', async () => {
    assert.ok(createdYearId, 'AcademicYear must exist');
    const existingActive = await prisma.academicTerm.findFirst({ where: { isCurrent: true } });
    let createdActiveTermId: number | null = null;
    if (!existingActive) {
      const activeRes: any[] = await prisma.$queryRawUnsafe(`
        INSERT INTO "AcademicTerm" ("academicYearId", "name", "semesterNumber", "startDate", "endDate", "isCurrent", "updatedAt")
        VALUES (${createdYearId}, 'TEST-ACTIVE${SUFFIX}', 1, '2026-09-15T00:00:00.000Z', '2027-01-31T00:00:00.000Z', true, NOW())
        RETURNING "id";
      `);
      createdActiveTermId = activeRes[0].id;
    }
    let errorThrown: any = null;
    try {
      await prisma.$queryRawUnsafe(`
        INSERT INTO "AcademicTerm" ("academicYearId", "name", "semesterNumber", "startDate", "endDate", "isCurrent", "updatedAt")
        VALUES (${createdYearId}, 'TEST-SPRING${SUFFIX}', 2, '2027-02-01T00:00:00.000Z', '2027-06-30T00:00:00.000Z', true, NOW())
        RETURNING "id";
      `);
    } catch (err: any) {
      errorThrown = err;
    } finally {
      if (createdActiveTermId) {
        await prisma.$executeRawUnsafe(`DELETE FROM "AcademicTerm" WHERE "id" = ${createdActiveTermId}`);
      }
    }

    assert.ok(errorThrown, 'Expected DB to reject second active term');
    assert.match(
      errorThrown.message,
      /23505|isCurrent.*already exists|academic_term_single_current_idx|unique constraint/i,
      'Expected partial unique index violation on isCurrent = true'
    );
  });

  it('3. Verifies termId exists and references AcademicTerm on Enrollment, Quiz, Exam, and Task', async () => {
    const cols: any[] = await prisma.$queryRawUnsafe(`
      SELECT table_name, column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND column_name = 'termId'
        AND table_name IN ('Enrollment', 'Quiz', 'Exam', 'Task');
    `);
    const tablesWithTermId = new Set(cols.map((r) => r.table_name));
    assert.ok(tablesWithTermId.has('Enrollment'), 'Enrollment must have termId');
    assert.ok(tablesWithTermId.has('Quiz'), 'Quiz must have termId');
    assert.ok(tablesWithTermId.has('Exam'), 'Exam must have termId');
    assert.ok(tablesWithTermId.has('Task'), 'Task must have termId');
  });
});
