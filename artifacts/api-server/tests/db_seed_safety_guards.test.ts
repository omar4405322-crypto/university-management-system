import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(testDir, '..');

const ALL_SEED_SCRIPTS = [
  'prisma/seed.cjs',
  'prisma/seed.ts',
  'prisma/seed-timetable.ts',
  'prisma/seed-realistic-data.ts',
  'prisma/backfill-timetable.ts',
] as const;

function runDatabaseSeedSafetyGuardTests() {
  for (const relativePath of ALL_SEED_SCRIPTS) {
    const fullPath = path.join(apiRoot, relativePath);
    const source = readFileSync(fullPath, 'utf8');

    const guardMatch = source.match(/NODE_ENV\??\.(?:trim\(\)\.)?toLowerCase\(\)\s*===\s*['"]production['"]/);
    assert.ok(
      guardMatch !== null,
      `${relativePath} must contain strict case-insensitive production guard (NODE_ENV?.trim().toLowerCase() === 'production')`
    );

    const guardIndex = source.indexOf(guardMatch[0]);
    const clientIndex = source.indexOf('new PrismaClient(');

    assert.ok(
      clientIndex >= 0 && guardIndex < clientIndex,
      `${relativePath} must refuse production before constructing new PrismaClient()`
    );
  }

  // Runtime guard verification for seed-realistic-data host check logic
  const realisticSource = readFileSync(path.join(apiRoot, 'prisma/seed-realistic-data.ts'), 'utf8');
  assert.ok(
    realisticSource.includes('LOCAL_DATABASE_HOSTS') && realisticSource.includes('Refusing non-local database host'),
    'seed-realistic-data.ts must enforce local database host check for destructive operations'
  );
}

function runBehavioralSeedSafetyGuardTests() {
  const scriptsToTest = [
    'prisma/seed-realistic-data.ts',
    'prisma/backfill-timetable.ts',
  ] as const;

  for (const relScript of scriptsToTest) {
    const scriptFullPath = path.join(apiRoot, relScript);
    const result = spawnSync(
      process.execPath,
      ['--import', 'tsx', scriptFullPath],
      {
        cwd: apiRoot,
        env: {
          ...process.env,
          NODE_ENV: 'development',
          DATABASE_URL: 'postgresql://x:x@db.invalid:5432/x',
        },
        timeout: 30000,
        encoding: 'utf8',
      }
    );

    const stdout = result.stdout || '';
    const stderr = result.stderr || '';

    assert.equal(
      result.status,
      1,
      `${relScript} must exit with code 1 when given a non-local DATABASE_URL in development (status: ${result.status}, stderr: ${stderr})`
    );
    assert.ok(
      stderr.includes('Refusing non-local database host'),
      `${relScript} stderr must contain "Refusing non-local database host" (received: ${stderr})`
    );
    assert.ok(
      !stdout.includes('Starting timetable backfill'),
      `${relScript} stdout must not contain "Starting timetable backfill"`
    );
  }
}

runDatabaseSeedSafetyGuardTests();
runBehavioralSeedSafetyGuardTests();
console.log('Database seed safety guards passed');

