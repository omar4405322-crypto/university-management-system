const crypto = require('node:crypto');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

// 1. Guard against non-test execution
if (process.env.NODE_ENV !== 'test') {
  console.error('[seed.test-baseline ERROR] Refusing to run seed.test-baseline.cjs: NODE_ENV must be "test"');
  process.exit(1);
}

let prisma;

async function main() {
  // Validate database isolation guard - fail closed before any Prisma call
  try {
    const preloadUrl = pathToFileURL(path.resolve(__dirname, '../../../scripts/test-preload.mjs')).href;
    const { assertTestDatabasePreload } = await import(preloadUrl);
    assertTestDatabasePreload(process.env);
  } catch (err) {
    const rawMsg = err?.message || 'Database safety guard failed';
    const safeMsg = rawMsg
      .replace(/postgres(ql)?:\/\/\S+/gi, '[REDACTED_URL]')
      .replace(/postgresql:\/\/[^@\s]+@/gi, '[REDACTED]@')
      .replace(/postgres:\/\/[^@\s]+@/gi, '[REDACTED]@');
    console.error(`[seed.test-baseline ERROR] Refusing test seed execution: ${safeMsg}`);
    process.exit(1);
  }

  prisma = new PrismaClient();

  console.log('[seed.test-baseline] Seeding minimal test baseline data...');

  // 1. Department fallback
  const firstDept = await prisma.department.findFirst({ select: { id: true } });
  const departmentId = firstDept ? firstDept.id : 1;

  // 2. Academic Year & Term
  // Deactivate any currently active years/terms before setting 2026-2027 as current
  await prisma.academicTerm.updateMany({
    where: { isCurrent: true },
    data: { isCurrent: false },
  });
  await prisma.academicYear.updateMany({
    where: { isCurrent: true },
    data: { isCurrent: false },
  });

  const academicYear = await prisma.academicYear.upsert({
    where: { name: '2026-2027' },
    update: {
      isCurrent: true,
      startDate: new Date('2026-09-01T00:00:00.000Z'),
      endDate: new Date('2027-06-30T23:59:59.999Z'),
    },
    create: {
      name: '2026-2027',
      startDate: new Date('2026-09-01T00:00:00.000Z'),
      endDate: new Date('2027-06-30T23:59:59.999Z'),
      isCurrent: true,
    },
  });

  const existingTerm = await prisma.academicTerm.findFirst({
    where: {
      academicYearId: academicYear.id,
      semesterNumber: 1,
    },
  });

  if (existingTerm) {
    await prisma.academicTerm.update({
      where: { id: existingTerm.id },
      data: {
        isCurrent: true,
        name: 'Fall 2026',
        termType: 'FALL',
        startDate: new Date('2026-09-01T00:00:00.000Z'),
        endDate: new Date('2027-01-31T23:59:59.999Z'),
      },
    });
  } else {
    await prisma.academicTerm.create({
      data: {
        academicYearId: academicYear.id,
        name: 'Fall 2026',
        termType: 'FALL',
        semesterNumber: 1,
        startDate: new Date('2026-09-01T00:00:00.000Z'),
        endDate: new Date('2027-01-31T23:59:59.999Z'),
        isCurrent: true,
      },
    });
  }

  // 3. Teaching Assistant baseline
  const taCount = await prisma.teachingAssistant.count();
  if (taCount === 0) {
    const randomPassword = crypto.randomBytes(32).toString('hex');
    const hashedPassword = await bcrypt.hash(randomPassword, 10);

    const taUser = await prisma.user.upsert({
      where: { email: 'ta.baseline@university.local' },
      update: { role: 'TEACHING_ASSISTANT', isActive: true },
      create: {
        email: 'ta.baseline@university.local',
        password: hashedPassword,
        role: 'TEACHING_ASSISTANT',
        isActive: true,
      },
    });

    await prisma.teachingAssistant.upsert({
      where: { userId: taUser.id },
      update: { status: 'ACTIVE', departmentId },
      create: {
        userId: taUser.id,
        employeeId: 'TA-BASELINE-001',
        firstName: 'Baseline',
        lastName: 'TA',
        departmentId,
        status: 'ACTIVE',
      },
    });
  }

  // 4. Room baseline
  const roomCount = await prisma.room.count();
  if (roomCount === 0) {
    await prisma.room.create({
      data: {
        name: 'Hall 101',
        radius: 100,
        isActive: true,
      },
    });
  }

  // 5. StudentGroup baseline
  const groupCount = await prisma.studentGroup.count();
  if (groupCount === 0) {
    await prisma.studentGroup.create({
      data: {
        name: 'Group 1',
        year: 1,
        departmentId,
      },
    });
  }

  // 6. Synchronize all PostgreSQL autoincrement sequences
  await prisma.$executeRawUnsafe(`
    DO $$
    DECLARE
        r RECORD;
        seq_name text;
    BEGIN
        FOR r IN (
            SELECT table_name, column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND column_default LIKE 'nextval(%'
        ) LOOP
            seq_name := pg_get_serial_sequence(quote_ident(r.table_name), r.column_name);
            IF seq_name IS NOT NULL THEN
                EXECUTE format('SELECT setval(%L, coalesce(max(%I), 1)) FROM %I',
                    seq_name, r.column_name, r.table_name);
            END IF;
        END LOOP;
    END $$;
  `);

  console.log('[seed.test-baseline] Test baseline seeding completed successfully.');
}

main()
  .catch((err) => {
    console.error('[seed.test-baseline ERROR]', err.message);
    process.exit(1);
  })
  .finally(async () => {
    if (prisma) {
      await prisma.$disconnect().catch(() => {});
    }
  });
