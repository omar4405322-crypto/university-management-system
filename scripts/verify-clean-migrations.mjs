import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiDir = path.resolve(__dirname, '../artifacts/api-server');
const require = createRequire(import.meta.url);
const { PrismaClient } = require(path.join(apiDir, 'node_modules/@prisma/client'));
const envPath = path.join(apiDir, '.env');
if (fs.existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

const sourceDbUrl = process.env.DATABASE_URL;
if (!sourceDbUrl) {
  console.error('DATABASE_URL is not set in artifacts/api-server/.env');
  process.exit(1);
}

// Derive a clean temporary test database name
const parsed = new URL(sourceDbUrl.replace('postgresql://', 'http://').replace('postgres://', 'http://'));
const tempDbName = 'temp_clean_migration_repro_test';
parsed.pathname = `/${tempDbName}`;
const tempDbUrl = `postgresql://${parsed.username}:${parsed.password}@${parsed.hostname}:${parsed.port || 5432}/${tempDbName}?schema=public`;

console.log('=== CLEAN POSTGRESQL MIGRATION REPRODUCIBILITY TEST ===');
console.log(`Target Temp DB: ${tempDbName} on ${parsed.hostname}:${parsed.port || 5432}`);

const mainPrisma = new PrismaClient({
  datasources: { db: { url: sourceDbUrl } },
});

try {
  // 1. Create clean temporary database
  console.log('1. Creating clean temporary database...');
  await mainPrisma.$executeRawUnsafe(`DROP DATABASE IF EXISTS ${tempDbName}`);
  await mainPrisma.$executeRawUnsafe(`CREATE DATABASE ${tempDbName}`);
  console.log(`   Database ${tempDbName} created successfully.`);

  // 2. Run prisma migrate deploy from an empty database
  console.log('2. Running "prisma migrate deploy" on clean database...');
  const env = { ...process.env, DATABASE_URL: tempDbUrl };
  const deployOutput = execSync('npx prisma migrate deploy', {
    cwd: apiDir,
    env,
    encoding: 'utf8',
  });
  console.log('   Migration Deploy Output:');
  console.log(deployOutput.split('\n').map(l => '   ' + l).join('\n'));

  // 3. Verify migration count in _prisma_migrations table
  const tempPrisma = new PrismaClient({
    datasources: { db: { url: tempDbUrl } },
  });
  const migrations = await tempPrisma.$queryRawUnsafe(
    'SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY started_at ASC'
  );
  console.log(`3. Verified ${migrations.length} migrations applied in order to clean database.`);
  if (migrations.length !== 30) {
    throw new Error(`Expected exactly 30 migrations applied, found ${migrations.length}`);
  }
  const lastMigration = migrations[migrations.length - 1];
  console.log(`   Initial Migration: ${migrations[0].migration_name}`);
  console.log(`   Latest Migration:  ${lastMigration.migration_name}`);
  if (lastMigration.migration_name !== '20261002030000_add_ai_conversation_attachments') {
    throw new Error(`Latest migration was expected to be 20261002030000_add_ai_conversation_attachments, but got ${lastMigration.migration_name}`);
  }

  // 4. Verify zero schema drift between schema.prisma and the cleanly migrated database
  console.log('4. Checking schema drift between schema.prisma and migrated database...');
  const diffOutput = execSync('npx prisma migrate diff --from-schema-datamodel prisma/schema.prisma --to-schema-datasource prisma/schema.prisma --exit-code', {
    cwd: apiDir,
    env,
    encoding: 'utf8',
  });
  console.log('   Schema Drift Check: ZERO DRIFT (Clean match)');
  console.log(diffOutput ? diffOutput : '   No differences found between datamodel and database.');

  await tempPrisma.$disconnect();

  // 5. Clean up temporary database
  console.log('5. Safely dropping clean temporary test database...');
  await mainPrisma.$executeRawUnsafe(`DROP DATABASE IF EXISTS ${tempDbName}`);
  console.log('   Temporary database removed cleanly.');

  console.log('\n✅ MIGRATION REPRODUCIBILITY TEST PASSED: ALL 28 MIGRATIONS APPLY REPRODUCIBLY FROM CLEAN DATABASE WITH ZERO DRIFT.\n');
} catch (err) {
  console.error('❌ MIGRATION REPRODUCIBILITY FAILED:', err.message);
  try {
    await mainPrisma.$executeRawUnsafe(`DROP DATABASE IF EXISTS ${tempDbName}`);
  } catch {}
  process.exit(1);
} finally {
  await mainPrisma.$disconnect();
}
