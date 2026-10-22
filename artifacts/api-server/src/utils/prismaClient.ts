import { PrismaClient } from '@prisma/client';
import { assertTestDatabase } from '../config/testDbGuard';

declare global {
  var prisma: PrismaClient | undefined;
}

if (process.env.NODE_ENV?.trim().toLowerCase() === 'test') {
  assertTestDatabase(process.env);
}

const prisma =
  global.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') global.prisma = prisma;

export default prisma;

