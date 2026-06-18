import { PrismaClient } from '@prisma/client';
import { redis } from '../src/utils/redis.utils';

export default async (): Promise<void> => {
  const prisma = new PrismaClient();
  await prisma.$disconnect();
  if (redis) {
    await redis.quit();
  }
};
