import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

let PrismaClient;
try {
  ({ PrismaClient } = require('../artifacts/api-server/node_modules/@prisma/client'));
} catch {
  ({ PrismaClient } = require('@prisma/client'));
}

const prisma =
  globalThis.__scriptPrisma ||
  new PrismaClient({
    log: ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.__scriptPrisma = prisma;
}

export default prisma;
