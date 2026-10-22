import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertTestDatabasePreload } from './test-preload.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

let PrismaClient;
try {
  ({ PrismaClient } = require('../artifacts/api-server/node_modules/@prisma/client'));
} catch {
  ({ PrismaClient } = require('@prisma/client'));
}

if (process.env.NODE_ENV?.trim().toLowerCase() === 'test') {
  assertTestDatabasePreload(process.env);
}

const clientDatasourceUrl =
  process.env.NODE_ENV?.trim().toLowerCase() === 'test' && process.env.TEST_DATABASE_URL
    ? process.env.TEST_DATABASE_URL
    : undefined;

const prisma =
  globalThis.__scriptPrisma ||
  new PrismaClient({
    log: ['error'],
    ...(clientDatasourceUrl ? { datasources: { db: { url: clientDatasourceUrl } } } : {}),
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.__scriptPrisma = prisma;
}

export default prisma;

